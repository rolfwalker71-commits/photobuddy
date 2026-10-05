import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import http2 from "node:http2";

/** APNs sender for the native iOS app: Node http2 + crypto only, no dependencies. */

export type ApnsEnvironment = "sandbox" | "production";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  /** PEM contents of the .p8 key. */
  key: string;
  topic: string;
};

export const DEFAULT_APNS_TOPIC = "ch.rolfwalker.photobuddy";
const JWT_TTL_MS = 50 * 60 * 1000;

export function isApnsEnvironment(value: unknown): value is ApnsEnvironment {
  return value === "sandbox" || value === "production";
}

export function apnsHost(environment: ApnsEnvironment) {
  return environment === "sandbox"
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
}

/** Reads the config from env; null when anything required is missing. */
export function readApnsConfig(
  env: Record<string, string | undefined> = process.env,
  readFile: (path: string) => string = (p) => readFileSync(p, "utf8"),
): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  if (!keyId || !teamId) return null;
  let key = env.APNS_KEY_P8?.trim() ?? "";
  if (key) {
    key = key.replace(/\\n/g, "\n");
  } else if (env.APNS_KEY_PATH?.trim()) {
    try {
      key = readFile(env.APNS_KEY_PATH.trim()).trim();
    } catch {
      return null;
    }
  }
  if (!key.includes("PRIVATE KEY")) return null;
  return {
    keyId,
    teamId,
    key,
    topic: env.APNS_TOPIC?.trim() || DEFAULT_APNS_TOPIC,
  };
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

/** ES256 provider token (JWT) as required by APNs. */
export function buildApnsJwt(
  config: Pick<ApnsConfig, "keyId" | "teamId" | "key">,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = b64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const data = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(data), {
    key: createPrivateKey(config.key),
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${b64url(signature)}`;
}

let jwtCache: { token: string; keyId: string; at: number } | null = null;

export function getApnsJwt(config: ApnsConfig, now = Date.now()) {
  if (
    jwtCache &&
    jwtCache.keyId === config.keyId &&
    now - jwtCache.at < JWT_TTL_MS
  ) {
    return jwtCache.token;
  }
  const token = buildApnsJwt(config, Math.floor(now / 1000));
  jwtCache = { token, keyId: config.keyId, at: now };
  return token;
}

export function resetApnsCache() {
  jwtCache = null;
  warned = false;
}

export type ApnsMessage = {
  title: string;
  body: string;
  albumId?: string | null;
  photoId?: string | null;
};

export function buildApnsPayload(message: ApnsMessage) {
  const payload: Record<string, unknown> = {
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
      ...(message.albumId ? { "thread-id": message.albumId } : {}),
    },
  };
  if (message.photoId) payload.photoId = message.photoId;
  if (message.albumId) payload.albumId = message.albumId;
  return payload;
}

/** APNs says the token is dead and should be forgotten. */
export function isDeadTokenResponse(status: number, reason?: string | null) {
  return status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
}

let warned = false;
function getConfigOnce() {
  const config = readApnsConfig();
  if (!config && !warned) {
    warned = true;
    console.log("APNs nicht konfiguriert (APNS_KEY_ID/APNS_TEAM_ID/Schlüssel) – Push für die iOS-App ist aus.");
  }
  return config;
}

export function apnsEnabled() {
  return getConfigOnce() !== null;
}

export type ApnsTarget = { token: string; environment: ApnsEnvironment };
export type ApnsResult = {
  token: string;
  status: number;
  reason: string | null;
  dead: boolean;
};

function sendOne(
  session: http2.ClientHttp2Session,
  config: ApnsConfig,
  target: ApnsTarget,
  body: string,
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let status = 0;
    let raw = "";
    const finish = () => {
      let reason: string | null = null;
      try {
        reason = (JSON.parse(raw) as { reason?: string }).reason ?? null;
      } catch {
        /* empty body on success */
      }
      resolve({
        token: target.token,
        status,
        reason,
        dead: isDeadTokenResponse(status, reason),
      });
    };
    try {
      const req = session.request({
        ":method": "POST",
        ":path": `/3/device/${target.token}`,
        authorization: `bearer ${getApnsJwt(config)}`,
        "apns-topic": config.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      req.setEncoding("utf8");
      req.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      req.on("data", (chunk: string) => {
        raw += chunk;
      });
      req.on("end", finish);
      req.on("error", () => {
        status = status || 0;
        finish();
      });
      req.end(body);
    } catch {
      finish();
    }
  });
}

/**
 * Sends one message to many devices (one HTTP/2 session per APNs host).
 * Returns [] when APNs is not configured. Never throws.
 */
export async function sendApns(
  targets: ApnsTarget[],
  message: ApnsMessage,
): Promise<ApnsResult[]> {
  const config = getConfigOnce();
  if (!config || targets.length === 0) return [];
  const body = JSON.stringify(buildApnsPayload(message));
  const byEnv = new Map<ApnsEnvironment, ApnsTarget[]>();
  for (const t of targets) {
    byEnv.set(t.environment, [...(byEnv.get(t.environment) ?? []), t]);
  }
  const results: ApnsResult[] = [];
  await Promise.all(
    [...byEnv.entries()].map(async ([environment, list]) => {
      let session: http2.ClientHttp2Session | null = null;
      try {
        session = http2.connect(`https://${apnsHost(environment)}`);
        session.on("error", (err) => console.error("apns session", err));
        const s = session;
        const part = await Promise.all(list.map((t) => sendOne(s, config, t, body)));
        results.push(...part);
      } catch (err) {
        console.error("apns send failed", err);
      } finally {
        session?.close();
      }
    }),
  );
  for (const r of results) {
    if (r.status !== 200 && !r.dead) {
      console.error("apns rejected", r.status, r.reason);
    }
  }
  return results;
}

import { EventEmitter } from "node:events";
import { generateKeyPairSync, verify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requests: Array<{ headers: Record<string, string>; body: string }> = [];
const connects: string[] = [];
let nextStatus = 200;
let nextBody = "";

vi.mock("node:http2", () => {
  const connect = (url: string) => {
    connects.push(url);
    const session = new EventEmitter() as EventEmitter & {
      request: (h: Record<string, string>) => EventEmitter;
      close: () => void;
    };
    session.close = () => {};
    session.request = (headers) => {
      const req = new EventEmitter() as EventEmitter & {
        setEncoding: () => void;
        end: (b: string) => void;
      };
      req.setEncoding = () => {};
      req.end = (body: string) => {
        requests.push({ headers, body });
        queueMicrotask(() => {
          req.emit("response", { ":status": nextStatus });
          if (nextBody) req.emit("data", nextBody);
          req.emit("end");
        });
      };
      return req;
    };
    return session;
  };
  return { default: { connect }, connect };
});

const apns = await import("@/lib/push/apns");

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const env = { APNS_KEY_ID: "ABC123DEFG", APNS_TEAM_ID: "TEAM123456", APNS_KEY_P8: pem };

beforeEach(() => {
  requests.length = 0;
  connects.length = 0;
  nextStatus = 200;
  nextBody = "";
  apns.resetApnsCache();
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  Object.assign(process.env, env);
});

describe("readApnsConfig", () => {
  it("is null without key id, team or key", () => {
    expect(apns.readApnsConfig({})).toBeNull();
    expect(apns.readApnsConfig({ ...env, APNS_TEAM_ID: "" })).toBeNull();
    expect(apns.readApnsConfig({ ...env, APNS_KEY_P8: "" })).toBeNull();
  });
  it("accepts \\n-escaped PEM and defaults the topic", () => {
    const cfg = apns.readApnsConfig({
      ...env,
      APNS_KEY_P8: pem.replace(/\n/g, "\\n"),
    });
    expect(cfg?.key).toContain("\n");
    expect(cfg?.topic).toBe("ch.rolfwalker.photobuddy");
  });
  it("reads the key from APNS_KEY_PATH and honours APNS_TOPIC", () => {
    const cfg = apns.readApnsConfig(
      { ...env, APNS_KEY_P8: "", APNS_KEY_PATH: "/k.p8", APNS_TOPIC: "x.y" },
      () => pem,
    );
    expect(cfg?.topic).toBe("x.y");
    expect(cfg?.key).toContain("PRIVATE KEY");
  });
});

describe("buildApnsJwt", () => {
  it("builds a verifiable ES256 token", () => {
    const jwt = apns.buildApnsJwt({ keyId: "K1", teamId: "T1", key: pem }, 1000);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "K1",
    });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toEqual({
      iss: "T1",
      iat: 1000,
    });
    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(s, "base64url"),
    );
    expect(ok).toBe(true);
  });
  it("caches the token for 50 minutes", () => {
    const cfg = apns.readApnsConfig(env)!;
    const a = apns.getApnsJwt(cfg, 0);
    expect(apns.getApnsJwt(cfg, 49 * 60_000)).toBe(a);
    expect(apns.getApnsJwt(cfg, 51 * 60_000)).not.toBe(a);
  });
});

describe("payload and hosts", () => {
  it("builds the aps payload", () => {
    expect(
      apns.buildApnsPayload({ title: "T", body: "B", albumId: "a1", photoId: "p1" }),
    ).toEqual({
      aps: {
        alert: { title: "T", body: "B" },
        sound: "default",
        "thread-id": "a1",
      },
      photoId: "p1",
      albumId: "a1",
    });
  });
  it("picks the host per environment", () => {
    expect(apns.apnsHost("sandbox")).toBe("api.sandbox.push.apple.com");
    expect(apns.apnsHost("production")).toBe("api.push.apple.com");
  });
  it("detects dead tokens", () => {
    expect(apns.isDeadTokenResponse(410)).toBe(true);
    expect(apns.isDeadTokenResponse(400, "BadDeviceToken")).toBe(true);
    expect(apns.isDeadTokenResponse(200)).toBe(false);
  });
});

describe("sendApns", () => {
  it("skips silently when not configured", async () => {
    delete process.env.APNS_KEY_ID;
    const res = await apns.sendApns([{ token: "aa", environment: "production" }], {
      title: "t",
      body: "b",
    });
    expect(res).toEqual([]);
    expect(connects).toEqual([]);
  });
  it("sends per environment host with topic and bearer token", async () => {
    const res = await apns.sendApns(
      [
        { token: "aa", environment: "sandbox" },
        { token: "bb", environment: "production" },
      ],
      { title: "t", body: "b", albumId: "a" },
    );
    expect(connects.sort()).toEqual([
      "https://api.push.apple.com",
      "https://api.sandbox.push.apple.com",
    ]);
    expect(res).toHaveLength(2);
    const req = requests.find((r) => r.headers[":path"] === "/3/device/aa")!;
    expect(req.headers["apns-topic"]).toBe("ch.rolfwalker.photobuddy");
    expect(req.headers.authorization).toMatch(/^bearer /);
    expect(JSON.parse(req.body).aps.alert.title).toBe("t");
  });
  it("flags dead tokens", async () => {
    nextStatus = 410;
    nextBody = JSON.stringify({ reason: "Unregistered" });
    const res = await apns.sendApns([{ token: "aa", environment: "production" }], {
      title: "t",
      body: "b",
    });
    expect(res[0].dead).toBe(true);
  });
});

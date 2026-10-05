import { HttpError, requireTeilnehmer } from "@/lib/auth/request";
import {
  AI_RATE_LIMIT_MESSAGE,
  AI_UNAVAILABLE_MESSAGE,
  AiUpstreamError,
  allowAiRequest,
  openaiConfigured,
} from "@/lib/ai";

/** Teilnehmer check, 503 without OPENAI_API_KEY, light per-user rate limit. */
export async function requireAiUser() {
  const user = await requireTeilnehmer();
  if (!openaiConfigured()) throw new HttpError(503, AI_UNAVAILABLE_MESSAGE);
  if (!allowAiRequest(user.id)) throw new HttpError(429, AI_RATE_LIMIT_MESSAGE);
  return user;
}

/** Upstream/model failures become 502 with a German message. */
export function wrapAiError(err: unknown) {
  if (err instanceof AiUpstreamError) {
    return new HttpError(502, `KI-Dienst nicht erreichbar oder unbrauchbar: ${err.message}`);
  }
  return err;
}

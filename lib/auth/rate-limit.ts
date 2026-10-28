import "server-only";
import { db } from "./db";

// Atomic, database-backed limiter shared across serverless instances.
export async function allowedAttempt(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await db().rpc("check_auth_rate_limit", {
    p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) throw error; // Fail closed if rate limiting is unavailable.
  return data === true;
}

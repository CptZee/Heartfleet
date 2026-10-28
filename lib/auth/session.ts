import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "heartfleet_session";
const DURATION = 60 * 60 * 24 * 14;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION * 1000).toISOString();
  const { error } = await db().from("sessions").insert({ user_id: userId, token_hash: hashToken(token), expires_at: expiresAt });
  if (error) throw error;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: DURATION,
  });
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { data: session } = await db().from("sessions")
    .select("user_id,expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
  const { data: user } = await db().from("users")
    .select("id,username").eq("id", session.user_id).maybeSingle();
  return user;
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db().from("sessions").delete().eq("token_hash", hashToken(token));
  store.delete(COOKIE);
}

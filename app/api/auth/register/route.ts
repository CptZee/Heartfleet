import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/auth/db";
import { createSession } from "@/lib/auth/session";
import { allowedAttempt } from "@/lib/auth/rate-limit";
import { clientKey } from "@/lib/auth/request";
import { validPassword, validUsername } from "@/lib/auth/validation";

export async function POST(request: NextRequest) {
  try {
    if (!(await allowedAttempt(clientKey(request, "register"), 5, 3600)))
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const body = await request.json();
    if (!validUsername(body?.username) || !validPassword(body?.password))
      return NextResponse.json({ error: "Use 3–20 letters, numbers or underscores for username, and an 8–128 character password." }, { status: 400 });
    const username = body.username;
    const password_hash = await argon2.hash(body.password, { type: argon2.argon2id });
    const { data, error } = await db().from("users").insert({ username, password_hash }).select("id").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Username is unavailable." }, { status: 409 });
      throw error;
    }
    await createSession(data.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}

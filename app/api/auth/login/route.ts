import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/auth/db";
import { createSession } from "@/lib/auth/session";
import { allowedAttempt } from "@/lib/auth/rate-limit";
import { clientKey } from "@/lib/auth/request";
import { validUsername } from "@/lib/auth/validation";

export async function POST(request: NextRequest) {
  try {
    if (!(await allowedAttempt(clientKey(request, "login"), 10, 900)))
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const body = await request.json();
    if (!validUsername(body?.username) || typeof body?.password !== "string" || body.password.length > 128)
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    const { data: user } = await db().from("users").select("id,password_hash")
      .eq("username", body.username.toLowerCase()).maybeSingle();
    if (!user || !(await argon2.verify(user.password_hash, body.password)))
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}

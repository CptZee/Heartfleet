import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/auth/db";
import { createSession } from "@/lib/auth/session";
import { allowedAttempt } from "@/lib/auth/rate-limit";
import { clientKey } from "@/lib/auth/request";
import { validUsername } from "@/lib/auth/validation";

export async function POST(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === "development";

  const loginError = (reason: string, status: number = 401) =>
    NextResponse.json(
      {
        error: isDevelopment
          ? reason
          : status === 429
            ? "Too many attempts. Try again later."
            : status === 500
              ? "Unable to log in right now."
              : "Invalid username or password.",
      },
      { status }
    );

  try {
    if (!(await allowedAttempt(clientKey(request, "login"), 10, 900))) {
      return loginError(
        "Rate limit exceeded: Maximum of 10 login attempts per 15 minutes.",
        429
      );
    }

    const body = await request.json();

    if (!validUsername(body?.username)) {
      return loginError(
        "Invalid username: Username must contain 3–20 letters, numbers, or underscores."
      );
    }

    if (typeof body?.password !== "string") {
      return loginError("Invalid password: Password must be a string.");
    }

    if (body.password.length > 128) {
      return loginError(
        "Invalid password: Password exceeds the maximum length of 128 characters."
      );
    }

    const { data: user, error: dbError } = await db()
      .from("users")
      .select("id,password_hash")
      .eq("username", body.username)
      .maybeSingle();

    if (dbError) {
      console.error("Login database error:", dbError);

      return loginError(
        `Database error: ${dbError.message}`,
        500
      );
    }

    if (!user) {
      return loginError("Login failed: Username does not exist.");
    }

    const passwordMatches = await argon2.verify(
      user.password_hash,
      body.password
    );

    if (!passwordMatches) {
      return loginError("Login failed: Incorrect password.");
    }

    await createSession(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login failed:", error);

    return loginError(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
}
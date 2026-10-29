import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { db } from "@/lib/auth/db";
import { createSession } from "@/lib/auth/session";
import { allowedAttempt } from "@/lib/auth/rate-limit";
import { clientKey } from "@/lib/auth/request";
import { validPassword, validUsername } from "@/lib/auth/validation";


export async function POST(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === "development";

  const registrationError = (
    developmentMessage: string,
    productionMessage: string,
    status: number
  ) => {
    return NextResponse.json(
      {
        error: isDevelopment
          ? developmentMessage
          : productionMessage,
      },
      { status }
    );
  };

  try {
    const key = clientKey(request, "register");

    const allowed = await allowedAttempt(key, 5, 3600);

    if (!allowed) {
      console.warn("[REGISTER] Rate limit exceeded");

      return registrationError(
        "Registration rate limit exceeded (5 attempts per hour).",
        "Too many attempts. Try again later.",
        429
      );
    }

    const body = await request.json();

    if (!validUsername(body?.username)) {
      console.warn("[REGISTER] Invalid username");

      return registrationError(
        "Invalid username. Expected 3–20 letters, numbers, or underscores.",
        "Invalid registration details.",
        400
      );
    }

    if (!validPassword(body?.password)) {
      console.warn("[REGISTER] Invalid password");

      return registrationError(
        "Invalid password. Expected 8–128 characters.",
        "Invalid registration details.",
        400
      );
    }

    const username = body.username;

    console.log("[REGISTER] Attempting registration", {
      username,
    });

    const password_hash = await argon2.hash(body.password, {
      type: argon2.argon2id,
    });

    const { data, error } = await db()
      .from("users")
      .insert({
        username,
        password_hash,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[REGISTER] Database error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      if (error.code === "23505") {
        return registrationError(
          `Username "${username}" already exists (PostgreSQL error 23505).`,
          "Username is unavailable.",
          409
        );
      }

      return registrationError(
        `Database error (${error.code}): ${error.message}${error.details ? ` | ${error.details}` : ""}`,
        "Unable to create account right now.",
        500
      );
    }

    if (!data?.id) {
      console.error("[REGISTER] Insert returned no user ID");

      return registrationError(
        "Registration succeeded but the database returned no user ID.",
        "Unable to create account right now.",
        500
      );
    }

    try {
      await createSession(data.id);
    } catch (sessionError) {
      console.error("[REGISTER] Session creation failed", sessionError);

      return registrationError(
        `Account created, but session creation failed: ${sessionError instanceof Error
          ? sessionError.message
          : String(sessionError)
        }`,
        "Unable to complete registration right now.",
        500
      );
    }

    console.log("[REGISTER] Registration successful", {
      userId: data.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[REGISTER] Unexpected registration error", error);

    return registrationError(
      `Registration failed: ${error instanceof Error
        ? error.message
        : String(error)
      }`,
      "Unable to create account right now.",
      500
    );
  }
}


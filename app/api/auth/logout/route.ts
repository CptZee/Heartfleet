import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    await clearSession();

    return NextResponse.redirect(
      new URL("/login", request.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("Logout failed", error);

    return NextResponse.json(
      { error: "Could not log out." },
      { status: 500 }
    );
  }
}

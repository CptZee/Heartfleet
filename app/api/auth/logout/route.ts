import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Logout failed", error);
    return NextResponse.json({ error: "Could not log out." }, { status: 500 });
  }
}

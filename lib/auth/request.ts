import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

export function clientKey(request: NextRequest, action: string) {
  // On Vercel, this header is supplied by the trusted ingress. Do not trust
  // arbitrary forwarded-for chains; configure equivalent trusted ingress elsewhere.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${action}:${ip}`).digest("hex");
}

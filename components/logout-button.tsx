"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
      router.replace("/login"); router.refresh();
    } catch { alert("Could not log out. Please try again."); }
    finally { setBusy(false); }
  }
  return <button type="button" disabled={busy} onClick={logout} className="text-sm font-semibold text-[#995f80] hover:underline disabled:opacity-60">Log out</button>;
}

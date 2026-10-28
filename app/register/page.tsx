import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth/session";

async function RegisterContent() {
  const user = await currentUser();

  if (user) {
    redirect("/lobby");
  }

  return <AuthForm mode="register" />;
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#f3eafa] border-t-[#b97498]" />

            <p className="mt-4 text-sm text-[#927e96]">
              Preparing your voyage...
            </p>
          </div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
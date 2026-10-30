import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import GuidedTutorial from "@/components/guided-tutorial";

async function TutorialContent() {
  const user = await currentUser();

  if (!user) redirect("/login");

  return <GuidedTutorial username={user.username} />;
}

export default function TutorialPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-500">
            Preparing your tutorial...
          </p>
        </div>
      }
    >
      <TutorialContent />
    </Suspense>
  );
}
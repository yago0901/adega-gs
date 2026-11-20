import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LoginForm } from "@/modules/auth/components/login-form";
import { resolvePostLoginPath } from "@/modules/auth/post-login";

async function HomeContent() {
  await connection();
  const destination = await resolvePostLoginPath();

  if (destination !== "/") {
    redirect(destination);
  }

  return <LoginForm />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoginForm />}>
      <HomeContent />
    </Suspense>
  );
}

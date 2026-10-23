import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, registerAction } from "@/modules/auth";
import { safeCallbackUrl } from "@/modules/auth/client";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { callbackUrl, email } = await searchParams;
  const target = safeCallbackUrl(callbackUrl);
  if (await getCurrentUser()) redirect(target);

  return (
    <RegisterForm
      action={registerAction}
      callbackUrl={target}
      defaultEmail={typeof email === "string" ? email : ""}
    />
  );
}

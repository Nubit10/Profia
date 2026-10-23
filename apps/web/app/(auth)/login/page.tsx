import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, loginAction } from "@/modules/auth";
import { safeCallbackUrl } from "@/modules/auth/client";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const target = safeCallbackUrl(callbackUrl);

  if (await getCurrentUser()) redirect(target);

  return <LoginForm action={loginAction} callbackUrl={target} />;
}

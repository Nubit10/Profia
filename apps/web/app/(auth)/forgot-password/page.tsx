import type { Metadata } from "next";
import { requestPasswordResetAction } from "@/modules/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/** SPEC-0035: pedir el enlace para crear una contraseña nueva. */
export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { email } = await searchParams;
  return (
    <ForgotPasswordForm
      action={requestPasswordResetAction}
      defaultEmail={typeof email === "string" ? email : ""}
    />
  );
}

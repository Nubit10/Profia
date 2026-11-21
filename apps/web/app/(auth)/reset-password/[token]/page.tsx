import type { Metadata } from "next";
import { checkResetToken, resetPasswordAction } from "@/modules/auth";
import { InvalidResetLink, ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Contraseña nueva",
  // El token va en la URL: que no salga a otros sitios.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** SPEC-0035: crear una contraseña nueva con el enlace del correo. */
export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  if ((await checkResetToken(token)) !== "valid") return <InvalidResetLink />;
  return <ResetPasswordForm action={resetPasswordAction} token={token} />;
}

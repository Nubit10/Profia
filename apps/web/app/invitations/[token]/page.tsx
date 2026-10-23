import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/permissions";
import { getCurrentUser } from "@/modules/auth";
import { acceptInvitationAction, getInvitationPreview } from "@/modules/institutions";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = { title: "Invitación" };

export default async function InvitationPage({ params }: PageProps<"/invitations/[token]">) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitationPreview(token), getCurrentUser()]);
  const returnTo = encodeURIComponent(`/invitations/${token}`);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Profe
      </Link>
      <Card className="w-full max-w-md">
        {preview.status === "invalid" ? (
          <CardHeader>
            <CardTitle className="text-xl">Esta invitación ya no es válida</CardTitle>
            <CardDescription>
              Puede que haya vencido, que ya se haya usado o que la hayan revocado. Pide al
              administrador de tu colegio un enlace nuevo.
            </CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Te invitaron a {preview.institutionName}</CardTitle>
              <CardDescription>
                Rol: {preview.roles.map((r) => ROLE_LABELS[r]).join(" y ")}. La invitación es para{" "}
                <strong className="text-foreground">{preview.email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!user ? (
                <>
                  <Link
                    href={`/login?callbackUrl=${returnTo}`}
                    className={buttonVariants({ size: "lg" })}
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href={`/register?callbackUrl=${returnTo}&email=${encodeURIComponent(preview.email)}`}
                    className={buttonVariants({ size: "lg", variant: "outline" })}
                  >
                    Crear cuenta con {preview.email}
                  </Link>
                </>
              ) : user.email !== preview.email ? (
                <p className="text-sm text-destructive" role="alert">
                  Entraste como {user.email}. Cierra sesión y entra con {preview.email} para
                  aceptar.
                </p>
              ) : (
                <AcceptInvitation token={token} action={acceptInvitationAction} />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./config";
import { findPublicUser, type PublicUser } from "./service";

/** Usuario de la sesión actual, verificado en el servidor (incluye revocación). Memoizado por request. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return findPublicUser(userId);
});

/** RN-01: exige sesión; si no la hay, redirige al login conservando la ruta de retorno. */
export async function requireUser(returnTo?: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?callbackUrl=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

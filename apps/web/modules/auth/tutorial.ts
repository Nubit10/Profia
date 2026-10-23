import "server-only";
import { db } from "@/lib/db";

// Tutorial de primer uso (SPEC-0012 decisión 9): se guarda en el usuario para que no reaparezca
// al cambiar de equipo. No es un dato pedagógico ni de tenant.

export async function hasDismissedTutorial(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tutorialDismissedAt: true },
  });
  return !!user?.tutorialDismissedAt;
}

export async function dismissTutorial(userId: string): Promise<void> {
  await db.user.updateMany({
    where: { id: userId, tutorialDismissedAt: null },
    data: { tutorialDismissedAt: new Date() },
  });
}

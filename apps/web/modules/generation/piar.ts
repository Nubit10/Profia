import "server-only";
import { db } from "@/lib/db";
import { requireRole, type TenantContext } from "@/modules/tenancy";
import { requestPiarAdjustments, type EnginePiarRequest } from "./engine";
import { consumeProposalLimits } from "./planning";
import type { PiarProposal } from "./types";

// SPEC-0017: ajustes razonables propuestos para un periodo del PIAR. Quien llama ya quitó los
// datos personales (RN-05); aquí se aplica el límite de propuestas (RN-09) y se registra la
// generación sin contenido.

export async function proposePiarAdjustments(
  ctx: TenantContext,
  piarId: string,
  body: EnginePiarRequest,
  fetcher: typeof fetch = fetch,
): Promise<PiarProposal> {
  requireRole(ctx, "TEACHER");
  await consumeProposalLimits(ctx);
  const result = await requestPiarAdjustments(body, fetcher);
  const base = {
    institutionId: ctx.institutionId,
    membershipId: ctx.membershipId,
    task: "piar",
    entityType: "piar",
    entityId: piarId,
  };
  if (result.status !== "ok") {
    await db.generationLog.create({
      data: { ...base, status: result.status === "invalid" ? "INVALID" : "UNAVAILABLE" },
    });
    return { status: result.status };
  }
  const { meta, adjustments } = result.data;
  await db.generationLog.create({
    data: {
      ...base,
      status: "OK",
      provider: meta.provider,
      model: meta.model,
      promptVersion: meta.promptVersion,
      attempts: meta.attempts,
      latencyMs: meta.latencyMs,
      tokens: meta.tokens,
    },
  });
  return { status: "ok", adjustments };
}

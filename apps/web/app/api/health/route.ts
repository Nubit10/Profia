import { db } from "@/lib/db";
import { checkHealth } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkHealth(() => db.$queryRaw`SELECT 1`);
  return Response.json(report.body, {
    status: report.httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}

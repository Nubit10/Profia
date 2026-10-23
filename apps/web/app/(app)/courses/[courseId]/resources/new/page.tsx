import { redirect } from "next/navigation";

/** La creación vive en el asistente (SPEC-0012); esta ruta queda por compatibilidad de enlaces. */
export default async function NewResourcePage({
  params,
  searchParams,
}: PageProps<"/courses/[courseId]/resources/new">) {
  const { courseId } = await params;
  const { topicId } = await searchParams;
  const query = new URLSearchParams({ courseId });
  if (typeof topicId === "string") query.set("topicId", topicId);
  redirect(`/create?${query.toString()}`);
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { DomainError } from "@/lib/errors";
import * as resources from "@/modules/resources";
import { requireTenant } from "@/modules/tenancy";
import { ResourceView } from "./resource-view";

export const metadata: Metadata = { title: "Recurso" };

export default async function ResourcePage({
  params,
}: PageProps<"/courses/[courseId]/resources/[resourceId]">) {
  const { courseId, resourceId } = await params;
  const ctx = await requireTenant();
  const resource = await resources.getResource(ctx, resourceId).catch((error) => {
    // CA-0008-11: recurso de otro docente o de otro espacio → 404.
    if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound();
    throw error;
  });
  if (resource.courseId !== courseId) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href={`/courses/${courseId}?tab=recursos`}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <HiOutlineArrowLeft aria-hidden />
          Recursos del curso
        </Link>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{resource.title}</h1>
      </div>
      <ResourceView
        resource={resource}
        actions={{
          status: resources.resourceStatusAction,
          retry: resources.retryResourceAction,
          save: resources.saveResourceContentAction,
          setStatus: resources.setResourceStatusAction,
          duplicate: resources.duplicateResourceAction,
          gradingScale: resources.setGradingScaleAction,
          rateItem: resources.rateItemAction,
          rateResource: resources.rateResourceAction,
          addPreference: resources.addPreferenceAction,
          regenerate: resources.regenerateItemAction,
          decide: resources.decideRegenerationAction,
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { DbaCatalogProvider } from "@/components/curriculum/dba-chip";
import { NotifyCard } from "@/components/notifications/notify-card";
import { DomainError } from "@/lib/errors";
import { getCourseReferences } from "@/modules/curriculum";
import * as notifications from "@/modules/notifications";
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
  // SPEC-0014 CA-0014-12: la ficha de cada DBA del recurso sale del catálogo vigente del curso.
  const dbaRefs = await getCourseReferences(ctx, courseId)
    .then((r) => r.references.filter((ref) => ref.type === "DBA"))
    .catch(() => []);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href={`/courses/${courseId}?tab=recursos`}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground max-sm:min-h-11"
        >
          <HiOutlineArrowLeft aria-hidden />
          Recursos del curso
        </Link>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{resource.title}</h1>
      </div>
      {/* SPEC-0013 RN-15: mientras la IA trabaja, se ofrece avisar cuando termine. */}
      {resource.status === "GENERATING" && (
        <NotifyCard
          publicKey={notifications.vapidPublicKey()}
          actions={{
            register: notifications.registerPushDeviceAction,
            remove: notifications.removePushDeviceAction,
            status: notifications.pushDeviceStatusAction,
          }}
        />
      )}
      <DbaCatalogProvider references={dbaRefs}>
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
      </DbaCatalogProvider>
    </div>
  );
}

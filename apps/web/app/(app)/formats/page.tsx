import type { Metadata } from "next";
import { hasRole } from "@/lib/permissions";
import {
  deleteFormatAction,
  deleteLogoAction,
  getLogoInfo,
  listFormats,
  saveFormatAction,
  setDefaultFormatAction,
} from "@/modules/formats";
import type { FormatScope } from "@/modules/formats/client";
import { isSchoolAdmin, requireTenant } from "@/modules/tenancy";
import { FormatsView } from "./formats-view";

export const metadata: Metadata = { title: "Formatos" };

export default async function FormatsPage() {
  const ctx = await requireTenant();
  const [formats, logo] = await Promise.all([listFormats(ctx), getLogoInfo(ctx)]);
  const scopes: FormatScope[] = [
    ...(hasRole(ctx.roles, "TEACHER") ? (["TEACHER"] as const) : []),
    ...(isSchoolAdmin(ctx) ? (["INSTITUTION"] as const) : []),
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Formatos</h1>
        <p className="text-muted-foreground">Tu formato de taller y el logo de tus documentos.</p>
      </div>
      <FormatsView
        formats={formats}
        logo={logo}
        logoVersion={logo ? String(logo.updatedAt.getTime()) : "0"}
        scopes={scopes}
        canManageLogo={hasRole(ctx.roles, "ADMIN")}
        actions={{
          save: saveFormatAction,
          setDefault: setDefaultFormatAction,
          remove: deleteFormatAction,
          removeLogo: deleteLogoAction,
        }}
      />
    </div>
  );
}

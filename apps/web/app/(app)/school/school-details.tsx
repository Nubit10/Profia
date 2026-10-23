"use client";

import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { SchoolForm } from "@/components/school/school-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { RegisterSchoolInput } from "@/modules/institutions/client";

type Props = {
  defaultValues: Partial<RegisterSchoolInput>;
  action: (input: RegisterSchoolInput) => Promise<ActionResult>;
};

export function SchoolDetails({ defaultValues, action }: Props) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del colegio</CardTitle>
      </CardHeader>
      <CardContent>
        <SchoolForm
          mode="edit"
          defaultValues={defaultValues}
          action={action}
          submitLabel="Guardar cambios"
          onSuccess={() => {
            sileo.success({ title: "Datos guardados" });
            router.refresh();
          }}
        />
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HiOutlineArrowLeft, HiOutlineBuildingLibrary, HiOutlineUser } from "react-icons/hi2";
import { sileo } from "sileo";
import { SchoolForm } from "@/components/school/school-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { RegisterSchoolInput } from "@/modules/institutions/client";

type Props = {
  userName: string;
  createIndependentSpace: () => Promise<ActionResult>;
  registerSchool: (input: RegisterSchoolInput) => Promise<ActionResult>;
};

export function OnboardingView({ userName, createIndependentSpace, registerSchool }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "school">("choose");
  const [isCreating, startCreating] = useTransition();

  const goHome = () => {
    router.replace("/dashboard");
    router.refresh();
  };

  const startAlone = () =>
    startCreating(async () => {
      const result = await createIndependentSpace();
      if (!result.ok) {
        sileo.error({ title: "No pudimos crear tu espacio", description: result.error });
        return;
      }
      sileo.success({ title: "Tu espacio está listo" });
      goHome();
    });

  if (step === "school") {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 w-fit"
            onClick={() => setStep("choose")}
          >
            <HiOutlineArrowLeft aria-hidden />
            Volver
          </Button>
          <CardTitle className="text-xl">Registrar mi colegio</CardTitle>
          <CardDescription>
            Con estos datos creamos el colegio. Después podrás agregar sedes e invitar a tus
            profesores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolForm
            mode="register"
            action={registerSchool}
            submitLabel="Registrar colegio"
            onSuccess={() => {
              sileo.success({ title: "Colegio registrado" });
              goHome();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold">Hola, {userName}</h1>
        <p className="text-muted-foreground">¿Cómo vas a usar Profe?</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <HiOutlineUser className="size-6" aria-hidden />
            </span>
            <CardTitle className="text-lg">Por mi cuenta</CardTitle>
            <CardDescription>
              Soy docente y quiero organizar mis cursos y materiales. Empiezas de inmediato, sin
              llenar datos del colegio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={startAlone}
              disabled={isCreating}
            >
              {isCreating ? "Creando tu espacio…" : "Empezar por mi cuenta"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <HiOutlineBuildingLibrary className="size-6" aria-hidden />
            </span>
            <CardTitle className="text-lg">Registrar mi colegio</CardTitle>
            <CardDescription>
              Soy directivo o coordinador. Registro el colegio, sus sedes e invito a los profesores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setStep("school")}
              disabled={isCreating}
            >
              Registrar mi colegio
            </Button>
          </CardContent>
        </Card>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        ¿Te invitaron a un colegio? Abre el enlace de invitación que te compartieron.
      </p>
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthHeading } from "../auth-heading";
import {
  forgotPasswordSchema,
  type ActionResult,
  type ForgotPasswordInput,
} from "@/modules/auth/client";

type Props = {
  action: (input: ForgotPasswordInput) => Promise<ActionResult>;
  defaultEmail?: string;
};

export function ForgotPasswordForm({ action, defaultEmail = "" }: Props) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      form.setError("email", { message: result.fieldErrors?.email?.[0] ?? result.error });
      return;
    }
    setSentTo(values.email.trim().toLowerCase());
  });

  // RN-01: el mismo mensaje exista o no la cuenta.
  if (sentTo) {
    return (
      <>
        <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
          <HiOutlineEnvelope aria-hidden className="size-6" />
        </span>
        <AuthHeading title="Revisa tu correo">
          Si hay una cuenta con <strong className="text-foreground">{sentTo}</strong>, te enviamos
          un enlace para crear una contraseña nueva. Sirve una sola vez y vence en 1 hora.
        </AuthHeading>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            ¿No llega en unos minutos? Mira en la carpeta de spam o correo no deseado, o revisa que
            el correo esté bien escrito.
          </p>
          <Button variant="outline" size="xl" className="w-full" onClick={() => setSentTo(null)}>
            Escribir otro correo
          </Button>
        </div>
        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link
            href={`/login?${new URLSearchParams({ email: sentTo })}`}
            className="font-semibold text-brand-strong hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="¿Olvidaste tu contraseña?">
        Escribe el correo con el que entras y te enviamos un enlace para crear una nueva.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Correo</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@correo.com"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enviando…" : "Enviarme el enlace"}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        ¿Ya la recordaste?{" "}
        <Link href="/login" className="font-semibold text-brand-strong hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}

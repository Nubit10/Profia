"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      <Card>
        <CardHeader>
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <HiOutlineEnvelope aria-hidden className="size-6" />
          </span>
          <CardTitle role="heading" aria-level={1} className="font-display text-2xl font-semibold">
            Revisa tu correo
          </CardTitle>
          <CardDescription>
            Si hay una cuenta con <strong className="text-foreground">{sentTo}</strong>, te enviamos
            un enlace para crear una contraseña nueva. Sirve una sola vez y vence en 1 hora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿No llega en unos minutos? Mira en la carpeta de spam o correo no deseado, o revisa
              que el correo esté bien escrito.
            </p>
            <Button variant="outline" size="lg" onClick={() => setSentTo(null)}>
              Escribir otro correo
            </Button>
            <Link
              href={`/login?${new URLSearchParams({ email: sentTo })}`}
              className="py-2 text-center text-sm font-semibold text-brand-strong underline"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-display text-2xl font-semibold">
          ¿Olvidaste tu contraseña?
        </CardTitle>
        <CardDescription>
          Escribe el correo con el que entras a Profe y te enviamos un enlace para crear una nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Correo</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Button type="submit" variant="brand" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviarme el enlace"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya la recordaste?{" "}
              <Link href="/login" className="font-semibold text-brand-strong underline">
                Iniciar sesión
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

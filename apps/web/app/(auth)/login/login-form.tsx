"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/forms/password-input";
import { loginSchema, type ActionResult, type LoginInput } from "@/modules/auth/client";

type Props = {
  action: (input: LoginInput) => Promise<ActionResult>;
  callbackUrl: string;
  defaultEmail?: string;
};

function forgotHref(email: string) {
  const value = email.trim();
  return value ? `/forgot-password?${new URLSearchParams({ email: value })}` : "/forgot-password";
}

export function LoginForm({ action, callbackUrl, defaultEmail = "" }: Props) {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const email = useWatch({ control: form.control, name: "email" }) ?? "";

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      sileo.error({ title: "No pudimos iniciar sesión", description: result.error });
      return;
    }
    sileo.success({ title: "Bienvenido" });
    router.replace(callbackUrl);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-display text-2xl font-semibold">
          Iniciar sesión
        </CardTitle>
        <CardDescription>Ingresa con tu correo y contraseña.</CardDescription>
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
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <FieldError errors={[errors.password]} />
              {/* SPEC-0035 CA-0035-01: lleva el correo ya escrito. */}
              <Link
                href={forgotHref(email)}
                className="-my-1 self-end py-2 text-sm font-semibold text-brand-strong underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </Field>
            <FieldError errors={[errors.root]} />
            <Button type="submit" variant="brand" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando…" : "Ingresar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="font-semibold text-brand-strong underline">
                Crear cuenta
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

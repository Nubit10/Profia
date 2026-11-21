"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/forms/password-input";
import { AuthHeading } from "../auth-heading";
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
    <>
      <AuthHeading title="Entra a ProfIA">Con tu correo y tu contraseña.</AuthHeading>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Correo</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
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
              className="-my-1 self-start py-2 text-sm text-brand-strong hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </Field>
          <FieldError errors={[errors.root]} />
          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando…" : "Ingresar"}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        ¿Primera vez?{" "}
        <Link href="/register" className="font-semibold text-brand-strong hover:underline">
          Crea tu cuenta
        </Link>
      </p>
    </>
  );
}

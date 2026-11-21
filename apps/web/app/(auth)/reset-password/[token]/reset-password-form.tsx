"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { sileo } from "sileo";
import { PasswordInput } from "@/components/forms/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AuthHeading } from "../../auth-heading";
import {
  DEFAULT_AFTER_LOGIN,
  PASSWORD_MIN,
  resetPasswordSchema,
  type ActionResult,
  type ResetPasswordInput,
} from "@/modules/auth/client";

type Props = {
  action: (
    input: ResetPasswordInput,
  ) => Promise<ActionResult<{ signedIn: boolean; email: string }>>;
  token: string;
};

export function ResetPasswordForm({ action, token }: Props) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const name of ["password", "confirmPassword"] as const) {
          const message = result.fieldErrors[name]?.[0];
          if (message) form.setError(name, { message });
        }
        return;
      }
      setExpired(true);
      return;
    }
    sileo.success({ title: "Contraseña cambiada", description: "Ya puedes usar la nueva." });
    if (result.data?.signedIn) {
      router.replace(DEFAULT_AFTER_LOGIN);
      router.refresh();
      return;
    }
    router.push(`/login?${new URLSearchParams({ email: result.data?.email ?? "" })}`);
  });

  if (expired) return <InvalidResetLink />;

  return (
    <>
      <AuthHeading title="Crea tu contraseña nueva">
        Al guardarla entras a Profe y se cierra la sesión en los demás dispositivos.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            {!errors.password && (
              <FieldDescription>Mínimo {PASSWORD_MIN} caracteres.</FieldDescription>
            )}
            <FieldError errors={[errors.password]} />
          </Field>
          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirmar contraseña</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : "Guardar y entrar"}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}

/** CA-0035-05: vencido, usado o inventado se ven igual, con la salida a pedir otro. */
export function InvalidResetLink() {
  return (
    <>
      <AuthHeading title="Este enlace ya no sirve">
        Los enlaces vencen en 1 hora y sirven una sola vez. Si pediste varios, solo sirve el último.
      </AuthHeading>
      <Link href="/forgot-password" className={buttonVariants({ size: "xl", className: "w-full" })}>
        Pedir un enlace nuevo
      </Link>
      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-brand-strong hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}

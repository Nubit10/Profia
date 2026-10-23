"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldPath } from "react-hook-form";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_AFTER_LOGIN,
  PASSWORD_MIN,
  registerSchema,
  type ActionResult,
  type RegisterInput,
} from "@/modules/auth/client";

type Props = {
  action: (input: RegisterInput) => Promise<ActionResult>;
  /** Ruta a la que volver tras iniciar sesión (p. ej. un enlace de invitación). */
  callbackUrl: string;
  defaultEmail?: string;
};

const FIELDS: { name: FieldPath<RegisterInput>; label: string; type: string; auto: string }[] = [
  { name: "name", label: "Nombre", type: "text", auto: "name" },
  { name: "email", label: "Correo", type: "email", auto: "email" },
  { name: "password", label: "Contraseña", type: "password", auto: "new-password" },
  {
    name: "confirmPassword",
    label: "Confirmar contraseña",
    type: "password",
    auto: "new-password",
  },
];

export function RegisterForm({ action, callbackUrl, defaultEmail = "" }: Props) {
  const router = useRouter();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: defaultEmail, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0])
          form.setError(name as FieldPath<RegisterInput>, { message: messages[0] });
      }
      sileo.error({ title: "No pudimos crear la cuenta", description: result.error });
      return;
    }
    sileo.success({ title: "Cuenta creada", description: "Ya puedes iniciar sesión." });
    router.push(
      callbackUrl === DEFAULT_AFTER_LOGIN
        ? "/login"
        : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crear cuenta</CardTitle>
        <CardDescription>Regístrate como docente para empezar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {FIELDS.map((field) => (
              <Field key={field.name} data-invalid={!!errors[field.name]}>
                <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                <Input
                  id={field.name}
                  type={field.type}
                  autoComplete={field.auto}
                  aria-invalid={!!errors[field.name]}
                  {...form.register(field.name)}
                />
                {field.name === "password" && !errors.password && (
                  <FieldDescription>Mínimo {PASSWORD_MIN} caracteres.</FieldDescription>
                )}
                <FieldError errors={[errors[field.name]]} />
              </Field>
            ))}
            <Button type="submit" variant="brand" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
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

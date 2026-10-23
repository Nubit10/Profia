"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  HiOutlineClipboardDocument,
  HiOutlinePaperAirplane,
  HiOutlineXMark,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import { invitationSchema, type InvitationInput } from "@/modules/institutions/client";

type PendingInvitation = { id: string; email: string; roles: Role[]; expiresAt: string };

type Props = {
  ttlDays: number;
  invitations: PendingInvitation[];
  createInvitation: (
    input: InvitationInput,
  ) => Promise<ActionResult<{ token: string; expiresAt: string }>>;
  revokeInvitation: (input: { invitationId: string }) => Promise<ActionResult>;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });

export function InvitationsSection({
  ttlDays,
  invitations,
  createInvitation,
  revokeInvitation,
}: Props) {
  const router = useRouter();
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<InvitationInput>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: "", roles: ["TEACHER"] },
  });
  const { errors, isSubmitting } = form.formState;

  const invite = form.handleSubmit(async (values) => {
    const result = await createInvitation(values);
    if (!result.ok || !result.data) {
      const message = !result.ok ? result.error : "No pudimos crear la invitación";
      form.setError(!result.ok && result.fieldErrors?.email ? "email" : "root", { message });
      return;
    }
    // CA-0002-04: el enlace con el token solo se muestra ahora.
    setCreated({
      email: values.email,
      url: `${window.location.origin}/invitations/${result.data.token}`,
    });
    form.reset({ email: "", roles: ["TEACHER"] });
    router.refresh();
  });

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      sileo.success({ title: "Enlace copiado" });
    } catch {
      sileo.error({ title: "No pudimos copiar", description: "Selecciona el enlace y cópialo." });
    }
  };

  const revoke = (invitation: PendingInvitation) =>
    startTransition(async () => {
      const result = await revokeInvitation({ invitationId: invitation.id });
      if (!result.ok) {
        sileo.error({ title: "No pudimos revocar la invitación", description: result.error });
        return;
      }
      sileo.info({ title: "Invitación revocada" });
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar profesor</CardTitle>
        <CardDescription>
          Genera un enlace personal y compártelo por WhatsApp o correo. Vence en {ttlDays} días y
          sirve una sola vez.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={invite} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="invite-email">Correo del profesor</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                placeholder="profe@colegio.edu.co"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Controller
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Rol</FieldLegend>
                  <div className="flex flex-wrap gap-4">
                    {ROLES.map((role) => (
                      <Field key={role} orientation="horizontal" className="w-auto">
                        <Checkbox
                          id={`invite-role-${role}`}
                          aria-labelledby={`invite-role-${role}-label`}
                          checked={field.value.includes(role)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role]
                                : field.value.filter((r) => r !== role),
                            )
                          }
                        />
                        <FieldLabel
                          id={`invite-role-${role}-label`}
                          htmlFor={`invite-role-${role}`}
                          className="font-normal"
                        >
                          {ROLE_LABELS[role]}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                  <FieldError errors={[errors.roles as { message?: string } | undefined]} />
                </FieldSet>
              )}
            />
            <FieldError errors={[errors.root]} />
            <Button type="submit" className="w-fit" disabled={isSubmitting}>
              <HiOutlinePaperAirplane aria-hidden />
              {isSubmitting ? "Generando…" : "Generar enlace"}
            </Button>
          </FieldGroup>
        </form>

        {created && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-4" role="status">
            <p className="text-sm font-medium">Enlace para {created.email}</p>
            <p className="text-sm text-muted-foreground">
              Cópialo ahora: por seguridad no lo volveremos a mostrar.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={created.url}
                aria-label="Enlace de invitación"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copy}>
                <HiOutlineClipboardDocument aria-hidden />
                Copiar
              </Button>
            </div>
          </div>
        )}

        {invitations.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Invitaciones pendientes</h3>
            <ul className="divide-y rounded-lg border" aria-label="Invitaciones pendientes">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{invitation.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {invitation.roles.map((r) => ROLE_LABELS[r]).join(" · ")} · vence el{" "}
                      {formatDate(invitation.expiresAt)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => revoke(invitation)}
                    aria-label={`Revocar invitación de ${invitation.email}`}
                  >
                    <HiOutlineXMark aria-hidden />
                    Revocar
                  </Button>
                </li>
              ))}
            </ul>
            <Badge variant="outline" className="w-fit">
              {invitations.length} pendiente{invitations.length === 1 ? "" : "s"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HiEllipsisVertical, HiOutlineUserGroup } from "react-icons/hi2";
import { sileo } from "sileo";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

type Member = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  active: boolean;
  isSelf: boolean;
};

type Props = {
  members: Member[];
  updateRoles: (input: { membershipId: string; roles: Role[] }) => Promise<ActionResult>;
  setActive: (input: { membershipId: string; active: boolean }) => Promise<ActionResult>;
};

export function MembersSection({ members, updateRoles, setActive }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        sileo.error({ title: "No pudimos aplicar el cambio", description: result.error });
        return;
      }
      sileo.success({ title: success });
      router.refresh();
    });

  const toggleRole = (member: Member, role: Role) => {
    const roles = member.roles.includes(role)
      ? member.roles.filter((r) => r !== role)
      : [...member.roles, role];
    if (roles.length === 0) {
      sileo.error({ title: "Cada miembro necesita al menos un rol" });
      return;
    }
    run(() => updateRoles({ membershipId: member.id, roles }), "Roles actualizados");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros</CardTitle>
        <CardDescription>
          Un miembro desactivado pierde el acceso de inmediato; sus cursos y materiales se
          conservan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y" aria-label="Miembros">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium">
                  {member.name}
                  {member.isSelf && (
                    <span className="font-normal text-muted-foreground"> (tú)</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                <span className="flex flex-wrap gap-1">
                  {member.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                  {!member.active && <Badge variant="outline">Desactivado</Badge>}
                </span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={isPending}
                  aria-label={`Opciones de ${member.name}`}
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <HiEllipsisVertical className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    {member.active && (
                      <>
                        <DropdownMenuItem onClick={() => toggleRole(member, "TEACHER")}>
                          {member.roles.includes("TEACHER")
                            ? "Quitar rol de docente"
                            : "Dar rol de docente"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleRole(member, "ADMIN")}>
                          {member.roles.includes("ADMIN")
                            ? "Quitar rol de administrador"
                            : "Hacer administrador"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      variant={member.active ? "destructive" : "default"}
                      onClick={() =>
                        run(
                          () => setActive({ membershipId: member.id, active: !member.active }),
                          member.active ? "Miembro desactivado" : "Miembro reactivado",
                        )
                      }
                    >
                      {member.active ? "Desactivar" : "Reactivar"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
        {/* CA-0012-12: con solo el administrador, la acción es invitar al primer profesor. */}
        {members.every((m) => m.isSelf) && (
          <EmptyState
            className="mt-4"
            icon={HiOutlineUserGroup}
            title="Aún no hay otros profesores"
            description="Invita a los profesores del colegio para que creen sus cursos y su material."
            action={
              <Button
                variant="outline"
                onClick={() => document.getElementById("invite-email")?.focus()}
              >
                Invitar al primer profesor
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

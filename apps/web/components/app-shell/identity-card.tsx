"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  HiCheck,
  HiChevronUpDown,
  HiOutlineBuildingLibrary,
  HiOutlineSparkles,
  HiOutlineUser,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { ProfeMark } from "@/components/brand/profe-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { quotaLine, type QuotaView } from "./quota-line";

export { quotaLine, type QuotaView } from "./quota-line";

export type SpaceOption = { institutionId: string; name: string; type: "INDEPENDENT" | "SCHOOL" };

export type Identity = {
  spaceName: string;
  logoUrl: string | null;
  userName: string;
  roleLabel: string;
};

export function SpaceLogo({ identity, size = 40 }: { identity: Identity; size?: number }) {
  if (!identity.logoUrl) return <ProfeMark size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- el logo lo sirve una ruta propia, con caché por versión
    <img
      src={identity.logoUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-xl bg-white object-contain ring-1 ring-border"
      style={{ width: size, height: size }}
    />
  );
}

type Props = {
  identity: Identity;
  quota: QuotaView | null;
  spaces: SpaceOption[];
  activeSpaceId: string;
  switchSpaceAction: (input: { institutionId: string }) => Promise<ActionResult>;
};

/** Tarjeta de identidad del menú: dónde estoy y quién soy, sin abrir nada (SPEC-0012 §2.1). */
export function IdentityCard({ identity, quota, spaces, activeSpaceId, switchSpaceAction }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const line = quota ? quotaLine(quota) : null;

  const select = (institutionId: string) => {
    if (institutionId === activeSpaceId) return;
    startTransition(async () => {
      const result = await switchSpaceAction({ institutionId });
      if (!result.ok) {
        sileo.error({ title: "No pudimos cambiar de espacio", description: result.error });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  const brand = (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <SpaceLogo identity={identity} />
      <span
        className="line-clamp-2 min-w-0 flex-1 text-left text-sm leading-snug font-extrabold break-words"
        title={identity.spaceName}
      >
        {identity.spaceName}
      </span>
    </span>
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      {spaces.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Cambiar de espacio"
            disabled={isPending}
            className="flex w-full items-center gap-2 rounded-t-2xl p-3 text-left transition hover:bg-muted"
          >
            {brand}
            <HiChevronUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tus espacios</DropdownMenuLabel>
              {spaces.map((space) => (
                <DropdownMenuItem
                  key={space.institutionId}
                  onClick={() => select(space.institutionId)}
                >
                  {space.type === "SCHOOL" ? (
                    <HiOutlineBuildingLibrary className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <HiOutlineUser className="size-4 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{space.name}</span>
                  {space.institutionId === activeSpaceId && (
                    <HiCheck className="ml-auto size-4" aria-hidden />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2 p-3">{brand}</div>
      )}
      <div className="border-t border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={identity.userName}>
            {identity.userName}
          </span>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
            {identity.roleLabel}
          </span>
        </div>
        {line && (
          <p
            className={cn("mt-1 flex items-center gap-1.5 text-xs font-semibold", line.tone)}
            data-testid="quota-line"
          >
            <HiOutlineSparkles className="size-3.5 shrink-0" aria-hidden />
            <span>{line.text}</span>
          </p>
        )}
      </div>
    </div>
  );
}

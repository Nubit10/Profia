"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineQuestionMarkCircle,
  HiXMark,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action-result";
import { useBodyScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
import { CreateMenu } from "./create-menu";
import {
  IdentityCard,
  SpaceLogo,
  quotaLine,
  type Identity,
  type QuotaView,
  type SpaceOption,
} from "./identity-card";
import { getNavSections, isActive, type NavAccess } from "./nav-items";
import { TutorialDialog } from "./tutorial";
import { useShellStore } from "./use-shell-store";

export { type SpaceOption } from "./identity-card";

/** Borradores del asistente de creación: se borran al cerrar sesión (SPEC-0012 §9). */
export const DRAFT_STORAGE_PREFIX = "profe:create:";

type Props = {
  identity: Identity;
  access: NavAccess;
  quota: QuotaView | null;
  spaces: SpaceOption[];
  activeSpaceId: string;
  logoutAction: () => Promise<ActionResult>;
  switchSpaceAction: (input: { institutionId: string }) => Promise<ActionResult>;
  children: ReactNode;
};

/** Shell del área de trabajo con el patrón de menú lateral de CliqCut/Duali (SPEC-0012 §2.1). */
export function AppShell(props: Props) {
  const { identity, access, quota } = props;
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, closeSidebar, tutorialOpen, setTutorialOpen } =
    useShellStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const sections = getNavSections(access);
  const line = quota ? quotaLine(quota) : null;

  useBodyScrollLock(sidebarOpen);

  // El cajón se cierra al navegar.
  useEffect(() => closeSidebar(), [pathname, closeSidebar]);

  // CA-0012-24: Escape cierra el cajón; el foco entra al abrir y vuelve al botón de menú al cerrar.
  useEffect(() => {
    if (!sidebarOpen) return;
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmLogout) closeSidebar();
    };
    document.addEventListener("keydown", onKey);
    const button = menuButton.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [sidebarOpen, closeSidebar, confirmLogout]);

  const logout = () =>
    startLogout(async () => {
      await props.logoutAction();
      try {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith(DRAFT_STORAGE_PREFIX)) sessionStorage.removeItem(key);
        }
      } catch {
        // Sin acceso al almacenamiento no hay borradores que limpiar.
      }
      // CA-0012-25: `replace` sale sin volver a pintar el área de trabajo (sin parpadeo) y no la
      // deja en el historial: el botón Atrás no regresa a una pantalla sin sesión.
      window.location.replace("/login");
    });

  const nav = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-2">
        <IdentityCard
          identity={identity}
          quota={quota}
          spaces={props.spaces}
          activeSpaceId={props.activeSpaceId}
          switchSpaceAction={props.switchSpaceAction}
        />
        {access.isTeacher && <CreateMenu onNavigate={closeSidebar} />}
      </div>

      <nav aria-label="Menú principal" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((section, index) => (
          <div
            key={section.title}
            className={cn(index === 0 ? "mt-2" : "mt-4 border-t border-sidebar-border pt-4")}
          >
            <p className="mb-2 px-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeSidebar}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                        active
                          ? "bg-brand text-white shadow-soft"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand"
                        />
                      )}
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-white" : "text-muted-foreground group-hover:text-brand",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              setTutorialOpen(true);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-sidebar-foreground transition hover:bg-brand-softer hover:text-brand-strong"
          >
            <HiOutlineQuestionMarkCircle className="size-[18px] text-brand" aria-hidden />
            Ver tutorial
          </button>
          <div className="mx-4 h-px bg-border" />
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-sidebar-foreground transition hover:bg-danger-soft hover:text-danger"
          >
            <HiOutlineArrowRightOnRectangle className="size-[18px] text-brand" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-card px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      {/* Escritorio: menú lateral fijo. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        {nav}
      </aside>

      {/* Celular y tableta: barra superior con el espacio y el cupo. */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 shadow-soft lg:hidden">
        <SpaceLogo identity={identity} size={34} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold" title={identity.spaceName}>
          {identity.spaceName}
        </span>
        {line && quota && (
          <span
            className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", line.pill)}
            title={line.text}
          >
            {line.short}
          </span>
        )}
        <button
          ref={menuButton}
          type="button"
          onClick={toggleSidebar}
          aria-label="Abrir menú"
          aria-expanded={sidebarOpen}
          className="shrink-0 rounded-xl p-2 text-foreground hover:bg-muted"
        >
          <HiOutlineBars3 className="size-6" aria-hidden />
        </button>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            tabIndex={-1}
            className="absolute inset-0 bg-foreground/45"
            onClick={closeSidebar}
          />
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute inset-y-0 left-0 w-[82vw] max-w-64 shadow-lift"
          >
            <button
              type="button"
              onClick={closeSidebar}
              aria-label="Cerrar el menú"
              className="absolute top-3 -right-12 rounded-xl bg-card p-2 text-foreground shadow-soft"
            >
              <HiXMark className="size-5" aria-hidden />
            </button>
            {nav}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <main
          id="contenido"
          className={cn(
            "mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
            access.isTeacher && "pb-28 lg:pb-10",
          )}
        >
          {props.children}
        </main>
      </div>

      {/* Celular: "Crear" siempre a mano, flotando abajo a la derecha. */}
      {access.isTeacher && !sidebarOpen && (
        <div className="fixed right-4 bottom-4 z-30 lg:hidden">
          <CreateMenu floating />
        </div>
      )}

      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>Tus cursos y recursos quedan guardados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)}>
              Cancelar
            </Button>
            <Button onClick={logout} disabled={isLoggingOut}>
              {isLoggingOut ? "Saliendo…" : "Salir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
}

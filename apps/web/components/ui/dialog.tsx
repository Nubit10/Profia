"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { useBackToClose } from "@/lib/use-back-to-close";
import { HiXMark as XIcon } from "react-icons/hi2";

// SPEC-0013 RN-11: el botón Atrás del teléfono cierra el diálogo (diálogos controlados).
function Dialog({ open, onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  useBackToClose(!!open && !!onOpenChange, () =>
    onOpenChange?.(false, undefined as unknown as DialogPrimitive.Root.ChangeEventDetails),
  );
  return (
    <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={onOpenChange} {...props} />
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // El marco no se desplaza: solo el cuerpo. Así el encabezado (sticky) y la X quedan
          // siempre a la vista, también en la hoja inferior del celular.
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-sm text-popover-foreground shadow-lift ring-1 ring-foreground/10 duration-100 outline-none max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        <div
          data-slot="dialog-body"
          // Sin relleno arriba ni abajo: así el encabezado y las barras inferiores (sticky) quedan
          // pegados al borde y el contenido no se asoma por encima ni por debajo.
          className="thin-scrollbar grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-4 sm:px-5"
        >
          {children}
          {/* Espacio final; sobra si el contenido termina en una barra fija (data-sticky-footer). */}
          <div
            aria-hidden
            className="h-[env(safe-area-inset-bottom)] min-h-1 [[data-sticky-footer]+&]:hidden [*:has(>[data-sticky-footer]:last-child)+&]:hidden"
          />
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2.5 right-2.5 z-20 rounded-full bg-popover/80 sm:top-3 sm:right-3"
                size="icon"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/** Encabezado fijo arriba del cuerpo que se desplaza (título y descripción siempre visibles). */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky top-0 z-10 -mx-4 flex flex-col gap-1.5 border-b border-border/70 bg-popover/95 px-4 pt-4 pr-14 pb-3 backdrop-blur sm:-mx-5 sm:px-5 sm:pt-5",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      data-sticky-footer=""
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-popover/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-5 sm:flex-row sm:justify-end sm:px-5 sm:pb-4",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-lg leading-tight font-bold", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

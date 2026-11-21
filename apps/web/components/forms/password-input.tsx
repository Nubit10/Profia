"use client";

import * as React from "react";
import { HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type">;

/**
 * Campo de contraseña con botón para ver lo escrito (SPEC-0035 RN-07). Arranca oculta; el botón tiene
 * 44 px de ancho, nombre accesible "Mostrar/Ocultar contraseña" y `aria-pressed`.
 */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? (
          <HiOutlineEyeSlash aria-hidden className="size-5" />
        ) : (
          <HiOutlineEye aria-hidden className="size-5" />
        )}
      </button>
    </div>
  );
}

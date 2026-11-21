"use client";

import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { HiOutlinePrinter, HiOutlineShare } from "react-icons/hi2";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";

/**
 * Bloque 5 de usabilidad: compartir por WhatsApp (u otra app) e imprimir directo.
 * - Compartir: la hoja del estudiante en PDF con la Web Share API. El archivo se prepara al abrir la
 *   página porque Safari solo deja compartir justo después del toque (sin esperar la red). Si el
 *   navegador no comparte archivos, se descarga como siempre.
 * - Imprimir: abre el PDF en el navegador, listo para imprimir.
 * - WhatsApp (computador): WhatsApp Web no recibe archivos desde otra página, así que se descarga
 *   la hoja en PDF y se abre WhatsApp Web para adjuntarla en el chat del grupo.
 */
export function SharePrint({
  courseId,
  resourceId,
  version,
  title,
  variant,
}: {
  courseId: string;
  resourceId: string;
  version: number;
  title: string;
  /**
   * "share": botón de ícono para la barra del celular; "print" y "whatsapp": botones de texto en
   * escritorio.
   */
  variant: "share" | "print" | "whatsapp";
}) {
  const url = `/courses/${courseId}/resources/${resourceId}/export?doc=student&format=pdf&version=${version}`;
  const file = useRef<File | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (variant !== "share") return;
    const probe = new File([""], "x.pdf", { type: "application/pdf" });
    if (!navigator.canShare?.({ files: [probe] })) return;
    let alive = true;
    void fetch(`${url}&purpose=share`)
      .then(async (response) => {
        if (!response.ok || !alive) return;
        const name =
          /filename\*=UTF-8''([^;]+)/.exec(
            response.headers.get("content-disposition") ?? "",
          )?.[1] ?? "recurso.pdf";
        file.current = new File([await response.blob()], decodeURIComponent(name), {
          type: "application/pdf",
        });
        // El botón aparece cuando el PDF está listo para compartir.
        setCanShare(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url, variant]);

  if (variant === "print") {
    return (
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="max-md:hidden"
        onClick={() => window.open(`${url}&inline=1`, "_blank", "noopener")}
      >
        <HiOutlinePrinter aria-hidden />
        Imprimir
      </Button>
    );
  }

  if (variant === "whatsapp") {
    return (
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="max-md:hidden"
        onClick={() => {
          const link = document.createElement("a");
          link.href = url;
          link.download = "";
          link.click();
          window.open("https://web.whatsapp.com/", "_blank", "noopener");
          sileo.success({
            title: "Se descargó la hoja en PDF",
            description: "En WhatsApp, abre el chat del grupo y adjunta el archivo descargado.",
          });
        }}
      >
        <FaWhatsapp aria-hidden />
        Enviar por WhatsApp
      </Button>
    );
  }

  if (!canShare) return null;
  return (
    <span className="md:hidden">
      <Button
        type="button"
        size="icon-lg"
        variant="ghost"
        aria-label="Compartir (WhatsApp u otra app)"
        onClick={async () => {
          if (!file.current) return;
          try {
            await navigator.share({ files: [file.current], title });
          } catch (error) {
            // Si no se pudo compartir, se descarga como siempre (enlace temporal, sin navegar).
            if ((error as Error).name !== "AbortError") {
              const link = document.createElement("a");
              link.href = url;
              link.download = "";
              link.click();
            }
          }
        }}
      >
        <HiOutlineShare className="size-5" aria-hidden />
      </Button>
    </span>
  );
}

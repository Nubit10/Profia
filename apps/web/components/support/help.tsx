import { FaWhatsapp } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { supportWhatsAppUrl } from "@/lib/support";

/**
 * Burbuja de ayuda por WhatsApp, abajo a la derecha (como la de CliqCut): en la página pública y en
 * las pantallas de ingreso. En el área de trabajo la ayuda vive en el menú (allí abajo va la barra
 * de navegación del celular).
 */
export function HelpBubble({ where, className }: { where?: string; className?: string }) {
  return (
    <a
      href={supportWhatsAppUrl(where)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="¿Necesitas ayuda? Escríbenos por WhatsApp"
      data-floating="help-bubble"
      className={cn(
        "group fixed right-4 bottom-4 z-40 inline-flex items-center sm:right-6 sm:bottom-6",
        className,
      )}
    >
      <span className="pointer-events-none absolute right-[calc(100%+0.75rem)] hidden translate-x-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold whitespace-nowrap text-background opacity-0 shadow-lift transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:flex">
        ¿Necesitas ayuda?
      </span>
      <span className="flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lift transition-transform duration-200 group-hover:scale-105">
        <FaWhatsapp aria-hidden className="size-7" />
      </span>
    </a>
  );
}

/** Enlace de ayuda en línea (menú, errores, formularios). */
export function HelpLink({
  where,
  className,
  children = "¿Necesitas ayuda? Escríbenos por WhatsApp",
}: {
  where?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={supportWhatsAppUrl(where)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 font-semibold text-brand-strong hover:underline",
        className,
      )}
    >
      <FaWhatsapp aria-hidden className="size-4 shrink-0 text-whatsapp" />
      {children}
    </a>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/**
 * Fila que se desliza y avisa cuando hay más fuera de la vista (patrón de CliqCut,
 * `ScrollableTabs`): un degradado con una flecha en el borde, solo mientras quede algo por ver
 * hacia ese lado. El aviso es visual (`aria-hidden`); el desplazamiento real lo hace el contenedor,
 * accesible con teclado. Al montar se desliza hasta el elemento con `data-active`.
 */
export function ScrollableRow({
  children,
  label,
  className,
  rowClassName,
  /** Color del fondo detrás de la fila, para el degradado (clase `from-*`). */
  fade = "from-background",
  as: Tag = "div",
}: {
  children: ReactNode;
  label: string;
  className?: string;
  rowClassName?: string;
  fade?: string;
  as?: "div" | "nav";
}) {
  const row = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  useEffect(() => {
    const node = row.current;
    if (!node) return;
    const active = node.querySelector<HTMLElement>("[data-active]");
    if (active && active.offsetLeft + active.offsetWidth > node.clientWidth) {
      node.scrollLeft = active.offsetLeft - 16;
    }
    const update = () => {
      // 2 px de margen absorben el redondeo a subpíxel (sin él la flecha parpadea al final).
      setLeft(node.scrollLeft > 2);
      setRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [children]);

  const scrollBy = (direction: 1 | -1) =>
    row.current?.scrollBy({ left: direction * 160, behavior: "smooth" });

  return (
    <Tag aria-label={label} className={cn("relative", className)}>
      <div
        ref={row}
        className={cn(
          "flex [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden",
          rowClassName,
        )}
      >
        {children}
      </div>
      {left && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => scrollBy(-1)}
          className={cn(
            "absolute inset-y-0 left-0 flex w-10 items-center justify-start bg-gradient-to-r to-transparent",
            fade,
          )}
        >
          <HiChevronRight className="size-4 rotate-180 text-brand" />
        </button>
      )}
      {right && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => scrollBy(1)}
          className={cn(
            "absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l to-transparent",
            fade,
          )}
        >
          <HiChevronRight className="size-4 text-brand motion-safe:animate-pulse" />
        </button>
      )}
    </Tag>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineXMark,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeName } from "@/lib/text";
import type { ActionResult } from "@/lib/action-result";
import type { CurriculumReference, CurriculumSearchResult } from "@/modules/curriculum/client";

type SearchAction = (input: {
  courseId: string;
  query: string;
}) => Promise<ActionResult<CurriculumSearchResult>>;

type Props = {
  courseId: string;
  references: CurriculumReference[];
  emptyForGrade: boolean;
  searchAction: SearchAction;
};

/** RN-04: cita completa de la fuente, con enlace a la página del documento oficial. */
function Citation({ citation }: { citation: CurriculumReference["citation"] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        {citation.issuer} · {citation.title}, {citation.version} ({citation.year}) · pág.{" "}
        {citation.page}
      </span>
      <a
        href={`${citation.url}#page=${citation.page}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
      >
        Ver documento oficial
        <HiOutlineArrowTopRightOnSquare className="size-3" aria-hidden />
      </a>
    </p>
  );
}

export function ReferencesView({ courseId, references, emptyForGrade, searchAction }: Props) {
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  // Resultado de la búsqueda inteligente (SPEC-0005); null = se muestran todos los referentes.
  const [found, setFound] = useState<{ question: string; items: CurriculumReference[] } | null>(
    null,
  );
  const [unavailable, setUnavailable] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const pendingReview = references.some((r) => !r.citation.reviewed);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3) return;
    startSearch(async () => {
      const result = await searchAction({ courseId, query: text });
      if (!result.ok) {
        sileo.error({ title: "No pudimos buscar", description: result.error });
        return;
      }
      if (result.data?.status === "unavailable") {
        // RN-05: sin AI Engine, la página sigue funcionando con el filtro por palabra.
        setUnavailable(true);
        setFound(null);
        return;
      }
      setUnavailable(false);
      setFound({ question: text, items: result.data?.references ?? [] });
    });
  };

  // Filtro literal (sin acentos ni mayúsculas) sobre enunciado y evidencias (SPEC-0004 §2).
  const visible = useMemo(() => {
    const base = found ? found.items : references;
    const q = normalizeName(query);
    if (!q) return base;
    return base.filter((r) =>
      [r.statement, ...r.evidences].some((t) => normalizeName(t).includes(q)),
    );
  }, [query, references, found]);

  if (emptyForGrade) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin DBA ni Estándares para este grado</CardTitle>
          <CardDescription>
            El MEN no publica DBA de esta área para este grado, o aún no están en Profe. Por ahora
            el catálogo incluye Matemáticas, Lenguaje y Transición.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="refs-title">
      <div className="flex flex-col gap-1">
        <h2 id="refs-title" className="text-lg font-semibold">
          DBA y Estándares del MEN
        </h2>
        <p className="text-sm text-muted-foreground">
          Derechos Básicos de Aprendizaje con sus evidencias, tal como aparecen en el documento
          oficial. Los ejemplos y figuras están en el documento original.
        </p>
        {pendingReview && (
          <p className="text-xs text-muted-foreground">
            La transcripción de estos documentos está pendiente de revisión docente.
          </p>
        )}
      </div>

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <HiOutlineSparkles
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Describe lo que quieres enseñar: fracciones con material concreto…"
            aria-label="Buscar en el currículo"
            maxLength={300}
            className="pl-8"
          />
        </div>
        <Button type="submit" disabled={isSearching || question.trim().length < 3}>
          {isSearching ? "Buscando…" : "Buscar en el currículo"}
        </Button>
      </form>

      {unavailable && (
        <p className="text-sm text-muted-foreground" role="status">
          La búsqueda inteligente no está disponible en este momento. Puedes usar el filtro por
          palabra.
        </p>
      )}
      {found && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
          <span>
            {found.items.length === 0
              ? `Sin resultados para «${found.question}».`
              : `DBA y Estándares más relacionados con «${found.question}», en orden de relevancia.`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFound(null);
              setQuestion("");
            }}
          >
            <HiOutlineXMark aria-hidden />
            Ver todos
          </Button>
        </div>
      )}

      <div className="relative">
        <HiOutlineMagnifyingGlass
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por palabra: fracciones, argumentativo…"
          aria-label="Filtrar DBA y Estándares"
          className="pl-8"
        />
      </div>

      {visible.length === 0 ? (
        query && (
          <p className="text-sm text-muted-foreground">Ningún DBA o Estándar contiene «{query}».</p>
        )
      ) : (
        <ol className="flex min-w-0 flex-col gap-4" aria-label="DBA y Estándares">
          {visible.map((ref) => (
            <li key={ref.code}>
              <Card>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>
                      {ref.type === "DBA" ? `DBA ${ref.number}` : `Estándar ${ref.number}`}
                    </Badge>
                    {ref.component && (
                      <Badge
                        variant="secondary"
                        className="h-auto py-0.5 text-left whitespace-normal"
                      >
                        {ref.component}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="leading-snug">{ref.statement}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1 text-sm font-medium">Evidencias de aprendizaje</p>
                    <ul className="ml-5 list-disc space-y-1 text-sm">
                      {ref.evidences.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  <Citation citation={ref.citation} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import type { ReactNode } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { ResourceList } from "@/components/resource-list";
import type { PlanGroups, ResourceSummary } from "@/modules/resources/client";

type Item = ResourceSummary & { courseId: string; courseTitle?: string; version?: number };
type Level = 2 | 3;

function Heading({ level, id, children }: { level: Level; id?: string; children: ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className={level === 2 ? "text-lg font-bold" : "text-base font-bold"}>
      {children}
    </Tag>
  );
}

function Group({
  title,
  shown,
  level,
  children,
}: {
  /** Nombre completo ("Periodo 1 · Unidad · Tema"): el de la región para lectores y búsquedas. */
  title: string;
  /** Lo que se ve: sin el periodo, que ya encabeza el bloque. */
  shown?: string;
  level: Level | 4;
  children: ReactNode;
}) {
  const Tag = level === 2 ? "h2" : level === 3 ? "h3" : "h4";
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <Tag className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {shown ?? title}
      </Tag>
      {children}
    </section>
  );
}

/**
 * Recursos ubicados en la planeación (SPEC-0014 RN-09, F-04): un bloque plegable por periodo y,
 * dentro, un encabezado "Periodo · Unidad · Tema" por tema, los exámenes de cada unidad, los del
 * periodo y los de temas archivados. `emptyTopic` pinta lo que ofrece un tema sin recursos.
 */
export function PlanResources({
  groups,
  idPrefix,
  periodLevel = 2,
  emptyTopic,
  label,
}: {
  groups: PlanGroups<Item>;
  /** Para ids únicos cuando hay varios cursos en la página. */
  idPrefix: string;
  /** Nivel del encabezado del periodo; los temas van un nivel más abajo. */
  periodLevel?: Level;
  emptyTopic?: (topic: { id: string; title: string }) => ReactNode;
  label: string;
}) {
  const inner = (periodLevel + 1) as 3 | 4;
  return (
    <div className="flex flex-col gap-4">
      {groups.periods.map((period) => {
        const id = `${idPrefix}-p${period.number ?? "none"}`;
        const empty =
          period.units.length === 0 && period.exams.length === 0 && period.archived.length === 0;
        return (
          <details
            key={id}
            open
            className="group/period rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 max-sm:min-h-11 [&::-webkit-details-marker]:hidden">
              <Heading level={periodLevel} id={id}>
                {period.name}
              </Heading>
              <HiOutlineChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open/period:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-4 flex flex-col gap-5" role="group" aria-labelledby={id}>
              {empty && (
                <p className="text-sm text-muted-foreground">
                  Este periodo todavía no tiene temas en la planeación.
                </p>
              )}
              {period.units.map((unit) => (
                <div key={unit.id} className="flex flex-col gap-4">
                  {unit.topics.map((topic) => (
                    <Group
                      key={topic.id}
                      level={inner}
                      title={`${period.name} · ${unit.title} · ${topic.title}`}
                      shown={`${unit.title} · ${topic.title}`}
                    >
                      {topic.resources.length > 0 ? (
                        <ResourceList
                          plain
                          resources={topic.resources}
                          label={`Recursos de ${topic.title}`}
                          showCourse={false}
                        />
                      ) : (
                        emptyTopic?.(topic)
                      )}
                    </Group>
                  ))}
                  {unit.exams.length > 0 && (
                    <Group
                      level={inner}
                      title={`${period.name} · ${unit.title} · Exámenes`}
                      shown={`${unit.title} · Exámenes`}
                    >
                      <ResourceList
                        plain
                        resources={unit.exams}
                        label={`Exámenes de ${unit.title}`}
                      />
                    </Group>
                  )}
                </div>
              ))}
              {period.exams.length > 0 && (
                <Group
                  level={inner}
                  title={`${period.name} · Exámenes del periodo`}
                  shown={`Exámenes del periodo`}
                >
                  <ResourceList
                    plain
                    resources={period.exams}
                    label={`Exámenes de ${period.name}`}
                  />
                </Group>
              )}
              {period.archived.length > 0 && (
                <Group
                  level={inner}
                  title={`${period.name} · Temas archivados`}
                  shown={`Temas archivados`}
                >
                  {period.archived.map((a) => (
                    <div key={`${a.unitTitle}-${a.topicTitle}`} className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        {a.unitTitle} · {a.topicTitle}
                      </p>
                      <ResourceList
                        plain
                        resources={a.resources}
                        label={`Recursos de ${a.topicTitle} (archivado)`}
                      />
                    </div>
                  ))}
                </Group>
              )}
            </div>
          </details>
        );
      })}
      {groups.yearExams.length > 0 && (
        <Group level={periodLevel} title="Exámenes del año">
          <ResourceList resources={groups.yearExams} label="Exámenes del año" />
        </Group>
      )}
      {groups.unplaced.length > 0 && (
        <Group level={periodLevel} title="Otros recursos">
          <ResourceList resources={groups.unplaced} label={`Otros recursos de ${label}`} />
        </Group>
      )}
    </div>
  );
}

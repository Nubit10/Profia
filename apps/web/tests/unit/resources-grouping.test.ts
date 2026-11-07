import { describe, expect, it } from "vitest";
import type { CoursePlan } from "@/modules/planning/client";
import { groupByPlan } from "@/modules/resources/client";

// SPEC-0014 RN-09: cada recurso en un solo lugar de la planeación (Periodo → Unidad → Tema).

const plan: CoursePlan = {
  courseId: "c1",
  periods: [
    { number: 1, name: "Periodo 1" },
    { number: 2, name: "Periodo 2" },
    { number: 3, name: "Periodo 3" },
  ],
  units: [
    {
      id: "u1",
      title: "Números enteros",
      periodNumber: 1,
      archived: false,
      topics: [
        { id: "t1", title: "La recta numérica", archived: false },
        { id: "t2", title: "Opuestos", archived: false },
        { id: "t9", title: "Viejo tema", archived: true },
      ],
    },
    {
      id: "u2",
      title: "Fracciones",
      periodNumber: 1,
      archived: false,
      topics: [{ id: "t3", title: "Fracciones equivalentes", archived: false }],
    },
    {
      id: "u3",
      title: "Geometría",
      periodNumber: 2,
      archived: false,
      topics: [{ id: "t4", title: "Ángulos", archived: false }],
    },
  ],
};

const r = (id: string, type: "QUIZ" | "WORKSHOP" | "EXAM", topicIds: string[]) => ({
  id,
  type,
  topicIds,
});

const headings = (groups: ReturnType<typeof groupByPlan>) =>
  groups.periods.flatMap((p) =>
    p.units.flatMap((u) =>
      u.topics
        .filter((t) => t.resources.length > 0)
        .map((t) => `${p.name} · ${u.title} · ${t.title}: ${t.resources.map((x) => x.id)}`),
    ),
  );

describe("groupByPlan (SPEC-0014 T8)", () => {
  it("CA-0014-14: cada recurso bajo Periodo · Unidad · Tema, en el orden de la planeación", () => {
    // Llegan por fecha (el más nuevo primero); salen en el orden de la planeación.
    const groups = groupByPlan(plan, [
      r("angulos", "QUIZ", ["t4"]),
      r("fracciones", "WORKSHOP", ["t3"]),
      r("recta", "QUIZ", ["t1"]),
    ]);
    expect(headings(groups)).toEqual([
      "Periodo 1 · Números enteros · La recta numérica: recta",
      "Periodo 1 · Fracciones · Fracciones equivalentes: fracciones",
      "Periodo 2 · Geometría · Ángulos: angulos",
    ]);
    // Sin `includeEmpty` no salen temas ni periodos vacíos ("Mis recursos").
    expect(groups.periods.map((p) => p.name)).toEqual(["Periodo 1", "Periodo 2"]);
    expect(groups.count).toBe(3);
  });

  it("CA-0014-15: con includeEmpty salen también los temas sin recursos y los periodos vacíos", () => {
    const groups = groupByPlan(plan, [], { includeEmpty: true });
    expect(groups.periods.map((p) => p.name)).toEqual(["Periodo 1", "Periodo 2", "Periodo 3"]);
    expect(groups.periods[0]!.units[0]!.topics.map((t) => t.title)).toEqual([
      "La recta numérica",
      "Opuestos",
    ]);
  });

  it("CA-0014-16: el examen va en su unidad, en su periodo o en el año; lo archivado aparte", () => {
    const groups = groupByPlan(plan, [
      r("ex-unidad", "EXAM", ["t1", "t2"]),
      r("ex-periodo", "EXAM", ["t1", "t3"]),
      r("ex-anio", "EXAM", ["t1", "t4"]),
      r("archivado", "QUIZ", ["t9"]),
    ]);
    const p1 = groups.periods[0]!;
    expect(p1.units[0]!.exams.map((x) => x.id)).toEqual(["ex-unidad"]);
    expect(p1.exams.map((x) => x.id)).toEqual(["ex-periodo"]);
    expect(groups.yearExams.map((x) => x.id)).toEqual(["ex-anio"]);
    expect(p1.archived).toEqual([
      {
        unitTitle: "Números enteros",
        topicTitle: "Viejo tema",
        resources: [r("archivado", "QUIZ", ["t9"])],
      },
    ]);
    // Un recurso, un lugar: ninguno aparece dos veces.
    const all = [
      ...groups.periods.flatMap((p) => [
        ...p.units.flatMap((u) => [...u.topics.flatMap((t) => t.resources), ...u.exams]),
        ...p.exams,
        ...p.archived.flatMap((a) => a.resources),
      ]),
      ...groups.yearExams,
    ];
    expect(all).toHaveLength(4);
  });

  it("RN-09: si el tema se movió de unidad o de periodo, el recurso aparece donde está ahora", () => {
    const moved: CoursePlan = {
      ...plan,
      units: plan.units.map((u) =>
        u.id === "u3"
          ? {
              ...u,
              topics: [...u.topics, { id: "t1", title: "La recta numérica", archived: false }],
            }
          : {
              ...u,
              topics: u.topics.filter((t) => t.id !== "t1"),
            },
      ),
    };
    const groups = groupByPlan(moved, [r("recta", "QUIZ", ["t1"])]);
    expect(headings(groups)).toEqual(["Periodo 2 · Geometría · La recta numérica: recta"]);
  });

  it("unidades sin periodo van al final en 'Sin periodo'; un tema que no está queda en 'Otros'", () => {
    const groups = groupByPlan(
      {
        ...plan,
        units: [
          ...plan.units,
          {
            id: "u4",
            title: "Repaso",
            periodNumber: null,
            archived: false,
            topics: [{ id: "t5", title: "Repaso general", archived: false }],
          },
        ],
      },
      [r("repaso", "WORKSHOP", ["t5"]), r("perdido", "QUIZ", ["nope"])],
    );
    expect(groups.periods.map((p) => p.name)).toEqual(["Sin periodo"]);
    expect(groups.unplaced.map((x) => x.id)).toEqual(["perdido"]);
    expect(groups.count).toBe(1);
  });

  it("CA-0014-18: con 30 recursos en 4 periodos, el quiz de la recta numérica del periodo 1 está en el encabezado de su tema", () => {
    const year: CoursePlan = {
      courseId: "c1",
      periods: [1, 2, 3, 4].map((n) => ({ number: n, name: `Periodo ${n}` })),
      units: [1, 2, 3, 4].map((n) => ({
        id: `u${n}`,
        title: n === 1 ? "Números enteros" : `Unidad ${n}`,
        periodNumber: n,
        archived: false,
        topics: [1, 2, 3].map((t) => ({
          id: `p${n}t${t}`,
          title: n === 1 && t === 1 ? "La recta numérica" : `Tema ${n}.${t}`,
          archived: false,
        })),
      })),
    };
    const many = Array.from({ length: 30 }, (_, i) =>
      r(`r${i}`, i % 2 ? "WORKSHOP" : "QUIZ", [`p${(i % 4) + 1}t${(i % 3) + 1}`]),
    );
    const groups = groupByPlan(year, many);
    expect(groups.periods.map((p) => p.name)).toEqual([
      "Periodo 1",
      "Periodo 2",
      "Periodo 3",
      "Periodo 4",
    ]);
    expect(groups.count).toBe(30);
    // Es el primer encabezado del primer periodo: no hay que pasar por los demás.
    const p1 = groups.periods[0]!;
    const topic = p1.units[0]!.topics[0]!;
    expect(`${p1.name} · ${p1.units[0]!.title} · ${topic.title}`).toBe(
      "Periodo 1 · Números enteros · La recta numérica",
    );
    expect(topic.resources.filter((x) => x.type === "QUIZ").length).toBeGreaterThan(0);
  });
});

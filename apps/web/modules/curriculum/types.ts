// Tipos del módulo curriculum seguros para el navegador.
export type CurriculumReference = {
  code: string;
  type: "DBA" | "STANDARD";
  number: number;
  component: string | null;
  statement: string;
  evidences: string[];
  citation: {
    issuer: string;
    title: string;
    version: string;
    year: number;
    page: number;
    url: string;
    reviewed: boolean;
  };
};

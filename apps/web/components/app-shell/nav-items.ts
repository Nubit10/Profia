import type { IconType } from "react-icons";
import {
  HiOutlineBookOpen,
  HiOutlineBuildingLibrary,
  HiOutlineDocumentText,
  HiOutlineHome,
  HiOutlineRectangleStack,
  HiOutlineSquares2X2,
  HiOutlineUserGroup,
} from "react-icons/hi2";

// Menú lateral (SPEC-0012 §2.1). Una sola fuente para escritorio y celular. RN-11: esto solo decide
// qué se muestra; cada página valida el rol en el servidor.

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  /** Rutas hijas que también marcan el ítem como activo (CA-0012-22). */
  matches?: RegExp;
};

export type NavSection = { title: string; items: NavItem[] };

export type NavAccess = { isTeacher: boolean; isSchoolAdmin: boolean };

const ITEMS = {
  home: { href: "/dashboard", label: "Inicio", icon: HiOutlineHome },
  courses: {
    href: "/courses",
    label: "Mis cursos",
    icon: HiOutlineSquares2X2,
    matches: /^\/courses(\/|$)/,
  },
  resources: {
    href: "/resources",
    label: "Mis recursos",
    icon: HiOutlineRectangleStack,
    matches: /^\/resources(\/|$)/,
  },
  formats: { href: "/formats", label: "Formatos", icon: HiOutlineDocumentText },
  subjects: { href: "/subjects", label: "Asignaturas", icon: HiOutlineBookOpen },
  school: { href: "/school", label: "Datos y sedes", icon: HiOutlineBuildingLibrary },
  members: { href: "/school/members", label: "Profesores", icon: HiOutlineUserGroup },
} satisfies Record<string, NavItem>;

export function getNavSections({ isTeacher, isSchoolAdmin }: NavAccess): NavSection[] {
  const sections: NavSection[] = [
    { title: "Principal", items: isTeacher ? [ITEMS.home, ITEMS.courses] : [ITEMS.home] },
  ];
  if (isTeacher) {
    sections.push(
      { title: "Mi trabajo", items: [ITEMS.resources, ITEMS.formats] },
      { title: "Ajustes", items: [ITEMS.subjects] },
    );
  }
  if (isSchoolAdmin) {
    // Quien no da clases administra aquí el formato institucional, el logo y las asignaturas.
    const items = isTeacher
      ? [ITEMS.school, ITEMS.members]
      : [ITEMS.school, ITEMS.members, ITEMS.formats, ITEMS.subjects];
    sections.push({ title: "Colegio", items });
  }
  return sections.filter((s) => s.items.length > 0);
}

/** Ítem activo: la ruta exacta, o una subruta cuando el ítem lo declara. */
export function isActive(item: NavItem, pathname: string) {
  return pathname === item.href || (item.matches?.test(pathname) ?? false);
}

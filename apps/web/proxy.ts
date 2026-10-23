import { NextResponse, type NextRequest } from "next/server";

// Chequeo optimista (solo presencia de cookie, sin DB) para redirigir conservando la ruta de retorno.
// La verificación real de la sesión, incluida la revocación, la hace requireUser() en el servidor (RN-01).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIES.some((cookie) => name.startsWith(cookie)));
  if (hasSessionCookie) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subjects/:path*",
    "/school/:path*",
    "/courses/:path*",
    "/onboarding",
  ],
};

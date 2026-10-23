import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { logger } from "@/lib/observability/logger";
import { recordAuditSafely } from "@/modules/audit";
import { clientIp } from "./request";
import { loginSchema } from "./schemas";
import {
  SESSION_MAX_AGE_SECONDS,
  attemptLogin,
  createSession,
  isSessionActive,
  revokeSession,
} from "./service";

export class RateLimitedSignin extends CredentialsSignin {
  override code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // El proveedor de credenciales exige JWT; cada token lleva `sid` → fila en user_sessions.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  trustHost: true,
  // Logs de Auth.js por el logger estructurado (RN-05). Credenciales inválidas no son un error del sistema.
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) return;
      logger.error("authjs.error", { error });
    },
    warn(code) {
      logger.warn("authjs.warn", { code });
    },
    debug() {},
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await attemptLogin({ ...parsed.data, ip: clientIp(request.headers) });
        if (result.status === "rate_limited") {
          logger.warn("auth.login.rate_limited");
          throw new RateLimitedSignin();
        }
        if (result.status === "invalid") {
          logger.info("auth.login.failed");
          return null;
        }
        logger.info("auth.login.succeeded", { userId: result.user.id });
        await recordAuditSafely({
          action: "auth.login",
          actorUserId: result.user.id,
          entityType: "user",
          entityId: result.user.id,
        });
        return result.user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const session = await createSession(user.id);
        token.sub = user.id;
        token.sid = session.id;
        return token;
      }
      // RN-08: un token sin sesión activa en la base deja de ser válido.
      if (typeof token.sid !== "string" || !(await isSessionActive(token.sid))) return null;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (typeof token?.sid === "string") await revokeSession(token.sid);
      logger.info("auth.logout", { userId: token?.sub });
      if (token?.sub) {
        await recordAuditSafely({
          action: "auth.logout",
          actorUserId: token.sub,
          entityType: "user",
          entityId: token.sub,
        });
      }
    },
  },
});

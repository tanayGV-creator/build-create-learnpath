// Server-only glue: DB singleton, session cookie, request helpers. Never import from client components.
import type { Db } from "./db.ts";
import { ServiceError, getUser } from "./services.ts";
import { verifySession, signSession } from "./auth.ts";
import { toDateString } from "./engine/mastery.ts";

export const COOKIE = "lp_session";

let dbOverride: Db | null = null;
let dbSingleton: Db | null = null;
export function setDbForTests(db: Db | null) { dbOverride = db; }

export async function getDb(): Promise<Db> {
  if (dbOverride) return dbOverride;
  if (!dbSingleton) {
    const mod = await import("./db-node.ts");
    dbSingleton = mod.openAppDb();
  }
  return dbSingleton;
}

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new ServiceError("Server is not configured: set SESSION_SECRET (32+ characters) in .env.local", 500);
  return s;
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export function sessionCookie(userId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${signSession(userId, sessionSecret())}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`;
}
export const clearCookie = () => `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

export function currentUserId(req: Request): string | null {
  return verifySession(readCookie(req, COOKIE), sessionSecret());
}

/** The student's local date from the client, clamped to within a day of the server date. */
export function clientToday(req: Request, now = new Date()): string {
  const h = req.headers.get("x-client-date") ?? "";
  const server = toDateString(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) return server;
  const diff = Math.abs(Date.parse(h + "T00:00:00Z") - Date.parse(server + "T00:00:00Z")) / 86_400_000;
  return diff <= 1 ? h : server;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}

type Ctx = { db: Db; req: Request; userId: string | null; today: string };

/** Wraps a route: CSRF checks, auth, error mapping. */
export function route(opts: { auth: boolean }, fn: (c: Ctx & { userId: string }) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (!(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "Expected JSON" }, 415);
        const origin = req.headers.get("origin");
        const host = req.headers.get("host");
        if (origin && host && new URL(origin).host !== host) return json({ error: "Cross-site request blocked" }, 403);
      }
      const db = await getDb();
      const userId = currentUserId(req);
      if (opts.auth) {
        if (!userId || !getUser(db, userId)) return json({ error: "Please sign in." }, 401);
      }
      return await fn({ db, req, userId: userId as string, today: clientToday(req) });
    } catch (e) {
      if (e instanceof ServiceError) return json({ error: e.message }, e.status);
      console.error("route error:", e instanceof Error ? e.message : "unknown");
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function body<T = any>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new ServiceError("Invalid request body."); }
}

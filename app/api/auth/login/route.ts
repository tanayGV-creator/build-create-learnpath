import { route, body, json, sessionCookie } from "@/lib/server";
import { login } from "@/lib/services";
import { RateLimiter } from "@/lib/auth";
const limiter = new RateLimiter(8, 60_000 * 5);
export const POST = route({ auth: false }, async ({ db, req }) => {
  const b = await body(req);
  const email = String(b.email ?? "").toLowerCase();
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!limiter.allow(`login:${ip}:${email}`)) return json({ error: "Too many attempts. Please wait a few minutes." }, 429);
  const id = login(db, email, String(b.password ?? ""));
  if (!id) return json({ error: "Email or password is incorrect." }, 401);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(id) });
});

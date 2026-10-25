import { route, body, json, sessionCookie } from "@/lib/server";
import { registerStudent } from "@/lib/services";
import { RateLimiter } from "@/lib/auth";
const limiter = new RateLimiter(5, 60_000 * 10);
export const POST = route({ auth: false }, async ({ db, req }) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!limiter.allow("reg:" + ip)) return json({ error: "Too many sign-up attempts. Try again later." }, 429);
  const b = await body(req);
  const id = registerStudent(db, { email: String(b.email ?? ""), password: String(b.password ?? ""), fullName: String(b.fullName ?? ""), dateOfBirth: String(b.dateOfBirth ?? "") });
  return json({ ok: true }, 201, { "set-cookie": sessionCookie(id) });
});

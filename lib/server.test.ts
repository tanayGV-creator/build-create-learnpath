import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrate, type Db } from "./db.ts";
import { seedContent } from "./content/cbse10-maths.ts";
import { registerStudent } from "./services.ts";
import { route, setDbForTests, sessionCookie, clientToday, json, body } from "./server.ts";

process.env.SESSION_SECRET = "s".repeat(48);
const db = new DatabaseSync(":memory:") as unknown as Db;
migrate(db); seedContent(db); setDbForTests(db);
const uid = registerStudent(db, { email: "r@x.com", password: "Passw0rdX", fullName: "R", dateOfBirth: "2010-01-01" });
const whoami = route({ auth: true }, ({ userId }) => json({ userId }));
const echo = route({ auth: true }, async ({ req }) => json(await body(req)));
const cookie = () => sessionCookie(uid).split(";")[0];

test("route: unauthenticated -> 401; forged cookie -> 401; valid cookie -> 200", async () => {
  assert.equal((await whoami(new Request("http://l/x"))).status, 401);
  assert.equal((await whoami(new Request("http://l/x", { headers: { cookie: "lp_session=abc.def" } }))).status, 401);
  const r = await whoami(new Request("http://l/x", { headers: { cookie: cookie() } }));
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { userId: uid });
});

test("route: session cookie is HttpOnly + SameSite", () => {
  const c = sessionCookie(uid);
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Lax/);
});

test("route: CSRF protections on writes", async () => {
  const h = { cookie: cookie(), host: "app.test" };
  const noJson = await echo(new Request("http://app.test/x", { method: "POST", headers: { ...h, "content-type": "text/plain" }, body: "{}" }));
  assert.equal(noJson.status, 415);
  const cross = await echo(new Request("http://app.test/x", { method: "POST", headers: { ...h, "content-type": "application/json", origin: "https://evil.example" }, body: "{}" }));
  assert.equal(cross.status, 403);
  const ok = await echo(new Request("http://app.test/x", { method: "POST", headers: { ...h, "content-type": "application/json", origin: "http://app.test" }, body: '{"a":1}' }));
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { a: 1 });
  const bad = await echo(new Request("http://app.test/x", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: "{not json" }));
  assert.equal(bad.status, 400);
});

test("clientToday: accepts local date within a day, rejects wild values", () => {
  const now = new Date("2026-10-25T20:00:00Z");
  const mk = (d: string) => new Request("http://l/", { headers: { "x-client-date": d } });
  assert.equal(clientToday(mk("2026-10-26"), now), "2026-10-26");
  assert.equal(clientToday(mk("2030-01-01"), now), "2026-10-25");
  assert.equal(clientToday(mk("garbage"), now), "2026-10-25");
});

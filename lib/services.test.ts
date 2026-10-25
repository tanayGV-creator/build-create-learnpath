import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrate, type Db } from "./db.ts";
import { seedContent, QUESTIONS } from "./content/cbse10-maths.ts";
import * as svc from "./services.ts";
import { MockProvider, AnthropicProvider, getProvider } from "./ai/provider.ts";
import { retrieve, asksForDirectAnswer, mentionsSelfHarm, scrubPII, buildSystemPrompt } from "./ai/tutor.ts";
import { hashPassword, verifyPassword, signSession, verifySession, RateLimiter } from "./auth.ts";

function freshDb(): Db {
  const db = new DatabaseSync(":memory:") as unknown as Db;
  migrate(db);
  seedContent(db);
  return db;
}
const NOW = new Date("2026-10-26T10:00:00Z");
const TODAY = "2026-10-26";
function student(db: Db, dob = "2010-05-01", email = "robin@example.com") {
  const id = svc.registerStudent(db, { email, password: "Passw0rdX", fullName: "Robin", dateOfBirth: dob }, NOW);
  svc.saveOnboarding(db, id, { dailyMinutes: 90, careerGoal: "scientist", aiConsent: true, guardianConfirmed: true }, TODAY);
  return id;
}
const keyOf = (qid: string) => QUESTIONS.find((q) => q.id === qid)!;

test("auth: password hashing, session signing, tampering, expiry", () => {
  const h = hashPassword("Passw0rdX");
  assert.ok(verifyPassword("Passw0rdX", h)); assert.ok(!verifyPassword("wrong", h));
  const secret = "x".repeat(40);
  const t = signSession("u1", secret, 100, 1_000_000);
  assert.equal(verifySession(t, secret, 1_000_000 + 50_000), "u1");
  assert.equal(verifySession(t, secret, 1_000_000 + 200_000), null);
  assert.equal(verifySession(t + "x", secret, 1_000_000), null);
  assert.equal(verifySession(t, "y".repeat(40), 1_000_000), null);
  assert.throws(() => signSession("u", "short"));
  const rl = new RateLimiter(2, 1000);
  assert.ok(rl.allow("k", 0)); assert.ok(rl.allow("k", 1)); assert.ok(!rl.allow("k", 2)); assert.ok(rl.allow("k", 2000));
});

test("register/login/duplicate/validation", () => {
  const db = freshDb();
  const id = student(db);
  assert.equal(svc.login(db, "ROBIN@example.com", "Passw0rdX"), id);
  assert.equal(svc.login(db, "robin@example.com", "nope"), null);
  assert.equal(svc.login(db, "ghost@example.com", "Passw0rdX"), null);
  assert.throws(() => student(db), /already exists/);
  assert.throws(() => svc.registerStudent(db, { email: "bad", password: "Passw0rdX", fullName: "A", dateOfBirth: "2010-01-01" }, NOW), /valid email/);
  assert.throws(() => svc.registerStudent(db, { email: "a@b.co", password: "short", fullName: "A", dateOfBirth: "2010-01-01" }, NOW), /8 characters/);
});

test("minors need guardian confirmation for AI; adults do not", () => {
  const db = freshDb();
  const minor = svc.registerStudent(db, { email: "m@x.com", password: "Passw0rdX", fullName: "M", dateOfBirth: "2012-01-01" }, NOW);
  svc.saveOnboarding(db, minor, { dailyMinutes: 60, careerGoal: "", aiConsent: true, guardianConfirmed: false }, TODAY);
  assert.equal(svc.getUser(db, minor).aiConsent, 0);
  svc.saveOnboarding(db, minor, { dailyMinutes: 60, careerGoal: "", aiConsent: true, guardianConfirmed: true }, TODAY);
  assert.equal(svc.getUser(db, minor).aiConsent, 1);
  const adult = svc.registerStudent(db, { email: "a@x.com", password: "Passw0rdX", fullName: "A", dateOfBirth: "2000-01-01" }, NOW);
  svc.saveOnboarding(db, adult, { dailyMinutes: 60, careerGoal: "", aiConsent: true, guardianConfirmed: false }, TODAY);
  assert.equal(svc.getUser(db, adult).aiConsent, 1);
  assert.throws(() => svc.saveOnboarding(db, adult, { dailyMinutes: 5, careerGoal: "", aiConsent: false, guardianConfirmed: false }, TODAY), /between 15 and 240/);
});

test("diagnostic flow: hides answers, updates mastery, reviews after finishing", () => {
  const db = freshDb();
  const id = student(db);
  const a = svc.startAttempt(db, id, "diagnostic", NOW);
  assert.equal(svc.startAttempt(db, id, "diagnostic", NOW), a, "resumes the same attempt");
  let n = 0;
  for (;;) {
    const r = svc.nextQuestion(db, id, a);
    if (r.done) break;
    assert.equal((r.question as any).answer, undefined, "answer must not be sent to the client");
    assert.equal((r.question as any).explanation, undefined);
    const q = keyOf(r.question.id);
    const wrong = n % 3 === 0; // every third answer is wrong
    const ans = q.type === "mcq" ? (wrong ? String((Number(q.answer) + 1) % q.options!.length) : q.answer) : (wrong ? "9999" : q.answer);
    const fb: any = svc.submitAnswer(db, id, a, { questionId: r.question.id, answer: ans, seconds: 30 }, NOW);
    assert.deepEqual(fb, { recorded: true }, "graded attempts give no per-question feedback");
    n++;
    assert.ok(n <= svc.DIAGNOSTIC_LENGTH);
  }
  assert.equal(n, svc.DIAGNOSTIC_LENGTH);
  const res = svc.finishAttempt(db, id, a, NOW);
  assert.equal(res.answered, n);
  assert.ok(res.skills.length >= 8, "covers many skills");
  assert.ok(res.review.length > 0 && res.review[0].explanation.length > 0);
  const prog = svc.getProgress(db, id, TODAY);
  assert.equal(prog.counts.not_assessed, 0, "14 questions cover all 14 skills once");
  assert.equal(Object.values(prog.counts).reduce((a: number, b: number) => a + b, 0), 14);
  assert.equal(prog.totals.answered, n);
  assert.throws(() => svc.submitAnswer(db, id, a, { questionId: "Q01", answer: "1", seconds: 5 }, NOW), /already submitted/);
});

test("practice: immediate feedback, no duplicate answers, mastery moves", () => {
  const db = freshDb();
  const id = student(db);
  const a = svc.startAttempt(db, id, "practice", NOW);
  const r: any = svc.nextQuestion(db, id, a, { skillId: "q3", today: TODAY });
  assert.equal(r.question.skillId, "q3");
  const q = keyOf(r.question.id);
  const fb: any = svc.submitAnswer(db, id, a, { questionId: q.id, answer: q.answer, seconds: 30 }, NOW);
  assert.equal(fb.correct, true); assert.ok(fb.explanation);
  assert.ok(svc.getMastery(db, id)["q3"].score > 50);
  assert.throws(() => svc.submitAnswer(db, id, a, { questionId: q.id, answer: q.answer, seconds: 30 }, NOW), /Already answered/);
  // a wrong mcq with a tagged distractor reports the misconception
  const q7: any = keyOf("Q07");
  const a2 = svc.startAttempt(db, id, "test", NOW);
  svc.submitAnswer(db, id, a2, { questionId: "Q07", answer: "1", seconds: 20 }, NOW);
  const fin = svc.finishAttempt(db, id, a2, NOW);
  assert.equal(fin.review[0].misconception, "sign-error-roots");
  assert.equal(fin.review[0].correctAnswer, q7.options[0]);
});

test("planner service: persists tasks with reasons, respects limit, done/postpone/delete work", () => {
  const db = freshDb();
  const id = student(db);
  svc.addHomework(db, id, { title: "Exercise 4.2", minutes: 30, dueDate: "2026-10-27" });
  svc.addExam(db, id, { title: "Unit test", examDate: "2026-10-30", subjectId: "cbse-10-maths" });
  const plan = svc.getOrCreatePlan(db, id, TODAY, false);
  assert.equal(plan[0].type, "homework");
  assert.ok(plan.every((t: any) => t.reason.length > 10));
  assert.ok(plan.reduce((s: number, t: any) => s + t.minutes, 0) <= 90);
  assert.deepEqual(svc.getOrCreatePlan(db, id, TODAY, false).map((t: any) => t.id), plan.map((t: any) => t.id), "stable until regenerated");
  svc.updateTask(db, id, plan[0].id, "done", TODAY);
  assert.equal(svc.getOrCreatePlan(db, id, TODAY, false)[0].status, "done");
  assert.equal(db.prepare("SELECT status FROM homework WHERE student_id=?").get(id).status, "done");
  svc.updateTask(db, id, plan[1].id, "postpone", TODAY);
  assert.equal(db.prepare("SELECT plan_date FROM tasks WHERE id=?").get(plan[1].id).plan_date, "2026-10-27");
  svc.updateTask(db, id, plan[2].id, "delete", TODAY);
  assert.ok(!svc.getOrCreatePlan(db, id, TODAY, false).some((t: any) => t.id === plan[2].id));
  assert.throws(() => svc.updateTask(db, "someone-else", plan[0].id, "done", TODAY), /not found/i, "cannot touch another student's task");
});

test("data isolation: one student cannot read another's attempt", () => {
  const db = freshDb();
  const a = student(db), b = student(db, "2010-01-01", "b@example.com");
  const att = svc.startAttempt(db, a, "practice", NOW);
  assert.throws(() => svc.nextQuestion(db, b, att), /not found/i);
  assert.throws(() => svc.finishAttempt(db, b, att, NOW), /not found/i);
});

test("tutor retrieval and guardrail helpers", () => {
  const db = freshDb();
  const chunks = db.prepare("SELECT id, skill_id AS skillId, title, body, source FROM resources").all();
  const hit = retrieve("how do I use the quadratic formula", chunks, 3);
  assert.equal(hit[0].chunk.id, "R-q5");
  assert.equal(retrieve("who won the football match yesterday", chunks, 3).length, 0, "off-topic gets no context");
  assert.ok(asksForDirectAnswer("just give me the answer to 3x+2=0")); assert.ok(!asksForDirectAnswer("explain the discriminant"));
  assert.ok(mentionsSelfHarm("I want to die")); assert.ok(!mentionsSelfHarm("explain the discriminant"));
  // Deliberately conservative keyword filter: idioms like "this will kill me" also trigger the supportive reply.
  // A false alarm costs one caring message; a miss costs far more. It is NOT a substitute for real moderation.
  assert.ok(mentionsSelfHarm("this homework will kill me"));
  assert.equal(scrubPII("mail me at a.b@c.com or call +91 98765 43210"), "mail me at [email removed] or call [phone removed]");
  const p = buildSystemPrompt({ grade: "10", board: "CBSE", weakSkills: [], careerGoal: null }, hit, true);
  assert.match(p, /Do NOT give it/); assert.match(p, /\[S1\]/);
});

test("tutor: mock provider path is labelled, logs interaction, never sends the student's name", async () => {
  const db = freshDb();
  const id = student(db);
  let seen = "";
  const spy = { name: "spy", async complete(req: any) { seen = JSON.stringify(req); return new MockProvider().complete(req); } };
  const r: any = await svc.tutorChat(db, spy, id, { message: "How do I solve using the quadratic formula? email me at kid@x.com" }, { now: NOW });
  assert.equal(r.simulated, true); assert.match(r.reply, /MOCK TUTOR/);
  assert.ok(r.sources.length > 0);
  assert.ok(!seen.includes("Robin") && !seen.includes("kid@x.com") && !seen.includes("robin@example.com"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ai_interactions WHERE student_id=?").get(id).n, 1);
});

test("tutor: locked during a graded assessment, unlocks after finishing", async () => {
  const db = freshDb();
  const id = student(db);
  const a = svc.startAttempt(db, id, "diagnostic", NOW);
  const locked: any = await svc.tutorChat(db, new MockProvider(), id, { message: "what is the answer to question 1" }, { now: NOW });
  assert.equal(locked.blocked, "assessment");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ai_interactions").get().n, 0, "provider never called, nothing logged");
  svc.finishAttempt(db, id, a, NOW);
  const ok: any = await svc.tutorChat(db, new MockProvider(), id, { message: "explain the discriminant" }, { now: NOW });
  assert.equal(ok.blocked, null);
  // a stale (forgotten) assessment does not lock the tutor forever
  svc.startAttempt(db, id, "test", NOW);
  const later = new Date(NOW.getTime() + 4 * 3_600_000);
  assert.equal((await svc.tutorChat(db, new MockProvider(), id, { message: "explain the discriminant" }, { now: later })).blocked, null);
});

test("tutor: consent, self-harm and budget gates", async () => {
  const db = freshDb();
  const noConsent = svc.registerStudent(db, { email: "nc@x.com", password: "Passw0rdX", fullName: "N", dateOfBirth: "2011-01-01" }, NOW);
  svc.saveOnboarding(db, noConsent, { dailyMinutes: 60, careerGoal: "", aiConsent: false, guardianConfirmed: false }, TODAY);
  const p = new MockProvider();
  assert.equal(((await svc.tutorChat(db, p, noConsent, { message: "hi" }, { now: NOW })) as any).blocked, "consent");
  const id = student(db, "2010-05-01", "ok@x.com");
  let called = false;
  const spy = { name: "spy", async complete(r: any) { called = true; return p.complete(r); } };
  const sh: any = await svc.tutorChat(db, spy, id, { message: "I want to die" }, { now: NOW });
  assert.equal(sh.blocked, "safety"); assert.equal(called, false); assert.match(sh.reply, /trust/);
  await svc.tutorChat(db, spy, id, { message: "explain the discriminant" }, { now: NOW });
  db.prepare("UPDATE ai_interactions SET input_tokens = 50000 WHERE student_id=? AND provider='mock'").run(id);
  assert.equal(((await svc.tutorChat(db, spy, id, { message: "explain the discriminant" }, { now: NOW, dailyTokenBudget: 40000 })) as any).blocked, "budget");
  await assert.rejects(svc.tutorChat(db, spy, id, { message: "x".repeat(1001) }, { now: NOW }), /1000/);
});

test("AnthropicProvider: request shape and response parsing (mocked fetch, NOT a live API test)", async () => {
  let captured: any;
  const fakeFetch = (async (url: string, init: any) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Hello" }], usage: { input_tokens: 12, output_tokens: 3 } }) };
  }) as unknown as typeof fetch;
  const r = await new AnthropicProvider("sk-test", "claude-sonnet-5-5", fakeFetch).complete({ system: "S", messages: [{ role: "user", content: "hi" }], maxTokens: 50 });
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.init.headers["x-api-key"], "sk-test");
  assert.equal(captured.body.model, "claude-sonnet-5-5");
  assert.deepEqual([r.text, r.inputTokens, r.outputTokens, r.simulated], ["Hello", 12, 3, false]);
  const bad = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
  await assert.rejects(new AnthropicProvider("k", "m", bad).complete({ system: "", messages: [], maxTokens: 1 }), /HTTP 401/);
  assert.equal(getProvider({}).name, "mock");
  assert.equal(getProvider({ ANTHROPIC_API_KEY: "k" }).name, "anthropic");
});

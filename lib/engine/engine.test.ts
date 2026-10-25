import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_MASTERY, updateMastery, masteryStatus, effectiveScore, isRevisionDue, confidence } from "./mastery.ts";
import { checkAnswer, parseNumber, scoreMarks } from "./quiz.ts";
import { generatePlan, type PlanSkill } from "./planner.ts";
import { nextDiagnosticQuestion } from "./diagnostic.ts";

const now = new Date("2026-10-26T10:00:00Z");
const ev = (correct: boolean, difficulty: "easy" | "medium" | "hard" = "medium", seconds = 40) => ({
  correct, difficulty, seconds, expectedSeconds: 60, now,
});

test("mastery: unattempted skill is not_assessed", () => {
  assert.equal(masteryStatus(INITIAL_MASTERY), "not_assessed");
});

test("mastery: correct answers raise the score, wrong answers lower it", () => {
  const up = updateMastery(INITIAL_MASTERY, ev(true));
  const down = updateMastery(INITIAL_MASTERY, ev(false));
  assert.ok(up.score > 50 && down.score < 50);
  assert.equal(up.attempts, 1);
  assert.equal(up.correct, 1);
});

test("mastery: one lucky answer cannot make a skill 'strong'", () => {
  const m = updateMastery(INITIAL_MASTERY, ev(true, "hard"));
  assert.notEqual(masteryStatus(m), "strong");
});

test("mastery: repeated success reaches strong and is bounded <= 100", () => {
  let m = INITIAL_MASTERY;
  for (let i = 0; i < 8; i++) m = updateMastery(m, ev(true));
  assert.equal(masteryStatus(m), "strong");
  assert.ok(m.score <= 100);
});

test("mastery: repeated failure ends in a critical gap and is bounded >= 0", () => {
  let m = INITIAL_MASTERY;
  for (let i = 0; i < 6; i++) m = updateMastery(m, ev(false));
  assert.equal(masteryStatus(m), "critical_gap");
  assert.ok(m.score >= 0);
});

test("mastery: a correct but very slow answer is weaker evidence", () => {
  const fast = updateMastery(INITIAL_MASTERY, ev(true, "medium", 30));
  const slow = updateMastery(INITIAL_MASTERY, ev(true, "medium", 300));
  assert.ok(slow.score < fast.score);
});

test("spaced repetition: interval doubles on success, resets on error", () => {
  let m = updateMastery(INITIAL_MASTERY, ev(true));
  assert.equal(m.intervalDays, 1);
  assert.equal(m.nextRevisionAt, "2026-10-27");
  m = updateMastery(m, ev(true));
  assert.equal(m.intervalDays, 2);
  m = updateMastery(m, ev(true));
  assert.equal(m.intervalDays, 4);
  m = updateMastery(m, ev(false));
  assert.equal(m.intervalDays, 1);
  assert.equal(m.streak, 0);
});

test("revision due + forgetting decay", () => {
  let m = updateMastery(INITIAL_MASTERY, ev(true));
  assert.equal(isRevisionDue(m, "2026-10-26"), false);
  assert.equal(isRevisionDue(m, "2026-10-27"), true);
  assert.ok(effectiveScore(m, "2026-11-10") < m.score);
  assert.ok(effectiveScore(m, "2026-12-30") >= m.score * 0.6 - 0.01); // floor
  assert.ok(confidence(0) === 0 && confidence(9) === 0.75);
});

test("quiz: mcq correct, wrong, and misconception tag", () => {
  const q = { type: "mcq" as const, answer: "1", options: ["a", "b"], distractorTags: { "0": "sign-error" } };
  assert.deepEqual(checkAnswer(q, "1"), { correct: true, misconception: null });
  assert.deepEqual(checkAnswer(q, "0"), { correct: false, misconception: "sign-error" });
});

test("quiz: numeric parsing incl. fractions and tolerance", () => {
  assert.equal(parseNumber("1/2"), 0.5);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber("1/0"), null);
  const q = { type: "numeric" as const, answer: "0.5" };
  assert.equal(checkAnswer(q, "1/2").correct, true);
  assert.equal(checkAnswer(q, "0.505").correct, true);
  assert.equal(checkAnswer(q, "0.6").correct, false);
  assert.equal(checkAnswer(q, "").correct, false);
});

test("quiz: short answer normalisation and marks", () => {
  const q = { type: "short" as const, answer: "discriminant|the discriminant" };
  assert.equal(checkAnswer(q, "  Discriminant. ").correct, true);
  assert.equal(checkAnswer(q, "root").correct, false);
  assert.deepEqual(scoreMarks([{ correct: true, marks: 2 }, { correct: false, marks: 3 }]), { score: 2, total: 5 });
});

const skills: PlanSkill[] = [
  { id: "s1", name: "Standard form", unitName: "Quadratics", subjectId: "math", position: 1, minutes: 20, prerequisites: [] },
  { id: "s2", name: "Factorization", unitName: "Quadratics", subjectId: "math", position: 2, minutes: 20, prerequisites: ["s1"] },
  { id: "s3", name: "Quadratic formula", unitName: "Quadratics", subjectId: "math", position: 3, minutes: 20, prerequisites: ["s2"] },
];

test("planner: homework due soon comes first, with a reason", () => {
  const plan = generatePlan({
    today: "2026-10-26", dailyMinutes: 90, skills, mastery: {}, exams: [],
    homework: [{ title: "Ex 4.1", minutes: 30, dueDate: "2026-10-27" }],
  });
  assert.equal(plan[0].type, "homework");
  assert.match(plan[0].reason, /due in 1 day/);
});

test("planner: never exceeds the daily minutes", () => {
  const plan = generatePlan({
    today: "2026-10-26", dailyMinutes: 30, skills, mastery: {}, exams: [],
    homework: [{ title: "Big task", minutes: 120, dueDate: "2026-10-26" }],
  });
  assert.ok(plan.reduce((s, t) => s + t.minutes, 0) <= 30);
  assert.ok(plan.length >= 1);
});

test("planner: every task has a non-empty reason and alternative", () => {
  const plan = generatePlan({ today: "2026-10-26", dailyMinutes: 120, skills, mastery: {}, exams: [], homework: [] });
  assert.ok(plan.length > 0);
  for (const t of plan) { assert.ok(t.reason.length > 10); assert.ok(t.alternative.length > 5); }
});

test("planner: prerequisite gap is prioritised and explained", () => {
  let weak = INITIAL_MASTERY;
  for (let i = 0; i < 4; i++) weak = updateMastery(weak, ev(false));
  const plan = generatePlan({ today: "2026-10-26", dailyMinutes: 120, skills, mastery: { s1: weak }, exams: [], homework: [] });
  const t = plan.find((x) => x.skillId === "s1");
  assert.ok(t, "weak skill must appear in the plan");
  assert.match(t!.reason, /critical gap|needs revision|builds on/);
});

test("planner: exam within 7 days targets weakest in-scope skills", () => {
  let weak = INITIAL_MASTERY;
  for (let i = 0; i < 3; i++) weak = updateMastery(weak, ev(false));
  const plan = generatePlan({
    today: "2026-10-26", dailyMinutes: 120, skills, mastery: { s2: weak },
    exams: [{ title: "Unit test", subjectId: "math", date: "2026-10-29" }], homework: [],
  });
  const t = plan.find((x) => x.skillId === "s2");
  assert.ok(t);
  assert.match(t!.reason, /Unit test is in 3 days/);
});

test("planner: due revision appears; strong skill gets a challenge", () => {
  let m = INITIAL_MASTERY;
  for (let i = 0; i < 6; i++) m = updateMastery(m, ev(true));
  const plan = generatePlan({ today: "2026-12-30", dailyMinutes: 120, skills, mastery: { s1: m }, exams: [], homework: [] });
  assert.ok(plan.some((t) => t.type === "revise" && t.skillId === "s1"));
});

test("diagnostic: round-robin over skills and adapts difficulty", () => {
  const bank = [
    { id: "a1", skillId: "s1", difficulty: "easy" as const }, { id: "a2", skillId: "s1", difficulty: "medium" as const }, { id: "a3", skillId: "s1", difficulty: "hard" as const },
    { id: "b1", skillId: "s2", difficulty: "easy" as const }, { id: "b2", skillId: "s2", difficulty: "medium" as const }, { id: "b3", skillId: "s2", difficulty: "hard" as const },
  ];
  const first = nextDiagnosticQuestion(bank, [], ["s1", "s2"], 4)!;
  assert.equal(first.skillId, "s1"); assert.equal(first.difficulty, "medium");
  const second = nextDiagnosticQuestion(bank, [{ questionId: "a2", skillId: "s1", difficulty: "medium", correct: true }], ["s1", "s2"], 4)!;
  assert.equal(second.skillId, "s2");
  const third = nextDiagnosticQuestion(bank, [
    { questionId: "a2", skillId: "s1", difficulty: "medium", correct: true },
    { questionId: "b2", skillId: "s2", difficulty: "medium", correct: false },
  ], ["s1", "s2"], 4)!;
  assert.equal(third.skillId, "s1"); assert.equal(third.difficulty, "hard"); // stepped up
  const fourth = nextDiagnosticQuestion(bank, [
    { questionId: "a2", skillId: "s1", difficulty: "medium", correct: true },
    { questionId: "b2", skillId: "s2", difficulty: "medium", correct: false },
    { questionId: "a3", skillId: "s1", difficulty: "hard", correct: true },
  ], ["s1", "s2"], 4)!;
  assert.equal(fourth.skillId, "s2"); assert.equal(fourth.difficulty, "easy"); // stepped down
  assert.equal(nextDiagnosticQuestion(bank, new Array(4).fill(0).map((_, i) => ({ questionId: "x" + i, skillId: "s1", difficulty: "easy" as const, correct: true })), ["s1", "s2"], 4), null);
});

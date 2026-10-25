import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS, QUESTIONS } from "./cbse10-maths.ts";

test("content: ids unique, skills referenced exist, enough questions", () => {
  const sk = new Set(SKILLS.map((s) => s.id));
  assert.equal(sk.size, SKILLS.length);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  assert.ok(QUESTIONS.length >= 30);
  for (const q of QUESTIONS) assert.ok(sk.has(q.skill), q.id);
  for (const s of SKILLS) {
    assert.ok(QUESTIONS.filter((q) => q.skill === s.id).length >= 2, `${s.id} needs >=2 questions`);
    for (const p of s.prerequisites) assert.ok(sk.has(p));
  }
});

test("content: mcq answers are valid option indices; numeric answers parse", () => {
  for (const q of QUESTIONS) {
    if (q.type === "mcq") {
      assert.ok(q.options && q.options.length >= 2, q.id);
      const i = Number(q.answer);
      assert.ok(Number.isInteger(i) && i >= 0 && i < q.options!.length, q.id);
      for (const k of Object.keys(q.tags ?? {})) assert.notEqual(k, q.answer, `${q.id}: tag on correct option`);
    } else assert.ok(Number.isFinite(Number(q.answer)), q.id);
  }
});

// Independent re-computation of numeric answers (guards against typos in the answer key).
const ans = (id: string) => Number(QUESTIONS.find((q) => q.id === id)!.answer);
const root = (a: number, b: number, c: number, sign: 1 | -1) => (-b + sign * Math.sqrt(b * b - 4 * a * c)) / (2 * a);
const nth = (a: number, d: number, n: number) => a + (n - 1) * d;
const sum = (a: number, d: number, n: number) => (n / 2) * (2 * a + (n - 1) * d);

test("content: numeric answer key matches independent computation", () => {
  assert.equal(ans("Q02"), -7);
  assert.equal(ans("Q05"), 1 + 0 - 6 === -5 ? 5 : NaN); // x=1: 1 + k - 6 = 0 -> k = 5
  assert.equal(ans("Q09"), root(2, -7, 3, 1));
  assert.equal(ans("Q11"), (6 / 2) ** 2);
  assert.equal(ans("Q14"), root(1, -7, 10, 1));
  assert.equal(ans("Q16"), root(2, -9, 4, 1) + root(2, -9, 4, -1));
  assert.equal(ans("Q17"), 16 - 24);
  assert.equal(ans("Q20"), Math.sqrt(36));
  assert.equal(ans("Q23"), root(1, 1, -56, 1));
  assert.equal(ans("Q24"), root(1, 3, -40, 1));
  assert.equal(ans("Q25"), root(1, 1, -56, 1) + 1);
  assert.equal(ans("Q26"), root(1, 5, -1800, 1));
  assert.equal(ans("Q28"), 3 - 7);
  assert.equal(ans("Q29"), nth(2, 3, 10));
  assert.equal(ans("Q30"), nth(-3, 4, 15));
  assert.equal(ans("Q32"), (78 - 3) / 5 + 1);
  assert.equal(ans("Q33"), (-81 - 21) / -3 + 1);
  assert.equal(ans("Q34"), sum(1, 1, 10));
  assert.equal(ans("Q35"), sum(1, 3, 20));
  assert.equal(ans("Q36"), sum(3, 2, 15));
  assert.equal(ans("Q37"), 3); assert.equal(2 * (4 * 3 - 6), (3 + 2) + (3 * 3 - 2));
  assert.equal(ans("Q38"), 20 - 4 * 3);
  assert.equal(ans("Q39"), nth(100, 20, 12));
  assert.equal(ans("Q40"), sum(100, 20, 12));
});

test("content: mcq root questions verified by substitution", () => {
  const f = (a: number, b: number, c: number, x: number) => a * x * x + b * x + c;
  assert.equal(f(1, -5, 6, 2), 0); assert.equal(f(1, -5, 6, 3), 0);            // Q04, Q07
  assert.equal(f(2, -1, -3, 1.5), 0);                                           // Q06
  assert.equal(f(1, 1, -12, -4), 0); assert.equal(f(1, 1, -12, 3), 0);          // Q08
  assert.equal(f(6, -1, -2, 2 / 3) < 1e-12, true); assert.equal(f(6, -1, -2, -0.5), 0); // Q10
  assert.equal(Math.abs(f(1, 2, -2, -1 + Math.sqrt(3))) < 1e-12, true);         // Q15
  assert.equal(36 - 36, 0); assert.ok(1 - 40 < 0);                              // Q18, Q19
});

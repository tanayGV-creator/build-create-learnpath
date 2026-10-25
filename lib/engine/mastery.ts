// Explainable mastery model + spaced repetition.
// Mastery is a *measured estimate* from the student's responses, not an assumption:
// a skill with zero attempts is "not_assessed", and "strong" needs >= 3 attempts.

export type Difficulty = "easy" | "medium" | "hard";

export interface MasteryState {
  score: number; // 0-100
  attempts: number;
  correct: number;
  avgSeconds: number;
  streak: number; // consecutive correct answers
  intervalDays: number; // current spaced-repetition interval
  lastPractisedAt: string | null; // ISO
  nextRevisionAt: string | null; // YYYY-MM-DD
}

export const INITIAL_MASTERY: MasteryState = {
  score: 50,
  attempts: 0,
  correct: 0,
  avgSeconds: 0,
  streak: 0,
  intervalDays: 0,
  lastPractisedAt: null,
  nextRevisionAt: null,
};

export interface Evidence {
  correct: boolean;
  difficulty: Difficulty;
  seconds: number;
  expectedSeconds: number;
  now: Date;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function daysBetween(fromDate: string, toDate: string): number {
  const a = Date.parse(fromDate + "T00:00:00Z");
  const b = Date.parse(toDate + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Confidence in the estimate, 0..1. Grows with attempts. */
export function confidence(attempts: number): number {
  return attempts / (attempts + 3);
}

export function updateMastery(prev: MasteryState, ev: Evidence): MasteryState {
  // Target the evidence pulls toward. A correct but very slow answer is weaker evidence.
  let target = ev.correct ? 100 : 0;
  if (ev.correct && ev.seconds > 2 * ev.expectedSeconds) target = 85;

  // Harder correct answers count more; easier wrong answers count more against.
  const weight = ev.correct
    ? { easy: 0.8, medium: 1.0, hard: 1.2 }[ev.difficulty]
    : { easy: 1.2, medium: 1.0, hard: 0.8 }[ev.difficulty];

  // Learning rate shrinks with history (but never below 0.12 so the model can still move).
  const alpha = clamp(weight / (prev.attempts + 1.5), 0.12, 0.6);
  const score = clamp(prev.score + alpha * (target - prev.score), 0, 100);

  const attempts = prev.attempts + 1;
  const correct = prev.correct + (ev.correct ? 1 : 0);
  const avgSeconds = (prev.avgSeconds * prev.attempts + ev.seconds) / attempts;
  const streak = ev.correct ? prev.streak + 1 : 0;

  // Spaced repetition: interval roughly doubles after success, resets after an error.
  let intervalDays: number;
  if (ev.correct) {
    intervalDays = prev.intervalDays === 0 ? 1 : Math.min(60, Math.round(prev.intervalDays * 2));
  } else {
    intervalDays = 1;
  }

  return {
    score: Math.round(score * 100) / 100,
    attempts,
    correct,
    avgSeconds: Math.round(avgSeconds * 10) / 10,
    streak,
    intervalDays,
    lastPractisedAt: ev.now.toISOString(),
    nextRevisionAt: toDateString(addDays(ev.now, intervalDays)),
  };
}

export type MasteryStatus = "not_assessed" | "critical_gap" | "needs_revision" | "developing" | "strong";

export function masteryStatus(m: MasteryState): MasteryStatus {
  if (m.attempts === 0) return "not_assessed";
  if (m.score < 40) return "critical_gap";
  if (m.score < 60) return "needs_revision";
  if (m.score >= 80 && m.attempts >= 3) return "strong";
  return "developing";
}

/** Score after accounting for overdue revision (forgetting). Display/planning only. */
export function effectiveScore(m: MasteryState, today: string): number {
  if (!m.nextRevisionAt) return m.score;
  const overdue = Math.max(0, daysBetween(m.nextRevisionAt, today));
  return Math.round(m.score * Math.max(0.6, 1 - 0.03 * overdue) * 100) / 100;
}

export function isRevisionDue(m: MasteryState, today: string): boolean {
  return m.attempts > 0 && m.nextRevisionAt !== null && m.nextRevisionAt <= today;
}

export const STATUS_LABEL: Record<MasteryStatus, string> = {
  not_assessed: "Not yet assessed",
  critical_gap: "Critical gap",
  needs_revision: "Needs revision",
  developing: "Developing",
  strong: "Strong",
};

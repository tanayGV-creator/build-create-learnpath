// Answer checking. Pure functions, no I/O.

export interface QuestionLike {
  type: "mcq" | "numeric" | "short";
  answer: string; // mcq: index of correct option as string; numeric: number; short: accepted answers separated by "|"
  options?: string[] | null;
  distractorTags?: Record<string, string> | null; // mcq: option index -> misconception tag
}

export interface CheckResult {
  correct: boolean;
  misconception: string | null;
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!]+$/g, "");

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (s === "") return null;
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = parseFloat(frac[2]);
    return d === 0 ? null : parseFloat(frac[1]) / d;
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

export function checkAnswer(q: QuestionLike, submitted: string, tolerance = 0.01): CheckResult {
  const given = (submitted ?? "").toString();
  if (q.type === "mcq") {
    const correct = given.trim() === q.answer.trim();
    const tag = !correct && q.distractorTags ? q.distractorTags[given.trim()] ?? null : null;
    return { correct, misconception: tag };
  }
  if (q.type === "numeric") {
    const a = parseNumber(given);
    const b = parseNumber(q.answer);
    const correct = a !== null && b !== null && Math.abs(a - b) <= tolerance;
    return { correct, misconception: null };
  }
  const accepted = q.answer.split("|").map(normalise);
  return { correct: accepted.includes(normalise(given)), misconception: null };
}

export function scoreMarks(results: { correct: boolean; marks: number }[]): { score: number; total: number } {
  return {
    score: results.reduce((s, r) => s + (r.correct ? r.marks : 0), 0),
    total: results.reduce((s, r) => s + r.marks, 0),
  };
}

// Simple adaptive diagnostic: round-robin over skills, difficulty steps up after a correct
// answer on that skill and down after a wrong one. Deterministic and explainable.
import type { Difficulty } from "./mastery.ts";

export interface DiagQuestion {
  id: string;
  skillId: string;
  difficulty: Difficulty;
}

export interface DiagResponse {
  questionId: string;
  skillId: string;
  difficulty: Difficulty;
  correct: boolean;
}

const ORDER: Difficulty[] = ["easy", "medium", "hard"];

export function nextDiagnosticQuestion(
  bank: DiagQuestion[],
  responses: DiagResponse[],
  skillIds: string[],
  maxQuestions: number
): DiagQuestion | null {
  if (responses.length >= maxQuestions) return null;
  const answered = new Set(responses.map((r) => r.questionId));

  // Skill with the fewest answers so far (ties: syllabus order), that still has unseen questions.
  const countBySkill = (id: string) => responses.filter((r) => r.skillId === id).length;
  const ranked = skillIds
    .filter((id) => bank.some((q) => q.skillId === id && !answered.has(q.id)))
    .sort((a, b) => countBySkill(a) - countBySkill(b) || skillIds.indexOf(a) - skillIds.indexOf(b));
  const skillId = ranked[0];
  if (!skillId) return null;

  // Target difficulty from the last response on this skill.
  const last = [...responses].reverse().find((r) => r.skillId === skillId);
  let idx = 1; // start medium
  if (last) {
    idx = ORDER.indexOf(last.difficulty) + (last.correct ? 1 : -1);
    idx = Math.min(2, Math.max(0, idx));
  }

  const pool = bank.filter((q) => q.skillId === skillId && !answered.has(q.id));
  // Closest available difficulty to the target.
  pool.sort((a, b) => Math.abs(ORDER.indexOf(a.difficulty) - idx) - Math.abs(ORDER.indexOf(b.difficulty) - idx));
  return pool[0] ?? null;
}

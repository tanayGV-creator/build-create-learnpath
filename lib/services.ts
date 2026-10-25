// Application services. Everything takes a Db so it can be tested with an in-memory database.
import { type Db, newId } from "./db.ts";
import { hashPassword, verifyPassword, validatePassword } from "./auth.ts";
import {
  INITIAL_MASTERY, type MasteryState, type Difficulty, updateMastery, masteryStatus, effectiveScore,
  confidence, toDateString, addDays, daysBetween, STATUS_LABEL,
} from "./engine/mastery.ts";
import { checkAnswer, scoreMarks } from "./engine/quiz.ts";
import { generatePlan, type PlanSkill, type PlannedTask } from "./engine/planner.ts";
import { nextDiagnosticQuestion } from "./engine/diagnostic.ts";
import {
  retrieve, buildSystemPrompt, asksForDirectAnswer, mentionsSelfHarm, SAFETY_MESSAGE, scrubPII,
  type Chunk,
} from "./ai/tutor.ts";
import type { AIProvider, ChatMessage } from "./ai/provider.ts";

export const DIAGNOSTIC_LENGTH = 14;
const GRADED_ATTEMPT_MAX_HOURS = 3;

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------- users ----------

export function isMinor(dob: string | null, today: string): boolean {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return true; // unknown age => treat as minor (safer default)
  const y = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  const had = today.slice(5) >= dob.slice(5);
  return (had ? y : y - 1) < 18;
}

export function registerStudent(
  db: Db,
  input: { email: string; password: string; fullName: string; dateOfBirth: string },
  now = new Date()
): string {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ServiceError("Enter a valid email address.");
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new ServiceError(pwErr);
  const name = input.fullName.trim();
  if (name.length < 1 || name.length > 80) throw new ServiceError("Enter your name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth) || input.dateOfBirth > toDateString(now))
    throw new ServiceError("Enter a valid date of birth.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    throw new ServiceError("An account with this email already exists.", 409);
  const id = newId("u_");
  db.prepare("INSERT INTO users (id, email, password_hash, role, full_name, date_of_birth, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, email, hashPassword(input.password), "student", name, input.dateOfBirth, now.toISOString());
  db.prepare("INSERT INTO student_profiles (user_id, grade, board) VALUES (?,?,?)").run(id, "10", "CBSE");
  return id;
}

export function login(db: Db, email: string, password: string): string | null {
  const row = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase());
  // Verify against a dummy hash when the user is missing, to keep timing similar.
  const ok = verifyPassword(password, row?.password_hash ?? "scrypt$00$00");
  return row && ok ? row.id : null;
}

export function getUser(db: Db, userId: string) {
  const u = db.prepare(
    `SELECT u.id, u.email, u.full_name AS fullName, u.date_of_birth AS dateOfBirth, u.role,
            p.grade, p.board, p.daily_study_minutes AS dailyMinutes, p.career_goal AS careerGoal,
            p.ai_consent AS aiConsent, p.guardian_confirmed AS guardianConfirmed, p.onboarded,
            p.reduced_motion AS reducedMotion, p.large_text AS largeText
     FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id WHERE u.id = ?`
  ).get(userId);
  return u ?? null;
}

export function saveOnboarding(
  db: Db,
  userId: string,
  input: {
    dailyMinutes: number; careerGoal: string; aiConsent: boolean; guardianConfirmed: boolean;
    largeText?: boolean; reducedMotion?: boolean;
  },
  today = toDateString(new Date())
): void {
  const user = getUser(db, userId);
  if (!user) throw new ServiceError("Not found", 404);
  const minutes = Math.round(Number(input.dailyMinutes));
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 240) throw new ServiceError("Daily study time must be between 15 and 240 minutes.");
  const minor = isMinor(user.dateOfBirth, today);
  // AI use requires consent; for under-18s it also requires a guardian to have agreed.
  // NOTE: this is a self-declared checkbox, NOT verified parental consent (see README).
  const aiConsent = input.aiConsent && (!minor || input.guardianConfirmed);
  db.prepare(
    "UPDATE student_profiles SET daily_study_minutes=?, career_goal=?, ai_consent=?, guardian_confirmed=?, onboarded=1, large_text=?, reduced_motion=? WHERE user_id=?"
  ).run(minutes, (input.careerGoal ?? "").trim().slice(0, 120) || null, aiConsent ? 1 : 0, input.guardianConfirmed ? 1 : 0,
    input.largeText ? 1 : 0, input.reducedMotion ? 1 : 0, userId);
}

// ---------- curriculum ----------

export function loadSkills(db: Db): (PlanSkill & { unitId: string })[] {
  const rows = db.prepare(
    `SELECT s.id, s.name, s.estimated_minutes AS minutes, s.prerequisites, s.position, u.name AS unitName, u.id AS unitId, u.subject_id AS subjectId
     FROM skills s JOIN units u ON u.id = s.unit_id ORDER BY s.position`
  ).all();
  return rows.map((r: any) => ({ ...r, prerequisites: JSON.parse(r.prerequisites) }));
}

export function getMastery(db: Db, studentId: string): Record<string, MasteryState> {
  const out: Record<string, MasteryState> = {};
  for (const r of db.prepare("SELECT * FROM mastery WHERE student_id = ?").all(studentId)) {
    out[r.skill_id] = {
      score: r.score, attempts: r.attempts, correct: r.correct, avgSeconds: r.avg_seconds, streak: r.streak,
      intervalDays: r.interval_days, lastPractisedAt: r.last_practised_at, nextRevisionAt: r.next_revision_at,
    };
  }
  return out;
}

function saveMastery(db: Db, studentId: string, skillId: string, m: MasteryState) {
  db.prepare(
    `INSERT INTO mastery (student_id, skill_id, score, attempts, correct, avg_seconds, streak, interval_days, last_practised_at, next_revision_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(student_id, skill_id) DO UPDATE SET score=excluded.score, attempts=excluded.attempts, correct=excluded.correct,
       avg_seconds=excluded.avg_seconds, streak=excluded.streak, interval_days=excluded.interval_days,
       last_practised_at=excluded.last_practised_at, next_revision_at=excluded.next_revision_at`
  ).run(studentId, skillId, m.score, m.attempts, m.correct, m.avgSeconds, m.streak, m.intervalDays, m.lastPractisedAt, m.nextRevisionAt);
}

// ---------- attempts / quiz ----------

function publicQuestion(q: any) {
  // Never send the answer or explanation to the client before the student answers.
  return {
    id: q.id, skillId: q.skill_id, type: q.type, text: q.text,
    options: q.options ? JSON.parse(q.options) : null, difficulty: q.difficulty, marks: q.marks,
    expectedSeconds: q.expected_seconds,
  };
}

export function startAttempt(db: Db, studentId: string, kind: "diagnostic" | "practice" | "test", now = new Date()): string {
  closeStaleAttempts(db, studentId, now);
  const existing = db.prepare("SELECT id FROM attempts WHERE student_id=? AND kind=? AND status='in_progress'").get(studentId, kind);
  if (existing) return existing.id;
  const id = newId("a_");
  db.prepare("INSERT INTO attempts (id, student_id, kind, graded, status, started_at) VALUES (?,?,?,?, 'in_progress', ?)")
    .run(id, studentId, kind, kind === "practice" ? 0 : 1, now.toISOString());
  return id;
}

function closeStaleAttempts(db: Db, studentId: string, now: Date) {
  const cutoff = new Date(now.getTime() - GRADED_ATTEMPT_MAX_HOURS * 3_600_000).toISOString();
  db.prepare("UPDATE attempts SET status='submitted', submitted_at=? WHERE student_id=? AND status='in_progress' AND started_at < ?")
    .run(now.toISOString(), studentId, cutoff);
}

export function hasActiveGradedAttempt(db: Db, studentId: string, now = new Date()): boolean {
  closeStaleAttempts(db, studentId, now);
  return !!db.prepare("SELECT 1 FROM attempts WHERE student_id=? AND graded=1 AND status='in_progress'").get(studentId);
}

function getAttempt(db: Db, studentId: string, attemptId: string) {
  const a = db.prepare("SELECT * FROM attempts WHERE id=? AND student_id=?").get(attemptId, studentId);
  if (!a) throw new ServiceError("Attempt not found", 404);
  return a;
}

export function nextQuestion(db: Db, studentId: string, attemptId: string, opts: { skillId?: string; today?: string } = {}) {
  const a = getAttempt(db, studentId, attemptId);
  if (a.status !== "in_progress") return { done: true as const };
  const answeredRows = db.prepare(
    "SELECT r.question_id, r.skill_id, r.is_correct, q.difficulty FROM responses r JOIN questions q ON q.id = r.question_id WHERE r.attempt_id=? ORDER BY r.created_at, r.rowid"
  ).all(attemptId);
  const bankRows = db.prepare("SELECT id, skill_id, difficulty FROM questions").all();
  const bank = bankRows.map((q: any) => ({ id: q.id, skillId: q.skill_id, difficulty: q.difficulty as Difficulty }));
  const skills = loadSkills(db).map((s) => s.id);

  let picked: { id: string } | null = null;
  if (a.kind === "diagnostic") {
    picked = nextDiagnosticQuestion(
      bank,
      answeredRows.map((r: any) => ({ questionId: r.question_id, skillId: r.skill_id, difficulty: r.difficulty, correct: !!r.is_correct })),
      skills, DIAGNOSTIC_LENGTH
    );
  } else {
    // practice / test: target a skill (requested, else first task of today's plan, else weakest)
    const answered = new Set(answeredRows.map((r: any) => r.question_id));
    let target = opts.skillId;
    if (!target) {
      const plan = getOrCreatePlan(db, studentId, opts.today ?? toDateString(new Date()), false);
      target = plan.find((t) => t.skillId && t.status === "pending")?.skillId ?? undefined;
    }
    const pool = bank.filter((q) => (!target || q.skillId === target) && !answered.has(q.id));
    const m = target ? getMastery(db, studentId)[target] ?? INITIAL_MASTERY : INITIAL_MASTERY;
    const want: Difficulty = m.score >= 75 ? "hard" : m.score >= 50 ? "medium" : "easy";
    const order: Difficulty[] = ["easy", "medium", "hard"];
    pool.sort((x, y) => Math.abs(order.indexOf(x.difficulty) - order.indexOf(want)) - Math.abs(order.indexOf(y.difficulty) - order.indexOf(want)));
    picked = pool[0] ?? null;
  }
  if (!picked) return { done: true as const };
  const q = db.prepare("SELECT * FROM questions WHERE id=?").get(picked.id);
  return {
    done: false as const,
    question: publicQuestion(q),
    progress: { answered: answeredRows.length, total: a.kind === "diagnostic" ? DIAGNOSTIC_LENGTH : null },
  };
}

export function submitAnswer(
  db: Db, studentId: string, attemptId: string,
  input: { questionId: string; answer: string; seconds: number },
  now = new Date()
) {
  const a = getAttempt(db, studentId, attemptId);
  if (a.status !== "in_progress") throw new ServiceError("This attempt is already submitted.", 409);
  const q = db.prepare("SELECT * FROM questions WHERE id=?").get(input.questionId);
  if (!q) throw new ServiceError("Question not found", 404);
  if (db.prepare("SELECT 1 FROM responses WHERE attempt_id=? AND question_id=?").get(attemptId, input.questionId))
    throw new ServiceError("Already answered.", 409);
  const seconds = Math.min(Math.max(Number(input.seconds) || 0, 1), 3600);
  const res = checkAnswer(
    { type: q.type, answer: q.answer, options: q.options ? JSON.parse(q.options) : null, distractorTags: q.distractor_tags ? JSON.parse(q.distractor_tags) : null },
    String(input.answer ?? "")
  );
  db.prepare(
    "INSERT INTO responses (id, attempt_id, student_id, question_id, skill_id, answer, is_correct, seconds, misconception, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(newId("r_"), attemptId, studentId, q.id, q.skill_id, String(input.answer ?? "").slice(0, 200), res.correct ? 1 : 0, seconds, res.misconception, now.toISOString());

  const prev = getMastery(db, studentId)[q.skill_id] ?? INITIAL_MASTERY;
  const next = updateMastery(prev, { correct: res.correct, difficulty: q.difficulty, seconds, expectedSeconds: q.expected_seconds, now });
  saveMastery(db, studentId, q.skill_id, next);

  // Graded attempts hide feedback until the assessment is finished (academic integrity).
  if (a.graded) return { recorded: true as const };
  return {
    recorded: true as const, correct: res.correct, explanation: q.explanation,
    misconception: res.misconception, correctAnswer: q.type === "mcq" ? JSON.parse(q.options)[Number(q.answer)] : q.answer,
  };
}

export function finishAttempt(db: Db, studentId: string, attemptId: string, now = new Date()) {
  const a = getAttempt(db, studentId, attemptId);
  if (a.status === "in_progress")
    db.prepare("UPDATE attempts SET status='submitted', submitted_at=? WHERE id=?").run(now.toISOString(), attemptId);
  const rows = db.prepare(
    `SELECT r.question_id, r.skill_id, r.is_correct, r.seconds, r.answer, r.misconception, q.text, q.explanation, q.marks, q.type, q.options, q.answer AS key
     FROM responses r JOIN questions q ON q.id = r.question_id WHERE r.attempt_id=? ORDER BY r.rowid`
  ).all(attemptId);
  const marks = scoreMarks(rows.map((r: any) => ({ correct: !!r.is_correct, marks: r.marks })));
  const mastery = getMastery(db, studentId);
  const skills = loadSkills(db);
  const touched = [...new Set(rows.map((r: any) => r.skill_id))];
  return {
    kind: a.kind, answered: rows.length, ...marks,
    accuracy: rows.length ? Math.round((rows.filter((r: any) => r.is_correct).length / rows.length) * 100) : 0,
    skills: touched.map((id) => {
      const s = skills.find((x) => x.id === id)!;
      const m = mastery[id] ?? INITIAL_MASTERY;
      return { skillId: id, name: s.name, score: Math.round(m.score), status: masteryStatus(m), statusLabel: STATUS_LABEL[masteryStatus(m)], attempts: m.attempts };
    }),
    // Post-assessment review: explanations are only revealed now.
    review: rows.filter((r: any) => !r.is_correct).map((r: any) => ({
      question: r.text, yourAnswer: r.type === "mcq" ? (JSON.parse(r.options)[Number(r.answer)] ?? r.answer) : r.answer,
      correctAnswer: r.type === "mcq" ? JSON.parse(r.options)[Number(r.key)] : r.key,
      explanation: r.explanation, misconception: r.misconception,
    })),
  };
}

// ---------- planner ----------

export function addHomework(db: Db, studentId: string, input: { title: string; minutes: number; dueDate: string }) {
  const title = input.title.trim().slice(0, 100);
  if (!title) throw new ServiceError("Give the homework a title.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new ServiceError("Enter a valid due date.");
  const minutes = Math.min(180, Math.max(5, Math.round(Number(input.minutes) || 30)));
  const id = newId("h_");
  db.prepare("INSERT INTO homework (id, student_id, title, minutes, due_date) VALUES (?,?,?,?,?)").run(id, studentId, title, minutes, input.dueDate);
  return id;
}

export function addExam(db: Db, studentId: string, input: { title: string; examDate: string; subjectId: string }) {
  const title = input.title.trim().slice(0, 100);
  if (!title) throw new ServiceError("Give the exam a title.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.examDate)) throw new ServiceError("Enter a valid exam date.");
  if (!db.prepare("SELECT 1 FROM subjects WHERE id=?").get(input.subjectId)) throw new ServiceError("Unknown subject.");
  const id = newId("e_");
  db.prepare("INSERT INTO exams (id, student_id, title, subject_id, exam_date) VALUES (?,?,?,?,?)").run(id, studentId, title, input.subjectId, input.examDate);
  return id;
}

export function listExams(db: Db, studentId: string, today: string) {
  return db.prepare("SELECT id, title, subject_id AS subjectId, exam_date AS examDate FROM exams WHERE student_id=? AND exam_date >= ? ORDER BY exam_date").all(studentId, today)
    .map((e: any) => ({ ...e, daysLeft: daysBetween(today, e.examDate) }));
}

export function getOrCreatePlan(db: Db, studentId: string, today: string, regenerate: boolean) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE student_id=? AND plan_date=? AND status != 'deleted'").get(studentId, today).n;
  if (existing === 0 || regenerate) {
    // Keep finished tasks and anything the student added; replace untouched system suggestions.
    db.prepare("DELETE FROM tasks WHERE student_id=? AND plan_date=? AND source='system' AND status IN ('pending','postponed','deleted')").run(studentId, today);
    const user = getUser(db, studentId);
    const keptSkills = new Set(db.prepare("SELECT skill_id FROM tasks WHERE student_id=? AND plan_date=? AND skill_id IS NOT NULL").all(studentId, today).map((r: any) => r.skill_id));
    const keptMinutes = db.prepare("SELECT COALESCE(SUM(minutes),0) AS m FROM tasks WHERE student_id=? AND plan_date=? AND status != 'deleted'").get(studentId, today).m;
    const remaining = (user?.dailyMinutes ?? 60) - keptMinutes;
    const plan = remaining <= 0 ? [] : generatePlan({
      today,
      dailyMinutes: remaining,
      skills: loadSkills(db),
      mastery: getMastery(db, studentId),
      exams: db.prepare("SELECT title, subject_id AS subjectId, exam_date AS date FROM exams WHERE student_id=?").all(studentId),
      homework: db.prepare("SELECT title, minutes, due_date AS dueDate FROM homework WHERE student_id=? AND status='pending'").all(studentId),
    });
    const hw = db.prepare("SELECT id, title FROM homework WHERE student_id=? AND status='pending'").all(studentId);
    plan.filter((t: PlannedTask) => !t.skillId || !keptSkills.has(t.skillId)).forEach((t: PlannedTask) => {
      db.prepare(
        "INSERT INTO tasks (id, student_id, plan_date, type, skill_id, title, minutes, priority, status, source, reason, alternative, due_date, homework_id) VALUES (?,?,?,?,?,?,?,?, 'pending','system',?,?,?,?)"
      ).run(newId("t_"), studentId, today, t.type, t.skillId, t.title, t.minutes, t.priority, t.reason, t.alternative, t.dueDate,
        t.type === "homework" ? hw.find((h: any) => h.title === t.title)?.id ?? null : null);
    });
  }
  return db.prepare(
    "SELECT id, type, skill_id AS skillId, title, minutes, priority, status, source, reason, alternative, due_date AS dueDate FROM tasks WHERE student_id=? AND plan_date=? AND status != 'deleted' ORDER BY priority, rowid"
  ).all(studentId, today) as any[];
}

export function updateTask(db: Db, studentId: string, taskId: string, action: "done" | "postpone" | "delete" | "undo", today: string) {
  const t = db.prepare("SELECT * FROM tasks WHERE id=? AND student_id=?").get(taskId, studentId);
  if (!t) throw new ServiceError("Task not found", 404);
  if (action === "done") {
    db.prepare("UPDATE tasks SET status='done' WHERE id=?").run(taskId);
    if (t.homework_id) db.prepare("UPDATE homework SET status='done' WHERE id=? AND student_id=?").run(t.homework_id, studentId);
  } else if (action === "undo") {
    db.prepare("UPDATE tasks SET status='pending' WHERE id=?").run(taskId);
    if (t.homework_id) db.prepare("UPDATE homework SET status='pending' WHERE id=? AND student_id=?").run(t.homework_id, studentId);
  } else if (action === "postpone") {
    const tomorrow = toDateString(addDays(new Date(today + "T00:00:00Z"), 1));
    db.prepare("UPDATE tasks SET plan_date=?, status='pending', source='student' WHERE id=?").run(tomorrow, taskId);
  } else if (action === "delete") {
    db.prepare("UPDATE tasks SET status='deleted' WHERE id=?").run(taskId);
  } else throw new ServiceError("Unknown action");
}

// ---------- progress ----------

export function getProgress(db: Db, studentId: string, today: string) {
  const skills = loadSkills(db);
  const mastery = getMastery(db, studentId);
  const rows = skills.map((s) => {
    const m = mastery[s.id] ?? INITIAL_MASTERY;
    const eff = effectiveScore(m, today);
    return {
      skillId: s.id, name: s.name, unit: s.unitName, subjectId: s.subjectId,
      status: masteryStatus(m), statusLabel: STATUS_LABEL[masteryStatus(m)],
      score: Math.round(eff), attempts: m.attempts, confidence: Math.round(confidence(m.attempts) * 100) / 100,
      nextRevisionAt: m.nextRevisionAt, measured: m.attempts > 0,
    };
  });
  const counts: Record<string, number> = { strong: 0, developing: 0, needs_revision: 0, critical_gap: 0, not_assessed: 0 };
  rows.forEach((r) => counts[r.status]++);
  const resp = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(is_correct),0) AS c, COALESCE(AVG(seconds),0) AS s FROM responses WHERE student_id=?").get(studentId);
  const since = toDateString(addDays(new Date(today + "T00:00:00Z"), -6));
  const activeDays = db.prepare("SELECT COUNT(DISTINCT substr(created_at,1,10)) AS d FROM responses WHERE student_id=? AND substr(created_at,1,10) >= ?").get(studentId, since).d;
  const tasks = db.prepare("SELECT COUNT(*) AS planned, COALESCE(SUM(status='done'),0) AS done FROM tasks WHERE student_id=? AND plan_date >= ? AND plan_date <= ? AND status != 'deleted'").get(studentId, since, today);
  const exams = listExams(db, studentId, today).map((e: any) => {
    const inScope = rows.filter((r) => r.subjectId === e.subjectId);
    const assessed = inScope.filter((r) => r.measured);
    return {
      ...e, skillsTotal: inScope.length, skillsAssessed: assessed.length,
      // Honest readiness: average over *assessed* skills only, shown with coverage.
      avgMastery: assessed.length ? Math.round(assessed.reduce((s, r) => s + r.score, 0) / assessed.length) : null,
    };
  });
  return {
    skills: rows, counts,
    totals: { answered: resp.n, accuracy: resp.n ? Math.round((resp.c / resp.n) * 100) : null, avgSeconds: resp.n ? Math.round(resp.s) : null },
    consistency: { activeDaysLast7: activeDays },
    tasksLast7: { planned: tasks.planned, done: tasks.done },
    exams,
  };
}

// ---------- tutor ----------

export function getDailyTokensUsed(db: Db, studentId: string, today: string): number {
  const r = db.prepare("SELECT COALESCE(SUM(input_tokens + output_tokens),0) AS t FROM ai_interactions WHERE student_id=? AND substr(created_at,1,10)=?").get(studentId, today);
  return r.t;
}

export async function tutorChat(
  db: Db, provider: AIProvider, studentId: string,
  input: { message: string; history?: ChatMessage[] },
  opts: { now?: Date; dailyTokenBudget?: number } = {}
) {
  const now = opts.now ?? new Date();
  const today = toDateString(now);
  const user = getUser(db, studentId);
  if (!user) throw new ServiceError("Not found", 404);
  const message = (input.message ?? "").trim();
  if (!message) throw new ServiceError("Type a question first.");
  if (message.length > 1000) throw new ServiceError("Please keep your question under 1000 characters.");

  const log = (reply: string, p: { provider: string; simulated: boolean; inTok: number; outTok: number; refs: string[]; flags: string[] }) =>
    db.prepare(
      "INSERT INTO ai_interactions (id, student_id, created_at, prompt, response, provider, simulated, input_tokens, output_tokens, context_refs, flags) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).run(newId("ai_"), studentId, now.toISOString(), message, reply, p.provider, p.simulated ? 1 : 0, p.inTok, p.outTok, JSON.stringify(p.refs), JSON.stringify(p.flags));

  // Safety first: do not send self-harm messages to the model; respond with support.
  if (mentionsSelfHarm(message)) {
    log(SAFETY_MESSAGE, { provider: "rules", simulated: false, inTok: 0, outTok: 0, refs: [], flags: ["self_harm"] });
    return { reply: SAFETY_MESSAGE, sources: [], blocked: "safety" as const, simulated: false };
  }
  if (!user.aiConsent) {
    return { reply: "The AI tutor is switched off for your account. You can turn it on in Settings once consent is given (a parent or guardian needs to agree if you're under 18).", sources: [], blocked: "consent" as const, simulated: false };
  }
  if (hasActiveGradedAttempt(db, studentId, now)) {
    return { reply: "The tutor is switched off while a graded assessment is in progress. Finish it and you'll get full explanations of every question.", sources: [], blocked: "assessment" as const, simulated: false };
  }
  const budget = opts.dailyTokenBudget ?? 40000;
  if (getDailyTokensUsed(db, studentId, today) >= budget) {
    return { reply: "You've reached today's tutor limit. Try practice questions or come back tomorrow.", sources: [], blocked: "budget" as const, simulated: false };
  }

  const chunks: Chunk[] = db.prepare("SELECT id, skill_id AS skillId, title, body, source FROM resources").all();
  const sources = retrieve(message, chunks, 3);
  const mastery = getMastery(db, studentId);
  const skills = loadSkills(db);
  const weak = skills
    .map((s) => ({ name: s.name, m: mastery[s.id] }))
    .filter((x) => x.m && x.m.attempts > 0 && x.m.score < 60)
    .sort((a, b) => a.m.score - b.m.score).slice(0, 3)
    .map((x) => ({ name: x.name, score: x.m.score, attempts: x.m.attempts }));

  const direct = asksForDirectAnswer(message);
  // Student's name is never sent. Only grade/board, weak skill names and the scrubbed message.
  const system = buildSystemPrompt({ grade: user.grade, board: user.board, weakSkills: weak, careerGoal: user.careerGoal }, sources, direct);
  const history = (input.history ?? []).slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: scrubPII(String(m.content).slice(0, 1500)) }));
  const result = await provider.complete({ system, messages: [...history, { role: "user", content: scrubPII(message) }], maxTokens: 500 });

  const flags = [direct ? "direct_answer_requested" : "", sources.length === 0 ? "no_approved_context" : ""].filter(Boolean);
  log(result.text, { provider: result.provider, simulated: result.simulated, inTok: result.inputTokens, outTok: result.outputTokens, refs: sources.map((s) => s.chunk.id), flags });
  return {
    reply: result.text, simulated: result.simulated, blocked: null,
    sources: sources.map((s, i) => ({ label: `S${i + 1}`, title: s.chunk.title, source: s.chunk.source })),
    noApprovedContext: sources.length === 0,
  };
}

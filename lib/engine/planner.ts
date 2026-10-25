// Rule-based, explainable daily planner. Every task carries a human-readable reason.
// Priority order follows the spec (section 7.3).
import { type MasteryState, INITIAL_MASTERY, effectiveScore, isRevisionDue, masteryStatus, daysBetween } from "./mastery.ts";

export interface PlanSkill {
  id: string;
  name: string;
  unitName: string;
  subjectId: string;
  position: number; // global order in syllabus
  minutes: number;
  prerequisites: string[];
}

export interface PlanExam {
  title: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
}

export interface PlanHomework {
  title: string;
  minutes: number;
  dueDate: string; // YYYY-MM-DD
}

export interface PlanInput {
  today: string; // YYYY-MM-DD
  dailyMinutes: number;
  skills: PlanSkill[];
  mastery: Record<string, MasteryState>;
  exams: PlanExam[];
  homework: PlanHomework[];
}

export interface PlannedTask {
  type: "homework" | "learn" | "practise" | "revise" | "challenge";
  skillId: string | null;
  title: string;
  minutes: number;
  priority: number; // 1 = highest
  reason: string;
  alternative: string;
  dueDate: string | null;
}

const MAX_BLOCK = 25; // keep study blocks realistic

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

export function generatePlan(input: PlanInput): PlannedTask[] {
  const { today, dailyMinutes, skills, mastery, exams, homework } = input;
  const m = (id: string) => mastery[id] ?? INITIAL_MASTERY;
  const byId = new Map(skills.map((s) => [s.id, s]));
  const candidates: PlannedTask[] = [];
  const usedSkills = new Set<string>();

  // 1. Homework: overdue or due within 2 days.
  for (const hw of [...homework].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const d = daysBetween(today, hw.dueDate);
    if (d > 2) continue;
    const when = d < 0 ? `overdue by ${plural(-d, "day")}` : d === 0 ? "due today" : `due in ${plural(d, "day")}`;
    candidates.push({
      type: "homework",
      skillId: null,
      title: hw.title,
      minutes: Math.min(hw.minutes, MAX_BLOCK * 2),
      priority: d < 0 ? 1 : 2,
      reason: `Your homework "${hw.title}" is ${when}.`,
      alternative: "Split it into two shorter sessions if you are short on time today.",
      dueDate: hw.dueDate,
    });
  }

  // 2. Exams within 7 days: exam-style practice on the weakest in-scope skills.
  const nearExams = exams
    .map((e) => ({ e, d: daysBetween(today, e.date) }))
    .filter((x) => x.d >= 0 && x.d <= 7)
    .sort((a, b) => a.d - b.d);
  for (const { e, d } of nearExams) {
    const inScope = skills
      .filter((s) => s.subjectId === e.subjectId)
      .map((s) => ({ s, eff: effectiveScore(m(s.id), today), st: masteryStatus(m(s.id)) }))
      .filter((x) => x.st !== "strong")
      .sort((a, b) => a.eff - b.eff)
      .slice(0, 2);
    for (const { s, eff, st } of inScope) {
      if (usedSkills.has(s.id)) continue;
      usedSkills.add(s.id);
      const assessed = st !== "not_assessed";
      candidates.push({
        type: "practise",
        skillId: s.id,
        title: `Exam-style practice: ${s.name}`,
        minutes: Math.min(s.minutes, MAX_BLOCK),
        priority: 3,
        reason: assessed
          ? `${e.title} is in ${plural(d, "day")}, and "${s.name}" is one of your weaker skills for it (estimated mastery ${Math.round(eff)}%).`
          : `${e.title} is in ${plural(d, "day")}, and you haven't been assessed on "${s.name}" yet.`,
        alternative: "Take a short mixed quiz instead if you prefer variety.",
        dueDate: e.date,
      });
    }
  }

  // 3. Critical prerequisite gaps: a weak prerequisite blocks a skill the student is about to meet.
  for (const s of skills) {
    if (usedSkills.has(s.id)) continue;
    for (const pid of s.prerequisites) {
      const p = byId.get(pid);
      if (!p || usedSkills.has(p.id)) continue;
      const pm = m(p.id);
      if (pm.attempts > 0 && effectiveScore(pm, today) < 50 && m(s.id).attempts < 3) {
        usedSkills.add(p.id);
        candidates.push({
          type: "learn",
          skillId: p.id,
          title: `Strengthen the basics: ${p.name}`,
          minutes: Math.min(p.minutes, MAX_BLOCK),
          priority: 4,
          reason: `"${s.name}" builds on "${p.name}", and your measured mastery there is only ${Math.round(effectiveScore(pm, today))}%.`,
          alternative: "Ask the tutor for a simpler explanation before practising.",
          dueDate: null,
        });
      }
    }
  }

  // 4. Low-mastery skills (assessed, needs work).
  const weak = skills
    .filter((s) => !usedSkills.has(s.id))
    .map((s) => ({ s, st: masteryStatus(m(s.id)), eff: effectiveScore(m(s.id), today) }))
    .filter((x) => x.st === "critical_gap" || x.st === "needs_revision")
    .sort((a, b) => a.eff - b.eff);
  for (const { s, st, eff } of weak.slice(0, 2)) {
    usedSkills.add(s.id);
    candidates.push({
      type: "practise",
      skillId: s.id,
      title: `Practise: ${s.name}`,
      minutes: Math.min(s.minutes, MAX_BLOCK),
      priority: 5,
      reason: `Your estimated mastery of "${s.name}" is ${Math.round(eff)}% (${st === "critical_gap" ? "a critical gap" : "needs revision"}), based on ${plural(m(s.id).attempts, "attempt")}.`,
      alternative: "Read the short note for this skill first, then practise.",
      dueDate: null,
    });
  }

  // 5. Spaced-repetition revisions that are due.
  const due = skills
    .filter((s) => !usedSkills.has(s.id) && isRevisionDue(m(s.id), today))
    .sort((a, b) => (m(a.id).nextRevisionAt ?? "").localeCompare(m(b.id).nextRevisionAt ?? ""));
  for (const s of due.slice(0, 2)) {
    usedSkills.add(s.id);
    candidates.push({
      type: "revise",
      skillId: s.id,
      title: `Quick revision: ${s.name}`,
      minutes: 10,
      priority: 6,
      reason: `It's time to revisit "${s.name}" (scheduled for ${m(s.id).nextRevisionAt}) so you don't forget it.`,
      alternative: "Do it tomorrow if today is full; the interval will stay short.",
      dueDate: null,
    });
  }

  // 6. Next new skill in syllabus order that is unassessed and whose prerequisites are not critical gaps.
  const next = [...skills]
    .sort((a, b) => a.position - b.position)
    .find(
      (s) =>
        !usedSkills.has(s.id) &&
        m(s.id).attempts === 0 &&
        s.prerequisites.every((p) => masteryStatus(m(p)) !== "critical_gap" && masteryStatus(m(p)) !== "needs_revision")
    );
  if (next) {
    usedSkills.add(next.id);
    candidates.push({
      type: "learn",
      skillId: next.id,
      title: `Learn: ${next.name}`,
      minutes: Math.min(next.minutes, MAX_BLOCK),
      priority: 7,
      reason: `Next in your syllabus (${next.unitName}); you haven't practised this yet.`,
      alternative: "Pick any skill from the syllabus list if you want to go in a different order.",
      dueDate: null,
    });
  }

  // 7. Challenge for a strong skill.
  const strong = skills.find((s) => !usedSkills.has(s.id) && masteryStatus(m(s.id)) === "strong");
  if (strong) {
    usedSkills.add(strong.id);
    candidates.push({
      type: "challenge",
      skillId: strong.id,
      title: `Challenge: ${strong.name}`,
      minutes: 15,
      priority: 8,
      reason: `You're strong in "${strong.name}" (${Math.round(m(strong.id).score)}%), so try harder questions.`,
      alternative: "Skip it; it's optional enrichment.",
      dueDate: null,
    });
  }

  // Fit to the student's daily limit. Never exceed it (avoids unrealistic schedules).
  candidates.sort((a, b) => a.priority - b.priority);
  const plan: PlannedTask[] = [];
  let used = 0;
  for (const t of candidates) {
    if (used + t.minutes <= dailyMinutes) {
      plan.push(t);
      used += t.minutes;
    } else if (plan.length === 0) {
      // Always include the single most important task, shortened to fit.
      plan.push({ ...t, minutes: Math.max(5, dailyMinutes), reason: t.reason + " (Shortened to fit your daily limit.)" });
      used = dailyMinutes;
    }
  }
  return plan;
}

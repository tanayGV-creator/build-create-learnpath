import { route, body, json } from "@/lib/server";
import { getUser, saveOnboarding } from "@/lib/services";
export const GET = route({ auth: true }, ({ db, userId }) => json({ user: getUser(db, userId) }));
export const PATCH = route({ auth: true }, async ({ db, req, userId, today }) => {
  const b = await body(req);
  saveOnboarding(db, userId, {
    dailyMinutes: Number(b.dailyMinutes), careerGoal: String(b.careerGoal ?? ""), aiConsent: !!b.aiConsent,
    guardianConfirmed: !!b.guardianConfirmed, largeText: !!b.largeText, reducedMotion: !!b.reducedMotion,
  }, today);
  return json({ user: getUser(db, userId) });
});

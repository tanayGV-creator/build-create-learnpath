import { route, json } from "@/lib/server";
import { getOrCreatePlan } from "@/lib/services";
export const GET = route({ auth: true }, ({ db, req, userId, today }) => {
  const regen = new URL(req.url).searchParams.get("regen") === "1";
  return json({ today, tasks: getOrCreatePlan(db, userId, today, regen) });
});

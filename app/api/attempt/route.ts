import { route, body, json } from "@/lib/server";
import { startAttempt, ServiceError } from "@/lib/services";
export const POST = route({ auth: true }, async ({ db, req, userId }) => {
  const b = await body(req);
  if (!["diagnostic", "practice", "test"].includes(b.kind)) throw new ServiceError("Unknown attempt type.");
  return json({ attemptId: startAttempt(db, userId, b.kind) });
});

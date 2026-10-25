import { route, body, json } from "@/lib/server";
import { addHomework } from "@/lib/services";
export const POST = route({ auth: true }, async ({ db, req, userId }) => {
  const b = await body(req);
  return json({ id: addHomework(db, userId, { title: String(b.title ?? ""), minutes: Number(b.minutes), dueDate: String(b.dueDate ?? "") }) }, 201);
});

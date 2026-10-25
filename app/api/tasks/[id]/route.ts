import { route, body, json } from "@/lib/server";
import { updateTask } from "@/lib/services";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return route({ auth: true }, async ({ db, userId, today }) => {
    const b = await body(req);
    updateTask(db, userId, id, b.action, today);
    return json({ ok: true });
  })(req);
}

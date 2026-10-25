import { route, json } from "@/lib/server";
import { finishAttempt } from "@/lib/services";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return route({ auth: true }, ({ db, userId }) => json(finishAttempt(db, userId, id)))(req);
}

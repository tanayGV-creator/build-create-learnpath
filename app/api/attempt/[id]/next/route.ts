import { route, json } from "@/lib/server";
import { nextQuestion } from "@/lib/services";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return route({ auth: true }, ({ db, userId, today }) => {
    const skillId = new URL(req.url).searchParams.get("skillId") ?? undefined;
    return json(nextQuestion(db, userId, id, { skillId, today }));
  })(req);
}

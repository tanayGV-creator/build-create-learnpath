import { route, body, json } from "@/lib/server";
import { submitAnswer } from "@/lib/services";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return route({ auth: true }, async ({ db, userId }) => {
    const b = await body(req);
    return json(submitAnswer(db, userId, id, { questionId: String(b.questionId ?? ""), answer: String(b.answer ?? ""), seconds: Number(b.seconds) }));
  })(req);
}

import { route, body, json } from "@/lib/server";
import { tutorChat } from "@/lib/services";
import { getProvider } from "@/lib/ai/provider";
import { RateLimiter } from "@/lib/auth";
const limiter = new RateLimiter(20, 60_000);
export const POST = route({ auth: true }, async ({ db, req, userId }) => {
  if (!limiter.allow(userId)) return json({ error: "Slow down a little: too many messages per minute." }, 429);
  const b = await body(req);
  const history = Array.isArray(b.history) ? b.history.filter((m: any) => m && typeof m.content === "string") : [];
  const result = await tutorChat(db, getProvider(), userId, { message: String(b.message ?? ""), history }, {
    dailyTokenBudget: Number(process.env.DAILY_TOKEN_BUDGET) || 40000,
  });
  return json(result);
});

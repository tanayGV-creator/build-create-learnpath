import { route, json } from "@/lib/server";
import { getProgress } from "@/lib/services";
export const GET = route({ auth: true }, ({ db, userId, today }) => json(getProgress(db, userId, today)));

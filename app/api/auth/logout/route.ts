import { route, json, clearCookie } from "@/lib/server";
export const POST = route({ auth: false }, () => json({ ok: true }, 200, { "set-cookie": clearCookie() }));

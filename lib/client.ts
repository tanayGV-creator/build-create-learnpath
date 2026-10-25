// Browser-side helpers. Do not import server modules here.
export function localDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", "x-client-date": localDate() },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login") && location.pathname !== "/" && !location.pathname.startsWith("/register")) {
    location.href = "/login";
  }
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

export const STATUS_STYLE: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-900",
  developing: "bg-sky-100 text-sky-900",
  needs_revision: "bg-amber-100 text-amber-900",
  critical_gap: "bg-rose-100 text-rose-900",
  not_assessed: "bg-slate-100 text-slate-700",
};

"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { api, STATUS_STYLE } from "@/lib/client";

export default function Progress() {
  const [p, setP] = useState<any>(null);
  useEffect(() => { api("/api/progress").then(setP); }, []);
  if (!p) return (<><Nav /><p className="p-6">Loading…</p></>);
  const units: Record<string, any[]> = {};
  p.skills.forEach((s: any) => (units[s.unit] ??= []).push(s));
  const labels: [string, string][] = [["strong", "Strong"], ["developing", "Developing"], ["needs_revision", "Needs revision"], ["critical_gap", "Critical gap"], ["not_assessed", "Not yet assessed"]];
  return (<><Nav /><main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <h1 className="text-2xl font-bold">Your progress</h1>
    <section className="card" aria-label="Summary">
      <ul className="flex flex-wrap gap-2">{labels.map(([k, l]) => <li key={k} className={`rounded-lg px-3 py-2 ${STATUS_STYLE[k]}`}><strong>{p.counts[k]}</strong> {l}</li>)}</ul>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><dt className="text-slate-600">Questions answered</dt><dd className="text-lg font-semibold">{p.totals.answered}</dd></div>
        <div><dt className="text-slate-600">Accuracy</dt><dd className="text-lg font-semibold">{p.totals.accuracy === null ? "—" : `${p.totals.accuracy}%`}</dd></div>
        <div><dt className="text-slate-600">Active days (last 7)</dt><dd className="text-lg font-semibold">{p.consistency.activeDaysLast7}</dd></div>
        <div><dt className="text-slate-600">Tasks done (last 7 days)</dt><dd className="text-lg font-semibold">{p.tasksLast7.done}/{p.tasksLast7.planned}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-slate-600">Mastery is estimated from your own answers. "Not yet assessed" means we haven't seen you try it, not that it's hard.</p>
    </section>
    {Object.entries(units).map(([unit, skills]) => (
      <section key={unit} className="card" aria-labelledby={unit}><h2 id={unit} className="text-lg font-semibold">{unit}</h2>
        <ul className="mt-3 space-y-2">{skills.map((s: any) => (
          <li key={s.skillId} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span>{s.name}</span><span className={`rounded px-2 py-1 text-sm ${STATUS_STYLE[s.status]}`}>{s.statusLabel}</span></div>
            {s.measured && <div className="mt-2"><div className="h-2 rounded bg-slate-200" role="img" aria-label={`Estimated mastery ${s.score} percent`}><div className="h-2 rounded bg-blue-700" style={{ width: `${s.score}%` }} /></div>
              <p className="mt-1 text-sm text-slate-600">~{s.score}% · based on {s.attempts} answer{s.attempts === 1 ? "" : "s"}{s.attempts < 3 ? " (still a rough estimate)" : ""}{s.nextRevisionAt ? ` · revise by ${s.nextRevisionAt}` : ""}</p></div>}
          </li>))}</ul></section>))}
  </main></>);
}

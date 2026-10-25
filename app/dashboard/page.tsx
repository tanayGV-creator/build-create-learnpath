"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { api, localDate } from "@/lib/client";

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [prog, setProg] = useState<any>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async (regen = false) => {
    try {
      const [p, e, pr] = await Promise.all([api(`/api/plan${regen ? "?regen=1" : ""}`), api("/api/exams"), api("/api/progress")]);
      setTasks(p.tasks); setExams(e.exams); setProg(pr);
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (id: string, action: string) => { await api(`/api/tasks/${id}`, { method: "PATCH", body: { action } }); load(); };
  const pending = tasks.filter((t) => t.status === "pending");
  const total = tasks.reduce((s, t) => s + t.minutes, 0);

  async function addHw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try { await api("/api/homework", { body: { title: f.get("title"), minutes: Number(f.get("minutes")), dueDate: f.get("dueDate") } }); (e.target as HTMLFormElement).reset(); load(true); }
    catch (e: any) { setErr(e.message); }
  }
  async function addExam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try { await api("/api/exams", { body: { title: f.get("title"), examDate: f.get("examDate") } }); (e.target as HTMLFormElement).reset(); load(true); }
    catch (e: any) { setErr(e.message); }
  }
  return (<><Nav /><main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header><h1 className="text-2xl font-bold">Today</h1><p className="text-slate-600">{localDate()} · {total} min planned</p></header>
    {err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">{err}</p>}
    {prog && prog.totals.answered === 0 && <div className="card border-blue-300 bg-blue-50"><p>You haven't done the quick check yet. <Link className="underline font-medium" href="/diagnostic">Take it now</Link> so your plan can be based on what you know.</p></div>}
    <section aria-labelledby="plan">
      <div className="mb-2 flex items-center justify-between"><h2 id="plan" className="text-lg font-semibold">Your plan</h2>
        <button className="btn btn-ghost" onClick={() => load(true)}>Refresh suggestions</button></div>
      {tasks.length === 0 ? <p className="card">Nothing planned. Add homework or an exam below, or take the quick check.</p> : (
        <ul className="space-y-3">{tasks.map((t) => (
          <li key={t.id} className={`card ${t.status === "done" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className={`font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title} <span className="text-sm font-normal text-slate-600">· {t.minutes} min</span></p>
                <p className="mt-1 text-slate-700"><span className="font-medium">Why:</span> {t.reason}</p>
                <p className="mt-1 text-sm text-slate-600">Instead: {t.alternative}</p></div>
              <div className="flex flex-wrap gap-2">
                {t.status === "pending" ? (<>
                  {t.skillId && <Link href={`/practice?skill=${t.skillId}`} className="btn btn-primary">Start</Link>}
                  <button className="btn btn-ghost" onClick={() => act(t.id, "done")}>Done</button>
                  <button className="btn btn-ghost" onClick={() => act(t.id, "postpone")}>Tomorrow</button>
                  <button className="btn btn-ghost" onClick={() => act(t.id, "delete")} aria-label={`Remove ${t.title}`}>Remove</button>
                </>) : <button className="btn btn-ghost" onClick={() => act(t.id, "undo")}>Undo</button>}
              </div></div></li>))}</ul>)}
      {pending.length === 0 && tasks.length > 0 && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-900">All done for today. Rest is part of learning.</p>}
    </section>
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card" aria-labelledby="hw"><h2 id="hw" className="text-lg font-semibold">Add homework</h2>
        <form onSubmit={addHw} className="mt-3 space-y-3">
          <div><label className="label" htmlFor="hwt">What is it?</label><input id="hwt" name="title" className="input" required maxLength={100} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="hwm">Minutes</label><input id="hwm" name="minutes" type="number" min={5} max={180} defaultValue={30} className="input" /></div>
            <div><label className="label" htmlFor="hwd">Due date</label><input id="hwd" name="dueDate" type="date" className="input" required /></div></div>
          <button className="btn btn-primary">Add</button></form></section>
      <section className="card" aria-labelledby="ex"><h2 id="ex" className="text-lg font-semibold">Exams and tests</h2>
        <ul className="mt-2 space-y-1">{exams.map((e) => <li key={e.id}>{e.title}: <strong>{e.daysLeft === 0 ? "today" : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"}`}</strong>
          {prog && (() => { const x = prog.exams.find((p: any) => p.id === e.id); return x ? <span className="text-sm text-slate-600"> · {x.skillsAssessed}/{x.skillsTotal} skills assessed{x.avgMastery !== null ? `, avg ${x.avgMastery}%` : ""}</span> : null; })()}</li>)}
          {exams.length === 0 && <li className="text-slate-600">None yet.</li>}</ul>
        <form onSubmit={addExam} className="mt-3 space-y-3">
          <div><label className="label" htmlFor="et">Name</label><input id="et" name="title" className="input" required placeholder="Unit test: Quadratic Equations" /></div>
          <div><label className="label" htmlFor="ed">Date</label><input id="ed" name="examDate" type="date" className="input" required /></div>
          <button className="btn btn-primary">Add exam</button></form></section>
    </div>
    <p className="text-sm text-slate-600">Want a longer test? <Link className="underline" href="/test">Take a timed mock test</Link>.</p>
  </main></>);
}

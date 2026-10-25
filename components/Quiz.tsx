"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, STATUS_STYLE } from "@/lib/client";

type Q = { id: string; type: "mcq" | "numeric" | "short"; text: string; options: string[] | null; difficulty: string };

export default function Quiz({ kind, skillId }: { kind: "diagnostic" | "practice" | "test"; skillId?: string }) {
  const [attempt, setAttempt] = useState<string>("");
  const [q, setQ] = useState<Q | null>(null);
  const [progress, setProgress] = useState<{ answered: number; total: number | null }>({ answered: 0, total: null });
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t0 = useRef(Date.now());
  const graded = kind !== "practice";

  async function load(id: string) {
    const r = await api(`/api/attempt/${id}/next${skillId ? `?skillId=${skillId}` : ""}`);
    if (r.done) return finish(id);
    setQ(r.question); setProgress(r.progress); setAnswer(""); setFb(null); t0.current = Date.now();
  }
  async function finish(id = attempt) {
    const r = await api(`/api/attempt/${id}/finish`, { body: {} });
    setResult(r); setQ(null);
  }
  useEffect(() => {
    (async () => {
      try { const { attemptId } = await api("/api/attempt", { body: { kind } }); setAttempt(attemptId); await load(attemptId); }
      catch (e: any) { setErr(e.message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!q || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api(`/api/attempt/${attempt}/answer`, { body: { questionId: q.id, answer, seconds: (Date.now() - t0.current) / 1000 } });
      if (graded) await load(attempt); else setFb(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (err && !q && !result) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">{err}</p>;
  if (result) return <Results r={result} kind={kind} />;
  if (!q) return <p>Loading…</p>;
  return (
    <section aria-labelledby="qtext" className="card">
      <p className="text-sm text-slate-600">
        Question {progress.answered + 1}{progress.total ? ` of ${progress.total}` : ""} · {q.difficulty}
        {graded && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">Graded · tutor is off</span>}
      </p>
      <form onSubmit={submit} className="mt-3 space-y-4">
        <fieldset disabled={!!fb || busy}>
          <legend id="qtext" className="text-lg font-medium">{q.text}</legend>
          {q.type === "mcq" ? (
            <div className="mt-3 space-y-2">
              {q.options!.map((o, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 p-3 min-h-[44px] has-[:checked]:border-blue-700 has-[:checked]:bg-blue-50">
                  <input type="radio" name="opt" value={String(i)} checked={answer === String(i)} onChange={() => setAnswer(String(i))} className="h-5 w-5" /> {o}
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-3"><label className="label" htmlFor="ans">Your answer</label>
              <input id="ans" className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode={q.type === "numeric" ? "decimal" : "text"} autoComplete="off" /></div>
          )}
        </fieldset>
        {err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">{err}</p>}
        {!fb && <div className="flex flex-wrap gap-3"><button className="btn btn-primary" disabled={busy || answer === ""}>{graded ? "Submit and continue" : "Check answer"}</button>
          {!graded && <button type="button" className="btn btn-ghost" onClick={() => finish()}>Finish practice</button>}</div>}
      </form>
      {fb && (
        <div role="status" className={`mt-4 rounded-lg p-4 ${fb.correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          <p className="font-semibold">{fb.correct ? "Correct!" : "Not quite."}</p>
          {!fb.correct && <p>Correct answer: {fb.correctAnswer}</p>}
          {!fb.correct && fb.misconception && <p className="mt-1 text-sm">Common slip: {String(fb.misconception).replace(/-/g, " ")}.</p>}
          <p className="mt-2">{fb.explanation}</p>
          <div className="mt-3 flex gap-3"><button className="btn btn-primary" onClick={() => load(attempt)}>Next question</button>
            <button className="btn btn-ghost" onClick={() => finish()}>Finish</button></div>
        </div>
      )}
    </section>
  );
}

function Results({ r, kind }: { r: any; kind: string }) {
  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-xl font-bold">{kind === "diagnostic" ? "Here's where you are now" : "Nice work"}</h2>
        <p className="mt-1">You answered {r.answered} question{r.answered === 1 ? "" : "s"} · {r.accuracy}% correct · {r.score}/{r.total} marks.</p>
        <p className="mt-1 text-sm text-slate-600">These are estimates from only a few answers per skill. They'll get more reliable as you practise.</p>
        <ul className="mt-4 space-y-2">
          {r.skills.map((s: any) => (
            <li key={s.skillId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <span>{s.name}</span><span className={`rounded px-2 py-1 text-sm ${STATUS_STYLE[s.status]}`}>{s.statusLabel}</span>
            </li>))}
        </ul>
      </section>
      {r.review.length > 0 && (
        <section className="card"><h3 className="text-lg font-semibold">Review your mistakes</h3>
          <ul className="mt-3 space-y-4">{r.review.map((v: any, i: number) => (
            <li key={i}><p className="font-medium">{v.question}</p><p className="text-sm">You answered: {v.yourAnswer || "—"} · Correct: {v.correctAnswer}</p>
              {v.misconception && <p className="text-sm text-amber-900">Common slip: {String(v.misconception).replace(/-/g, " ")}</p>}
              <p className="mt-1 text-slate-700">{v.explanation}</p></li>))}</ul></section>)}
      <Link href="/dashboard" className="btn btn-primary">See today's plan</Link>
    </div>
  );
}

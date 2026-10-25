"use client";
import { useRef, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { api } from "@/lib/client";

type Msg = { role: "user" | "assistant"; content: string; sources?: any[]; note?: string };

export default function Tutor() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); const m = text.trim(); if (!m || busy) return;
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((x) => [...x, { role: "user", content: m }]); setText(""); setBusy(true);
    try {
      const r = await api("/api/tutor", { body: { message: m, history } });
      const note = r.blocked ? undefined : r.simulated ? "Mock tutor: no AI key is configured, so this is not a real AI answer."
        : r.noApprovedContext ? "Not found in the approved notes. Double-check this with your textbook or teacher." : undefined;
      setMsgs((x) => [...x, { role: "assistant", content: r.reply, sources: r.sources, note }]);
    } catch (e: any) { setMsgs((x) => [...x, { role: "assistant", content: e.message }]); } finally { setBusy(false); }
  }
  return (<><Nav /><main id="main" className="mx-auto flex max-w-2xl flex-col px-4 py-8">
    <h1 className="text-2xl font-bold">Tutor</h1>
    <p className="mb-4 text-slate-700">Ask about a concept or a step you're stuck on. I'll give hints and ask questions so you can work it out. AI can make mistakes, so check important things with your teacher or textbook.</p>
    <div className="card min-h-[320px] space-y-4" aria-live="polite">
      {msgs.length === 0 && <p className="text-slate-600">Try: "How do I know when to use the quadratic formula?"</p>}
      {msgs.map((m, i) => (
        <div key={i} className={m.role === "user" ? "text-right" : ""}>
          <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-xl px-4 py-3 text-left ${m.role === "user" ? "bg-blue-700 text-white" : "bg-slate-100"}`}>{m.content}</div>
          {m.note && <p className="mt-1 text-sm text-amber-900">{m.note}</p>}
          {m.sources && m.sources.length > 0 && <p className="mt-1 text-sm text-slate-600">Sources: {m.sources.map((s) => `[${s.label}] ${s.title}`).join(" · ")}</p>}
        </div>))}
      {busy && <p className="text-slate-600">Thinking…</p>}
      <div ref={end} />
    </div>
    <form onSubmit={send} className="mt-4 flex gap-2"><label htmlFor="msg" className="sr-only">Your question</label>
      <input id="msg" className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type your question…" autoComplete="off" />
      <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button></form>
  </main></>);
}

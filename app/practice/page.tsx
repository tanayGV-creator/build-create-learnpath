"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Quiz from "@/components/Quiz";
import { api } from "@/lib/client";

export default function Practice() {
  const [skills, setSkills] = useState<any[]>([]);
  const [pick, setPick] = useState<string | null>(null); // "" = recommended
  useEffect(() => {
    api("/api/progress").then((p) => setSkills(p.skills));
    const s = new URLSearchParams(location.search).get("skill");
    if (s) setPick(s);
  }, []);
  return (<><Nav /><main id="main" className="mx-auto max-w-2xl px-4 py-8">
    <h1 className="mb-4 text-2xl font-bold">Practice</h1>
    {pick === null ? (
      <div className="space-y-3">
        <button className="btn btn-primary w-full" onClick={() => setPick("")}>Practise what's recommended for me</button>
        <p className="text-sm text-slate-600">Or choose a skill:</p>
        <ul className="space-y-2">{skills.map((s) => (
          <li key={s.skillId}><button className="btn btn-ghost w-full !justify-between text-left" onClick={() => setPick(s.skillId)}><span>{s.name}</span><span className="text-sm text-slate-600">{s.statusLabel}</span></button></li>))}</ul>
      </div>
    ) : <Quiz key={pick} kind="practice" skillId={pick || undefined} />}
  </main></>);
}

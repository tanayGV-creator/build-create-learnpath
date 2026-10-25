"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api } from "@/lib/client";

export default function Onboarding() {
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [err, setErr] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => { api("/api/me").then((r) => setU(r.user)); }, []);
  if (!u) return <p className="p-6">Loading…</p>;
  const born = u.dateOfBirth as string | null;
  const age = born ? Math.floor((Date.now() - Date.parse(born)) / 31_557_600_000) : 0;
  const minor = age < 18;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setSaved(false);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/me", { method: "PATCH", body: {
        dailyMinutes: Number(f.get("dailyMinutes")), careerGoal: f.get("careerGoal"), aiConsent: f.get("aiConsent") === "on",
        guardianConfirmed: f.get("guardianConfirmed") === "on", largeText: f.get("largeText") === "on", reducedMotion: f.get("reducedMotion") === "on",
      } });
      setSaved(true);
      if (!u.onboarded) router.push("/diagnostic");
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold">{u.onboarded ? "Settings" : `Welcome, ${u.fullName}`}</h1>
        {!u.onboarded && <p className="mt-2 text-slate-700">A few quick choices, then a short check of where you are now (about 14 questions). It's not a grade; it just helps us suggest what to do first.</p>}
        <form onSubmit={save} className="card mt-6 space-y-5">
          <div><label className="label" htmlFor="dm">How many minutes can you study on a normal day?</label>
            <input id="dm" name="dailyMinutes" type="number" min={15} max={240} step={5} defaultValue={u.dailyMinutes} className="input" required />
            <p className="mt-1 text-sm text-slate-600">Your plan will never go over this.</p></div>
          <div><label className="label" htmlFor="cg">What would you like to become? (optional)</label>
            <input id="cg" name="careerGoal" defaultValue={u.careerGoal ?? ""} maxLength={120} className="input" placeholder="e.g. a scientist" /></div>
          <fieldset className="space-y-3">
            <legend className="label">AI tutor</legend>
            <label className="flex items-start gap-3"><input type="checkbox" name="aiConsent" defaultChecked={!!u.aiConsent} className="mt-1 h-5 w-5" />
              <span>I'd like to use the AI tutor. My questions (without my name or email) are sent to an AI service to get answers.</span></label>
            {minor && <label className="flex items-start gap-3"><input type="checkbox" name="guardianConfirmed" defaultChecked={!!u.guardianConfirmed} className="mt-1 h-5 w-5" />
              <span>A parent or guardian has agreed to this. <em className="text-sm text-slate-600">(Since you're under 18, the tutor stays off without this.)</em></span></label>}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="label">Comfort</legend>
            <label className="flex items-center gap-3"><input type="checkbox" name="largeText" defaultChecked={!!u.largeText} className="h-5 w-5" /> Larger text</label>
            <label className="flex items-center gap-3"><input type="checkbox" name="reducedMotion" defaultChecked={!!u.reducedMotion} className="h-5 w-5" /> Reduce motion</label>
          </fieldset>
          {err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">{err}</p>}
          {saved && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">Saved.</p>}
          <button className="btn btn-primary w-full">{u.onboarded ? "Save settings" : "Continue to quick check"}</button>
        </form>
      </main>
    </>
  );
}

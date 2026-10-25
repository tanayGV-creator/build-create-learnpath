import Link from "next/link";
export default function Landing() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-900">LearnPath</h1>
      <p className="mt-4 text-lg text-slate-700">A study companion that knows what you've mastered, what's coming up, and what to do next, and always tells you why.</p>
      <ul className="mt-8 space-y-3 text-slate-800">
        <li className="card"><strong>A plan you control.</strong> Daily tasks that fit your time. Edit, postpone or delete anything.</li>
        <li className="card"><strong>Honest progress.</strong> Mastery comes from your own answers. Skills you haven't tried say "not yet assessed".</li>
        <li className="card"><strong>A tutor that teaches.</strong> It gives hints, not answers, and switches off during graded tests.</li>
      </ul>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn btn-primary">Create account</Link>
        <Link href="/login" className="btn btn-ghost">Sign in</Link>
      </div>
      <p className="mt-10 text-sm text-slate-600">Prototype: CBSE Class 10 Maths demo content only. Questions and notes have not been reviewed by a teacher.</p>
    </main>
  );
}

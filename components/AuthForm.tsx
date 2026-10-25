"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${mode}`, { body: Object.fromEntries(f) });
      if (mode === "register") router.push("/onboarding");
      else {
        const me = await api("/api/me");
        router.push(me.user.onboarded ? "/dashboard" : "/onboarding");
      }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4" noValidate>
        {mode === "register" && (
          <>
            <div><label className="label" htmlFor="fullName">First name</label><input id="fullName" name="fullName" className="input" required autoComplete="given-name" /></div>
            <div><label className="label" htmlFor="dob">Date of birth</label><input id="dob" name="dateOfBirth" type="date" className="input" required /></div>
          </>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="pw">Password</label><input id="pw" name="password" type="password" className="input" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <p className="mt-1 text-sm text-slate-600">At least 8 characters, with letters and a number.</p>}</div>
        {err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-900">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-4 text-sm">{mode === "login" ? <>New here? <Link className="underline" href="/register">Create an account</Link></> : <>Already registered? <Link className="underline" href="/login">Sign in</Link></>}</p>
    </main>
  );
}

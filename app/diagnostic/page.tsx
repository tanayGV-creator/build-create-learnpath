"use client";
import Nav from "@/components/Nav";
import Quiz from "@/components/Quiz";
export default function Page() {
  return (<><Nav /><main id="main" className="mx-auto max-w-2xl px-4 py-8">
    <h1 className="mb-1 text-2xl font-bold">Quick check</h1>
    <p className="mb-4 text-slate-700">Do your best without help. If you don't know, take a guess or move on; that tells us where to start.</p>
    <Quiz kind="diagnostic" /></main></>);
}

"use client";
import Nav from "@/components/Nav";
import Quiz from "@/components/Quiz";
export default function Page() {
  return (<><Nav /><main id="main" className="mx-auto max-w-2xl px-4 py-8">
    <h1 className="mb-1 text-2xl font-bold">Mock test</h1>
    <p className="mb-4 text-slate-700">This is a graded test: no hints and the tutor is off until you finish. You'll get full explanations at the end.</p>
    <Quiz kind="test" /></main></>);
}

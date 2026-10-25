"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/practice", label: "Practice" },
  { href: "/tutor", label: "Tutor" },
  { href: "/progress", label: "Progress" },
  { href: "/onboarding", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  useEffect(() => {
    api("/api/me").then((r) => {
      setName(r.user.fullName);
      document.documentElement.classList.toggle("large-text", !!r.user.largeText);
      document.documentElement.classList.toggle("reduce-motion", !!r.user.reducedMotion);
    }).catch(() => {});
  }, []);
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-2">
        <span className="mr-3 font-semibold text-blue-800">LearnPath</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm min-h-[44px] flex items-center ${path === l.href ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700 hover:bg-slate-100"}`}>
            {l.label}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          {name}
          <button className="btn btn-ghost !py-1" onClick={async () => { await api("/api/auth/logout", { body: {} }); router.push("/"); }}>Sign out</button>
        </span>
      </nav>
    </header>
  );
}

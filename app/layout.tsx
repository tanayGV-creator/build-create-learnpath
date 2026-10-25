import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "LearnPath", description: "A personal study companion that shows you what to do next, and why." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2">Skip to content</a>
        {children}
      </body>
    </html>
  );
}

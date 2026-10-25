# LearnPath: AI study companion (prototype)

A student sees today's plan with a **reason for every task**, practises with instant feedback, sees honest mastery estimates, and can ask an AI tutor that gives hints and switches off during graded tests.

Content: **CBSE Class 10 Maths demo only** (Quadratic Equations, Arithmetic Progressions; 14 skills, 40 questions). It was written for this prototype and has **not been reviewed by a teacher** or checked against NCERT. Do not use it with real students until it is reviewed.

## Run it (beginner steps)

1. Install **Node.js 22.18 or newer** from https://nodejs.org (check with `node -v`).
2. In this folder, run: `npm install`
3. Copy the settings file: `cp .env.example .env.local`
4. Make a secret and paste it after `SESSION_SECRET=` in `.env.local`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. Create the database and a demo student: `npm run seed`
6. Start the app: `npm run dev`, then open http://localhost:3000
   Demo login: `robin@example.com` / `demo12345`
7. Run the tests any time: `npm test`

### Turn on the real AI tutor
Get an API key at https://console.anthropic.com, put it in `.env.local` as `ANTHROPIC_API_KEY=...`, and restart. The model defaults to `claude-sonnet-5-5` (change with `ANTHROPIC_MODEL`). **Without a key the tutor is a mock** and every mock reply is labelled "MOCK TUTOR". The key is only read on the server.

## What is implemented
- Accounts (scrypt passwords, signed HttpOnly cookie sessions, login rate limit, CSRF checks)
- Onboarding: daily minutes, interest, AI consent (under-18 also needs a guardian checkbox), larger text, reduced motion
- 14-question adaptive diagnostic; practice with instant feedback; graded mock test (no per-question feedback until finished, then full review)
- Mastery per skill (explainable formula in `lib/engine/mastery.ts`), spaced repetition, forgetting decay, statuses: Strong / Developing / Needs revision / Critical gap / Not yet assessed
- Rule-based planner (`lib/engine/planner.ts`): homework, exams within 7 days, prerequisite gaps, weak skills, due revisions, next topic, challenge. Never exceeds your daily minutes. Each task shows **why** and an alternative. Done / tomorrow / remove / undo.
- Tutor: keyword retrieval over approved notes with [S1] citations, hint-first prompt, direct-answer detection, off while a graded attempt is in progress, name/email/phone never sent, self-harm messages answered with a fixed supportive reply instead of the model, daily token budget, every interaction logged
- Progress page with coverage ("3 of 14 skills assessed") rather than one score

## Not built yet (be clear with yourself and your users)
Parent and teacher roles/dashboards, admin panel, notifications, question authoring/review workflow, AI-generated questions, long-answer rubric grading, flashcards, career roadmap beyond a stored interest, document upload, embeddings/pgvector search, Science and other subjects/boards, multiple languages, voice, mobile app. Retention/deletion/export of student data is not implemented.

## Verified vs not verified
**Verified (automated, `npm test`, 38 tests):** mastery, spaced repetition, quiz scoring, planner rules, diagnostic adaptation, answer keys (recomputed independently), the full register → diagnostic → mastery → plan flow on an in-memory database, tutor locking/consent/safety/budget gates, data isolation between students, session signing, CSRF/auth wrapper, and the Anthropic request/response handling **against a mocked fetch**.

**Not verified:** the Next.js build (`npm run build`) and the pages themselves. I could not install packages in my workspace, so the screens and API route files were only syntax-checked and their imports cross-checked, never run in a browser. Expect to fix a few small type or layout errors on the first run; send me the output and I'll fix them. A **live call to the Claude API** has also not been made. `better-sqlite3` has not been run here either (tests use Node's built-in SQLite, which has the same calls).

## Decisions that differ from the earlier proposal
SQLite (via `better-sqlite3`) instead of PostgreSQL+Prisma, and keyword retrieval instead of pgvector, so it runs with zero setup. All database access goes through the small `Db` interface in `lib/db.ts`, so moving to PostgreSQL later is contained work.

## Before real students use it
- Teacher review of all content; replace the demo set.
- Legal review for minors' data (e.g. India's DPDP Act requires verifiable parental consent; the guardian checkbox here is only a placeholder).
- Define retention for the stored tutor chats; add data export and deletion.
- Replace the in-memory rate limiter (use Redis) and add monitoring.
- Test with real students: does mastery predict real exam results? Is the tutor's hinting actually helping? Do not claim learning gains until measured.

## Layout
`lib/engine/*` pure logic · `lib/services.ts` application logic · `lib/ai/*` provider + tutor guardrails · `lib/content/*` demo curriculum · `app/api/*` routes · `app/*` pages

// Minimal DB interface shared by better-sqlite3 (app) and node:sqlite (tests).
// Use positional parameters only so both drivers behave the same.
export interface Db {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','parent','admin')),
  full_name TEXT NOT NULL,
  date_of_birth TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  grade TEXT,
  board TEXT DEFAULT 'CBSE',
  daily_study_minutes INTEGER NOT NULL DEFAULT 60,
  career_goal TEXT,
  ai_consent INTEGER NOT NULL DEFAULT 0,
  guardian_confirmed INTEGER NOT NULL DEFAULT 0,
  onboarded INTEGER NOT NULL DEFAULT 0,
  reduced_motion INTEGER NOT NULL DEFAULT 0,
  large_text INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  grade TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  name TEXT NOT NULL,
  objective TEXT,
  position INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 20,
  prerequisites TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'DEMO_UNREVIEWED'
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  type TEXT NOT NULL CHECK (type IN ('mcq','numeric','short')),
  text TEXT NOT NULL,
  options TEXT,
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  marks INTEGER NOT NULL DEFAULT 1,
  expected_seconds INTEGER NOT NULL DEFAULT 60,
  distractor_tags TEXT,
  review_status TEXT NOT NULL DEFAULT 'DEMO_UNREVIEWED'
);

CREATE TABLE IF NOT EXISTS mastery (
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  score REAL NOT NULL DEFAULT 50,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  avg_seconds REAL NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  last_practised_at TEXT,
  next_revision_at TEXT,
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnostic','practice','test')),
  graded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  started_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  skill_id TEXT NOT NULL,
  answer TEXT,
  is_correct INTEGER NOT NULL,
  seconds REAL NOT NULL,
  misconception TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  type TEXT NOT NULL,
  skill_id TEXT,
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','postponed','deleted')),
  source TEXT NOT NULL DEFAULT 'system',
  reason TEXT NOT NULL,
  alternative TEXT,
  due_date TEXT,
  homework_id TEXT
);

CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 30,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done'))
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  exam_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  provider TEXT NOT NULL,
  simulated INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  context_refs TEXT,
  flags TEXT
);

CREATE INDEX IF NOT EXISTS idx_resp_student ON responses(student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_tasks_student_date ON tasks(student_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_ai_student_date ON ai_interactions(student_id, created_at);
`;

export function migrate(db: Db): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
}

let counter = 0;
export function newId(prefix = ""): string {
  counter = (counter + 1) % 1_000_000;
  const rand = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return prefix + rand + counter.toString(36);
}

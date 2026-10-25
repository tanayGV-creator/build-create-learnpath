// Usage: npm run seed   (creates the database and loads the demo content + demo account)
import { openAppDb } from "../lib/db-node.ts";
import { seedContent } from "../lib/content/cbse10-maths.ts";
import { registerStudent, saveOnboarding } from "../lib/services.ts";

const db = openAppDb();
seedContent(db); // idempotent (INSERT OR REPLACE)
const email = "robin@example.com";
if (!db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) {
  const id = registerStudent(db, { email, password: "demo12345", fullName: "Robin (demo)", dateOfBirth: "2010-06-15" });
  saveOnboarding(db, id, { dailyMinutes: 60, careerGoal: "Become a scientist", aiConsent: true, guardianConfirmed: true });
  console.log("Created demo student: robin@example.com / demo12345");
}
console.log("Database ready.");

import { route, body, json } from "@/lib/server";
import { addExam, listExams } from "@/lib/services";
export const GET = route({ auth: true }, ({ db, userId, today }) => json({ exams: listExams(db, userId, today) }));
export const POST = route({ auth: true }, async ({ db, req, userId }) => {
  const b = await body(req);
  return json({ id: addExam(db, userId, { title: String(b.title ?? ""), examDate: String(b.examDate ?? ""), subjectId: String(b.subjectId ?? "cbse-10-maths") }) }, 201);
});

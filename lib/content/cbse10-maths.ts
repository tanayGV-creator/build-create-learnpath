// DEMO CONTENT. Written for this prototype and NOT reviewed by a teacher or checked against
// the official CBSE syllabus/NCERT text. Every item is stored with review_status 'DEMO_UNREVIEWED'.
// Replace/extend through a reviewed content pipeline before real students use it.
import type { Db } from "../db.ts";

export type Diff = "easy" | "medium" | "hard";

export interface SeedSkill {
  id: string;
  unit: "quadratic" | "ap";
  name: string;
  objective: string;
  prerequisites: string[];
  minutes: number;
  note: string;
}

export interface SeedQuestion {
  id: string;
  skill: string;
  type: "mcq" | "numeric";
  text: string;
  options?: string[];
  answer: string; // mcq: option index; numeric: number
  explanation: string;
  difficulty: Diff;
  expectedSeconds: number;
  tags?: Record<string, string>;
}

export const SUBJECT_ID = "cbse-10-maths";

export const SKILLS: SeedSkill[] = [
  { id: "q1", unit: "quadratic", name: "Identify standard form ax² + bx + c = 0", objective: "Recognise quadratic equations and name a, b, c.", prerequisites: [], minutes: 15,
    note: "A quadratic equation has the highest power of x equal to 2. Its standard form is ax² + bx + c = 0 where a, b and c are real numbers and a is not zero. To put an equation in standard form, move every term to one side so the other side is 0, and keep the signs when you move terms. For 3x² − 7x + 2 = 0 we have a = 3, b = −7, c = 2. Notice b is −7, not 7: the sign belongs to the coefficient." },
  { id: "q2", unit: "quadratic", name: "Check whether a value is a root", objective: "Substitute a value to test whether it satisfies an equation.", prerequisites: ["q1"], minutes: 15,
    note: "A root of a quadratic equation is a value of x that makes the equation true. To test a value, substitute it for x and check whether the left side becomes 0. For example, x = 2 in x² − 5x + 6: 4 − 10 + 6 = 0, so 2 is a root. If a root is known and a coefficient is missing, substitute the root and solve the resulting linear equation for the missing coefficient." },
  { id: "q3", unit: "quadratic", name: "Solve by factorisation", objective: "Split the middle term and use the zero-product rule.", prerequisites: ["q1", "q2"], minutes: 25,
    note: "To solve ax² + bx + c = 0 by factorisation, find two numbers whose product is a times c and whose sum is b. Use them to split the middle term, then group terms to factor. By the zero-product rule, if (x − p)(x − q) = 0 then x = p or x = q. For x² − 5x + 6: the numbers are −2 and −3, so (x − 2)(x − 3) = 0 and the roots are 2 and 3. Watch the signs: the factor (x + 4) gives the root −4." },
  { id: "q4", unit: "quadratic", name: "Solve by completing the square", objective: "Rewrite x² + bx as a perfect square plus a constant.", prerequisites: ["q3"], minutes: 25,
    note: "To complete the square for x² + bx, add (b/2)². For x² + 6x add 9 to get (x + 3)². To solve x² − 4x − 5 = 0, first move the constant: x² − 4x = 5. Add (4/2)² = 4 to both sides: x² − 4x + 4 = 9, so (x − 2)² = 9. Then x − 2 = ±3, giving x = 5 or x = −1." },
  { id: "q5", unit: "quadratic", name: "Use the quadratic formula", objective: "Apply x = (−b ± √(b² − 4ac)) / 2a correctly.", prerequisites: ["q3"], minutes: 25,
    note: "For ax² + bx + c = 0 the roots are x = (−b ± √(b² − 4ac)) / 2a. Identify a, b and c with their signs first. Compute b² − 4ac, take the square root, then divide the whole numerator by 2a. For x² + 2x − 2 = 0: a = 1, b = 2, c = −2, so b² − 4ac = 4 + 8 = 12 and x = (−2 ± √12)/2 = −1 ± √3. A common slip is forgetting that −b changes the sign of b, or dividing only part of the numerator by 2a." },
  { id: "q6", unit: "quadratic", name: "Interpret the discriminant", objective: "Use D = b² − 4ac to decide the nature of the roots.", prerequisites: ["q5"], minutes: 20,
    note: "The discriminant is D = b² − 4ac. If D > 0 there are two distinct real roots. If D = 0 there are two equal real roots. If D < 0 there are no real roots. For equal roots, set D = 0 and solve for the unknown. For x² − 6x + 9: D = 36 − 36 = 0, so the roots are real and equal." },
  { id: "q7", unit: "quadratic", name: "Form equations from word problems", objective: "Translate a situation into a quadratic equation.", prerequisites: ["q1"], minutes: 20,
    note: "Choose a letter for the unknown and write what it stands for. Express the other quantities using it, then write the relationship given in the problem. For two consecutive integers with product 56, let the smaller be x, so the larger is x + 1, and x(x + 1) = 56, which is x² + x − 56 = 0. For a rectangle with length 3 more than the breadth x and area 40, x(x + 3) = 40." },
  { id: "q8", unit: "quadratic", name: "Solve word problems with quadratics", objective: "Solve the formed equation and interpret the answer.", prerequisites: ["q7", "q5"], minutes: 30,
    note: "After forming the equation, solve it by factorisation or the formula. Then check which root makes sense: lengths, ages and speeds cannot be negative. For x² + 3x − 40 = 0 we get (x + 8)(x − 5) = 0, so x = −8 or x = 5, and a breadth must be 5. Always answer the question that was asked (for example the larger number, not just x)." },
  { id: "a1", unit: "ap", name: "Recognise an AP and its common difference", objective: "Decide if a list is an arithmetic progression and find d.", prerequisites: [], minutes: 15,
    note: "An arithmetic progression (AP) is a list where each term is obtained by adding the same number d, the common difference, to the previous term. d = (second term) − (first term), and it must be the same for every consecutive pair. 2, 5, 8, 11 is an AP with d = 3. 7, 3, −1, −5 is an AP with d = −4. 1, 2, 4, 8 is not an AP because the differences are 1, 2, 4." },
  { id: "a2", unit: "ap", name: "Find the nth term", objective: "Use aₙ = a + (n − 1)d.", prerequisites: ["a1"], minutes: 20,
    note: "The nth term of an AP with first term a and common difference d is aₙ = a + (n − 1)d. Note it is (n − 1), because the first term already has zero differences added. For 2, 5, 8, … the 10th term is 2 + 9 × 3 = 29." },
  { id: "a3", unit: "ap", name: "Find which term has a given value", objective: "Solve a + (n − 1)d = value for n.", prerequisites: ["a2"], minutes: 20,
    note: "To find which term equals a given value, put the value in place of aₙ and solve for n. For 3, 8, 13, … and value 78: 3 + (n − 1) × 5 = 78, so n − 1 = 15 and n = 16. n must be a positive whole number." },
  { id: "a4", unit: "ap", name: "Sum of the first n terms", objective: "Use Sₙ = n/2 [2a + (n − 1)d].", prerequisites: ["a2"], minutes: 25,
    note: "The sum of the first n terms is Sₙ = (n/2)[2a + (n − 1)d]. If you know the last term l, Sₙ = (n/2)(a + l). For 1, 4, 7, … with n = 20: S = 10 × (2 + 19 × 3) = 10 × 59 = 590. The sum of the first n natural numbers is n(n + 1)/2." },
  { id: "a5", unit: "ap", name: "Find missing terms or parameters", objective: "Use equal differences or two given terms to find a and d.", prerequisites: ["a2"], minutes: 25,
    note: "If three numbers x, y, z are in AP then 2y = x + z. If two terms are given, write two equations a + (m − 1)d and a + (n − 1)d and subtract to find d, then find a. For a4 = 9 and a8 = 17: 4d = 8 so d = 2 and a = 9 − 3 × 2 = 3." },
  { id: "a6", unit: "ap", name: "Solve AP word problems", objective: "Model savings, seating and similar situations with APs.", prerequisites: ["a4"], minutes: 30,
    note: "Decide the first term and the common difference from the story, then choose between the nth term (value in a particular step) and the sum formula (total over steps). Saving 100 in month 1 and 20 more each month gives a = 100, d = 20. The 12th month is 100 + 11 × 20 = 320, and the 12-month total is 6 × (200 + 220) = 2520." },
];

const P = (...pairs: [string, string][]) => Object.fromEntries(pairs);

export const QUESTIONS: SeedQuestion[] = [
  { id: "Q01", skill: "q1", type: "mcq", difficulty: "easy", expectedSeconds: 30, text: "Which of these is a quadratic equation?", options: ["x + 5 = 0", "x² − 3x + 2 = 0", "x³ − x = 0", "1/x = 4"], answer: "1", explanation: "A quadratic has x as its highest power, and that power is 2. Only x² − 3x + 2 = 0 fits." },
  { id: "Q02", skill: "q1", type: "numeric", difficulty: "easy", expectedSeconds: 30, text: "In 3x² − 7x + 2 = 0, what is the value of b?", answer: "-7", explanation: "Compare with ax² + bx + c = 0. The coefficient of x is −7, sign included." },
  { id: "Q03", skill: "q1", type: "mcq", difficulty: "medium", expectedSeconds: 45, text: "Write x(x + 3) = 5 in standard form.", options: ["x² + 3x − 5 = 0", "x² + 3x + 5 = 0", "x² − 3x − 5 = 0", "x² + 3x = 5"], answer: "0", explanation: "Expand to x² + 3x = 5, then subtract 5 from both sides: x² + 3x − 5 = 0.", tags: P(["1", "sign-error-moving-terms"], ["2", "sign-error-moving-terms"], ["3", "not-in-standard-form"]) },
  { id: "Q04", skill: "q2", type: "mcq", difficulty: "easy", expectedSeconds: 40, text: "Is x = 2 a root of x² − 5x + 6 = 0?", options: ["Yes", "No"], answer: "0", explanation: "Substitute: 4 − 10 + 6 = 0, so the equation is satisfied." },
  { id: "Q05", skill: "q2", type: "numeric", difficulty: "medium", expectedSeconds: 60, text: "x = 1 is a root of x² + kx − 6 = 0. Find k.", answer: "5", explanation: "Substitute x = 1: 1 + k − 6 = 0, so k = 5." },
  { id: "Q06", skill: "q2", type: "mcq", difficulty: "medium", expectedSeconds: 75, text: "Which value is a root of 2x² − x − 3 = 0?", options: ["x = 3", "x = 3/2", "x = −3/2", "x = 1"], answer: "1", explanation: "For x = 3/2: 2(9/4) − 3/2 − 3 = 4.5 − 1.5 − 3 = 0." },
  { id: "Q07", skill: "q3", type: "mcq", difficulty: "easy", expectedSeconds: 60, text: "Solve x² − 5x + 6 = 0 by factorisation.", options: ["2 and 3", "−2 and −3", "1 and 6", "−1 and −6"], answer: "0", explanation: "x² − 5x + 6 = (x − 2)(x − 3), so x = 2 or x = 3.", tags: P(["1", "sign-error-roots"]) },
  { id: "Q08", skill: "q3", type: "mcq", difficulty: "medium", expectedSeconds: 75, text: "Solve x² + x − 12 = 0 by factorisation.", options: ["4 and −3", "−4 and 3", "3 and 4", "−3 and −4"], answer: "1", explanation: "x² + x − 12 = (x + 4)(x − 3). The factor (x + 4) gives x = −4, and (x − 3) gives x = 3.", tags: P(["0", "sign-error-roots"]) },
  { id: "Q09", skill: "q3", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "Find the larger root of 2x² − 7x + 3 = 0.", answer: "3", explanation: "2x² − 7x + 3 = (2x − 1)(x − 3), so the roots are 1/2 and 3. The larger is 3." },
  { id: "Q10", skill: "q3", type: "mcq", difficulty: "hard", expectedSeconds: 120, text: "Find the roots of 6x² − x − 2 = 0.", options: ["2/3 and −1/2", "−2/3 and 1/2", "1/3 and −2", "3/2 and −2"], answer: "0", explanation: "Split −x as +3x − 4x: 6x² + 3x − 4x − 2 = 3x(2x + 1) − 2(2x + 1) = (3x − 2)(2x + 1). Roots: 2/3 and −1/2.", tags: P(["1", "sign-error-roots"]) },
  { id: "Q11", skill: "q4", type: "numeric", difficulty: "medium", expectedSeconds: 45, text: "What must be added to x² + 6x to make it a perfect square?", answer: "9", explanation: "Add (6/2)² = 9 to get (x + 3)²." },
  { id: "Q12", skill: "q4", type: "mcq", difficulty: "hard", expectedSeconds: 100, text: "Completing the square on x² − 4x − 5 = 0 gives (x − 2)² = ?", options: ["9", "1", "5", "−1"], answer: "0", explanation: "x² − 4x = 5. Add 4 to both sides: (x − 2)² = 9.", tags: P(["2", "forgot-to-add-both-sides"]) },
  { id: "Q13", skill: "q5", type: "mcq", difficulty: "easy", expectedSeconds: 40, text: "Which is the quadratic formula for ax² + bx + c = 0?", options: ["x = (−b ± √(b² − 4ac)) / 2a", "x = (b ± √(b² − 4ac)) / 2a", "x = (−b ± √(b² + 4ac)) / 2a", "x = (−b ± √(b² − 4ac)) / a"], answer: "0", explanation: "The formula starts with −b and divides everything by 2a, using b² − 4ac under the root.", tags: P(["1", "sign-of-b"], ["2", "wrong-discriminant"], ["3", "missing-2"]) },
  { id: "Q14", skill: "q5", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "Using the formula, find the larger root of x² − 7x + 10 = 0.", answer: "5", explanation: "D = 49 − 40 = 9, so x = (7 ± 3)/2 = 5 or 2. The larger is 5." },
  { id: "Q15", skill: "q5", type: "mcq", difficulty: "medium", expectedSeconds: 100, text: "Solve x² + 2x − 2 = 0 using the formula.", options: ["−1 ± √3", "1 ± √3", "−1 ± √2", "−2 ± √3"], answer: "0", explanation: "D = 4 + 8 = 12, √12 = 2√3. x = (−2 ± 2√3)/2 = −1 ± √3.", tags: P(["1", "sign-of-b"], ["3", "forgot-to-divide-whole-numerator"]) },
  { id: "Q16", skill: "q5", type: "numeric", difficulty: "hard", expectedSeconds: 120, text: "Find the sum of the roots of 2x² − 9x + 4 = 0.", answer: "4.5", explanation: "2x² − 9x + 4 = (2x − 1)(x − 4), so roots are 1/2 and 4. Sum = 4.5 (also −b/a = 9/2)." },
  { id: "Q17", skill: "q6", type: "numeric", difficulty: "easy", expectedSeconds: 45, text: "Find the discriminant of 2x² − 4x + 3 = 0.", answer: "-8", explanation: "D = b² − 4ac = 16 − 24 = −8." },
  { id: "Q18", skill: "q6", type: "mcq", difficulty: "medium", expectedSeconds: 50, text: "What is the nature of the roots of x² − 6x + 9 = 0?", options: ["Two distinct real roots", "Real and equal roots", "No real roots", "Cannot be determined"], answer: "1", explanation: "D = 36 − 36 = 0, so the roots are real and equal (x = 3)." },
  { id: "Q19", skill: "q6", type: "mcq", difficulty: "medium", expectedSeconds: 50, text: "What is the nature of the roots of 2x² + x + 5 = 0?", options: ["Two distinct real roots", "Real and equal roots", "No real roots", "Cannot be determined"], answer: "2", explanation: "D = 1 − 40 = −39 < 0, so there are no real roots." },
  { id: "Q20", skill: "q6", type: "numeric", difficulty: "hard", expectedSeconds: 90, text: "For what positive value of k does x² + kx + 9 = 0 have equal roots?", answer: "6", explanation: "Equal roots need D = 0: k² − 36 = 0, so k = ±6. The positive value is 6." },
  { id: "Q21", skill: "q7", type: "mcq", difficulty: "easy", expectedSeconds: 60, text: "The product of two consecutive positive integers is 56. If the smaller is x, which equation is correct?", options: ["x² + x − 56 = 0", "x² − x − 56 = 0", "x² + x + 56 = 0", "2x + 1 = 56"], answer: "0", explanation: "The integers are x and x + 1, so x(x + 1) = 56, i.e. x² + x − 56 = 0." },
  { id: "Q22", skill: "q7", type: "mcq", difficulty: "medium", expectedSeconds: 70, text: "A rectangle's length is 3 m more than its breadth x, and its area is 40 m². Which equation is correct?", options: ["x² + 3x − 40 = 0", "x² − 3x − 40 = 0", "x² + 3x + 40 = 0", "2x + 3 = 40"], answer: "0", explanation: "Area = x(x + 3) = 40, so x² + 3x − 40 = 0." },
  { id: "Q23", skill: "q8", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "The product of two consecutive positive integers is 56. Find the smaller integer.", answer: "7", explanation: "x² + x − 56 = (x + 8)(x − 7) = 0, so x = 7 (x = −8 is not positive)." },
  { id: "Q24", skill: "q8", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "A rectangle's length is 3 m more than its breadth and its area is 40 m². Find the breadth (in m).", answer: "5", explanation: "x² + 3x − 40 = (x + 8)(x − 5) = 0, so x = 5 since a breadth cannot be negative." },
  { id: "Q25", skill: "q8", type: "numeric", difficulty: "hard", expectedSeconds: 120, text: "The sum of the squares of two consecutive positive integers is 113. Find the larger integer.", answer: "8", explanation: "x² + (x + 1)² = 113 → x² + x − 56 = 0 → x = 7. The larger integer is 8 (49 + 64 = 113)." },
  { id: "Q26", skill: "q8", type: "numeric", difficulty: "hard", expectedSeconds: 180, text: "A train travels 360 km at a uniform speed. If the speed were 5 km/h more, it would take 1 hour less. Find the speed (km/h).", answer: "40", explanation: "360/x − 360/(x + 5) = 1 → x² + 5x − 1800 = 0 → (x + 45)(x − 40) = 0. Speed = 40 km/h." },
  { id: "Q27", skill: "a1", type: "mcq", difficulty: "easy", expectedSeconds: 30, text: "Which list is an AP?", options: ["2, 5, 8, 11", "1, 2, 4, 8", "3, 6, 12, 24", "1, 4, 9, 16"], answer: "0", explanation: "Only 2, 5, 8, 11 has the same difference (3) between consecutive terms." },
  { id: "Q28", skill: "a1", type: "numeric", difficulty: "easy", expectedSeconds: 30, text: "Find the common difference of 7, 3, −1, −5, …", answer: "-4", explanation: "d = 3 − 7 = −4." },
  { id: "Q29", skill: "a2", type: "numeric", difficulty: "easy", expectedSeconds: 45, text: "Find the 10th term of the AP 2, 5, 8, …", answer: "29", explanation: "a₁₀ = 2 + 9 × 3 = 29." },
  { id: "Q30", skill: "a2", type: "numeric", difficulty: "medium", expectedSeconds: 60, text: "Find the 15th term of the AP with first term −3 and common difference 4.", answer: "53", explanation: "a₁₅ = −3 + 14 × 4 = 53." },
  { id: "Q31", skill: "a2", type: "mcq", difficulty: "medium", expectedSeconds: 30, text: "Which is the formula for the nth term of an AP?", options: ["a + nd", "a + (n − 1)d", "a + (n + 1)d", "an + d"], answer: "1", explanation: "The first term has no differences added, so the nth term adds (n − 1) differences.", tags: P(["0", "off-by-one-n"], ["2", "off-by-one-n"]) },
  { id: "Q32", skill: "a3", type: "numeric", difficulty: "medium", expectedSeconds: 75, text: "Which term of the AP 3, 8, 13, … is 78?", answer: "16", explanation: "3 + (n − 1)5 = 78 → n − 1 = 15 → n = 16." },
  { id: "Q33", skill: "a3", type: "numeric", difficulty: "hard", expectedSeconds: 100, text: "Which term of the AP 21, 18, 15, … is −81?", answer: "35", explanation: "21 + (n − 1)(−3) = −81 → (n − 1)(−3) = −102 → n − 1 = 34 → n = 35." },
  { id: "Q34", skill: "a4", type: "numeric", difficulty: "easy", expectedSeconds: 45, text: "Find the sum of the first 10 natural numbers.", answer: "55", explanation: "S = 10 × 11 / 2 = 55." },
  { id: "Q35", skill: "a4", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "Find the sum of the first 20 terms of 1, 4, 7, …", answer: "590", explanation: "S₂₀ = (20/2)[2(1) + 19(3)] = 10 × 59 = 590." },
  { id: "Q36", skill: "a4", type: "numeric", difficulty: "hard", expectedSeconds: 150, text: "The 4th term of an AP is 9 and the 8th term is 17. Find the sum of its first 15 terms.", answer: "255", explanation: "4d = 8 → d = 2, a = 9 − 6 = 3. S₁₅ = (15/2)[6 + 14 × 2] = 7.5 × 34 = 255." },
  { id: "Q37", skill: "a5", type: "numeric", difficulty: "medium", expectedSeconds: 90, text: "If k + 2, 4k − 6 and 3k − 2 are three consecutive terms of an AP, find k.", answer: "3", explanation: "2(4k − 6) = (k + 2) + (3k − 2) → 8k − 12 = 4k → k = 3. The terms are 5, 6, 7." },
  { id: "Q38", skill: "a5", type: "numeric", difficulty: "medium", expectedSeconds: 60, text: "The 5th term of an AP is 20 and the common difference is 3. Find the first term.", answer: "8", explanation: "a + 4 × 3 = 20 → a = 8." },
  { id: "Q39", skill: "a6", type: "numeric", difficulty: "medium", expectedSeconds: 75, text: "A person saves ₹100 in month 1 and ₹20 more each following month. How much does the person save in month 12 (₹)?", answer: "320", explanation: "a₁₂ = 100 + 11 × 20 = 320." },
  { id: "Q40", skill: "a6", type: "numeric", difficulty: "hard", expectedSeconds: 120, text: "Using the same savings pattern, what is the total saved in 12 months (₹)?", answer: "2520", explanation: "S₁₂ = (12/2)[200 + 11 × 20] = 6 × 420 = 2520." },
];

export const UNIT_NAMES = { quadratic: "Quadratic Equations", ap: "Arithmetic Progressions" } as const;

export function seedContent(db: Db): void {
  db.prepare("INSERT OR REPLACE INTO subjects (id, board, grade, name) VALUES (?,?,?,?)").run(SUBJECT_ID, "CBSE", "10", "Mathematics");
  const units = ["quadratic", "ap"] as const;
  units.forEach((u, i) => {
    db.prepare("INSERT OR REPLACE INTO units (id, subject_id, name, position) VALUES (?,?,?,?)").run(u, SUBJECT_ID, UNIT_NAMES[u], i + 1);
  });
  SKILLS.forEach((s, i) => {
    db.prepare(
      "INSERT OR REPLACE INTO skills (id, unit_id, name, objective, position, estimated_minutes, prerequisites) VALUES (?,?,?,?,?,?,?)"
    ).run(s.id, s.unit, s.name, s.objective, i + 1, s.minutes, JSON.stringify(s.prerequisites));
    db.prepare("INSERT OR REPLACE INTO resources (id, skill_id, title, body, source, review_status) VALUES (?,?,?,?,?,?)").run(
      "R-" + s.id, s.id, s.name, s.note, "Prototype demo note (original text)", "DEMO_UNREVIEWED"
    );
  });
  for (const q of QUESTIONS) {
    db.prepare(
      "INSERT OR REPLACE INTO questions (id, skill_id, type, text, options, answer, explanation, difficulty, marks, expected_seconds, distractor_tags, review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ).run(
      q.id, q.skill, q.type, q.text, q.options ? JSON.stringify(q.options) : null, q.answer, q.explanation,
      q.difficulty, q.difficulty === "hard" ? 3 : q.difficulty === "medium" ? 2 : 1, q.expectedSeconds,
      q.tags ? JSON.stringify(q.tags) : null, "DEMO_UNREVIEWED"
    );
  }
}

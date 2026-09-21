export interface FigureSequenceAnswerObj {
  image1: number | null;
  image2: number | null;
}

function isFigureSequenceAnswerObj(val: unknown): val is FigureSequenceAnswerObj {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  const img1Valid = obj.image1 === null || (typeof obj.image1 === 'number' && Number.isFinite(obj.image1));
  const img2Valid = obj.image2 === null || (typeof obj.image2 === 'number' && Number.isFinite(obj.image2));
  return 'image1' in obj && 'image2' in obj && img1Valid && img2Valid;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function parseIntegerIndex(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string' && v.trim().length > 0) {
    const parsed = parseInt(v.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Normalizes and evaluates whether a user answer matches the correct answer key.
 */
export function evaluateAnswer(
  questionType: string,
  userAnswer: unknown,
  correctAnswer: unknown,
): boolean {
  if (userAnswer === null || userAnswer === undefined || correctAnswer === null || correctAnswer === undefined) {
    return false;
  }

  const normalizedType = questionType.toLowerCase().trim();

  // 1. Figure Sequence
  if (normalizedType === 'figure_sequence') {
    let userImg1: number | null = null;
    let userImg2: number | null = null;

    if (isFigureSequenceAnswerObj(userAnswer)) {
      userImg1 = userAnswer.image1;
      userImg2 = userAnswer.image2;
    } else if (Array.isArray(userAnswer) && userAnswer.length >= 2) {
      userImg1 = parseIntegerIndex(userAnswer[0]);
      userImg2 = parseIntegerIndex(userAnswer[1]);
    }

    let correctImg1: number | null = null;
    let correctImg2: number | null = null;

    if (Array.isArray(correctAnswer) && correctAnswer.length >= 2) {
      correctImg1 = parseIntegerIndex(correctAnswer[0]);
      correctImg2 = parseIntegerIndex(correctAnswer[1]);
    } else if (isFigureSequenceAnswerObj(correctAnswer)) {
      correctImg1 = correctAnswer.image1;
      correctImg2 = correctAnswer.image2;
    }

    if (userImg1 === null || userImg2 === null || correctImg1 === null || correctImg2 === null) {
      return false;
    }

    return userImg1 === correctImg1 && userImg2 === correctImg2;
  }

  // 2. Numerical Series
  if (normalizedType === 'numerical_series') {
    const userStr = String(userAnswer).trim();
    const correctStr = String(correctAnswer).trim();
    if (userStr.length === 0 || correctStr.length === 0) return false;

    const uNum = Number(userStr);
    const cNum = Number(correctStr);
    if (Number.isFinite(uNum) && Number.isFinite(cNum)) {
      return Math.abs(uNum - cNum) < 1e-6;
    }
    return userStr === correctStr;
  }

  // 3. Math Equation
  if (normalizedType === 'math_equation') {
    if (!isRecord(userAnswer) || !isRecord(correctAnswer)) {
      return false;
    }

    const correctKeys = Object.keys(correctAnswer);
    if (correctKeys.length === 0) return false;

    for (const key of correctKeys) {
      const uVal = userAnswer[key];
      const cVal = correctAnswer[key];
      if (uVal === undefined || uVal === null) return false;
      const uNum = typeof uVal === 'number' ? uVal : parseFloat(String(uVal));
      const cNum = typeof cVal === 'number' ? cVal : parseFloat(String(cVal));
      if (Number.isNaN(uNum) || Number.isNaN(cNum) || Math.abs(uNum - cNum) >= 1e-6) {
        return false;
      }
    }
    return true;
  }

  // 4. Multiple Choice Questions (Completing Patterns, Latin Square, Module MCQ, etc.)
  const uStr = String(userAnswer).trim().toUpperCase();
  const cStr = String(correctAnswer).trim().toUpperCase();
  return uStr.length > 0 && uStr === cStr;
}

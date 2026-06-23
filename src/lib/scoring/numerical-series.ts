/**
 * Special handling for numerical_series question type:
 * Compares sorted distinct characters from user answer and correct answer.
 *
 * Example: "123" === "321" === "213" (same digits, different order)
 */
export function isNumericalSeriesCorrect(userAns: string, correctAns: string): boolean {
  const getDistinctCharsSorted = (str: string): string => {
    return Array.from(new Set(String(str).replace(/\s+/g, '').split(''))).sort().join('');
  };
  return getDistinctCharsSorted(userAns) === getDistinctCharsSorted(correctAns);
}

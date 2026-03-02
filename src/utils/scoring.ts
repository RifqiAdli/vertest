// Scoring utilities for VreTest

export function calculateScorePercentage(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 10000) / 100;
}

export function estimateIQ(percentage: number): number {
  // Simple linear mapping: 0% → 70, 100% → 145
  return Math.round(70 + (percentage / 100) * 75);
}

export function getConcentrationLevel(percentage: number): string {
  if (percentage >= 90) return "Sangat Tinggi";
  if (percentage >= 75) return "Tinggi";
  if (percentage >= 55) return "Sedang";
  if (percentage >= 35) return "Rendah";
  return "Sangat Rendah";
}

export function calculatePercentile(percentage: number): number {
  // Approximate percentile based on score
  return Math.min(99, Math.max(1, Math.round(percentage * 0.95)));
}

export function getCategoryAccuracy(
  answers: Array<{ is_correct: boolean | null; question_type: string }>
): Record<string, { correct: number; total: number; percentage: number }> {
  const cats: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    if (!cats[a.question_type]) cats[a.question_type] = { correct: 0, total: 0 };
    cats[a.question_type].total++;
    if (a.is_correct) cats[a.question_type].correct++;
  }
  const result: Record<string, { correct: number; total: number; percentage: number }> = {};
  for (const [k, v] of Object.entries(cats)) {
    result[k] = { ...v, percentage: Math.round((v.correct / v.total) * 100) };
  }
  return result;
}

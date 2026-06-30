// Derived health metrics for the profile (Phase D). Computed on read from height/weight/gender —
// never stored, so they always reflect the latest profile values (TZ: "Reaktiv ta'sir / Triggers").

/** Body Mass Index = kg / m². Null unless both height (cm) and weight (kg) are positive. */
export function computeBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** Coarse BMI category for the UI. */
export function bmiCategory(bmi: number | null): string | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Calories burned per kilometre of running, kcal/km. Standard running estimate ≈ weight(kg) × ~0.9,
 * nudged slightly by gender (men burn marginally more at the same mass). Null without a weight.
 * Multiply by distance_km to get a run's calorie estimate.
 */
export function caloriePerKm(weightKg: number | null, gender: string | null): number | null {
  if (!weightKg || weightKg <= 0) return null;
  const factor = gender === 'female' ? 0.86 : 0.9;
  return Math.round(weightKg * factor * 100) / 100;
}

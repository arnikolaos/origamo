export const ANGLE_MIN = 20;
export const ANGLE_MAX = 140;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngles(angleA, angleB) {
  let a = clamp(angleA, ANGLE_MIN, ANGLE_MAX);
  let b = clamp(angleB, ANGLE_MIN, ANGLE_MAX);
  const maxSum = 160;
  if (a + b > maxSum) {
    const scale = maxSum / (a + b);
    a *= scale;
    b *= scale;
  }
  const c = 180 - a - b;
  return { a, b, c };
}

export function turnForAngle(angle) {
  return 180 - angle;
}

export function stepLengthForAngle(angle, base) {
  return base * (0.55 + angle / 180);
}

export function weightedAverageTurn(angles, baseStep) {
  const lengths = angles.map((angle) => stepLengthForAngle(angle, baseStep));
  const turns = angles.map((angle) => turnForAngle(angle));
  const total = lengths.reduce((sum, len) => sum + len, 0);
  const weighted = lengths.reduce((sum, len, index) => sum + len * turns[index], 0);
  return weighted / total;
}

export function detectPolygon(avgTurn, tolerance = 2.5) {
  if (!Number.isFinite(avgTurn) || avgTurn <= 0) return null;
  const estimate = 360 / avgTurn;
  const rounded = Math.round(estimate);
  if (rounded < 3 || rounded > 12) return null;
  const targetTurn = 360 / rounded;
  const diff = Math.abs(avgTurn - targetTurn);
  if (diff > tolerance) return null;
  return rounded;
}

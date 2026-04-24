// src/lib/format.ts
// Shared formatting helpers.

/**
 * Format a CO2e value intelligently:
 *  - 0 → "0"
 *  - very small (< 0.1) → 2 decimals so "0.03" doesn't vanish
 *  - small (< 10)       → 1 decimal   ("4.5")
 *  - large (>= 10)      → 1 decimal   ("124.6")
 * Always avoids "0.0" when the real value is non-zero but small.
 */
export function formatCo2(kg: number | null | undefined): string {
  const n = typeof kg === 'number' ? kg : 0;
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 0.1) return n.toFixed(2);
  return n.toFixed(1);
}

/**
 * Sums the result of applying an async transformer to each number.
 *
 * BUG: Missing `await` before transform(n). The Promise object is added
 * to `total` instead of the resolved number, producing NaN on the first
 * iteration and NaN for every subsequent one.
 *
 * TASK: Add the missing `await` keyword so the resolved values are summed.
 * Do not change the function signature.
 */
export async function sumTransformed(
  numbers: number[],
  transform: (n: number) => Promise<number>
): Promise<number> {
  let total = 0;
  for (const n of numbers) {
    total += transform(n); // BUG: missing await
  }
  return total;
}

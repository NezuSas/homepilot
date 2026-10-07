// Partition work, never sample away combinations from the clock contract.
export function clockSweepPlan(viewportWidth: number, sampleStep = 1) {
  if (!Number.isInteger(sampleStep) || sampleStep < 1) {
    throw new Error('Clock sample step must be a positive integer');
  }
  const maxUsefulWidth = Math.max(300, viewportWidth - (viewportWidth < 640 ? 16 : 32) - 44);
  const samples = new Set<number>([300, maxUsefulWidth, 4000]);
  for (let width = 300; width <= maxUsefulWidth; width += sampleStep) samples.add(width);
  const widths = [...samples].sort((a, b) => a - b);
  const batches: number[][] = [];
  // At most 6,750 layouts per scenario: 50 widths × 45 sizes × 3 renderers.
  for (let start = 0; start < widths.length; start += 50) batches.push(widths.slice(start, start + 50));
  return { maxUsefulWidth, batches };
}

/** Count a source and its sub-boards without loading the UI or server-action tree. */
export function boardCount(id: string, onBoard: Record<string, number>): number {
  let total = 0;
  for (const [source, count] of Object.entries(onBoard)) {
    if (source === id || source.startsWith(`${id}:`)) total += count;
  }
  return total;
}

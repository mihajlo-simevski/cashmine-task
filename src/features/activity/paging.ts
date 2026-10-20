import type { ActivityPage } from "@/features/api/schemas";

/**
 * The cursor for the next page, or undefined to stop. Stops on an empty page, an empty
 * cursor, or a cursor equal to the one just used, so a server bug can't make
 * "Load more" loop forever on the same records.
 */
/**
 * Joins pages, dropping repeated ids. New activity arriving between page loads shifts the
 * newest-first list, so the next page can repeat an item already shown.
 */
export function mergeActivityPages(pages: ActivityPage[]): ActivityPage["items"] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.items)
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export function nextActivityCursor(
  page: ActivityPage,
  lastCursor: string | null,
): string | undefined {
  if (page.items.length === 0 || !page.nextCursor || page.nextCursor === lastCursor) {
    return undefined;
  }
  return page.nextCursor;
}

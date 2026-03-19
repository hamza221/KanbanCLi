import { getISOWeek, getISOWeekYear, parseISO, format } from 'date-fns';

/**
 * Composable that handles weekly recurring task resets.
 * Cards with `recurring.frequency === "weekly"` are reset to the first column
 * when a new ISO week is detected (compared to `recurring.lastReset`).
 *
 * Returns true if any cards were modified.
 */
export function useRecurring() {
  function processRecurring(cards, config) {
    if (!cards || !config?.columns?.length) return false;

    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = getISOWeekYear(now);
    const firstColumn = config.columns[0];
    let modified = false;

    for (const card of cards) {
      if (!card.recurring || card.recurring.frequency !== 'weekly') continue;

      const lastReset = card.recurring.lastReset;
      if (lastReset) {
        try {
          const resetDate = parseISO(lastReset);
          const resetWeek = getISOWeek(resetDate);
          const resetYear = getISOWeekYear(resetDate);

          // Same ISO week — no reset needed
          if (resetWeek === currentWeek && resetYear === currentYear) {
            continue;
          }
        } catch {
          // Invalid date — proceed with reset
        }
      }

      // Reset the card
      const resetTo = card.recurring.resetToStatus || firstColumn;
      card.status = resetTo;
      card.recurring.lastReset = format(now, 'yyyy-MM-dd');
      modified = true;
    }

    return modified;
  }

  return { processRecurring };
}

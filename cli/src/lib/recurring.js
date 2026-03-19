import { getISOWeek, getISOWeekYear, parseISO, format } from 'date-fns';

/**
 * Process weekly recurring cards: reset them to the first column
 * when a new ISO week is detected (compared to `recurring.lastReset`).
 *
 * @param {Array} cards - The cards array (mutated in place)
 * @param {Object} config - Board config with columns
 * @param {Date} [now] - Override current date (for testing)
 * @returns {boolean} Whether any cards were modified
 */
export function processRecurring(cards, config, now = new Date()) {
  if (!cards || !config?.columns?.length) return false;

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

        if (resetWeek === currentWeek && resetYear === currentYear) {
          continue;
        }
      } catch {
        // Invalid date — proceed with reset
      }
    }

    const resetTo = card.recurring.resetToStatus || firstColumn;
    card.status = resetTo;
    card.recurring.lastReset = format(now, 'yyyy-MM-dd');
    modified = true;
  }

  return modified;
}

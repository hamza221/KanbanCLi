import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Composable for browser notifications about approaching deadlines.
 * Requests notification permission and fires a notification for any
 * card whose deadline is within the warning threshold (default 3 days).
 */
export function useNotifications() {
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function checkDeadlineNotifications(cards, { warningDays = 3 } = {}) {
    if (!cards?.length) return;
    if (!('Notification' in window)) return;

    const now = new Date();
    const urgentCards = [];

    for (const card of cards) {
      if (!card.deadline) continue;
      try {
        const days = differenceInCalendarDays(parseISO(card.deadline), now);
        if (days <= warningDays) {
          urgentCards.push({ card, days });
        }
      } catch {
        // Skip invalid dates
      }
    }

    if (urgentCards.length === 0) return;

    // Request permission then show notifications
    requestPermission().then((granted) => {
      if (!granted) return;

      for (const { card, days } of urgentCards) {
        let body;
        if (days < 0) {
          body = `"${card.title}" is ${Math.abs(days)} day(s) overdue!`;
        } else if (days === 0) {
          body = `"${card.title}" is due today!`;
        } else {
          body = `"${card.title}" is due in ${days} day(s)`;
        }

        new Notification('CLIkanban Deadline', {
          body,
          icon: '/favicon.ico',
          tag: `deadline-${card.id}`,
        });
      }
    });
  }

  return {
    requestPermission,
    checkDeadlineNotifications,
  };
}

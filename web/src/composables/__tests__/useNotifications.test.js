import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotifications } from '../useNotifications.js';

describe('useNotifications', () => {
  const { checkDeadlineNotifications, requestPermission } = useNotifications();

  beforeEach(() => {
    // Reset Notification mock
    vi.stubGlobal('Notification', class MockNotification {
      static permission = 'granted';
      static requestPermission = vi.fn(() => Promise.resolve('granted'));
      constructor(title, options) {
        this.title = title;
        this.options = options;
      }
    });
  });

  it('does nothing with empty cards', () => {
    // Should not throw
    checkDeadlineNotifications([]);
    checkDeadlineNotifications(null);
  });

  it('does nothing when no cards have deadlines', () => {
    checkDeadlineNotifications([
      { id: '1', title: 'No deadline', deadline: null },
    ]);
    // No error means success
  });

  it('fires notifications for cards with approaching deadlines', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const instances = [];

    vi.stubGlobal('Notification', class MockNotification {
      static permission = 'granted';
      static requestPermission = vi.fn(() => Promise.resolve('granted'));
      constructor(title, options) {
        instances.push({ title, options });
      }
    });

    checkDeadlineNotifications([
      { id: '1', title: 'Urgent task', deadline: tomorrow },
    ]);

    // Wait for the async permission check
    await new Promise((r) => setTimeout(r, 10));

    expect(instances.length).toBeGreaterThanOrEqual(1);
    expect(instances[0].title).toBe('CLIkanban Deadline');
    expect(instances[0].options.body).toContain('Urgent task');
  });

  it('does not fire for far-future deadlines', async () => {
    const farFuture = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const instances = [];

    vi.stubGlobal('Notification', class MockNotification {
      static permission = 'granted';
      static requestPermission = vi.fn(() => Promise.resolve('granted'));
      constructor(title, options) {
        instances.push({ title, options });
      }
    });

    checkDeadlineNotifications([
      { id: '1', title: 'Future task', deadline: farFuture },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    expect(instances.length).toBe(0);
  });

  it('requestPermission resolves to true when granted', async () => {
    const result = await requestPermission();
    expect(result).toBe(true);
  });

  it('requestPermission resolves to false when denied', async () => {
    vi.stubGlobal('Notification', {
      permission: 'denied',
      requestPermission: vi.fn(() => Promise.resolve('denied')),
    });

    const result = await requestPermission();
    expect(result).toBe(false);
  });
});

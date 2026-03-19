import { ref } from 'vue';

const STORAGE_KEY = 'clikanban-dark-mode';

const isDark = ref(false);

// Initialize from localStorage on first import
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    isDark.value = stored === 'true';
  } else {
    // Respect system preference
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

function applyClass(dark) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark-mode', dark);
}

// Apply immediately on load
applyClass(isDark.value);

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value;
    localStorage.setItem(STORAGE_KEY, String(isDark.value));
    applyClass(isDark.value);
  }

  function set(value) {
    isDark.value = value;
    localStorage.setItem(STORAGE_KEY, String(value));
    applyClass(value);
  }

  return {
    isDark,
    toggle,
    set,
  };
}

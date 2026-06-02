import { ref } from 'vue';

const user = ref(null);
const authReady = ref(false);
const authLoading = ref(false);

async function request(path, body = null) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function useAuth() {
  async function init() {
    authLoading.value = true;
    try {
      const data = await request('/api/me');
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      authReady.value = true;
      authLoading.value = false;
    }
  }

  async function login(email, password) {
    authLoading.value = true;
    try {
      const data = await request('/api/auth/login', { email, password });
      user.value = data.user;
      return data.user;
    } finally {
      authLoading.value = false;
    }
  }

  async function signup({ email, name, password }) {
    authLoading.value = true;
    try {
      const data = await request('/api/auth/signup', { email, name, password });
      user.value = data.user;
      return data.user;
    } finally {
      authLoading.value = false;
    }
  }

  async function logout() {
    authLoading.value = true;
    try {
      await request('/api/auth/logout', {});
      user.value = null;
    } finally {
      authLoading.value = false;
    }
  }

  function loginWithGithub() {
    window.location.href = '/api/auth/github';
  }

  return {
    user,
    authReady,
    authLoading,
    init,
    login,
    signup,
    logout,
    loginWithGithub,
  };
}

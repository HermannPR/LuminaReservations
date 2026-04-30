import type { LoginResponse, StoredSession, UserData } from '../types/auth';

const SESSION_KEY = 'workhub_session';

function toStoredUser(user: UserData): UserData {
  return { ...user, profile_photo_url: null };
}

export function saveSession(response: LoginResponse): void {
  const session: StoredSession = {
    access_token: response.access_token,
    token_type: response.token_type,
    expires_in: response.expires_in,
    login_timestamp: Date.now() / 1000,
    user: toStoredUser(response.user),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function updateSessionUser(user: UserData): void {
  const session = getSession();
  if (!session) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user: toStoredUser(user) }));
}

export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  return (session.login_timestamp + session.expires_in) > (Date.now() / 1000);
}

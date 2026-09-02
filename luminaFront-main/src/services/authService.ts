import type { LoginRequest, LoginResponse } from '../types/auth';
import { API_BASE_URL } from './apiConfig';

export type LoginResult =
  | { success: true; data: LoginResponse; errorMessage?: never }
  | { success: false; errorMessage: string };

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  ACCOUNT_INACTIVE: 'Tu cuenta está inactiva. Contacta a soporte.',
  NO_ROLES_ASSIGNED: 'Tu cuenta no tiene roles asignados. Contacta a soporte.',
  VALIDATION_ERROR: 'Revisa el formato del correo y que la contraseña tenga al menos 8 caracteres.',
  RATE_LIMIT_EXCEEDED: 'Demasiados intentos fallidos. Espera 60 segundos e intenta de nuevo.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
};

const DEFAULT_ERROR = 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';

export async function login(credentials: LoginRequest): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (response.ok) {
      const data: LoginResponse = await response.json();
      return { success: true, data };
    }

    const body = await response.json().catch(() => ({}));
    const errorCode: string = body?.error ?? '';
    const errorMessage = ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR;
    return { success: false, errorMessage };
  } catch {
    return { success: false, errorMessage: DEFAULT_ERROR };
  }
}

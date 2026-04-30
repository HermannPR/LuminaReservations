// Request al backend
export interface LoginRequest {
  email: string;
  password: string;
}

// Objeto usuario en la respuesta
export interface UserData {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  role: string;
  department: string;
  profile_photo_url: string | null;
}

// Respuesta exitosa del backend (HTTP 200)
export interface LoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: UserData;
}

// Respuesta de error del backend
export interface BackendError {
  error: string;
  message: string;
}

// Códigos de error conocidos del backend
export type BackendErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_INACTIVE'
  | 'NO_ROLES_ASSIGNED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

// Lo que se persiste en localStorage
export interface StoredSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  login_timestamp: number; // Unix timestamp en segundos (Date.now() / 1000)
  user: UserData;
}

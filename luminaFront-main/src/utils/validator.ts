export interface ValidationErrors {
  email?: string;
  password?: string;
}

// Matches local@domain.tld — requires local part, @, domain, dot, and TLD
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateLoginForm(email: string, password: string): ValidationErrors {
  const errors: ValidationErrors = {};

  if (email.trim() === '') {
    errors.email = 'El correo es obligatorio';
  } else if (!isValidEmail(email)) {
    errors.email = 'Ingresa un correo válido';
  }

  if (password === '') {
    errors.password = 'La contraseña es obligatoria';
  }

  return errors;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface PasswordValidationResult extends ValidationResult {
  strength: 'weak' | 'medium' | 'strong';
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const TAX_ID_REGEX = /^[a-zA-Z0-9\-\.\/]{5,30}$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,16}$/;
const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address is required' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@company.com)' };
  }
  return { isValid: true };
}

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Username is required' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  return { isValid: true };
}

export function validatePassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasLetter) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 4 && password.length >= 10) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  if (!password) {
    return {
      isValid: false,
      strength: 'weak',
      hasMinLength: false,
      hasLetter: false,
      hasNumber: false,
      hasSpecial: false,
      error: 'Password is required',
    };
  }

  if (!hasMinLength) {
    return {
      isValid: false,
      strength,
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSpecial,
      error: 'Password must be at least 8 characters long',
    };
  }

  return {
    isValid: true,
    strength,
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSpecial,
  };
}

export function validateConfirmPassword(password: string, confirm: string): ValidationResult {
  if (!confirm) {
    return { isValid: false, error: 'Please confirm your password' };
  }
  if (password !== confirm) {
    return { isValid: false, error: 'Passwords do not match' };
  }
  return { isValid: true };
}

export function validateTaxId(taxId: string): ValidationResult {
  const trimmed = taxId.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Tax ID / Business Registration is required' };
  }
  if (trimmed.length < 5) {
    return { isValid: false, error: 'Tax ID / Registration number must be at least 5 characters' };
  }
  if (!TAX_ID_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid format. Use alphanumeric characters and hyphens (e.g. EIN, GST, VAT, CIN)' };
  }
  return { isValid: true };
}

export function validateCompanyName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Company legal name is required' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Company name must be at least 2 characters' };
  }
  return { isValid: true };
}

export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim();
  if (!trimmed) return { isValid: true }; // optional
  if (!PHONE_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid phone number (e.g. +1 555-0123)' };
  }
  return { isValid: true };
}

export function validateUrl(url: string): ValidationResult {
  const trimmed = url.trim();
  if (!trimmed) return { isValid: true }; // optional
  if (!URL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid URL (e.g. https://company.com)' };
  }
  return { isValid: true };
}

export function validateCertificateFile(file: File): ValidationResult {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (file.size > MAX_SIZE) {
    return { isValid: false, error: 'Certificate file must be under 5MB' };
  }

  // Also check extension if MIME is generic application/octet-stream
  const ext = file.name.split('.').pop()?.toLowerCase();
  const validExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

  if (!ALLOWED_TYPES.includes(file.type) && (!ext || !validExts.includes(ext))) {
    return { isValid: false, error: 'Allowed formats: PDF, PNG, JPG, or WEBP' };
  }

  return { isValid: true };
}

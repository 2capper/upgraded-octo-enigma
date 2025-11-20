import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  error?: string;
}

export function normalizePhone(phone: string | null | undefined, defaultCountry: 'US' | 'CA' = 'CA'): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      normalized: null,
      error: 'Phone number is required'
    };
  }

  const trimmed = phone.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      normalized: null,
      error: 'Phone number is empty'
    };
  }

  try {
    const phoneNumber = parsePhoneNumber(trimmed, defaultCountry);
    
    if (!phoneNumber || !phoneNumber.isValid()) {
      return {
        isValid: false,
        normalized: null,
        error: 'Invalid phone number format'
      };
    }

    return {
      isValid: true,
      normalized: phoneNumber.format('E.164'),
      error: undefined
    };
  } catch (error) {
    return {
      isValid: false,
      normalized: null,
      error: error instanceof Error ? error.message : 'Invalid phone number'
    };
  }
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  
  try {
    const phoneNumber = parsePhoneNumber(phone);
    if (!phoneNumber) return phone;
    
    return phoneNumber.formatNational();
  } catch {
    return phone;
  }
}

export function isValidE164(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  try {
    return isValidPhoneNumber(phone);
  } catch {
    return false;
  }
}

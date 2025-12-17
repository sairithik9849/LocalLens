/**
 * Pincode (US ZIP code) validation utilities
 */

/**
 * Formats pincode by removing spaces and normalizing dashes
 * @param {string} pincode - Raw pincode input
 * @returns {string} Formatted pincode
 */
export function formatPincode(pincode) {
  if (!pincode || typeof pincode !== 'string') {
    return '';
  }
  
  // Remove all spaces
  let formatted = pincode.replace(/\s+/g, '');
  
  // Normalize dash position (should be at position 5 if present)
  if (formatted.length > 5 && formatted[5] === '-') {
    // Already has dash in correct position
    return formatted;
  } else if (formatted.length > 5 && !formatted.includes('-')) {
    // Add dash at position 5 for 5+4 format
    return formatted.slice(0, 5) + '-' + formatted.slice(5);
  }
  
  return formatted;
}

/**
 * Checks if a pincode matches US ZIP code format
 * @param {string} pincode - Pincode to validate
 * @returns {boolean} True if valid US ZIP code format
 */
export function isValidUSZipCode(pincode) {
  if (!pincode || typeof pincode !== 'string') {
    return false;
  }
  
  const formatted = formatPincode(pincode);
  
  // US ZIP code patterns:
  // 5 digits: 12345
  // 5+4 format: 12345-6789
  const zip5Pattern = /^\d{5}$/;
  const zip9Pattern = /^\d{5}-\d{4}$/;
  
  return zip5Pattern.test(formatted) || zip9Pattern.test(formatted);
}

/**
 * Validates pincode and returns result with error messages
 * @param {string} pincode - Pincode to validate
 * @returns {Object} Validation result with isValid, error, and formatted pincode
 */
export function validatePincode(pincode) {
  if (!pincode || typeof pincode !== 'string' || pincode.trim() === '') {
    return {
      isValid: false,
      error: 'Pincode is required',
      formatted: ''
    };
  }
  
  const formatted = formatPincode(pincode);
  
  // Check if contains only digits and optional dash
  if (!/^[\d-]+$/.test(formatted)) {
    return {
      isValid: false,
      error: 'Pincode must contain only numbers and optional dash',
      formatted: formatted
    };
  }
  
  // Check length (minimum 5 digits)
  const digitsOnly = formatted.replace(/-/g, '');
  if (digitsOnly.length < 5) {
    return {
      isValid: false,
      error: 'Pincode must be at least 5 digits',
      formatted: formatted
    };
  }
  
  // Check if too long
  if (digitsOnly.length > 9) {
    return {
      isValid: false,
      error: 'Pincode cannot be more than 9 digits',
      formatted: formatted
    };
  }
  
  // Validate format
  if (!isValidUSZipCode(formatted)) {
    return {
      isValid: false,
      error: 'Invalid US ZIP code format. Use 12345 or 12345-6789',
      formatted: formatted
    };
  }
  
  return {
    isValid: true,
    error: null,
    formatted: formatted
  };
}


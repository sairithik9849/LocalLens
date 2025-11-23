/**
 * Validates password against security requirements
 * @param {string} password - Password to validate
 * @returns {object} Object with isValid boolean and errors array
 */
export function validatePassword(password) {
  const errors = [];
  
  // Minimum length check
  if (password.length < 8) {
    errors.push('at least 8 characters');
  }
  
  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter (A-Z)');
  }
  
  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter (a-z)');
  }
  
  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('one number (0-9)');
  }
  
  // Special character/symbol check
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Formats password validation errors into a user-friendly message
 * @param {array} errors - Array of missing requirements
 * @returns {string} Formatted error message
 */
export function getPasswordRequirementsMessage(errors) {
  if (errors.length === 0) {
    return '';
  }
  
  if (errors.length === 1) {
    return `Password must contain ${errors[0]}.`;
  }
  
  const lastError = errors[errors.length - 1];
  const otherErrors = errors.slice(0, -1);
  
  return `Password must contain ${otherErrors.join(', ')}, and ${lastError}.`;
}


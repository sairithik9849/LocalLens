/**
 * Input sanitization utilities for user-generated content
 * Next.js React components have built-in XSS protection, but we sanitize before storing
 */

/**
 * Removes HTML tags from a string
 * @param {string} input - Input string
 * @returns {string} Sanitized string without HTML tags
 */
function removeHtmlTags(input) {
  if (typeof input !== 'string') {
    return input;
  }
  // Remove HTML tags using regex
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escapes special characters that could be used for XSS
 * @param {string} input - Input string
 * @returns {string} Escaped string
 */
function escapeSpecialChars(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

/**
 * Sanitizes text input for bio and favoriteQuote fields
 * Allows: letters, numbers, spaces, basic punctuation
 * Removes: HTML tags, dangerous characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeText(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // First, remove HTML tags
  let sanitized = removeHtmlTags(input);

  // Trim whitespace
  sanitized = sanitized.trim();

  // Note: We don't escape here because React will handle it when rendering
  // But we remove potentially dangerous patterns
  // Allow letters, numbers, spaces, and common punctuation
  // This is a conservative approach - allows most normal text
  sanitized = sanitized.replace(/[^\w\s.,!?;:'"()\-]/g, '');

  return sanitized;
}

/**
 * Sanitizes and validates bio text
 * @param {string} bio - Bio text to sanitize
 * @returns {string} Sanitized bio
 */
export function sanitizeBio(bio) {
  if (!bio || typeof bio !== 'string') {
    return bio;
  }

  return sanitizeText(bio);
}

/**
 * Sanitizes and validates favorite quote text
 * @param {string} quote - Quote text to sanitize
 * @returns {string} Sanitized quote
 */
export function sanitizeQuote(quote) {
  if (!quote || typeof quote !== 'string') {
    return quote;
  }

  return sanitizeText(quote);
}


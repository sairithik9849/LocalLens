  /**
 * Utility functions to check user profile completeness
 */

/**
 * Validates that a string contains only letters
 * Allows: letters (a-z, A-Z) only
 * @param {string} value - The value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} Validation result with isValid and error message
 */
export function validateNameField(value, fieldName = 'Field') {
  if (!value || typeof value !== 'string') {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }

  const trimmed = value.trim();
  
  if (trimmed === '') {
    return {
      isValid: false,
      error: `${fieldName} cannot be empty`
    };
  }

  // Allow only letters (a-z, A-Z)
  const namePattern = /^[a-zA-Z]+$/;
  
  if (!namePattern.test(trimmed)) {
    return {
      isValid: false,
      error: `${fieldName} can only contain letters`
    };
  }

  // Check minimum length (at least 2 characters after trimming)
  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: `${fieldName} must be at least 2 characters long`
    };
  }

  // Check maximum length (reasonable limit)
  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed 50 characters`
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmed
  };
}

/**
 * Validates city name - must exist, be a string, and contain at least 3 letters
 * @param {string} city - The city name to validate
 * @returns {Object} Validation result with isValid and error message
 */
export function validateCity(city) {
  if (!city || typeof city !== 'string') {
    return {
      isValid: false,
      error: 'City is required'
    };
  }

  const trimmed = city.trim();
  
  if (trimmed === '') {
    return {
      isValid: false,
      error: 'City cannot be empty'
    };
  }

  // Count letters in the city name
  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  
  // Check that it contains at least 3 letters
  if (letterCount < 3) {
    return {
      isValid: false,
      error: 'City must contain at least 3 letters'
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmed
  };
}

/**
 * Checks if user profile has all required fields
 * This is a lenient check - only verifies fields exist and are non-empty
 * Strict validation is enforced when updating the profile
 * @param {Object} userData - User document from MongoDB
 * @returns {Object} Object with isComplete boolean and missingFields array
 */
export function isProfileComplete(userData) {
  if (!userData) {
    return {
      isComplete: false,
      missingFields: ['firstName', 'lastName', 'pincode', 'city']
    };
  }

  const missingFields = [];

  // Check firstName - just verify it exists and is non-empty
  const firstName = userData.firstName;
  if (!firstName || (typeof firstName !== 'string' && typeof firstName !== 'number') || String(firstName).trim() === '') {
    missingFields.push('firstName');
  }

  // Check lastName - just verify it exists and is non-empty
  const lastName = userData.lastName;
  if (!lastName || (typeof lastName !== 'string' && typeof lastName !== 'number') || String(lastName).trim() === '') {
    missingFields.push('lastName');
  }

  // Check pincode (can be string or number, stored as string to preserve leading zeros)
  const pincode = userData.profile?.pincode;
  if (!pincode || pincode === null || pincode === undefined) {
    missingFields.push('pincode');
  } else {
    // Convert to string and check if it's not empty
    const pincodeStr = String(pincode).trim();
    if (pincodeStr === '' || pincodeStr === 'null' || pincodeStr === 'undefined') {
      missingFields.push('pincode');
    }
  }

  // Check city - handle trailing commas and verify it exists and has content
  let cityValue = userData.profile?.city;
  if (cityValue && typeof cityValue === 'string') {
    // Remove trailing commas and trim
    cityValue = cityValue.replace(/,$/, '').trim();
  }
  if (!cityValue || cityValue === null || cityValue === undefined || cityValue === '') {
    missingFields.push('city');
  } else {
    // Verify it contains at least 3 letters (basic validation)
    const cityStr = String(cityValue);
    const letterCount = (cityStr.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 3) {
      missingFields.push('city');
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields: missingFields
  };
}


/**
 * Validation utilities
 * Provides reusable validation functions following security best practices
 * 
 * @module utils/validation
 */

/**
 * Sanitize string input - removes potentially dangerous characters
 * Prevents XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  // Remove HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .trim()
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }
  
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate field name format (lowercase, alphanumeric, underscores)
 */
export function isValidFieldName(fieldName: string): boolean {
  if (!fieldName || typeof fieldName !== 'string') {
    return false
  }
  
  const fieldNameRegex = /^[a-z][a-z0-9_]*$/
  return fieldNameRegex.test(fieldName)
}

/**
 * Validate catalog ID format (REQ-XXX-XX)
 */
export function isValidCatalogId(catalogId: string): boolean {
  if (!catalogId || typeof catalogId !== 'string') {
    return false
  }
  
  const catalogIdRegex = /^REQ-[A-Z0-9]+-\d{2}$/
  return catalogIdRegex.test(catalogId)
}

/**
 * Security utilities for input sanitization and rate limiting.
 */

/**
 * Strip HTML tags and trim whitespace from user input.
 * Prevents XSS when values are rendered or stored.
 */
export function sanitizeString(input: string, maxLength = 100): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'&]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Simple in-memory rate limiter for client-side auth forms.
 * Tracks attempts by action key and blocks after threshold.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

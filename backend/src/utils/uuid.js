const crypto = require('crypto');

/**
 * Deterministically convert an arbitrary string into a UUID v5-like identifier.
 * This ensures the same string always produces the same UUID,
 * so upserts are idempotent.
 */
function stringToUuid(str) {
  if (!str) throw new Error('Cannot convert empty string to UUID');

  // Namespace UUID (any fixed UUID works) + string → 16-byte hash → format as UUID
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // RFC 4122 DNS namespace
  const hash = crypto.createHash('sha1');
  hash.update(NAMESPACE);
  hash.update(String(str));

  const bytes = hash.digest().slice(0, 16);

  // Set version (5) and variant bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

module.exports = { stringToUuid };
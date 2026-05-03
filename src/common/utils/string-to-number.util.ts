/**
 * Convert a string value to a number
 * Handles hex strings (1-4 chars), numeric strings, and invalid values
 *
 * @param value - String value to convert
 * @returns Numeric value
 */
export function stringToNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  // Check if it's a hex string (1-4 characters, A-F or 0-9)
  if (/^[0-9A-Fa-f]{1,4}$/.test(value)) {
    return parseInt(value, 16);
  }

  // Try to parse as decimal number
  const numValue = parseFloat(value);

  // Return 0 if parsing failed (NaN)
  return isNaN(numValue) ? 0 : numValue;
}

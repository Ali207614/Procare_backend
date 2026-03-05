export function normalizeUzPhone(phone: string): { full: string; last9: string } {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 9) {
    return { full: `998${digits}`, last9: digits };
  }

  if (digits.length === 12 && digits.startsWith('998')) {
    return { full: digits, last9: digits.slice(3) };
  }

  // Return empty strings or throw if invalid. Throwing is better.
  return { full: digits, last9: digits.slice(-9) };
}

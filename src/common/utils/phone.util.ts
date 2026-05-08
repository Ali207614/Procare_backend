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

export function formatUzPhoneToE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return trimmed;
  }

  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }

  if (digits.length === 9) {
    return `+998${digits}`;
  }

  if (trimmed.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  if (digits.length > 9) {
    return `+998${digits.slice(-9)}`;
  }

  return trimmed;
}

export function getUzPhoneLookupCandidates(phone: string): string[] {
  const normalized = formatUzPhoneToE164(phone);
  const digits = normalized.replace(/\D/g, '');
  const candidates = new Set<string>();

  if (normalized) {
    candidates.add(normalized);
  }

  if (digits.length === 12 && digits.startsWith('998')) {
    candidates.add(digits.slice(3));
  } else if (digits.length === 9) {
    candidates.add(digits);
  }

  return [...candidates];
}

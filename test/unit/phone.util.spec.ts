import {
  formatUzPhoneToE164,
  getUzPhoneLookupCandidates,
  normalizeUzPhone,
} from '../../src/common/utils/phone.util';

describe('phone.util', () => {
  it('normalizes 9-digit Uzbek numbers to +998 format', () => {
    expect(formatUzPhoneToE164('976191611')).toBe('+998976191611');
    expect(formatUzPhoneToE164('97 619 16 11')).toBe('+998976191611');
  });

  it('returns both normalized and legacy lookup candidates', () => {
    expect(getUzPhoneLookupCandidates('976191611')).toEqual([
      '+998976191611',
      '976191611',
    ]);
    expect(getUzPhoneLookupCandidates('+998976191611')).toEqual([
      '+998976191611',
      '976191611',
    ]);
  });

  it('keeps auth-oriented normalization behavior unchanged', () => {
    expect(normalizeUzPhone('+998976191611')).toEqual({
      full: '998976191611',
      last9: '976191611',
    });
  });
});

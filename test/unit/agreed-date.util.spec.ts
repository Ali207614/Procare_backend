import { formatPgTimestampLocal, parseAgreedDateInput } from 'src/common/utils/agreed-date.util';

describe('agreed-date util', () => {
  it('parses valid agreed date input strictly', () => {
    const parsed = parseAgreedDateInput('2026-03-27 09:15');

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(27);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(15);
  });

  it('rejects impossible agreed date input', () => {
    expect(parseAgreedDateInput('2026-02-31 09:15')).toBeNull();
    expect(parseAgreedDateInput('2026-03-27T09:15')).toBeNull();
  });

  it('formats local dates for postgres timestamp comparisons', () => {
    const value = new Date(2026, 2, 27, 9, 15, 7);

    expect(formatPgTimestampLocal(value)).toBe('2026-03-27 09:15:07');
  });
});

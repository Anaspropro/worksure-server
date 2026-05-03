import { SanitizationService } from './sanitization.service';

describe('SanitizationService', () => {
  const service = new SanitizationService();

  it('preserves normal text that includes SQL-like words', () => {
    const input = 'Please do not drop table bookings or union select ideas';

    expect(service.sanitizeString(input)).toBe(input);
  });

  it('removes null bytes and path traversal segments', () => {
    expect(service.sanitizeString('hello\0../world')).toBe('hello/world');
  });
});

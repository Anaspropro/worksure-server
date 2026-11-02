import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from '@jest/globals';
import { RedactionService } from './redaction.service';

describe('RedactionService', () => {
  let service: RedactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedactionService],
    }).compile();

    service = module.get<RedactionService>(RedactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should redact default sensitive keys globally', () => {
    const payload = {
      username: 'johndoe',
      password: 'supersecretpassword123',
      profile: {
        ssn: '000-00-0000',
        age: 30,
      },
    };

    const redacted = service.redact(payload);

    expect(redacted.username).toBe('johndoe');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.profile.ssn).toBe('[REDACTED]');
    expect(redacted.profile.age).toBe(30);
  });

  it('should support additional deny list keys', () => {
    const payload = {
      email: 'test@example.com',
      customSecretKey: '123456',
    };

    const redacted = service.redact(payload, ['customSecretKey']);

    expect(redacted.email).toBe('test@example.com');
    expect(redacted.customSecretKey).toBe('[REDACTED]');
  });

  it('should handle arrays correctly', () => {
    const payload = {
      users: [
        { name: 'Alice', token: 'abc' },
        { name: 'Bob', token: 'def' },
      ],
    };

    const redacted = service.redact(payload);

    expect(redacted.users[0].name).toBe('Alice');
    expect(redacted.users[0].token).toBe('[REDACTED]');
    expect(redacted.users[1].name).toBe('Bob');
    expect(redacted.users[1].token).toBe('[REDACTED]');
  });

  it('should handle null or undefined safely', () => {
    expect(service.redact(null)).toBeNull();
    expect(service.redact(undefined)).toBeUndefined();
  });
});

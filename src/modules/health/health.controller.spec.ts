import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns basic health details', async () => {
    const controller = new HealthController(
      {
        $queryRaw: jest.fn(),
      } as any,
      {
        nodeEnv: 'test',
      } as any,
    );

    const result = await controller.health();

    expect(result.status).toBe('ok');
    expect(result.environment).toBe('test');
    expect(typeof result.timestamp).toBe('string');
  });

  it('reports readiness when the database query succeeds', async () => {
    const controller = new HealthController(
      {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      } as any,
      {
        nodeEnv: 'test',
      } as any,
    );

    const result = await controller.readiness();

    expect(result.status).toBe('ready');
    expect(result.checks.database).toBe('ok');
  });
});

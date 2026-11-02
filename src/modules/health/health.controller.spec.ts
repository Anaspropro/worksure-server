import { HealthController } from './health.controller';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let mockHealthCheckService: any;
  let mockPrismaHealthIndicator: any;
  let mockMemoryHealthIndicator: any;
  let mockMicroserviceHealthIndicator: any;
  let mockPrismaService: any;
  let mockAppConfigService: any;
  let mockAlertingService: any;
  let mockBullMQHealthIndicator: any;
  let controller: HealthController;

  beforeEach(() => {
    mockHealthCheckService = {
      check: jest.fn(),
    };
    mockPrismaHealthIndicator = {
      pingCheck: jest.fn(),
    };
    mockMemoryHealthIndicator = {
      checkHeap: jest.fn(),
      checkRSS: jest.fn(),
    };
    mockMicroserviceHealthIndicator = {
      pingCheck: jest.fn(),
    };
    mockPrismaService = {};
    mockAppConfigService = {
      nodeEnv: 'test',
    };
    mockAlertingService = {
      sendCriticalAlert: jest.fn(),
      resolveAlert: jest.fn(),
    };
    mockBullMQHealthIndicator = {
      isHealthy: jest.fn(),
    };

    controller = new HealthController(
      mockHealthCheckService,
      mockPrismaHealthIndicator,
      mockMemoryHealthIndicator,
      mockMicroserviceHealthIndicator,
      mockPrismaService,
      mockAppConfigService,
      mockAlertingService,
      mockBullMQHealthIndicator,
    );
  });

  it('returns basic health details', async () => {
    const result = await controller.healthCheck();

    expect(result.status).toBe('ok');
    expect(result.environment).toBe('test');
    expect(typeof result.timestamp).toBe('string');
  });

  it('reports readiness when the database query succeeds', async () => {
    const mockCheckResult = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
    mockHealthCheckService.check.mockResolvedValue(mockCheckResult);

    const result = await controller.readiness();

    expect(result.status).toBe('ok');
    expect(result.details.database.status).toBe('up');
    expect(mockAlertingService.resolveAlert).toHaveBeenCalledWith(
      'health_queues',
      expect.any(String),
    );
  });

  it('sends alerting critical message when a queue check is backed up or down', async () => {
    const mockResponse = {
      status: 'error',
      details: {
        queues: {
          status: 'backed_up',
          'email-queue': { status: 'backed_up' },
        },
      },
    };
    const mockCheckError = new ServiceUnavailableException(mockResponse);
    mockHealthCheckService.check.mockRejectedValue(mockCheckError);

    await expect(controller.readiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockAlertingService.sendCriticalAlert).toHaveBeenCalledWith(
      'health_queues',
      'Queue Processing Delay / Down',
      expect.any(String),
      expect.any(Object),
    );
  });
});

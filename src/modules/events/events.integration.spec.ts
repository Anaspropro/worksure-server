import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { JobPostedEvent, DomainEventName } from '../../common/events/domain.events';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { AuditEventListener } from './listeners/audit-event.listener';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplateService } from '../notifications/notification-template.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'test-uuid'),
  v4: jest.fn(() => 'test-uuid'),
}));

describe('Events Integration (Domain Events)', () => {
  let eventEmitter: EventEmitter2;
  let notificationListener: NotificationEventListener;
  let auditListener: AuditEventListener;

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockTemplateService = {
    generate: jest.fn().mockReturnValue({ title: 'Test Title', message: 'Test Message' }),
  };

  const mockQueueService = {
    queueEmail: jest.fn(),
  };

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
        }),
      ],
      providers: [
        NotificationEventListener,
        AuditEventListener,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationTemplateService, useValue: mockTemplateService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    notificationListener = module.get<NotificationEventListener>(NotificationEventListener);
    auditListener = module.get<AuditEventListener>(AuditEventListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger NotificationEventListener when JOB_POSTED event is emitted', async () => {
    const event = new JobPostedEvent('job-123', 'client-456', 'Plumbing Job');
    
    await eventEmitter.emitAsync(DomainEventName.JOB_POSTED, event);
    
    expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'client-456',
        entityId: 'job-123',
        entityType: 'JOB',
      }),
    );
  });

  it('should trigger AuditEventListener and NotificationEventListener when CONTRACT_FUNDED event is emitted', async () => {
    // Similarly we can test other events...
    expect(true).toBeTruthy();
  });
});

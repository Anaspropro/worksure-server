import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigService } from './config/app-config.service';
import { PrismaService } from './database/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, AppConfigService, PrismaService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should expose the architecture summary', () => {
      const summary = appController.getArchitectureSummary();

      expect(summary.project).toBe('Escrow-Based Artisan Marketplace API');
      expect(summary.architecture).toBe('Modular Monolith');
      expect(summary.modules).toHaveLength(12);
      expect(summary.modules[0].name).toBe('admin');
      expect(summary.runtime.prismaStatus).toBe('scaffolded');
    });
  });
});

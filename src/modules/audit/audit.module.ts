import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RedactionService } from './redaction.service';
import { AuditListener } from './audit.listener';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService, RedactionService, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}

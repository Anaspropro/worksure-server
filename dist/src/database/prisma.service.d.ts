import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { AppConfigService } from '../config/app-config.service';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly appConfigService;
    private readonly logger;
    private connected;
    private readonly pool?;
    constructor(appConfigService: AppConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    getStatus(): 'connected' | 'scaffolded';
    runInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

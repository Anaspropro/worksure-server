import { AppConfigService } from './config/app-config.service';
import { PrismaService } from './database/prisma.service';
export declare class AppService {
    private readonly appConfigService;
    private readonly prismaService;
    constructor(appConfigService: AppConfigService, prismaService: PrismaService);
    getArchitectureSummary(): {
        runtime: {
            port: number;
            databaseUrlConfigured: boolean;
            prismaStatus: "connected" | "scaffolded";
        };
        project: string;
        framework: string;
        orm: string;
        database: string;
        architecture: string;
        designPattern: string;
        modules: import("./common/interfaces/domain-definition.interface").DomainDefinition[];
        integrityRules: string[];
    };
}

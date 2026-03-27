import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
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

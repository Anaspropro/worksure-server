"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../generated/prisma");
const app_config_service_1 = require("../config/app-config.service");
const prisma_client_factory_1 = require("./prisma-client-factory");
let PrismaService = PrismaService_1 = class PrismaService extends prisma_1.PrismaClient {
    appConfigService;
    logger = new common_1.Logger(PrismaService_1.name);
    connected = false;
    pool;
    constructor(appConfigService) {
        const { adapter, pool } = (0, prisma_client_factory_1.createPrismaAdapter)(appConfigService.databaseUrl);
        super({
            adapter,
        });
        this.appConfigService = appConfigService;
        this.pool = pool;
    }
    async onModuleInit() {
        if (!this.appConfigService.isDatabaseConfigured) {
            this.logger.warn('DATABASE_URL is not configured yet. Prisma integration is scaffolded but not connected.');
            return;
        }
        await this.$connect();
        this.connected = true;
        this.logger.log('Prisma client connected.');
    }
    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool?.end();
        this.connected = false;
    }
    getStatus() {
        return this.connected ? 'connected' : 'scaffolded';
    }
    async runInTransaction(operation) {
        return this.$transaction(async () => operation());
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfigService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const architecture_summary_1 = require("./common/constants/architecture-summary");
const app_config_service_1 = require("./config/app-config.service");
const prisma_service_1 = require("./database/prisma.service");
let AppService = class AppService {
    appConfigService;
    prismaService;
    constructor(appConfigService, prismaService) {
        this.appConfigService = appConfigService;
        this.prismaService = prismaService;
    }
    getArchitectureSummary() {
        return {
            ...architecture_summary_1.ARCHITECTURE_SUMMARY,
            runtime: {
                port: this.appConfigService.port,
                databaseUrlConfigured: this.appConfigService.isDatabaseConfigured,
                prismaStatus: this.prismaService.getStatus(),
            },
        };
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfigService,
        prisma_service_1.PrismaService])
], AppService);
//# sourceMappingURL=app.service.js.map
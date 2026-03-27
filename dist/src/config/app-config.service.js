"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigService = void 0;
const common_1 = require("@nestjs/common");
let AppConfigService = class AppConfigService {
    get port() {
        const rawPort = process.env.PORT;
        return rawPort ? Number(rawPort) : 8000;
    }
    get databaseUrl() {
        return process.env.DATABASE_URL;
    }
    get isDatabaseConfigured() {
        return Boolean(this.databaseUrl);
    }
    get jwtSecret() {
        return process.env.JWT_SECRET || 'worksure-dev-jwt-secret';
    }
    get jwtExpiresIn() {
        return (process.env.JWT_EXPIRES_IN || '1d');
    }
};
exports.AppConfigService = AppConfigService;
exports.AppConfigService = AppConfigService = __decorate([
    (0, common_1.Injectable)()
], AppConfigService);
//# sourceMappingURL=app-config.service.js.map
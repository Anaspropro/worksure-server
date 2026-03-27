"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const admin_module_1 = require("./modules/admin/admin.module");
const artisan_module_1 = require("./modules/artisan/artisan.module");
const auth_module_1 = require("./modules/auth/auth.module");
const contracts_module_1 = require("./modules/contracts/contracts.module");
const disputes_module_1 = require("./modules/disputes/disputes.module");
const jobs_module_1 = require("./modules/jobs/jobs.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const payments_module_1 = require("./modules/payments/payments.module");
const proposals_module_1 = require("./modules/proposals/proposals.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
const users_module_1 = require("./modules/users/users.module");
const wallet_module_1 = require("./modules/wallet/wallet.module");
const app_config_module_1 = require("./config/app-config.module");
const prisma_module_1 = require("./database/prisma.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            app_config_module_1.AppConfigModule,
            prisma_module_1.PrismaModule,
            admin_module_1.AdminModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            artisan_module_1.ArtisanModule,
            jobs_module_1.JobsModule,
            proposals_module_1.ProposalsModule,
            contracts_module_1.ContractsModule,
            wallet_module_1.WalletModule,
            payments_module_1.PaymentsModule,
            reviews_module_1.ReviewsModule,
            disputes_module_1.DisputesModule,
            notifications_module_1.NotificationsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
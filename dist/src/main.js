"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_config_service_1 = require("./config/app-config.service");
const app_setup_1 = require("./app.setup");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const appConfigService = app.get(app_config_service_1.AppConfigService);
    (0, app_setup_1.configureApp)(app);
    await app.listen(appConfigService.port);
}
bootstrap();
//# sourceMappingURL=main.js.map
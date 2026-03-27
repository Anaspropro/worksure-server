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
exports.ResolveDisputeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ResolveDisputeDto {
    decision;
    notes;
}
exports.ResolveDisputeDto = ResolveDisputeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['REFUND_CLIENT', 'PAY_ARTISAN'],
        example: 'REFUND_CLIENT',
    }),
    (0, class_validator_1.IsEnum)(['REFUND_CLIENT', 'PAY_ARTISAN']),
    __metadata("design:type", String)
], ResolveDisputeDto.prototype, "decision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Evidence supports a full refund.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ResolveDisputeDto.prototype, "notes", void 0);
//# sourceMappingURL=resolve-dispute.dto.js.map
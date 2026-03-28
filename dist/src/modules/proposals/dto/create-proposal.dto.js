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
exports.ProposalActionDto = exports.ProposalListQueryDto = exports.ProposalResponseDto = exports.UpdateProposalDto = exports.CreateProposalDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const prisma_1 = require("../../../generated/prisma");
class CreateProposalDto {
    jobId;
    message;
    amount;
}
exports.CreateProposalDto = CreateProposalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job ID' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProposalDto.prototype, "jobId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposal message' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProposalDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposed amount' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateProposalDto.prototype, "amount", void 0);
class UpdateProposalDto {
    message;
    amount;
}
exports.UpdateProposalDto = UpdateProposalDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Proposal message' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProposalDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Proposed amount' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateProposalDto.prototype, "amount", void 0);
class ProposalResponseDto {
    id;
    jobId;
    message;
    amount;
    status;
    createdAt;
    updatedAt;
    job;
    client;
    artisan;
}
exports.ProposalResponseDto = ProposalResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposal ID' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job ID' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "jobId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposal message' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposed amount' }),
    __metadata("design:type", Number)
], ProposalResponseDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Proposal status' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Creation date' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Last update date' }),
    __metadata("design:type", String)
], ProposalResponseDto.prototype, "updatedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job information' }),
    __metadata("design:type", Object)
], ProposalResponseDto.prototype, "job", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Client information' }),
    __metadata("design:type", Object)
], ProposalResponseDto.prototype, "client", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Artisan information' }),
    __metadata("design:type", Object)
], ProposalResponseDto.prototype, "artisan", void 0);
class ProposalListQueryDto {
    status;
    jobId;
    clientId;
    artisanId;
    search;
    page = 1;
    limit = 10;
}
exports.ProposalListQueryDto = ProposalListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(prisma_1.ProposalStatus),
    __metadata("design:type", String)
], ProposalListQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by job ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProposalListQueryDto.prototype, "jobId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by client ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProposalListQueryDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by artisan ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProposalListQueryDto.prototype, "artisanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Search in message and notes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProposalListQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Page number (default: 1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProposalListQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Items per page (default: 10, max: 100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProposalListQueryDto.prototype, "limit", void 0);
class ProposalActionDto {
    notes;
}
exports.ProposalActionDto = ProposalActionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Action notes (for rejection)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProposalActionDto.prototype, "notes", void 0);
//# sourceMappingURL=create-proposal.dto.js.map
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
exports.JobListQueryDto = exports.JobResponseDto = exports.UpdateJobDto = exports.CreateJobDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const prisma_1 = require("../../../generated/prisma");
class CreateJobDto {
    title;
    description;
    budget;
    location;
    requiredSkills;
    category;
    deadline;
    requirements;
}
exports.CreateJobDto = CreateJobDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job title' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job description' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job budget' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateJobDto.prototype, "budget", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Location of the job' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required skills for the job' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateJobDto.prototype, "requiredSkills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job category' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job deadline' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "deadline", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Additional job requirements' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateJobDto.prototype, "requirements", void 0);
class UpdateJobDto {
    title;
    description;
    budget;
    location;
    requiredSkills;
    category;
    deadline;
    status;
    requirements;
}
exports.UpdateJobDto = UpdateJobDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job title' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job description' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job budget' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateJobDto.prototype, "budget", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job location' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required skills for the job' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateJobDto.prototype, "requiredSkills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job category' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job deadline' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "deadline", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(prisma_1.JobStatus),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Additional job requirements' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateJobDto.prototype, "requirements", void 0);
class JobResponseDto {
    id;
    title;
    description;
    budget;
    location;
    requiredSkills;
    category;
    deadline;
    requirements;
    status;
    client;
    artisan;
    contract;
    createdAt;
    updatedAt;
}
exports.JobResponseDto = JobResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job ID' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job title' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job description' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job budget' }),
    __metadata("design:type", Number)
], JobResponseDto.prototype, "budget", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job location' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Required skills' }),
    __metadata("design:type", Array)
], JobResponseDto.prototype, "requiredSkills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job category' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job deadline' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "deadline", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Job requirements' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "requirements", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job status' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Client information' }),
    __metadata("design:type", Object)
], JobResponseDto.prototype, "client", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Assigned artisan' }),
    __metadata("design:type", Object)
], JobResponseDto.prototype, "artisan", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Contract information' }),
    __metadata("design:type", Object)
], JobResponseDto.prototype, "contract", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Creation date' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Last update date' }),
    __metadata("design:type", String)
], JobResponseDto.prototype, "updatedAt", void 0);
class JobListQueryDto {
    status;
    clientId;
    artisanId;
    category;
    search;
    page = 1;
    limit = 10;
}
exports.JobListQueryDto = JobListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by status' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(prisma_1.JobStatus),
    __metadata("design:type", String)
], JobListQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by client ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobListQueryDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by artisan ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobListQueryDto.prototype, "artisanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by category' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobListQueryDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Search in title and description' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobListQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Page number (default: 1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], JobListQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Items per page (default: 10, max: 100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], JobListQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=create-job.dto.js.map
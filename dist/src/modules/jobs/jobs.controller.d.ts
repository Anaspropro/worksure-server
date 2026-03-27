import { PrismaService } from '../../database/prisma.service';
import { CreateJobDto, UpdateJobDto, JobResponseDto, JobListQueryDto } from './dto/create-job.dto';
import { $Enums } from '../../generated/prisma';
export declare class JobsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureClientRole;
    private ensureOwnerOrAdmin;
    createJob(user: {
        id: string;
        role: $Enums.UserRole;
    }, createDto: CreateJobDto): Promise<JobResponseDto>;
    listJobs(query: JobListQueryDto): Promise<{
        jobs: JobResponseDto[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getJob(id: string): Promise<JobResponseDto>;
    updateJob(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string, updateDto: UpdateJobDto): Promise<JobResponseDto>;
    deleteJob(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string): Promise<{
        message: string;
    }>;
    assignArtisan(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string, body: {
        artisanId: string;
    }): Promise<JobResponseDto>;
    private formatJobResponse;
}

import { JobStatus } from '../../../generated/prisma';
export declare class CreateJobDto {
    title: string;
    description: string;
    budget?: number;
    location?: string;
    requiredSkills?: string[];
    category?: string;
    deadline?: string;
    requirements?: string;
}
export declare class UpdateJobDto {
    title?: string;
    description?: string;
    budget?: number;
    location?: string;
    requiredSkills?: string[];
    category?: string;
    deadline?: string;
    status?: JobStatus;
    requirements?: string;
}
export declare class JobResponseDto {
    id: string;
    title: string;
    description?: string;
    budget: number;
    location?: string;
    requiredSkills?: string[];
    category?: string;
    deadline?: string;
    requirements?: string;
    status: JobStatus;
    client: {
        id: string;
        name: string;
        email: string;
    };
    artisan?: {
        id: string;
        name: string;
        email: string;
    };
    contract?: {
        id: string;
        status: string;
        amount: number;
    };
    createdAt: string;
    updatedAt: string;
}
export declare class JobListQueryDto {
    status?: JobStatus;
    clientId?: string;
    artisanId?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
}

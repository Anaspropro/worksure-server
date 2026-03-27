import { ProposalStatus } from '../../../generated/prisma';
export declare class CreateProposalDto {
    jobId: string;
    message: string;
    amount: number;
}
export declare class UpdateProposalDto {
    message?: string;
    amount?: number;
}
export declare class ProposalResponseDto {
    id: string;
    jobId: string;
    message: string;
    amount: number;
    status: ProposalStatus;
    createdAt: string;
    updatedAt: string;
    job: {
        id: string;
        title: string;
        description?: string;
        budget: number;
        status: string;
    };
    client: {
        id: string;
        name: string;
        email: string;
    };
    artisan: {
        id: string;
        name: string;
        email: string;
    };
}
export declare class ProposalListQueryDto {
    status?: ProposalStatus;
    jobId?: string;
    clientId?: string;
    artisanId?: string;
    search?: string;
    page?: number;
    limit?: number;
}
export declare class ProposalActionDto {
    notes?: string;
}

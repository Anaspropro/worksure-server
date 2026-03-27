import { PrismaService } from '../../database/prisma.service';
import { CreateProposalDto, UpdateProposalDto, ProposalResponseDto, ProposalListQueryDto, ProposalActionDto } from './dto/create-proposal.dto';
import { $Enums } from '../../generated/prisma';
export declare class ProposalsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureArtisanRole;
    private ensureClientRole;
    private ensureOwnerOrAdmin;
    private ensureJobOwnerOrAdmin;
    createProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, createDto: CreateProposalDto): Promise<ProposalResponseDto>;
    listProposals(query: ProposalListQueryDto): Promise<{
        proposals: ProposalResponseDto[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getProposal(id: string): Promise<ProposalResponseDto>;
    updateProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string, updateDto: UpdateProposalDto): Promise<ProposalResponseDto>;
    withdrawProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string): Promise<{
        message: string;
    }>;
    acceptProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string): Promise<ProposalResponseDto>;
    rejectProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string, body: ProposalActionDto): Promise<ProposalResponseDto>;
    deleteProposal(user: {
        id: string;
        role: $Enums.UserRole;
    }, id: string): Promise<{
        message: string;
    }>;
    private formatProposalResponse;
}

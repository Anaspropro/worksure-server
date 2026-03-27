import { $Enums } from '../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
import { CreateArtisanProfileDto, UpdateArtisanProfileDto, ArtisanProfileResponseDto } from './dto/create-artisan-profile.dto';
export declare class ArtisanController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureArtisanRole;
    createArtisanProfile(user: {
        id: string;
        role: $Enums.UserRole;
    }, createDto: CreateArtisanProfileDto): Promise<ArtisanProfileResponseDto>;
    getCurrentArtisanProfile(user: {
        id: string;
        role: $Enums.UserRole;
    }): Promise<ArtisanProfileResponseDto>;
    updateArtisanProfile(user: {
        id: string;
        role: $Enums.UserRole;
    }, updateDto: UpdateArtisanProfileDto): Promise<ArtisanProfileResponseDto>;
    getArtisanProfileByUserId(userId: string): Promise<ArtisanProfileResponseDto>;
}

export declare class UpdateUserProfileDto {
    name?: string;
}
export declare class UserProfileResponseDto {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    artisanVerified: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    artisanProfile?: {
        id: string;
        bio: string | null;
        skills: any;
        experience: string | null;
        portfolio: any;
        verified: boolean;
        rating: number | null;
        reviewCount: number;
    } | null;
}

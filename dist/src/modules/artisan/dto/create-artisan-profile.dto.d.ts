export declare class CreateArtisanProfileDto {
    bio?: string;
    skills?: string[];
    experience?: string;
    portfolio?: string[];
}
export declare class UpdateArtisanProfileDto {
    bio?: string;
    skills?: string[];
    experience?: string;
    portfolio?: string[];
}
export declare class ArtisanProfileResponseDto {
    id: string;
    userId: string;
    bio: string | null;
    skills: any;
    experience: string | null;
    portfolio: any;
    verified: boolean;
    rating: number | null;
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

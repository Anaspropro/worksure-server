import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateContractDto {
  @Matches(
    /^(prp_[A-Za-z0-9_]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    {
      message:
        'proposalId must be a seeded proposal id like prp_001 or a UUID',
    },
  )
  proposalId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

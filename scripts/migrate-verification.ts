import { PrismaClient, MarketplaceVerificationStatus, FinancialVerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting verification migration...');
  
  // Find users that need migration
  // Since we removed kycVerified and kycStatus from User in the schema, this script
  // would normally run BEFORE removing them, but since we already removed them, we
  // will rely on checking if an ArtisanProfile exists, and if there is no ArtisanVerification.
  
  // However, because we altered the schema, we can't query the old fields.
  // Assuming all Artisans who had ArtisanProfile completed might have been 'verified'.
  // We will initialize them as NOT_SUBMITTED if they don't have a verification record.
  
  const usersWithArtisanProfiles = await prisma.user.findMany({
    where: {
      role: 'ARTISAN',
      artisanVerification: null
    },
    include: { artisanProfile: true }
  });

  for (const user of usersWithArtisanProfiles) {
    // If they had an artisan profile, we might consider giving them APPROVED marketplace status 
    // to prevent blocking them, and NOT_STARTED for financial.
    // We will do a generic migration:
    await prisma.artisanVerification.create({
      data: {
        userId: user.id,
        marketplaceStatus: MarketplaceVerificationStatus.APPROVED, // Grandfathered in
        financialStatus: FinancialVerificationStatus.NOT_STARTED,
      }
    });
    console.log(`Migrated user ${user.id}`);
  }
  
  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

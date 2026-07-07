# WorkSure Database Rollback Strategy

## Overview
Because Prisma does not support native `down` migrations (`prisma migrate down`), rolling back database changes in a production environment requires a careful, manual procedure to avoid data loss.

## Migration Approval Gate
All changes pushed to `main` or `master` trigger the `.github/workflows/deploy.yml` pipeline.
1. **Migration Plan**: The `migration-plan` job generates the status of pending migrations against the production database (`npx prisma migrate status`).
2. **Approval**: The deployment is paused at the `production` GitHub Environment. An administrator MUST review the migration plan before approving the deployment.

## Rollback Procedure

If a deployed migration causes critical production issues, follow these steps to execute a safe rollback:

### Strategy 1: Forward-Fix (Recommended)
The safest way to revert schema changes is to roll them forward.
1. Revert the problematic PR locally using Git.
2. Create a new migration that undoes the changes:
   ```bash
   npx prisma migrate dev --name revert_previous_migration
   ```
3. Commit and push the new migration to `main`. This preserves the migration history linearly.

### Strategy 2: Manual SQL Rollback (Emergency Only)
If a forward fix takes too long, you can manually revert the schema.
1. Connect to the production database via a secure SQL client (e.g., TablePlus, psql).
2. Execute the necessary `DROP TABLE`, `ALTER TABLE`, or reverse schema modifications directly.
3. Update the `_prisma_migrations` table to mark the problematic migration as rolled back:
   ```bash
   npx prisma migrate resolve --rolled-back "20231010120000_problematic_migration"
   ```
4. Revert the application code to the previous safe commit and deploy.

> **WARNING**: Strategy 2 can lead to data loss. Ensure you have automated backups enabled in your database provider (e.g., Railway/Supabase) before running manual `DROP` or `ALTER` queries.

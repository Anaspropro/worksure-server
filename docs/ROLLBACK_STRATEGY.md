# WorkSure Database Rollback Strategy

## Overview
Because Prisma does not support native `down` migrations (`prisma migrate down`), rolling back database changes in a production environment requires a careful, manual procedure to avoid data loss.

## Migration Approval Gate
All changes pushed to the production branch trigger the GitHub Actions deployment pipeline (`.github/workflows/deploy.yml`).

1. **Dry-Run Status Check**: The pipeline runs `npx prisma migrate status` against the live production database to inspect pending migrations.
2. **Manual Approval Gate**: The pipeline pauses deployment and requires a manual approval from the Lead Architect or SRE team before proceeding to execute `npx prisma migrate deploy` in the production environment.

### SRE Checklist Before Approving Deployment:
- [ ] Review the PR git log to check if the schema modification has destructive SQL statements (e.g. `DROP COLUMN`, `ALTER TABLE ... DROP CONSTRAINT`).
- [ ] Confirm if the migration requires database downtime (such as adding indexes on a massive production table).
- [ ] Verify that a snapshot backup of the database has successfully completed within the last 1 hour.
- [ ] If the migration contains schema-breaking changes, ensure that the application code has been pre-deployed in a backwards-compatible manner (two-phase deploy).

---

## Rollback Procedure

If a deployed migration causes critical production issues (e.g., locking tables or throwing exceptions), follow these steps to execute a safe rollback:

### Strategy 1: Forward-Fix (Recommended)
This is the safest way to revert schema changes by preserving a linear history.
1. Revert the problematic PR locally using Git:
   ```bash
   git revert <commit-hash>
   ```
2. Generate a new migration to undo the schema alterations:
   ```bash
   npx prisma migrate dev --name revert_previous_migration
   ```
3. Push the new migration commit to your release branch. It will pass through the Manual Approval Gate and cleanly restore the database.

### Strategy 2: Manual SQL Rollback (Emergency Only)
If the application is completely offline and a forward fix takes too long:
1. Connect to the production database via a secure terminal or SQL client.
2. Execute the manual undo SQL statements directly (e.g., recreating dropped columns or dropping bad indexes).
3. Re-align Prisma's migration history by marking the failed migration as rolled back:
   ```bash
   npx prisma migrate resolve --rolled-back "20260706143700_deprecate_wallet"
   ```
4. Revert the backend application container image to the previous stable release tag and restart.

> [!WARNING]
> Manual SQL rollbacks bypass standard safety rails. Always test Strategy 2 in a staging environment prior to executing against production. Ensure backup snapshots are actively maintained.


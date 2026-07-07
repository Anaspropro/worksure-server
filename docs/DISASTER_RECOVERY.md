# WorkSure Disaster Recovery Playbook

This document serves as the official playbook for the SRE and DevOps teams to handle major system failures, third-party outages, or data corruption events on the WorkSure platform.

---

## 1. PostgreSQL Database Recovery

PostgreSQL holds the authoritative ledger and user details. If it becomes corrupted or unavailable, follow this procedure to restore service.

### Scenario A: Restoring from a Automated Snapshot (Cloud Provider)
If you are deploying on a managed platform like Supabase or Railway:
1. Log into your dashboard.
2. Select your PostgreSQL database and go to **Backups**.
3. Identify the target snapshot timestamp (RPO).
4. Click **Restore Backup** or choose **Point-in-Time Recovery (PITR)** to provision a temporary clean database.
5. Swap the `DATABASE_URL` environment variable on the backend to point to the restored instance.

### Scenario B: Manual Backup Restoration
If you are managing your own database server and need to restore from a `.sql` or custom-format dump:
```bash
# 1. Terminate all active connections to the target database
psql -h $DB_HOST -U $DB_USER -d postgres -c \
"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'worksure' AND pid <> pg_backend_pid();"

# 2. Recreate the database schema cleanly
psql -h $DB_HOST -U $DB_USER -d postgres -c "DROP DATABASE worksure;"
psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE worksure;"

# 3. Restore from the latest pg_dump file
pg_restore -h $DB_HOST -U $DB_USER -d worksure -F c /path/to/backup_file.dump
```

---

## 2. Redis Outage

Redis is used for account lockout, rate limiting, session storage, webhook idempotency locks, and BullMQ queues.

### Expected Impact
- All active WebSocket connections will disconnect.
- Background email delivery (Resend) and payout processing (Paystack transfers) will stall immediately.
- Users attempting to log in will experience transient failures (fail-closed brute-force safety triggers).

### Recovery Steps
1. **Restart/Provision Redis**: If Redis crashed, attempt to restart the container/service. If deploying to a managed Redis cluster, trigger a failover to a healthy replica.
2. **Re-queue Stalled Jobs**: Once Redis is back online, BullMQ will automatically attempt to resume processing. You can run the following commands to check stalled job counts:
   ```bash
   # Connect to Redis CLI and verify keys
   redis-cli -u $REDIS_URL
   keys *bull*
   ```
3. **Queue Monitoring**: If queues remain stuck:
   - Check application logs to identify if a particular worker crashed.
   - Force-restart the NestJS application to trigger BullMQ initialization hooks.

---

## 3. Paystack Outage

If Paystack experiences a service degradation or complete outage:
- New contract fundings will fail.
- Webhook endpoints `/payments/paystack/webhook` will not receive transaction reports.
- Ongoing transfers (payouts to artisans) will stall.

### Handling Delayed Webhooks
If Paystack was down and then recovers, it may re-send accumulated webhooks. 
- **Idempotency Protection**: The backend's `IdempotencyService` protects against duplicated delivery.
- **Manual Verification**: If a user reports a deposit/payment was made but did not reflect:
  1. Authenticate as an Admin on the system.
  2. Perform a GET query to `https://api.paystack.co/transaction/verify/:reference` with the transaction ID.
  3. Re-run the transaction reconciliation job manually via the admin REST endpoint:
     ```bash
     curl -X POST https://api.worksure.dev/admin/reconciliation/trigger \
       -H "Authorization: Bearer <ADMIN_JWT>"
     ```
  4. Review the returned reconciliation report to ensure the user's `LedgerAccount` balance matches the actual virtual account obligation.

---

## 4. Disaster Recovery Checklist

| Step | Action | Time Target |
| :--- | :--- | :--- |
| **1** | Identify issue via Sentry / Prometheus alerting (stalled queues or 500 error spikes). | < 5 mins |
| **2** | Check external status pages (status.paystack.com, status.railway.app). | < 10 mins |
| **3** | Initiate database PITR or Redis failover if primary instances are corrupted. | < 20 mins |
| **4** | Once systems are online, trigger a manual Financial Reconciliation check. | < 30 mins |
| **5** | Verify user auth and WebSocket connections in the frontend app dashboard. | < 45 mins |

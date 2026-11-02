-- ====================================================================
-- PostgreSQL Row-Level Security (RLS) Policies for WorkSure
-- Enforces tenant & user isolation at the database engine layer.
-- ====================================================================

-- 1. Helper Functions for RLS Evaluation
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin_or_bypass() RETURNS BOOLEAN AS $$
  SELECT (
    current_setting('app.bypass_rls', true) = 'on'
    OR current_setting('app.current_user_role', true) = 'ADMIN'
    OR NULLIF(current_setting('app.current_user_id', true), '') IS NULL
  );
$$ LANGUAGE sql STABLE;

-- 2. Contract Table RLS
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contract_isolation_policy" ON "Contract";
CREATE POLICY "contract_isolation_policy" ON "Contract"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "clientId" = app_current_user_id()
    OR "artisanId" = app_current_user_id()
  );

-- 3. Proposal Table RLS
ALTER TABLE "Proposal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposal_select_policy" ON "Proposal";
CREATE POLICY "proposal_select_policy" ON "Proposal"
  FOR SELECT
  USING (
    app_is_admin_or_bypass()
    OR "artisanId" = app_current_user_id()
    OR "clientId" = app_current_user_id()
  );

DROP POLICY IF EXISTS "proposal_modify_policy" ON "Proposal";
CREATE POLICY "proposal_modify_policy" ON "Proposal"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "artisanId" = app_current_user_id()
  );

-- 4. Job Table RLS
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_select_policy" ON "Job";
CREATE POLICY "job_select_policy" ON "Job"
  FOR SELECT
  USING (
    app_is_admin_or_bypass()
    OR "status" = 'OPEN'
    OR "clientId" = app_current_user_id()
  );

DROP POLICY IF EXISTS "job_modify_policy" ON "Job";
CREATE POLICY "job_modify_policy" ON "Job"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "clientId" = app_current_user_id()
  );

-- 5. Payment Table RLS
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_isolation_policy" ON "Payment";
CREATE POLICY "payment_isolation_policy" ON "Payment"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "userId" = app_current_user_id()
  );

-- 6. LedgerAccount Table RLS
ALTER TABLE "LedgerAccount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_account_isolation_policy" ON "LedgerAccount";
CREATE POLICY "ledger_account_isolation_policy" ON "LedgerAccount"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "userId" = app_current_user_id()
  );

-- 7. LedgerEntry Table RLS
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_entry_isolation_policy" ON "LedgerEntry";
CREATE POLICY "ledger_entry_isolation_policy" ON "LedgerEntry"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR EXISTS (
      SELECT 1 FROM "LedgerAccount" la
      WHERE (la.id = "LedgerEntry"."debitAccountId" OR la.id = "LedgerEntry"."creditAccountId")
        AND la."userId" = app_current_user_id()
    )
  );

-- 8. KycDocument Table RLS
ALTER TABLE "KycDocument" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyc_document_isolation_policy" ON "KycDocument";
CREATE POLICY "kyc_document_isolation_policy" ON "KycDocument"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "userId" = app_current_user_id()
  );

-- 9. Notification Table RLS
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_isolation_policy" ON "Notification";
CREATE POLICY "notification_isolation_policy" ON "Notification"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "userId" = app_current_user_id()
  );

-- 10. Conversation Table RLS
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversation_isolation_policy" ON "Conversation";
CREATE POLICY "conversation_isolation_policy" ON "Conversation"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "clientId" = app_current_user_id()
    OR "artisanId" = app_current_user_id()
  );

-- 11. Message Table RLS
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_isolation_policy" ON "Message";
CREATE POLICY "message_isolation_policy" ON "Message"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "senderId" = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "Conversation" c
      WHERE c.id = "Message"."conversationId"
        AND (c."clientId" = app_current_user_id() OR c."artisanId" = app_current_user_id())
    )
  );

-- 12. Dispute Table RLS
ALTER TABLE "Dispute" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dispute_isolation_policy" ON "Dispute";
CREATE POLICY "dispute_isolation_policy" ON "Dispute"
  FOR ALL
  USING (
    app_is_admin_or_bypass()
    OR "clientId" = app_current_user_id()
    OR "artisanId" = app_current_user_id()
  );

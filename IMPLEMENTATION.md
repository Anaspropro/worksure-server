# Fintech-Grade Architectural Overhaul

## Proposed Changes: Phase 1 (Financial State & Idempotency Baseline)

Phase 1 establishes the bedrock of financial reliability: strict state enforcement, double-entry accounting at the database level, and webhook idempotency.

### 1. Database Schema (schema.prisma)

[MODIFY] 
schema.prisma
Add IdempotencyKey model to persistently track processed webhooks and critical requests (prevents Replay Attacks & Double execution).
Add LedgerEntry model to natively enforce Double-Entry Accounting (debitAccountId, creditAccountId, amount, reference). Ensuring Total Debits = Total Credits.
Add robust PAYMENT_FAILED and EXPIRED to the ContractStatus enums.

### 2. Idempotency Layer & Webhooks

[MODIFY] 
webhook-signature.service.ts
Currently, isEventProcessed and markEventProcessed are empty stubs. We will implement them aggressively using the new PostgreSQL IdempotencyKey table to silently drop duplicate/replayed payloads.

### 3. Strict State Machine Enforcement

[MODIFY] 
contracts.service.ts
Re-architect state guards to be an explicit, immutable flow mapping. Ensure terminal states (REFUNDED, PAID_OUT, CANCELLED) permanently lock out any incoming webhooks or user mutations.

### 4. Double-Entry Accounting Setup

[MODIFY] 
payments.service.ts
Transition away from loosely coupled Transaction writes toward writing atomic LedgerEntry rows. For example, when an escrow is funded, Debit Client -> Credit Escrow. When paid out, Debit Escrow -> Credit Artisan.

## Phase 2: Accountability & Disputes

[Audit Logging] Wire a NestJS interceptor to capture exactly who caused what state transition, recording the before_state and after_state in the AuditLog table.
[Dispute Engine] Refactor disputes into their own heavily-guarded State Machine (OPENED ➔ EVIDENCE_UPLOADING ➔ RESOLVED).

## Phase 3: Infrastructure Upgrades (Async & Escrow Automation)

[Event Emitters] Install @nestjs/event-emitter to decouple Modules.
[Cron Tasks] Install @nestjs/schedule to run background Nightly Reconciliations (checking internal DB ledgers against Paystack balances), automatic dead-contract expiration, and auto-disbursement for ghosted clients.
[Redis] Introduce true async job durability for off-loading heavy network tasks and applying exponential retries to failed payouts.

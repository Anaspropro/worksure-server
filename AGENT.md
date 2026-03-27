# Phase 1

Build the missing core data model first.

## Files to update:

schema.prisma
seed-data.ts
seed.ts

## Files to create:

prisma/migrations/...

## Checklist:

Add ArtisanProfile model.
Add Proposal model.
Add Contract model and lifecycle enum.
Add Wallet model.
Add Review model.
Expand Transaction to match escrow lifecycle needs.
Add contract completion confirmation fields.
Add indexes and foreign keys for workflow-critical lookups.
Seed representative users, jobs, proposals, contracts, wallets, disputes, and transactions.
No public endpoints yet in this phase.

# Phase 2

Finish user and artisan profile foundations.

## Files to update:

users.module.ts
users.service.ts
artisan.module.ts
artisan.service.ts
Files to create:

users.controller.ts
dto/update-user-profile.dto.ts
artisan.controller.ts
dto/create-artisan-profile.dto.ts
dto/update-artisan-profile.dto.ts

## Checklist:

Add current-user profile fetch.
Add profile update.
Add admin-safe user fetch/list if needed outside admin module.
Add artisan profile creation.
Add artisan bio/skills update.
Add artisan profile fetch.
Enforce ARTISAN role rules.

## Endpoints:

GET /users/me
PATCH /users/me
GET /users/:id
POST /artisan/profile
GET /artisan/profile/me
GET /artisan/:userId
PATCH /artisan/profile

# Phase 3

Implement jobs.

## Files to update:

jobs.module.ts
jobs.service.ts
Files to create:

jobs.controller.ts
dto/create-job.dto.ts
dto/update-job.dto.ts
dto/query-jobs.dto.ts

## Checklist:

Create job.
Update job.
Delete job.
List jobs with filters.
Fetch single job.
Restrict edits to job owner while open.
Add job status transitions.

## Endpoints:

POST /jobs
GET /jobs
GET /jobs/:id
PATCH /jobs/:id
DELETE /jobs/:id
PATCH /jobs/:id/status

# Phase 4

Implement proposals and automatic contract creation.

## Files to update:

proposals.module.ts
proposals.service.ts
contracts.module.ts
contracts.service.ts

## Files to create:

proposals.controller.ts
dto/create-proposal.dto.ts
dto/update-proposal-status.dto.ts
contracts.controller.ts

## Checklist:

Submit proposal.
List job proposals.
List artisan proposals.
Accept proposal.
Reject proposal.
Automatically create contract on acceptance.
Enforce one active contract per job.
Add contract retrieval endpoints.

## Endpoints:

POST /jobs/:jobId/proposals
GET /jobs/:jobId/proposals
GET /proposals/me
PATCH /proposals/:id/accept
PATCH /proposals/:id/reject
GET /contracts/:id
GET /contracts/me
PATCH /contracts/:id/status

# Phase 5

Implement wallets and the transaction ledger.

## Files to update:

wallet.module.ts
wallet.service.ts

## Files to create:

wallet.controller.ts
dto/query-wallet-transactions.dto.ts

## Checklist:

Create wallet on user onboarding or lazily on first access.
Return wallet balance.
Return wallet transaction history.
Centralize credit/debit helpers in service.
Prevent direct balance mutation outside wallet service.
Make transactions immutable.

## Endpoints:

GET /wallet
GET /wallet/transactions

# Phase 6

Implement funding, escrow, completion, and release.

## Files to update:

payments.module.ts
payments.service.ts
contracts.service.ts

## Files to create:

payments.controller.ts
dto/initiate-funding.dto.ts
dto/verify-funding.dto.ts
dto/activate-contract.dto.ts
dto/mark-completion.dto.ts
Checklist:

Initiate wallet funding.
Verify funding.
Credit wallet.
Activate contract and move funds to escrow.
Mark client completion.
Mark artisan confirmation.
Release funds after dual confirmation.
Deduct platform fee.
Prevent double release.
Wrap all financial changes in DB transactions.

## Endpoints:

POST /payments/fund-wallet
POST /payments/verify-wallet-funding
POST /contracts/:id/activate
PATCH /contracts/:id/complete/client
PATCH /contracts/:id/complete/artisan
POST /contracts/:id/release-payment

# Phase 7

Finish user-side disputes.

Files to update:

disputes.module.ts
disputes.service.ts
Files to create:

disputes.controller.ts
dto/create-dispute.dto.ts
dto/query-disputes.dto.ts
Checklist:

Raise dispute from eligible contract/job state.
Store evidence payloads.
Fetch user disputes.
Fetch single dispute and history.
Reuse current admin resolution path.
Endpoints:

POST /disputes
GET /disputes/me
GET /disputes/:id

# Phase 8

Implement reviews.

Files to update:

reviews.module.ts
reviews.service.ts
Files to create:

reviews.controller.ts
dto/create-review.dto.ts
Checklist:

Create review after successful completion.
Restrict review eligibility to contract participants.
Fetch reviews by artisan/user/job.
Endpoints:

POST /reviews
GET /reviews/artisan/:artisanId
GET /reviews/job/:jobId

# Phase 9

Expand notifications beyond simple inserts.

Files to update:

notifications.module.ts
notifications.service.ts
Files to create:

notifications.controller.ts
Checklist:

Create notification helper methods for major domain events.
Add user notification listing.
Add mark-as-read if desired.
Hook into proposal acceptance, disputes, funding, release, auth reset, and admin actions.
Endpoints:

GET /notifications
PATCH /notifications/:id/read

# Phase 10

Testing and hardening.

Files to create:

jobs.service.spec.ts
proposals.service.spec.ts
contracts.service.spec.ts
wallet.service.spec.ts
payments.service.spec.ts
jobs.e2e-spec.ts
proposals.e2e-spec.ts
contracts.e2e-spec.ts
payments.e2e-spec.ts
disputes.e2e-spec.ts
Checklist:

Add unit tests for state transition logic.
Add e2e tests for full job-to-payment happy path.
Add double-payment prevention coverage.
Add invalid contract transition coverage.
Add unauthorized access coverage per module.
Add dispute refund/payout branching coverage.
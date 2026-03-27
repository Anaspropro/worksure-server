# 1. 🏗️ Backend: Admin Module Structure

## Module Name: admin

## Responsibilities -

### 1. User Management

  View all users (clients and artisans)
  Ban/unban users
  Verify artisan profiles
  Reset user passwords (optional)

### 2. Dispute Management

  View all disputes
  Review evidence (images, videos, messages)
  Resolve disputes:
    Refund client
    Pay artisan
  Track dispute history

### 3. Job Oversight

  View all jobs and contracts
  Force-close jobs if needed (fraud detection)
  Monitor suspicious activities

### 4. Transaction Monitoring

  View all wallet transactions
  Monitor escrow funds
  Confirm platform fees collected
  Detect anomalies

### 5. Reporting

  Generate reports:
    Number of jobs per month
    Platform earnings
    Active disputes
    Top artisans
  Export as CSV/Excel (optional)

## Services Inside Admin Module

### AdminService

  getAllUsers()
  banUser(userId)
  unbanUser(userId)
  verifyArtisan(userId)
  getAllDisputes()
  resolveDispute(disputeId, decision)
  getAllJobs()
  getAllTransactions()
  generateReports(reportType, filters)

## Rules

  Only users with role ADMIN can access these APIs.
  All admin actions must be logged (audit log).
  Dispute resolution must trigger wallet updates and notifications.
  Admin cannot modify funds outside escrow rules.
  Sensitive actions must be validated in backend before execution.

## API Examples

### Endpoint Method Description

  /admin/users GET List all users
  /admin/users/:id/ban PATCH Ban user
  /admin/users/:id/unban PATCH Unban user
  /admin/users/:id/verify PATCH Verify artisan
  /admin/disputes GET List all disputes
  /admin/disputes/:id/resolve PATCH Resolve dispute
  /admin/jobs GET View all jobs
  /admin/transactions GET View all transactions
  /admin/reports GET Generate report

## Core Workflows

### User Management

  Admin fetches users
  Admin takes action (ban/unban/verify)
  Backend updates database
  Audit log created

## Dispute Resolution

Admin fetches disputes
Admin reviews evidence
Admin resolves dispute
Backend updates wallets and contracts
Notifications sent to involved parties

## Reporting

Admin requests report
Backend aggregates data
API returns formatted report

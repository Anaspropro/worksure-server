import { DomainDefinition } from '../interfaces/domain-definition.interface';

export const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    name: 'admin',
    responsibilities: [
      'Manage platform users',
      'Resolve disputes with auditable actions',
      'Oversee jobs and transactions',
      'Generate platform reports',
    ],
    rules: [
      'Only ADMIN users can access admin APIs',
      'Sensitive admin actions must create audit log entries',
      'Dispute decisions must record wallet and notification side effects',
    ],
  },
  {
    name: 'auth',
    responsibilities: [
      'User registration',
      'Login',
      'JWT token generation',
      'Password hashing and validation',
    ],
  },
  {
    name: 'users',
    responsibilities: [
      'Create and retrieve users',
      'Update profile',
      'Role assignment',
    ],
  },
  {
    name: 'artisan',
    responsibilities: [
      'Create artisan profiles',
      'Store skills and bio',
      'Manage verification status',
    ],
  },
  {
    name: 'jobs',
    responsibilities: [
      'Create job postings',
      'Update and delete jobs',
      'Fetch jobs with filters',
      'Manage job status',
    ],
  },
  {
    name: 'proposals',
    responsibilities: [
      'Submit proposal',
      'Fetch proposals per job',
      'Accept or reject proposal',
    ],
    rules: ['Accepting a proposal must trigger contract creation'],
  },
  {
    name: 'contracts',
    responsibilities: [
      'Create contracts between clients and artisans',
      'Store agreed price and job reference',
      'Manage contract lifecycle',
    ],
    rules: [
      'A job can have only one active contract',
      'Contract is required before any payment action',
    ],
  },
  {
    name: 'wallet',
    responsibilities: [
      'Maintain user balances',
      'Handle credits and debits',
      'Provide transaction history',
    ],
    rules: [
      'Wallet balance must never be modified directly',
      'All changes must go through transactions',
    ],
  },
  {
    name: 'payments',
    responsibilities: [
      'Handle wallet funding',
      'Integrate payment gateway',
      'Manage escrow logic',
      'Release payments',
      'Deduct platform fees',
    ],
  },
  {
    name: 'reviews',
    responsibilities: [
      'Create reviews after job completion',
      'Store ratings and feedback',
    ],
  },
  {
    name: 'disputes',
    responsibilities: [
      'Handle conflict cases',
      'Store dispute details',
      'Allow admin resolution',
    ],
  },
  {
    name: 'notifications',
    responsibilities: [
      'Emit system events',
      'Notify users of important actions',
    ],
  },
];

export const ARCHITECTURE_SUMMARY = {
  project: 'Escrow-Based Artisan Marketplace API',
  framework: 'NestJS',
  orm: 'Prisma',
  database: 'PostgreSQL',
  architecture: 'Modular Monolith',
  designPattern: 'Service-oriented modular structure',
  modules: DOMAIN_DEFINITIONS,
  integrityRules: [
    'All financial operations must use database transactions',
    'No direct wallet updates without transaction logs',
    'Contract must exist before escrow',
    'Escrow must exist before release',
    'Release must happen only once per contract',
  ],
};

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WorkSure API')
    .setDescription(
      `## WorkSure - Escrow-based Artisan Marketplace API

### Overview
WorkSure is a comprehensive escrow-based marketplace connecting clients with skilled artisans. The API provides full functionality for job posting, proposals, contracts, payments, reviews, and dispute resolution.

### Authentication
- Use JWT Bearer tokens for authentication
- Obtain tokens via \`/auth/login\` endpoint
- Include token in Authorization header: \`Bearer <token>\`

### User Roles
- **CLIENT**: Posts jobs, manages contracts, makes payments
- **ARTISAN**: Submits proposals, completes work, receives payments
- **ADMIN**: Manages platform, resolves disputes, oversees operations

### Key Features
- **Jobs Management**: Create, browse, and search for artisan jobs
- **Proposals System**: Submit and manage work proposals
- **Contracts**: Escrow-based contract management
- **Payments**: Secure payment processing with wallet integration
- **Reviews**: Rating and feedback system
- **Disputes**: Conflict resolution mechanism
- **Notifications**: Real-time updates and alerts

### API Structure
- \`/auth\` - Authentication and authorization
- \`/users\` - User management and profiles
- \`/jobs\` - Job postings and management
- \`/proposals\` - Proposal submissions and management
- \`/contracts\` - Contract creation and management
- \`/payments\` - Payment processing and wallet management
- \`/reviews\` - Review and rating system
- \`/disputes\` - Dispute creation and resolution
- \`/notifications\` - User notifications
- \`/admin\` - Administrative functions

### Error Handling
- Standard HTTP status codes
- Detailed error messages in response body
- Validation errors return 400 status
- Authentication errors return 401 status
- Authorization errors return 403 status

### Pagination
List endpoints support pagination via query parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10, max: 100)

### Rate Limiting
API endpoints are rate-limited to prevent abuse. Check response headers for rate limit information.

### Support
For API support and questions, contact the development team.`,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste a valid JWT access token.',
      },
      'bearer',
    )
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management and profiles')
    .addTag('Jobs', 'Job postings and management')
    .addTag('Proposals', 'Proposal submissions and management')
    .addTag('Contracts', 'Contract creation and management')
    .addTag('Payments', 'Payment processing and wallet management')
    .addTag('Reviews', 'Review and rating system')
    .addTag('Disputes', 'Dispute creation and resolution')
    .addTag('Notifications', 'User notifications')
    .addTag('Admin', 'Administrative functions')
    .addTag('Artisans', 'Artisan-specific features')
    .addTag('Wallets', 'Digital wallet management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    jsonDocumentUrl: 'api/openapi.json',
    customSiteTitle: 'WorkSure API Documentation',
    customCss: `
      .topbar-wrapper img { content: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzQyODVGNCIvPgo8cGF0aCBkPSJNOCAxNkgxNlY4SDhWMTZaTTE2IDE2SDI0VjhIMTZWMTZaTTggMjRIMTZWMTZIOFYyNFpNMTYgMjRIMjRWMTZIMTZWMjRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'); }
      .swagger-ui .topbar { background-color: #4285F4; }
      .swagger-ui .topbar-wrapper .link { color: white; }
    `,
  });

  return app;
}

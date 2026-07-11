import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule);
  
  // Reuse the same config as in app.setup.ts or similar
  const config = new DocumentBuilder()
    .setTitle('WorkSure API')
    .setDescription('WorkSure - Escrow-based Artisan Marketplace API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = path.resolve(__dirname, '../openapi.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI specification generated at: ${outputPath}`);
  
  await app.close();
  process.exit(0);
}

generateOpenApi().catch((err) => {
  console.error('Failed to generate OpenAPI specification:', err);
  process.exit(1);
});

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Get architecture and runtime summary' })
  @ApiOkResponse({ description: 'Architecture summary returned successfully.' })
  @Get()
  getArchitectureSummary() {
    return this.appService.getArchitectureSummary();
  }
}

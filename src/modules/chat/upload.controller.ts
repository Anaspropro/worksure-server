import {
  BadRequestException,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('signed-params')
  @ApiOperation({ summary: 'Get signed upload parameters for direct Cloudinary upload' })
  @ApiResponse({ status: 200, description: 'Signed parameters generated successfully' })
  async getSignedParams() {
    return this.mediaService.getSignedUploadParams();
  }
}

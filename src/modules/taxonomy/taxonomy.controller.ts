import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import {
  CategoryResponseDto,
  SkillResponseDto,
  SuggestCategoryDto,
  CategorySuggestionResponseDto,
} from './dto/taxonomy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('taxonomy')
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.taxonomyService.getCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get a specific category by ID' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async getCategory(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.taxonomyService.getCategory(id);
  }

  @Get('categories/:categoryId/skills')
  @ApiOperation({ summary: 'Get skills for a specific category' })
  @ApiResponse({ status: 200, type: [SkillResponseDto] })
  async getSkillsByCategory(
    @Param('categoryId') categoryId: string,
  ): Promise<SkillResponseDto[]> {
    return this.taxonomyService.getSkillsByCategory(categoryId);
  }

  @Get('skills/search')
  @ApiOperation({ summary: 'Search for skills' })
  @ApiResponse({ status: 200, type: [SkillResponseDto] })
  async searchSkills(@Query('q') query: string): Promise<SkillResponseDto[]> {
    return this.taxonomyService.searchSkills(query);
  }

  @Get('skills/:id')
  @ApiOperation({ summary: 'Get a specific skill by ID' })
  @ApiResponse({ status: 200, type: SkillResponseDto })
  async getSkill(@Param('id') id: string): Promise<SkillResponseDto> {
    return this.taxonomyService.getSkill(id);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Suggest a new category' })
  @ApiResponse({ status: 201, type: CategorySuggestionResponseDto })
  async suggestCategory(
    @CurrentUser() user: any,
    @Body() data: SuggestCategoryDto,
  ): Promise<any> {
    return this.taxonomyService.suggestCategory(user.id, data);
  }
}

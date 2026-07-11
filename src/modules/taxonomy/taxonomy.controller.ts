import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { CategoryResponseDto, SkillResponseDto } from './dto/taxonomy.dto';

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
}

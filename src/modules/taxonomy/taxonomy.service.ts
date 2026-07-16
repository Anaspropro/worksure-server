import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CategoryResponseDto, SkillResponseDto, SuggestCategoryDto } from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return categories;
  }

  async getCategory(id: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async getSkillsByCategory(categoryId: string): Promise<SkillResponseDto[]> {
    // Verify category exists
    await this.getCategory(categoryId);

    const skills = await this.prisma.skill.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });
    return skills;
  }

  async searchSkills(query: string): Promise<SkillResponseDto[]> {
    if (!query) return [];
    
    const skills = await this.prisma.skill.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return skills;
  }

  async getSkill(id: string): Promise<SkillResponseDto> {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });
    if (!skill) {
      throw new NotFoundException(`Skill with ID ${id} not found`);
    }
    return skill;
  }

  async suggestCategory(userId: string, data: SuggestCategoryDto) {
    // Check if category already exists (case insensitive)
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      throw new Error(`Category '${data.name}' already exists.`);
    }

    const suggestion = await this.prisma.categorySuggestion.create({
      data: {
        name: data.name,
        description: data.description,
        suggestedByUserId: userId,
        status: 'PENDING',
      },
    });

    return suggestion;
  }
}

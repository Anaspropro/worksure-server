import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CategoryResponseDto, SkillResponseDto, SuggestCategoryDto } from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultCategories = [
    { name: "Plumbing & Pipefitting", slug: "plumbing-pipefitting", isPopular: true },
    { name: "Electrical Installation & Wiring", slug: "electrical-installation-wiring", isPopular: true },
    { name: "Carpentry & Woodwork", slug: "carpentry-woodwork", isPopular: true },
    { name: "Masonry & Bricklaying", slug: "masonry-bricklaying", isPopular: true },
    { name: "Painting & Interior Decorating", slug: "painting-interior-decorating", isPopular: true },
    { name: "Air Conditioning & Refrigeration", slug: "ac-refrigeration", isPopular: true },
    { name: "Roofing & Waterproofing", slug: "roofing-waterproofing", isPopular: false },
    { name: "Welding & Metal Fabrication", slug: "welding-metal-fabrication", isPopular: false },
    { name: "Solar & Inverter Technology", slug: "solar-inverter-technology", isPopular: true },
    { name: "Tiling & Flooring Services", slug: "tiling-flooring", isPopular: false },
    { name: "Generator Repair & Maintenance", slug: "generator-repair-maintenance", isPopular: true },
    { name: "Automobile Repairs & Mechanics", slug: "automobile-repairs-mechanics", isPopular: false },
    { name: "Catering & Culinary Services", slug: "catering-culinary", isPopular: false },
    { name: "Fashion Design & Tailoring", slug: "fashion-design-tailoring", isPopular: false },
    { name: "Cleaning & Janitorial Services", slug: "cleaning-janitorial", isPopular: true },
    { name: "CCTV & Security Systems", slug: "cctv-security-systems", isPopular: false },
    { name: "Gardening & Landscaping", slug: "gardening-landscaping", isPopular: false },
    { name: "Glass & Aluminium Fabrication", slug: "glass-aluminium-fabrication", isPopular: false },
  ];

  async getCategories(): Promise<CategoryResponseDto[]> {
    let categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      await this.prisma.category.createMany({
        data: this.defaultCategories,
        skipDuplicates: true,
      });
      categories = await this.prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
    }

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

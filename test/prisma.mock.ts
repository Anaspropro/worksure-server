import { PrismaClient } from '../src/generated/prisma';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../src/database/prisma.service';

export type MockPrismaService = DeepMockProxy<PrismaService>;

export const createPrismaMock = (): MockPrismaService => {
  const mock = mockDeep<PrismaService>();
  // @ts-ignore - mock property assignment
  mock.getStatus.mockReturnValue('scaffolded');
  return mock;
};

export const PrismaServiceMockProvider = {
  provide: PrismaService,
  useFactory: () => createPrismaMock(),
};

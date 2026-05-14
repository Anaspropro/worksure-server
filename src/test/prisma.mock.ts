import { PrismaService } from '../database/prisma.service';

export const PrismaServiceMockProvider = {
  provide: PrismaService,
  useValue: {
    getStatus: jest.fn().mockReturnValue('scaffolded'),
  },
};

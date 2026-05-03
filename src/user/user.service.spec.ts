import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
};

describe('UserService', () => {
  let service: UserService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return an array of users', async () => {
      const result = [{ id: 1, email: 'test@example.com' }];
      prisma.prisma.user.findMany.mockResolvedValue(result);

      expect(await service.getUsers()).toEqual(result);
      expect(prisma.prisma.user.findMany).toHaveBeenCalled();
    });
  });
});

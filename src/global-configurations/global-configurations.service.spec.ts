import { Test, TestingModule } from '@nestjs/testing';
import { GlobalConfigurationsService } from './global-configurations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  prisma: {
    globalConfiguration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
};

describe('GlobalConfigurationsService', () => {
  let service: GlobalConfigurationsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalConfigurationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GlobalConfigurationsService>(
      GlobalConfigurationsService,
    );
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a global configuration', async () => {
      const dto = {
        name: 'Config1',
        description: 'Test',
        alterFlag: true,
        isActive: true,
        maxReadingVariables: 10,
        maxWritingVariables: 10,
      };
      const result = {
        id: BigInt(1),
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.prisma.globalConfiguration.create.mockResolvedValue(result);

      expect(await service.create(dto)).toEqual(result);
      expect(prisma.prisma.globalConfiguration.create).toHaveBeenCalledWith({
        data: dto,
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of configurations', async () => {
      const result = [{ id: BigInt(1), name: 'Config1' }];
      prisma.prisma.globalConfiguration.findMany.mockResolvedValue(result);

      expect(await service.findAll()).toEqual(result);
      expect(prisma.prisma.globalConfiguration.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single configuration', async () => {
      const result = { id: BigInt(1), name: 'Config1' };
      prisma.prisma.globalConfiguration.findUnique.mockResolvedValue(result);

      expect(await service.findOne(1)).toEqual(result);
      expect(prisma.prisma.globalConfiguration.findUnique).toHaveBeenCalledWith(
        { where: { id: 1 } },
      );
    });
  });

  describe('update', () => {
    it('should update a configuration', async () => {
      const dto = { name: 'Updated Config' };
      const result = { id: BigInt(1), ...dto };

      prisma.prisma.globalConfiguration.update.mockResolvedValue(result);

      expect(await service.update(1, dto)).toEqual(result);
      expect(prisma.prisma.globalConfiguration.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('should throw NotFoundException if id does not exist', async () => {
      const error = { code: 'P2025' };
      prisma.prisma.globalConfiguration.update.mockRejectedValue(error);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw other errors', async () => {
      const error = new Error('Random error');
      prisma.prisma.globalConfiguration.update.mockRejectedValue(error);

      await expect(service.update(1, {})).rejects.toThrow(error);
    });
  });

  describe('remove', () => {
    it('should remove a configuration', async () => {
      const result = { id: BigInt(1), name: 'Deleted' };
      prisma.prisma.globalConfiguration.delete.mockResolvedValue(result);

      expect(await service.remove(1)).toEqual(result);
      expect(prisma.prisma.globalConfiguration.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if id does not exist', async () => {
      const error = { code: 'P2025' };
      prisma.prisma.globalConfiguration.delete.mockRejectedValue(error);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});

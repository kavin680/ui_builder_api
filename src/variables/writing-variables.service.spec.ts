import { Test, TestingModule } from '@nestjs/testing';
import { WritingVariablesService } from './writing-variables.service';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalConfigurationsService } from '../global-configurations/global-configurations.service';
import { getQueueToken } from '@nestjs/bullmq';

const mockPrismaService = {
  writingVariable: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  writingVariableMbo: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

describe('WritingVariablesService', () => {
  let service: WritingVariablesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WritingVariablesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GlobalConfigurationsService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getQueueToken('variable-update'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WritingVariablesService>(WritingVariablesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWritingVariable', () => {
    it('should create a writing variable and set up MBO', async () => {
      const dto = {
        globalConfigId: 1,
        name: 'PumpStart',
        value: 0,
        functionName: 'BYTE'
      };

      const existingVar = { id: BigInt(1), globalConfigId: BigInt(1), hasMbo: true, functionName: 'BYTE', sequenceNo: 1 };
      prisma.writingVariable.findUnique.mockResolvedValue(existingVar);
      prisma.writingVariableMbo.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (callback) => await callback(prisma));
      prisma.writingVariable.upsert.mockResolvedValue({ id: BigInt(1), name: 'PumpStart', hasMbo: true, functionName: 'BYTE', globalConfigId: BigInt(1) });

      const result = await service.createWritingVariable(dto as any);

      expect(prisma.writingVariable.upsert).toHaveBeenCalled();
      expect(result.count).toBe(1);
    });
  });

  describe('updateWritingVariable', () => {
    it('should update a writing variable and bits', async () => {
      const data = { id: 1, value: 255 };
      const existingVar = { id: BigInt(1), globalConfigId: BigInt(1), hasMbo: true, functionName: 'BYTE', sequenceNo: 1 };

      prisma.writingVariable.findUnique.mockResolvedValue(existingVar);
      prisma.writingVariableMbo.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (callback) => await callback(prisma));
      prisma.writingVariable.update.mockResolvedValue({ ...existingVar, value: 255 });

      const result = await service.updateWritingVariable(data as any);

      expect(prisma.writingVariable.update).toHaveBeenCalled();
      // Should verify that binary conversion was correct: 255 -> 11111111
      expect(result?.value).toBe(255);
    });
  });

  describe('findAllWritingVariables', () => {
    it('should return all writing variables for a config', async () => {
      const globalConfigId = 1;
      const expectedVars = [
        {
          id: BigInt(1),
          globalConfigId: BigInt(1),
          name: 'Pump',
          value: 1,
          sequenceNo: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.writingVariable.findMany.mockResolvedValue(expectedVars);

      const result = await service.findAllWritingVariables(globalConfigId);

      expect(prisma.writingVariable.findMany).toHaveBeenCalledWith({
        where: { globalConfigId: BigInt(globalConfigId) },
        include: { mboVariables: true },
        orderBy: { name: 'asc' },
      });
      expect(result[0].id.toString()).toBe('1');
    });
  });
});

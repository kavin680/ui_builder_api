import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt'); // Mock the entire module

const mockPrismaService = {
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = {
        userName: 'test',
        email: 'test@test.com',
        password: 'password',
      };
      prisma.prisma.user.findFirst.mockResolvedValue(null);
      // Mock bcrypt hash
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const createdUser = {
        id: 1,
        ...dto,
        password: 'hashedPassword',
        createdAt: new Date(),
      };
      prisma.prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result.message).toEqual('User registered successfully');
      expect(prisma.prisma.user.create).toHaveBeenCalled();
    });

    });
  });

  describe('login', () => {
    it('should return tokens on valid login', async () => {
      const user = { id: 1, userName: 'test', password: 'hashedPassword' };
      prisma.prisma.user.findFirst.mockResolvedValue(user);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedToken');

      mockJwtService.sign.mockReturnValue('token');

      const result = await service.login({
        userName: 'test',
        password: 'password',
      });

      expect(result.data.access_token).toBe('token');
      expect(prisma.prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      prisma.prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ userName: 'test', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const refreshToken = 'valid_refresh';
      const payload = { sub: 1, userName: 'test' };

      mockJwtService.verify.mockReturnValue(payload);
      mockJwtService.sign.mockReturnValue('new_token');

      // Mock stored token
      const storedToken = {
        id: 10,
        token: 'hashedStoredToken',
        userId: 1,
        revoked: false,
      };
      prisma.prisma.refreshToken.findMany.mockResolvedValue([storedToken]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewToken');

      const result = await service.refresh(refreshToken);

      expect(result.data.access_token).toBe('new_token');
      // Should revoke old token
      expect(prisma.prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 }, data: { revoked: true } }),
      );
      // Should create new token
      expect(prisma.prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout user (revoke token)', async () => {
      const storedToken = {
        id: 10,
        token: 'hashedStoredToken',
        userId: 1,
        revoked: false,
      };
      prisma.prisma.refreshToken.findMany.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.logout(1, 'token');

      expect(prisma.prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 }, data: { revoked: true } }),
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('logoutAll', () => {
    it('should revoke all tokens for user', async () => {
      prisma.prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.logoutAll(1);

      expect(prisma.prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revoked: false },
        data: { revoked: true },
      });
      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    });
  });
});

import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register-dto';
import { LoginDto } from './dto/login-dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ActionResponseDto } from '../common/dto/action-response.dto';

export interface User {
  id: number;
  userName: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) { }

  /**
   * Generates a pair of JWT tokens.
   * Access Token: Short-lived (15m) for standard requests.
   * Refresh Token: Long-lived (7d) used only to get new access tokens.
   */
  private generateTokens(user: { id: number; userName: string | null; role: string }) {
    const payload = { sub: user.id, userName: user.userName, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.config.get<string>('JWT_SECRET'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
    });

    return { accessToken, refreshToken };
  }

  async register(userData: RegisterDto) {
    // Security: Always hash passwords before they touch the database.
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
      select: {
        id: true,
        userName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      message: 'User registered successfully',
      data: user,
    };
  }

  async login(loginData: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        userName: loginData.userName,
      },
    });

    // Security: Don't tell the user IF the username was wrong vs the password.
    // "Invalid credentials" is the standard safe response.
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens({
      id: user.id,
      userName: user.userName,
      role: user.role,
    });

    // 🔒 Refresh Token Rotation: We store a hashed version of the refresh token.
    // Even if our DB is leaked, an attacker can't use the refresh tokens
    // without knowing the raw token value.
    await this.prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(tokens.refreshToken, 10),
        userId: user.id,
      },
    });

    return {
      message: 'Login successful',
      data: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        user: {
          id: user.id,
          userName: user.userName,
          email: user.email,
          role: user.role,
        },
      },
    };
  }

  // 🔁 REFRESH TOKEN (Exchange old refresh for new access/refresh pair)
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      // We find all non-revoked tokens for this user.
      const storedTokens = await this.prisma.refreshToken.findMany({
        where: {
          userId: payload.sub,
          revoked: false,
        },
      });

      let matchedTokenId: number | null = null;

      // Since tokens are hashed, we have to compare them one by one.
      // This prevents a DB leak from exposing valid sessions.
      for (const token of storedTokens) {
        if (await bcrypt.compare(refreshToken, token.token)) {
          matchedTokenId = token.id;
          break;
        }
      }

      if (!matchedTokenId) {
        throw new UnauthorizedException();
      }

      // One-time use: Revoke the token immediately after it's used.
      await this.prisma.refreshToken.update({
        where: { id: matchedTokenId },
        data: { revoked: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException();

      const newTokens = await this.generateTokens({
        id: payload.sub,
        userName: payload.userName,
        role: user.role,
      });

      // Issue a fresh hashed refresh token for the next rotation.
      await this.prisma.refreshToken.create({
        data: {
          token: await bcrypt.hash(newTokens.refreshToken, 10),
          userId: payload.sub,
        },
      });

      return {
        message: 'Tokens refreshed successfully',
        data: {
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken,
        },
      };
    } catch (err) {
      // In production, we don't want to tell the client why the refresh failed,
      // but we DO want to see the error in our logs.
      this.logger.error(`Refresh token failed: ${err.message}`, err.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // 🚪 LOGOUT (single device)
  async logout(userId: number, refreshToken: string): Promise<ActionResponseDto> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
    });

    let loggedOut = false;

    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.token)) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revoked: true },
        });
        loggedOut = true;
        break;
      }
    }

    if (!loggedOut) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return new ActionResponseDto({
      success: true,
      message: 'Successfully logged out',
      count: 1,
    });
  }

  // 🚪 LOGOUT ALL DEVICES
  async logoutAll(userId: number): Promise<ActionResponseDto> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return new ActionResponseDto({
      success: true,
      message: 'Successfully logged out from all devices',
      count: result.count,
    });
  }
}

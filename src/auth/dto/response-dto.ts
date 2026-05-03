import { ApiProperty } from '@nestjs/swagger';

export class UserResponseData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john_doe' })
  user_name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: '2026-01-19T09:50:06.000Z' })
  created_at: Date;
}

export class RegisterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User registered successfully' })
  message: string;

  @ApiProperty({ type: UserResponseData })
  data: UserResponseData;

  @ApiProperty({ example: '2026-01-19T09:50:06.000Z' })
  timestamp: string;
}

export class LoginDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ type: UserResponseData })
  user: {
    id: number;
    user_name: string;
    email: string;
  };
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;

  @ApiProperty({ example: '2026-01-19T09:50:06.000Z' })
  timestamp: string;
}

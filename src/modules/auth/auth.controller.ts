import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService, AuthenticatedUser } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiCreatedResponse({ description: 'User registered successfully.' })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(
      dto,
      this.getIpAddress(request),
      request.get('user-agent'),
    );
  }

  @ApiOperation({ summary: 'Authenticate a user and return a JWT' })
  @ApiCreatedResponse({ description: 'Login successful.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      dto,
      this.getIpAddress(request),
      request.get('user-agent'),
    );
  }

  @ApiOperation({ summary: 'Request a password reset token' })
  @ApiCreatedResponse({ description: 'Reset request accepted.' })
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @ApiOperation({ summary: 'Reset password with a valid reset token' })
  @ApiCreatedResponse({ description: 'Password reset successful.' })
  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ description: 'Authenticated user returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Log out the current session' })
  @ApiOkResponse({ description: 'Logout successful.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  private getIpAddress(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0];
    }

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    return request.ip;
  }
}

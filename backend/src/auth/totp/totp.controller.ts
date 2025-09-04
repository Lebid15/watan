import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Patch,
  Param,
} from '@nestjs/common';
import { TotpService } from './totp.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { UserRole } from '../user-role.enum';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('TOTP')
@Controller('auth/totp')
@UseGuards(JwtAuthGuard)
export class TotpController {
  constructor(private readonly totpService: TotpService, private readonly jwt: JwtService) {}

  @Post('setup')
  @ApiBearerAuth()
  async setupTotp(@Req() req: any, @Body() body: { label?: string }) {
    const userId = req.user.id || req.user.sub;
    const tenantId = req.user.tenantId;
    
    return this.totpService.generateSecret(userId, tenantId, body.label);
  }

  @Post('verify-setup')
  @ApiBearerAuth()
  async verifySetup(@Req() req: any, @Body() body: { token: string; credentialId: string }) {
    const userId = req.user.id || req.user.sub;
    
    if (!body.token || !body.credentialId) {
      throw new BadRequestException('Token and credentialId required');
    }
    
    const verified = await this.totpService.verifyAndActivate(userId, body.token, body.credentialId);
    
    if (!verified) {
      throw new BadRequestException('Invalid token');
    }
    
    return { success: true };
  }

  @Post('verify')
  @ApiBearerAuth()
  async verifyTotp(@Req() req: any, @Body() body: { token: string }) {
    const userId = req.user.id || req.user.sub;
    
    if (!body.token) {
      throw new BadRequestException('Token required');
    }
    
    const verified = await this.totpService.verifyToken(userId, body.token);
    if (!verified) return { verified: false };
    const finalToken = this.jwt.sign({
      email: req.user.email,
      sub: userId,
      role: req.user.role,
      tenantId: req.user.tenantId ?? null,
      totpVerified: true,
    }, { expiresIn: '12h' });
    return { verified: true, token: finalToken };
  }

  @Get('status')
  @ApiBearerAuth()
  async getTotpStatus(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const enabled = await this.totpService.hasTotpEnabled(userId);
    
    return { enabled };
  }

  @Post('disable')
  @ApiBearerAuth()
  async disable(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    await this.totpService.disableTotp(userId);
    return { success: true };
  }

  @Post('recovery-codes/regenerate')
  @ApiBearerAuth()
  async regenerateCodes(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const codes = await this.totpService.regenerateRecoveryCodes(userId);
    return { codes };
  }

  @Post('reset/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DEVELOPER)
  @ApiBearerAuth()
  async resetUserTotp(@Req() req: any, @Param('userId') userId: string) {
    const adminUserId = req.user.id || req.user.sub;
    
    await this.totpService.resetTwoFactor(userId, adminUserId);
    
    return { success: true };
  }
}

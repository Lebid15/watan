import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TotpCredential } from './totp-credential.entity';
import { RecoveryCode } from './recovery-code.entity';
import { User } from '../../user/user.entity';
import { AuditService } from '../../audit/audit.service';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

@Injectable()
export class TotpService {
  private readonly logger = new Logger('TotpService');
  private readonly encryptionKey: string;
  private readonly issuer = 'syrz1.com';

  constructor(
    @InjectRepository(TotpCredential) private totpRepo: Repository<TotpCredential>,
    @InjectRepository(RecoveryCode) private recoveryRepo: Repository<RecoveryCode>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private audit: AuditService,
  ) {
    this.encryptionKey = process.env.TOTP_SECRET_ENC_KEY || crypto.randomBytes(32).toString('hex');
    if (!process.env.TOTP_SECRET_ENC_KEY) {
      this.logger.warn('TOTP_SECRET_ENC_KEY not set, using random key (not persistent)');
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async generateSecret(userId: string, tenantId: string | null, label?: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
    credentialId: string;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const secret = speakeasy.generateSecret({
      name: user.email,
      issuer: this.issuer,
      length: 32,
    });

    const encryptedSecret = this.encrypt(secret.base32);
    
    const credential = this.totpRepo.create({
      userId,
      tenantId,
      encryptedSecret,
      label: label || 'My Authenticator',
      isActive: false,
    });
    
    await this.totpRepo.save(credential);

    const qrCode = await qrcode.toDataURL(secret.otpauth_url || '');
    const backupCodes = await this.generateRecoveryCodes(userId);

    await this.audit.log('totp_setup_start', {
      actorUserId: userId,
      targetUserId: userId,
      targetTenantId: tenantId,
      meta: { credentialId: credential.id },
    });

    return {
      secret: secret.base32,
      qrCode: qrCode,
      backupCodes,
      credentialId: credential.id,
    };
  }

  async verifyAndActivate(userId: string, token: string, credentialId: string): Promise<boolean> {
    const credential = await this.totpRepo.findOne({
      where: { id: credentialId, userId, isActive: false },
    });
    
    if (!credential) throw new BadRequestException('Invalid credential');

    const secret = this.decrypt(credential.encryptedSecret);
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (verified) {
      credential.isActive = true;
      await this.totpRepo.save(credential);

      await this.userRepo.update(userId, { forceTotpEnroll: false });

      await this.audit.log('totp_activated', {
        actorUserId: userId,
        targetUserId: userId,
        targetTenantId: credential.tenantId,
        meta: { credentialId: credential.id },
      });
    }

    return verified;
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;

    if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
      throw new UnauthorizedException('TOTP temporarily locked due to failed attempts');
    }

    if (await this.verifyRecoveryCode(userId, token)) {
      await this.resetFailedAttempts(userId);
      return true;
    }

    const credentials = await this.totpRepo.find({
      where: { userId, isActive: true },
    });

    for (const credential of credentials) {
      const secret = this.decrypt(credential.encryptedSecret);
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (verified) {
        credential.lastUsedAt = new Date();
        credential.usageCount += 1;
        await this.totpRepo.save(credential);
        await this.resetFailedAttempts(userId);
        
        await this.audit.log('totp_verify_success', {
          actorUserId: userId,
          targetUserId: userId,
          targetTenantId: credential.tenantId,
          meta: { credentialId: credential.id },
        });
        
        return true;
      }
    }

    await this.handleFailedAttempt(userId);
    return false;
  }

  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      
      const recoveryCode = this.recoveryRepo.create({
        userId,
        codeHash: hash,
      });
      
      await this.recoveryRepo.save(recoveryCode);
      codes.push(code);
    }
    
    return codes;
  }

  private async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    const recoveryCode = await this.recoveryRepo.findOne({
      where: { userId, codeHash: hash, usedAt: IsNull() },
    });

    if (recoveryCode) {
      recoveryCode.usedAt = new Date();
      await this.recoveryRepo.save(recoveryCode);
      
      await this.audit.log('recovery_code_used', {
        actorUserId: userId,
        targetUserId: userId,
        meta: { recoveryCodeId: recoveryCode.id },
      });
      
      return true;
    }
    
    return false;
  }

  async resetTwoFactor(userId: string, adminUserId: string): Promise<void> {
    await this.totpRepo.update({ userId }, { isActive: false });
    
    await this.recoveryRepo.delete({ userId });
    
    await this.userRepo.update(userId, { 
      forceTotpEnroll: true,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    });

    await this.audit.log('totp_reset_by_admin', {
      actorUserId: adminUserId,
      targetUserId: userId,
      meta: { reason: 'admin_reset' },
    });
  }

  async hasTotpEnabled(userId: string): Promise<boolean> {
    const count = await this.totpRepo.count({
      where: { userId, isActive: true },
    });
    return count > 0;
  }

  private async handleFailedAttempt(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const newFailedAttempts = (user.totpFailedAttempts || 0) + 1;
    const updates: any = { totpFailedAttempts: newFailedAttempts };

    if (newFailedAttempts >= 5) {
      updates.totpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await this.userRepo.update(userId, updates);

    await this.audit.log('totp_verify_failed', {
      actorUserId: userId,
      targetUserId: userId,
      meta: { failedAttempts: newFailedAttempts },
    });
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    });
  }
}

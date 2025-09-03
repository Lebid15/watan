import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasskeyCredential } from './passkey-credential.entity';
import { PasskeyChallengeStore } from './challenge-store.service';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { AuditService } from '../../audit/audit.service';

export function isAllowedOrigin(o?: string) {
  if (!o) return false;
  let u: URL;
  try { u = new URL(o); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const https = u.protocol === 'https:';
  const inZone = host === 'syrz1.com' || host.endsWith('.syrz1.com');
  return https && inZone;
}

@Injectable()
export class PasskeysService {
  private rpId: string;
  private rpName = 'Watan';
  private prod: boolean;
  private enabled: boolean = false;
  private logger = new Logger('Passkeys');

  constructor(
    @InjectRepository(PasskeyCredential) private creds: Repository<PasskeyCredential>,
    private challenges: PasskeyChallengeStore,
    private audit: AuditService,
  ) {
    this.prod = (process.env.NODE_ENV === 'production');
    this.rpId = process.env.RP_ID || process.env.PUBLIC_TENANT_BASE_DOMAIN || 'syrz1.com';
    const strict = process.env.PASSKEYS_STRICT === 'true';
    this.logger.log(`[init] PASSKEYS DISABLED FOR SECURITY OVERHAUL`);
    this.enabled = false;
  }

  async getUserCredentials(userId: string) {
    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // ---------- Registration (Options) ----------
  async startRegistration(user: any, label?: string) {
    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // ---------- Registration (Finish) ----------
  async finishRegistration(user: any, payload: any, tenantId: string | null, origin: string) {
    if (!this.enabled) throw new BadRequestException('Passkeys disabled');
    const { response, challengeRef } = payload || {};
    if (!response || !challengeRef) throw new BadRequestException('Missing response or challengeRef');
    const challenge = await this.challenges.consumeById(challengeRef, 'reg', user.id);
    if (!challenge) throw new BadRequestException('Invalid or expired challenge');
    if (!isAllowedOrigin(origin)) throw new ForbiddenException('Invalid origin');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: this.rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration not verified');
    }

    const {
      credential: { id: rawId, publicKey: credentialPublicKey, counter },
    } = verification.registrationInfo as any;

    const credentialIdB64 = Buffer.from(rawId).toString('base64url');

    const entity = this.creds.create({
      userId: user.id,
      tenantId: tenantId ?? null,
      credentialId: credentialIdB64,
      publicKey: credentialPublicKey,
      counter,
      deviceType: payload.label?.trim() || 'My device',
    });
    await this.creds.save(entity);
    try {
      await this.audit.log('passkey_add', {
        actorUserId: user.id,
        targetUserId: user.id,
        targetTenantId: tenantId ?? null,
        meta: { credentialId: entity.credentialId },
      });
    } catch {}
    return { ok: true, id: entity.id };
  }

  // ---------- Authentication (Options) ----------
  async startAuthentication(user: any) {
    if (!this.enabled) throw new BadRequestException('Passkeys disabled');
    // PATCHED: defensive user check
    if (!user || !user.id) {
      this.logger.error('[startAuthentication] user or user.id missing');
      throw new BadRequestException('Invalid user');
    }
    throw new BadRequestException('Passkeys disabled - use TOTP authentication');
  }

  // ---------- Authentication (Finish) ----------
  async finishAuthentication(user: any, payload: any, origin: string) {
    if (!this.enabled) throw new BadRequestException('Passkeys disabled');
    const { response, challengeRef } = payload || {};
    if (!response || !challengeRef) throw new BadRequestException('Missing response or challengeRef');

    const challenge = await this.challenges.consumeById(challengeRef, 'auth', user.id);
    if (!challenge) throw new BadRequestException('Invalid or expired challenge');

    const credIdB64 = response.id;
    const dbCred = await this.creds.findOne({ where: { credentialId: credIdB64 } });
    if (!dbCred) throw new NotFoundException('Credential not found');

    if (!isAllowedOrigin(origin)) throw new ForbiddenException('Invalid origin');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedRPID: this.rpId,
      expectedOrigin: origin,
      requireUserVerification: false,
      credential: {
        id: dbCred.credentialId,
        publicKey: dbCred.publicKey,
        counter: Number(dbCred.counter),
        transports: (dbCred.transports as any) || undefined,
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      try {
        await this.audit.log('passkey_login_fail', {
          actorUserId: user.id,
          targetUserId: user.id,
          targetTenantId: dbCred?.tenantId ?? null,
          meta: { reason: 'verification_failed' },
        });
      } catch {}
      throw new ForbiddenException('Auth not verified');
    }

    dbCred.counter = verification.authenticationInfo.newCounter;
    dbCred.lastUsedAt = new Date();
    await this.creds.save(dbCred);

    try {
      await this.audit.log('passkey_login_success', {
        actorUserId: user.id,
        targetUserId: user.id,
        targetTenantId: dbCred.tenantId ?? null,
        meta: { credentialId: dbCred.credentialId },
      });
    } catch {}

    return { ok: true, tenantId: dbCred.tenantId };
  }

  // ---------- List ----------
  async list(userId: string) {
    if (!this.enabled) return [];
    const rows = await this.creds.find({ where: { userId } });
    return rows.map(r => ({
      id: r.id,
      name: r.deviceType || 'Passkey',
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt || null,
    }));
  }

  // ---------- Delete ----------
  async delete(userId: string, id: string) {
    if (!this.enabled) throw new BadRequestException('Passkeys disabled');
    const cred = await this.creds.findOne({ where: { id, userId } });
    if (!cred) throw new NotFoundException('Credential not found');
    await this.creds.remove(cred);
    try {
      await this.audit.log('passkey_delete', {
        actorUserId: userId,
        targetUserId: userId,
        targetTenantId: cred.tenantId ?? null,
        meta: { credentialId: cred.credentialId },
      });
    } catch {}
    return { ok: true };
  }
}

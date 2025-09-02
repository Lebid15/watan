import { PasskeysService, isAllowedOrigin } from './passkeys.service';
import { verifyRegistrationResponse, verifyAuthenticationResponse, generateRegistrationOptions, generateAuthenticationOptions } from '@simplewebauthn/server';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(() => ({ timeout: 60000, rp: { id: 'syrz1.com', name: 'Watan' }, authenticatorSelection: {}, })),
  generateAuthenticationOptions: jest.fn(() => ({ timeout: 60000 })),
  verifyRegistrationResponse: jest.fn(async () => ({ verified: true, registrationInfo: { credential: { id: Buffer.from('cred123'), publicKey: Buffer.from('pk'), counter: 0 } } })),
  verifyAuthenticationResponse: jest.fn(async () => ({ verified: true, authenticationInfo: { newCounter: 1 } })),
}));

// Minimal in-memory repo mock
function repoFactory() {
  const store: any[] = [];
  return {
    find: jest.fn(async ({ where: { userId } }: any) => store.filter(c => c.userId === userId)),
    findOne: jest.fn(async ({ where: { credentialId } }: any) => store.find(c => c.credentialId === credentialId) || null),
    create: (data: any) => ({ id: 'id-' + (store.length + 1), ...data }),
    save: jest.fn(async (entity: any) => { const existing = store.findIndex(c => c.id === entity.id); if (existing >= 0) store[existing] = entity; else store.push(entity); return entity; }),
  } as any;
}

// Challenge store mock
class MockChallengeStore {
  last: Record<string,string> = {};
  async create(kind: string, userId: string) { return `ref-${kind}.${kind}-challenge-${userId}`; }
  async consumeById(ref: string, kind: string, userId: string) {
    if (ref !== `ref-${kind}`) return null; return `${kind}-challenge-${userId}`;
  }
}

class MockAudit { log = jest.fn(async () => {}); }

const user = { id: '11111111-1111-1111-1111-111111111111', email: 'u@syrz1.com' };

function buildService() {
  process.env.RP_ID = 'syrz1.com';
  process.env.PASSKEYS_STRICT = 'true';
  return new PasskeysService(repoFactory(), new MockChallengeStore() as any, new MockAudit() as any);
}

describe('PasskeysService dynamic origin flows', () => {
  const origins = ['https://sham.syrz1.com', 'https://newtenant.syrz1.com'];

  it('isAllowedOrigin covers test origins', () => {
    origins.forEach(o => expect(isAllowedOrigin(o)).toBe(true));
  });

  origins.forEach(origin => {
    it(`register + authenticate with origin ${origin}`, async () => {
      const svc = buildService();
      const { options, challengeRef } = await svc.startRegistration(user as any);
      expect(options.challenge).toContain('reg-challenge');
      await svc.finishRegistration(user as any, { response: { id: 'cred123', rawId: 'cred123' }, challengeRef }, null, origin);
      expect(verifyRegistrationResponse).toHaveBeenLastCalledWith(expect.objectContaining({ expectedOrigin: origin }));

      const authStart = await svc.startAuthentication(user as any);
      await svc.finishAuthentication(user as any, { response: { id: Buffer.from('cred123').toString('base64url') }, challengeRef: authStart.challengeRef }, origin);
      expect(verifyAuthenticationResponse).toHaveBeenLastCalledWith(expect.objectContaining({ expectedOrigin: origin }));
    });
  });
});

import { PasskeysService } from './passkeys.service';

const mk = () => {
  process.env.RP_ID = 'syrz1.com';
  process.env.PASSKEYS_STRICT = 'true';
  const repo: any = {
    find: jest.fn(async () => [{ id: '1', deviceType: 'multiDevice', createdAt: new Date('2025-01-01'), lastUsedAt: null }]),
  };
  const challenges: any = {};
  const audit: any = { log: jest.fn(async () => {}) };
  const svc = new PasskeysService(repo, challenges, audit);
  return { svc, repo };
};

describe('PasskeysService.list()', () => {
  it('returns simplified array', async () => {
    const { svc } = mk();
    const list = await svc.list('user-x');
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(expect.objectContaining({ id: '1', name: 'multiDevice' }));
  });
});

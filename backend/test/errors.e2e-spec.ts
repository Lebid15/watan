import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';
import { User } from '../src/user/user.entity';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Errors (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    process.env.BOOTSTRAP_DEV_SECRET = 'test-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const ds = app.get(DataSource);
    let dev = await ds.getRepository(User).findOne({ where: { role: 'developer' } as any });
    if (!dev) {
      // bootstrap developer via endpoint to exercise flow
      await request(app.getHttpServer())
        .post('/api/auth/bootstrap-developer')
        .send({ secret: 'test-secret', email: 'dev@example.com', password: 'Passw0rd!' })
        .expect(res => { if (![201, 409, 403].includes(res.status)) throw new Error('bootstrap unexpected status ' + res.status); });
      dev = await ds.getRepository(User).findOne({ where: { role: 'developer' } as any });
    }
    if (!dev) throw new Error('Developer bootstrap failed');
    token = jwt.sign({ sub: dev.id, id: dev.id, role: 'developer', totpVerified: true }, jwtConstants.secret, { expiresIn: '1h' });
    // Seed developer user for auth
    await ds.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`, ['err-tenant-000000000000000000000000', 'Err Tenant', 'errtenant', null, 1, new Date().toISOString(), new Date().toISOString()]);
    await ds.query(`INSERT INTO users (id, role, email, password, isActive, username) VALUES (?,?,?,?,?,?)`, ['dev-user-error', 'developer', 'dev@example.com', 'x', 1, 'dev']);
  });

  afterAll(async () => {
    if (!app) return;
    let ds: DataSource | undefined; try { ds = app.get(DataSource, { strict: false }); } catch {}
    await app.close();
    if (ds?.isInitialized) await ds.destroy();
  });

  it('POST /api/dev/errors/ingest stores a frontend error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/dev/errors/ingest')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'frontend', message: 'Test Front Error', stack: 'Error: Test Front Error' })
      .expect(201);
    expect(res.body).toEqual(expect.objectContaining({ id: expect.any(String), message: 'Test Front Error', source: 'frontend' }));
  });

  it('GET /api/dev/errors lists errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dev/errors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ items: expect.any(Array), total: expect.any(Number) }));
  });
});

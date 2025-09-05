import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { ClientApiWebhookOutbox } from '../src/client-api/client-api-webhook-outbox.entity';
import { User } from '../src/user/user.entity';
import { ProductOrder } from '../src/products/product-order.entity';
import * as crypto from 'crypto';
import { ProductsService } from '../src/products/products.service';

// Backoff reference for assertions
const BACKOFF = [0,30,120,600,3600,21600];

// Simple wait util
const sleep = (ms:number)=> new Promise(r=>setTimeout(r,ms));

// Capture last fetch calls
interface FetchCall { url: string; opts: any; time: number; }
let fetchCalls: FetchCall[] = [];

describe('Client API Webhook Outbox (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let outboxRepo: Repository<ClientApiWebhookOutbox>;
  let userRepo: Repository<User>;
  let orderRepo: Repository<ProductOrder>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // global fetch mock
    (global as any).fetch = jest.fn(async (url: string, opts: any)=> {
      fetchCalls.push({ url, opts, time: Date.now() });
      const scenario = (global as any).__FETCH_SCENARIO__ || 'success';
      if (scenario === 'timeout') {
        await sleep(50);
        throw new Error('Timeout');
      }
      if (scenario === 'fail500') {
        return { ok: false, status: 500, text: async()=> 'boom' } as any;
      }
      // success default
      return { ok: true, status: 200, text: async()=> '' } as any;
    });
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    ds = mod.get(DataSource);
    outboxRepo = ds.getRepository(ClientApiWebhookOutbox);
    userRepo = ds.getRepository(User);
    orderRepo = ds.getRepository(ProductOrder);
  });

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    fetchCalls = [];
    (global as any).__FETCH_SCENARIO__ = 'success';
    await outboxRepo.createQueryBuilder().delete().where('1=1').execute();
    await orderRepo.createQueryBuilder().delete().where('1=1').execute();
    await userRepo.createQueryBuilder().delete().where('1=1').execute();
  });

  async function createUserWithWebhook() {
    const u = userRepo.create({
      email: `u_${crypto.randomUUID()}@example.com`,
      password: 'x',
      balance: 0,
      tenantId: crypto.randomUUID(),
      apiWebhookEnabled: true,
      apiWebhookSecret: 'secret123',
      apiWebhookUrl: 'https://example.com/hook',
      apiWebhookSigVersion: 'v1',
      role: 'USER',
      isActive: true,
    } as any);
    return await userRepo.save(u);
  }

  async function createOrder(user: User) {
  const o: any = orderRepo.create({
      user: user as any,
      userId: user.id,
      tenantId: (user as any).tenantId,
      status: 'pending',
      quantity: 1,
      price: 0,
      orderUuid: crypto.randomUUID(),
    } as any);
  const saved = await orderRepo.save(o);
  return saved as any;
  }

  async function forceDueAll() {
    await outboxRepo.createQueryBuilder().update().set({ next_attempt_at: new Date(Date.now()-500) }).where('1=1').execute();
  }

  it('enqueue on status change', async () => {
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    // change status via service directly (simpler than HTTP path here)
    const productsService = app.get(ProductsService);
  await productsService.updateOrderStatus((order as any).id, 'approved');
    const rows = await outboxRepo.find();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].payload_json.event_id).toMatch(/[0-9a-f-]{36}/);
    expect(rows[0].delivery_url).toBe('https://example.com/hook');
  });

  it('success path sets succeeded + response_code', async () => {
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    const productsService = app.get(ProductsService);
  await productsService.updateOrderStatus((order as any).id, 'approved');
    await forceDueAll();
    const worker: any = (app as any).get('ClientApiWebhookWorker');
    await worker.tick();
    const row = (await outboxRepo.find())[0];
    expect(row.status).toBe('succeeded');
    expect(row.response_code).toBe(200);
    // headers presence
    const call = fetchCalls[0];
    expect(call.opts.headers['X-Webhook-Signature-Version']).toBe('v1');
    expect(call.opts.headers['X-Webhook-Timestamp']).toBeDefined();
    expect(call.opts.headers['X-Webhook-Nonce']).toBeDefined();
    expect(call.opts.headers['X-Webhook-Signature']).toBeDefined();
  });

  it('failure backoff increments attempt + sets next_attempt_at', async () => {
    (global as any).__FETCH_SCENARIO__ = 'fail500';
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    const productsService = app.get(ProductsService);
  await productsService.updateOrderStatus((order as any).id, 'approved');
    await forceDueAll();
    const worker: any = (app as any).get('ClientApiWebhookWorker');
    // first attempt
    await worker.tick();
    let row = (await outboxRepo.find())[0];
    expect(row.status).toBe('failed');
    expect(row.attempt_count).toBe(1);
    const diffSec = Math.round((row.next_attempt_at!.getTime() - Date.now())/1000);
    expect(diffSec <= BACKOFF[1] + 1).toBe(true);
    // speed up and try second
    await forceDueAll();
    await worker.tick();
    row = (await outboxRepo.find())[0];
    expect(row.attempt_count).toBe(2);
  });

  it('admin actions retry / mark-dead / redeliver', async () => {
    (global as any).__FETCH_SCENARIO__ = 'fail500';
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    const productsService = app.get(ProductsService);
  await productsService.updateOrderStatus((order as any).id, 'approved');
    await forceDueAll();
    const worker: any = (app as any).get('ClientApiWebhookWorker');
    await worker.tick(); // failed once
    let row = (await outboxRepo.find())[0];
    const id = row.id;
    // retry immediate
    await app.getHttpServer(); // ensure server started for route (if needed later)
    await app.get('ClientApiWebhookAdminController').retry({ user: { tenantId: (user as any).tenantId } }, id); // direct call
    const afterRetry = await outboxRepo.findOne({ where: { id } as any });
    expect(afterRetry!.status).toBe('failed'); // set to failed immediate due now
    (global as any).__FETCH_SCENARIO__ = 'success';
    await forceDueAll(); await worker.tick();
    const succeeded = await outboxRepo.findOne({ where: { id } as any });
    expect(succeeded!.status).toBe('succeeded');
    // redeliver
    const redeliverRes: any = await app.get('ClientApiWebhookAdminController').redeliver({ user: { tenantId: (user as any).tenantId } }, id);
    expect(redeliverRes.ok).toBe(true);
    const all = await outboxRepo.find();
    expect(all.length).toBe(2);
    const originalEventId = (succeeded as any).payload_json.event_id;
    const newRow = all.find(r=> r.id === redeliverRes.new_id)!;
    expect(newRow.payload_json.event_id).toBe(originalEventId);
    // mark dead
    await app.get('ClientApiWebhookAdminController').markDead({ user: { tenantId: (user as any).tenantId } }, newRow.id);
    const deadRow = await outboxRepo.findOne({ where: { id: newRow.id } as any });
    expect(deadRow!.status).toBe('dead');
  });

  it('concurrency cap (no more than 3 delivering)', async () => {
    (global as any).__FETCH_SCENARIO__ = 'timeout'; // force prolonged attempts
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    // seed 4 pending rows manually
    for (let i=0;i<4;i++) {
      await outboxRepo.save(outboxRepo.create({
        tenantId: (user as any).tenantId,
        userId: user.id,
        event_type: 'order-status',
        delivery_url: 'https://example.com/hook',
        payload_json: { event:'order-status', event_id: crypto.randomUUID() },
        status: 'pending', attempt_count: 0, next_attempt_at: new Date()
      }));
    }
    const worker: any = (app as any).get('ClientApiWebhookWorker');
    await worker.tick();
    const rows = await outboxRepo.find();
    const delivering = rows.filter(r=> r.status==='delivering');
    expect(delivering.length).toBeLessThanOrEqual(3);
  });

  it('no secret leakage in last_error', async () => {
    (global as any).__FETCH_SCENARIO__ = 'fail500';
  const user: any = await createUserWithWebhook();
    const order = await createOrder(user);
    const productsService = app.get(ProductsService);
  await productsService.updateOrderStatus((order as any).id, 'approved');
    await forceDueAll();
    const worker: any = (app as any).get('ClientApiWebhookWorker');
    await worker.tick();
    const row = (await outboxRepo.find())[0];
    expect(row.last_error || '').not.toContain('secret123');
  });
});

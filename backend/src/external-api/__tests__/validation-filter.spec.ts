import { AllExceptionsFilter } from '../../dev/all-exceptions.filter';
import { ArgumentsHost, UnprocessableEntityException } from '@nestjs/common';

function mockHost(bodyPath='/x', method='POST'): ArgumentsHost {
  const req: any = { path: bodyPath, url: bodyPath, method, headers: {}, user: { id: 'u1', tenantId: 't1' }, body: { a: 1 } };
  const res: any = { statusCode: 0, jsonBody: null, status(code:number){ this.statusCode=code; return this; }, json(obj:any){ this.jsonBody = obj; return this; } };
  return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any;
}

class FakeErrorsService { ingest(){ return Promise.resolve(); } }

describe('AllExceptionsFilter validation', () => {
  it('wraps validation array into envelope with VALIDATION_ERROR', async () => {
    const filter = new AllExceptionsFilter(new FakeErrorsService() as any);
  const ex = new UnprocessableEntityException({ message: ['name should not be empty'] });
    const host = mockHost();
    // @ts-ignore
    await filter.catch(ex, host);
    const res: any = host.switchToHttp().getResponse();
  expect(res.jsonBody.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.jsonBody.details)).toBe(true);
  });
});

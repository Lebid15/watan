import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorsService } from './errors.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errors: ErrorsService) {}
  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request: any = ctx.getRequest();
    try {
      await this.errors.ingest({
        source: 'backend',
        level: 'error',
        name: exception?.name,
        message: exception?.message || 'Unhandled error',
        stack: exception?.stack,
        path: request?.path,
        method: request?.method,
        userId: request?.user?.id,
        tenantId: request?.user?.tenantId,
        userAgent: request?.headers?.['user-agent'],
        context: { query: request?.query, body: sanitize(request?.body) },
      });
    } catch (e) {
      // swallow logging errors
    }
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const baseResp = exception instanceof HttpException ? exception.getResponse() : undefined;
    // Normalize response body (string | object)
    let message: string = 'Internal error';
    let code: string | undefined;
    let details: any = null;
    if (typeof baseResp === 'string') {
      message = baseResp || (exception?.message || message);
    } else if (baseResp && typeof baseResp === 'object') {
      const br: any = baseResp;
      if (Array.isArray(br.message)) {
        // class-validator style: message is array of strings; keep first human message but collect details
        message = 'Validation failed';
        details = br.message;
      } else {
        message = br.message || exception?.message || message;
      }
      if (br.code && typeof br.code === 'string') code = br.code;
      if (br.details) details = br.details;
    } else {
      message = exception?.message || message;
    }

    // Map fallback code if not explicitly provided.
    if (!code) {
      code = mapCode(status, message, exception);
    }

    // Extract validation details (class-validator standard structure) if not already captured
    if (!details && exception?.response?.message && Array.isArray(exception.response.message)) {
      details = exception.response.message;
    }
    // If validation errors structure (Nest ValidationPipe) under response.error or response.message
    if (!details && exception?.response?.errors) details = exception.response.errors;

    const envelope = {
      statusCode: status,
      code,
      message,
      details: details ?? null,
      timestamp: new Date().toISOString(),
      path: request?.url || request?.originalUrl || request?.path,
    };
    response.status(status).json(envelope);
  }
}

function mapCode(status: number, message: string, exception: any): string {
  switch (status) {
<<<<<<< HEAD
    case 401:
      if (/TENANT_MISMATCH/i.test(message)) return 'TENANT_MISMATCH';
      return 'INVALID_TOKEN';
=======
    case 401: return 'INVALID_TOKEN';
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
    case 403: return message === 'MISSING_SCOPE' ? 'MISSING_SCOPE' : 'FORBIDDEN';
    case 409:
      if (/IDEMPOTENCY_MISMATCH/i.test(message)) return 'IDEMPOTENCY_MISMATCH';
      if (/IDEMPOTENCY_IN_PROGRESS/i.test(message)) return 'IDEMPOTENCY_IN_PROGRESS';
      return 'CONFLICT';
    case 422:
      if (/IDEMPOTENCY_REQUIRED/i.test(message)) return 'IDEMPOTENCY_REQUIRED';
      return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

function sanitize(body: any) {
  if (!body || typeof body !== 'object') return body;
  const redacted = ['password', 'token', 'authorization'];
  const out: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (redacted.includes(k.toLowerCase())) out[k] = '[REDACTED]'; else out[k] = v;
  }
  return out;
}

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ClientApiError } from './client-api-error';

// Maps generic Nest exceptions / messages to required numeric codes.
function mapGeneric(e: any): { code: number; message: string; httpStatus?: number } {
  // Custom error already standardized
  if (e instanceof ClientApiError) {
    // Missing token should return 401 instead of 200 envelope
    if (e.codeNumber === 120) return { code: 120, message: e.clientMessage, httpStatus: 401 };
    if (e.codeNumber === 121) return { code: 121, message: e.clientMessage, httpStatus: 401 };
    if (e.codeNumber === 123) return { code: 123, message: e.clientMessage, httpStatus: 403 };
    return { code: e.codeNumber, message: e.clientMessage }; // default 200 wrapper
  }

  const resp: any = e?.response;
  const msgRaw = (resp?.message || e?.message || '').toString();
  const codeStr = (resp?.code || '').toString();
  const norm = msgRaw.toUpperCase();
  // Explicit missing token phrase
  if (/API TOKEN IS REQUIRED/i.test(norm)) return { code: 120, message: 'Api Token is required', httpStatus: 401 };
  if (/INVALID_TOKEN|UNAUTHORIZED/i.test(norm)) return { code: 121, message: 'Token error', httpStatus: 401 };
  if (/FORBIDDEN_IP/i.test(norm)) return { code: 123, message: 'IP not allowed', httpStatus: 403 };
  if (/MAINTENANCE/i.test(norm)) return { code: 130, message: 'Site under maintenance', httpStatus: 503 };
  if (codeStr === 'VALIDATION_ERROR') {
    if (/INVALID_QUANTITY/i.test(norm)) return { code: 105, message: 'Quantity not available', httpStatus: 200 };
  }
  if (/NOT_FOUND/i.test(codeStr) || /NOT_FOUND/i.test(norm)) return { code: 109, message: 'Product not found', httpStatus: 200 };
  if (/INVALID_PRODUCT/i.test(norm)) return { code: 110, message: 'Product not available now', httpStatus: 200 };
  if (/INSUFFICIENT_BALANCE/i.test(norm)) return { code: 100, message: 'Insufficient balance', httpStatus: 200 };
  return { code: 500, message: 'Unknown error' };
}

@Catch()
export class ClientApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    // Success responses not handled here
    const mapped = mapGeneric(exception);
    // For authentication / authz related codes we now return real HTTP status (401/403) to allow clients to distinguish quickly
    if (mapped.httpStatus) {
      return res.status(mapped.httpStatus).json({ code: mapped.code, message: mapped.message });
    }
    // Legacy behavior: always 200 for other business logic errors
    res.status(200).json({ code: mapped.code, message: mapped.message });
  }
}

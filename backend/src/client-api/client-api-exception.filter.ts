import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ClientApiError } from './client-api-error';

// Maps generic Nest exceptions / messages to required numeric codes.
function mapGeneric(e: any): { code: number; message: string } {
  // If already our custom error
  if (e instanceof ClientApiError) return { code: e.codeNumber, message: e.clientMessage };

  // Extract potential markers
  const resp: any = e?.response;
  const msgRaw = (resp?.message || e?.message || '').toString();
  const codeStr = (resp?.code || '').toString();
  const norm = msgRaw.toUpperCase();
  // Token cases (fallback) -> 121
  if (/INVALID_TOKEN|UNAUTHORIZED/i.test(norm)) return { code: 121, message: 'Token error' };
  if (/FORBIDDEN_IP/i.test(norm)) return { code: 123, message: 'IP not allowed' };
  if (/MAINTENANCE/i.test(norm)) return { code: 130, message: 'Site under maintenance' };
  if (codeStr === 'VALIDATION_ERROR') {
    // Quantity patterns
    if (/INVALID_QUANTITY/i.test(norm)) return { code: 105, message: 'Quantity not available' };
  }
  if (/NOT_FOUND/i.test(codeStr) || /NOT_FOUND/i.test(norm)) return { code: 109, message: 'Product not found' };
  if (/INVALID_PRODUCT/i.test(norm)) return { code: 110, message: 'Product not available now' };
  if (/INSUFFICIENT_BALANCE/i.test(norm)) return { code: 100, message: 'Insufficient balance' };
  // Default
  return { code: 500, message: 'Unknown error' };
}

@Catch()
export class ClientApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    // Success responses not handled here
    const mapped = mapGeneric(exception);
    res.status(200).json({ code: mapped.code, message: mapped.message });
  }
}

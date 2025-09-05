import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Publicly served OpenAPI subset (no auth, safe: only schema)
@Controller('/client/api')
export class ClientApiOpenapiPublicController {
  @Get('openapi.json')
  openapi() {
    try {
      const p = path.join(process.cwd(), 'openapi', 'openapi-client.json');
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { code: 500, message: 'OpenAPI not ready' };
    }
  }
}

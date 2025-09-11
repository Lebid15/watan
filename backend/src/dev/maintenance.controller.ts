import { Body, Controller, Post, Get, BadRequestException } from '@nestjs/common';
import { UserRole } from '../auth/user-role.enum';
import { Roles } from '../auth/roles.decorator';
import { spawn } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';

interface ToggleDto { enabled: boolean; message?: string }

@Controller('dev')
export class DevMaintenanceController {
  @Post('toggle-nginx-maint')
  @Roles(UserRole.DEVELOPER)
  async toggle(@Body() body: ToggleDto) {
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('enabled boolean required');
    }
    const mode = body.enabled ? 'on' : 'off';
    const message = (body.message && body.message.trim()) ? body.message.trim().slice(0, 5000) : undefined;
  // Use backend-local script (copies directly into nginx container)
  const script = join(process.cwd(), 'scripts', 'toggle-maintenance.sh');
    if (!fs.existsSync(script)) {
      throw new BadRequestException('script missing');
    }
    const args = [script, mode];
    if (message) args.push(message);
    const output: string[] = [];
    let exitCode = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('bash', args, { cwd: process.cwd() });
        child.stdout.on('data', d => output.push(String(d)));
        child.stderr.on('data', d => output.push(String(d)));
        child.on('error', reject);
        child.on('close', code => {
          exitCode = code ?? 0;
          return code === 0 ? resolve() : reject(new Error('exit '+code));
        });
      });
      return { ok: true, mode, output: output.join('').trim() };
    } catch (e:any) {
      const full = output.join('').trim();
      // Surface script failure details as 400 instead of generic 500
      throw new BadRequestException({
        ok: false,
        mode,
        error: e?.message || 'script failed',
        exitCode,
        output: full.slice(0, 4000)
      });
    }
  }

  @Get('maintenance-status')
  @Roles(UserRole.DEVELOPER)
  async status() {
  // We now overwrite mode.conf in shared nginx folder (bind mounted)
  const file = '/opt/nginx-shared/mode.conf';
    let enabled = false;
    try {
      if (fs.existsSync(file)) {
        const txt = fs.readFileSync(file, 'utf8').toLowerCase();
        if (txt.includes('on')) enabled = true;
      }
    } catch {}
    let message = 'نقوم حالياً بأعمال صيانة. سنعود قريباً.';
    let updatedAt = null as string | null;
    try {
  const mf = '/opt/nginx-shared/maintenance.message.json';
      if (fs.existsSync(mf)) {
        const parsed = JSON.parse(fs.readFileSync(mf,'utf8'));
        if (parsed?.message) message = String(parsed.message);
        if (parsed?.updatedAt) updatedAt = String(parsed.updatedAt);
      }
    } catch {}
    return { enabled, message, updatedAt };
  }

  @Post('maintenance-message')
  @Roles(UserRole.DEVELOPER)
  async message(@Body() body: { message: string }) {
  const file = '/opt/nginx-shared/maintenance.message.json';
    let message = body?.message || '';
    message = message.trim().slice(0, 5000) || 'نقوم حالياً بأعمال صيانة. سنعود قريباً.';
    const json = { message, updatedAt: new Date().toISOString() };
    try {
      fs.writeFileSync(file, JSON.stringify(json, null, 2));
    } catch {}
    return json;
  }
}
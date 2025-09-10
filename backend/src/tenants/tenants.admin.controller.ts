import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../auth/user-role.enum';
import { TenantsService } from './tenants.service';
import { ProvisionTenantService } from './provision-tenant.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddDomainDto } from './dto/add-domain.dto';
import { PatchDomainDto } from './dto/patch-domain.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isFeatureEnabled } from '../common/feature-flags';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.INSTANCE_OWNER)
// لا نضع "api/" هنا لأننا نستخدم setGlobalPrefix('api') في main.ts
@ApiTags('Admin Tenants')
@ApiBearerAuth()
@Controller('admin/tenants')
export class TenantsAdminController {
  constructor(private readonly svc: TenantsService, private readonly provisionSvc: ProvisionTenantService) {}

  private ensureFeature() {
    if (!isFeatureEnabled('adminTenantMgmt')) throw new ForbiddenException('Feature disabled');
  }

  // Tenants
  @Get()
  @ApiOperation({ summary: 'List tenants with optional status filter and pagination' })
  @ApiQuery({ name: 'status', required: false, enum: ['active','trashed','all'], description: 'Filter by status (default active)' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1 }, example: 1 })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 }, example: 20 })
  list(@Query('status') status?: 'active'|'trashed'|'all', @Query('page') page = '1', @Query('limit') limit = '20') {
    this.ensureFeature();
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const st = (status as any) || 'active';
    return this.svc.listTenantsPaged({ status: st, page: p, limit: l });
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
  this.ensureFeature();
    return this.svc.createTenant(dto);
  }

  // Formal provisioning endpoint (preferred)
  @Post('provision')
  provision(@Body() dto: ProvisionTenantDto) {
  this.ensureFeature();
    return this.provisionSvc.provision(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
  this.ensureFeature();
    return this.svc.getTenant(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
  this.ensureFeature();
    return this.svc.updateTenant(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.ensureFeature();
    return this.svc.deleteTenant(id, false);
  }

  // Soft delete (explicit endpoint)
  @Post(':id/trash')
  trash(@Param('id') id: string) {
  this.ensureFeature();
    return this.svc.deleteTenant(id, false);
  }

  // Restore trashed tenant
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a trashed tenant' })
  @ApiResponse({ status: 409, description: 'Conflict (code or domains in use)', schema: { example: { error: 'conflict', conflicts: { code: true, domains: ['x.wtn4.com'] }, suggestion: { code: 'code-1a2b', domains: { 'x.wtn4.com': 'x-1a2b.wtn4.com' } } } } })
  restore(@Param('id') id: string) {
  this.ensureFeature();
    return this.svc.restoreTenant(id);
  }

  // Hard delete (dangerous)
  @Delete(':id/hard')
  @ApiOperation({ summary: 'Hard delete a tenant (dangerous)' })
  @ApiQuery({ name: 'hard', required: true, example: 'true' })
  @ApiQuery({ name: 'confirm', required: true, description: 'Must equal tenant code' })
  @ApiResponse({ status: 409, description: 'Preconditions failed (balances or invoices open)', schema: { example: { error: 'precondition_failed', balances: 2, openInvoices: 1 } } })
  hardDelete(@Param('id') id: string, @Query('hard') hard?: string, @Query('confirm') confirm?: string) {
    this.ensureFeature();
    return this.svc.deleteTenant(id, true, { hard, confirm });
  }

  // Domains
  @Get(':id/domains')
  listDomains(@Param('id') tenantId: string) {
    return this.svc.listDomains(tenantId);
  }

  @Post(':id/domains')
  addDomain(@Param('id') tenantId: string, @Body() dto: AddDomainDto) {
    return this.svc.addDomain(tenantId, dto);
  }

  @Patch(':id/domains/:domainId')
  patchDomain(
    @Param('id') tenantId: string,
    @Param('domainId') domainId: string,
    @Body() dto: PatchDomainDto,
  ) {
    return this.svc.patchDomain(tenantId, domainId, dto);
  }

  @Delete(':id/domains/:domainId')
  deleteDomain(@Param('id') tenantId: string, @Param('domainId') domainId: string) {
    return this.svc.deleteDomain(tenantId, domainId);
  }

  // Utilities
  @Post(':id/reset-owner-password')
  resetOwnerPassword(@Param('id') tenantId: string) {
    return this.svc.resetOwnerPassword(tenantId);
  }
}

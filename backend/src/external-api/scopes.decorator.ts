import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ScopeGuard } from './scope.guard';
export const SCOPES_KEY = 'external_api_scopes';
export const Scopes = (...scopes: string[]) => applyDecorators(SetMetadata(SCOPES_KEY, scopes), UseGuards(ScopeGuard));

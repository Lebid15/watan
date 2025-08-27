import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from '../billing.service';

@Injectable()
export class BillingEnforcementScheduler {
  private readonly logger = new Logger('BillingEnforcement');
  constructor(private svc: BillingService) {}

  @Cron('0 10 0 * * *')
  async enforce() {
    this.logger.log('Billing enforcement job tick (placeholder)');
  }
}

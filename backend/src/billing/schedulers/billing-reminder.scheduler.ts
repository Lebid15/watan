import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from '../billing.service';

@Injectable()
export class BillingReminderScheduler {
  private readonly logger = new Logger('BillingReminder');
  constructor(private svc: BillingService) {}

  @Cron('0 0 8 * * *')
  async remind() {
    this.logger.log('Billing reminder job tick (placeholder)');
  }
}

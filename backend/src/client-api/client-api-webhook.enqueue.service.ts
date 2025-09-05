import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientApiWebhookOutbox } from './client-api-webhook-outbox.entity';
import { User } from '../user/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class ClientApiWebhookEnqueueService {
  constructor(
    @InjectRepository(ClientApiWebhookOutbox) private readonly outboxRepo: Repository<ClientApiWebhookOutbox>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async enqueueOrderStatus(opts: { tenantId: string; userId: string; order: { id: string; orderUuid?: string | null; status: string; productId?: string; quantity: number; updatedAt?: Date | null; }; }) {
    const user = await this.userRepo.findOne({ where: { id: opts.userId } as any });
    if (!user || !user.apiWebhookEnabled || !user.apiWebhookSecret || !user.apiWebhookUrl) return;
    const eventId = crypto.randomUUID();
    const payload = {
      event: 'order-status',
      event_id: eventId,
      order_id: opts.order.id,
      order_uuid: opts.order.orderUuid || null,
      status: this.mapStatus(opts.order.status),
      product_id: opts.order.productId || null,
      quantity: opts.order.quantity,
      updated_at: (opts.order.updatedAt || new Date()).toISOString(),
    };
    const row = this.outboxRepo.create({
      tenantId: opts.tenantId,
      userId: opts.userId,
      event_type: 'order-status',
      delivery_url: user.apiWebhookUrl!,
      payload_json: payload,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date(),
    });
    await this.outboxRepo.save(row);
  }

  private mapStatus(internal: string): string {
    if (internal === 'approved') return 'accept';
    if (internal === 'rejected') return 'reject';
    return 'wait';
  }
}

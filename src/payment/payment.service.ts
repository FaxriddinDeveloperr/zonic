// Payments (Phase L). Provider-agnostic skeleton. `create` records an invoice and returns a
// checkout URL; `confirm` (called by the provider webhook) marks it paid and fulfils the purpose
// (activating a subscription tier for 'subscription:<tier>').
//
// INTEGRATION TODO: real Click/Payme/Uzum support needs each provider's merchant API to (a) create
// the invoice in `create()` and (b) verify the signed callback in `confirm()`. Those calls are
// stubbed here (checkoutUrl is a placeholder; the webhook trusts its body) so the end-to-end flow
// is testable without live credentials. Do not enable real money flow until those are implemented.
import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { badRequest } from '../common/validation-problem';
import { isTier, TIER_PLANS, Tier } from '../common/subscription-tiers';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreatePaymentDto, PaymentCreatedDto, WebhookResultDto } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscription: SubscriptionService,
  ) {}

  async create(userId: string, dto: CreatePaymentDto): Promise<PaymentCreatedDto> {
    const amount = PaymentService.amountFor(dto.purpose);
    const externalId = `inv_${randomUUID().slice(0, 12)}`;

    const [row]: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO game_payment (user_id, provider, amount, currency, purpose, status, external_id)
       VALUES ($1, $2, $3, 'UZS', $4, 'created', $5) RETURNING id::text`,
      [userId, dto.provider, amount, dto.purpose, externalId],
    );

    // Real providers return their hosted checkout URL here.
    const checkoutUrl = `https://checkout.${dto.provider}.example/pay/${externalId}`;

    return {
      paymentId: row.id,
      provider: dto.provider,
      amount,
      currency: 'UZS',
      status: 'created',
      externalId,
      checkoutUrl,
    };
  }

  /** Provider webhook → settle the payment and fulfil its purpose. */
  async confirm(provider: string, externalId: string, status: string): Promise<WebhookResultDto> {
    // INTEGRATION TODO: verify the provider's signature here before trusting `status`.
    const [pay] = await this.dataSource.query(
      `SELECT id::text, user_id::text, purpose, status FROM game_payment
        WHERE external_id = $1 AND provider = $2`,
      [externalId, provider],
    );
    if (!pay) throw badRequest(['Unknown payment.']);
    if (pay.status === 'paid') return { ok: true, status: 'paid' }; // idempotent

    if (status !== 'paid') {
      await this.dataSource.query(
        `UPDATE game_payment SET status = 'failed' WHERE id = $1`,
        [pay.id],
      );
      return { ok: true, status: 'failed' };
    }

    await this.dataSource.query(
      `UPDATE game_payment SET status = 'paid', paid_at = now() WHERE id = $1`,
      [pay.id],
    );
    await this.fulfil(pay.user_id, pay.purpose);
    return { ok: true, status: 'paid' };
  }

  /** Apply what was paid for. Currently: subscription tiers (1 month). */
  private async fulfil(userId: string, purpose: string): Promise<void> {
    if (purpose.startsWith('subscription:')) {
      const tier = purpose.slice('subscription:'.length);
      if (isTier(tier) && tier !== 'free') {
        await this.subscription.activate(userId, tier as Tier, 1);
      }
    }
  }

  private static amountFor(purpose: string): number {
    if (purpose.startsWith('subscription:')) {
      const tier = purpose.slice('subscription:'.length);
      if (isTier(tier)) return TIER_PLANS[tier].pricePerMonthUzs;
    }
    throw badRequest(['Unknown or unsupported payment purpose.']);
  }
}

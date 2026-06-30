// Market catalogue + purchase (Phase K). Purchases spend Tanga; XP can optionally be spent for a
// discount (configurable tanga-per-XP). The balance mutation runs in one transaction with a row
// lock so concurrent purchases can't overspend.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EconomyConfig } from '../config/configuration';
import { badRequest } from '../common/validation-problem';
import { WalletService } from '../wallet/wallet.service';
import {
  MarketItemDto,
  MarketItemsResponseDto,
  PurchaseResultDto,
} from './dto/market.dto';

@Injectable()
export class MarketService {
  private readonly econ: EconomyConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    config: ConfigService,
  ) {
    this.econ = config.get<EconomyConfig>('economy')!;
  }

  async listItems(): Promise<MarketItemsResponseDto> {
    const rows: Array<{
      id: string;
      code: string;
      title: string;
      description: string | null;
      price_tanga: string;
      category: string | null;
    }> = await this.dataSource.query(
      `SELECT id::text, code, title, description, price_tanga, category
         FROM market_item WHERE is_active = true ORDER BY price_tanga ASC`,
    );
    const items: MarketItemDto[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      priceTanga: Number(r.price_tanga),
      category: r.category,
    }));
    return { items };
  }

  async purchase(userId: string, itemCode: string, useXp: number): Promise<PurchaseResultDto> {
    // Settle XP expiry first so we spend only currently-valid XP.
    await this.wallet.getWallet(userId);

    return this.dataSource.transaction(async (manager) => {
      const itemRows: Array<{ id: string; price_tanga: string }> = await manager.query(
        `SELECT id::text, price_tanga FROM market_item WHERE code = $1 AND is_active = true`,
        [itemCode],
      );
      const item = itemRows[0];
      if (!item) throw badRequest(['Item not found or inactive.']);
      const price = Number(item.price_tanga);

      const walletRows: Array<{ tanga: string; xp: string }> = await manager.query(
        `SELECT tanga, xp FROM game_user_wallet WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const w = walletRows[0] ?? { tanga: '0', xp: '0' };
      const balanceTanga = Number(w.tanga);
      const balanceXp = Number(w.xp);

      // XP discount — never spend more XP than needed to cover the price (or than is available).
      const rate = this.econ.xpDiscountTangaPerXp;
      const wantXp = Math.max(0, Math.floor(useXp || 0));
      const maxUsefulXp = rate > 0 ? Math.ceil(price / rate) : 0;
      const xpSpent = Math.min(wantXp, balanceXp, maxUsefulXp);
      const discount = xpSpent * rate;
      const pricePaid = Math.max(0, price - discount);

      if (balanceTanga < pricePaid) {
        throw badRequest([`Insufficient Tanga: need ${pricePaid}, have ${balanceTanga}.`]);
      }

      const newTanga = balanceTanga - pricePaid;
      const newXp = balanceXp - xpSpent;
      await manager.query(
        `UPDATE game_user_wallet SET tanga = $2, xp = $3, updated_at = now() WHERE user_id = $1`,
        [userId, newTanga, newXp],
      );

      const [ins]: Array<{ id: string }> = await manager.query(
        `INSERT INTO market_purchase (user_id, item_id, price_tanga, xp_spent)
         VALUES ($1, $2, $3, $4) RETURNING id::text`,
        [userId, item.id, pricePaid, xpSpent],
      );

      return { purchaseId: ins.id, pricePaid, xpSpent, tanga: newTanga, xp: newXp };
    });
  }
}

// Firebase Cloud Messaging (FCM) push. Initialises the Admin SDK from a service-account JSON whose
// path is given by FIREBASE_CREDENTIALS_PATH. If the file is absent (e.g. local dev) push is simply
// disabled — the rest of the app keeps working and in-app notifications are still stored.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: admin.app.App | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    const path = process.env.FIREBASE_CREDENTIALS_PATH;
    if (!path || !fs.existsSync(path)) {
      this.logger.warn('FIREBASE_CREDENTIALS_PATH not set / file missing — push notifications disabled.');
      return;
    }
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
      this.app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      this.logger.log('Firebase Admin initialised — push notifications enabled.');
    } catch (e) {
      this.logger.error(`Firebase init failed: ${(e as Error).message}`);
    }
  }

  /** Store (or reassign) a device token for a user. Idempotent per token. */
  async registerDevice(userId: string, token: string, platform: string | null): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO game_device_token (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
      [userId, token, platform],
    );
  }

  async removeDevice(token: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM game_device_token WHERE token = $1`, [token]);
  }

  /** Send an FCM push to every device registered for a user. No-op if push is disabled. */
  async sendToUser(
    userId: string,
    title: string,
    body: string | null,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!this.app) return;
    const rows: Array<{ token: string }> = await this.dataSource.query(
      `SELECT token FROM game_device_token WHERE user_id = $1`,
      [userId],
    );
    const tokens = rows.map((r) => r.token);
    if (tokens.length === 0) return;

    try {
      const res = await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title, body: body ?? undefined },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      // Prune tokens FCM reports as permanently invalid so the table stays clean.
      const invalid: string[] = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code ?? '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          invalid.push(tokens[i]);
        }
      });
      if (invalid.length) {
        await this.dataSource.query(`DELETE FROM game_device_token WHERE token = ANY($1)`, [invalid]);
      }
    } catch (e) {
      this.logger.error(`Push send failed for user ${userId}: ${(e as Error).message}`);
    }
  }
}

import { EntityManager } from 'typeorm';

/**
 * Assign a unique 6-digit ZONIC-ID to a user if they don't have one yet. Called at registration so
 * every user is friend-requestable (from search, leaderboards, the map) without a lazy first visit.
 * The `zonic_id IS NULL` guard + NOT EXISTS make concurrent/duplicate assignment safe.
 */
export async function assignZonicId(manager: EntityManager, userId: string): Promise<number | null> {
  const [existing] = await manager.query(`SELECT zonic_id FROM sys_user WHERE id = $1`, [userId]);
  if (existing?.zonic_id != null) return Number(existing.zonic_id);

  for (let i = 0; i < 25; i++) {
    const candidate = 100000 + Math.floor(Math.random() * 900000);
    await manager.query(
      `UPDATE sys_user SET zonic_id = $2
        WHERE id = $1 AND zonic_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM sys_user WHERE zonic_id = $2)`,
      [userId, candidate],
    );
    const [check] = await manager.query(`SELECT zonic_id FROM sys_user WHERE id = $1`, [userId]);
    if (check?.zonic_id != null) return Number(check.zonic_id);
  }
  return null; // extremely unlikely; lazy ensureZonicId will retry later
}

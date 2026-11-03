import mysql from 'mysql2/promise'
import type { Env } from '../env.ts'
import type { MysqlPort, SyncItemRow, UserRow } from './ports.ts'
import type { SyncKind } from '../types/sync.ts'

export function createMysql(env: Env): MysqlPort {
  const pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  })

  const bind = (conn: mysql.Pool | mysql.PoolConnection): MysqlPort => ({
    async upsertUserByOpenid(openid, now, id) {
      const [existing] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, openid, created_at, updated_at, last_login_at FROM users WHERE openid = ? LIMIT 1',
        [openid],
      )
      if (existing.length > 0) {
        const row = existing[0]
        await conn.execute(
          'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?',
          [now, now, row.id],
        )
        return {
          id: String(row.id),
          openid: String(row.openid),
          created_at: new Date(row.created_at),
          updated_at: now,
          last_login_at: now,
        }
      }
      await conn.execute(
        'INSERT INTO users (id, openid, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?)',
        [id, openid, now, now, now],
      )
      return { id, openid, created_at: now, updated_at: now, last_login_at: now }
    },
    async listSyncItems(userId) {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT user_id, kind, item_id, payload, updated_at, deleted, created_at FROM sync_items WHERE user_id = ?',
        [userId],
      )
      return rows.map(mapRow)
    },
    async getSyncItem(userId, kind, itemId) {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT user_id, kind, item_id, payload, updated_at, deleted, created_at FROM sync_items WHERE user_id = ? AND kind = ? AND item_id = ? LIMIT 1',
        [userId, kind, itemId],
      )
      return rows[0] ? mapRow(rows[0]) : null
    },
    async upsertSyncItem(row) {
      await conn.execute(
        `INSERT INTO sync_items (user_id, kind, item_id, payload, updated_at, deleted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at), deleted = VALUES(deleted)`,
        [
          row.user_id,
          row.kind,
          row.item_id,
          row.payload == null ? null : JSON.stringify(row.payload),
          row.updated_at,
          row.deleted,
          row.created_at,
        ],
      )
    },
    async withTransaction(fn) {
      if ('getConnection' in conn) {
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          const result = await fn(bind(connection))
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          throw error
        } finally {
          connection.release()
        }
      }
      return fn(bind(conn))
    },
  })

  return bind(pool)
}

function mapRow(row: mysql.RowDataPacket): SyncItemRow {
  return {
    user_id: String(row.user_id),
    kind: row.kind as SyncKind,
    item_id: String(row.item_id),
    payload: row.payload == null ? null : typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    updated_at: new Date(row.updated_at),
    deleted: row.deleted ? 1 : 0,
    created_at: new Date(row.created_at),
  }
}

export type { UserRow }

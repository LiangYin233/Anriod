import { and, isNotNull } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db/client'
import { media } from '../db/schema'
import { logger } from '../logger'
import { syncMedia } from './media'

let job: Bun.CronJob | null = null

export function startSyncScheduler() {
  if (job) return job

  const cronExpr = config.sync.cron
  if (!cronExpr) return

  job = Bun.cron(cronExpr, async () => {
    logger.info('开始定时同步任务')
    const result = await runSync()
    logger.success(`同步完成: 成功 ${result.synced} 个，失败 ${result.errors.length} 个`)
    if (result.errors.length > 0) {
      logger.error('同步错误', result.errors.slice(0, 5))
    }
  })

  logger.info(`同步调度器已启动: ${cronExpr}`)
  return job
}

export async function runSync(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  const rows = db
    .select({ id: media.id })
    .from(media)
    .where(and(isNotNull(media.source), isNotNull(media.source_id)))
    .all()

  for (const row of rows) {
    try {
      await syncMedia(row.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${row.id}: ${msg}`)
    }
  }

  return { synced: rows.length - errors.length, errors }
}

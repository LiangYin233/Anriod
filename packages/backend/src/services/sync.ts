import { syncMedia } from './media'
import { all } from '../db/helpers'
import { downloadQueue } from '../utils/download-queue'
import { config } from '../config'
import { logger } from '../logger'

let job: ReturnType<typeof Bun.cron> | null = null

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
  const rows = all<{ id: string }>(
    "SELECT id FROM media WHERE source IS NOT NULL AND source_id IS NOT NULL"
  )

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

/** Scan all items with remote cover_url but no local copy, trigger download. */
export function triggerCoverMigration(): { queued: number } {
  const rows = all<{ id: string; cover_url: string }>(
    "SELECT id, cover_url FROM media WHERE cover_url LIKE 'http%' AND (cover_local_path IS NULL OR cover_local_path = '')"
  )

  for (const row of rows) {
    downloadQueue.add({
      mediaId: row.id,
      coverUrl: row.cover_url,
      savePath: `${config.coversDir}/${row.id}`
    })
  }

  return { queued: rows.length }
}

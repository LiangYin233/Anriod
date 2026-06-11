import { Cron } from 'croner'
import { syncMedia } from './media'
import { all } from '../db/helpers'
import { downloadQueue } from '../utils/download-queue'
import { config } from '../config'

let job: Cron | null = null

export function startSyncScheduler() {
  if (job) return job

  const cronExpr = config.sync.cron
  if (!cronExpr) {
    console.log('Sync scheduler disabled (cron is empty)')
    return
  }

  job = new Cron(cronExpr, async () => {
    await runSync()
  })

  console.log(`Sync scheduler started: ${cronExpr}`)
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

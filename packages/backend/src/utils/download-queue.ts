import { mkdir } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { media } from '../db/schema'
import { proxyFetchOptions } from './proxy'
import { logger } from '../logger'

interface DownloadTask {
  mediaId: string
  coverUrl: string
  savePath: string
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return ''
  if (contentType.includes('image/jpeg')) return '.jpg'
  if (contentType.includes('image/png')) return '.png'
  if (contentType.includes('image/webp')) return '.webp'
  if (contentType.includes('image/gif')) return '.gif'
  return ''
}

class DownloadQueue {
  private queue: DownloadTask[] = []
  private isProcessing = false

  add(task: DownloadTask) {
    this.queue.push(task)
    logger.info(`封面下载队列 +1 (${this.queue.length}): ${task.mediaId}`)
    void this.process()
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const task = this.queue.shift()

    if (task) {
      try {
        const savedPath = await this.downloadCover(task)
        this.updateMediaCoverPath(task.mediaId, savedPath)
        logger.success(`封面下载完成: ${task.mediaId}`)
      } catch (error) {
        logger.error(`封面下载失败 ${task.mediaId}: ${error}`)
      }
    }

    this.isProcessing = false
    if (this.queue.length > 0) void this.process()
  }

  private async downloadCover(task: DownloadTask): Promise<string> {
    const response = await fetch(task.coverUrl, proxyFetchOptions())
    if (!response.ok) {
      throw new Error(`Cover download failed: ${response.status}`)
    }

    const extension = extname(new URL(task.coverUrl).pathname) || extensionFromContentType(response.headers.get('content-type')) || '.jpg'
    const savePath = extname(task.savePath) ? task.savePath : `${task.savePath}${extension}`
    await mkdir(dirname(savePath), { recursive: true })
    await Bun.write(savePath, await response.arrayBuffer())
    return savePath
  }

  private updateMediaCoverPath(mediaId: string, path: string) {
    // Extract just the filename for the URL path
    const filename = path.split(/[\\/]/).pop()
    if (!filename) {
      logger.error(`Invalid path for media ${mediaId}: ${path}`)
      return
    }

    // Store local path in cover_url field (e.g., "/covers/123.jpg")
    const localUrl = `/covers/${filename}`
    db.update(media).set({ cover_url: localUrl, updated_at: new Date().toISOString() }).where(eq(media.id, mediaId)).run()
  }
}

export const downloadQueue = new DownloadQueue()

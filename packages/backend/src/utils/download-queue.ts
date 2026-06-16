import { mkdir } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
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
        await this.downloadCover(task)
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
}

export const downloadQueue = new DownloadQueue()

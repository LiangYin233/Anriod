import { mkdir } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import { run } from '../db/helpers'
import { proxyFetchOptions } from './proxy'

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
      } catch (error) {
        console.error(`Failed to download cover for ${task.mediaId}:`, error)
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
    run('UPDATE media SET cover_local_path = ?, updated_at = ? WHERE id = ?', [path, new Date().toISOString(), mediaId])
  }
}

export const downloadQueue = new DownloadQueue()

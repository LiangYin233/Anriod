/**
 * 从 Bangumi 导出用户收藏数据并转为 Anriod 导入格式。
 *
 * 用法:
 *   bun run packages/backend/scripts/import-bgm.ts <UID>
 *
 * 前置:
 *   1. 在 config.yaml 的 datasources.bangumi.bgm_token 填入你的 Bangumi token
 *      (https://bgm.tv/dev/app 创建)
 *
 * 示例:
 *   bun run packages/backend/scripts/import-bgm.ts <UID>
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { proxyFetchOptions } from '../src/utils/proxy'

// ========== 配置 ==========
const BGM_USERNAME = process.argv[2]
if (!BGM_USERNAME) {
  console.error('请提供 Bangumi UID，例如: bun run packages/backend/scripts/import-bgm.ts <UID>')
  process.exit(1)
}
const BGM_BASE = 'https://api.bgm.tv'
const BGM_TOKEN = readToken()

function readToken(): string {
  try {
    const yaml = readFileSync(resolve(import.meta.dir, '..', 'config.yaml'), 'utf8')
    const match = yaml.match(/bgm_token:\s*"([^"]+)"/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

if (!BGM_TOKEN) {
  console.error('请先在 config.yaml 中配置 datasources.bangumi.bgm_token')
  process.exit(1)
}

// ========== 类型映射 ==========

/** Bangumi 收藏类型 → Anriod Status (参考, 实际使用 statusFromBgm) */
const BGM_TYPE_LABEL: Record<number, string> = {
  1: 'plan_to_watch',  // 想看
  2: 'completed',      // 看过
  3: 'watching',        // 在看
  4: 'on_hold',         // 搁置
  5: 'dropped',          // 抛弃
}

/** Bangumi subject type → Anriod MediaType */
const TYPE_MAP: Record<number, string> = {
  1: 'novel',
  2: 'anime',
  3: 'anime',  // music
  4: 'game',
  6: 'tv',
}

// ========== API 调用 ==========

async function fetchBgm(path: string): Promise<any> {
  const url = `${BGM_BASE}${path}`
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${BGM_TOKEN}`,
      'User-Agent': 'anriod/0.1.0 (https://github.com/anriod)'
    },
    ...proxyFetchOptions()
  })
  if (!resp.ok) {
    throw new Error(`Bangumi API error ${resp.status}: ${await resp.text().catch(() => '')}`)
  }
  return resp.json()
}

// ========== 主流程 ==========

interface BgmCollection {
  subject_id: number
  subject: {
    id: number
    name: string
    name_cn: string
    type: number
    eps?: number
    total_episodes?: number
    rating?: { score: number }
    images?: { large?: string; common?: string }
    summary?: string
    date?: string
    tags?: Array<{ name: string; count: number }>
    infobox?: Array<{ key: string; value: any }>
  }
  rate?: number
  type: number
  comment?: string
  ep_status?: number
  updated_at: string
}

async function main() {
  console.log(`正在获取用户 ${BGM_USERNAME} 的收藏...`)

  const allCollections: BgmCollection[] = []
  let offset = 0
  const limit = 50

  // 分页获取所有收藏
  while (true) {
    const page = await fetchBgm(
      `/v0/users/${BGM_USERNAME}/collections?limit=${limit}&offset=${offset}`
    ) as { data: BgmCollection[]; total: number }

    allCollections.push(...page.data)
    console.log(`  已获取 ${allCollections.length}/${page.total}`)

    if (allCollections.length >= page.total) break
    offset += limit
  }

  console.log(`共 ${allCollections.length} 条收藏`)

  // 转换为 Anriod 格式
  const media: any[] = []
  const tagsSet = new Map<string, number>()
  const history: any[] = []
  let tagIdSeq = 1

  for (const item of allCollections) {
    const subj = item.subject
    const title = subj.name_cn || subj.name
    const anriodType = TYPE_MAP[subj.type] || 'anime'
    const anriodStatus = statusFromBgm(item.type, item.ep_status ?? 0, subj.eps ?? subj.total_episodes ?? 0)
    const mediaId = crypto.randomUUID()

    // Tags
    const tagNames: string[] = []
    const bgmTags = (subj.tags || []).slice(0, 5)
    for (const t of bgmTags) {
      if (!tagsSet.has(t.name)) {
        tagsSet.set(t.name, tagIdSeq++)
      }
      tagNames.push(t.name)
    }

    const now = new Date().toISOString()
    const bangumiDate = item.updated_at || now
    const progress = anriodStatus === 'completed'
      ? { episode: subj.eps ?? subj.total_episodes ?? 0 }
      : item.ep_status ? { episode: item.ep_status } : null

    media.push({
      id: mediaId,
      title,
      type: anriodType,
      status: anriodStatus,
      rating: item.rate ?? null,
      notes: item.comment || null,
      current_progress: progress,
      cover_url: subj.images?.large || subj.images?.common || null,
      cover_local_path: null,
      description: subj.summary || null,
      external_rating: subj.rating?.score ?? null,
      air_date: subj.date || null,
      total_episodes: subj.total_episodes ?? subj.eps ?? null,
      studio: null,
      source_metadata: null,
      source: 'bangumi',
      source_id: String(subj.id),
      source_url: `https://bgm.tv/subject/${subj.id}`,
      synced_at: now,
      created_at: bangumiDate,
      updated_at: bangumiDate,
      tags: tagNames
    })

    // 如果有进度，创建观看历史
    if (progress && progress.episode > 0) {
      const watchDate = item.updated_at || now
      history.push({
        id: history.length + 1,
        media_id: mediaId,
        media_title: title,
        started_at: watchDate,
        completed_at: anriodStatus === 'completed' ? watchDate : null,
        progress_from: { episode: 0 },
        progress_to: progress,
        rating: item.rate ?? null,
        notes: item.comment || null,
        created_at: now
      })
    }
  }

  const tags = Array.from(tagsSet.entries()).map(([name, id]) => ({
    id,
    name,
    created_at: new Date().toISOString()
  }))

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    media,
    tags,
    watch_history: history
  }

  const outPath = resolve(import.meta.dir, '..', 'data', 'bangumi-import.json')
  writeFileSync(outPath, JSON.stringify(exportData, null, 2))
  console.log(`\n导出完成: ${outPath}`)
  console.log(`  ${media.length} 条媒体记录`)
  console.log(`  ${tags.length} 个标签`)
  console.log(`  ${history.length} 条观看历史`)
  console.log(`\n导入命令: curl -X POST http://localhost:8000/api/backup/import \\`)
  console.log(`  -H "Authorization: Bearer your-api-key" \\`)
  console.log(`  -H "Content-Type: application/json" \\`)
  console.log(`  -d @data/bangumi-import.json`)
}

function statusFromBgm(bgmType: number, epStatus: number, totalEps: number): string {
  // bgm type: 1=想看, 2=看过, 3=在看, 4=搁置, 5=抛弃
  if (bgmType === 3) return 'watching'
  if (bgmType === 2) return 'completed'
  if (bgmType === 4) return 'on_hold'
  if (bgmType === 5) return 'dropped'
  if (bgmType === 1 && epStatus > 0 && epStatus < totalEps) return 'watching'
  return 'plan_to_watch'
}

main().catch((err) => {
  console.error('导出失败:', err.message)
  process.exit(1)
})

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

export interface DataSourceConfig {
  enabled: boolean
  baseUrl: string
  bgmToken?: string
  accessToken?: string
  language?: string
}

export interface AppConfig {
  server: {
    port: number
    host: string
  }
  auth: {
    apiKey: string
  }
  sync: {
    cron: string
  }
  proxy?: string
  datasources: Record<string, DataSourceConfig>
  backendRoot: string
  databasePath: string
  coversDir: string
}

/**
 * Find the directory containing config.yaml, starting from cwd and walking up.
 */
function findRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'config.yaml'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  // Fallback: project root or cwd
  return resolve(import.meta.dir, '..')
}

export const backendRoot = findRoot()

export function resolveBackendPath(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(backendRoot, pathValue)
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim()
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '')

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

  return unquoted
}

function stripInlineComment(value: string): string {
  let quote: '"' | "'" | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : char
    }
    if (char === '#' && quote === null) {
      return value.slice(0, index).trimEnd()
    }
  }

  return value
}

function parseSimpleYaml(content: string): Record<string, any> {
  const root: Record<string, any> = {}
  const stack: Array<{ indent: number; value: Record<string, any> }> = [{ indent: -1, value: root }]

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ')
    if (!line.trim() || line.trimStart().startsWith('#')) continue

    const match = /^(\s*)([^:#]+):(.*)$/.exec(line)
    if (!match) continue

    const indent = match[1].length
    const key = match[2].trim()
    const rawValue = stripInlineComment(match[3]).trim()

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].value
    if (!rawValue) {
      const child: Record<string, any> = {}
      parent[key] = child
      stack.push({ indent, value: child })
    } else {
      parent[key] = parseScalar(rawValue)
    }
  }

  return root
}

function readYamlConfig(): Record<string, any> {
  const configPath = resolve(backendRoot, 'config.yaml')
  if (!existsSync(configPath)) {
    // Auto-create with defaults
    const defaults = `server:
  port: 8000
  host: 0.0.0.0

auth:
  api_key: "your-secret-api-key-here"

sync:
  cron: "0 3 * * *"

datasources:
  bangumi:
    enabled: true
    base_url: https://api.bgm.tv
    bgm_token: ""
  tmdb:
    enabled: true
    base_url: https://api.themoviedb.org/3
    access_token: ""
    language: zh-CN
`
    try {
      writeFileSync(configPath, defaults, 'utf8')
      console.log('Created default config.yaml')
    } catch {
      // read-only filesystem, keep defaults in memory
    }
    return parseSimpleYaml(defaults)
  }

  return parseSimpleYaml(readFileSync(configPath, 'utf8'))
}

const rawConfig = readYamlConfig()

export const config: AppConfig = {
  server: {
    port: Number(rawConfig.server?.port ?? 8000),
    host: String(rawConfig.server?.host ?? '0.0.0.0')
  },
  auth: {
    apiKey: String(rawConfig.auth?.api_key ?? 'your-secret-api-key-here')
  },
  sync: {
    cron: String(rawConfig.sync?.cron ?? '0 3 * * *')
  },
  proxy: String(rawConfig.proxy ?? '') || undefined,
  datasources: {
    bangumi: {
      enabled: Boolean(rawConfig.datasources?.bangumi?.enabled ?? true),
      baseUrl: String(rawConfig.datasources?.bangumi?.base_url ?? 'https://api.bgm.tv'),
      bgmToken: String(rawConfig.datasources?.bangumi?.bgm_token ?? '') || undefined
    },
    tmdb: {
      enabled: Boolean(rawConfig.datasources?.tmdb?.enabled ?? true),
      baseUrl: String(rawConfig.datasources?.tmdb?.base_url ?? 'https://api.themoviedb.org/3'),
      accessToken: String(rawConfig.datasources?.tmdb?.access_token ?? '') || undefined,
      language: String(rawConfig.datasources?.tmdb?.language ?? 'zh-CN')
    }
  },
  backendRoot,
  databasePath: resolveBackendPath('./data/media.db'),
  coversDir: resolveBackendPath('./data/covers')
}

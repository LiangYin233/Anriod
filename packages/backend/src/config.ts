import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

export interface DataSourceConfig {
  enabled: boolean
  /** All other YAML fields under this data source entry, passed as-is to the DataSource constructor. */
  extra: Record<string, unknown>
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
  // Fallback: use cwd (works for both source and compiled binary)
  // import.meta.dir points to the source dir during development but
  // may be undefined or point to the binary location when compiled.
  return process.cwd()
}

export const backendRoot = findRoot()

export function resolveBackendPath(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(backendRoot, pathValue)
}

const DEFAULT_YAML = `server:
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

function deepMerge(base: any, patch: any): any {
  const result = { ...base }
  for (const key of Object.keys(patch)) {
    if (typeof patch[key] === 'object' && patch[key] !== null && !Array.isArray(patch[key])) {
      result[key] = deepMerge(result[key] || {}, patch[key])
    } else if (result[key] === undefined) {
      result[key] = patch[key]
    }
  }
  return result
}

function readYamlConfig(): Record<string, any> {
  const configPath = resolve(backendRoot, 'config.yaml')
  const defaultParsed = Bun.YAML.parse(DEFAULT_YAML) as Record<string, any>

  if (!existsSync(configPath)) {
    try {
      writeFileSync(configPath, DEFAULT_YAML, 'utf8')
    } catch {
      // read-only filesystem, keep defaults in memory
    }
    return defaultParsed
  }

  const raw = readFileSync(configPath, 'utf8')
  const existing = Bun.YAML.parse(raw) as Record<string, any>

  // Merge defaults for missing keys (in-memory only, don't rewrite the file)
  return deepMerge(existing, defaultParsed)
}

function datasourcesFromYaml(raw: Record<string, any> | undefined): Record<string, DataSourceConfig> {
  const result: Record<string, DataSourceConfig> = {}
  if (!raw || typeof raw !== 'object') return result

  for (const [name, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue
    const { enabled, ...rest } = entry as Record<string, unknown>
    result[name] = {
      enabled: enabled !== false,  // default true
      extra: rest                 // all other YAML fields, key names preserved (snake_case etc.)
    }
  }
  return result
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
  datasources: datasourcesFromYaml(rawConfig.datasources),
  backendRoot,
  databasePath: resolveBackendPath('./data/media.db'),
  coversDir: resolveBackendPath('./data/covers')
}

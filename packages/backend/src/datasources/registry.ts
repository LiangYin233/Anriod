import { config } from '../config'
import { logger } from '../logger'
import { BangumiDataSource } from './bangumi'
import { TmdbDataSource } from './tmdb'
import type { DataSource, DataSourceClass } from './types'

const registeredSources: Record<string, DataSource> = {}

const CLASSES: DataSourceClass[] = [BangumiDataSource, TmdbDataSource]

for (const [name, cfg] of Object.entries(config.datasources)) {
  if (!cfg.enabled) continue

  const Cls = CLASSES.find((c) => c.sourceName === name)
  if (!Cls) {
    logger.warn(`数据源 "${name}" 未找到匹配的实现类，跳过`)
    continue
  }

  registeredSources[name] = new Cls(cfg.extra)
  logger.info(`数据源 ${name} 已启用`)
}

export const dataSources = registeredSources

export function getDataSource(name: string): DataSource | undefined {
  return dataSources[name]
}

export function listDataSources(): string[] {
  return Object.keys(dataSources)
}

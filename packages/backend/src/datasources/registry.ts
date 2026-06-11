import { config } from '../config'
import { logger } from '../logger'
import { BangumiDataSource } from './bangumi'
import { TmdbDataSource } from './tmdb'
import type { DataSource } from './types'

const registeredSources: Record<string, DataSource> = {}

if (config.datasources.bangumi?.enabled) {
  registeredSources.bangumi = new BangumiDataSource()
  logger.info('数据源 Bangumi 已启用')
}

if (config.datasources.tmdb?.enabled && config.datasources.tmdb?.accessToken) {
  registeredSources.tmdb = new TmdbDataSource()
  logger.info('数据源 TMDB 已启用')
}

export const dataSources = registeredSources

export function getDataSource(name: string): DataSource | undefined {
  return dataSources[name]
}

export function listDataSources(): string[] {
  return Object.keys(dataSources)
}

import { config } from '../config'
import { BangumiDataSource } from './bangumi'
import { TmdbDataSource } from './tmdb'
import type { DataSource } from './types'

const registeredSources: Record<string, DataSource> = {}

if (config.datasources.bangumi?.enabled) {
  registeredSources.bangumi = new BangumiDataSource()
}

if (config.datasources.tmdb?.enabled && config.datasources.tmdb?.accessToken) {
  registeredSources.tmdb = new TmdbDataSource()
}

export const dataSources = registeredSources

export function getDataSource(name: string): DataSource | undefined {
  return dataSources[name]
}

export function listDataSources(): string[] {
  return Object.keys(dataSources)
}

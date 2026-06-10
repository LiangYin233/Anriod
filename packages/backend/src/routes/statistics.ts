import { Hono } from 'hono'
import { getOverview, getRatingDistribution, getTagStatistics, getTimeline } from '../services/statistics'

export const statisticsRoutes = new Hono()

statisticsRoutes.get('/overview', (c) => c.json(getOverview()))
statisticsRoutes.get('/timeline', (c) => c.json(getTimeline()))
statisticsRoutes.get('/tags', (c) => c.json(getTagStatistics()))
statisticsRoutes.get('/ratings', (c) => c.json(getRatingDistribution()))

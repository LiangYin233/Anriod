import { createRouter, createWebHashHistory } from 'vue-router'
import { useConfig } from '@/composables/useConfig'

// Core pages (preload)
import Home from '@/views/Home.vue'
import Settings from '@/views/Settings.vue'

// Lazy load secondary pages
const MediaDetail = () => import('@/views/MediaDetail.vue')
const Search = () => import('@/views/Search.vue')
const History = () => import('@/views/History.vue')
const Tags = () => import('@/views/Tags.vue')
const ExploreWork = () => import('@/views/ExploreWork.vue')
const Discover = () => import('@/views/Discover.vue')
const Statistics = () => import('@/views/Statistics.vue')

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/media/:id', name: 'MediaDetail', component: MediaDetail },
  { path: '/explore', name: 'ExploreWork', component: ExploreWork },
  { path: '/discover', name: 'Discover', component: Discover },
  { path: '/search', name: 'Search', component: Search },
  { path: '/history', name: 'History', component: History },
  { path: '/statistics', name: 'Statistics', component: Statistics },
  { path: '/tags', name: 'Tags', component: Tags },
  { path: '/settings', name: 'Settings', component: Settings }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const { isConfigured } = useConfig()
  if (!isConfigured.value && to.name !== 'Settings') {
    return { name: 'Settings' }
  }

  return true
})

export default router

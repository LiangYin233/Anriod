import { createRouter, createWebHashHistory } from 'vue-router'
import { useConfig } from '@/composables/useConfig'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue') },
  { path: '/media/:id', name: 'MediaDetail', component: () => import('@/views/MediaDetail.vue') },
  { path: '/search', name: 'Search', component: () => import('@/views/Search.vue') },
  { path: '/history', name: 'History', component: () => import('@/views/History.vue') },
  { path: '/statistics', name: 'Statistics', component: () => import('@/views/Statistics.vue') },
  { path: '/tags', name: 'Tags', component: () => import('@/views/Tags.vue') },
  { path: '/settings', name: 'Settings', component: () => import('@/views/Settings.vue') }
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

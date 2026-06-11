import { createRouter, createWebHashHistory } from 'vue-router'
import { useConfig } from '@/composables/useConfig'
import Home from '@/views/Home.vue'
import MediaDetail from '@/views/MediaDetail.vue'
import Search from '@/views/Search.vue'
import History from '@/views/History.vue'
import Tags from '@/views/Tags.vue'
import Settings from '@/views/Settings.vue'
import ExploreWork from '@/views/ExploreWork.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/media/:id', name: 'MediaDetail', component: MediaDetail },
  { path: '/explore', name: 'ExploreWork', component: ExploreWork },
  { path: '/search', name: 'Search', component: Search },
  { path: '/history', name: 'History', component: History },
  { path: '/statistics', name: 'Statistics', component: () => import('@/views/Statistics.vue') },
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

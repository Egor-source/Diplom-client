import Vue from 'vue'
import VueRouter from 'vue-router'


Vue.use(VueRouter)


const routes = [
  {
    path: '/Login',
    name: 'Login',
    component: () => import('@/pages/Login.vue')
  },
  {
    path: '/',
    name: 'Create',
    component: () => import('@/pages/CreateСonference.vue')
  },
  {
    path: '/Conference',
    name: 'Conference',
    component: () => import('@/pages/Conferences.vue')
  },
  {
    path: '/ConferanceEnd',
    name: 'ConferanceEnd',
    component: () => import('@/pages/ConferanceEnd.vue')
  },
  {
    path: '*',
    name: '404',
    component: () => import('@/pages/404.vue')
  },
]

const router = new VueRouter({
  routes,
  mode: 'history'
})

export default router

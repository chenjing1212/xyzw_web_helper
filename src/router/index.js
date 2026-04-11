import { createRouter, createWebHistory } from 'vue-router'
import * as autoRoutes from "vue-router/auto-routes";
import { useTokenStore } from '@/stores/tokenStore'
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils"

const generatedRoutes = autoRoutes.routes ?? [];

const my_routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '首页',
      requiresToken: false,
      requiresAuth: false  // 新增：是否需要登录密码
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      requiresToken: false,
      requiresAuth: false  // 登录页本身不需要密码
    }
  },
  {
    path: '/tokens',
    name: 'TokenImport',
    component: () => import('@/views/TokenImport/index.vue'),
    meta: {
      title: 'Token管理',
      requiresToken: false,
      requiresAuth: true   // 需要登录密码
    },
    props: route => ({
      token: route.query.token,
      name: route.query.name,
      server: route.query.server,
      wsUrl: route.query.wsUrl,
      api: route.query.api,
      auto: route.query.auto === 'true'
    })
  },
  {
    name: 'DefaultLayout',
    path: '/admin',
    component: () => import('@/layout/DefaultLayout.vue'),
    meta: {
      requiresAuth: true   // 整个admin区域都需要登录密码
    },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '控制台',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'game-features',
        name: 'GameFeatures',
        component: () => import('@/views/GameFeatures.vue'),
        meta: {
          title: '游戏功能',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'message-test',
        name: 'MessageTest',
        component: () => import('@/components/Test/MessageTester.vue'),
        meta: {
          title: '消息测试',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'legion-war',
        name: 'LegionWar',
        component: () => import('@/views/LegionWar.vue'),
        meta: {
          title: '实时盐场',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: {
          title: '个人设置',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'daily-tasks',
        name: 'DailyTasks',
        component: () => import('@/views/DailyTasks.vue'),
        meta: {
          title: '日常任务',
          requiresToken: true,
          requiresAuth: true
        }
      },
      {
        path: 'batch-daily-tasks',
        name: 'BatchDailyTasks',
        component: () => import('@/views/BatchDailyTasks.vue'),
        meta: {
          title: '批量日常',
          requiresToken: true,
          requiresAuth: true
        }
      },
      // 增加自动路由引用
      ...generatedRoutes,
    ]
  },
  {
    path: '/websocket-test',
    name: 'WebSocketTest',
    component: () => import('@/components/Test/WebSocketTester.vue'),
    meta: {
      title: 'WebSocket测试',
      requiresToken: true,
      requiresAuth: true
    }
  },
  // 兼容旧路由，重定向到新的token管理页面
  {
    path: '/old-login',
    redirect: '/tokens'
  },
  {
    path: '/register',
    redirect: '/tokens'
  },
  {
    path: '/game-roles',
    redirect: '/tokens'
  },
  // 增加自动路由引用
  ...generatedRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面不存在',
      requiresAuth: false
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: my_routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 热更新路由
autoRoutes.handleHotUpdate?.(router);

// 检查是否已登录的辅助函数
const isAuthenticated = () => {
  const authToken = localStorage.getItem('site_auth_token')
  return authToken === 'authenticated'
}

// 导航守卫（核心修改）
router.beforeEach((to, from, next) => {
  const tokenStore = useTokenStore()
  
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - XYZW 游戏管理系统` : 'XYZW 游戏管理系统'
  
  // 盐场时间判断（保留你原有的逻辑）
  if (to.name === "LegionWar" && !isNowInLegionWarTime()) {
    next('/admin/dashboard');
    return;
  }
  
  // ========== 新增：登录密码保护 ==========
  // 检查当前路由是否需要登录认证
  const requiresAuth = to.meta.requiresAuth === true
  
  if (requiresAuth && !isAuthenticated()) {
    // 需要登录但未登录，跳转到登录页
    next({
      path: '/login',
      query: { redirect: to.fullPath }  // 记录原地址，登录后跳回来
    })
    return
  }
  
  // 如果已登录但访问登录页，跳转到首页
  if (to.path === '/login' && isAuthenticated()) {
    next('/')
    return
  }
  // ========== 登录密码保护结束 ==========
  
  // 原有的 Token 检查逻辑（保持不变）
  if (to.meta.requiresToken && !tokenStore.hasTokens) {
    next('/tokens')
    return
  }
  
  // 首页重定向逻辑（保持不变）
  if (to.path === '/' && tokenStore.hasTokens) {
    if (tokenStore.selectedToken) {
      next('/admin/dashboard')
    } else {
      next('/tokens')
    }
    return
  }
  
  next()
})

export default router
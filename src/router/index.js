import { createRouter, createWebHistory } from 'vue-router'
import * as autoRoutes from "vue-router/auto-routes";
import { useTokenStore } from '@/stores/tokenStore'
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils"

const generatedRoutes = autoRoutes.routes ?? [];

// ========== 密码版本配置 ==========
const CURRENT_PASSWORD_VERSION = 1  // 和Login.vue保持一致

// ========== 修复：移除会导致循环重载的 checkPasswordVersion ==========
// 直接使用 isAuthenticated 进行版本检查即可

const my_routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '首页',
      requiresToken: false,
      requiresAuth: false
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      requiresToken: false,
      requiresAuth: false
    }
  },
  {
    path: '/tokens',
    name: 'TokenImport',
    component: () => import('@/views/TokenImport/index.vue'),
    meta: {
      title: 'Token管理',
      requiresToken: false,
      requiresAuth: true
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
      requiresAuth: true
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

// 检查是否已登录的辅助函数（已包含版本检查）
const isAuthenticated = () => {
  const authToken = localStorage.getItem('site_auth_token')
  const savedVersion = localStorage.getItem('password_version')
  
  // 只有在有token且版本号匹配时才认为是已登录
  return authToken === 'authenticated' && savedVersion === String(CURRENT_PASSWORD_VERSION)
}

// 导航守卫
router.beforeEach((to, from, next) => {
  const tokenStore = useTokenStore()
  
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - XYZW 游戏管理系统` : 'XYZW 游戏管理系统'
  
  // 盐场时间判断
  if (to.name === "LegionWar" && !isNowInLegionWarTime()) {
    next('/admin/dashboard');
    return;
  }
  
  // ========== 修复：移除会导致循环重载的 checkPasswordVersion ==========
  // 不再调用 checkPasswordVersion，因为它会导致无限刷新
  // 版本不匹配的用户会在 isAuthenticated() 中被识别为未登录
  
  // 登录密码保护
  const requiresAuth = to.meta.requiresAuth === true
  
  if (requiresAuth && !isAuthenticated()) {
    // 版本不匹配的用户会走到这里，被重定向到登录页
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }
  
  // 如果已登录但访问登录页，跳转到首页
  if (to.path === '/login' && isAuthenticated()) {
    next('/')
    return
  }
  
  // 原有的 Token 检查逻辑
  if (to.meta.requiresToken && !tokenStore.hasTokens) {
    next('/tokens')
    return
  }
  
  // 首页重定向逻辑
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
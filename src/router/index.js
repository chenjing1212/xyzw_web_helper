import { createRouter, createWebHistory } from 'vue-router'
import * as autoRoutes from "vue-router/auto-routes";
import { useTokenStore } from '@/stores/tokenStore'
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils"

const generatedRoutes = autoRoutes.routes ?? [];

// ========== 新增：密码版本配置 ==========
// 每次修改密码后，把这个版本号+1（必须和Login.vue中的保持一致）
const CURRENT_PASSWORD_VERSION = 1  // 👈 改成当前版本号

// 检查是否需要强制重新登录（密码版本不匹配）
const checkPasswordVersion = () => {
  const savedVersion = localStorage.getItem('password_version')
  const isLoggedIn = localStorage.getItem('site_auth_token') === 'authenticated'
  
  // 已登录但版本不匹配，需要强制重新登录
  if (isLoggedIn && savedVersion !== String(CURRENT_PASSWORD_VERSION)) {
    // 清除所有登录状态
    localStorage.removeItem('site_auth_token')
    localStorage.removeItem('password_version')
    return false
  }
  return true
}
// ========== 版本控制结束 ==========

const my_routes = [
  // ... 你的路由配置保持不变
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
  // ========== 修改：加入版本检查 ==========
  const authToken = localStorage.getItem('site_auth_token')
  const savedVersion = localStorage.getItem('password_version')
  
  // 只有在有token且版本号匹配时才认为是已登录
  return authToken === 'authenticated' && savedVersion === String(CURRENT_PASSWORD_VERSION)
  // ========== 修改结束 ==========
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
  
  // ========== 新增：强制清除版本不匹配的用户 ==========
  // 在路由守卫最前面执行版本检查，清除不匹配的登录状态
  if (!checkPasswordVersion()) {
    // 版本不匹配，已经清除了localStorage，刷新页面让守卫重新判断
    window.location.reload()
    return
  }
  // ========== 版本检查结束 ==========
  
  // 登录密码保护
  const requiresAuth = to.meta.requiresAuth === true
  
  if (requiresAuth && !isAuthenticated()) {
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
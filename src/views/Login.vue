<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">XYZW 游戏管理系统</h2>
      <div class="login-subtitle">请输入密码进入</div>
      
      <n-form ref="formRef" :model="form" :rules="rules">
        <n-form-item path="password">
          <n-input
            v-model:value="form.password"
            type="password"
            placeholder="请输入访问密码"
            size="large"
            @keyup.enter="handleLogin"
          />
        </n-form-item>
        
        <n-button
          type="primary"
          size="large"
          block
          :loading="loading"
          @click="handleLogin"
        >
          进入系统
        </n-button>
      </n-form>
      
      <div class="login-footer">
        <n-text depth="3">内部使用，请勿外传</n-text>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage, NForm, NFormItem, NInput, NButton, NText } from 'naive-ui'

// 这里设置你的访问密码（可以改成你想要的任意密码）
const ACCESS_PASSWORD = 'yngzzjy'  // ← 修改成你想要的密码

const router = useRouter()
const route = useRoute()
const message = useMessage()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  password: ''
})

const rules = {
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  try {
    await formRef.value?.validate()
    loading.value = true
    
    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (form.password === ACCESS_PASSWORD) {
      // 保存登录状态
      localStorage.setItem('site_auth_token', 'authenticated')
      
      message.success('登录成功')
      
      // 跳转到之前想去的页面，如果没有则跳转首页
      const redirect = route.query.redirect || '/'
      router.push(redirect)
    } else {
      message.error('密码错误，请重试')
    }
  } catch (error) {
    // 表单验证失败
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.login-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #333;
}

.login-subtitle {
  margin-bottom: 32px;
  font-size: 14px;
  color: #999;
}

.login-footer {
  margin-top: 24px;
  font-size: 12px;
}
</style>
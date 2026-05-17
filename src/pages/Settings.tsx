import { useState, FormEvent, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { Toast } from '../lib/types'

interface SettingsProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Settings({ showToast }: SettingsProps) {
  const { user } = useAuthStore()
  const { settings, loading: settingsLoading, save } = useSettings()

  // API key state
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keyDirty, setKeyDirty] = useState(false)

  // Threshold
  const [defaultThreshold, setDefaultThreshold] = useState(50)
  const [savingThreshold, setSavingThreshold] = useState(false)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (settings) {
      setApiKey(settings.openrouter_api_key ?? '')
      setDefaultThreshold(settings.low_threshold_default ?? 50)
    }
  }, [settings])

  const handleSaveApiKey = async () => {
    setSavingKey(true)
    try {
      const ok = await save({ openrouter_api_key: apiKey.trim() || null })
      if (ok) { showToast('API Key 已保存', 'success'); setKeyDirty(false) }
      else showToast('保存失败，请重试', 'error')
    } finally {
      setSavingKey(false)
    }
  }

  const handleSaveThreshold = async () => {
    if (defaultThreshold < 0) { showToast('阈值不能为负数', 'error'); return }
    setSavingThreshold(true)
    try {
      const ok = await save({ low_threshold_default: defaultThreshold })
      if (ok) showToast('阈值已保存', 'success')
      else showToast('保存失败，请重试', 'error')
    } finally {
      setSavingThreshold(false)
    }
  }

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) { showToast('密码至少需要6位', 'error'); return }
    if (newPassword !== confirmPassword) { showToast('两次密码不一致', 'error'); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) showToast(error.message, 'error')
      else { showToast('密码已更新', 'success'); setNewPassword(''); setConfirmPassword('') }
    } finally {
      setChangingPassword(false)
    }
  }

  const maskedKey = apiKey
    ? apiKey.slice(0, 8) + '•'.repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4)
    : ''

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-500 text-sm mt-1">管理账号与偏好设置</p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">账号信息</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-2xl font-black">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.email}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              账号创建于 {user?.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}
            </p>
          </div>
        </div>
      </div>

      {/* OpenRouter API Key */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-gray-900">AI 图纸分析 · OpenRouter API Key</h2>
          <span className="text-xs bg-green-50 text-green-600 font-medium px-2 py-0.5 rounded-full">Gemini 2.5 Flash</span>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          用于「分析图纸」功能的 AI 调用。Key 加密存储在你的账号下，仅你可见。
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline ml-1"
          >
            前往 OpenRouter 获取 Key →
          </a>
        </p>

        {settingsLoading ? (
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyDirty(true) }}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full pl-4 pr-24 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>

            {/* Current key status */}
            {!keyDirty && settings?.openrouter_api_key && (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                已保存 Key：{maskedKey}
              </p>
            )}
            {!keyDirty && !settings?.openrouter_api_key && (
              <p className="text-xs text-orange-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                未设置 API Key，图纸分析功能不可用
              </p>
            )}

            <button
              onClick={handleSaveApiKey}
              disabled={savingKey || (!keyDirty && !!settings?.openrouter_api_key)}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {savingKey && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              保存 API Key
            </button>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-xs text-gray-500">
              <p className="font-medium text-gray-600">使用说明</p>
              <p>1. 访问 openrouter.ai 注册账号（支持免费额度）</p>
              <p>2. 进入 Keys 页面创建一个新 Key</p>
              <p>3. 粘贴到上方输入框并保存</p>
              <p>4. 前往「分析图纸」页面上传图纸即可</p>
            </div>
          </div>
        )}
      </div>

      {/* Threshold */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1">默认低库存阈值</h2>
        <p className="text-sm text-gray-400 mb-4">库存低于此数值时显示橙色预警</p>
        <div className="flex items-center gap-3">
          <input
            type="number" min="0" max="9999"
            value={defaultThreshold}
            onChange={(e) => setDefaultThreshold(parseInt(e.target.value) || 0)}
            className="w-28 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-semibold text-center"
          />
          <span className="text-sm text-gray-500">颗</span>
          <button
            onClick={handleSaveThreshold}
            disabled={savingThreshold}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 text-sm"
          >
            保存
          </button>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {[20, 50, 100, 200].map(val => (
            <button key={val} onClick={() => setDefaultThreshold(val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                defaultThreshold === val ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{val}</button>
          ))}
        </div>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1">修改密码</h2>
        <p className="text-sm text-gray-400 mb-4">更新你的登录密码</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="至少6位字符"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <button type="submit" disabled={changingPassword || !newPassword}
            className="px-6 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-60 text-sm flex items-center gap-2"
          >
            {changingPassword && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            更新密码
          </button>
        </form>
      </div>

      {/* About */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">关于应用</h2>
        <div className="space-y-2 text-sm">
          {[
            ['应用名称', '我勒个豆 · PINDOU'],
            ['版本', 'v0.2.0'],
            ['支持颜色数', '221 种（A-H + M 系列）'],
            ['AI 模型', 'Google Gemini 2.5 Flash（via OpenRouter）'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-gray-500">{k}</span>
              <span className="font-medium text-gray-700">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

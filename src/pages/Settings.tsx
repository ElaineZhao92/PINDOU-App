import { useState, FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { Toast } from '../lib/types'

function getInitialThreshold(): number {
  const saved = localStorage.getItem('pindou_default_threshold')
  return saved ? parseInt(saved) : 50
}

interface SettingsProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Settings({ showToast }: SettingsProps) {
  const { user } = useAuthStore()
  const [defaultThreshold, setDefaultThreshold] = useState<number>(getInitialThreshold)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleThresholdSave = () => {
    if (defaultThreshold < 0) {
      showToast('阈值不能为负数', 'error')
      return
    }
    localStorage.setItem('pindou_default_threshold', String(defaultThreshold))
    showToast('预警阈值已保存', 'success')
  }

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      showToast('密码至少需要6位字符', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('两次密码不一致', 'error')
      return
    }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('密码已更新成功', 'success')
        setNewPassword('')
        setConfirmPassword('')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-500 text-sm mt-1">管理你的账号和偏好设置</p>
      </div>

      {/* Account info */}
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

      {/* Default threshold */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1">默认低库存阈值</h2>
        <p className="text-sm text-gray-400 mb-4">当某颜色库存低于此数值时，显示预警提示</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="9999"
            value={defaultThreshold}
            onChange={(e) => setDefaultThreshold(parseInt(e.target.value) || 0)}
            className="w-28 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm font-semibold text-center"
          />
          <span className="text-sm text-gray-500">颗</span>
          <button
            onClick={handleThresholdSave}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors text-sm"
          >
            保存
          </button>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {[20, 50, 100, 200].map((val) => (
            <button
              key={val}
              onClick={() => setDefaultThreshold(val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                defaultThreshold === val
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1">修改密码</h2>
        <p className="text-sm text-gray-400 mb-4">更新你的登录密码</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少6位字符"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword || !newPassword}
            className="px-6 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm flex items-center gap-2"
          >
            {changingPassword && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            更新密码
          </button>
        </form>
      </div>

      {/* App info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">关于应用</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">应用名称</span>
            <span className="font-medium text-gray-700">我勒个豆 · PINDOU</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">版本</span>
            <span className="font-medium text-gray-700">v0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">支持颜色数</span>
            <span className="font-medium text-gray-700">221 种（A-H 系列）</span>
          </div>
        </div>
      </div>
    </div>
  )
}

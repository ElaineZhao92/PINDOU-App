import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useInventory } from '../hooks/useInventory'
import { usePatterns } from '../hooks/usePatterns'
import { Toast } from '../lib/types'

interface DashboardProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Dashboard({ showToast: _showToast }: DashboardProps) {
  const { user } = useAuthStore()
  const { inventory, loading: invLoading, getLowStockItems } = useInventory()
  const { patterns, loading: patLoading } = usePatterns()

  const username = user?.email?.split('@')[0] ?? '朋友'

  const lowStockItems = getLowStockItems()
  const totalColors = Object.values(inventory).filter((i) => i.quantity > 0).length
  const totalBeads = Object.values(inventory).reduce((sum, i) => sum + i.quantity, 0)

  const recentPatterns = patterns.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          你好，{username} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">这里是你的拼豆库存概览</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label="已追踪颜色"
          value={invLoading ? '...' : String(totalColors)}
          unit="种"
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        />
        <StatCard
          label="库存不足"
          value={invLoading ? '...' : String(lowStockItems.length)}
          unit="种"
          color="bg-orange-50 text-orange-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="总珠珠数"
          value={invLoading ? '...' : totalBeads >= 10000 ? `${(totalBeads / 10000).toFixed(1)}w` : String(totalBeads)}
          unit="颗"
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Low stock alert */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              库存不足预警
            </h2>
            <Link to="/inventory" className="text-xs text-primary font-medium hover:underline">
              查看全部
            </Link>
          </div>

          {invLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-gray-400 text-sm">库存充足，状态良好！</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lowStockItems.slice(0, 10).map((item) => (
                <div
                  key={item.color_code}
                  className="flex items-center justify-between py-1.5 px-3 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                      style={{
                        backgroundColor:
                          BEAD_COLOR_HEX[item.color_code] ?? '#ccc',
                      }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.color_code}</span>
                  </div>
                  <span className="text-xs text-orange-600 font-semibold">{item.quantity} 颗</span>
                </div>
              ))}
              {lowStockItems.length > 10 && (
                <p className="text-xs text-center text-gray-400 py-1">
                  还有 {lowStockItems.length - 10} 种颜色库存不足...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent patterns */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">最近图纸</h2>
            <Link to="/archive" className="text-xs text-primary font-medium hover:underline">
              查看全部
            </Link>
          </div>

          {patLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentPatterns.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-gray-400 text-sm mb-3">还没有图纸记录</p>
              <Link
                to="/analyze"
                className="inline-block px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-600 transition-colors"
              >
                分析第一张图纸
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPatterns.map((p) => (
                <Link
                  key={p.id}
                  to={`/archive/${p.id}`}
                  className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-lg">🧩</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {p.status === 'completed' ? '已完成' : '制作中'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          to="/inventory"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col items-center gap-2 text-center"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">更新库存</span>
        </Link>
        <Link
          to="/analyze"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col items-center gap-2 text-center"
        >
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">分析图纸</span>
        </Link>
        <Link
          to="/archive"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col items-center gap-2 text-center"
        >
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">图纸档案</span>
        </Link>
        <Link
          to="/settings"
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col items-center gap-2 text-center"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">设置</span>
        </Link>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  unit: string
  color: string
  icon: React.ReactNode
}

function StatCard({ label, value, unit, color, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-gray-900">{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// Inline color hex map for display (subset used on dashboard)
const BEAD_COLOR_HEX: Record<string, string> = {
  A1:'#FFF8E7',A2:'#FFFD5A',A3:'#FFE600',A4:'#FFD800',A5:'#FFC400',A6:'#FFAA00',A7:'#FF8C00',A8:'#FF6600',
  A9:'#FF4500',A10:'#FF2200',A11:'#EE0011',A12:'#CC0011',A13:'#FF0066',A14:'#FF1199',A15:'#FF00CC',
  A16:'#FF44DD',A17:'#EE44EE',A18:'#FF88BB',A19:'#FFAACC',A20:'#FFBBCC',A21:'#FFC8A8',A22:'#FFB090',
  A23:'#FF8870',A24:'#FF6050',A25:'#E04040',A26:'#C02030',
  B1:'#CCFF00',B2:'#AAFF00',B3:'#88EE00',B4:'#66DD00',B5:'#44CC00',B6:'#22BB00',B7:'#00AA00',
  B8:'#009900',B9:'#007700',B10:'#005500',B11:'#00AA44',B12:'#00BB66',B13:'#00CC88',B14:'#00DDAA',
  B15:'#00EEBB',B16:'#00FFCC',B17:'#99FF88',B18:'#BBFF99',B19:'#DDFFAA',B20:'#CCEE88',B21:'#AACC66',
  B22:'#88AA44',B23:'#008833',B24:'#006622',B25:'#004411',B26:'#003300',
  C1:'#00FFFF',C2:'#00EEFF',C3:'#00DDEE',C4:'#00BBDD',C5:'#0099CC',C6:'#0077BB',C7:'#0055AA',
  C8:'#003399',C9:'#001188',C10:'#000077',C11:'#0033CC',C12:'#0055EE',C13:'#0077FF',C14:'#2299FF',
  C15:'#44AAFF',C16:'#66BBFF',C17:'#88CCFF',C18:'#AADDFF',C19:'#5588BB',C20:'#3366AA',C21:'#224488',
  C22:'#112266',C23:'#002244',C24:'#003355',C25:'#004466',C26:'#005577',C27:'#006688',C28:'#4DA6FF',
  D1:'#EE00FF',D2:'#CC00EE',D3:'#AA00DD',D4:'#8800CC',D5:'#6600BB',D6:'#4400AA',D7:'#9900CC',
  D8:'#BB00EE',D9:'#DD22FF',D10:'#EE55FF',D11:'#FF88FF',D12:'#7755BB',D13:'#5533AA',D14:'#3311AA',
  D15:'#5500CC',D16:'#7722DD',D17:'#9944EE',D18:'#BB66FF',D19:'#CCAAFF',D20:'#CCBBEE',D21:'#AA88DD',
  D22:'#8866CC',D23:'#6644BB',D24:'#4422AA',D25:'#AA44BB',D26:'#993399',
  E1:'#FFF0CC',E2:'#FFDD99',E3:'#FFCC77',E4:'#FFB855',E5:'#FFA033',E6:'#EE8811',E7:'#DD7700',
  E8:'#CC6600',E9:'#BB5500',E10:'#AA4400',E11:'#993300',E12:'#882200',E13:'#771100',E14:'#DDBB88',
  E15:'#CCAA77',E16:'#BB9966',E17:'#AA8855',E18:'#997744',E19:'#886633',E20:'#775522',E21:'#664411',
  E22:'#553300',E23:'#FFDDCC',E24:'#EECCAA',E25:'#DDBBA0',E26:'#CCB080',
  F1:'#FFFFFF',F2:'#FFEEEE',F3:'#FFF0E0',F4:'#FFFFD0',F5:'#F0FFF0',F6:'#E0F8FF',F7:'#EEE0FF',
  F8:'#FFD0FF',F9:'#FFD0E0',F10:'#FFECB0',F11:'#D0FFD0',F12:'#D0EEFF',F13:'#EED0FF',F14:'#FFB0B0',
  F15:'#FFD0B0',F16:'#FFFFA0',F17:'#B0FFB0',F18:'#B0DDFF',F19:'#DDB0FF',F20:'#FFB0CC',F21:'#FFCC80',
  F22:'#C0FFC0',F23:'#C0DDFF',F24:'#DDB0EE',F25:'#FFB8C8',F26:'#FFFFC0',F27:'#C8FFC8',F28:'#FFE4E1',
  G1:'#EEEEEE',G2:'#DDDDDD',G3:'#CCCCCC',G4:'#BBBBBB',G5:'#AAAAAA',G6:'#999999',G7:'#888888',
  G8:'#777777',G9:'#666666',G10:'#555555',G11:'#444444',G12:'#333333',G13:'#222222',G14:'#111111',
  G15:'#000000',G16:'#1A1A2E',G17:'#16213E',G18:'#2B1B00',G19:'#4D3B30',G20:'#3D2D20',G21:'#2D1D10',
  G22:'#004030',G23:'#003020',G24:'#002020',G25:'#001010',G26:'#200010',G27:'#300020',G28:'#400020',
  G29:'#1A0A00',G30:'#0A000A',
  H1:'#FFD700',H2:'#FFC0CB',H3:'#C0C0C0',H4:'#A8A9AD',H5:'#B8860B',H6:'#DAA520',H7:'#CD853F',
  H8:'#D2691E',H9:'#F5DEB3',H10:'#DEB887',H11:'#FF69B4',H12:'#FF1493',H13:'#FF00FF',H14:'#BA55D3',
  H15:'#9400D3',H16:'#8B008B',H17:'#7B68EE',H18:'#6A5ACD',H19:'#483D8B',H20:'#2E8B57',H21:'#3CB371',
  H22:'#20B2AA',H23:'#48D1CC',H24:'#00CED1',H25:'#40E0D0',H26:'#00FA9A',H27:'#7FFF00',H28:'#ADFF2F',
  H29:'#F0E68C',H30:'#EEE8AA',H31:'#FAFAD2',
}

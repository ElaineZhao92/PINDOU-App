import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInventory } from '../hooks/useInventory'
import { useSettings } from '../hooks/useSettings'
import BeadColorCell from '../components/BeadColorCell'
import { BeadColor, Toast } from '../lib/types'

interface InventoryProps {
  showToast: (msg: string, type: Toast['type']) => void
}

const ALL_SERIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M']
const QUICK_DELTAS = [100, 500, 1000, 2000]

export default function Inventory({ showToast }: InventoryProps) {
  const { inventory, loading, updateQuantity, setQuantity, bulkUpdateQuantity, bulkSetQuantity,
          undo, clearHistory, getLowStockItems, undoStack, history } = useInventory()
  const { settings } = useSettings()
  const globalThreshold = settings?.low_threshold_default ?? 50
  const [beadColors, setBeadColors] = useState<BeadColor[]>([])
  const [activeSeries, setActiveSeries] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()

  // Bulk panel state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState<'add' | 'set'>('add')
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkSeries, setBulkSeries] = useState<string[]>([])  // empty = all
  const [bulkLoading, setBulkLoading] = useState(false)

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    fetch('./bead-colors.json').then(r => r.json()).then(setBeadColors).catch(console.error)
  }, [])

  // Activate low-stock filter when navigated here with ?filter=low
  useEffect(() => {
    if (searchParams.get('filter') === 'low') {
      setShowLowStockOnly(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const lowStockItems = getLowStockItems(globalThreshold)
  const lowStockSet = useMemo(() => new Set(lowStockItems.map(i => i.color_code)), [lowStockItems])

  const totalColors = Object.values(inventory).filter(i => i.quantity > 0).length
  const totalBeads = Object.values(inventory).reduce((s, i) => s + i.quantity, 0)

  const filtered = beadColors.filter(c => {
    const matchesSeries = activeSeries === 'ALL' || c.series === activeSeries
    const matchesSearch = search === '' || c.code.toLowerCase().includes(search.toLowerCase())
    const matchesLowStock = !showLowStockOnly || lowStockSet.has(c.code)
    return matchesSeries && matchesSearch && matchesLowStock
  })

  const effectiveSeries = bulkSeries.length > 0 ? bulkSeries : null

  const handleBulkQuick = async (delta: number) => {
    setBulkLoading(true)
    try {
      await bulkUpdateQuantity(delta, effectiveSeries)
      showToast(`已为${effectiveSeries ? effectiveSeries.join('/') + '系列' : '全部颜色'}添加 ${delta} 粒`, 'success')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkCustom = async () => {
    const amount = parseInt(bulkAmount)
    if (isNaN(amount) || amount < 0) { showToast('请输入有效数量', 'error'); return }
    setBulkLoading(true)
    try {
      if (bulkMode === 'add') {
        await bulkUpdateQuantity(amount, effectiveSeries)
        showToast(`已添加 ${amount} 粒`, 'success')
      } else {
        await bulkSetQuantity(amount, effectiveSeries)
        showToast(`已设置为 ${amount} 粒`, 'success')
      }
      setBulkAmount('')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleUndo = async () => {
    const ok = await undo()
    if (ok) showToast('已撤销上一步操作', 'success')
    else showToast('没有可撤销的操作', 'error')
  }

  const toggleBulkSeries = (s: string) => {
    setBulkSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">库存管理</h1>
          <p className="text-gray-500 text-sm mt-1">点击色格可直接编辑数量</p>
        </div>
        <div className="flex gap-2">
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              title={`撤销：${undoStack[0]?.description}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              撤销
            </button>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            历史
          </button>
          <button
            onClick={() => setBulkOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${
              bulkOpen ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            批量操作
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">已追踪颜色</p>
          <p className="text-xl font-black text-gray-900">{loading ? '…' : totalColors}<span className="text-xs font-normal text-gray-400 ml-1">种</span></p>
        </div>
        <button
          onClick={() => setShowLowStockOnly(v => !v)}
          className={`rounded-xl shadow-sm border px-4 py-3 text-left transition-colors w-full ${
            showLowStockOnly
              ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-300'
              : 'bg-white border-gray-100 hover:border-orange-200'
          }`}
        >
          <p className="text-xs text-gray-400">库存不足 {showLowStockOnly ? '· 已筛选' : ''}</p>
          <p className="text-xl font-black text-orange-500">{loading ? '…' : lowStockItems.length}<span className="text-xs font-normal text-gray-400 ml-1">种</span></p>
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">总豆子数</p>
          <p className="text-xl font-black text-gray-900">
            {loading ? '…' : totalBeads >= 10000 ? `${(totalBeads/10000).toFixed(1)}w` : totalBeads}
            <span className="text-xs font-normal text-gray-400 ml-1">颗</span>
          </p>
        </div>
      </div>

      {/* Bulk panel */}
      {bulkOpen && (
        <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">批量操作</h3>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
              <button
                onClick={() => setBulkMode('add')}
                className={`px-4 py-1.5 font-medium transition-colors ${bulkMode === 'add' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >增减数量</button>
              <button
                onClick={() => setBulkMode('set')}
                className={`px-4 py-1.5 font-medium transition-colors ${bulkMode === 'set' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >统一设置</button>
            </div>
          </div>

          {/* Series selector */}
          <div>
            <p className="text-xs text-gray-500 mb-2">应用范围（不选则全部 221 色）</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SERIES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleBulkSeries(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    bulkSeries.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >{s} 系列</button>
              ))}
              {bulkSeries.length > 0 && (
                <button onClick={() => setBulkSeries([])} className="px-3 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600">
                  清除选择
                </button>
              )}
            </div>
          </div>

          {/* Quick buttons (add mode only) */}
          {bulkMode === 'add' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">快捷添加</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_DELTAS.map(d => (
                  <button
                    key={d}
                    onClick={() => handleBulkQuick(d)}
                    disabled={bulkLoading}
                    className="px-4 py-2 bg-green-50 text-green-700 font-semibold text-sm rounded-xl hover:bg-green-100 transition-colors disabled:opacity-50"
                  >+{d}</button>
                ))}
                {QUICK_DELTAS.map(d => (
                  <button
                    key={-d}
                    onClick={() => handleBulkQuick(-d)}
                    disabled={bulkLoading}
                    className="px-4 py-2 bg-red-50 text-red-600 font-semibold text-sm rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                  >−{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Custom input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              {bulkMode === 'add' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">±</span>
              )}
              <input
                type="number"
                min="0"
                value={bulkAmount}
                onChange={e => setBulkAmount(e.target.value)}
                placeholder={bulkMode === 'add' ? '自定义数量（正数增加，负数减少）' : '统一设置为…颗'}
                className={`w-full py-2.5 pr-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm ${bulkMode === 'add' ? 'pl-8' : 'pl-4'}`}
              />
            </div>
            <button
              onClick={handleBulkCustom}
              disabled={bulkLoading || bulkAmount === ''}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center gap-2"
            >
              {bulkLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {bulkMode === 'add' ? '批量增减' : '批量设置'}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            当前范围：{bulkSeries.length > 0 ? `${bulkSeries.join('、')} 系列` : '全部 221 色'} ·
            操作完成后可点右上角「撤销」恢复（最多保留 {5} 步）
          </p>
        </div>
      )}

      {/* Search + series filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索色号…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['ALL', ...ALL_SERIES].map(s => (
          <button
            key={s}
            onClick={() => setActiveSeries(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeSeries === s ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >{s === 'ALL' ? '全部' : `${s} 系列`}</button>
        ))}
      </div>

      {/* Color grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">加载库存中…</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2">
          {filtered.map(color => (
            <BeadColorCell
              key={color.code}
              color={color}
              item={inventory[color.code] ?? null}
              threshold={globalThreshold}
              onSetQuantity={setQuantity}
              onUpdateQuantity={updateQuantity}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">没有匹配的颜色</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-orange-400" />
          <span>库存不足（低于预警阈值）</span>
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setHistoryOpen(false)}>
          <div
            className="w-full max-w-sm h-full bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">操作历史</h3>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button
                    onClick={() => { clearHistory(); }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >清空</button>
                )}
                <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {history.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-12">暂无操作记录</p>
              ) : (
                history.map(record => (
                  <div key={record.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      record.description.startsWith('↩') ? 'bg-blue-400' :
                      record.delta === null ? 'bg-purple-400' :
                      (record.delta ?? 0) > 0 ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{record.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(record.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

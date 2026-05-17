import { useState, useEffect } from 'react'
import { useInventory } from '../hooks/useInventory'
import BeadColorCell from '../components/BeadColorCell'
import { BeadColor, Toast } from '../lib/types'

interface InventoryProps {
  showToast: (msg: string, type: Toast['type']) => void
}

const SERIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M']

export default function Inventory({ showToast: _showToast }: InventoryProps) {
  const { inventory, loading, updateQuantity, setQuantity, getLowStockItems } = useInventory()
  const [beadColors, setBeadColors] = useState<BeadColor[]>([])
  const [activeSeries, setActiveSeries] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('./bead-colors.json')
      .then((r) => r.json())
      .then(setBeadColors)
      .catch(console.error)
  }, [])

  const lowStockItems = getLowStockItems()
  const totalColors = Object.values(inventory).filter((i) => i.quantity > 0).length
  const totalBeads = Object.values(inventory).reduce((sum, i) => sum + i.quantity, 0)

  const filtered = beadColors.filter((c) => {
    const matchesSeries = activeSeries === 'ALL' || c.series === activeSeries
    const matchesSearch = search === '' || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.includes(search)
    return matchesSeries && matchesSearch
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">库存管理</h1>
        <p className="text-gray-500 text-sm mt-1">点击色格可直接编辑数量</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">已追踪颜色</p>
          <p className="text-xl font-black text-gray-900">{loading ? '...' : totalColors}<span className="text-xs font-normal text-gray-400 ml-1">种</span></p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">库存不足</p>
          <p className="text-xl font-black text-orange-500">{loading ? '...' : lowStockItems.length}<span className="text-xs font-normal text-gray-400 ml-1">种</span></p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">总珠珠数</p>
          <p className="text-xl font-black text-gray-900">
            {loading ? '...' : totalBeads >= 10000 ? `${(totalBeads / 10000).toFixed(1)}w` : totalBeads}
            <span className="text-xs font-normal text-gray-400 ml-1">颗</span>
          </p>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索色号或颜色名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
          />
        </div>
      </div>

      {/* Series filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveSeries('ALL')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeSeries === 'ALL'
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          }`}
        >
          全部
        </button>
        {SERIES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSeries(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeSeries === s
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {s} 系列
          </button>
        ))}
      </div>

      {/* Color grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">加载库存数据中...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">没有找到匹配的颜色</p>
        </div>
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2">
          {filtered.map((color) => (
            <BeadColorCell
              key={color.code}
              color={color}
              item={inventory[color.code] ?? null}
              onSetQuantity={setQuantity}
              onUpdateQuantity={updateQuantity}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-orange-400" />
          <span>库存不足（低于预警阈值）</span>
        </div>
        <span className="text-gray-300">|</span>
        <span>点击色格可编辑数量</span>
      </div>
    </div>
  )
}

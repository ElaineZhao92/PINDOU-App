import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatterns } from '../hooks/usePatterns'
import { Toast } from '../lib/types'

interface ArchiveProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Archive({ showToast: _showToast }: ArchiveProps) {
  const { patterns, loading } = usePatterns()
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [search, setSearch] = useState('')

  const filtered = patterns.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const inProgressCount = patterns.filter((p) => p.status === 'in_progress').length
  const completedCount = patterns.filter((p) => p.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">图纸档案</h1>
        <p className="text-gray-500 text-sm mt-1">
          共 {patterns.length} 张图纸 · {inProgressCount} 个制作中 · {completedCount} 个已完成
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索图纸名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'in_progress', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? '全部' : s === 'in_progress' ? '制作中' : '已完成'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">加载图纸中...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {patterns.length === 0 ? '还没有图纸记录' : '没有找到匹配的图纸'}
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            {patterns.length === 0 ? '去分析一张图纸，开始你的拼豆旅程吧！' : '尝试调整搜索条件'}
          </p>
          {patterns.length === 0 && (
            <Link
              to="/analyze"
              className="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
            >
              分析第一张图纸
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pattern) => (
            <Link
              key={pattern.id}
              to={`/archive/${pattern.id}`}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {pattern.image_url ? (
                  <img
                    src={pattern.image_url}
                    alt={pattern.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-4xl opacity-30">🧩</div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {pattern.name}
                  </h3>
                  <span
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      pattern.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {pattern.status === 'completed' ? '已完成' : '制作中'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    {pattern.status === 'completed' && pattern.completed_at
                      ? `完成于 ${new Date(pattern.completed_at).toLocaleDateString('zh-CN')}`
                      : `创建于 ${new Date(pattern.created_at).toLocaleDateString('zh-CN')}`}
                  </span>
                </div>

                {pattern.tags && pattern.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pattern.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

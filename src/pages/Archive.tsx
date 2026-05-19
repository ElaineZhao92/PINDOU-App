import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePatterns } from '../hooks/usePatterns'
import { Toast } from '../lib/types'

interface ArchiveProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Archive({ showToast }: ArchiveProps) {
  const navigate = useNavigate()
  const { patterns, loading, batchUpdateStatus, batchDelete, batchAddTag, batchRemoveTag } = usePatterns()

  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState<string | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const folderPickerRef = useRef<HTMLDivElement>(null)

  // Close folder picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allFolders = useMemo(() => {
    const s = new Set<string>()
    patterns.forEach((p) => p.tags?.forEach((t) => s.add(t)))
    return Array.from(s).sort()
  }, [patterns])

  const filtered = patterns.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase())
    const matchesFolder = folderFilter === null || p.tags?.includes(folderFilter)
    return matchesStatus && matchesSearch && matchesFolder
  })

  const inProgressCount = patterns.filter((p) => p.status === 'in_progress').length
  const completedCount = patterns.filter((p) => p.status === 'completed').length

  const toggleSelectMode = () => {
    setSelectMode((v) => !v)
    setSelectedIds(new Set())
    setShowFolderPicker(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBatchStatus = async (status: 'in_progress' | 'completed') => {
    if (selectedIds.size === 0) return
    setBatchLoading(true)
    const ok = await batchUpdateStatus([...selectedIds], status)
    setBatchLoading(false)
    if (ok) {
      showToast(
        `已将 ${selectedIds.size} 张图纸标记为${status === 'completed' ? '已完成' : '制作中'}`,
        'success'
      )
      setSelectedIds(new Set())
    } else {
      showToast('操作失败，请重试', 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确认删除选中的 ${selectedIds.size} 张图纸？此操作不可撤销。`)) return
    setBatchLoading(true)
    const ok = await batchDelete([...selectedIds])
    setBatchLoading(false)
    if (ok) {
      showToast(`已删除 ${selectedIds.size} 张图纸`, 'success')
      setSelectedIds(new Set())
      if (selectedIds.size === filtered.length) setSelectMode(false)
    } else {
      showToast('删除失败，请重试', 'error')
    }
  }

  const handleAddToFolder = async (folder: string) => {
    if (!folder.trim() || selectedIds.size === 0) return
    setBatchLoading(true)
    await batchAddTag([...selectedIds], folder.trim())
    setBatchLoading(false)
    showToast(`已加入文件夹「${folder.trim()}」`, 'success')
    setShowFolderPicker(false)
    setNewFolderName('')
  }

  const handleRemoveFromFolder = async () => {
    if (!folderFilter || selectedIds.size === 0) return
    setBatchLoading(true)
    await batchRemoveTag([...selectedIds], folderFilter)
    setBatchLoading(false)
    showToast(`已从文件夹「${folderFilter}」移出`, 'success')
    setSelectedIds(new Set())
  }

  const handleCardClick = (id: string) => {
    if (selectMode) {
      toggleSelect(id)
    } else {
      navigate(`/archive/${id}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">图纸档案</h1>
          <p className="text-gray-500 text-sm mt-1">
            共 {patterns.length} 张 · {inProgressCount} 个制作中 · {completedCount} 个已完成
          </p>
        </div>
        <button
          onClick={toggleSelectMode}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            selectMode
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {selectMode ? '退出选择' : '批量选择'}
        </button>
      </div>

      {/* Folder bar */}
      {allFolders.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFolderFilter(null)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              folderFilter === null
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部图纸
          </button>
          {allFolders.map((folder) => (
            <button
              key={folder}
              onClick={() => setFolderFilter((f) => (f === folder ? null : folder))}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                folderFilter === folder
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              {folder}
              <span className="opacity-60">
                {patterns.filter((p) => p.tags?.includes(folder)).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Batch action bar */}
      {selectMode && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              已选 {selectedIds.size} 张
            </span>
            <button
              onClick={() => setSelectedIds(new Set(filtered.map((p) => p.id)))}
              className="text-xs text-primary hover:underline font-medium"
            >
              全选 ({filtered.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                清空
              </button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button
                onClick={() => handleBatchStatus('completed')}
                disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                标记已完成
              </button>
              <button
                onClick={() => handleBatchStatus('in_progress')}
                disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                标记制作中
              </button>

              {/* Folder picker */}
              <div className="relative" ref={folderPickerRef}>
                <button
                  onClick={() => setShowFolderPicker((v) => !v)}
                  disabled={batchLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  加入文件夹
                </button>

                {showFolderPicker && (
                  <div className="absolute top-full mt-1.5 right-0 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2">
                    {allFolders.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-gray-400 px-2 pb-1 uppercase tracking-wide">现有文件夹</p>
                        {allFolders.map((folder) => (
                          <button
                            key={folder}
                            onClick={() => handleAddToFolder(folder)}
                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                            {folder}
                          </button>
                        ))}
                        <div className="my-1 border-t border-gray-100" />
                      </>
                    )}
                    <p className="text-[10px] font-semibold text-gray-400 px-2 pb-1 uppercase tracking-wide">新建文件夹</p>
                    <div className="px-1">
                      <input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="输入文件夹名称..."
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newFolderName.trim()) {
                            handleAddToFolder(newFolderName)
                          }
                        }}
                      />
                      {newFolderName.trim() && (
                        <button
                          onClick={() => handleAddToFolder(newFolderName)}
                          className="mt-1.5 w-full py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                          创建并加入
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Remove from current folder (only when viewing a specific folder) */}
              {folderFilter && (
                <button
                  onClick={handleRemoveFromFolder}
                  disabled={batchLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  移出「{folderFilter}」
                </button>
              )}

              <button
                onClick={handleBatchDelete}
                disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                删除
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search + status filter */}
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
              className="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              分析第一张图纸
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pattern) => {
            const isSelected = selectedIds.has(pattern.id)
            return (
              <div key={pattern.id} className="relative">
                {/* Checkbox */}
                {selectMode && (
                  <div
                    className={`absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center shadow-sm transition-colors ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}

                <div
                  onClick={() => handleCardClick(pattern.id)}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all group ${
                    selectMode ? 'cursor-pointer' : 'cursor-pointer hover:-translate-y-0.5'
                  } ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-gray-100 hover:shadow-md'
                  }`}
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
                          <span
                            key={tag}
                            className="text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

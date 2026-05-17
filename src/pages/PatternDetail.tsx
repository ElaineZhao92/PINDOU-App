import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePatterns } from '../hooks/usePatterns'
import { BeadColor, Pattern, PatternBead, Toast } from '../lib/types'

interface PatternDetailProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function PatternDetail({ showToast }: PatternDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { patterns, updatePatternStatus, deletePattern, getPatternBeads } = usePatterns()
  const [pattern, setPattern] = useState<Pattern | null>(null)
  const [beads, setBeads] = useState<PatternBead[]>([])
  const [beadColors, setBeadColors] = useState<BeadColor[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch('./bead-colors.json')
      .then((r) => r.json())
      .then(setBeadColors)
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!id) return
    const found = patterns.find((p) => p.id === id)
    if (found) {
      setPattern(found)
    }
  }, [id, patterns])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPatternBeads(id)
      .then((data) => {
        setBeads(data)
      })
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const getColorHex = (code: string) => {
    return beadColors.find((c) => c.code === code)?.hex ?? '#ccc'
  }

  const getColorName = (code: string) => {
    return beadColors.find((c) => c.code === code)?.name ?? ''
  }

  const handleDownloadImage = async () => {
    if (!pattern?.image_url) return
    setDownloading(true)
    try {
      const res = await fetch(pattern.image_url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pattern.name}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.open(pattern.image_url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!pattern) return
    const newStatus = pattern.status === 'in_progress' ? 'completed' : 'in_progress'
    await updatePatternStatus(pattern.id, newStatus)
    setPattern((prev) =>
      prev
        ? {
            ...prev,
            status: newStatus,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          }
        : null
    )
    showToast(newStatus === 'completed' ? '恭喜完成！' : '已标记为制作中', 'success')
  }

  const handleDelete = async () => {
    if (!pattern) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    const ok = await deletePattern(pattern.id)
    if (ok) {
      showToast('图纸已删除', 'success')
      navigate('/archive')
    } else {
      showToast('删除失败，请重试', 'error')
      setDeleting(false)
    }
  }

  const totalBeads = beads.reduce((sum, b) => sum + b.quantity, 0)

  if (!pattern && !loading) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">图纸不存在或已被删除</p>
        <Link to="/archive" className="text-primary font-medium hover:underline">
          ← 返回档案
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/archive"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回档案
      </Link>

      {pattern && (
        <>
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {pattern.image_url && (
              <div className="max-h-80 overflow-hidden">
                <img
                  src={pattern.image_url}
                  alt={pattern.name}
                  className="w-full object-contain max-h-80 bg-gray-50"
                />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{pattern.name}</h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className={`text-sm px-3 py-1 rounded-full font-medium ${
                        pattern.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {pattern.status === 'completed' ? '已完成' : '制作中'}
                    </span>
                    <span className="text-sm text-gray-400">
                      创建于 {new Date(pattern.created_at).toLocaleDateString('zh-CN')}
                    </span>
                    {pattern.completed_at && (
                      <span className="text-sm text-gray-400">
                        完成于 {new Date(pattern.completed_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  {pattern.notes && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                      {pattern.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {pattern.image_url && (
                    <button
                      onClick={handleDownloadImage}
                      disabled={downloading}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1.5"
                    >
                      {downloading ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                      下载图纸
                    </button>
                  )}
                  <button
                    onClick={handleToggleStatus}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      pattern.status === 'in_progress'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {pattern.status === 'in_progress' ? '标记为已完成' : '重置为制作中'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      confirmDelete
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {deleting ? '删除中...' : confirmDelete ? '确认删除' : '删除图纸'}
                  </button>
                  {confirmDelete && !deleting && (
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bead usage table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">用珠明细</h2>
              <span className="text-sm text-gray-400">
                共 {beads.length} 种颜色 · {totalBeads.toLocaleString()} 颗
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : beads.length === 0 ? (
              <div className="text-center py-12 text-gray-400">暂无用珠记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">色号</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">颜色</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">颜色名</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beads.map((bead) => {
                      const hex = getColorHex(bead.color_code)
                      return (
                        <tr key={bead.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{bead.color_code}</td>
                          <td className="px-4 py-3">
                            <div
                              className="w-7 h-7 rounded-lg border border-gray-200 shadow-sm"
                              style={{ backgroundColor: hex }}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-500">{getColorName(bead.color_code)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            {bead.quantity.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={3} className="px-4 py-3 font-bold text-gray-700">合计</td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">
                        {totalBeads.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

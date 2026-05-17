import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useInventory } from '../hooks/useInventory'
import { usePatterns } from '../hooks/usePatterns'
import { useSettings } from '../hooks/useSettings'
import { AnalysisResult, BeadColor, Toast } from '../lib/types'

interface AnalyzeProps {
  showToast: (msg: string, type: Toast['type']) => void
}

interface UploadedImage {
  file: File
  previewUrl: string
  storageUrl: string | null
  uploading: boolean
  error: string | null
}

export default function Analyze({ showToast }: AnalyzeProps) {
  const { user } = useAuthStore()
  const { inventory, setQuantity } = useInventory()
  const { createPattern } = usePatterns()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [beadColors, setBeadColors] = useState<BeadColor[]>([])
  const [images, setImages] = useState<UploadedImage[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [editedResults, setEditedResults] = useState<AnalysisResult[]>([])
  const [patternName, setPatternName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deducting, setDeducting] = useState(false)

  useEffect(() => {
    fetch('./bead-colors.json').then(r => r.json()).then(setBeadColors).catch(console.error)
  }, [])

  const getHex = (code: string) => beadColors.find(c => c.code === code)?.hex ?? '#ddd'
  const getName = (code: string) => beadColors.find(c => c.code === code)?.name ?? ''

  const uploadToStorage = async (img: UploadedImage, idx: number): Promise<string | null> => {
    if (!user) return null
    const ext = img.file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}_${idx}.${ext}`
    const { data, error } = await supabase.storage
      .from('pattern-images')
      .upload(path, img.file, { upsert: true })
    if (error) return null
    return supabase.storage.from('pattern-images').getPublicUrl(data.path).data.publicUrl
  }

  const onDrop = useCallback((accepted: File[]) => {
    const newImgs: UploadedImage[] = accepted.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      storageUrl: null,
      uploading: false,
      error: null,
    }))
    setImages(prev => [...prev, ...newImgs])
    setEditedResults([])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxSize: 20 * 1024 * 1024,
  })

  const removeImage = (idx: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
    setEditedResults([])
  }

  const handleAnalyze = async () => {
    if (images.length === 0 || !user) return
    if (!settings?.openrouter_api_key) {
      showToast('请先在「设置」页面填写你的 OpenRouter API Key', 'error')
      return
    }

    setAnalyzing(true)
    try {
      const updatedImages = [...images]
      for (let i = 0; i < updatedImages.length; i++) {
        if (!updatedImages[i].storageUrl) {
          updatedImages[i] = { ...updatedImages[i], uploading: true }
          setImages([...updatedImages])
          const url = await uploadToStorage(updatedImages[i], i)
          updatedImages[i] = { ...updatedImages[i], uploading: false, storageUrl: url, error: url ? null : '上传失败' }
          setImages([...updatedImages])
        }
      }

      const imageUrls = updatedImages.map(i => i.storageUrl).filter(Boolean) as string[]
      if (imageUrls.length === 0) { showToast('所有图片上传失败，请重试', 'error'); return }

      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-pattern`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ imageUrls }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'NO_API_KEY') { navigate('/settings'); return }
        throw new Error(data.error ?? '分析失败')
      }

      setEditedResults(data.map((r: AnalysisResult) => ({ ...r })))
      showToast(`分析完成！识别出 ${data.length} 种颜色`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '分析失败，请重试', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const updateResultQty = (idx: number, value: number) =>
    setEditedResults(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Math.max(0, value) } : r))

  const removeResult = (idx: number) =>
    setEditedResults(prev => prev.filter((_, i) => i !== idx))

  const getShortage = (code: string, needed: number) => (inventory[code]?.quantity ?? 0) - needed

  const handleSave = async () => {
    if (!patternName.trim()) { showToast('请输入图纸名称', 'error'); return }
    if (editedResults.length === 0) { showToast('没有分析结果', 'error'); return }
    setSaving(true)
    try {
      const firstUrl = images.find(i => i.storageUrl)?.storageUrl ?? null
      const ok = await createPattern(patternName.trim(), firstUrl, editedResults, [], null)
      if (ok) { showToast('图纸已保存到档案！', 'success'); setPatternName('') }
      else showToast('保存失败，请重试', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeduct = async () => {
    if (editedResults.length === 0) return
    if (!confirm(`确认从库存扣除 ${editedResults.length} 种颜色的用量？`)) return
    setDeducting(true)
    try {
      for (const r of editedResults) {
        const cur = inventory[r.color_code]?.quantity ?? 0
        setQuantity(r.color_code, Math.max(0, cur - r.quantity))
      }
      showToast('库存已扣除！', 'success')
    } finally {
      setDeducting(false)
    }
  }

  const hasShortage = editedResults.some(r => getShortage(r.color_code, r.quantity) < 0)
  const totalBeads = editedResults.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">分析图纸</h1>
        <p className="text-gray-500 text-sm mt-1">上传图纸图片，AI 自动识别颜色和数量，支持多张同时分析</p>
      </div>

      {settings && !settings.openrouter_api_key && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-700">未设置 OpenRouter API Key</p>
            <p className="text-xs text-orange-600 mt-0.5">需要先在设置中配置 API Key 才能使用 AI 分析功能</p>
          </div>
          <button onClick={() => navigate('/settings')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-800 whitespace-nowrap"
          >前往设置 →</button>
        </div>
      )}

      {/* Dropzone */}
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary/5'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-700">
              {isDragActive ? '释放以添加图片' : '点击或拖拽上传图纸图片'}
            </p>
            <p className="text-sm text-gray-400 mt-1">支持 PNG、JPG、WEBP，单张最大 20MB，可同时选多张</p>
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">已选图片（{images.length} 张）</h3>
            <button
              onClick={() => { images.forEach(i => URL.revokeObjectURL(i.previewUrl)); setImages([]); setEditedResults([]) }}
              className="text-sm text-gray-400 hover:text-red-500"
            >清除全部</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {img.error && (
                  <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">失败</span>
                  </div>
                )}
                {img.storageUrl && !img.uploading && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
                <button onClick={() => removeImage(idx)}
                  className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded-full text-white text-xs items-center justify-center hidden group-hover:flex leading-none"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyze button */}
      {images.length > 0 && (
        <button onClick={handleAnalyze} disabled={analyzing || !settings?.openrouter_api_key}
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />AI 分析中，请稍候…</>
          ) : (
            <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>开始 AI 分析（{images.length} 张图片）</>
          )}
        </button>
      )}

      {/* Results */}
      {editedResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">分析结果</h2>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>共 <b className="text-gray-900">{editedResults.length}</b> 种</span>
              <span>合计 <b className="text-gray-900">{totalBeads.toLocaleString()}</b> 颗</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">色号</th>
                    <th className="text-right px-4 py-3">需要量</th>
                    <th className="text-right px-4 py-3">当前库存</th>
                    <th className="text-right px-4 py-3">差额</th>
                    <th className="w-8 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {editedResults.map((r, idx) => {
                    const shortage = getShortage(r.color_code, r.quantity)
                    return (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex-shrink-0 border border-gray-200" style={{ backgroundColor: getHex(r.color_code) }} />
                            <span className="font-semibold text-gray-800">{r.color_code}</span>
                            <span className="text-gray-400 text-xs hidden sm:inline">{getName(r.color_code)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min="0" value={r.quantity}
                            onChange={e => updateResultQty(idx, parseInt(e.target.value) || 0)}
                            className="w-20 text-right px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {inventory[r.color_code]?.quantity ?? 0}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${shortage < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {shortage < 0 ? shortage : `+${shortage}`}
                        </td>
                        <td className="px-2 py-3">
                          <button onClick={() => removeResult(idx)} className="text-gray-300 hover:text-red-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {hasShortage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-700 text-sm mb-2">库存不足：</p>
              <div className="flex flex-wrap gap-2">
                {editedResults.filter(r => getShortage(r.color_code, r.quantity) < 0).map(r => (
                  <span key={r.color_code} className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">
                    <div className="w-3 h-3 rounded-full border border-red-300" style={{ backgroundColor: getHex(r.color_code) }} />
                    {r.color_code}（缺 {Math.abs(getShortage(r.color_code, r.quantity))}）
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">保存 & 更新库存</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">图纸名称</label>
              <input type="text" value={patternName} onChange={e => setPatternName(e.target.value)}
                placeholder="给这张图纸起个名字…"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleSave} disabled={saving || !patternName.trim()}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                保存到图纸档案
              </button>
              <button onClick={handleDeduct} disabled={deducting}
                className="flex-1 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {deducting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                确认扣除库存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

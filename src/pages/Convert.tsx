import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { usePatterns } from '../hooks/usePatterns'
import { BeadColorEntry, ConversionResult, convertToBeads, renderBeadGrid, renderBeadGridLabeled, calcAspectGrid } from '../lib/imageToBeads'
import { Toast } from '../lib/types'

interface ConvertProps {
  showToast: (msg: string, type: Toast['type']) => void
}

const PRESETS = [
  { label: '32×32', w: 32, h: 32, note: '简易' },
  { label: '52×52', w: 52, h: 52, note: '标准' },
  { label: '72×72', w: 72, h: 72, note: '中等' },
  { label: '104×104', w: 104, h: 104, note: '精细' },
  { label: '148×148', w: 148, h: 148, note: '超精细' },
]

const DISPLAY_MAX = 480  // max canvas display size in px

export default function Convert({ showToast }: ConvertProps) {
  const { user } = useAuthStore()
  const { createPattern } = usePatterns()

  const [palette, setPalette] = useState<BeadColorEntry[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)

  const [presetIdx, setPresetIdx] = useState(1)   // default 52×52
  const [keepRatio, setKeepRatio] = useState(true)

  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState<ConversionResult | null>(null)

  const [patternName, setPatternName] = useState('')
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetch('./bead-colors.json').then(r => r.json()).then(setPalette).catch(console.error)
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setImageFile(file)
    setPreviewUrl(url)
    setResult(null)
    setPatternName('')

    const img = new Image()
    img.onload = () => setImgEl(img)
    img.src = url
  }, [previewUrl])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
  })

  const getGridSize = () => {
    const preset = PRESETS[presetIdx]
    if (!keepRatio || !imgEl) return { w: preset.w, h: preset.h }
    const maxDim = preset.w  // square presets: use as max dimension
    return calcAspectGrid(imgEl.naturalWidth, imgEl.naturalHeight, maxDim)
  }

  const handleConvert = () => {
    if (!imgEl || palette.length === 0) return
    setConverting(true)
    // Use setTimeout to let React re-render the loading state before blocking CPU
    setTimeout(() => {
      try {
        const { w, h } = getGridSize()
        const res = convertToBeads(imgEl, w, h, palette)
        setResult(res)

        // Render to display canvas after state update
        requestAnimationFrame(() => {
          if (canvasRef.current) {
            const cellSize = Math.max(3, Math.floor(DISPLAY_MAX / Math.max(w, h)))
            renderBeadGrid(canvasRef.current, res.grid, cellSize)
          }
        })
      } finally {
        setConverting(false)
      }
    }, 30)
  }

  // Re-render canvas when result changes
  useEffect(() => {
    if (!result || !canvasRef.current) return
    const cellSize = Math.max(3, Math.floor(DISPLAY_MAX / Math.max(result.width, result.height)))
    renderBeadGrid(canvasRef.current, result.grid, cellSize)
  }, [result])

  // Build the labeled export canvas (24px/cell with color codes) as a Blob
  const buildLabeledBlob = (): Promise<Blob | null> => {
    if (!result) return Promise.resolve(null)
    const exportCanvas = document.createElement('canvas')
    renderBeadGridLabeled(exportCanvas, result.grid)
    return new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png'))
  }

  const handleDownload = async () => {
    if (!result) return
    const blob = await buildLabeledBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${patternName || '拼豆图纸'}_${result.width}x${result.height}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleSave = async () => {
    if (!patternName.trim()) { showToast('请输入图纸名称', 'error'); return }
    if (!result || !user) return
    setSaving(true)
    try {
      // Upload the labeled pattern image (not the original photo)
      let storageUrl: string | null = null
      const blob = await buildLabeledBlob()
      if (blob) {
        const path = `${user.id}/convert_${Date.now()}.png`
        const { data, error } = await supabase.storage
          .from('pattern-images')
          .upload(path, blob, { contentType: 'image/png', upsert: true })
        if (!error) {
          storageUrl = supabase.storage.from('pattern-images').getPublicUrl(data.path).data.publicUrl
        }
      }

      const beads = Object.entries(result.counts).map(([color_code, quantity]) => ({ color_code, quantity }))
      const saved = await createPattern(patternName.trim(), storageUrl, beads, [], null)
      if (saved) {
        showToast('图纸已保存到档案！', 'success')
        setPatternName('')
      } else {
        showToast('保存失败，请重试', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  // Sort bead counts descending for display
  const sortedCounts = result
    ? Object.entries(result.counts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, qty]) => ({
          code,
          qty,
          hex: palette.find(p => p.code === code)?.hex ?? '#ccc',
        }))
    : []

  const totalBeads = sortedCounts.reduce((s, c) => s + c.qty, 0)
  const { w: previewW, h: previewH } = imgEl
    ? getGridSize()
    : { w: PRESETS[presetIdx].w, h: PRESETS[presetIdx].h }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">拼豆图纸生成</h1>
        <p className="text-gray-500 text-sm mt-1">
          上传任意图片，自动转换为拼豆配色图纸
        </p>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : previewUrl
            ? 'border-green-300 bg-green-50'
            : 'border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary/5'
        }`}
      >
        <input {...getInputProps()} />
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={previewUrl}
              alt="原图"
              className="max-h-48 max-w-full rounded-xl object-contain shadow-sm"
            />
            <p className="text-sm text-gray-500">
              {imageFile?.name} · 点击重新上传
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-700">
                {isDragActive ? '释放以上传' : '点击或拖拽上传图片'}
              </p>
              <p className="text-sm text-gray-400 mt-1">支持 PNG、JPG、WEBP 等，最大 20MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Grid size config */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-bold text-gray-900">图纸尺寸设置</h3>

        <div>
          <p className="text-xs text-gray-500 mb-2">选择格子规格</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => setPresetIdx(i)}
                className={`flex flex-col items-center px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                  presetIdx === i
                    ? 'bg-primary text-white border-primary'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{p.label}</span>
                <span className={`text-[10px] font-normal mt-0.5 ${presetIdx === i ? 'text-white/70' : 'text-gray-400'}`}>
                  {p.note}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => setKeepRatio(v => !v)}
            className={`w-10 h-5 rounded-full transition-colors relative ${keepRatio ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${keepRatio ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700">保持原始宽高比</span>
          {imgEl && (
            <span className="text-xs text-gray-400">
              → 实际尺寸 {previewW}×{previewH}（{previewW * previewH} 颗）
            </span>
          )}
        </label>

        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <p>· 格子越多越精细，但用豆量也更多</p>
          <p>· 52×52 约 2704 颗 · 104×104 约 10816 颗</p>
          <p>· 所有转换在本地完成，不消耗 API 额度</p>
        </div>
      </div>

      {/* Convert button */}
      <button
        onClick={handleConvert}
        disabled={!imgEl || converting || palette.length === 0}
        className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {converting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            转换中，请稍候…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            开始转换（{previewW}×{previewH}）
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">转换结果</h2>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              下载图纸（含色号）
            </button>
          </div>

          {/* Side by side: original + result */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">原图</p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="原图"
                  className="w-full rounded-xl object-contain max-h-64"
                  style={{ imageRendering: 'auto' }}
                />
              )}
            </div>

            {/* Bead grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">
                拼豆图纸 · {result.width}×{result.height}
              </p>
              <div className="overflow-auto rounded-xl" style={{ maxHeight: '320px' }}>
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 text-center">
              <p className="text-xs text-gray-400">格子总数</p>
              <p className="text-xl font-black text-gray-900">{(result.width * result.height).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 text-center">
              <p className="text-xs text-gray-400">颜色种数</p>
              <p className="text-xl font-black text-primary">{sortedCounts.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 text-center">
              <p className="text-xs text-gray-400">总用豆</p>
              <p className="text-xl font-black text-gray-900">
                {totalBeads >= 10000 ? `${(totalBeads / 10000).toFixed(1)}w` : totalBeads.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Bead count table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">用珠明细</h3>
              <span className="text-sm text-gray-400">
                {sortedCounts.length} 种颜色 · 共 {totalBeads.toLocaleString()} 颗
              </span>
            </div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                  <tr className="text-gray-500 font-medium">
                    <th className="text-left px-4 py-2.5">色号</th>
                    <th className="text-left px-4 py-2.5">颜色</th>
                    <th className="text-right px-4 py-2.5">数量</th>
                    <th className="text-right px-4 py-2.5">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCounts.map(({ code, qty, hex }) => (
                    <tr key={code} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{code}</td>
                      <td className="px-4 py-2.5">
                        <div className="w-6 h-6 rounded-lg border border-gray-200" style={{ backgroundColor: hex }} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">
                        {qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400">
                        {((qty / totalBeads) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save to archive */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">保存到图纸档案</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">图纸名称</label>
              <input
                type="text"
                value={patternName}
                onChange={e => setPatternName(e.target.value)}
                placeholder="给这张图纸起个名字…"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !patternName.trim()}
              className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center gap-2 text-sm"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              保存到图纸档案
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useInventory } from '../hooks/useInventory'
import { usePatterns } from '../hooks/usePatterns'
import { AnalysisResult, BeadColor, Toast } from '../lib/types'

interface AnalyzeProps {
  showToast: (msg: string, type: Toast['type']) => void
}

export default function Analyze({ showToast }: AnalyzeProps) {
  const { user } = useAuthStore()
  const { inventory, setQuantity } = useInventory()
  const { createPattern } = usePatterns()
  const [beadColors, setBeadColors] = useState<BeadColor[]>([])

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [editedResults, setEditedResults] = useState<AnalysisResult[]>([])
  const [patternName, setPatternName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deducting, setDeducting] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('./bead-colors.json')
      .then((r) => r.json())
      .then(setBeadColors)
      .catch(console.error)
  }, [])

  const getColorHex = (code: string) => {
    return beadColors.find((c) => c.code === code)?.hex ?? '#ccc'
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setUploadedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setResults([])
    setEditedResults([])
    setUploadedImageUrl(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleAnalyze = async () => {
    if (!uploadedFile || !user) return
    setAnalyzing(true)

    try {
      // Upload image to Supabase Storage
      const ext = uploadedFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pattern-images')
        .upload(path, uploadedFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('pattern-images')
        .getPublicUrl(uploadData.path)

      const imageUrl = urlData.publicUrl
      setUploadedImageUrl(imageUrl)

      // Call edge function
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-pattern`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`分析失败: ${errText}`)
      }

      const analysisData: AnalysisResult[] = await res.json()
      setResults(analysisData)
      setEditedResults(analysisData.map((r) => ({ ...r })))
      showToast('图纸分析完成！', 'success')
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : '分析失败，请重试', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleQuantityChange = (idx: number, value: number) => {
    setEditedResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, quantity: Math.max(0, value) } : r))
    )
  }

  const handleSavePattern = async () => {
    if (!patternName.trim()) {
      showToast('请输入图纸名称', 'error')
      return
    }
    if (editedResults.length === 0) {
      showToast('没有分析结果可保存', 'error')
      return
    }
    setSaving(true)
    try {
      const pattern = await createPattern(
        patternName.trim(),
        uploadedImageUrl,
        editedResults,
        [],
        null
      )
      if (pattern) {
        showToast('图纸已保存到档案！', 'success')
        setPatternName('')
      } else {
        showToast('保存失败，请重试', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeductInventory = async () => {
    if (editedResults.length === 0) return
    if (!confirm('确认扣除库存？此操作将减少对应颜色的库存数量。')) return

    setDeducting(true)
    try {
      for (const result of editedResults) {
        const currentQty = inventory[result.color_code]?.quantity ?? 0
        const newQty = Math.max(0, currentQty - result.quantity)
        setQuantity(result.color_code, newQty)
      }
      showToast('库存已扣除！', 'success')
    } finally {
      setDeducting(false)
    }
  }

  const getShortage = (colorCode: string, needed: number) => {
    const current = inventory[colorCode]?.quantity ?? 0
    return current - needed
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">分析图纸</h1>
        <p className="text-gray-500 text-sm mt-1">上传图纸图片，AI自动识别所需颜色和数量</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : uploadedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary/5'
        }`}
      >
        <input {...getInputProps()} />
        {previewUrl ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 max-w-full rounded-xl object-contain shadow-md"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">{uploadedFile?.name}</p>
              <p className="text-xs text-gray-400 mt-1">点击或拖拽可更换图片</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-700">
                {isDragActive ? '释放以上传图片' : '点击或拖拽上传图纸图片'}
              </p>
              <p className="text-sm text-gray-400 mt-1">支持 PNG、JPG、GIF、WEBP，最大 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Analyze button */}
      {uploadedFile && results.length === 0 && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>AI分析中，请稍候...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              开始AI分析
            </>
          )}
        </button>
      )}

      {/* Results */}
      {editedResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">分析结果</h2>

          {/* Results table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">色号</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">颜色</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">需要数量</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">当前库存</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">缺货数量</th>
                  </tr>
                </thead>
                <tbody>
                  {editedResults.map((result, idx) => {
                    const shortage = getShortage(result.color_code, result.quantity)
                    const currentStock = inventory[result.color_code]?.quantity ?? 0
                    const hex = getColorHex(result.color_code)
                    return (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{result.color_code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-md border border-gray-200 flex-shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                            <span className="text-gray-500 text-xs">
                              {beadColors.find((c) => c.code === result.color_code)?.name ?? ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={result.quantity}
                            onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 0)}
                            className="w-20 text-right px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {currentStock}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${shortage < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {shortage < 0 ? shortage : '+' + shortage}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shortage summary */}
          {editedResults.some((r) => getShortage(r.color_code, r.quantity) < 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-700 mb-2">缺货颜色：</p>
              <div className="flex flex-wrap gap-2">
                {editedResults
                  .filter((r) => getShortage(r.color_code, r.quantity) < 0)
                  .map((r) => (
                    <span key={r.color_code} className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      <div className="w-3 h-3 rounded-full border border-red-300" style={{ backgroundColor: getColorHex(r.color_code) }} />
                      {r.color_code}（缺 {Math.abs(getShortage(r.color_code, r.quantity))}）
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Save + deduct */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">保存图纸</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">图纸名称</label>
              <input
                type="text"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                placeholder="给这张图纸起个名字..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSavePattern}
                disabled={saving || !patternName.trim()}
                className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                保存到图纸档案
              </button>
              <button
                onClick={handleDeductInventory}
                disabled={deducting}
                className="flex-1 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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

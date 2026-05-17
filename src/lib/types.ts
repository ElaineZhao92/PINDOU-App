export interface BeadColor {
  code: string
  name: string
  hex: string
  series: string
}

export interface InventoryItem {
  id: string
  user_id: string
  color_code: string
  quantity: number
  low_threshold: number
  updated_at: string
}

export interface Pattern {
  id: string
  user_id: string
  name: string
  image_url: string | null
  status: 'in_progress' | 'completed'
  tags: string[]
  notes: string | null
  completed_at: string | null
  created_at: string
}

export interface PatternBead {
  id: string
  pattern_id: string
  color_code: string
  quantity: number
}

export interface AnalysisResult {
  color_code: string
  quantity: number
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

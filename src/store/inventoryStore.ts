import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { InventoryItem } from '../lib/types'

export interface OperationRecord {
  id: string
  description: string
  timestamp: string
  affectedColors: number
  delta: number | null  // null = "set to" operation
}

interface UndoSnapshot {
  quantities: Record<string, number>
  description: string
  timestamp: string
}

interface InventoryState {
  inventory: Record<string, InventoryItem>
  loading: boolean
  undoStack: UndoSnapshot[]
  history: OperationRecord[]

  fetchInventory: (userId: string) => Promise<void>
  updateQuantity: (colorCode: string, delta: number, userId: string) => Promise<void>
  setQuantity: (colorCode: string, quantity: number, userId: string) => Promise<void>
  bulkUpdateQuantity: (delta: number, userId: string, seriesFilter: string[] | null) => Promise<void>
  bulkSetQuantity: (quantity: number, userId: string, seriesFilter: string[] | null) => Promise<void>
  undo: (userId: string) => Promise<boolean>
  clearHistory: () => void
  getLowStockItems: (threshold?: number) => InventoryItem[]
  getByCode: (code: string) => InventoryItem | null
}

const HISTORY_KEY = 'pindou_op_history'
const MAX_UNDO = 5
const MAX_HISTORY = 50

function loadHistory(): OperationRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(history: OperationRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Upsert a batch of inventory items. Returns true on success, false on failure.
// We deliberately omit `id` from the payload and rely on the (user_id, color_code)
// unique constraint so PostgREST handles INSERT vs UPDATE automatically.
// After a successful upsert we write the real DB rows (with proper UUIDs) back into
// the Zustand state so that subsequent single-item edits use UPDATE not INSERT.
async function doBatchUpsert(
  items: InventoryItem[],
  userId: string,
  set: (fn: (s: InventoryState) => Partial<InventoryState>) => void,
): Promise<boolean> {
  const payload = items.map((i) => ({
    user_id: userId,
    color_code: i.color_code,
    quantity: i.quantity,
    low_threshold: i.low_threshold ?? 50,
    updated_at: i.updated_at,
  }))

  const { data, error } = await supabase
    .from('inventory')
    .upsert(payload, { onConflict: 'user_id,color_code' })
    .select()

  if (error) {
    console.error('Batch upsert failed:', error.message)
    return false
  }

  // Sync real IDs back into local state
  if (data && data.length > 0) {
    set((state) => {
      const next = { ...state.inventory }
      for (const row of data) next[row.color_code] = row
      return { inventory: next }
    })
  }
  return true
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  inventory: {},
  loading: false,
  undoStack: [],
  history: loadHistory(),

  fetchInventory: async (userId: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error

      const beadColorsRes = await fetch('./bead-colors.json')
      const beadColors = await beadColorsRes.json()

      const inventoryMap: Record<string, InventoryItem> = {}
      for (const color of beadColors) {
        inventoryMap[color.code] = {
          id: '',
          user_id: userId,
          color_code: color.code,
          quantity: 0,
          low_threshold: 50,
          updated_at: new Date().toISOString(),
        }
      }
      if (data) {
        for (const item of data) {
          inventoryMap[item.color_code] = item
        }
      }
      set({ inventory: inventoryMap })
    } finally {
      set({ loading: false })
    }
  },

  updateQuantity: async (colorCode: string, delta: number, userId: string) => {
    const current = get().inventory[colorCode]
    if (!current) return
    await get().setQuantity(colorCode, current.quantity + delta, userId)
  },

  setQuantity: async (colorCode: string, quantity: number, userId: string) => {
    const current = get().inventory[colorCode]
    set((state) => ({
      inventory: {
        ...state.inventory,
        [colorCode]: { ...state.inventory[colorCode], quantity, updated_at: new Date().toISOString() },
      },
    }))

    if (current?.id) {
      const { error } = await supabase
        .from('inventory')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', current.id)
      if (error) {
        set((state) => ({ inventory: { ...state.inventory, [colorCode]: current } }))
      }
    } else {
      const { data, error } = await supabase
        .from('inventory')
        .insert({ user_id: userId, color_code: colorCode, quantity, low_threshold: 50 })
        .select()
        .single()
      if (error) {
        set((state) => ({ inventory: { ...state.inventory, [colorCode]: current } }))
      } else if (data) {
        set((state) => ({ inventory: { ...state.inventory, [colorCode]: data } }))
      }
    }
  },

  bulkUpdateQuantity: async (delta: number, userId: string, seriesFilter: string[] | null) => {
    const { inventory } = get()
    const targets = Object.values(inventory).filter(
      (item) => !seriesFilter || seriesFilter.includes(item.color_code.replace(/\d+$/, ''))
    )
    if (targets.length === 0) return

    const label = seriesFilter ? seriesFilter.join('/') + ' 系列' : '全部颜色'
    const snapshot: UndoSnapshot = {
      quantities: Object.fromEntries(targets.map((i) => [i.color_code, i.quantity])),
      description: `${delta > 0 ? '+' : ''}${delta} 粒（${label}，共 ${targets.length} 色）`,
      timestamp: new Date().toISOString(),
    }
    const updatedItems = targets.map((item) => ({
      ...item,
      quantity: Math.max(0, item.quantity + delta),
      updated_at: new Date().toISOString(),
    }))

    // Optimistic update + push undo snapshot
    set((state) => {
      const next = { ...state.inventory }
      for (const item of updatedItems) next[item.color_code] = item
      return { inventory: next, undoStack: [snapshot, ...state.undoStack].slice(0, MAX_UNDO) }
    })

    const ok = await doBatchUpsert(updatedItems, userId, set)
    if (!ok) {
      // Revert optimistic update
      set((state) => {
        const next = { ...state.inventory }
        for (const [code, qty] of Object.entries(snapshot.quantities)) {
          next[code] = { ...next[code], quantity: qty }
        }
        return { inventory: next, undoStack: state.undoStack.slice(1) }
      })
      return
    }

    const record: OperationRecord = {
      id: makeId(), description: snapshot.description,
      timestamp: snapshot.timestamp, affectedColors: targets.length, delta,
    }
    const newHistory = [record, ...get().history].slice(0, MAX_HISTORY)
    set({ history: newHistory })
    saveHistory(newHistory)
  },

  bulkSetQuantity: async (quantity: number, userId: string, seriesFilter: string[] | null) => {
    const { inventory } = get()
    const targets = Object.values(inventory).filter(
      (item) => !seriesFilter || seriesFilter.includes(item.color_code.replace(/\d+$/, ''))
    )
    if (targets.length === 0) return

    const safeQty = Math.max(0, quantity)
    const label = seriesFilter ? seriesFilter.join('/') + ' 系列' : '全部颜色'
    const snapshot: UndoSnapshot = {
      quantities: Object.fromEntries(targets.map((i) => [i.color_code, i.quantity])),
      description: `设为 ${safeQty} 粒（${label}，共 ${targets.length} 色）`,
      timestamp: new Date().toISOString(),
    }
    const updatedItems = targets.map((item) => ({
      ...item, quantity: safeQty, updated_at: new Date().toISOString(),
    }))

    set((state) => {
      const next = { ...state.inventory }
      for (const item of updatedItems) next[item.color_code] = item
      return { inventory: next, undoStack: [snapshot, ...state.undoStack].slice(0, MAX_UNDO) }
    })

    const ok = await doBatchUpsert(updatedItems, userId, set)
    if (!ok) {
      set((state) => {
        const next = { ...state.inventory }
        for (const [code, qty] of Object.entries(snapshot.quantities)) {
          next[code] = { ...next[code], quantity: qty }
        }
        return { inventory: next, undoStack: state.undoStack.slice(1) }
      })
      return
    }

    const record: OperationRecord = {
      id: makeId(), description: snapshot.description,
      timestamp: snapshot.timestamp, affectedColors: targets.length, delta: null,
    }
    const newHistory = [record, ...get().history].slice(0, MAX_HISTORY)
    set({ history: newHistory })
    saveHistory(newHistory)
  },

  undo: async (userId: string) => {
    const { undoStack } = get()
    if (undoStack.length === 0) return false

    const [top, ...rest] = undoStack
    const restoredItems = Object.entries(top.quantities).map(([colorCode, quantity]) => ({
      ...(get().inventory[colorCode] ?? {}),
      color_code: colorCode,
      quantity,
      updated_at: new Date().toISOString(),
    })) as InventoryItem[]

    // Optimistic restore
    set((state) => {
      const next = { ...state.inventory }
      for (const item of restoredItems) next[item.color_code] = { ...next[item.color_code], ...item }
      return { inventory: next, undoStack: rest }
    })

    const ok = await doBatchUpsert(restoredItems, userId, set)
    if (!ok) {
      // Re-push snapshot back if undo itself failed
      set((state) => ({ undoStack: [top, ...state.undoStack] }))
      return false
    }

    const record: OperationRecord = {
      id: makeId(),
      description: `↩ 撤销：${top.description}`,
      timestamp: new Date().toISOString(),
      affectedColors: Object.keys(top.quantities).length,
      delta: null,
    }
    const newHistory = [record, ...get().history].slice(0, MAX_HISTORY)
    set({ history: newHistory })
    saveHistory(newHistory)
    return true
  },

  clearHistory: () => {
    set({ history: [] })
    localStorage.removeItem(HISTORY_KEY)
  },

  getLowStockItems: (threshold?: number) => {
    return Object.values(get().inventory).filter(
      (item) => item.quantity < (threshold ?? item.low_threshold ?? 50)
    )
  },

  getByCode: (code: string) => get().inventory[code] ?? null,
}))

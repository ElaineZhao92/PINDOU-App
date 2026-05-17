import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { InventoryItem } from '../lib/types'

interface InventoryState {
  inventory: Record<string, InventoryItem>
  loading: boolean
  fetchInventory: (userId: string) => Promise<void>
  updateQuantity: (colorCode: string, delta: number, userId: string) => Promise<void>
  setQuantity: (colorCode: string, quantity: number, userId: string) => Promise<void>
  getLowStockItems: (threshold?: number) => InventoryItem[]
  getByCode: (code: string) => InventoryItem | null
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  inventory: {},
  loading: false,

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

      // Initialize all colors with 0 quantity
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

      // Overlay with actual data from Supabase
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

    const newQuantity = Math.max(0, current.quantity + delta)
    await get().setQuantity(colorCode, newQuantity, userId)
  },

  setQuantity: async (colorCode: string, quantity: number, userId: string) => {
    const current = get().inventory[colorCode]
    const safeQty = Math.max(0, quantity)

    // Optimistic update
    set((state) => ({
      inventory: {
        ...state.inventory,
        [colorCode]: {
          ...state.inventory[colorCode],
          quantity: safeQty,
          updated_at: new Date().toISOString(),
        },
      },
    }))

    if (current?.id) {
      // Update existing record
      const { error } = await supabase
        .from('inventory')
        .update({ quantity: safeQty, updated_at: new Date().toISOString() })
        .eq('id', current.id)

      if (error) {
        // Revert optimistic update on error
        set((state) => ({
          inventory: {
            ...state.inventory,
            [colorCode]: current,
          },
        }))
      }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          user_id: userId,
          color_code: colorCode,
          quantity: safeQty,
          low_threshold: 50,
        })
        .select()
        .single()

      if (error) {
        // Revert
        set((state) => ({
          inventory: {
            ...state.inventory,
            [colorCode]: current,
          },
        }))
      } else if (data) {
        set((state) => ({
          inventory: {
            ...state.inventory,
            [colorCode]: data,
          },
        }))
      }
    }
  },

  getLowStockItems: (threshold?: number) => {
    const { inventory } = get()
    return Object.values(inventory).filter(
      (item) => item.quantity < (threshold ?? item.low_threshold ?? 50)
    )
  },

  getByCode: (code: string) => {
    return get().inventory[code] ?? null
  },
}))

import { useEffect } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { useAuthStore } from '../store/authStore'

export function useInventory() {
  const { user } = useAuthStore()
  const store = useInventoryStore()

  useEffect(() => {
    if (user?.id) store.fetchInventory(user.id)
  }, [user?.id])

  return {
    inventory: store.inventory,
    loading: store.loading,
    undoStack: store.undoStack,
    history: store.history,
    updateQuantity: (colorCode: string, delta: number) =>
      user?.id && store.updateQuantity(colorCode, delta, user.id),
    setQuantity: (colorCode: string, quantity: number) =>
      user?.id && store.setQuantity(colorCode, quantity, user.id),
    bulkUpdateQuantity: (delta: number, seriesFilter: string[] | null) =>
      user?.id ? store.bulkUpdateQuantity(delta, user.id, seriesFilter) : Promise.resolve(),
    bulkSetQuantity: (quantity: number, seriesFilter: string[] | null) =>
      user?.id ? store.bulkSetQuantity(quantity, user.id, seriesFilter) : Promise.resolve(),
    undo: () => user?.id ? store.undo(user.id) : Promise.resolve(false),
    clearHistory: store.clearHistory,
    getLowStockItems: store.getLowStockItems,
    getByCode: store.getByCode,
    refetch: () => user?.id && store.fetchInventory(user.id),
  }
}

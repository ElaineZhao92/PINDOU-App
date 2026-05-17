import { useEffect } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { useAuthStore } from '../store/authStore'

export function useInventory() {
  const { user } = useAuthStore()
  const { inventory, loading, fetchInventory, updateQuantity, setQuantity, getLowStockItems, getByCode } =
    useInventoryStore()

  useEffect(() => {
    if (user?.id) {
      fetchInventory(user.id)
    }
  }, [user?.id, fetchInventory])

  const handleUpdateQuantity = (colorCode: string, delta: number) => {
    if (user?.id) {
      updateQuantity(colorCode, delta, user.id)
    }
  }

  const handleSetQuantity = (colorCode: string, quantity: number) => {
    if (user?.id) {
      setQuantity(colorCode, quantity, user.id)
    }
  }

  return {
    inventory,
    loading,
    updateQuantity: handleUpdateQuantity,
    setQuantity: handleSetQuantity,
    getLowStockItems,
    getByCode,
    refetch: () => user?.id && fetchInventory(user.id),
  }
}

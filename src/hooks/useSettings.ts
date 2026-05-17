import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export interface UserSettings {
  openrouter_api_key: string | null
  low_threshold_default: number
}

export function useSettings() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('openrouter_api_key, low_threshold_default')
        .eq('user_id', user.id)
        .maybeSingle()
      setSettings(data ?? { openrouter_api_key: null, low_threshold_default: 50 })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetch() }, [fetch])

  const save = async (patch: Partial<UserSettings>): Promise<boolean> => {
    if (!user?.id) return false
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) { console.error(error); return false }
    setSettings((prev) => ({ ...(prev ?? { openrouter_api_key: null, low_threshold_default: 50 }), ...patch }))
    return true
  }

  return { settings, loading, save, refetch: fetch }
}

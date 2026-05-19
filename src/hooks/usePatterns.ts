import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Pattern, PatternBead } from '../lib/types'
import { useAuthStore } from '../store/authStore'

export function usePatterns() {
  const { user } = useAuthStore()
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPatterns = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPatterns(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  const createPattern = async (
    name: string,
    imageUrl: string | null,
    beads: { color_code: string; quantity: number }[],
    tags: string[] = [],
    notes: string | null = null
  ): Promise<Pattern | null> => {
    if (!user?.id) return null

    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .insert({
        user_id: user.id,
        name,
        image_url: imageUrl,
        status: 'in_progress',
        tags,
        notes,
      })
      .select()
      .single()

    if (patternError || !pattern) return null

    if (beads.length > 0) {
      const beadRows = beads.map((b) => ({
        pattern_id: pattern.id,
        color_code: b.color_code,
        quantity: b.quantity,
      }))
      await supabase.from('pattern_beads').insert(beadRows)
    }

    await fetchPatterns()
    return pattern
  }

  const updatePatternStatus = async (patternId: string, status: 'in_progress' | 'completed') => {
    const { error } = await supabase
      .from('patterns')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', patternId)

    if (!error) {
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === patternId
            ? { ...p, status, completed_at: status === 'completed' ? new Date().toISOString() : null }
            : p
        )
      )
    }
  }

  const deletePattern = async (patternId: string) => {
    await supabase.from('pattern_beads').delete().eq('pattern_id', patternId)
    const { error } = await supabase.from('patterns').delete().eq('id', patternId)
    if (!error) {
      setPatterns((prev) => prev.filter((p) => p.id !== patternId))
    }
    return !error
  }

  const getPatternBeads = async (patternId: string): Promise<PatternBead[]> => {
    const { data, error } = await supabase
      .from('pattern_beads')
      .select('*')
      .eq('pattern_id', patternId)

    if (error) return []
    return data ?? []
  }

  const batchUpdateStatus = async (ids: string[], status: 'in_progress' | 'completed') => {
    const { error } = await supabase
      .from('patterns')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .in('id', ids)
    if (!error) {
      setPatterns((prev) =>
        prev.map((p) =>
          ids.includes(p.id)
            ? { ...p, status, completed_at: status === 'completed' ? new Date().toISOString() : null }
            : p
        )
      )
    }
    return !error
  }

  const batchDelete = async (ids: string[]) => {
    await supabase.from('pattern_beads').delete().in('pattern_id', ids)
    const { error } = await supabase.from('patterns').delete().in('id', ids)
    if (!error) {
      setPatterns((prev) => prev.filter((p) => !ids.includes(p.id)))
    }
    return !error
  }

  const batchAddTag = async (ids: string[], tag: string) => {
    const targets = patterns.filter((p) => ids.includes(p.id))
    await Promise.all(
      targets.map((p) => {
        const newTags = p.tags?.includes(tag) ? p.tags : [...(p.tags ?? []), tag]
        return supabase.from('patterns').update({ tags: newTags }).eq('id', p.id)
      })
    )
    setPatterns((prev) =>
      prev.map((p) =>
        ids.includes(p.id) && !p.tags?.includes(tag)
          ? { ...p, tags: [...(p.tags ?? []), tag] }
          : p
      )
    )
  }

  const batchRemoveTag = async (ids: string[], tag: string) => {
    const targets = patterns.filter((p) => ids.includes(p.id))
    await Promise.all(
      targets.map((p) => {
        const newTags = (p.tags ?? []).filter((t) => t !== tag)
        return supabase.from('patterns').update({ tags: newTags }).eq('id', p.id)
      })
    )
    setPatterns((prev) =>
      prev.map((p) =>
        ids.includes(p.id) ? { ...p, tags: (p.tags ?? []).filter((t) => t !== tag) } : p
      )
    )
  }

  return {
    patterns,
    loading,
    fetchPatterns,
    createPattern,
    updatePatternStatus,
    deletePattern,
    getPatternBeads,
    batchUpdateStatus,
    batchDelete,
    batchAddTag,
    batchRemoveTag,
  }
}

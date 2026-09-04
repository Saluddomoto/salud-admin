'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import type { UserRole } from '@salud/database'

interface AuthState {
  user:      User | null
  role:      UserRole | null
  isLoading: boolean
}

export function useAuth(): AuthState & {
  signIn:  (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
} {
  const [state, setState] = useState<AuthState>({ user: null, role: null, isLoading: true })

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setState({
        user,
        role: (user?.user_metadata?.role as UserRole) ?? null,
        isLoading: false,
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setState({
        user,
        role: (user?.user_metadata?.role as UserRole) ?? null,
        isLoading: false,
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      // ログイン履歴の記録。失敗してもログイン自体は継続させる。
      supabase.from('login_history').insert({ user_id: data.user.id }).then(({ error: e }) => {
        if (e) console.error('login_history insert failed', e)
      })
    }
  }

  const signOut = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { ...state, signIn, signOut }
}

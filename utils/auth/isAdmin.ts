import { createAuthClient } from '@/utils/supabase/server'
import { createServerClient } from '@/lib/supabase/server'

export async function isAdmin(): Promise<boolean> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return false

  const db = createServerClient()
  const { data } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return data?.is_admin === true
}

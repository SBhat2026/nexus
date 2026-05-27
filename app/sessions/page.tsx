import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAuthClient } from '@/utils/supabase/server'
import { createServerClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import NexusLogo from '@/components/NexusLogo'

export default async function SessionsPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect('/login?returnTo=/sessions')
  }

  const db = createServerClient()
  const { data: sessions } = await db
    .from('sessions')
    .select(`
      id,
      seed_topic,
      created_at,
      data_source,
      clusters(count),
      papers(count)
    `)
    .eq('user_id', user.id)
    .eq('is_saved', true)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <NexusLogo size={28} />
          <span className="font-semibold text-slate-900">Nexus</span>
        </Link>
        <AuthButton />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">My Sessions</h1>

        {!sessions || sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-slate-500">You haven&apos;t saved any sessions yet. Start a search to begin.</p>
            <Link
              href="/"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
            >
              Start exploring
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => {
              const clusterCount = (s.clusters as unknown as { count: number }[])?.[0]?.count ?? 0
              const paperCount = (s.papers as unknown as { count: number }[])?.[0]?.count ?? 0
              const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="flex flex-col gap-1 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition"
                >
                  <span className="font-medium text-slate-900">{s.seed_topic}</span>
                  <span className="text-xs text-slate-400">
                    {date} · {clusterCount} clusters · {paperCount} papers
                    {s.data_source && s.data_source !== 'openalex' && (
                      <span className="ml-2 text-slate-300">via {s.data_source}</span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

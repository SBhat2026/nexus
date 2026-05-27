import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/utils/auth/isAdmin'
import { createServerClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import NexusLogo from '@/components/NexusLogo'

export default async function AdminPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/')

  const db = createServerClient()

  const [
    { count: totalSessions },
    { count: recentSessions },
    { count: totalUsers },
    { count: totalPapers },
    { data: recentSessionList },
    { data: errorSessions },
  ] = await Promise.all([
    db.from('sessions').select('*', { count: 'exact', head: true }),
    db.from('sessions').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    db.from('sessions').select('user_id', { count: 'exact', head: true })
      .not('user_id', 'is', null),
    db.from('papers').select('*', { count: 'exact', head: true }),
    db.from('sessions')
      .select('id, seed_topic, created_at, data_source, user_id, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('session_progress')
      .select('session_id, stage, message, updated_at, sessions(seed_topic)')
      .eq('stage', 'error')
      .order('updated_at', { ascending: false })
      .limit(20),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <NexusLogo size={28} />
          <span className="font-semibold text-slate-900">Nexus Admin</span>
        </Link>
        <AuthButton />
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* Stats */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total sessions', value: totalSessions ?? 0 },
              { label: 'Last 7 days', value: recentSessions ?? 0 },
              { label: 'Registered users', value: totalUsers ?? 0 },
              { label: 'Total papers', value: totalPapers ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent sessions */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Sessions</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Topic', 'User', 'Date', 'Source'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recentSessionList ?? []).map((s) => {
                  const profile = (s.profiles as unknown as { email: string } | null)
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/session/${s.id}`} className="text-blue-600 hover:underline max-w-[240px] block truncate">
                          {s.seed_topic}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{profile?.email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.data_source ?? 'openalex'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Error sessions */}
        {(errorSessions ?? []).length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Error Sessions</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Topic', 'Message', 'Updated'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(errorSessions ?? []).map((e) => {
                    const session = (e.sessions as unknown as { seed_topic: string } | null)
                    return (
                      <tr key={e.session_id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/session/${e.session_id}`} className="text-blue-600 hover:underline max-w-[200px] block truncate">
                            {session?.seed_topic ?? e.session_id}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[280px] truncate">{e.message ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(e.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </main>
  )
}

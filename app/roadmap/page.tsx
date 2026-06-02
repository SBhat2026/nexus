import Link from 'next/link'
import { CheckCircle2, Loader2, Sparkles, FlaskConical, ArrowLeft } from 'lucide-react'
import NexusLogo from '@/components/NexusLogo'
import AuthButton from '@/components/AuthButton'
import { ROADMAP, type RoadmapStatus } from '@/lib/roadmap'

export const metadata = {
  title: 'Roadmap — Nexus',
  description: 'What\'s shipped, what\'s in progress, and what\'s coming next for Nexus.',
}

const STATUS_META: Record<RoadmapStatus, { label: string; Icon: React.ElementType; pillClasses: string; dotClasses: string; description: string }> = {
  'in-progress': {
    label: 'In Progress',
    Icon: Loader2,
    pillClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClasses: 'bg-blue-500',
    description: 'Actively being built right now.',
  },
  next: {
    label: 'Next Up',
    Icon: Sparkles,
    pillClasses: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClasses: 'bg-violet-500',
    description: 'Planned and prioritized. Coming soon.',
  },
  exploring: {
    label: 'Exploring',
    Icon: FlaskConical,
    pillClasses: 'bg-slate-50 text-slate-600 border-slate-200',
    dotClasses: 'bg-slate-400',
    description: 'Ideas we\'re weighing. Tell us if any matter to you.',
  },
  shipped: {
    label: 'Shipped',
    Icon: CheckCircle2,
    pillClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-emerald-500',
    description: 'Live in production. Use them today.',
  },
}

const SECTION_ORDER: RoadmapStatus[] = ['in-progress', 'next', 'exploring', 'shipped']

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-white/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <NexusLogo size={28} />
          <span className="font-semibold text-slate-900">Nexus</span>
        </Link>
        <AuthButton />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="mb-12">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Roadmap</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Where Nexus is headed</h1>
          <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
            Built in the open. Here&apos;s everything we&apos;ve shipped, what we&apos;re working on now,
            and what&apos;s on the horizon. This page updates as the project moves.
          </p>
        </div>

        {SECTION_ORDER.map((status) => {
          const items = ROADMAP.filter((i) => i.status === status)
          if (items.length === 0) return null
          const meta = STATUS_META[status]
          const Icon = meta.Icon

          return (
            <section key={status} className="mb-14">
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-2 h-2 rounded-full ${meta.dotClasses}`} />
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">{meta.label}</h2>
                <span className="text-xs text-slate-400">· {items.length}</span>
              </div>
              <p className="text-sm text-slate-500 mb-5 ml-5">{meta.description}</p>

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white p-5 transition"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-base font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${meta.pillClasses}`}>
                        <Icon className={`w-3 h-3 ${item.status === 'in-progress' ? 'animate-spin' : ''}`} />
                        {item.eta ?? (item.shippedAt
                          ? new Date(item.shippedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : meta.label)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-50 border border-slate-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        <div className="mt-16 p-6 rounded-2xl border border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Have an idea or a feature request?</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Nexus is built for and with researchers. If something&apos;s missing or broken,
            we want to hear about it. Reach out and we&apos;ll either add it to the roadmap or fix it directly.
          </p>
        </div>
      </div>
    </main>
  )
}

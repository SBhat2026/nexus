import Link from 'next/link'
import SeedInput from '@/components/landing/SeedInput'
import NexusLogo from '@/components/NexusLogo'
import PreviewGraph from '@/components/landing/PreviewGraph'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureCards from '@/components/landing/FeatureCards'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 flex flex-col items-center gap-16">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 md:gap-12 items-center">
        {/* Left col: hero + input */}
        <div className="flex flex-col gap-8">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <NexusLogo size={56} />
              <span className="text-4xl font-bold tracking-tight text-slate-900">Nexus</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-4 leading-tight">
              The Google Maps<br />
              <span className="text-blue-600">of research</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed">
              Enter a topic. Nexus maps the surrounding idea-space, clusters related work,
              flags outliers, and surfaces research directions.
            </p>
          </div>
          <SeedInput />
          <div className="text-sm text-slate-400">
            <Link href="/about" className="hover:text-slate-600 transition">About Nexus</Link>
          </div>
        </div>

        {/* Right col: preview graph */}
        <div className="hidden md:flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">What you&apos;ll get</p>
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <PreviewGraph />
          </div>
        </div>
      </div>

      <HowItWorks />
      <FeatureCards />
    </main>
  )
}

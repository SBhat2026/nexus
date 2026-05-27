import Link from 'next/link'
import SeedInput from '@/components/landing/SeedInput'
import NexusLogo from '@/components/NexusLogo'
import PreviewGraph from '@/components/landing/PreviewGraph'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureCards from '@/components/landing/FeatureCards'
import AuthButton from '@/components/AuthButton'

export default function HomePage() {
  return (
    <main className="bg-white flex flex-col items-center">
      <div className="absolute top-4 right-4 z-10">
        <AuthButton />
      </div>

      {/* Hero — full-height, content slightly above vertical center */}
      <section className="w-full min-h-screen flex flex-col items-center justify-center px-6 pt-16 pb-32">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center gap-8">
          <div>
            <div className="flex items-center justify-center gap-3 mb-5">
              <NexusLogo size={52} />
              <span className="text-4xl font-bold tracking-tight text-slate-900">Nexus</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-4 leading-tight">
              The Google Maps<br />
              <span className="text-blue-600">of research</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed max-w-lg mx-auto">
              Enter a topic. Nexus maps the surrounding idea-space, clusters related work,
              flags outliers, and surfaces research directions.
            </p>
          </div>

          <div className="w-full">
            <SeedInput />
          </div>

          <div className="text-sm text-slate-400">
            <Link href="/about" className="hover:text-slate-600 transition">About Nexus</Link>
          </div>
        </div>
      </section>

      {/* Preview graph */}
      <section className="w-full max-w-3xl mx-auto px-6 pb-24 flex flex-col items-center gap-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">What you&apos;ll get</p>
        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <PreviewGraph />
        </div>
      </section>

      {/* How it works — scroll-animated */}
      <section className="w-full px-6 pb-24">
        <HowItWorks />
      </section>

      {/* Feature cards — scroll-animated */}
      <section className="w-full px-6 pb-24">
        <FeatureCards />
      </section>

    </main>
  )
}

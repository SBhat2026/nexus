import Link from 'next/link'
import SeedInput from '@/components/landing/SeedInput'
import NexusLogo from '@/components/NexusLogo'
import PreviewGraph from '@/components/landing/PreviewGraph'
import HowItWorks from '@/components/landing/HowItWorks'
import FeatureCards from '@/components/landing/FeatureCards'
import RoadmapSection from '@/components/landing/RoadmapSection'
import ParticleGraphBg from '@/components/landing/ParticleGraphBg'
import AuthButton from '@/components/AuthButton'
import HeroTagline from '@/components/landing/HeroTagline'

export default function HomePage() {
  return (
    <main className="bg-white flex flex-col items-center relative overflow-x-hidden">
      {/* Top nav — sticky, translucent */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-3 flex items-center justify-between bg-white/70 backdrop-blur-md border-b border-slate-100/60">
        <Link href="/" className="flex items-center gap-2">
          <NexusLogo size={26} />
          <span className="font-semibold text-slate-900 tracking-tight">Nexus</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/roadmap"
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition rounded-lg hover:bg-slate-50"
          >
            Roadmap
          </Link>
          <Link
            href="/about"
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition rounded-lg hover:bg-slate-50"
          >
            About
          </Link>
          <Link
            href="/sessions"
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition rounded-lg hover:bg-slate-50"
          >
            Sessions
          </Link>
          <div className="ml-2">
            <AuthButton />
          </div>
        </nav>
      </header>

      {/* Hero — full-height, particle bg behind, content above */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center px-6 pt-16 pb-32 overflow-hidden">
        {/* Animated particle graph background */}
        <div className="absolute inset-0 pointer-events-none">
          <ParticleGraphBg nodeCount={75} connectionRadius={150} mouseRadius={200} />
          {/* Soft fade-out gradient at bottom to blend with following sections */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-white pointer-events-none" />
        </div>

        <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center text-center gap-8 z-10">
          <div>
            <div className="flex items-center justify-center gap-3 mb-5">
              <NexusLogo size={52} />
              <span className="text-4xl font-bold tracking-tight text-slate-900">Nexus</span>
            </div>
            <HeroTagline />
            <p className="text-lg text-slate-500 leading-relaxed max-w-lg mx-auto mt-4">
              Enter a topic. Nexus maps the surrounding idea-space, clusters related work,
              flags outliers, and surfaces research directions.
            </p>
          </div>

          <div className="w-full">
            <SeedInput />
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/about" className="hover:text-slate-600 transition">About</Link>
            <span className="text-slate-200">·</span>
            <Link href="/roadmap" className="hover:text-slate-600 transition">Roadmap</Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce-slow opacity-50 hover:opacity-100 transition-opacity">
          <div className="w-5 h-8 rounded-full border-2 border-slate-400 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-slate-400 animate-scroll-dot" />
          </div>
        </div>
      </section>

      {/* Preview graph */}
      <section className="w-full max-w-3xl mx-auto px-6 pb-24 flex flex-col items-center gap-4 relative">
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

      {/* Roadmap section */}
      <section className="w-full px-6 pb-24">
        <RoadmapSection />
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <NexusLogo size={18} />
            <span>Nexus · The research navigator</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/roadmap" className="hover:text-slate-600 transition">Roadmap</Link>
            <Link href="/about" className="hover:text-slate-600 transition">About</Link>
            <Link href="/sessions" className="hover:text-slate-600 transition">Sessions</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

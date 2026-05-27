/**
 * Smoke test: POST /api/session/create for each of the 10 test seeds.
 * Validates response shape and prints a latency/cluster table.
 *
 * Usage:
 *   npx tsx scripts/smokeTestSeeds.ts
 *   BASE_URL=https://nexusresearch.xyz npx tsx scripts/smokeTestSeeds.ts
 */

import { SEED_TOPIC_STRINGS } from '../lib/testSeeds'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

interface Result {
  topic: string
  status: 'ok' | 'fail'
  nPapers: number
  nClusters: number
  nOutliers: number
  latencyMs: number
  error?: string
}

async function testSeed(topic: string): Promise<Result> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedTopic: topic }),
    })
    const latencyMs = Date.now() - start
    const data = await res.json()

    if (!res.ok || data.error) {
      return { topic, status: 'fail', nPapers: 0, nClusters: 0, nOutliers: 0, latencyMs, error: data.error ?? `HTTP ${res.status}` }
    }

    const graph = data.graph
    const nPapers = graph?.nodes?.filter((n: { nodeType: string }) => n.nodeType === 'paper').length ?? 0
    const nClusters = graph?.nodes?.filter((n: { nodeType: string }) => n.nodeType === 'cluster').length ?? 0
    const nOutliers = graph?.nodes?.filter((n: { nodeType: string }) => n.nodeType === 'outlier').length ?? 0

    const ok = nPapers >= 5 && nClusters >= 1
    return {
      topic,
      status: ok ? 'ok' : 'fail',
      nPapers,
      nClusters,
      nOutliers,
      latencyMs,
      error: ok ? undefined : `Low coverage: ${nPapers} papers, ${nClusters} clusters`,
    }
  } catch (err) {
    return {
      topic,
      status: 'fail',
      nPapers: 0,
      nClusters: 0,
      nOutliers: 0,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  console.log(`\nNexus Phase 2 Smoke Test — ${BASE_URL}\n`)
  console.log('Running 10 seeds sequentially (S2 rate limits)…\n')

  const results: Result[] = []

  for (const topic of SEED_TOPIC_STRINGS) {
    process.stdout.write(`  Testing: ${topic.slice(0, 50).padEnd(52)}`)
    const r = await testSeed(topic)
    results.push(r)
    const mark = r.status === 'ok' ? '✓' : '✗'
    process.stdout.write(`${mark}  ${r.latencyMs}ms  papers=${r.nPapers} clusters=${r.nClusters} outliers=${r.nOutliers}`)
    if (r.error) process.stdout.write(`  ⚠ ${r.error}`)
    process.stdout.write('\n')

    // Space out requests to respect S2 rate limit
    if (SEED_TOPIC_STRINGS.indexOf(topic) < SEED_TOPIC_STRINGS.length - 1) {
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  const passed = results.filter((r) => r.status === 'ok').length
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length)

  console.log('\n─────────────────────────────────────────────────────')
  console.log(`  ${passed}/${results.length} passed  |  avg latency: ${avgLatency}ms`)
  if (passed < results.length) {
    console.log('  Failed seeds:')
    results.filter((r) => r.status === 'fail').forEach((r) => {
      console.log(`    • ${r.topic}: ${r.error}`)
    })
  }
  console.log()
  process.exit(passed === results.length ? 0 : 1)
}

main()

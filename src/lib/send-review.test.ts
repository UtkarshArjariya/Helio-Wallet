import { describe, expect, it } from 'vitest'
import { analyzeSmartTransactionReview } from '@helio/solana'
import { buildSmartAnalysisInput } from './send-review'

/** Convenience: run the real engine over a built input. */
function review(args: Parameters<typeof buildSmartAnalysisInput>[0]) {
  return analyzeSmartTransactionReview(buildSmartAnalysisInput(args))
}

const ZERO_PRIORITY = [{ slot: 0, feeLamports: 0 }]
const RENT = 890_880

describe('buildSmartAnalysisInput → analyzeSmartTransactionReview (native SOL)', () => {
  it('shapes the engine input as a native-SOL send', () => {
    const input = buildSmartAnalysisInput({
      amountLamports: 1_000_000,
      senderSolBalanceLamports: 10_000_000,
      rentExemptionReserveLamports: RENT,
      recentPriorityFeeSamples: ZERO_PRIORITY,
      solUsdPrice: 150,
      simulationWarning: null,
    })
    expect(input.asset.kind).toBe('native-sol')
    expect(input.asset.symbol).toBe('SOL')
    expect(input.requestedAmount.amountAtomic).toBe('1000000')
    expect(input.estimatedNetworkFeeLamports).toBe(5_000)
  })

  it('returns "ready" when the balance comfortably covers amount + fees + rent', () => {
    const r = review({
      amountLamports: 1_000_000,
      senderSolBalanceLamports: 10_000_000,
      rentExemptionReserveLamports: RENT,
      recentPriorityFeeSamples: ZERO_PRIORITY,
      solUsdPrice: 150,
      simulationWarning: null,
    })
    expect(r.status).toBe('ready')
    expect(r.adjustedAmount.amountAtomic).toBe('1000000')
  })

  it('reduces the amount ("adjusted") to preserve rent + fees', () => {
    const r = review({
      amountLamports: 1_000_000,
      senderSolBalanceLamports: 1_500_000, // not enough to also keep rent + fee
      rentExemptionReserveLamports: RENT,
      recentPriorityFeeSamples: ZERO_PRIORITY,
      solUsdPrice: 150,
      simulationWarning: null,
    })
    expect(r.status).toBe('adjusted')
    expect(Number(r.adjustedAmount.amountAtomic)).toBeLessThan(1_000_000)
    expect(Number(r.adjustedAmount.amountAtomic)).toBe(1_500_000 - (5_000 + RENT))
    expect(r.reasons.some(x => x.code === 'rent-exemption')).toBe(true)
  })

  it('blocks when simulation reported an error', () => {
    const r = review({
      amountLamports: 1_000_000,
      senderSolBalanceLamports: 10_000_000,
      rentExemptionReserveLamports: RENT,
      recentPriorityFeeSamples: ZERO_PRIORITY,
      solUsdPrice: 150,
      simulationWarning: 'Insufficient SOL to keep the account rent-exempt.',
    })
    expect(r.status).toBe('blocked')
    expect(r.reasons.some(x => x.code === 'simulation-warning')).toBe(true)
  })

  it('blocks when the wallet cannot even cover fees + rent', () => {
    const r = review({
      amountLamports: 1_000_000,
      senderSolBalanceLamports: 500_000,
      rentExemptionReserveLamports: RENT,
      recentPriorityFeeSamples: ZERO_PRIORITY,
      solUsdPrice: 150,
      simulationWarning: null,
    })
    expect(r.status).toBe('blocked')
    expect(r.reasons.some(x => x.code === 'insufficient-sol-for-fees')).toBe(true)
  })
})

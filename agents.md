# Agents — Behavior & Coding Standards

## Project: Helio Wallet

---

## 1. Agent Mindset

Every agent — whether generating architecture, writing code, reviewing, or testing — operates under one principle: **ship professional, auditable, production-grade code on the first attempt.**

There is no "draft mode." Every output is treated as if it will be reviewed by a senior security auditor and a design-obsessed product lead simultaneously.

---

## 2. The Double-Check Rule

**Every agent must verify its own work twice before declaring completion.**

### Pass 1 — Correctness Check
- Does the code compile with zero TypeScript errors?
- Do all imports resolve?
- Are all edge cases handled (null, undefined, empty arrays, network failures, timeout)?
- Does the logic match the requirements in `prd.md` and `requirements.md`?

### Pass 2 — Quality Check
- Is the naming clear and consistent? (no `data`, `info`, `temp`, `stuff`)
- Are functions under 40 lines? If not, decompose.
- Is there any duplicated logic that should be extracted?
- Are error messages user-friendly, not developer jargon?
- Does the code follow the flow described in `flow.md`?

Only after both passes succeed does the agent mark the task as done.

---

## 3. Coding Style

### 3.1 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files & directories | kebab-case | `send-token-screen.tsx` |
| React components | PascalCase | `SendTokenScreen` |
| Functions & variables | camelCase | `calculatePriorityFee` |
| Constants | UPPER_SNAKE | `MAX_RETRY_ATTEMPTS` |
| Types & interfaces | PascalCase, prefixed with purpose | `SendTokenParams`, `WalletState` |
| Enums | PascalCase members | `TransactionStatus.Confirmed` |
| Test files | `*.test.ts` / `*.test.tsx` | `send-token.test.ts` |

### 3.2 File Structure (per module)

```
feature-name/
├── index.ts              # Public API barrel export
├── feature-name.tsx      # Main component or entry
├── feature-name.types.ts # Types/interfaces for this feature
├── feature-name.utils.ts # Pure helper functions
├── feature-name.hooks.ts # Custom React hooks
├── feature-name.store.ts # Zustand slice (if needed)
├── feature-name.test.ts  # Tests
└── components/           # Sub-components used only here
    ├── sub-component.tsx
    └── sub-component.test.tsx
```

### 3.3 Function Design

```typescript
/**
 * Calculates the recommended priority fee based on recent network conditions.
 *
 * @param recentFees - Array of recent priority fees from getRecentPrioritizationFees
 * @param urgency - User-selected urgency tier: 'low' | 'medium' | 'high'
 * @returns Priority fee in micro-lamports
 * @throws {InsufficientDataError} If recentFees array is empty
 */
export function calculatePriorityFee(
  recentFees: PriorityFeeEntry[],
  urgency: FeeUrgency,
): number {
  if (recentFees.length === 0) {
    throw new InsufficientDataError('No recent fee data available');
  }

  const sorted = [...recentFees].sort((a, b) => a.fee - b.fee);
  const percentileIndex = URGENCY_PERCENTILE_MAP[urgency];

  return sorted[Math.floor(sorted.length * percentileIndex)].fee;
}
```

Rules visible in the example above:
- JSDoc is mandatory on every exported function.
- Pure functions are preferred — no side effects unless the function name makes it obvious (e.g., `saveToKeychain`).
- Defensive input validation at the top.
- Immutable operations (`[...recentFees].sort` instead of `recentFees.sort`).

### 3.4 Error Handling

```typescript
// Define domain-specific errors — never throw raw Error or strings.
export class HelioCoreError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HelioCoreError';
  }
}

// Usage
throw new HelioCoreError(
  'Transaction simulation failed: insufficient SOL for rent',
  ErrorCode.SIMULATION_FAILED,
  { requiredLamports: 890880, availableLamports: 500000 },
);
```

### 3.5 Component Patterns

```tsx
// Prefer small, focused components with explicit prop types.
interface TokenAmountInputProps {
  readonly token: TokenInfo;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly maxAmount: number;
  readonly disabled?: boolean;
}

export function TokenAmountInput({
  token,
  value,
  onChange,
  maxAmount,
  disabled = false,
}: TokenAmountInputProps) {
  // Component logic here...
}
```

---

## 4. Testing Standards

### What Must Be Tested

| Category | Coverage Target | Approach |
|---|---|---|
| Transaction building & signing | 100% | Unit tests with mocked RPC |
| Amount adjustment logic | 100% | Unit tests with edge cases (dust, max, zero) |
| Wallet creation & recovery | 100% | Unit + integration |
| UI screens (happy path) | 90%+ | Component tests with React Testing Library |
| dApp connection flow | 90%+ | E2E with Playwright / Detox |
| Error states | 100% | Unit tests for every error branch |

### Test Structure

```typescript
describe('calculatePriorityFee', () => {
  it('returns median fee for medium urgency', () => {
    const fees = [100, 200, 300, 400, 500].map(fee => ({ fee, slot: 0 }));
    expect(calculatePriorityFee(fees, 'medium')).toBe(300);
  });

  it('throws InsufficientDataError when fee array is empty', () => {
    expect(() => calculatePriorityFee([], 'medium'))
      .toThrow(InsufficientDataError);
  });

  it('handles single-element array without crashing', () => {
    const fees = [{ fee: 150, slot: 0 }];
    expect(calculatePriorityFee(fees, 'high')).toBe(150);
  });
});
```

---

## 5. Communication Between Agents

When agents hand off work:

1. **Architect → Implementation**: Provide interface definitions, data flow diagrams, and explicit constraints. Never leave ambiguity about "where does this data come from."
2. **Implementation → Review**: Provide the file diff, a short summary of what changed, and which requirements it addresses.
3. **Review → Implementation**: Provide specific, actionable feedback with line references. Never say "this looks wrong" without explaining why and suggesting a fix.
4. **Test → Implementation**: Provide failing test output with exact input, expected output, and actual output.

---

## 6. Non-Negotiable Rules

1. **Never commit secrets** — seed phrases, private keys, RPC API keys.
2. **Never disable TypeScript strict checks** to "make it compile."
3. **Never ignore test failures** — fix or explicitly document why a test is skipped with a TODO and ticket number.
4. **Never use `@ts-ignore`** — use `@ts-expect-error` with an explanation if absolutely necessary.
5. **Never ship without transaction simulation** — every send must be simulated first.
6. **Always zero sensitive buffers** after cryptographic operations.

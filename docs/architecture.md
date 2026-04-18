# Architecture Notes

Temporary draft. Replace this later with linked diagrams and more detailed flow-specific views.

```mermaid
flowchart TD
    extension[Chrome extension app]
    mobile[Mobile app]

    subgraph shared[Shared packages]
        core[@helio/core]
        solana[@helio/solana]
        api[@helio/api]
        types[@helio/types]
        ui[@helio/ui]
    end

    extension --> core
    extension --> solana
    extension --> api
    extension --> types
    extension --> ui

    mobile --> core
    mobile --> solana
    mobile --> api
    mobile --> types
    mobile --> ui

    solana --> helius[Helius RPC]
    api --> jupiter[Jupiter APIs]
    api --> blowfish[Blowfish]
```

## Current split

- `web` owns browser wallet UX and dApp connection surfaces.
- `mobile` owns onboarding, biometric unlock, and mobile-specific flows.
- `packages/core` is for key management and security-sensitive wallet logic.
- `packages/solana` is for transaction building, simulation, and smart adjustment rules.
- `packages/api` is for external integrations like price, validator, and swap data.
- `packages/types` holds shared domain types used across apps and packages.

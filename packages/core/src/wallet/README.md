## Wallet Vault

This module contains the extension-safe wallet primitives:

- mnemonic generation and validation
- Solana account derivation
- private key import parsing
- password-based vault encryption and decryption
- mnemonic export after re-authentication

Sensitive byte arrays are zeroed as soon as they are no longer required.

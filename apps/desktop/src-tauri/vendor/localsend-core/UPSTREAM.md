# Vendored LocalSend Core

- Upstream: https://github.com/localsend/localsend
- Revision: `af0416be50770a97760f7070684bc667b759a15c`
- Source subtree: `packages/core`
- License: Apache-2.0; see `LICENSE-UPSTREAM`

Only the Rust protocol core is vendored. This keeps Eclipse Chat builds
reproducible without downloading LocalSend's unrelated Flutter submodule.

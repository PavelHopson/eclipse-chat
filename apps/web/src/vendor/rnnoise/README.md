# RNNoise vendored release

This is a lazy-loaded, local-only microphone denoiser, not a cloud service.
Screen-share audio never goes through this processor.

- Wrapper source: https://github.com/shiguredo/rnnoise-wasm
- Release: `2025.1.5`; source commit `318dfdecdc2ddf3b33fe01a89ed8273ba0374ddc`
- Release asset: `rnnoise.js`, GitHub asset ID `253102983`
- Original SHA-256: `e6958293a0118bf9860cb2753332f7562531cc987c914552c426cd7d7180a63e`
- Patched SHA-256: `02e92391af6e1e7c942ae9958e7b3fcb16c22a9a3a4c7d446de34dc8b64d5f24`
- RNNoise source pinned by upstream `build-rnnoise.sh`: `https://github.com/xiph/rnnoise`, commit `70f1d256acd4b34a572f999a05c87bf00b67730d`
- Wrapper license: Apache-2.0, in `public/third-party/RNNOISE-WASM-LICENSE.txt`
- RNNoise license: BSD-3-Clause, in `public/third-party/RNNOISE-LICENSE.txt`

One compatibility patch permits the AudioWorklet global (`AudioWorkletProcessor`)
in the loader's environment check. AudioWorklet has WebAssembly but no Window or
WorkerGlobalScope. No model/code changes. The regression test reconstructs and
checks the original asset's hash, and rejects network/eval primitives.
Scoped Git attributes preserve LF bytes and tolerate upstream JSDoc trailing
spaces instead of making additional modifications to the pinned vendor files.

The release embeds its WASM/model in JavaScript (~4.8 MB before HTTP compression).
No CDN, runtime download, install script, microphone recording or telemetry.
Vite bundles it as an ES worklet; the app CSP permits only WASM compilation via
`wasm-unsafe-eval`, never JavaScript `unsafe-eval`.

`sbom.cdx.json` supplements the npm SBOM: vendored WASM does not appear in npm
audit. Source/license/hash review does not constitute reproducible-build proof
or an independent native/WASM vulnerability scan. Validate updates explicitly;
do not replace the asset from an unpinned latest release.

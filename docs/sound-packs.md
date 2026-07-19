# Eclipse Chat sound packs

## Purpose

Eclipse Chat uses local notification sounds to make important events obvious without forcing the user to watch every room:

- new channel activity outside focus;
- direct messages;
- mentions;
- task and approval signals;
- voice room join and leave events.

The first implementation is generated with Web Audio so the app works without external files, CDNs, or network latency. Generated assets from tools such as MOSS SoundEffect can be added later as a sound pack, but the product must keep the same event semantics.

## Current packs

- `Eclipse Signal` — default branded sci-fi pack. Slightly deeper and more cinematic, tuned for voice rooms and operational alerts.
- `Soft Signal` — quiet fallback pack for long working sessions.

Both packs are short, rate-limited, and controlled from Settings -> Notifications and Sound.

## Asset pack contract

If we replace or extend Web Audio with real generated audio files, create exactly one file per event:

- `message`
- `mention`
- `dm`
- `task`
- `voiceJoin`
- `voiceLeave`

Recommended target:

- duration: 120-420 ms;
- loudness: normalized, no harsh peaks;
- format: `ogg` or `webm` first, optional `mp3` fallback;
- size: below 50 KB per event;
- storage: `apps/web/public/sounds/<pack-id>/`;
- loading: preload after first user interaction, never block app start;
- fallback: if a file fails, use the Web Audio pattern for the same event.

## Design rules

- Voice join must be clearly different from voice leave.
- Mention and DM must be more noticeable than ordinary channel messages.
- Task sounds can be firmer, but never alarm-like unless severity is critical.
- No long musical stingers. The chat is an operational tool, not a slot machine.
- Keep sounds usable at low volume and tolerable during multi-hour calls.

## Safety and licensing

- Do not commit audio generated from copyrighted references unless the license is explicit.
- Do not use cloned voices, recognizable brand sounds, or samples from games/movies.
- Keep all production assets local to the app bundle; no remote sound CDN.
- Review generated packs on laptop speakers and headphones before release.

## QA checklist

- Fresh user gets a working default pack without opening settings.
- Existing user settings survive deploys and missing new fields are normalized.
- Toggle off means no local sound plays.
- Browser push stays `silent: true`; Eclipse Chat owns the sound layer.
- Voice presence snapshot does not trigger join spam on initial room load.
- Reduced-motion users are not forced into animated sound UI effects.

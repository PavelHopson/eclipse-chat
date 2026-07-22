# Public profiles

Eclipse Chat `v1.7.13` adds one profile surface for browser, Tauri desktop and the Android Capacitor wrapper. Both native shells load the production web client, so they receive this UI without a native release.

## Product behavior

- Click an avatar or name in a message, member list, friend list, direct-message header or voice room to open the same profile.
- The profile shows only presentation data: display name, avatar, cover, bio, activity, visible presence, workspace role and dates, plus owner-curated images.
- The next action is explicit: `Настроить профиль` for the current account or `Написать сообщение` for an accessible teammate.
- Account settings provide a live preview and separate actions for avatar, cover and gallery. Destructive actions require confirmation.
- The gallery supports keyboard arrows, `Escape`, touch targets and narrow Android layouts. Reduced-motion settings disable decorative profile motion.

## Access boundary

`GET /api/users/:userId/profile` requires authentication and one of these relationships:

- the viewer is opening their own profile;
- both accounts belong to the requested workspace;
- the accounts are accepted friends;
- both accounts already share a direct or group conversation.

Blocked relationships cannot start a message. Without a shared workspace they cannot use an old conversation to recover profile access. Missing and inaccessible profiles return the same `404` response to reduce account enumeration.

The response intentionally excludes email, password data, 2FA state, quiet hours, timezone, login sessions and moderation metadata.

## Media security

- Uploads are limited to 20 MB and supported image MIME types.
- Sharp decodes the file, enforces a 60 MP input ceiling, strips source metadata and writes WebP.
- Covers are cropped to `1600x600`; gallery images fit inside `1600x1600` without upscaling.
- Filenames use random UUIDs. Delete endpoints verify ownership and remove both database records and local files.
- The gallery limit is checked inside a serializable transaction to prevent parallel uploads from exceeding eight images.

## Deploy and QA

Apply `20260722120000_add_public_profiles` with `npx prisma migrate deploy`, build the monorepo and restart the server.

Check these layouts after deploy:

- desktop: 1440x900 and the Tauri minimum window;
- tablet: 1024x768 and 768x1024;
- mobile: 390x844, 360x800 and 320x568;
- keyboard: open profile, media, arrow navigation, `Escape`, visible focus;
- touch: 44px primary controls, scrollable profile, safe-area bottom padding;
- states: loading, inaccessible profile, no bio, no media, full gallery and upload error.

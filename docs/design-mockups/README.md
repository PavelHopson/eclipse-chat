# Design Mockups

Сюда складываются **outputs** от AI Studio / Stitch / Gemini Vision / любых
design-tools. Каждая итерация — в свою подпапку с версией.

## Структура

```
docs/
├── design-prompts/             ← INPUT'ы для AI (prompts + reference HTML)
│   ├── google-ai-studio-prompt.md
│   └── current-state.html
└── design-mockups/             ← OUTPUT'ы от AI (вот эта папка)
    ├── eclipse-os-v1/          ← первая итерация (Pavel 19.05.2026)
    │   ├── README.md           ← описание итерации, что AI прислал
    │   ├── screens/            ← PNG / SVG mockups
    │   ├── html/               ← HTML экспорт если есть
    │   ├── tokens/             ← design tokens (если AI прислал)
    │   └── icons/              ← SVG icon set если есть
    ├── eclipse-os-v2/          ← следующая итерация (когда будет)
    └── ...
```

## Workflow

1. Pavel отправляет prompt из `design-prompts/google-ai-studio-prompt.md`
   в AI Studio + загружает `current-state.html` как reference.
2. AI Studio возвращает mockups (PNG / SVG / HTML / Figma export).
3. Pavel скачивает архив → разархивирует в новую подпапку
   `design-mockups/<iteration-name>/`.
4. Claude / Pavel review'ят содержимое, выбирают что реализовывать
   в реальном Eclipse Chat коде.

## Naming

- `eclipse-os-v1/` — первый round mockups (Eclipse_OS rebrand)
- `eclipse-os-v2/` — improvements / additional screens
- `<feature-name>-<version>/` — если только один экран / feature
  (например `voice-room-v1/`, `auth-screen-v1/`)

## Git policy

Mockups **commited в репо** как reference assets — это часть product
documentation. Сравнения «было / стало» легко через `git log` для
конкретной папки.

Большие файлы (>5MB на изображение) — рассмотреть git-lfs, но пока
мы держимся в разумных пределах.

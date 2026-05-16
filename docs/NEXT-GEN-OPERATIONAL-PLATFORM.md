# Eclipse Chat — Next Generation Operational Platform Roadmap

> Strategic product roadmap, fixed on 2026-05-16.
> This document describes where Eclipse Chat is going after the current
> operational chat foundation. Tactical version history remains in
> `ROADMAP.md`.

## Product North Star

Eclipse Chat is not a Discord clone, Slack clone, or Telegram clone.

Eclipse Chat is an **operational collaboration infrastructure** where:

- communication
- execution
- AI
- memory
- workflows
- collaboration

work as one system.

The target formula:

**communication + execution + AI + memory + workflows**

The product should feel like a calm command center for modern teams:
private, fast, structured, intelligent, and focused on outcomes.

## Product Rule

Every major feature must answer one question:

**Does this turn communication into execution, memory, or control?**

If the answer is no, it is either low priority or does not belong in the
core product.

## Current Foundation

Already implemented in the current product line:

- Auth, profiles, workspaces/servers, members, invites.
- Text, voice, broadcast rooms.
- Markdown, code, mentions, replies, reactions, edit/delete, pins,
  attachments, search.
- Direct messages and Saved Messages.
- LiveKit voice, camera, screen share, speaker states, quality controls.
- Threads.
- Action items: task, decision, follow-up.
- Status Board and Team Health.
- Client Mode with internal room visibility.
- AI summaries, since-last-visit memory, role-aware AI mentions.
- Bot taxonomy: moderator, PM, knowledge, sales, generic.
- Home command center and Intelligence Panel.
- Operational dark design system, motion layer, responsive shell.

The next stage is not "more chat features". The next stage is turning
Eclipse Chat into a **workspace operating layer**.

## Platform Layers

### 1. Core Chat System

Goal: reach "daily driver" quality before adding heavy platform layers.

Existing:

- Markdown, code blocks, replies, reactions.
- Edit/delete, pinned messages.
- Uploads and drag/drop base.
- Threads.
- Smooth message mount animation.

Needed:

- Link embeds and rich previews.
- Media viewer with image/video gallery.
- Voice messages.
- Unread markers and jump-to-latest.
- Draft syncing per room and DM.
- Better thread unread states.
- Better long-message/code UX.
- **Full file taxonomy in uploads** — beyond current images / PDF /
  zip / video / audio coverage, accept Office documents (docx, xlsx,
  pptx, odt, csv), all common archive formats (rar, 7z, tar, gz),
  and extended video formats (mkv, avi). Add magic-bytes MIME
  sniffing (do not trust client-declared `mimeType`), raise video
  cap (currently 50MB across the board) with synced nginx
  `client_max_body_size`, and per-extension iconography in the
  attachment chip UI.

### 2. Workspaces & Rooms

Product language should move from "servers/channels" toward:

- Workspaces.
- Rooms.
- Operational environments.

Room types:

- Text rooms.
- Voice rooms.
- Execution rooms.
- AI rooms.
- Client rooms.
- Announcement rooms.
- Temporary rooms.
- Focus rooms.

Implementation note:

- Current `Server`/`Channel` names can remain in database short term.
- UI copy and component naming can migrate first.
- True room-type expansion should be additive to the current `Channel.type`
  model.

### 3. Advanced Role System

Goal: roles become operational identity, not just moderation rights.

Target roles:

- Owner.
- Admin.
- Moderator.
- Architect.
- Developer.
- Operator.
- Client.
- Viewer.
- AI Agent.
- Observer.
- Guest.

Permission groups:

- Room visibility.
- AI access.
- File permissions.
- Execution actions.
- Moderation permissions.
- Task management.
- Approval permissions.
- Bot management.
- Analytics access.

UI layer:

- Role hierarchy view.
- Role colors.
- Glow/status indicators.
- Badges.
- Live state markers.

Implementation priority:

1. Define permission matrix in shared types.
2. Keep existing roles backward-compatible.
3. Add role capabilities as additive flags.
4. Add UI only after backend checks are real.

### 4. Operational Tables

This is a major differentiator.

Goal: tables/databases live inside chat as operational surfaces, not as
separate Notion-like pages.

Capabilities:

- Editable tables.
- Inline editing.
- Statuses.
- Filters.
- Sorting.
- Relations.
- Linked rooms.
- Linked tasks.
- Linked messages.
- Linked decisions.
- Basic formulas.

Table types:

- Task tables.
- CRM/lead tables.
- Construction objects.
- Logistics.
- Bug tracking.
- Approvals.
- Knowledge databases.

AI + tables:

- Fill rows from conversation.
- Summarise table state.
- Detect problems.
- Generate rows.
- Classify imported data.

Implementation shape:

- Start with generic `Table`, `TableField`, `TableRow`, `TableCell`.
- Keep formulas basic at first.
- Link rows to existing `ActionItem`, `Message`, `Channel`, `Incident`.
- Do not build a full Airtable clone in the first slice.

### 5. AI Operational Agents

Not Discord bots.

Agents are operational participants with memory, permissions, triggers,
and domain-specific behavior.

Agent types:

- Moderator Agent: spam, toxicity, conflict detection, moderation
  suggestions.
- PM Agent: task tracking, follow-ups, blockers, deadlines.
- Knowledge Agent: room memory, links discussions, architecture memory,
  semantic search.
- Sales Agent: lead summaries, proposals, onboarding, PDF generation.
- Support Agent: FAQ, routing, AI helpdesk.
- Architect Agent: technical summaries, architecture suggestions,
  documentation.

Principles:

- Agents must be visible enough to trust, quiet enough not to spam.
- AI should create structure, not noise.
- Every agent action needs permissions and auditability.

### 6. Bot Builder System

Goal: users create custom operational agents without writing code.

Capabilities:

- Custom bots.
- Custom prompts.
- Workflow chains.
- Room access.
- Permissions.
- Memory settings.
- Triggers.
- Automation actions.

Bot actions:

- Send messages.
- Generate tasks.
- Create summaries.
- Moderate.
- Update tables.
- Send notifications.
- Generate reports.

Editor UI:

- Visual node system.
- Trigger builder.
- Workflow editor.
- Drag/drop logic.

Implementation warning:

- Do not start with a complex node editor.
- Start with a structured form builder:
  trigger -> conditions -> action.
- Move to visual nodes after workflow primitives are stable.

### 7. Execution System

Goal: every important message can become an entity.

Message -> entity:

- Task.
- Decision.
- Reminder.
- Issue.
- Requirement.
- Approval.
- Risk.

Tasks:

- Kanban.
- Priorities.
- Due dates.
- Assignees.
- Linked discussions.
- AI summaries.
- Dependencies.

Decisions:

- Approval states.
- History.
- Linked messages.
- Timestamps.
- Owners.

Follow-ups:

- Reminders.
- Escalation.
- Unresolved detection.

Current foundation:

- ActionItem exists for task/decision/follow-up.
- Status Board and Team Health exist.

Next:

- Add entity detail view.
- Add dependencies.
- Add approvals.
- Add reminders/escalations.
- Add AI unresolved detector.

### 8. AI Memory System

Goal: the system remembers the work, not just stores messages.

Room memory:

- Discussions.
- Decisions.
- Files.
- Architecture.
- Workflows.
- Unresolved items.

Digest:

- "Since you were away".
- What changed.
- What was approved.
- Blockers.
- Tasks.
- Important discussions.

Semantic search:

- "Where did we discuss auth architecture?"
- "Show unresolved construction tasks."
- "What decisions were made about pricing?"

Implementation layers:

1. Structured memory from existing entities.
2. Embeddings for messages/files/entities.
3. Cross-room knowledge graph.
4. Agent memory with permissions.

### 9. Voice & Live Collaboration

Voice should become a live execution workspace.

Voice system:

- Live voice.
- Speaker detection.
- Noise suppression.
- Adaptive layouts.
- Screen sharing.
- Video calls.
- Recording.
- **Concurrent multi-publisher streams.** Every participant in a voice
  room can publish camera and screen share simultaneously — not just
  one screen at a time. The grid layout, hooks and LiveKit room
  config must hold up under 6+ live video tiles with mixed camera +
  screen sources, with graceful auto-collapse / pinning when the tile
  count exceeds the viewport budget. This is what turns voice rooms
  into real review/whiteboard sessions instead of one-presenter
  meetings.

AI transcription:

- Speech-to-text.
- Live summaries.
- Decision extraction.
- Action item extraction.

Live workspace:

- Notes.
- Whiteboard.
- Architecture diagrams.
- Tasks.
- AI capture.

Next priority:

- Stabilize screen/video UX.
- Add transcription capture.
- Convert voice summary into tasks/decisions.

### 10. Client Portals

Major business feature.

Client rooms show:

- Project progress.
- Approvals.
- Invoices.
- Files.
- Summaries.
- Reports.
- Deliverables.

Internal discussions stay hidden.

AI client assistant:

- Onboarding.
- Summaries.
- Reports.
- Updates.

Implementation:

- Current Client Mode is the base.
- Next step is external-facing project room templates.
- Then approvals/reporting.
- Invoices should wait until billing model is clearer.

### 11. Admin Panel

Workspace admin:

- Rooms.
- Roles.
- Permissions.
- Analytics.
- Moderation.
- Integrations.
- AI controls.

AI management:

- Agents.
- Prompts.
- Memory.
- Permissions.
- Execution rights.

System analytics:

- Room activity.
- Unresolved discussions.
- Response time.
- AI usage.
- Execution health.

Rule:

- Admin panel should expose real controls only.
- No dead dashboard widgets.

### 12. Automation System

Triggers:

- New message.
- New task.
- Approval.
- File upload.
- Voice session.
- Mention.

Actions:

- Create task.
- Notify.
- Generate summary.
- Update table.
- Generate PDF.
- Send webhook.

Integrations:

- Telegram.
- WhatsApp.
- Discord.
- GitHub.
- GitLab.
- Notion.
- Google Docs.
- Bitrix.
- 1C.
- CRM systems.

Implementation:

- Start with webhook engine.
- Add Telegram bridge next.
- Use typed integration capabilities, not ad-hoc scripts.

### 13. Design & UX

Visual direction:

- Calm operational UI.
- Cinematic depth.
- Premium system feeling.
- Layered blacks.
- Ambient glows.
- Soft telemetry.
- Smooth motion.

Motion language:

- Speaking glow.
- AI thinking wave.
- Ambient transitions.
- Signal pulse.
- Operational feedback.

Adaptive room modes:

- Chat mode.
- Voice mode.
- Client mode.
- Focus mode.
- Execution mode.

Design rule:

- The UI should feel like entering a system, not opening another chat app.
- Motion must clarify state, not entertain.

### 14. Mobile Experience

Critical.

Goal:

- Telegram-level speed.
- Gesture-friendly navigation.
- Fast uploads.
- Instant transitions.
- Smooth scrolling.
- Voice-first support.

Mobile priorities:

- Better room switch gestures.
- Bottom navigation experiments.
- Mobile composer polish.
- Voice room mobile controls.
- Upload progress and media viewer.

### 15. Operational Dashboard

Home is not a server list.

Home is Command Center:

- Active rooms.
- AI alerts.
- Blockers.
- Tasks.
- Approvals.
- Live calls.
- Execution health.

Current foundation:

- Home Today already exists.

Next:

- Live updates.
- AI alerts.
- Cross-workspace blockers.
- Approval queue.
- Room health cards.

### 16. Advanced Features

Room health:

- Activity.
- Unresolved issues.
- Overload detection.
- AI insights.

Focus mode:

- Hide noise.
- Show execution-critical info.

Temporary rooms:

- Auto-generated meeting/workflow rooms.
- Expire/archive policy.

Replay timeline:

- Messages.
- Decisions.
- Files.
- Approvals.
- Summaries.

### 17. Long-Term Platform

Agent marketplace:

- Install AI agents into workspaces.

Workflow marketplace:

- Support templates.
- Sales templates.
- Construction templates.
- CRM templates.
- Operations templates.

Industry runtimes:

- Construction runtime.
- Agency runtime.
- Startup runtime.
- Support runtime.

## Execution Phases

### Phase 0 — Stabilize the Daily Driver

Immediate goal: make the current product feel reliable enough for daily
team work.

Priority slices:

1. Unread markers and jump-to-latest.
2. Draft syncing.
3. Media viewer.
4. Voice messages.
5. Link embeds.
6. Mobile composer and room navigation polish.
7. Group DMs.
8. Better thread unread states.

### Phase 1 — Execution Core

Goal: message -> entity becomes the core habit.

Priority slices:

1. Action entity detail drawer.
2. Task priorities, due dates, dependencies.
3. Decision approval states.
4. Reminders and escalation.
5. Execution room type.
6. Room health v1.
7. Command Center v2.

### Phase 2 — Memory & Search

Goal: Eclipse Chat remembers what matters.

Priority slices:

1. Semantic search.
2. Cross-room memory index.
3. File memory.
4. Architecture/decision memory.
5. Since-you-were-away v2.
6. AI unresolved detector.

### Phase 3 — Operational Tables

Goal: teams can run work inside chat.

Priority slices:

1. Table schema.
2. Table room UI.
3. Inline editing.
4. Filters/sorting/statuses.
5. Relations to messages/tasks/decisions.
6. AI table fill/classify/summarise.

### Phase 4 — AI Agents & Automation

Goal: agents act inside the operational system.

Priority slices:

1. Agent permissions.
2. Agent memory settings.
3. Trigger/action automation engine.
4. Bot builder v1 form editor.
5. AI agent audit log.
6. Telegram/GitHub integrations.

### Phase 5 — Client Portals & Admin

Goal: make Eclipse Chat commercially useful for agencies, product teams,
construction, support and operations.

Priority slices:

1. Client workspace templates.
2. Approval flows.
3. Deliverables/files/reports.
4. Admin role/permission UI.
5. AI client assistant.
6. System analytics.

### Phase 6 — Marketplace & Verticals

Goal: industry runtimes and reusable workflows.

Priority slices:

1. Agent marketplace architecture.
2. Workflow template marketplace.
3. Construction runtime.
4. Agency runtime.
5. Support runtime.

## Near-Term Build Queue

The next concrete engineering queue should be:

1. **Unread + jump-to-latest + draft sync** — finish daily chat ergonomics.
2. **Media viewer + voice messages** — close core communication gaps.
3. **Group DMs** — extend existing DM model.
4. **Workspace/Room language pass** — move UI away from Discord vocabulary.
5. **Role architecture v2** — permission matrix and visual hierarchy.
6. **Execution entity detail drawer** — make tasks/decisions first-class.
7. **Approvals** — required for client portals and decisions.
8. **Semantic search v1** — query messages/action items/files by meaning.
9. **Voice transcription prototype** — voice -> decisions/tasks.
10. **Operational tables schema spike** — validate database model before UI.

## Non-Goals For Now

- Do not build a full Airtable clone before execution entities mature.
- Do not build a complex visual node editor before trigger/action primitives
  are stable.
- Do not add marketplace features before admin/permissions are real.
- Do not over-dashboard the interface. Calm control beats noisy metrics.
- Do not ship AI actions without auditability and permissions.

## Definition Of Success

Eclipse Chat wins when a team can open one workspace and see:

- what is being discussed,
- what was decided,
- what needs action,
- who owns it,
- what changed while they were away,
- which process is blocked,
- what the AI agents already handled,
- and what should happen next.

That is the product.

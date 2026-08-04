# Eclipse Command Fabric

Command Fabric is the product layer that connects communication, execution,
reviewed memory, AI and external Eclipse Forge services without hiding actions
from the user.

## Product rules

- Every AI conclusion must expose its source or say that no source exists.
- Retrieved messages and memory are untrusted data, never system instructions.
- Reading follows workspace membership and room visibility rules.
- AI suggestions remain drafts until the user confirms a write operation.
- Expensive retrieval and generation endpoints are authenticated, bounded and
  rate-limited.
- Missing embedding providers degrade search to lexical mode instead of breaking
  the main workflow.

## v1.7.23 slice

The first slice adds confirmed memory to the structured and AI "Since you were
away" digest. Workspace search now combines lexical message matches, message
embeddings and confirmed memory. Results identify whether the evidence is
lexical, semantic or hybrid and provide an exact path back to the source message,
thread, action item or memory panel.

The channel-history endpoint now requires authentication and workspace
membership. Client workspaces keep internal rooms hidden from the external
member role. Search, visit tracking and AI digest generation have explicit input
and request limits.

## v1.7.24 slice

The second slice adds a reviewed `ActionItem -> MemoryEntry` flow. The action
drawer opens a local editable draft, shows the source room and final visibility,
and saves nothing until the user presses the explicit primary action. AI can
improve bounded action fields only after a separate user request.

The server resolves message provenance from the action item instead of trusting
client identifiers. Room history, visits, search, actions and memory now use the
shared `ROOM_VIEW_INTERNAL` permission instead of a legacy role-name check.
Dependency references cannot cross internal/external visibility boundaries,
preventing an open task from revealing a private title. Suggestion and write
endpoints are authenticated and independently rate-limited.

## v1.7.25 slice

The third slice turns confirmed memory into a governed lifecycle. Every new
entry has an explicit owner, room or workspace visibility, a 90-day review
default and optional expiry. The basic create flow keeps these safe defaults
automatic; advanced controls stay in a dedicated editor instead of making the
main path harder.

Archived, expired and review-due entries remain visible to authorized humans but
are excluded from AI retrieval at the database-query boundary. Each card
explains whether AI may use it and why. Archive is reversible, while review
records who confirmed the entry and when.

Only the owner, original creator or a role with `MEMORY_MANAGE` can change the
lifecycle. Internal client-room memory cannot be promoted to workspace scope.
Workspace changes invalidate memory views across the workspace, and every
mutation endpoint is authenticated and rate-limited.

## v1.7.37 slice

Mobile Command Inbox turns the existing personal digest, owner AI approvals,
Action Items and voice presence into one short decision queue. Each card has one
primary action and an explicit source; the interface does not execute hidden
writes or introduce a parallel task system. Desktop keeps the more detailed
Command Brief.

Self-claim is an authenticated atomic transition from unassigned `OPEN` work to
the current user in `IN_PROGRESS`. Membership and internal-room visibility are
rechecked server-side, concurrent claims return `409`, and linked operational
tables receive the same realtime update as the Action Item. Review work assigned
to another person never enters the personal queue.

Active calls come from the existing in-memory voice presence snapshot and are
filtered through the same room ACL before participant names are loaded. This is
correct for the current single server process; a future clustered deployment
must move voice presence to shared state or LiveKit-backed discovery.

## Trust boundaries

1. The server validates JWT and workspace membership before reading room data.
2. Visibility filtering happens in database queries before ranking.
3. Query text, messages, titles, tags and memory content are treated as
   user-controlled data.
4. Prompts explicitly forbid following instructions embedded in retrieved data.
5. The client receives only source identifiers it is already authorized to read;
   source navigation re-checks authorization on the history endpoint.
6. Search errors do not log queries or retrieved content.
7. Archived, expired and review-due memory is filtered before digest or semantic
   retrieval; UI state is not treated as an authorization boundary.
8. Memory ownership and workspace membership are revalidated server-side before
   reassignment, review, archive or restore.

## Current limits

- Memory uses lexical scoring plus the embedding of its linked source message.
  Dedicated memory embeddings and a vector index are required before large-scale
  workspaces.
- A source inside a thread opens the correct thread, but v1.7.23 does not yet
  highlight the exact reply.
- Search ranking is deterministic but not yet personalized by user role,
  assignments or recent project activity.
- Retention currently pauses AI usage but does not physically erase data.
  Policy-based deletion and legal holds require a separate audited lifecycle.
- Workspace memory has one workspace-wide scope. Per-role and per-agent memory
  visibility is intentionally deferred until its policy model is explicit.

## v1.7.38 slice

Project Passport gives every workspace one source-linked operational view. It
does not introduce a project table or copy mutable state: rooms, active work,
risks, decisions, curated documents, GitHub repositories and verified deploy
events remain owned by their existing systems and are composed at read time.

The API establishes membership first, derives the visible room set once and
uses it as the boundary for every downstream query. A client role cannot infer
an internal room through task titles, memory, repository metadata or deploy
events. Stored integration config and webhook secrets never enter the response;
GitHub event links are accepted only from verified bounded snapshots and pinned
to `github.com`.

The UI starts with one health signal and one next action. A blocker opens the
original Action Item, a failed deploy opens the verified GitHub run, and normal
work returns to its room. This keeps the passport useful as an index and status
surface without turning it into another system that users must maintain.

## v1.7.39 slice

Growth Command Room replaces the Agent Office fixture with a server-owned review
surface for completed `growth.run.v1` exports from Eclipse AI Hub. Every import is
validated as a five-step, no-tools, no-publication artifact; HTTPS evidence is bounded,
unknown fields are rejected and any approval claim from the source file is discarded.

Reads and mutations require workspace membership. Approval additionally requires the
existing `TASK_APPROVE` capability. Run lookups are tenant-scoped, imports are idempotent,
reviews use optimistic versions and audit events retain metadata only. The UI covers
loading, empty, validation error, read-only, pending, approved and rejected states on
desktop and mobile.

## v1.7.40 slice

Growth Command Room can now create a draft directly in Chat and advance it through the
five fixed AI Hub roles. One explicit click executes one role; the next role never starts
automatically. The interface shows progress, remaining daily requests, running, cancel,
provider-error, disabled and review states without requiring a separate manual.

The server owns workspace authorization, optimistic versions, idempotency and a UTC daily
per-user request counter. A distinct `eclipse-chat-growth` service identity can call only
`POST /v1/growth/execute`; arbitrary prompts, tools, URL fetching and publication are not
part of that endpoint. Timeout and cancel preserve completed artifacts. Audit and AI Hub
telemetry retain aggregate metadata only, never prompts or generated content.

Publication remains a separate future permission with a human-readable diff and explicit approval.

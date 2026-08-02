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

## Next slice

Build Mobile Command Inbox: one prioritized queue for approve, assign, answer,
join-call and review actions, with one explicit primary action per card and no
hidden automatic execution.

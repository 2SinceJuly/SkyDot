# Personal Agent architecture

## Current state

An independent, default-disabled Cloudflare PoC now hosts official PiHarness in
one SQLite Durable Object per immutable Session binding. It has input receipts,
snapshots/native event streams and Alarm delivery of frozen occurrences, tested
locally in workerd. The following authority foundation adds immutable internal product placements
and live ACL/provider callbacks; public Cloud Session admission/dispatch and Goal
controls remain disabled. Existing public product Sessions retain Node ownership.
Cloud path admission requires an explicit owner decision on runtime ownership and
authority.

The optional GitHub subscription path now feeds authenticated, deduplicated events
into the same managed Goal/Session/Scheduler/Durable path. Admission and its run
receipt commit together in the product database; it adds no scheduling loop.
Implemented filters, budgets, cancellation and limits apply. Explicit cross-task
Personal Memory now reuses
Home revisions and requires destination/revision grants; see
[personal-memory.md](personal-memory.md). Optional paired finite-file Device Nodes now use native ToolTask memos and revocable workspace grants; see [device-nodes.md](device-nodes.md).

SkyDot retains Pi Coding Agent through the agent-runner and adds an opt-in Pi Durable path for owned Host Sessions. The product layer owns workspace and identity policy, conversation admission, queues, channel delivery, scheduled task records, workspace memory, and runtime configuration. Pi Coding Agent owns an individual model turn and stores its transcript in JSONL. Existing receipts and queue recovery are SkyDot mechanisms; they are not Pi Durable checkpoints.

The product layer integrates Pi Coding Agent and an opt-in Pi Durable path for owned Host Sessions; both retain the Goal availability hook and Pocket panel. The stacked Durable Session path is described below.

For new owned Host conversation Sessions created through the existing `/agents` or `/sessions` APIs, Pi Durable is used when `SKYDOT_DURABLE_RUNTIME=true`. Schema v71 persists the owner/workspace/session/runtime/provider identity and a provisioning state in the existing product database. Owned legacy conversations are explicitly assigned to Pi Coding Agent; main sessions, spawned tasks and Docker sessions retain their existing execution path. Runtime selection is never recomputed on restart or flag changes.

The formal `/api/messages` path records payload-bound input receipts and projects user messages in one product transaction, then submits to the Session's Durable Inbox. Each Durable Session owns one private SQLite file under `data/db/durable-sessions/`, through the existing cross-process ownership guard. The main service owns these Harness instances, so killing that service kills the actual executor. Its conversation dispatcher reconciles durable receipts instead of launching a Coding Agent for the same Session; channel messages already admitted by existing routing retain their original message identity. No second business queue or scheduler is added.

Startup verifies the owner, active user, Host permission, workspace/model/profile fingerprint, existing root checkpoint, and every recovered input's product receipt/digest before activation. An invalid Session is blocked independently of other Sessions. Provider credentials resolve from the existing encrypted model configuration at request time; API-key Anthropic and OpenAI Completions are supported. OAuth, full Skills/MCP/context parity and container execution remain pending for this new path. The first tool is a bounded workspace file read using the existing path guard. Runtime execution respects the existing duration limit across restart. SDK placeholder prices never enter product billing; the Session and usage page explicitly identify unpriced/incomplete coverage.

The Goal execution follow-up atomically provisions new Host Goals, tasks and Durable Sessions. The existing Scheduler owns frozen Goal contexts, leases, budget charges and bounded step progression; only its current claim may activate that Goal Harness. Exact-content approvals bind the Goal/run, and the host verifies actual artifacts before literal completion checks or human confirmation. Evaluation and result delivery use the existing isolated-run outbox transaction. Existing/manual Coding tasks retain their previous path.

## Target boundary

```text
Web / PWA / Electron / channel
              |
        SkyDot API + ACL
              |
   SkyDot session ownership map
              |
         Runtime API
          /       \
  Pi Coding     Pi Durable
  Agent          Harness
      \           /
       authorized tools and delivery
```

The ownership map must bind a SkyDot user and workspace to exactly one runtime conversation. Every lookup, mutation, snapshot, and recovered submission must pass the existing ACL. Runtime selection must be persisted for the session; a feature flag may select a runtime only when creating a new session, and must not switch ownership of a live session.

SkyDot remains responsible for identity, ACL, workspace boundaries, memory scope, capability grants, scheduler policy, channel routing, and external-delivery receipts. Pi Durable supplies durable conversations, task checkpoints, inbox submissions, SQLite storage, and replay/resume behavior. A future adapter must translate existing authorized tools into Pi Durable tools rather than importing an unrestricted tool bundle.

## Storage and ownership

Pi Durable 1.3.0 uses a Harness as the owner of one storage instance. Its Node SQLite adapter uses WAL and `synchronous=NORMAL`; its documented crash guarantee covers committed process-crash state, while the newest commit may be lost after host or power failure. A cooperative local SQLite coordinator now enforces one guarded Harness per canonical storage path, including across processes and GC. Product Session mappings are persisted in the existing database. Online backup and restore of the optional Durable database are implemented and tested.

The existing SkyDot database and JSONL history remain intact during migration. Per-Session Durable databases have online WAL snapshots and restore integrity checks; coordinators are excluded. Cross-database snapshot mismatches fail closed at recovery rather than recreating a prompt. The flag is a new-Session rollout control, not a live-runtime rollback switch. Managed Host Goals dispatch through that mapping; existing Coding/script tasks retain their no-blind-replay boundary.

## Verification status

- Implemented: version-pinned Durable dependency, adapter open/lookup/submit/snapshot/watch methods, fail-closed authorization, persisted request-digest bindings, private SQLite file mode, explicit activation after a caller-supplied recovered-ownership check, and optional Durable SQLite backup/restore with integrity validation.
- Tested: actual Pi Durable Harness task/submission state survives SIGKILL and a fresh process; simulated idempotent service receipts suppress duplicate effects; an interrupted faux provider request resumes the original submission without resubmitting its prompt.
- Implemented on the product-session branch: formal child-Session creation/input routing, immutable runtime mapping, configured-provider bridge, read tool, scoped recovery authorization, persisted result projection and individual Session isolation.
- Implemented on the approval follow-up: persistent exact-content approval and an exclusive private-artifact write/receipt, including pending-approval restart and mobile approval controls.
- Implemented on the Goal follow-up: automatic provisioning, frozen execution context, lease-fenced original-run recovery, bounded model/run budgets, Goal-bound approval, actual-artifact evaluation and existing outbox delivery.
- Pending: live-model Goal acceptance; external write reconciliation; ordered runtime-view reconciliation; Durable queue edits/reordering; full Skills/MCP/context parity; proactive workflows.
- Not verified: a live external provider/model, real external write effects, power-loss recovery, physical devices, or multi-host deployment. Local HTTP-provider tests are simulated model evidence even though product HTTP, tool reads and OS process termination are real.

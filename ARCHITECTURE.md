# Sympozium — Autonomous Software Engineering Platform

An architecture overview of the Sympozium-powered coding agent that autonomously picks up GitHub issues, implements changes, and delivers Pull Requests.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES CLUSTER                              │
│                                                                         │
│  ┌───────────────┐    ┌──────────────────────────────────────────────┐  │
│  │   Scheduler    │    │            Controller Manager                │  │
│  │               │    │                                              │  │
│  │  ┌──────────┐ │    │  ┌─────────────┐  ┌───────────────────────┐ │  │
│  │  │ Cron     │─┼────┼─▶│ AgentRun    │  │  PersonaPack          │ │  │
│  │  │ */5 * * *│ │    │  │ Reconciler  │  │  Reconciler           │ │  │
│  │  └──────────┘ │    │  └──────┬──────┘  └───────────────────────┘ │  │
│  └───────────────┘    │         │                                    │  │
│                       │         ▼                                    │  │
│                       │  ┌──────────────┐   ┌──────────────────┐    │  │
│                       │  │ Channel      │   │  Memory          │    │  │
│                       │  │ Router       │   │  Manager         │    │  │
│                       │  └──────┬───────┘   └────────┬─────────┘    │  │
│                       └─────────┼────────────────────┼──────────────┘  │
│                                 │                    │                  │
│         ┌───────────────────────┼────────────────────┼───────┐         │
│         │              NATS JetStream                │       │         │
│         │          (Event Bus / Message Broker)       │       │         │
│         └───────────┬───────────┬────────────────────┘       │         │
│                     │           │                            │         │
│    ┌────────────────▼──┐  ┌─────▼──────────────────────┐     │         │
│    │   Webex Channel   │  │     Agent Pod (ephemeral)   │     │         │
│    │                   │  │                             │     │         │
│    │  ┌─────────────┐  │  │  ┌────────────┐ ┌────────┐ │     │         │
│    │  │ Bot WS      │  │  │  │ Agent      │ │Sidecar │ │     │         │
│    │  │ Listener    │  │  │  │ Runner     │ │        │ │     │         │
│    │  └─────────────┘  │  │  │            │ │ gh cli │ │     │         │
│    │  ┌─────────────┐  │  │  │ LLM Loop   │ │ git   │ │     │         │
│    │  │ REST API    │  │  │  │ + Tools    │◀▶│ deep  │ │     │         │
│    │  │ Sender      │  │  │  │            │ │ agents│ │     │         │
│    │  └─────────────┘  │  │  └─────┬──────┘ └────────┘ │     │         │
│    └───────────────────┘  │        │     IPC Bridge     │     │         │
│             ▲             │  ┌─────▼──────────────────┐ │     │         │
│             │             │  │ /ipc/messages/         │ │     │         │
│             │             │  │ /ipc/tools/            │ │     │         │
│             │             │  │ /memory/MEMORY.md      │◀┘     │         │
│             │             │  └────────────────────────┘       │         │
│             │             └──────────────────────────────────┘         │
│             │                                                          │
└─────────────┼──────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────┐          ┌──────────────────────────┐
│      Webex Space        │          │      GitHub              │
│                         │          │                          │
│  PR notifications       │          │  Issues ──▶ Agent picks  │
│  Status updates         │          │  PRs    ◀── Agent creates│
│                         │          │  Labels   (in-progress)  │
└─────────────────────────┘          └──────────────────────────┘
```

---

## Core Concepts

### Task Management

The platform uses **GitHub Issues as the task backlog**. Each issue labelled `coding-agent` is eligible for autonomous implementation. The agent follows a strict lifecycle:

```
  Open Issue          In-Progress            PR Created           Merged
  (unassigned)  ───▶  (label + assignee) ───▶ (label removed) ───▶ (closed)
       │                    │                      │
       │              Agent locks it          Agent pushes
       │              via gh CLI              branch + PR
       ▼                    ▼                      ▼
  ┌──────────┐      ┌──────────────┐       ┌────────────┐
  │ Backlog  │      │  Locked by   │       │  Review    │
  │          │      │  in-progress │       │  Ready     │
  └──────────┘      └──────────────┘       └────────────┘
```

Deduplication is enforced through three layers:
1. **`in-progress` label** — primary lock, prevents concurrent runs from claiming the same issue
2. **Assignee check** — secondary signal, agent assigns itself via `gh issue edit --add-assignee @me`
3. **Persistent memory** — tertiary signal, completed issue numbers stored across runs

### Memory

Each agent instance has a **persistent ConfigMap** (`<name>-memory`) mounted at `/memory/MEMORY.md`. The agent writes structured markers during execution that the controller extracts and persists:

```
Agent output ──▶ __SYMPOZIUM_MEMORY__ markers ──▶ Controller patches ConfigMap
                                                         │
Next run reads /memory/MEMORY.md ◀───────────────────────┘
```

Memory tracks completed issues, PR URLs, and lessons learned — preventing duplicate work across runs.

### Schedule

Schedules are defined as **SympoziumSchedule CRDs** with cron expressions. The controller creates an AgentRun at each interval:

| Property | Value |
|----------|-------|
| Interval | `*/5 * * * *` (every 5 minutes) |
| Type | `sweep` |
| Concurrency | `Forbid` (no parallel runs) |
| Memory | Included in each run's context |

### Connectors

**Channels** are independent pods that bridge Sympozium to external messaging platforms:

| Connector | Transport | Purpose |
|-----------|-----------|---------|
| **Webex** | WebSocket + REST API | PR notifications, status updates |
| **GitHub** | `gh` CLI in sidecar | Issue listing, assignment, PR creation |
| **Slack** | Socket Mode | Message routing (available) |

The agent communicates with channels through a filesystem-based IPC bridge:

```
Agent ──▶ /ipc/messages/*.json ──▶ fsnotify ──▶ NATS ──▶ Channel Pod ──▶ Webex API
```

### Supervisor

The **Controller Manager** acts as the supervisor:

- Watches CRDs (AgentRun, SympoziumInstance, SympoziumSchedule, PersonaPack, SkillPack)
- Spawns ephemeral agent pods as Kubernetes Jobs
- Routes messages between agents and channels
- Manages agent memory lifecycle
- Enforces policies via admission webhooks

Each agent pod is fully isolated — its own filesystem, network, and sidecar tools — and is destroyed after completion.

---

## Coding Agent Flow

```
  ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
  │ Schedule │────▶│  List    │────▶│  Lock    │────▶│  Clone   │────▶│  deep   │
  │ triggers │     │  issues  │     │  issue   │     │  repo    │     │  agents │
  │ run      │     │  (gh)   │     │  (label  │     │  branch  │     │  CLI    │
  └─────────┘     └──────────┘     │  assign) │     └──────────┘     │  impl   │
                                   └──────────┘                      └────┬────┘
                                                                          │
  ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐         │
  │ Webex   │◀────│  Notify  │◀────│  Create  │◀────│  Commit  │◀────────┘
  │ space   │     │  channel │     │  PR      │     │  + push  │
  └─────────┘     └──────────┘     └──────────┘     └──────────┘
```

The `deepagents-cli` handles the heavy lifting — reading files, understanding context, writing code — while the Sympozium agent orchestrates the workflow (issue selection, git operations, PR creation, notifications).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Orchestration | Kubernetes (CRDs + Controllers) |
| Event Bus | NATS JetStream |
| Agent Runtime | Go (agent-runner with LLM tool loop) |
| Code Implementation | `deepagents-cli` (Python, headless mode) |
| LLM Provider | Azure OpenAI (GPT-5.2) |
| Source Control | GitHub (`gh` CLI) |
| Notifications | Webex (Bot SDK + REST API) |
| IPC | Filesystem (fsnotify) → NATS |

---

## Future Improvements

### Multi-Agent Coordination
Currently each agent run is independent. Future work could enable agents to coordinate — one agent plans the architecture while another implements, with a third reviewing the PR. A shared coordination layer via NATS topics would allow agents to claim subtasks, share context, and avoid conflicts.

### Spec-Driven Development
Instead of free-form issue descriptions, issues could contain structured specs (API contracts, test cases, acceptance criteria in a machine-readable format). The agent would validate its implementation against the spec before submitting, achieving higher first-pass success rates.

### Hierarchical Task Decomposition
A supervisor agent could break large issues into smaller, well-scoped sub-issues automatically — each implementable in a single run. This would handle complex features that currently exceed a single agent's context window or iteration budget.

### Review Agent
A dedicated review persona could watch for new PRs, run tests, check for regressions, and either approve or request changes — closing the loop without human intervention for straightforward changes.

### Learning from Feedback
When PRs are rejected or require changes, the agent could learn from review comments and store patterns in memory — improving code quality over successive runs.

### Cross-Repository Orchestration
Extend the agent to work across multiple repositories — for example, updating an API server and its client SDK in coordinated PRs with compatible version bumps.

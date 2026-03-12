# Sympozium — Autonomous Software Engineering Platform

An architecture overview of the Sympozium-powered coding agent that autonomously picks up GitHub issues, implements changes, and delivers Pull Requests.

---

## System Architecture

```mermaid
graph TB
    subgraph K8s["Kubernetes Cluster"]
        direction TB

        subgraph Control["Control Plane"]
            Sched["Schedule Controller<br/><code>*/5 * * * *</code>"]
            Recon["AgentRun Reconciler"]
            ChanR["Channel Router"]
            MemMgr["Memory Manager"]
            Sched -->|creates AgentRun| Recon
        end

        NATS["NATS JetStream"]
        Recon -->|lifecycle events| NATS
        ChanR <-->|message routing| NATS

        subgraph Agent["Agent Pod (ephemeral)"]
            direction LR
            Runner["Agent Runner<br/>LLM tool loop"]
            Sidecar["Skill Sidecar<br/>gh · git · deepagents-cli"]
            IPC["/ipc + /memory"]
            Runner <-->|execute_command| Sidecar
            Runner -->|read/write| IPC
        end

        Recon -->|spawns pod| Agent
        IPC -->|fsnotify| NATS

        subgraph Chan["Channel Pods"]
            Webex["Webex Channel<br/>WebSocket + REST"]
        end

        NATS <-->|outbound messages| Chan
        MemMgr -->|patches ConfigMap| IPC
    end

    GH["GitHub<br/>Issues · PRs · Labels"]
    WX["Webex Space<br/>Notifications"]

    Sidecar <-->|gh cli| GH
    Webex <-->|Bot API| WX

    style K8s fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style Control fill:#0f3460,stroke:#1a1a6e,color:#e0e0e0
    style Agent fill:#533483,stroke:#5b2c8e,color:#e0e0e0
    style Chan fill:#0f3460,stroke:#1a1a6e,color:#e0e0e0
    style NATS fill:#e94560,stroke:#c0392b,color:#fff
    style GH fill:#24292e,stroke:#444,color:#fff
    style WX fill:#00bceb,stroke:#0098c7,color:#fff
```

---

## Coding Agent Flow

```mermaid
graph LR
    A["⏰ Schedule<br/>triggers run"] --> B["📋 List issues<br/><code>gh issue list</code>"]
    B --> C{"Eligible<br/>issue?"}
    C -->|No| Stop["🛑 Stop"]
    C -->|Yes| D["🔒 Lock issue<br/>label + assign"]
    D --> E["📂 Clone repo<br/>create branch"]
    E --> F["🤖 deepagents-cli<br/>implement changes"]
    F --> G["📝 Commit + push"]
    G --> H{"Out-of-scope<br/>work found?"}
    H -->|Yes| I["📌 Create<br/>follow-up issues"]
    H -->|No| J["🔀 Create PR"]
    I --> J
    J --> K["🔓 Remove<br/>in-progress label"]
    K --> L["💬 Webex<br/>notification"]
    L --> M["💾 Save to<br/>memory"]

    style A fill:#e94560,color:#fff
    style F fill:#533483,color:#fff
    style J fill:#0f3460,color:#fff
    style L fill:#00bceb,color:#fff
    style Stop fill:#555,color:#fff
```

---

## Task Management Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Backlog: Issue created<br/>label: coding-agent

    Backlog --> Locked: Agent claims<br/>+in-progress label<br/>+assignee

    Locked --> Implementing: deepagents-cli<br/>runs headless

    Implementing --> PRCreated: git push +<br/>gh pr create

    PRCreated --> Review: in-progress<br/>label removed

    Review --> [*]: PR merged<br/>issue closed

    Implementing --> Backlog: Too complex<br/>label removed

    note right of Locked
        Three-layer dedup:
        1. in-progress label (primary)
        2. Assignee check (secondary)
        3. Agent memory (tertiary)
    end note
```

---

## Core Concepts

### Memory

Each agent instance has a **persistent ConfigMap** mounted at `/memory/MEMORY.md`. The controller extracts structured markers from agent output and patches the ConfigMap between runs.

```mermaid
graph LR
    A["Agent Run N"] -->|writes markers| B["Controller"]
    B -->|patches| C["ConfigMap<br/><code>coding-agent-memory</code>"]
    C -->|mounted into| D["Agent Run N+1"]

    style C fill:#0f3460,color:#fff
```

Memory tracks completed issues, PR URLs, and lessons learned — preventing duplicate work across runs.

### Schedule

| Property | Value |
|----------|-------|
| Interval | `*/5 * * * *` (every 5 minutes) |
| Type | `sweep` |
| Concurrency | `Forbid` (no parallel runs) |
| Memory | Included in each run's context |

### Connectors

| Connector | Transport | Purpose |
|-----------|-----------|---------|
| **Webex** | WebSocket + REST API | PR notifications, status updates |
| **GitHub** | `gh` CLI in sidecar | Issue listing, assignment, PR creation |
| **Slack** | Socket Mode | Message routing (available) |

Communication flows through a filesystem-based IPC bridge:

```mermaid
graph LR
    A["Agent writes<br/>/ipc/messages/*.json"] -->|fsnotify| B["IPC Bridge"]
    B -->|publish| C["NATS"]
    C -->|subscribe| D["Channel Pod"]
    D -->|REST API| E["Webex / Slack"]

    style C fill:#e94560,color:#fff
```

### Supervisor

The **Controller Manager** acts as the platform supervisor:

- Watches CRDs (AgentRun, SympoziumInstance, SympoziumSchedule, PersonaPack, SkillPack)
- Spawns ephemeral agent pods as Kubernetes Jobs
- Routes messages between agents and channels
- Manages agent memory lifecycle
- Enforces policies via admission webhooks

Each agent pod is fully isolated — its own filesystem, network, and sidecar tools — and is destroyed after completion.

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

```mermaid
graph TB
    Planner["Planner Agent"] -->|architecture spec| Impl1["Implementer A"]
    Planner -->|architecture spec| Impl2["Implementer B"]
    Impl1 -->|PR| Reviewer["Review Agent"]
    Impl2 -->|PR| Reviewer
    Reviewer -->|approve / request changes| Impl1
    Reviewer -->|approve / request changes| Impl2

    style Planner fill:#533483,color:#fff
    style Reviewer fill:#0f3460,color:#fff
```

Currently each agent run is independent. Future work could enable agents to coordinate — one agent plans the architecture while another implements, with a third reviewing the PR.

### Spec-Driven Development
Instead of free-form issue descriptions, issues could contain structured specs (API contracts, test cases, acceptance criteria). The agent would validate its implementation against the spec before submitting, achieving higher first-pass success rates.

### Hierarchical Task Decomposition
A supervisor agent could break large issues into smaller, well-scoped sub-issues automatically — each implementable in a single run.

### Review Agent
A dedicated review persona could watch for new PRs, run tests, check for regressions, and either approve or request changes — closing the loop without human intervention.

### Learning from Feedback
When PRs are rejected or require changes, the agent could learn from review comments and store patterns in memory — improving code quality over successive runs.

### Cross-Repository Orchestration
Extend the agent to work across multiple repositories — updating an API server and its client SDK in coordinated PRs with compatible version bumps.

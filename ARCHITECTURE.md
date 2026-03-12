# Sympozium — Autonomous Software Engineering Platform

An architecture overview of the Sympozium-powered coding agent that autonomously picks up GitHub issues, implements changes, and delivers Pull Requests.

---

## System Architecture

```mermaid
graph TB
    subgraph K8s["Kubernetes Cluster"]
        direction TB

        subgraph Control["Control Plane"]
            Sched["Schedule Controller"]
            Recon["AgentRun Reconciler"]
            ChanR["Channel Router"]
            MemMgr["Memory Manager"]
            Sched -->|creates AgentRun| Recon
        end

        NATS["NATS JetStream"]
        Recon -->|lifecycle events| NATS
        ChanR <-->|message routing| NATS

        subgraph Agent["Agent Pod · ephemeral"]
            direction LR
            Runner["Agent Runner"]
            Sidecar["Skill Sidecar"]
            IPC["/ipc + /memory"]
            Runner <-->|execute_command| Sidecar
            Runner -->|read/write| IPC
        end

        Recon -->|spawns pod| Agent
        IPC -->|fsnotify| NATS

        subgraph Chan["Channel Pods"]
            Webex["Webex Channel"]
        end

        NATS <-->|outbound messages| Chan
        MemMgr -->|patches ConfigMap| IPC
    end

    GH["GitHub"]
    WX["Webex Space"]

    Sidecar <-->|gh cli| GH
    Webex <-->|Bot API| WX

    style K8s fill:#161b22,stroke:#30363d,color:#c9d1d9
    style Control fill:#1f6feb,stroke:#388bfd,color:#fff
    style Agent fill:#8957e5,stroke:#a371f7,color:#fff
    style Chan fill:#1f6feb,stroke:#388bfd,color:#fff
    style NATS fill:#da3633,stroke:#f85149,color:#fff
    style GH fill:#30363d,stroke:#484f58,color:#c9d1d9
    style WX fill:#1a7f37,stroke:#3fb950,color:#fff
    style Sched fill:#1f6feb,stroke:#388bfd,color:#fff
    style Recon fill:#1f6feb,stroke:#388bfd,color:#fff
    style ChanR fill:#1f6feb,stroke:#388bfd,color:#fff
    style MemMgr fill:#1f6feb,stroke:#388bfd,color:#fff
    style Runner fill:#8957e5,stroke:#a371f7,color:#fff
    style Sidecar fill:#8957e5,stroke:#a371f7,color:#fff
    style IPC fill:#8957e5,stroke:#a371f7,color:#fff
    style Webex fill:#1f6feb,stroke:#388bfd,color:#fff
```

---

## Coding Agent Flow

```mermaid
graph LR
    A["Schedule triggers"] --> B["List issues"]
    B --> C{"Eligible?"}
    C -->|No| Stop["Stop"]
    C -->|Yes| D["Lock issue"]
    D --> E["Clone + branch"]
    E --> F["deepagents-cli"]
    F --> G["Commit + push"]
    G --> H{"Follow-ups?"}
    H -->|Yes| I["Create issues"]
    H -->|No| J["Create PR"]
    I --> J
    J --> K["Unlock label"]
    K --> L["Webex notify"]
    L --> M["Save memory"]

    style A fill:#da3633,stroke:#f85149,color:#fff
    style F fill:#8957e5,stroke:#a371f7,color:#fff
    style J fill:#1f6feb,stroke:#388bfd,color:#fff
    style L fill:#1a7f37,stroke:#3fb950,color:#fff
    style Stop fill:#30363d,stroke:#484f58,color:#c9d1d9
    style C fill:#d29922,stroke:#e3b341,color:#fff
    style H fill:#d29922,stroke:#e3b341,color:#fff
```

---

## Task Management Lifecycle

```mermaid
graph LR
    New["New Issue"] -->|agent claims| Locked["Locked"]
    Locked -->|deepagents runs| Impl["Implementing"]
    Impl -->|push + PR| PR["PR Created"]
    PR -->|label removed| Review["In Review"]
    Review -->|merged| Done["Closed"]
    Impl -->|too complex| New

    style New fill:#30363d,stroke:#484f58,color:#c9d1d9
    style Locked fill:#da3633,stroke:#f85149,color:#fff
    style Impl fill:#8957e5,stroke:#a371f7,color:#fff
    style PR fill:#1f6feb,stroke:#388bfd,color:#fff
    style Review fill:#d29922,stroke:#e3b341,color:#fff
    style Done fill:#1a7f37,stroke:#3fb950,color:#fff
```

**Three-layer deduplication** prevents concurrent runs from claiming the same issue:

1. **`in-progress` label** — primary lock, added before work begins
2. **Assignee** — secondary signal, agent assigns itself via `gh issue edit --add-assignee @me`
3. **Persistent memory** — tertiary signal, completed issue numbers stored across runs

---

## Core Concepts

### Memory

Each agent instance has a **persistent ConfigMap** mounted at `/memory/MEMORY.md`. The controller extracts structured markers from agent output and patches the ConfigMap between runs.

```mermaid
graph LR
    A["Agent Run N"] -->|writes markers| B["Controller"]
    B -->|patches| C["ConfigMap"]
    C -->|mounted into| D["Agent Run N+1"]

    style A fill:#8957e5,stroke:#a371f7,color:#fff
    style B fill:#1f6feb,stroke:#388bfd,color:#fff
    style C fill:#da3633,stroke:#f85149,color:#fff
    style D fill:#8957e5,stroke:#a371f7,color:#fff
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
    A["/ipc/messages/"] -->|fsnotify| B["IPC Bridge"]
    B -->|publish| C["NATS"]
    C -->|subscribe| D["Channel Pod"]
    D -->|REST API| E["Webex"]

    style A fill:#8957e5,stroke:#a371f7,color:#fff
    style C fill:#da3633,stroke:#f85149,color:#fff
    style E fill:#1a7f37,stroke:#3fb950,color:#fff
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
    Planner["Planner Agent"] -->|spec| Impl1["Implementer A"]
    Planner -->|spec| Impl2["Implementer B"]
    Impl1 -->|PR| Reviewer["Review Agent"]
    Impl2 -->|PR| Reviewer
    Reviewer -->|feedback| Impl1
    Reviewer -->|feedback| Impl2

    style Planner fill:#8957e5,stroke:#a371f7,color:#fff
    style Impl1 fill:#1f6feb,stroke:#388bfd,color:#fff
    style Impl2 fill:#1f6feb,stroke:#388bfd,color:#fff
    style Reviewer fill:#1a7f37,stroke:#3fb950,color:#fff
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

### Browser Tool Integration
Equip agents with a headless browser tool to interact with web UIs, verify frontend changes visually, scrape documentation, and test deployed endpoints. This would enable the agent to validate its own PRs against a preview deployment before requesting review.

### Cross-Repository Orchestration
Extend the agent to work across multiple repositories — updating an API server and its client SDK in coordinated PRs with compatible version bumps.

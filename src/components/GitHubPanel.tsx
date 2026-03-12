"use client";

import type { GitHubState, GitHubIssue, GitHubPullRequest } from "@/types/research";
import { GitBranch, Github, GitPullRequest, AlertCircle } from "lucide-react";

function LabelPill({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs"
      style={{
        background: "var(--color-glass-subtle)",
        border: "1px solid var(--color-border-glass)",
        color: "var(--color-text-secondary)",
      }}
    >
      {name}
    </span>
  );
}

function IssueRow({ issue }: { issue: GitHubIssue }) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg p-3"
      style={{
        background: "var(--color-glass-subtle)",
        border: "1px solid var(--color-border-glass)",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">#{issue.number}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {issue.title}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(issue.labels || []).slice(0, 6).map((l) => (
            <LabelPill key={`${issue.number}-${l}`} name={l} />
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 text-xs text-[var(--color-text-tertiary)]">
        {issue.assignee ? `@${issue.assignee}` : "unassigned"}
      </div>
    </div>
  );
}

function PRRow({ pr }: { pr: GitHubPullRequest }) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg p-3"
      style={{
        background: "var(--color-glass-subtle)",
        border: "1px solid var(--color-border-glass)",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">#{pr.number}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {pr.title}
          </span>
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {pr.isDraft ? "draft" : pr.state}
          {pr.reviewDecision ? ` • ${pr.reviewDecision}` : ""}
        </div>
      </div>
      <div className="flex-shrink-0 text-xs text-[var(--color-text-tertiary)]">
        {pr.author ? `@${pr.author}` : ""}
      </div>
    </div>
  );
}

export function GitHubPanel({ github }: { github: GitHubState }) {
  const issues = github.issues || [];
  const prs = github.pullRequests || [];

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg p-3 flex items-center justify-between"
        style={{
          background: "var(--color-glass-subtle)",
          border: "1px solid var(--color-border-glass)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Github className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {github.repo || "Repository"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <GitBranch className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {github.branch || "-"}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)]" />
          Open Issues
          <span className="text-xs text-[var(--color-text-tertiary)]">({issues.length})</span>
        </h3>
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">No issues found</div>
          ) : (
            issues.map((issue) => <IssueRow key={issue.number} issue={issue} />)
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-[var(--color-text-secondary)]" />
          Open Pull Requests
          <span className="text-xs text-[var(--color-text-tertiary)]">({prs.length})</span>
        </h3>
        <div className="space-y-2">
          {prs.length === 0 ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">No pull requests found</div>
          ) : (
            prs.map((pr) => <PRRow key={pr.number} pr={pr} />)
          )}
        </div>
      </div>
    </div>
  );
}

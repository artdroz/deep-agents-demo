"use client";

import { useMemo } from "react";
import { GitBranch, Github, GitPullRequest, Hash, User } from "lucide-react";

export interface GitHubLabel {
  name: string;
  color?: string;
}

export interface GitHubUser {
  login: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  url?: string;
  assignee?: GitHubUser | null;
  labels?: GitHubLabel[];
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  url?: string;
  isDraft?: boolean;
  state?: string; // OPEN/CLOSED/MERGED
  reviewDecision?: string | null; // APPROVED/CHANGES_REQUESTED/REVIEW_REQUIRED
}

export interface GitHubPanelState {
  repo?: string;
  branch?: string;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
}

export function GitHubPanel({
  state,
  onAssignIssue,
}: {
  state: GitHubPanelState;
  onAssignIssue?: (issue: GitHubIssue) => void;
}) {
  const issueCount = state.issues.length;
  const prCount = state.pullRequests.length;

  const sortedIssues = useMemo(() => {
    return [...state.issues].sort((a, b) => a.number - b.number);
  }, [state.issues]);

  const sortedPRs = useMemo(() => {
    return [...state.pullRequests].sort((a, b) => a.number - b.number);
  }, [state.pullRequests]);

  return (
    <div className="workspace-panel p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Github className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">GitHub</h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Repository context, issues, and pull requests
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="glass-subtle px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <Hash className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <span className="text-[var(--color-text-secondary)]">{state.repo || "(repo unknown)"}</span>
          </div>
          <div className="glass-subtle px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <span className="text-[var(--color-text-secondary)]">{state.branch || "(branch unknown)"}</span>
          </div>
        </div>
      </div>

      <div className="workspace-section">
        <div className="workspace-section-header w-full">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--color-text-primary)]">Open issues</span>
            {issueCount > 0 && (
              <span
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-background)",
                  padding: "var(--space-1) var(--space-2)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-semibold)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {issueCount}
              </span>
            )}
          </div>
        </div>

        <div className="workspace-section-content">
          {sortedIssues.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: "var(--space-6)", paddingBottom: "var(--space-6)" }}>
              <p style={{ fontSize: "var(--text-sm)" }}>No open issues found</p>
              <p className="text-xs mt-1">Run GitHub tools to populate this panel</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedIssues.map((issue) => (
                <div key={issue.number} className="file-item">
                  <div className="flex items-start gap-3">
                    <div className="file-item-icon mt-0.5">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          #{issue.number} {issue.title}
                        </p>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2 items-center">
                        {issue.assignee?.login && (
                          <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {issue.assignee.login}
                          </span>
                        )}

                        {(issue.labels || []).slice(0, 6).map((l) => (
                          <span
                            key={l.name}
                            className="text-xs"
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border-glass)] hover:bg-[var(--color-glass-subtle)] transition-colors"
                      onClick={() => onAssignIssue?.(issue)}
                      title="Trigger agent to pick up this issue"
                    >
                      Assign to Agent
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="workspace-section">
        <div className="workspace-section-header w-full">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--color-text-primary)]">Pull requests</span>
            {prCount > 0 && (
              <span
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-background)",
                  padding: "var(--space-1) var(--space-2)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-semibold)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {prCount}
              </span>
            )}
          </div>
        </div>

        <div className="workspace-section-content">
          {sortedPRs.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: "var(--space-6)", paddingBottom: "var(--space-6)" }}>
              <p style={{ fontSize: "var(--text-sm)" }}>No pull requests found</p>
              <p className="text-xs mt-1">Run GitHub tools to populate this panel</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPRs.map((pr) => (
                <div key={pr.number} className="file-item">
                  <div className="flex items-start gap-3">
                    <div className="file-item-icon mt-0.5">
                      <GitPullRequest className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        #{pr.number} {pr.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {pr.isDraft ? "draft" : (pr.state || "open").toLowerCase()}
                        </span>
                        {pr.reviewDecision && (
                          <span className="text-xs text-[var(--color-text-tertiary)]">{pr.reviewDecision.toLowerCase()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

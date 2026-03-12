"use client";

import React from "react";
import type { GitHubState, GitHubIssue } from "@/types/github";

export function GitHubPanel({
  github,
  onAssignIssue,
}: {
  github: GitHubState;
  onAssignIssue?: (issue: GitHubIssue) => void;
}) {
  return (
    <div className="workspace-section-content">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">Repository</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">
              {(github.context?.repo || "Unknown repo") +
                (github.context?.branch ? ` • ${github.context.branch}` : "")}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-[var(--color-text-tertiary)] mb-2">
          Open issues ({github.issues.length})
        </div>
        <div className="space-y-2">
          {github.issues.length === 0 ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">No issues found</div>
          ) : (
            github.issues.map((issue) => (
              <div
                key={issue.number}
                className="file-item"
                style={{ padding: "var(--space-3)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">
                      #{issue.number} {issue.title}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      {(issue.assignees?.length ?? 0) > 0
                        ? `Assignee: ${issue.assignees?.[0]?.login}`
                        : "Unassigned"}
                    </div>
                  </div>

                  <button
                    className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-glass-subtle)] transition-colors"
                    onClick={() => onAssignIssue?.(issue)}
                    disabled={!onAssignIssue}
                    title={onAssignIssue ? "Assign to agent" : "Not available"}
                  >
                    Assign to Agent
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--color-text-tertiary)] mb-2">
          Open PRs ({github.pullRequests.length})
        </div>
        <div className="space-y-2">
          {github.pullRequests.length === 0 ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">No PRs found</div>
          ) : (
            github.pullRequests.map((pr) => (
              <div
                key={pr.number}
                className="file-item"
                style={{ padding: "var(--space-3)" }}
              >
                <div className="text-sm text-[var(--color-text-primary)] truncate">
                  #{pr.number} {pr.title}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {(pr.isDraft ? "Draft" : pr.state || "OPEN") +
                    (pr.headRefName ? ` • ${pr.headRefName}` : "")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

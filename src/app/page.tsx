"use client";

import { useState, useRef } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useDefaultTool } from "@copilotkit/react-core";
import { Workspace } from "@/components/Workspace";
import { ResearchState, INITIAL_STATE, Todo } from "@/types/research";
import { ToolCard } from "@/components/ToolCard";
import type { GitHubIssue, GitHubPullRequest } from "@/types/github";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function Page() {
  const [state, setState] = useState<ResearchState>(INITIAL_STATE);
  const processedKeysRef = useRef<Set<string>>(new Set());

  useDefaultTool({
    render: (props) => {
      const { name, status, args, result } = props;

      // Prevent duplicate processing on re-renders
      if (status === "complete") {
        const resultStr = result ? JSON.stringify(result) : "";
        const resultHash = resultStr ? `${resultStr.length}-${resultStr.slice(0, 100)}` : "";
        const key = `${name}-${JSON.stringify(args)}-${resultHash}`;
        if (processedKeysRef.current.has(key)) {
          return <ToolCard {...props} />;
        }
        processedKeysRef.current.add(key);
      }

      // Handle research tool - track summary and sources
      if (name === "research" && status === "complete" && result) {
        const researchResult = result as {
          summary: string;
          sources: Array<{
            url: string;
            title: string;
            content?: string;
            status: "found" | "scraped" | "failed";
          }>;
        };

        // Track sources in state
        if (researchResult.sources && researchResult.sources.length > 0) {
          queueMicrotask(() =>
            setState((prev) => ({
              ...prev,
              sources: [...prev.sources, ...researchResult.sources],
            }))
          );
        }

        console.log(
          `[UI] Research completed: ${researchResult.sources?.length || 0} sources found`
        );
      }

      // Handle write_todos tool
      if (name === "write_todos" && status === "complete" && args?.todos) {
        const todosWithIds = (
          args.todos as Array<{ id?: string; content: string; status: string }>
        ).map((todo, index) => ({
          ...todo,
          id: todo.id || `todo-${Date.now()}-${index}`,
        }));
        queueMicrotask(() => setState((prev) => ({ ...prev, todos: todosWithIds as Todo[] })));
      }

      // Handle write_file tool
      // Deep Agents uses file_path (not path) as the parameter name
      if (name === "write_file" && status === "complete" && args?.file_path) {
        queueMicrotask(() =>
          setState((prev) => ({
            ...prev,
            files: [
              ...prev.files,
              {
                path: args.file_path as string,
                content: args.content as string,
                createdAt: new Date().toISOString(),
              },
            ],
          }))
        );
      }

      // Capture gh issue/pr list JSON from execute_command results.
      // We keep it lightweight: if stdout parses to an array and the command matches,
      // stash it under state.github.
      if (name === "execute_command" && status === "complete" && result) {
        const command = (args.command as string) || "";
        const stdout = (result as { stdout?: string })?.stdout;

        if (typeof stdout === "string" && stdout.trim().length > 0) {
          const parsed = safeJsonParse(stdout);

          if (command.includes("gh issue list") && Array.isArray(parsed)) {
            queueMicrotask(() =>
              setState((prev) => ({
                ...prev,
                github: {
                  ...(prev as any).github,
                  issues: parsed as GitHubIssue[],
                  pullRequests: ((prev as any).github?.pullRequests || []) as GitHubPullRequest[],
                  context: {
                    repo: ((prev as any).github?.context?.repo as string | undefined) ||
                      (command.match(/--repo\s+([^\s]+)/)?.[1] as string | undefined),
                    branch: (prev as any).github?.context?.branch,
                  },
                },
              }))
            );
          }

          if (command.includes("gh pr list") && Array.isArray(parsed)) {
            queueMicrotask(() =>
              setState((prev) => ({
                ...prev,
                github: {
                  ...(prev as any).github,
                  pullRequests: parsed as GitHubPullRequest[],
                  issues: ((prev as any).github?.issues || []) as GitHubIssue[],
                  context: {
                    repo: ((prev as any).github?.context?.repo as string | undefined) ||
                      (command.match(/--repo\s+([^\s]+)/)?.[1] as string | undefined),
                    branch: (prev as any).github?.context?.branch,
                  },
                },
              }))
            );
          }
        }
      }

      return <ToolCard {...props} />;
    },
  });

  return (
    <div className="relative min-h-screen">
      {/* Animated background */}
      <div className="abstract-bg">
        <div className="blob-3" />
      </div>

      {/* Main content */}
      <main className="relative z-10 h-screen flex overflow-hidden">
        {/* Chat panel - left side (38%) */}
        <div className="w-[38%] h-full border-r border-[var(--color-border-glass)] bg-[var(--color-glass-dark)] backdrop-blur-xl overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header */}
            <header
              style={{ padding: "var(--space-8)" }}
              className="border-b border-[var(--color-border-glass)]"
            >
              <h1
                style={{
                  fontSize: "var(--text-3xl)",
                  fontWeight: "var(--font-extrabold)",
                  fontFamily: "var(--font-display)",
                  fontOpticalSizing: "auto",
                }}
                className="text-gradient"
              >
                Deep Research Assistant
              </h1>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                  marginTop: "var(--space-1)",
                }}
              >
                Ask me to research any topic
              </p>
            </header>

            <div
              style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "var(--space-6)" }}
            >
              <CopilotChat
                className="h-full"
                labels={{
                  title: "Deep Research Assistant",
                  initial: "What topic would you like me to research?",
                  placeholder: "Ask me to research any topic...",
                }}
              />
            </div>
          </div>
        </div>

        {/* Workspace panel - right side (62%) */}
        <div className="w-[62%] h-full overflow-hidden">
          <Workspace state={state} />
        </div>
      </main>
    </div>
  );
}

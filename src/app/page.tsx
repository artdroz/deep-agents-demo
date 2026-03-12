"use client";

import { useRef, useState } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useDefaultTool } from "@copilotkit/react-core";
import { Workspace } from "@/components/Workspace";
import type {
  FileNode,
  GitHubState,
  GitStatus,
  Issue,
  PullRequest,
  TabState,
  TerminalEntry,
  Todo,
  WorkspaceState,
} from "@/types/workspace";
import { INITIAL_STATE } from "@/types/workspace";
import { ToolCard } from "@/components/ToolCard";

function extToLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return "text";
  }
}

function ensureDirPath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function upsertFileTree(root: FileNode[], filePath: string, content?: string): FileNode[] {
  const normalized = filePath.replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return root;

  const newRoot = [...root];
  let currentLevel = newRoot;
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    const existingIdx = currentLevel.findIndex((n) => n.name === part);

    if (isLast) {
      const node: FileNode = { name: part, path: currentPath, type: "file", content };
      if (existingIdx >= 0) {
        currentLevel[existingIdx] = { ...currentLevel[existingIdx], ...node, type: "file" };
      } else {
        currentLevel.push(node);
      }
    } else {
      const dirPath = ensureDirPath(currentPath);
      if (existingIdx >= 0) {
        const existing = currentLevel[existingIdx];
        const children = existing.children ? [...existing.children] : [];
        currentLevel[existingIdx] = {
          ...existing,
          name: part,
          path: dirPath,
          type: "dir",
          children,
        };
        currentLevel = children;
      } else {
        const dir: FileNode = { name: part, path: dirPath, type: "dir", children: [] };
        currentLevel.push(dir);
        currentLevel = dir.children!;
      }
    }
  }

  const sortLevel = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortLevel(n.children));
  };
  sortLevel(newRoot);

  return newRoot;
}

function upsertTab(openTabs: TabState[], tab: TabState): TabState[] {
  const idx = openTabs.findIndex((t) => t.path === tab.path);
  if (idx >= 0) {
    const next = [...openTabs];
    next[idx] = { ...next[idx], ...tab };
    return next;
  }
  return [...openTabs, tab];
}

function coerceOutput(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export default function Page() {
  const [state, setState] = useState<WorkspaceState>(INITIAL_STATE);
  const processedKeysRef = useRef<Set<string>>(new Set());

  useDefaultTool({
    render: (props) => {
      const { name, status, args, result } = props;

      if (status === "complete") {
        const resultStr = result ? JSON.stringify(result) : "";
        const resultHash = resultStr ? `${resultStr.length}-${resultStr.slice(0, 100)}` : "";
        const key = `${name}-${JSON.stringify(args)}-${resultHash}`;
        if (processedKeysRef.current.has(key)) {
          return <ToolCard {...props} />;
        }
        processedKeysRef.current.add(key);
      }

      // write_todos tool
      if (name === "write_todos" && status === "complete" && args?.todos) {
        const todosWithIds = (args.todos as Array<{ id?: string; content: string; status: string }>).map(
          (todo, index) => ({
            ...todo,
            id: todo.id || `todo-${Date.now()}-${index}`,
          })
        );
        queueMicrotask(() =>
          setState((prev) => ({
            ...prev,
            todos: todosWithIds as Todo[],
          }))
        );
      }

      // write_file tool
      if (name === "write_file" && status === "complete" && args?.file_path) {
        const path = args.file_path as string;
        const content = (args.content as string) || "";
        queueMicrotask(() =>
          setState((prev) => {
            const nextTree = upsertFileTree(prev.fileTree, path, content);
            const nextTabs = upsertTab(prev.openTabs, {
              path,
              content,
              language: extToLanguage(path),
              isDirty: false,
            });
            return {
              ...prev,
              fileTree: nextTree,
              openTabs: nextTabs,
              activeTab: path,
            };
          })
        );
      }

      // read_file tool
      if (name === "read_file" && status === "complete" && args?.file_path && result) {
        const path = args.file_path as string;
        const content = typeof result === "string" ? result : (result as any)?.content ?? coerceOutput(result);
        queueMicrotask(() =>
          setState((prev) => {
            const nextTree = upsertFileTree(prev.fileTree, path, content);
            const nextTabs = upsertTab(prev.openTabs, {
              path,
              content,
              language: extToLanguage(path),
              isDirty: false,
            });
            return {
              ...prev,
              fileTree: nextTree,
              openTabs: nextTabs,
              activeTab: path,
            };
          })
        );
      }

      // execute_command tool
      if (name === "execute_command" && status === "complete" && args?.command) {
        const entry: TerminalEntry = {
          command: args.command as string,
          output: coerceOutput(result),
          exitCode: (result as any)?.exitCode ?? null,
          timestamp: new Date().toISOString(),
        };
        queueMicrotask(() =>
          setState((prev) => ({
            ...prev,
            terminal: [...prev.terminal, entry],
          }))
        );
      }

      // Optional: gh tool outputs captured via execute_command results.
      if (name === "execute_command" && status === "complete" && args?.command && typeof args.command === "string") {
        const cmd = args.command as string;
        if (cmd.includes("gh issue list") && result) {
          try {
            const issuesJson = typeof result === "string" ? JSON.parse(result) : result;
            const issues: Issue[] = (issuesJson as any[]).map((i) => ({
              number: i.number,
              title: i.title,
              url: i.url,
              state: i.state,
              labels: (i.labels || []).map((l: any) => (typeof l === "string" ? l : l.name)),
              assignee: i.assignee?.login ?? null,
            }));
            const github: GitHubState = { ...state.github, issues };
            queueMicrotask(() => setState((prev) => ({ ...prev, github })));
          } catch {
            // ignore
          }
        }
        if (cmd.includes("gh pr list") && result) {
          try {
            const prsJson = typeof result === "string" ? JSON.parse(result) : result;
            const pullRequests: PullRequest[] = (prsJson as any[]).map((p) => ({
              number: p.number,
              title: p.title,
              url: p.url,
              state: p.state,
              isDraft: p.isDraft,
            }));
            const github: GitHubState = { ...state.github, pullRequests };
            queueMicrotask(() => setState((prev) => ({ ...prev, github })));
          } catch {
            // ignore
          }
        }
        if (cmd.startsWith("git status") && result) {
          const gitStatus: GitStatus = {
            branch: "",
            changes: [],
            ahead: 0,
            behind: 0,
          };
          queueMicrotask(() => setState((prev) => ({ ...prev, gitStatus })));
        }
      }

      return <ToolCard {...props} />;
    },
  });

  return (
    <div className="relative min-h-screen">
      <div className="abstract-bg">
        <div className="blob-3" />
      </div>

      <main className="relative z-10 h-screen flex overflow-hidden">
        <div className="w-[38%] h-full border-r border-[var(--color-border-glass)] bg-[var(--color-glass-dark)] backdrop-blur-xl overflow-hidden">
          <div className="h-full flex flex-col">
            <header style={{ padding: "var(--space-8)" }} className="border-b border-[var(--color-border-glass)]">
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

            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "var(--space-6)" }}>
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

        <div className="w-[62%] h-full overflow-hidden">
          <Workspace state={state} />
        </div>
      </main>
    </div>
  );
}

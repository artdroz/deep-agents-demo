"use client";

import { useRef, useState } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useDefaultTool } from "@copilotkit/react-core";

import { Workspace } from "@/components/Workspace";
import { ToolCard } from "@/components/ToolCard";
import type { WorkspaceState, Todo, TerminalEntry, TabState, FileNode } from "@/types/workspace";
import { INITIAL_STATE } from "@/types/workspace";

function upsertFileNode(tree: FileNode[], path: string, content?: string): FileNode[] {
  const parts = path.split("/").filter(Boolean);
  const root = [...tree];

  let currentChildren = root;
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const isLeaf = i === parts.length - 1;

    let node = currentChildren.find((n) => n.name === part);
    if (!node) {
      node = {
        name: part,
        path: currentPath,
        type: isLeaf ? "file" : "dir",
        ...(isLeaf ? { content } : { children: [] }),
      };
      currentChildren.push(node);
    }

    if (isLeaf) {
      node.type = "file";
      if (content !== undefined) node.content = content;
    } else {
      node.type = "dir";
      node.children = node.children || [];
      currentChildren = node.children;
    }
  }

  return root;
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return "text";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "js" || ext === "jsx") return "javascript";
  if (ext === "json") return "json";
  if (ext === "py") return "python";
  if (ext === "md") return "markdown";
  if (ext === "css") return "css";
  if (ext === "html") return "html";
  return ext;
}

export default function Page() {
  const [state, setState] = useState<WorkspaceState>(INITIAL_STATE);
  const processedKeysRef = useRef<Set<string>>(new Set());

  const openFileInEditor = (path: string) => {
    setState((prev) => {
      const fromTree = (() => {
        const find = (nodes: FileNode[]): FileNode | undefined => {
          for (const n of nodes) {
            if (n.path === path) return n;
            if (n.type === "dir" && n.children) {
              const got = find(n.children);
              if (got) return got;
            }
          }
          return undefined;
        };
        return find(prev.fileTree);
      })();

      const content = fromTree?.content ?? "";
      const existing = prev.openTabs.find((t) => t.path === path);
      const tab: TabState =
        existing ||
        ({
          path,
          content,
          language: languageFromPath(path),
          isDirty: false,
        } satisfies TabState);

      const openTabs = existing ? prev.openTabs : [...prev.openTabs, tab];
      return { ...prev, openTabs, activeTab: path };
    });
  };

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

      if (name === "write_todos" && status === "complete" && args?.todos) {
        const todosWithIds = (args.todos as Array<{ id?: string; content: string; status: string }>).map(
          (todo, index) => ({
            ...todo,
            id: todo.id || `todo-${Date.now()}-${index}`,
          })
        );
        queueMicrotask(() => setState((prev) => ({ ...prev, todos: todosWithIds as Todo[] })));
      }

      // file tool calls
      if (name === "write_file" && status === "complete" && args?.file_path) {
        const p = args.file_path as string;
        const c = (args.content as string) ?? "";
        queueMicrotask(() =>
          setState((prev) => {
            const fileTree = upsertFileNode(prev.fileTree, p, c);
            const existing = prev.openTabs.find((t) => t.path === p);
            const openTabs = existing
              ? prev.openTabs.map((t) => (t.path === p ? { ...t, content: c } : t))
              : prev.openTabs;
            return { ...prev, fileTree, openTabs };
          })
        );
      }

      if (name === "read_file" && status === "complete" && args?.file_path && typeof result === "string") {
        const p = args.file_path as string;
        const c = result;
        queueMicrotask(() =>
          setState((prev) => {
            const fileTree = upsertFileNode(prev.fileTree, p, c);
            const existing = prev.openTabs.find((t) => t.path === p);
            const openTabs = existing
              ? prev.openTabs.map((t) => (t.path === p ? { ...t, content: c } : t))
              : [...prev.openTabs, { path: p, content: c, language: languageFromPath(p), isDirty: false }];
            return { ...prev, fileTree, openTabs, activeTab: p };
          })
        );
      }

      if (name === "execute_command" && status === "complete" && args?.command) {
        const entry: TerminalEntry = {
          command: args.command as string,
          output: typeof result === "string" ? result : JSON.stringify(result ?? ""),
          exitCode: null,
          timestamp: new Date().toISOString(),
        };
        queueMicrotask(() => setState((prev) => ({ ...prev, terminal: [...prev.terminal, entry] })));
      }

      // naive git diff capture (if agent runs git diff via execute_command and returns a unified diff string)
      if (name === "execute_command" && status === "complete" && args?.command && typeof result === "string") {
        const cmd = (args.command as string).trim();
        if (cmd.startsWith("git diff")) {
          queueMicrotask(() =>
            setState((prev) => ({
              ...prev,
              gitStatus: {
                ...(prev.gitStatus || { branch: "", changes: [], ahead: 0, behind: 0 }),
                changes: [{ path: "(working tree)", status: "modified", diff: result }],
              },
            }))
          );
        }
      }

      return <ToolCard {...props} />;
    },
  });

  return (
    <div className="relative min-h-screen">
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
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
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
          <Workspace
            state={state}
            onOpenFile={(path) => openFileInEditor(path)}
            onSelectTab={(path) => setState((prev) => ({ ...prev, activeTab: path }))}
          />
        </div>
      </main>
    </div>
  );
}

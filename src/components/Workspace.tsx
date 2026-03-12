"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  ListTodo,
  TerminalSquare,
} from "lucide-react";
import type { FileNode, TabState, Todo, WorkspaceState } from "@/types/workspace";

interface WorkspaceProps {
  state: WorkspaceState;
}

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

function fileName(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function ensureDirPath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function upsertFileTree(root: FileNode[], filePath: string, content?: string): FileNode[] {
  const normalized = filePath.replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return root;

  // Immutable-ish copy along the way.
  const newRoot = [...root];

  let currentLevel = newRoot;
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    const existingIdx = currentLevel.findIndex((n) => n.name === part);

    if (isLast) {
      const node: FileNode = {
        name: part,
        path: currentPath,
        type: "file",
        content,
      };
      if (existingIdx >= 0) {
        const existing = currentLevel[existingIdx];
        currentLevel[existingIdx] = {
          ...existing,
          ...node,
          type: "file",
        };
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

  // Sort: dirs first, then files.
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

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="workspace-section">
      <button onClick={() => setIsOpen(!isOpen)} className="workspace-section-header w-full">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="font-semibold text-[var(--color-text-primary)]">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        )}
      </button>
      {isOpen && <div className="workspace-section-content">{children}</div>}
    </div>
  );
}

function TodoList({ todos }: { todos: Todo[] }) {
  if (todos.length === 0) return <div className="text-sm text-[var(--color-text-tertiary)]">No tasks</div>;
  return (
    <div className="space-y-1">
      {todos.map((t) => (
        <div key={t.id} className="text-sm">
          <span className="text-[var(--color-text-secondary)]">[{t.status}]</span> {t.content}
        </div>
      ))}
    </div>
  );
}

function FileTree({
  nodes,
  onOpen,
  depth = 0,
}: {
  nodes: FileNode[];
  onOpen: (node: FileNode) => void;
  depth?: number;
}) {
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});

  return (
    <div>
      {nodes.map((n) => {
        const isDir = n.type === "dir";
        const isOpen = !!openDirs[n.path];
        return (
          <div key={n.path} style={{ paddingLeft: depth * 12 }}>
            <button
              className="w-full flex items-center gap-2 py-1 rounded hover:bg-[var(--color-glass-subtle)]"
              onClick={() => {
                if (isDir) setOpenDirs((p) => ({ ...p, [n.path]: !isOpen }));
                else onOpen(n);
              }}
            >
              {isDir ? <Folder className="w-4 h-4" /> : <File className="w-4 h-4" />}
              <span className="text-sm truncate">{n.name}</span>
            </button>
            {isDir && isOpen && n.children && n.children.length > 0 && (
              <FileTree nodes={n.children} onOpen={onOpen} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Tabs({
  tabs,
  activePath,
  onActivate,
}: {
  tabs: TabState[];
  activePath: string | null;
  onActivate: (path: string) => void;
}) {
  if (tabs.length === 0) {
    return <div className="text-sm text-[var(--color-text-tertiary)]">No files open</div>;
  }
  return (
    <div className="flex gap-1 border-b border-[var(--color-border-glass)] overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.path}
          onClick={() => onActivate(t.path)}
          className={`px-3 py-2 text-sm whitespace-nowrap ${
            t.path === activePath ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {fileName(t.path)}{t.isDirty ? " *" : ""}
        </button>
      ))}
    </div>
  );
}

function Editor({ tab }: { tab: TabState | null }) {
  if (!tab) {
    return <div className="h-full p-4 text-sm text-[var(--color-text-tertiary)]">Select a file to view</div>;
  }
  return (
    <div className="h-full overflow-auto">
      <pre className="p-4 text-xs leading-5 font-mono whitespace-pre">
        <code>{tab.content}</code>
      </pre>
    </div>
  );
}

function TerminalPanel({ entries }: { entries: WorkspaceState["terminal"] }) {
  if (entries.length === 0) {
    return <div className="text-sm text-[var(--color-text-tertiary)]">No terminal output yet</div>;
  }
  return (
    <div className="space-y-3">
      {entries.slice(-20).map((e, idx) => (
        <div key={`${e.timestamp}-${idx}`} className="rounded border border-[var(--color-border-glass)] overflow-hidden">
          <div className="px-3 py-2 text-xs bg-[var(--color-glass-dark)] border-b border-[var(--color-border-glass)] font-mono">
            $ {e.command}
          </div>
          <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
            <code>{e.output}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}

export function Workspace({ state }: WorkspaceProps) {
  const [localTree, setLocalTree] = useState<FileNode[]>(state.fileTree);
  const [localTabs, setLocalTabs] = useState<TabState[]>(state.openTabs);
  const [activeTab, setActiveTab] = useState<string | null>(state.activeTab);

  // Merge in any external state updates.
  useMemo(() => {
    setLocalTree(state.fileTree);
    setLocalTabs(state.openTabs);
    setActiveTab(state.activeTab);
  }, [state.fileTree, state.openTabs, state.activeTab]);

  const active = localTabs.find((t) => t.path === activeTab) || null;

  return (
    <div className="workspace-panel p-4 h-full flex flex-col">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Workspace</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Files, editor, terminal</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-3">
        {/* Left: sidebar */}
        <div className="min-h-0 overflow-auto">
          <Section title="Files" icon={Folder}>
            <FileTree
              nodes={localTree}
              onOpen={(node) => {
                const tab: TabState = {
                  path: node.path,
                  content: node.content ?? "",
                  language: extToLanguage(node.path),
                  isDirty: false,
                };
                setLocalTree((t) => upsertFileTree(t, node.path, node.content));
                setLocalTabs((tabs) => upsertTab(tabs, tab));
                setActiveTab(node.path);
              }}
            />
          </Section>

          <Section title="Todos" icon={ListTodo} defaultOpen={false}>
            <TodoList todos={state.todos} />
          </Section>
        </div>

        {/* Center: editor + bottom terminal */}
        <div className="min-h-0 flex flex-col rounded border border-[var(--color-border-glass)] overflow-hidden">
          <Tabs tabs={localTabs} activePath={activeTab} onActivate={setActiveTab} />
          <div className="flex-1 min-h-0 bg-[var(--color-glass-dark)]">
            <Editor tab={active} />
          </div>
          <div className="border-t border-[var(--color-border-glass)] bg-[var(--color-glass-subtle)] p-3 max-h-[35%] overflow-auto">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <TerminalSquare className="w-4 h-4" /> Terminal
            </div>
            <TerminalPanel entries={state.terminal} />
          </div>
        </div>
      </div>
    </div>
  );
}

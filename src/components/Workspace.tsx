"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  ListTodo,
  Terminal as TerminalIcon,
  GitDiff,
} from "lucide-react";

import type { FileNode, TabState, TerminalEntry, Todo, WorkspaceState } from "@/types/workspace";

interface WorkspaceProps {
  state: WorkspaceState;
  onOpenFile?: (path: string) => void;
  onSelectTab?: (path: string) => void;
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="workspace-section">
      <button onClick={() => setIsOpen(!isOpen)} className="workspace-section-header w-full">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="font-semibold text-[var(--color-text-primary)]">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-[var(--color-background)]">
              {badge}
            </span>
          )}
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
  if (!todos.length) return <div className="text-xs text-[var(--color-text-tertiary)]">No tasks yet</div>;
  return (
    <div className="space-y-1">
      {todos.map((t) => (
        <div key={t.id} className="text-sm flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">•</span>
          <span className={t.status === "completed" ? "line-through opacity-70" : ""}>{t.content}</span>
        </div>
      ))}
    </div>
  );
}

function fileTreeToList(nodes: FileNode[], out: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.type === "dir" && n.children) fileTreeToList(n.children, out);
  }
  return out;
}

function FileTree({ nodes, onOpenFile }: { nodes: FileNode[]; onOpenFile?: (path: string) => void }) {
  if (!nodes.length) {
    return <div className="text-xs text-[var(--color-text-tertiary)]">No files yet</div>;
  }

  const Row = ({ node, depth }: { node: FileNode; depth: number }) => {
    const [open, setOpen] = useState(true);
    const isDir = node.type === "dir";
    return (
      <div>
        <div
          className="flex items-center gap-2 text-sm py-1 rounded hover:bg-[var(--color-glass-subtle)] cursor-pointer"
          style={{ paddingLeft: `calc(var(--space-2) + ${depth} * 14px)` }}
          onClick={() => {
            if (isDir) setOpen((v) => !v);
            else onOpenFile?.(node.path);
          }}
        >
          {isDir ? (
            <Folder className="w-4 h-4 text-[var(--color-text-secondary)]" />
          ) : (
            <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />
          )}
          <span className="truncate" title={node.path}>
            {node.name}
          </span>
        </div>
        {isDir && open && node.children?.map((c) => <Row key={c.path} node={c} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="select-none">
      {nodes.map((n) => (
        <Row key={n.path} node={n} depth={0} />
      ))}
    </div>
  );
}

function Tabs({ tabs, activeTab, onSelect }: { tabs: TabState[]; activeTab: string | null; onSelect?: (path: string) => void }) {
  if (!tabs.length) {
    return <div className="text-xs text-[var(--color-text-tertiary)]">Open a file to start editing</div>;
  }

  return (
    <div className="flex items-center gap-1 overflow-auto">
      {tabs.map((t) => {
        const name = t.path.split("/").pop() || t.path;
        const isActive = t.path === activeTab;
        return (
          <button
            key={t.path}
            onClick={() => onSelect?.(t.path)}
            className={
              "px-3 py-1.5 text-sm rounded-t border " +
              (isActive
                ? "bg-[var(--color-glass-subtle)] border-[var(--color-border-glass)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]")
            }
            title={t.path}
          >
            {name}
            {t.isDirty ? " *" : ""}
          </button>
        );
      })}
    </div>
  );
}

function Editor({ tab }: { tab: TabState | null }) {
  if (!tab) return <div className="text-xs text-[var(--color-text-tertiary)]">No file selected</div>;
  return (
    <pre className="text-xs whitespace-pre overflow-auto p-3 rounded border border-[var(--color-border-glass)] bg-[var(--color-glass-dark)]">
      <code>{tab.content}</code>
    </pre>
  );
}

function Terminal({ entries }: { entries: TerminalEntry[] }) {
  if (!entries.length) return <div className="text-xs text-[var(--color-text-tertiary)]">No commands run yet</div>;
  return (
    <div className="space-y-3">
      {entries.map((e, idx) => (
        <div key={`${e.timestamp}-${idx}`} className="text-xs">
          <div className="font-mono text-[var(--color-text-secondary)]">$ {e.command}</div>
          <pre className="font-mono whitespace-pre-wrap mt-1 text-[var(--color-text-primary)] opacity-90">{e.output}</pre>
        </div>
      ))}
    </div>
  );
}

function FilesChanged({ diffText }: { diffText: string }) {
  if (!diffText.trim()) {
    return <div className="text-xs text-[var(--color-text-tertiary)]">No diffs captured yet</div>;
  }
  return (
    <pre className="text-xs whitespace-pre overflow-auto p-3 rounded border border-[var(--color-border-glass)] bg-[var(--color-glass-dark)]">
      <code>{diffText}</code>
    </pre>
  );
}

export function Workspace({ state, onOpenFile, onSelectTab }: WorkspaceProps) {
  const [activeBottom, setActiveBottom] = useState<"terminal" | "diff">("terminal");

  const activeTab = useMemo(() => {
    if (!state.activeTab) return null;
    return state.openTabs.find((t) => t.path === state.activeTab) || null;
  }, [state.activeTab, state.openTabs]);

  const diffText = useMemo(() => {
    const parts: string[] = [];
    for (const ch of state.gitStatus?.changes || []) {
      if (ch.diff) {
        parts.push(`--- ${ch.path}\n${ch.diff}`);
      }
    }
    return parts.join("\n\n");
  }, [state.gitStatus]);

  // fallback: if fileTree is empty but tabs exist, render a flat tree
  const derivedTree = useMemo(() => {
    if (state.fileTree.length) return state.fileTree;
    const nodes = state.openTabs.map<FileNode>((t) => ({
      name: t.path.split("/").pop() || t.path,
      path: t.path,
      type: "file",
      content: t.content,
    }));
    return nodes;
  }, [state.fileTree, state.openTabs]);

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: "260px 1fr", gridTemplateRows: "1fr 220px" }}>
      {/* Left sidebar */}
      <div className="border-r border-[var(--color-border-glass)] overflow-auto p-3">
        <Section title="Todo" icon={ListTodo} badge={state.todos.length} defaultOpen>
          <TodoList todos={state.todos} />
        </Section>
        <Section title="Files" icon={Folder} badge={fileTreeToList(derivedTree, []).filter((n) => n.type === "file").length} defaultOpen>
          <FileTree nodes={derivedTree} onOpenFile={onOpenFile} />
        </Section>
      </div>

      {/* Editor area */}
      <div className="overflow-hidden flex flex-col">
        <div className="border-b border-[var(--color-border-glass)] px-3 pt-2">
          <Tabs tabs={state.openTabs} activeTab={state.activeTab} onSelect={onSelectTab} />
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <Editor tab={activeTab} />
        </div>
      </div>

      {/* Bottom panel (spans across editor only) */}
      <div className="col-start-2 col-end-3 border-t border-[var(--color-border-glass)] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-glass)]">
          <button
            onClick={() => setActiveBottom("terminal")}
            className={
              "text-sm px-2 py-1 rounded flex items-center gap-2 " +
              (activeBottom === "terminal" ? "bg-[var(--color-glass-subtle)]" : "hover:bg-[var(--color-glass-subtle)] opacity-80")
            }
          >
            <TerminalIcon className="w-4 h-4" /> Terminal
          </button>
          <button
            onClick={() => setActiveBottom("diff")}
            className={
              "text-sm px-2 py-1 rounded flex items-center gap-2 " +
              (activeBottom === "diff" ? "bg-[var(--color-glass-subtle)]" : "hover:bg-[var(--color-glass-subtle)] opacity-80")
            }
          >
            <GitDiff className="w-4 h-4" /> Files Changed
          </button>
          <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">{state.gitStatus?.branch ? `branch: ${state.gitStatus.branch}` : ""}</div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {activeBottom === "terminal" ? <Terminal entries={state.terminal} /> : <FilesChanged diffText={diffText} />}
        </div>
      </div>

      {/* Empty bottom-left to align grid */}
      <div className="col-start-1 col-end-2 row-start-2 row-end-3 border-t border-r border-[var(--color-border-glass)] bg-transparent" />
    </div>
  );
}

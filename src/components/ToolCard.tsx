"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Pencil,
  ClipboardList,
  Search,
  Save,
  BookOpen,
  Check,
  X,
  Loader2,
  Terminal,
  FileDiff,
} from "lucide-react";

/**
 * ToolCard - Generative UI for tool call rendering in chat.
 *
 * Two rendering modes:
 * - SpecializedToolCard: Emoji-based cards for known tools with result previews
 * - DefaultToolCard: Generic JSON display for unknown tools
 *
 * Result structures expected from backend:
 * - internet_search: Array<{url, title, content, raw_content}>
 * - write_todos: { todos: Array<{id, content, status}> }
 * - write_file: just args (path, content) - result is confirmation
 * - task: completion message
 */

interface ToolCardProps {
  name: string;
  status: "inProgress" | "executing" | "complete";
  args: Record<string, unknown>;
  result?: unknown;
}

function getStatusMeta(status: ToolCardProps["status"]) {
  if (status === "complete") {
    return {
      label: "complete",
      icon: Check,
      iconClassName: "",
      iconStyle: { color: "var(--color-success)" } as React.CSSProperties,
    };
  }
  if (status === "executing") {
    return {
      label: "executing",
      icon: Loader2,
      iconClassName: "animate-spin",
      iconStyle: { color: "var(--color-accent)" } as React.CSSProperties,
    };
  }
  return {
    label: "in progress",
    icon: Loader2,
    iconClassName: "animate-spin",
    iconStyle: { color: "var(--color-accent)" } as React.CSSProperties,
  };
}

function isErrorResult(result: unknown): boolean {
  if (!result) return false;
  if (typeof result === "string") return result.toLowerCase().includes("error");
  if (typeof result !== "object") return false;
  return (
    "error" in result ||
    "stderr" in result ||
    "stack" in result ||
    ("exitCode" in result && (result as { exitCode?: unknown }).exitCode !== 0)
  );
}

function languageFromPath(path?: string): string {
  if (!path) return "text";
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return "text";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    sh: "bash",
    bash: "bash",
  };
  return map[ext] || ext;
}

function toLines(input: unknown): string[] {
  if (input == null) return [];
  if (typeof input === "string") return input.split("\n");
  try {
    return JSON.stringify(input, null, 2).split("\n");
  } catch {
    return String(input).split("\n");
  }
}

function CollapsibleLines({
  lines,
  defaultExpanded = false,
}: {
  lines: string[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const shouldCollapse = lines.length > 30;
  const visibleLines = useMemo(() => {
    if (!shouldCollapse || expanded) return lines;
    return lines.slice(0, 30);
  }, [expanded, lines, shouldCollapse]);

  return (
    <div>
      <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto border border-[var(--color-border)]">
        {visibleLines.join("\n")}
      </pre>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {expanded ? "Collapse" : `Expand (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

// Tool configuration mapping
const TOOL_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{
      size?: number;
      strokeWidth?: number;
      className?: string;
      style?: React.CSSProperties;
    }>;
    getDisplayText: (args: Record<string, unknown>) => string;
    getResultSummary?: (result: unknown, args: Record<string, unknown>) => string | null;
  }
> = {
  write_todos: {
    icon: Pencil,
    getDisplayText: () => "Updating research plan...",
    // Args contains the todos array (result is a Command with ToolMessage string)
    getResultSummary: (_result, args) => {
      const todos = (args as { todos?: unknown[] })?.todos;
      if (Array.isArray(todos)) {
        return `${todos.length} todo${todos.length !== 1 ? "s" : ""} updated`;
      }
      return null;
    },
  },
  read_todos: {
    icon: ClipboardList,
    getDisplayText: () => "Checking research plan...",
    getResultSummary: (result) => {
      const todos = (result as { todos?: unknown[] })?.todos;
      if (Array.isArray(todos)) {
        return `${todos.length} todo${todos.length !== 1 ? "s" : ""} found`;
      }
      return null;
    },
  },
  research: {
    icon: Search,
    getDisplayText: (args) =>
      `Researching: ${((args.query as string) || "...").slice(0, 50)}${
        (args.query as string)?.length > 50 ? "..." : ""
      }`,
    // Result is now a dict with summary and sources
    getResultSummary: (result) => {
      if (result && typeof result === "object" && "sources" in result) {
        const { sources } = result as { summary: string; sources: unknown[] };
        return `Found ${sources.length} source${sources.length !== 1 ? "s" : ""}`;
      }
      return "Research complete";
    },
  },
  write_file: {
    icon: Save,
    getDisplayText: (args) => {
      const path = (args.path as string | undefined) || (args.file_path as string | undefined);
      const filename = path?.split("/").pop() || (args.filename as string | undefined);
      return `Writing: ${filename || "file"}`;
    },
    // Show first line preview from args (content is in args, not result)
    getResultSummary: (_result, args) => {
      const content = args.content as string | undefined;
      if (content) {
        const firstLine = content.split("\n")[0].slice(0, 50);
        return firstLine + (content.length > 50 ? "..." : "");
      }
      return "File written";
    },
  },
  read_file: {
    icon: BookOpen,
    getDisplayText: (args) => {
      const path = (args.path as string | undefined) || (args.file_path as string | undefined);
      const filename = path?.split("/").pop() || (args.filename as string | undefined);
      return `Reading: ${filename || "file"}`;
    },
    getResultSummary: (result) => {
      const content = (result as { content?: string })?.content;
      if (content && typeof content === "string") {
        const preview = content.slice(0, 50);
        return preview + (content.length > 50 ? "..." : "");
      }
      return null;
    },
  },
  execute_command: {
    icon: Terminal,
    getDisplayText: (args) => {
      const cmd = (args.command as string) || "command";
      return `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? "..." : ""}`;
    },
    getResultSummary: (result) => {
      if (result && typeof result === "object" && "exitCode" in result) {
        const ec = (result as { exitCode?: number }).exitCode;
        if (typeof ec === "number") return ec === 0 ? "Exit 0" : `Exit ${ec}`;
      }
      return null;
    },
  },
};

export function ToolCard({ name, status, args, result }: ToolCardProps) {
  const config = TOOL_CONFIG[name];

  if (config) {
    return <SpecializedToolCard name={name} status={status} args={args} result={result} config={config} />;
  }

  return <DefaultToolCard name={name} status={status} args={args} result={result} />;
}

interface SpecializedToolCardProps extends ToolCardProps {
  config: {
    icon: React.ComponentType<{
      size?: number;
      strokeWidth?: number;
      className?: string;
      style?: React.CSSProperties;
    }>;
    getDisplayText: (args: Record<string, unknown>) => string;
    getResultSummary?: (result: unknown, args: Record<string, unknown>) => string | null;
  };
}

function SpecializedToolCard({ name, status, args, result, config }: SpecializedToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = status === "complete";
  const statusMeta = getStatusMeta(status);
  const hasError = isComplete && isErrorResult(result);

  // Get result summary for completed tools
  const resultSummary =
    isComplete && config.getResultSummary ? config.getResultSummary(result, args) : null;

  // All completed tools can expand for details
  const hasExpandableContent = isComplete;

  return (
    <div
      className={`
        glass-subtle
        transition-all duration-200
        ${isComplete ? "opacity-80" : ""}
        ${hasExpandableContent ? "cursor-pointer" : ""}
      `}
      style={{
        padding: "var(--space-4)",
        marginBottom: "var(--space-2)",
      }}
      onClick={hasExpandableContent ? () => setExpanded(!expanded) : undefined}
    >
      <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isComplete
              ? hasError
                ? "rgba(220, 38, 38, 0.12)"
                : "rgba(21, 128, 61, 0.1)"
              : "rgba(217, 119, 6, 0.1)",
          }}
        >
          {isComplete ? (
            hasError ? (
              <X size={16} strokeWidth={2} style={{ color: "#ef4444" }} />
            ) : (
              <Check size={16} strokeWidth={2} style={{ color: "var(--color-success)" }} />
            )
          ) : (
            <statusMeta.icon
              size={16}
              strokeWidth={2}
              className={statusMeta.iconClassName}
              style={statusMeta.iconStyle}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`
              text-sm font-medium
              ${isComplete ? "text-[var(--color-text-tertiary)]" : "text-[var(--color-text-primary)]"}
            `}
          >
            {config.getDisplayText(args)}
          </p>
          {/* Result summary shown below the display text when complete */}
          {resultSummary && (
            <p className="text-xs mt-0.5" style={{ color: hasError ? "#ef4444" : "var(--color-success)" }}>
              {resultSummary}
            </p>
          )}
        </div>
        {/* Expand indicator for expandable tools */}
        {hasExpandableContent && (
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </div>

      {/* Expanded details section */}
      {expanded && isComplete && (
        <div
          style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)" }}
          className="border-t border-[var(--color-border-glass)]"
        >
          <ExpandedDetails name={name} result={result} args={args} />
        </div>
      )}
    </div>
  );
}

/**
 * Renders expanded details based on tool type.
 * Each tool has its own structured view of the result.
 */
function ExpandedDetails({
  name,
  result,
  args,
}: {
  name: string;
  result: unknown;
  args: Record<string, unknown>;
}) {
  // execute_command: render a terminal-like block
  if (name === "execute_command") {
    const cmd = (args.command as string) || "";
    const stdout = (result as { stdout?: unknown })?.stdout;
    const stderr = (result as { stderr?: unknown })?.stderr;
    const exitCode = (result as { exitCode?: unknown })?.exitCode;

    return (
      <div className="space-y-2">
        <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
          <Terminal size={14} />
          <span>Terminal</span>
        </div>
        <div className="text-xs bg-[var(--color-container)] rounded-md border border-[var(--color-border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--color-border)] font-mono">
            <span className="text-[var(--color-text-tertiary)]">$</span>{" "}
            <span className="text-[var(--color-text-primary)]">{cmd}</span>
          </div>
          <div className="p-3 font-mono space-y-3">
            {stdout != null && toLines(stdout).length > 0 && (
              <div>
                <p className="text-[var(--color-text-tertiary)] mb-1">stdout</p>
                <CollapsibleLines lines={toLines(stdout)} />
              </div>
            )}
            {stderr != null && toLines(stderr).length > 0 && (
              <div>
                <p className="text-[var(--color-text-tertiary)] mb-1">stderr</p>
                <div className="text-red-400">
                  <CollapsibleLines lines={toLines(stderr)} />
                </div>
              </div>
            )}
            {exitCode !== undefined && (
              <p className="text-[var(--color-text-tertiary)]">exit: {String(exitCode)}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // read_file: show code content with line numbers
  if (name === "read_file") {
    const path = (args.path as string | undefined) || (args.file_path as string | undefined);
    const content = (result as { content?: unknown })?.content;
    const lines = toLines(typeof content === "string" ? content : content ?? "");
    const lang = languageFromPath(path);

    return (
      <div className="space-y-2">
        <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
          <BookOpen size={14} />
          <span>{path || "file"}</span>
          <span className="ml-auto">{lang}</span>
        </div>
        <div className="text-xs bg-[var(--color-container)] rounded-md border border-[var(--color-border)] overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: "auto 1fr" }}>
            <div className="select-none text-right px-2 py-2 border-r border-[var(--color-border)] text-[var(--color-text-tertiary)] font-mono">
              {lines.map((_, i) => (
                <div key={i} style={{ lineHeight: "1.5" }}>
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="px-3 py-2 font-mono overflow-auto">
              <CollapsibleLines lines={lines} defaultExpanded={lines.length <= 30} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // write_file: show "diff" style before/after preview
  if (name === "write_file") {
    const path = (args.path as string | undefined) || (args.file_path as string | undefined);
    const newContent = args.content as string | undefined;
    const before = (result as { before?: unknown })?.before;
    const after = (result as { after?: unknown })?.after;

    const beforeLines = toLines(typeof before === "string" ? before : before ?? "");
    const afterLines = toLines(typeof after === "string" ? after : after ?? newContent ?? "");
    const lang = languageFromPath(path);

    return (
      <div className="space-y-2">
        <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
          <FileDiff size={14} />
          <span>{path || "file"}</span>
          <span className="ml-auto">{lang}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="text-xs bg-[var(--color-container)] rounded-md border border-[var(--color-border)] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--color-border)] text-[var(--color-text-tertiary)]">Before</div>
            <div className="p-3 font-mono">
              <CollapsibleLines lines={beforeLines.length ? beforeLines : ["(unavailable)"]} />
            </div>
          </div>
          <div className="text-xs bg-[var(--color-container)] rounded-md border border-[var(--color-border)] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--color-border)] text-[var(--color-text-tertiary)]">After</div>
            <div className="p-3 font-mono">
              <CollapsibleLines lines={afterLines.length ? afterLines : ["(empty)"]} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // research: show the full prose summary
  if (name === "research") {
    // Extract summary from object or use string directly
    const summary =
      typeof result === "object" && result && "summary" in result
        ? (result as { summary: string; sources: unknown[] }).summary
        : typeof result === "string"
          ? result
          : "";
    if (!summary) return <p className="text-xs text-[var(--color-text-tertiary)]">No findings</p>;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Query:</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{(args.query as string) || "..."}</p>
        <p className="text-xs font-medium text-[var(--color-text-tertiary)] mt-2">Findings:</p>
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{summary}</p>
      </div>
    );
  }

  // write_todos: show todo list (from args, not result)
  if (name === "write_todos") {
    const todos = (args as { todos?: Array<{ id: string; content: string; status: string }> })?.todos;
    if (!todos?.length) return <p className="text-xs text-[var(--color-text-tertiary)]">No todos</p>;
    return (
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {todos.map((todo, i) => (
          <div key={todo.id || i} className="flex items-start gap-2 text-xs">
            <span
              className="mt-0.5"
              style={{
                color:
                  todo.status === "completed"
                    ? "var(--color-success)"
                    : todo.status === "in_progress"
                      ? "var(--color-accent-dark)"
                      : "var(--color-text-tertiary)",
              }}
            >
              {todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "●" : "○"}
            </span>
            <span className={todo.status === "completed" ? "line-through text-[var(--color-text-tertiary)]" : ""}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: JSON display
  return <CollapsibleLines lines={toLines(typeof result === "string" ? result : result)} />;
}

function DefaultToolCard({ name, status, args, result }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = status === "complete";

  return (
    <div className="glass-subtle p-3 my-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center
              text-lg
              ${isComplete ? "bg-[var(--color-mint)]/20" : "bg-[var(--color-lilac)]/20"}
            `}
          >
            {isComplete ? "✓" : "⚙️"}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-sm text-[var(--color-text-primary)]">{name}</code>
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full
                ${
                  isComplete
                    ? "bg-[var(--color-mint)]/20 text-[var(--color-mint-dark)]"
                    : "bg-[var(--color-lilac)]/20 text-[var(--color-lilac-dark)]"
                }
              `}
            >
              {status}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Arguments:</p>
            <CollapsibleLines lines={toLines(args)} />
          </div>
          {result !== undefined && result !== null && (
            <div>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Result:</p>
              <CollapsibleLines lines={toLines(typeof result === "string" ? result : result)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

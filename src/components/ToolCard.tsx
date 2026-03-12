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
  Terminal,
} from "lucide-react";

interface ToolCardProps {
  name: string;
  status: "inProgress" | "executing" | "complete";
  args: Record<string, unknown>;
  result?: unknown;
}

type ToolStatus = ToolCardProps["status"];

function isErrorResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  return "error" in result || "stderr" in result;
}

function getStatusBadge(
  status: ToolStatus,
  result?: unknown
): { label: string; tone: "loading" | "success" | "error" } {
  if (status === "complete") {
    return isErrorResult(result)
      ? { label: "error", tone: "error" }
      : { label: "success", tone: "success" };
  }
  return { label: status, tone: "loading" };
}

function getLanguageFromPath(path: string | undefined): string {
  if (!path) return "text";
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    case "yml":
    case "yaml":
      return "yaml";
    case "sh":
    case "bash":
      return "bash";
    default:
      return ext || "text";
  }
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

function withLineNumbers(text: string): string {
  const lines = text.split("\n");
  const pad = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(pad, " ")} | ${line}`).join("\n");
}

function createSimpleDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) {
      if (a !== undefined) out.push(`  ${a}`);
      continue;
    }
    if (b !== undefined) out.push(`- ${b}`);
    if (a !== undefined) out.push(`+ ${a}`);
  }
  return out.join("\n");
}

function CollapsibleTextBlock({
  text,
  defaultCollapsed = true,
  maxLines = 30,
  className,
}: {
  text: string;
  defaultCollapsed?: boolean;
  maxLines?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const lines = useMemo(() => countLines(text), [text]);
  const shouldCollapse = lines > maxLines;

  const shownText = useMemo(() => {
    if (!shouldCollapse || open) return text;
    return text.split("\n").slice(0, maxLines).join("\n");
  }, [text, shouldCollapse, open, maxLines]);

  return (
    <div>
      <pre className={className}>{shownText}</pre>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {open ? "Collapse" : `Expand (${lines} lines)`}
        </button>
      )}
    </div>
  );
}

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
      const cmd = (args.command as string) || (args.cmd as string) || "(command)";
      return `Running: ${cmd.slice(0, 60)}${cmd.length > 60 ? "..." : ""}`;
    },
    getResultSummary: (result) => {
      const exitCode =
        (result as { exitCode?: number; exit_code?: number })?.exitCode ??
        (result as { exit_code?: number })?.exit_code;
      if (typeof exitCode === "number") return `exit ${exitCode}`;
      if (typeof result === "string") return result.slice(0, 50) + (result.length > 50 ? "..." : "");
      return null;
    },
  },
};

export function ToolCard({ name, status, args, result }: ToolCardProps) {
  const config = TOOL_CONFIG[name];

  if (config) {
    return (
      <SpecializedToolCard
        name={name}
        status={status}
        args={args}
        result={result}
        config={config}
      />
    );
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
  const isExecuting = status === "inProgress" || status === "executing";
  const badge = getStatusBadge(status, result);

  const resultSummary =
    isComplete && config.getResultSummary ? config.getResultSummary(result, args) : null;

  const hasExpandableContent =
    isComplete &&
    (name === "research" ||
      name === "write_todos" ||
      name === "read_file" ||
      name === "write_file" ||
      name === "execute_command");

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
            background: isComplete ? "rgba(21, 128, 61, 0.1)" : "rgba(217, 119, 6, 0.1)",
          }}
        >
          {isComplete ? (
            <Check size={16} strokeWidth={2} style={{ color: "var(--color-success)" }} />
          ) : (
            <config.icon
              size={16}
              strokeWidth={2}
              className={isExecuting ? "animate-spin-slow" : ""}
              style={{ color: "var(--color-accent)" }}
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
          {resultSummary && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-success)" }}>
              {resultSummary}
            </p>
          )}
          <span
            className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              borderColor:
                badge.tone === "success"
                  ? "rgba(21, 128, 61, 0.35)"
                  : badge.tone === "error"
                    ? "rgba(220, 38, 38, 0.35)"
                    : "rgba(217, 119, 6, 0.35)",
              color:
                badge.tone === "success"
                  ? "var(--color-success)"
                  : badge.tone === "error"
                    ? "rgb(248 113 113)"
                    : "var(--color-accent)",
              background:
                badge.tone === "success"
                  ? "rgba(21, 128, 61, 0.08)"
                  : badge.tone === "error"
                    ? "rgba(220, 38, 38, 0.08)"
                    : "rgba(217, 119, 6, 0.08)",
            }}
          >
            {badge.label}
          </span>
        </div>
        {hasExpandableContent && (
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </div>

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

function ExpandedDetails({
  name,
  result,
  args,
}: {
  name: string;
  result: unknown;
  args: Record<string, unknown>;
}) {
  if (name === "research") {
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
            <span
              className={todo.status === "completed" ? "line-through text-[var(--color-text-tertiary)]" : ""}
            >
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (name === "read_file") {
    const path = (args.path as string | undefined) || (args.file_path as string | undefined);
    const language = getLanguageFromPath(path);
    const content = (result as { content?: string })?.content;
    if (!content) return <p className="text-xs text-[var(--color-text-tertiary)]">No file content</p>;
    return <CodeBlock title={path || "File"} language={language} text={withLineNumbers(content)} />;
  }

  if (name === "write_file") {
    const path = (args.path as string | undefined) || (args.file_path as string | undefined);
    const language = getLanguageFromPath(path);

    const after = (args.content as string | undefined) || "";

    const before =
      (result as { before?: string; previous?: string; old_content?: string })?.before ||
      (result as { previous?: string })?.previous ||
      (result as { old_content?: string })?.old_content ||
      "";

    const diffText = before ? createSimpleDiff(before, after) : `+ ${after}`;

    return <CodeBlock title={`${path || "File"} (diff)`} language={language} text={diffText} />;
  }

  if (name === "execute_command") {
    const command = (args.command as string) || (args.cmd as string) || "";
    const stdout =
      (result as { stdout?: string; output?: string })?.stdout ||
      (result as { output?: string })?.output ||
      (typeof result === "string" ? result : "");
    const stderr =
      (result as { stderr?: string })?.stderr || (result as { error?: string })?.error || "";

    return <TerminalBlock command={command} stdout={stdout || ""} stderr={stderr || ""} />;
  }

  return (
    <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto max-h-32 border border-[var(--color-border)]">
      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
    </pre>
  );
}

function CodeBlock({
  title,
  language,
  text,
}: {
  title?: string;
  language: string;
  text: string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      {title && (
        <div className="px-3 py-2 text-xs font-medium border-b border-[var(--color-border)] bg-[var(--color-container)] text-[var(--color-text-secondary)]">
          {title}
        </div>
      )}
      <div className="p-3 bg-[var(--color-container)]">
        <CollapsibleTextBlock text={text} className="text-xs overflow-auto whitespace-pre font-mono" />
        <div className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">language: {language}</div>
      </div>
    </div>
  );
}

function TerminalBlock({
  command,
  stdout,
  stderr,
}: {
  command: string;
  stdout: string;
  stderr: string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      <div className="px-3 py-2 text-xs font-medium border-b border-[var(--color-border)] bg-[var(--color-container)] text-[var(--color-text-secondary)]">
        Terminal
      </div>
      <div className="p-3 bg-black/30">
        <CollapsibleTextBlock
          text={[`$ ${command}`, stdout ? stdout.trimEnd() : "", stderr ? `\n${stderr.trimEnd()}` : ""]
            .filter(Boolean)
            .join("\n")}
          className="text-xs overflow-auto whitespace-pre font-mono text-[var(--color-text-primary)]"
        />
        {stderr && <div className="mt-2 text-xs font-mono text-red-300">stderr present</div>}
      </div>
    </div>
  );
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
          type="button"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Arguments:</p>
            <CollapsibleTextBlock
              text={JSON.stringify(args, null, 2)}
              className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto whitespace-pre max-h-32 border border-[var(--color-border)]"
            />
          </div>
          {result !== undefined && result !== null && (
            <div>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Result:</p>
              <CollapsibleTextBlock
                text={typeof result === "string" ? result : JSON.stringify(result, null, 2)}
                className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto whitespace-pre max-h-32 border border-[var(--color-border)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

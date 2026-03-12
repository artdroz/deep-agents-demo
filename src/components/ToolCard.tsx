"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Check,
  Terminal,
  BookOpen,
  Save,
  Search,
  ClipboardList,
  Pencil,
  X,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ToolCardProps {
  name: string;
  status: "inProgress" | "executing" | "complete";
  args: Record<string, unknown>;
  result?: unknown;
}

type ToolStatus = ToolCardProps["status"];

const MAX_VISIBLE_LINES = 30;

function getLanguageFromPath(path?: string): string {
  if (!path) return "text";
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
    case "yml":
    case "yaml":
      return "yaml";
    case "sh":
    case "bash":
      return "bash";
    default:
      return "text";
  }
}

function toStringSafe(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

function truncateLines(text: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = (text || "").split("\n");
  if (lines.length <= maxLines) return { text, truncated: false };
  return { text: lines.slice(0, maxLines).join("\n"), truncated: true };
}

function ToolStatusIcon({ status }: { status: ToolStatus }) {
  if (status === "complete") return <Check size={16} strokeWidth={2} className="text-[var(--color-success)]" />;
  // No error state currently exposed by backend; we keep a placeholder icon.
  if (status === "executing" || status === "inProgress") {
    return <Terminal size={16} strokeWidth={2} className="animate-spin-slow text-[var(--color-accent)]" />;
  }
  return <X size={16} strokeWidth={2} className="text-red-400" />;
}

export function ToolCard({ name, status, args, result }: ToolCardProps) {
  switch (name) {
    case "write_file":
      return <WriteFileToolCard status={status} args={args} result={result} />;
    case "read_file":
      return <ReadFileToolCard status={status} args={args} result={result} />;
    case "execute_command":
      return <ExecuteCommandToolCard status={status} args={args} result={result} />;
    case "research":
      return <ResearchToolCard status={status} args={args} result={result} />;
    case "internet_search":
      return <InternetSearchToolCard status={status} args={args} result={result} />;
    case "write_todos":
      return <TodoToolCard status={status} args={args} result={result} mode="write" />;
    case "read_todos":
      return <TodoToolCard status={status} args={args} result={result} mode="read" />;
    default:
      return <DefaultToolCard name={name} status={status} args={args} result={result} />;
  }
}

function CardShell({
  title,
  subtitle,
  status,
  children,
  defaultExpanded = false,
  collapsible = true,
}: {
  title: string;
  subtitle?: string | null;
  status: ToolStatus;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isComplete = status === "complete";

  return (
    <div className="glass-subtle" style={{ padding: "var(--space-4)", marginBottom: "var(--space-2)" }}>
      <div className="flex items-start" style={{ gap: "var(--space-3)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isComplete ? "rgba(21, 128, 61, 0.1)" : "rgba(217, 119, 6, 0.1)",
          }}
        >
          <ToolStatusIcon status={status} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isComplete ? "text-[var(--color-text-tertiary)]" : "text-[var(--color-text-primary)]"}`}>
            {title}
          </p>
          {subtitle ? <p className="text-xs mt-0.5 text-[var(--color-text-secondary)] truncate">{subtitle}</p> : null}
        </div>

        {collapsible ? (
          <button
            type="button"
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        ) : null}
      </div>

      {expanded ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function CodeBlock({ code, language, showLineNumbers = true }: { code: string; language: string; showLineNumbers?: boolean }) {
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, padding: "12px", background: "rgba(0,0,0,0.35)" }}
        showLineNumbers={showLineNumbers}
        lineNumberStyle={{ color: "rgba(255,255,255,0.35)", minWidth: "2.5em", paddingRight: "1em" }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function ExpandableText({ text, language = "text" }: { text: string; language?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => countLines(text), [text]);
  const needsCollapse = lines > MAX_VISIBLE_LINES;
  const shown = expanded ? text : truncateLines(text, MAX_VISIBLE_LINES).text;

  return (
    <div>
      <CodeBlock code={shown} language={language} showLineNumbers={language !== "text"} />
      {needsCollapse ? (
        <button
          type="button"
          className="mt-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show more (${lines - MAX_VISIBLE_LINES} lines)`}
        </button>
      ) : null}
    </div>
  );
}

function normalizeReadFileResult(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    const r = result as { content?: unknown };
    if (typeof r.content === "string") return r.content;
  }
  return toStringSafe(result);
}

function normalizeExecuteCommandResult(result: unknown): { stdout: string; stderr: string; exitCode?: number } {
  if (!result) return { stdout: "", stderr: "" };
  if (typeof result === "string") return { stdout: result, stderr: "" };

  if (typeof result === "object") {
    const r = result as {
      stdout?: unknown;
      stderr?: unknown;
      output?: unknown;
      exitCode?: unknown;
      code?: unknown;
    };

    const stdout =
      typeof r.stdout === "string"
        ? r.stdout
        : typeof r.output === "string"
          ? r.output
          : r.stdout
            ? toStringSafe(r.stdout)
            : r.output
              ? toStringSafe(r.output)
              : "";

    const stderr = typeof r.stderr === "string" ? r.stderr : r.stderr ? toStringSafe(r.stderr) : "";

    const exitCode =
      typeof r.exitCode === "number"
        ? r.exitCode
        : typeof r.code === "number"
          ? r.code
          : undefined;

    return { stdout, stderr, exitCode };
  }

  return { stdout: toStringSafe(result), stderr: "" };
}

function WriteFileToolCard({ status, args }: { status: ToolStatus; args: Record<string, unknown>; result?: unknown }) {
  const path = (args.path as string | undefined) ?? (args.filename as string | undefined) ?? "(unknown path)";
  const content = (args.content as string | undefined) ?? "";
  const language = getLanguageFromPath(path);

  return (
    <CardShell title={`write_file`} subtitle={path} status={status} defaultExpanded={status === "complete"}>
      <div className="space-y-2">
        <p className="text-xs text-[var(--color-text-tertiary)]">Preview (diff-style)</p>
        <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{ margin: 0, padding: "12px", background: "rgba(0,0,0,0.35)" }}
            showLineNumbers
            lineNumberStyle={{ color: "rgba(255,255,255,0.35)", minWidth: "2.5em", paddingRight: "1em" }}
            wrapLongLines
          >
            {(content || "").split("\n").map((l) => `+ ${l}`).join("\n")}
          </SyntaxHighlighter>
        </div>
        <p className="text-[10px] text-[var(--color-text-tertiary)]">
          Note: backend does not provide the previous file content, so this renders an “added” diff view.
        </p>
      </div>
    </CardShell>
  );
}

function ReadFileToolCard({ status, args, result }: ToolCardProps) {
  const path = (args.path as string | undefined) ?? (args.filename as string | undefined) ?? "(unknown path)";
  const language = getLanguageFromPath(path);
  const content = normalizeReadFileResult(result);

  return (
    <CardShell title={`read_file`} subtitle={path} status={status} defaultExpanded={status === "complete"}>
      <ExpandableText text={content || "(empty)"} language={language} />
    </CardShell>
  );
}

function ExecuteCommandToolCard({ status, args, result }: ToolCardProps) {
  const command = (args.command as string | undefined) ?? (args.cmd as string | undefined) ?? "(no command)";
  const { stdout, stderr, exitCode } = normalizeExecuteCommandResult(result);
  const combined = [stdout, stderr ? `\n[stderr]\n${stderr}` : ""].join("").trim();

  return (
    <CardShell
      title={`execute_command`}
      subtitle={`$ ${command}`}
      status={status}
      defaultExpanded={status === "complete"}
    >
      <div className="space-y-2">
        <div className="rounded-md border border-[var(--color-border)] overflow-hidden" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="px-3 py-2 text-xs border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] flex items-center justify-between">
            <span>Terminal</span>
            {typeof exitCode === "number" ? (
              <span className={exitCode === 0 ? "text-[var(--color-success)]" : "text-red-400"}>exit {exitCode}</span>
            ) : null}
          </div>
          <pre className="text-xs p-3 overflow-auto" style={{ maxHeight: 320, color: "rgba(255,255,255,0.9)" }}>
            <div style={{ color: "rgba(255,255,255,0.75)" }}>$ {command}</div>
            {stdout ? <div className="whitespace-pre-wrap">{stdout}</div> : null}
            {stderr ? <div className="whitespace-pre-wrap" style={{ color: "#f87171" }}>{stderr}</div> : null}
            {!stdout && !stderr ? <div className="whitespace-pre-wrap text-[var(--color-text-tertiary)]">(no output)</div> : null}
          </pre>
        </div>
        {combined && countLines(combined) > MAX_VISIBLE_LINES ? (
          <div className="text-[10px] text-[var(--color-text-tertiary)]">Long output is scrollable.</div>
        ) : null}
      </div>
    </CardShell>
  );
}

function ResearchToolCard({ status, args, result }: ToolCardProps) {
  const query = (args.query as string | undefined) ?? "";
  const summary =
    typeof result === "object" && result && "summary" in result
      ? (result as { summary: string }).summary
      : typeof result === "string"
        ? result
        : "";

  return (
    <CardShell title="research" subtitle={query ? `Query: ${query}` : null} status={status} defaultExpanded={false}>
      <ExpandableText text={summary || toStringSafe(result) || "(no result)"} language="markdown" />
    </CardShell>
  );
}

function InternetSearchToolCard({ status, args, result }: ToolCardProps) {
  const query = (args.query as string | undefined) ?? "";
  return (
    <CardShell title="internet_search" subtitle={query ? `Query: ${query}` : null} status={status} defaultExpanded={false}>
      <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto max-h-64 border border-[var(--color-border)]">
        {toStringSafe(result)}
      </pre>
    </CardShell>
  );
}

function TodoToolCard({ status, args, result, mode }: ToolCardProps & { mode: "read" | "write" }) {
  const todos =
    mode === "write"
      ? (args as { todos?: Array<{ id: string; content: string; status: string }> }).todos
      : (result as { todos?: Array<{ id: string; content: string; status: string }> })?.todos;

  return (
    <CardShell
      title={mode === "write" ? "write_todos" : "read_todos"}
      subtitle={todos ? `${todos.length} todo${todos.length === 1 ? "" : "s"}` : null}
      status={status}
      defaultExpanded={false}
    >
      {todos?.length ? (
        <div className="space-y-1 max-h-64 overflow-auto">
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
      ) : (
        <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto max-h-64 border border-[var(--color-border)]">
          {toStringSafe(result)}
        </pre>
      )}
    </CardShell>
  );
}

function DefaultToolCard({ name, status, args, result }: ToolCardProps) {
  return (
    <CardShell title={name} subtitle={null} status={status} defaultExpanded={false}>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Arguments</p>
          <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto max-h-48 border border-[var(--color-border)]">
            {toStringSafe(args)}
          </pre>
        </div>
        {result !== undefined ? (
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Result</p>
            <pre className="text-xs bg-[var(--color-container)] p-2 rounded-md overflow-auto max-h-48 border border-[var(--color-border)]">
              {toStringSafe(result)}
            </pre>
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

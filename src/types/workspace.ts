/**
 * Workspace State Types
 *
 * IDE-oriented state for the Deep Agents demo UI.
 * This is intentionally lightweight and can be driven purely from tool call
 * results emitted by the agent.
 */

export interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export type FileNodeType = "file" | "dir";

export interface FileNode {
  name: string;
  path: string;
  type: FileNodeType;
  children?: FileNode[];
  /** Optional cached content for file nodes */
  content?: string;
}

export interface TabState {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
  /** 0-based cursor position in the tab */
  cursor?: { line: number; ch: number };
}

export interface TerminalEntry {
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: string;
}

export interface FileChange {
  path: string;
  status:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "untracked"
    | "unknown";
}

export interface GitStatus {
  branch: string;
  changes: FileChange[];
  ahead: number;
  behind: number;
}

export interface Issue {
  number: number;
  title: string;
  url?: string;
  state?: string;
  labels?: string[];
  assignee?: string | null;
}

export interface PullRequest {
  number: number;
  title: string;
  url?: string;
  state?: string;
  isDraft?: boolean;
  reviewState?: string;
}

export interface GitHubState {
  issues: Issue[];
  pullRequests: PullRequest[];
}

export interface WorkspaceState {
  fileTree: FileNode[];
  openTabs: TabState[];
  activeTab: string | null;
  terminal: TerminalEntry[];
  todos: Todo[];
  gitStatus: GitStatus;
  github: GitHubState;
}

export const INITIAL_STATE: WorkspaceState = {
  fileTree: [],
  openTabs: [],
  activeTab: null,
  terminal: [],
  todos: [],
  gitStatus: {
    branch: "",
    changes: [],
    ahead: 0,
    behind: 0,
  },
  github: {
    issues: [],
    pullRequests: [],
  },
};

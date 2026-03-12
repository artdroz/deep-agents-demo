/**
 * Workspace State Types
 *
 * Types for managing IDE-like workspace state in the Deep Agents IDE.
 * Uses local state + tool-call parsing (instead of a backend-owned state model).
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
  children?: FileNode[]; // for dirs
  content?: string; // optional cached content for files
}

export interface TabState {
  path: string;
  content: string;
  language?: string;
  isDirty: boolean;
  cursor?: {
    line: number;
    ch: number;
  };
}

export interface TerminalEntry {
  command: string;
  output: string;
  exitCode: number;
  timestamp: string; // ISO
}

export interface FileChange {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
}

export interface GitStatus {
  branch: string;
  changes: FileChange[];
  ahead: number;
  behind: number;
  diff?: string;
}

export interface Issue {
  number: number;
  title: string;
  url?: string;
  state?: "open" | "closed";
  labels?: string[];
  assignee?: string | null;
}

export interface PullRequest {
  number: number;
  title: string;
  url?: string;
  state?: "open" | "closed" | "merged";
  isDraft?: boolean;
}

export interface GitHubState {
  issues: Issue[];
  pullRequests: PullRequest[];
}

// Sources found via internet_search (includes content)
export interface Source {
  url: string;
  title: string;
  content?: string;
  status: "found" | "scraped" | "failed";
}

export interface WorkspaceState {
  fileTree: FileNode[];
  openTabs: TabState[];
  activeTab: string | null;
  terminal: TerminalEntry[];
  todos: Todo[];
  gitStatus: GitStatus;
  github: GitHubState;
  sources: Source[];
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
  sources: [],
};

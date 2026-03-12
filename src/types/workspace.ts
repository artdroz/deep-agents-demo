import type { GitHubState } from "@/types/github";

export interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  content?: string;
}

export interface TabState {
  path: string;
  content: string;
  language?: string;
  isDirty: boolean;
  cursor?: { line: number; ch: number };
}

export interface TerminalEntry {
  command: string;
  output: string;
  exitCode?: number;
  timestamp: string;
}

export interface FileChange {
  path: string;
  status?: string;
}

export interface GitStatus {
  branch: string;
  changes: FileChange[];
  ahead: number;
  behind: number;
}

export interface WorkspaceState {
  fileTree: FileNode[];
  openTabs: TabState[];
  activeTab: string | null;
  terminal: TerminalEntry[];
  todos: Todo[];
  gitStatus?: GitStatus;
  github?: GitHubState;

  // legacy fields kept temporarily for UI components that still expect them
  // (will be removed when the IDE workspace UI is implemented)
  files?: Array<{ path: string; content: string; createdAt: string }>;
  sources?: Array<{ url: string; title: string; content?: string; status: "found" | "scraped" | "failed" }>;
}

export const INITIAL_STATE: WorkspaceState = {
  fileTree: [],
  openTabs: [],
  activeTab: null,
  terminal: [],
  todos: [],
  gitStatus: {
    branch: "main",
    changes: [],
    ahead: 0,
    behind: 0,
  },
  github: { issues: [], pullRequests: [] },
  files: [],
  sources: [],
};

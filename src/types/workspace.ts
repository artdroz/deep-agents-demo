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
  exitCode: number | null;
  timestamp: string;
}

export interface FileChange {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
  diff?: string;
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
};

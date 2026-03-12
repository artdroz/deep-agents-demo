/**
 * Research State Types
 *
 * Types for managing research state in the Deep Research Assistant.
 * Uses local state + useDefaultTool pattern instead of useCoAgent
 * to avoid type mismatches with Python FilesystemMiddleware.
 */

export interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface ResearchFile {
  path: string;
  content: string;
  createdAt: string;
}

// Sources found via internet_search (includes content)
export interface Source {
  url: string;
  title: string;
  content?: string;
  status: "found" | "scraped" | "failed";
}

export interface GitHubLabel {
  name: string;
  color?: string;
}

export interface GitHubUser {
  login: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  url?: string;
  assignee?: GitHubUser | null;
  labels?: GitHubLabel[];
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  url?: string;
  isDraft?: boolean;
  state?: string;
  reviewDecision?: string | null;
}

export interface GitHubState {
  repo?: string;
  branch?: string;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
}

export interface ResearchState {
  todos: Todo[];
  files: ResearchFile[];
  sources: Source[];
  github: GitHubState;
}

export const INITIAL_STATE: ResearchState = {
  todos: [],
  files: [],
  sources: [],
  github: {
    issues: [],
    pullRequests: [],
  },
};

export interface GitHubIssue {
  number: number;
  title: string;
  url?: string;
  state?: string;
  labels?: Array<{ name: string }>;
  assignees?: Array<{ login: string }>;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  url?: string;
  state?: string;
  isDraft?: boolean;
  mergeable?: string;
  headRefName?: string;
  baseRefName?: string;
}

export interface GitHubRepoContext {
  repo?: string;
  branch?: string;
}

export interface GitHubState {
  context?: GitHubRepoContext;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
}

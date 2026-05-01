import { ENV }    from '../../utils/envConfig';
import { logger } from '../../utils/logger';

export type JiraIssueType = 'Task' | 'Bug';
export type JiraPriority  = 'Highest' | 'High' | 'Medium' | 'Low';

export interface JiraIssuePayload {
  projectKey:  string;
  summary:     string;
  description: string;
  issueType:   JiraIssueType;
  priority?:   JiraPriority;
  assigneeId?: string;
  labels?:     string[];
}

export interface JiraCreatedIssue {
  id:   string;
  key:  string;
  url:  string;
}

/**
 * Minimal Jira Cloud REST API v3 client.
 * Auth: HTTP Basic (email:apiToken) — works on the free tier.
 */
export class JiraClient {
  private readonly baseUrl:  string;
  private readonly authHeader: string;

  constructor() {
    this.baseUrl    = ENV.jiraBaseUrl.replace(/\/$/, '');
    this.authHeader = 'Basic ' + Buffer.from(`${ENV.jiraEmail}:${ENV.jiraApiToken}`).toString('base64');
  }

  get isConfigured(): boolean {
    return !!(ENV.jiraBaseUrl && ENV.jiraEmail && ENV.jiraApiToken);
  }

  async createIssue(payload: JiraIssuePayload): Promise<JiraCreatedIssue> {
    if (!this.isConfigured) {
      throw new Error('[JiraClient] Jira not configured — set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN');
    }

    const body = {
      fields: {
        project:     { key: payload.projectKey },
        summary:     payload.summary,
        description: this.toAdf(payload.description),
        issuetype:   { name: payload.issueType },
        ...(payload.priority   && { priority:  { name: payload.priority } }),
        ...(payload.assigneeId && { assignee:  { id: payload.assigneeId } }),
        ...(payload.labels?.length && { labels: payload.labels }),
      },
    };

    const res = await fetch(`${this.baseUrl}/rest/api/3/issue`, {
      method:  'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[JiraClient] Create issue failed (${res.status}): ${text}`);
    }

    const data = await res.json() as { id: string; key: string; self: string };
    const url  = `${this.baseUrl}/browse/${data.key}`;
    logger.info(`[JiraClient] Created ${data.key} — ${url}`);
    return { id: data.id, key: data.key, url };
  }

  /** Convert plain-text description to Atlassian Document Format (ADF). */
  private toAdf(text: string): object {
    const paragraphs = text.split('\n\n').filter(Boolean);
    return {
      version: 1,
      type:    'doc',
      content: paragraphs.map(para => ({
        type:    'paragraph',
        content: para.split('\n').flatMap((line, i, arr) => {
          const nodes: object[] = [{ type: 'text', text: line }];
          if (i < arr.length - 1) nodes.push({ type: 'hardBreak' });
          return nodes;
        }),
      })),
    };
  }

  /** Verify connectivity — returns true if credentials are valid. */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/api/3/myself`, {
        headers: { 'Authorization': this.authHeader, 'Accept': 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const jiraClient = new JiraClient();

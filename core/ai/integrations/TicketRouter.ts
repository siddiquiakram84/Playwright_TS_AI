import { ENV }             from '../../utils/envConfig';
import { jiraClient, JiraCreatedIssue, JiraPriority } from './JiraClient';
import { aiEventBus }      from '../ops/AIEventBus';
import { logger }          from '../../utils/logger';
import type { FailureAnalysis, FailureCategory } from '../agents/ReportAnalyzerAgent';

export interface RoutedTicket extends JiraCreatedIssue {
  category:  FailureCategory;
  testTitle: string;
}

interface RouteConfig {
  projectKey:  string;
  assigneeId:  string;
  issueType:   'Task' | 'Bug';
  priority:    JiraPriority;
  labelPrefix: string;
}

const ROUTE_MAP: Record<FailureCategory, (cfg: typeof ENV) => RouteConfig> = {
  devops: cfg => ({
    projectKey:  cfg.jiraProjectOps,
    assigneeId:  cfg.jiraAssigneeOps,
    issueType:   'Task',
    priority:    'High',
    labelPrefix: 'infrastructure',
  }),
  bug: cfg => ({
    projectKey:  cfg.jiraProjectDev,
    assigneeId:  cfg.jiraAssigneeDev,
    issueType:   'Bug',
    priority:    'High',
    labelPrefix: 'application-bug',
  }),
  manual: cfg => ({
    projectKey:  cfg.jiraProjectQa,
    assigneeId:  cfg.jiraAssigneeQa,
    issueType:   'Task',
    priority:    'Medium',
    labelPrefix: 'test-quality',
  }),
  summary: cfg => ({
    projectKey:  cfg.jiraProjectAuto,
    assigneeId:  cfg.jiraAssigneeAuto,
    issueType:   'Task',
    priority:    'Medium',
    labelPrefix: 'ai-automation-review',
  }),
};

export class TicketRouter {

  async routeFailure(
    sessionId:  string,
    failure:    FailureAnalysis,
  ): Promise<RoutedTicket | null> {
    if (!jiraClient.isConfigured) return null;

    const cfg    = ROUTE_MAP[failure.category](ENV);
    const summary = `[AI-AUTO] ${failure.category.toUpperCase()}: ${failure.testTitle.slice(0, 80)}`;

    const description = [
      `*Detected by:* AI Automation Orchestrator (session ${sessionId})`,
      `*Test:* ${failure.testTitle}`,
      `*Category:* ${failure.category}`,
      `*Reason:* ${failure.reason}`,
      '',
      `*Error message:*`,
      failure.errorMessage,
      '',
      `*Suggested action:* ${failure.suggestedAction}`,
      '',
      `_Auto-generated ticket — please review and update as needed._`,
    ].join('\n');

    try {
      const issue = await jiraClient.createIssue({
        projectKey:  cfg.projectKey,
        summary,
        description,
        issueType:   cfg.issueType,
        priority:    cfg.priority,
        assigneeId:  cfg.assigneeId,
        labels:      ['ai-generated', cfg.labelPrefix, `session-${sessionId}`],
      });

      aiEventBus.emitJiraTicket({
        sessionId,
        key:       issue.key,
        project:   cfg.projectKey,
        issueType: cfg.issueType,
        category:  failure.category,
        summary,
        url:       issue.url,
        timestamp: Date.now(),
      });

      return { ...issue, category: failure.category, testTitle: failure.testTitle };
    } catch (err) {
      logger.error(`[TicketRouter] Failed to create ticket for "${failure.testTitle}": ${(err as Error).message}`);
      return null;
    }
  }

  async createSummaryTicket(
    sessionId:   string,
    summaryBody: string,
  ): Promise<JiraCreatedIssue | null> {
    if (!jiraClient.isConfigured) return null;

    const cfg     = ROUTE_MAP['summary'](ENV);
    const summary = `[AI-AUTO] Run Summary — Session ${sessionId}`;

    try {
      const issue = await jiraClient.createIssue({
        projectKey:  cfg.projectKey,
        summary,
        description: summaryBody,
        issueType:   'Task',
        priority:    'Medium',
        assigneeId:  cfg.assigneeId,
        labels:      ['ai-generated', 'run-summary', `session-${sessionId}`],
      });

      aiEventBus.emitJiraTicket({
        sessionId,
        key:       issue.key,
        project:   cfg.projectKey,
        issueType: 'Task',
        category:  'summary',
        summary,
        url:       issue.url,
        timestamp: Date.now(),
      });

      logger.info(`[TicketRouter] Summary ticket: ${issue.key}`);
      return issue;
    } catch (err) {
      logger.error(`[TicketRouter] Summary ticket failed: ${(err as Error).message}`);
      return null;
    }
  }
}

export const ticketRouter = new TicketRouter();

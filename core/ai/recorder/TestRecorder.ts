import * as readline      from 'readline';
import * as fs            from 'fs/promises';
import * as path          from 'path';
import { chromium }       from '@playwright/test';
import { captureScript, RecordedAction, ClickAction, FillAction, NavigateAction } from './ActionCapture';
import { TestGenerator }  from '../TestGenerator';
import { aiEventBus }     from '../ops/AIEventBus';
import { logger }         from '../../utils/logger';

export interface RecorderOptions {
  url?:        string;       // starting URL (default: UI_BASE_URL)
  outputPath?: string;       // where to save the generated spec
  headless?:   boolean;      // default: false (recorder is interactive)
  pollMs?:     number;       // how often to poll the browser for new actions (default: 500)
}

const POLL_INTERVAL_MS = 500;

// ── Action → human-readable summary ──────────────────────────────────────────

function summarise(action: RecordedAction): string {
  switch (action.type) {
    case 'navigate':
      return `\x1b[36m🔗 navigate\x1b[0m  ${action.url}`;
    case 'click':
      return `\x1b[33m🖱  click   \x1b[0m  ${action.selector}${action.text ? `  (${action.text.substring(0, 40)})` : ''}`;
    case 'fill': {
      const displayVal = action.inputType === 'password' ? '***' : `"${action.value.substring(0, 40)}"`;
      return `\x1b[32m✏  fill    \x1b[0m  ${action.selector}  ← ${displayVal}${action.label ? `  [${action.label}]` : ''}`;
    }
    case 'select':
      return `\x1b[35m▾  select  \x1b[0m  ${action.selector}  ← "${action.label}"`;
    case 'check':
      return `\x1b[34m☑  check   \x1b[0m  ${action.selector}  ← ${action.checked}`;
    default:
      return JSON.stringify(action);
  }
}

// ── Serialise recorded actions for the AI prompt ──────────────────────────────

export function serializeActionsForAI(actions: RecordedAction[]): string {
  const lines: string[] = [
    'Recorded browser session — user actions in chronological order:',
    '',
  ];

  let lastUrl = '';
  let stepNum = 1;

  for (const action of actions) {
    switch (action.type) {
      case 'navigate':
        if (action.url !== lastUrl) {
          lines.push(`${stepNum++}. NAVIGATE to: ${action.url} (page title: "${action.title}")`);
          lastUrl = action.url;
        }
        break;
      case 'click': {
        const a = action as ClickAction;
        lines.push(`${stepNum++}. CLICK: selector="${a.selector}" text="${a.text}"${a.href ? ` href="${a.href}"` : ''}`);
        break;
      }
      case 'fill': {
        const a = action as FillAction;
        const val = a.inputType === 'password' ? '<password>' : `"${a.value}"`;
        lines.push(`${stepNum++}. FILL: selector="${a.selector}" value=${val} label="${a.label}" inputType="${a.inputType}"`);
        break;
      }
      case 'select':
        lines.push(`${stepNum++}. SELECT: selector="${action.selector}" value="${action.value}" label="${action.label}"`);
        break;
      case 'check':
        lines.push(`${stepNum++}. ${action.checked ? 'CHECK' : 'UNCHECK'}: selector="${action.selector}" label="${action.label}"`);
        break;
    }
  }

  lines.push('');
  lines.push('Generate a production-grade Playwright spec for all the actions above.');
  return lines.join('\n');
}

// ── Recorder class ────────────────────────────────────────────────────────────

export class TestRecorder {
  private actions: RecordedAction[]  = [];
  private sessionId                  = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  async start(opts: RecorderOptions = {}): Promise<void> {
    const startUrl = opts.url ?? process.env.UI_BASE_URL ?? 'https://automationexercise.com';

    this.sessionId = `rec-${Date.now()}`;
    this.actions   = [];

    console.log('\n\x1b[1m\x1b[35m╔══════════════════════════════════════════════════╗');
    console.log('║      🎬  AI Test Recorder  — JARVIS v5            ║');
    console.log('╚══════════════════════════════════════════════════╝\x1b[0m\n');
    console.log(`   Provider : ${process.env.AI_PROVIDER ?? 'local'} (${process.env.OLLAMA_MODEL ?? 'llama3.2'})`);
    console.log(`   Starting : ${startUrl}`);
    console.log(`   Output   : ${opts.outputPath ?? 'aut/tests/ai/generated/<slug>.spec.ts'}`);
    console.log('\n   \x1b[2mBrowser will open — perform your test steps, then come back here.\x1b[0m\n');
    console.log('─'.repeat(52));

    const browser = await chromium.launch({ headless: opts.headless ?? false });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page    = await context.newPage();

    await page.addInitScript(captureScript);

    // Start polling BEFORE goto so we don't miss the initial navigate event
    this.pollHandle = setInterval(async () => {
      try {
        const newActions = await page.evaluate<RecordedAction[]>(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          const batch = [...(w.__actions ?? [])];
          w.__actions = [];
          return batch;
        });

        for (const action of newActions) {
          this.actions.push(action);
          const summary = summarise(action);
          const ts      = new Date(action.timestamp).toISOString().substring(11, 19);
          console.log(`\x1b[2m[${ts}]\x1b[0m ${summary}`);

          aiEventBus.emitRecorderAction({
            sessionId: this.sessionId,
            type:      action.type as 'navigate' | 'click' | 'fill' | 'select' | 'check',
            selector:  (action as ClickAction).selector,
            value:     (action as FillAction).value,
            url:       (action as NavigateAction).url,
            text:      (action as ClickAction).text,
            timestamp: action.timestamp,
          });
        }
      } catch { /* page may be navigating */ }
    }, opts.pollMs ?? POLL_INTERVAL_MS);

    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    // Safety net: ensure captureScript is active in the final document
    // (handles edge-cases: server redirects, slow init-script registration)
    await page.evaluate(captureScript).catch(() => {});

    // Wait for user to press Enter
    await this.waitForEnter();

    // Grace period: let debounced fill handlers (600ms) flush before we stop polling
    await new Promise(r => setTimeout(r, 700));

    // Stop polling
    if (this.pollHandle) clearInterval(this.pollHandle);

    // Drain any remaining actions
    try {
      const remaining = await page.evaluate<RecordedAction[]>(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__actions ?? [];
      });
      this.actions.push(...remaining);
    } catch { /* ignore */ }

    await browser.close();

    console.log('\n' + '─'.repeat(52));
    console.log(`\n   \x1b[1m${this.actions.length} action(s) recorded\x1b[0m — generating spec…\n`);

    if (this.actions.length === 0) {
      console.log('   \x1b[33mNo actions recorded — nothing to generate.\x1b[0m\n');
      return;
    }

    const serialized = serializeActionsForAI(this.actions);
    const generator  = new TestGenerator();
    const spec       = await generator.fromRecording(serialized, opts.outputPath);

    console.log('\n\x1b[1m\x1b[32m✅ Spec generated\x1b[0m');
    console.log(`   Tests  : ${spec.testCount}`);
    console.log(`   File   : ${spec.filename}`);
    if (!opts.outputPath) {
      console.log('\n' + '─'.repeat(52));
      console.log(spec.code);
    }

    // Save recorded actions as JSON for replay/debugging
    const actionsFile = path.resolve('core/ai/recorder/last-session.json');
    await fs.mkdir(path.dirname(actionsFile), { recursive: true });
    await fs.writeFile(actionsFile, JSON.stringify({ sessionId: this.sessionId, actions: this.actions }, null, 2));
    logger.info(`[Recorder] Session saved → ${actionsFile}`);
  }

  getActions(): RecordedAction[] {
    return [...this.actions];
  }

  private waitForEnter(): Promise<void> {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin });
      console.log('\n   \x1b[1mPress Enter to generate the spec | Ctrl+C to cancel\x1b[0m\n');
      rl.once('line', () => { rl.close(); resolve(); });
    });
  }
}

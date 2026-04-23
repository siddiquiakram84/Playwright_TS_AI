/**
 * Real-time AI Test Recorder CLI
 *
 * Usage:
 *   npm run ai:record
 *   npm run ai:record -- --url https://automationexercise.com/login
 *   npm run ai:record -- --url https://automationexercise.com/login --output aut/tests/ai/generated/login.spec.ts
 *
 * Steps:
 *   1. Browser opens (headed) at the given URL
 *   2. Perform your test steps manually
 *   3. Press Enter in the terminal when done
 *   4. AI generates a production-grade Playwright spec from your actions
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { TestRecorder } from '../ai/recorder/TestRecorder';

const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--') && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    args[arg.slice(2)] = process.argv[++i];
  }
}

const recorder = new TestRecorder();
recorder.start({
  url:        args['url'],
  outputPath: args['output'],
  headless:   args['headless'] === 'true',
}).catch(err => {
  console.error('\n❌ Recorder error:', err.message);
  process.exit(1);
});

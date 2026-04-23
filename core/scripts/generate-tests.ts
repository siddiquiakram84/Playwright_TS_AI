#!/usr/bin/env tsx
/**
 * AI Test Generator CLI
 *
 * Generates Playwright TypeScript spec files from user stories or natural language.
 *
 * Usage:
 *   tsx core/scripts/generate-tests.ts --story "As a user I want to login..."
 *   tsx core/scripts/generate-tests.ts --nl   "test the checkout flow end to end"
 *   tsx core/scripts/generate-tests.ts --story "..." --output aut/tests/ai/my.spec.ts
 *
 * Environment:
 *   AI_PROVIDER=local       → uses Ollama (default)
 *   AI_PROVIDER=anthropic   → uses Claude (requires ANTHROPIC_API_KEY)
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { TestGenerator } from '../ai/TestGenerator';

function parseArgs(): { story?: string; nl?: string; output?: string } {
  const args = process.argv.slice(2);
  const get  = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return { story: get('--story'), nl: get('--nl'), output: get('--output') };
}

async function main(): Promise<void> {
  const { story, nl, output } = parseArgs();

  if (!story && !nl) {
    console.error(
      '\nUsage:\n' +
      '  tsx core/scripts/generate-tests.ts --story "user story text"\n' +
      '  tsx core/scripts/generate-tests.ts --nl   "natural language instruction"\n' +
      '  Add --output path/to/spec.ts to write the file\n',
    );
    process.exit(1);
  }

  const provider = process.env.AI_PROVIDER ?? 'local';
  console.log(`\n🤖 AI Test Generator  [provider: ${provider}]\n`);

  const generator = new TestGenerator();

  const spec = story
    ? await generator.fromUserStory(story, output)
    : await generator.fromNaturalLanguage(nl!, output);

  if (!output) {
    console.log('─'.repeat(60));
    console.log(spec.code);
    console.log('─'.repeat(60));
    console.log(`\n📊 Tests generated : ${spec.testCount}`);
    console.log(`   Suggested file  : ${spec.filename}`);
    console.log('\nTip: add --output path/to/spec.ts to write the file directly.\n');
  } else {
    console.log(`\n✅ ${spec.testCount} test(s) written → ${output}\n`);
  }
}

main().catch(err => {
  console.error(`\n❌ ${(err as Error).message}\n`);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * AI Test Data Generator CLI
 *
 * Generates realistic test data and prints it as JSON (or writes to a file).
 *
 * Usage:
 *   tsx core/scripts/generate-test-data.ts --type user
 *   tsx core/scripts/generate-test-data.ts --type user    --count 5
 *   tsx core/scripts/generate-test-data.ts --type product --count 3
 *   tsx core/scripts/generate-test-data.ts --type searchTerms --count 10
 *   tsx core/scripts/generate-test-data.ts --type user --output aut/test-data/ai-users.json
 *
 * Environment:
 *   AI_PROVIDER=local       → uses Ollama (default)
 *   AI_PROVIDER=anthropic   → uses Claude (requires ANTHROPIC_API_KEY)
 */

import * as dotenv from 'dotenv';
import * as path   from 'path';
import * as fs     from 'fs/promises';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { TestDataFactory } from '../ai/TestDataFactory';
import { TestDataType }    from '../ai/types';

function parseArgs(): { type: TestDataType; count: number; output?: string; context?: string } {
  const args    = process.argv.slice(2);
  const get     = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const type    = (get('--type') ?? 'user') as TestDataType;
  const count   = parseInt(get('--count') ?? '1', 10);
  const output  = get('--output');
  const context = get('--context');
  return { type, count, output, context };
}

async function main(): Promise<void> {
  const { type, count, output, context } = parseArgs();

  const provider = process.env.AI_PROVIDER ?? 'local';
  console.log(`\n🤖 AI Test Data Generator  [provider: ${provider}, type: ${type}, count: ${count}]\n`);

  const factory = new TestDataFactory();
  let data: unknown;

  if (count === 1) {
    if (type === 'user')        data = await factory.generateUser(context);
    else if (type === 'product') data = await factory.generateProduct(context);
    else                         data = await factory.generateSearchTerms(5, context);
  } else {
    data = await factory.generateBatch(type, count, context);
  }

  const json = JSON.stringify(data, null, 2);

  if (output) {
    await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await fs.writeFile(path.resolve(output), json, 'utf8');
    console.log(`✅ Data written → ${output}\n`);
  } else {
    console.log(json);
    console.log(`\nTip: add --output path/to/data.json to write the file directly.\n`);
  }
}

main().catch(err => {
  console.error(`\n❌ ${(err as Error).message}\n`);
  process.exit(1);
});

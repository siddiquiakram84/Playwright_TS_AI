import * as crypto from 'crypto';

export function randomEmail(prefix = 'user'): string {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}@testmail.com`;
}

export function randomString(length = 8): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Deep-clone a plain object without bringing in lodash. */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Wait for a condition to be true, polling every `interval` ms. */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 10000,
  interval = 500,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('waitForCondition: timed out');
}

/** Format ISO date string to a readable label. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

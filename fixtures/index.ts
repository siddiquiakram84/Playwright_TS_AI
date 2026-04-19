import { mergeTests, mergeExpects } from '@playwright/test';
import { test as pageTest } from './pageFixtures';
import { test as apiTest } from './apiFixtures';
import { expect as baseExpect } from '@playwright/test';

/** Combined fixture providing both page objects and API clients. */
export const test = mergeTests(pageTest, apiTest);
export const expect = mergeExpects(baseExpect);

export type { PageFixtures } from './pageFixtures';
export type { ApiFixtures } from './apiFixtures';

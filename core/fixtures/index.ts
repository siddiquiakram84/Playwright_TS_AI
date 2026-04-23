import { mergeTests, mergeExpects } from '@playwright/test';
import { test as pageTest } from './pageFixtures';
import { test as apiTest }  from './apiFixtures';
import { test as aiTest }   from './aiFixtures';
import { expect as baseExpect } from '@playwright/test';

/** Combined fixture providing page objects, API clients, and AI-powered helpers. */
export const test   = mergeTests(pageTest, apiTest, aiTest);
export const expect = mergeExpects(baseExpect);

export type { PageFixtures } from './pageFixtures';
export type { ApiFixtures }  from './apiFixtures';
export type { AiFixtures }   from './aiFixtures';

import { z } from 'zod';

// ── Selector healing ─────────────────────────────────────────────────────────

export const SelectorAlternativeSchema = z.object({
  selector:   z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
  reasoning:  z.string().optional().default(''),
});

export const SelectorAlternativesSchema = z.array(SelectorAlternativeSchema).min(1).max(10);

// ── Visual regression ────────────────────────────────────────────────────────

export const VisualDifferenceSchema = z.object({
  element:     z.string(),
  description: z.string(),
  severity:    z.enum(['low', 'medium', 'high']),
  region:      z.string().optional(),
});

export const VisualComparisonResultSchema = z.object({
  passed:      z.boolean(),
  differences: z.array(VisualDifferenceSchema),
  summary:     z.string(),
  confidence:  z.number().min(0).max(1),
});

// ── Test data ────────────────────────────────────────────────────────────────

export const GeneratedUserSchema = z.object({
  title:     z.string().min(1).optional().default('Mr'),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  password:  z.string().min(6),
  phone:     z.string().min(4),
  address: z.object({
    company: z.string().nullish().transform(v => v ?? undefined),
    street:  z.string().min(1),
    city:    z.string().min(1),
    state:   z.string().min(1),
    zipCode: z.string().min(1),
    country: z.string().min(1),
  }),
  dateOfBirth: z.object({
    day:   z.coerce.number().int().min(1).max(31),
    month: z.coerce.number().int().min(1).max(12),
    year:  z.coerce.number().int().min(1900).max(2010),
  }),
});

export const GeneratedProductSchema = z.object({
  title:       z.string().min(1),
  price:       z.number().positive(),
  description: z.string().min(1),
  category:    z.string().min(1),
  searchTerms: z.array(z.string().min(1)).min(2),
});

// ── Test planning (multi-agent) ───────────────────────────────────────────────

// Normalise common LLM field-name variants before strict validation
function normaliseStep(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const s = raw as Record<string, unknown>;
  return {
    action:      s.action      ?? s.type        ?? s.stepType  ?? s.kind,
    target:      s.target      ?? s.selector    ?? s.locator   ?? s.element  ?? s.field ?? s.page,
    value:       s.value       ?? s.text        ?? s.inputValue ?? s.input,
    pom:         s.pom         ?? s.pomMethod   ?? s.method,
    assertType:  s.assertType  ?? s.assertionType ?? s.assertion,
    expected:    s.expected    ?? s.expectedValue ?? s.expectedText ?? s.expect,
    description: s.description ?? s.desc        ?? s.details   ?? s.note,
  };
}

function normaliseTestCase(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const s = raw as Record<string, unknown>;
  return {
    name:      s.name      ?? s.title     ?? s.testName  ?? s.id    ?? s.case,
    steps:     s.steps     ?? s.testSteps ?? s.actions,
    dataNeeds: s.dataNeeds ?? s.testData  ?? s.data      ?? [],
    tags:      s.tags      ?? s.labels    ?? s.categories ?? [],
    priority:  s.priority  ?? s.criticality ?? s.level,
  };
}

export const TestStepSchema = z.preprocess(normaliseStep, z.object({
  action:      z.enum(['navigate', 'fill', 'click', 'assert', 'wait', 'select', 'hover', 'check', 'screenshot']),
  target:      z.string().min(1),
  value:       z.string().optional(),
  pom:         z.string().optional(),
  assertType:  z.enum(['visible', 'text', 'value', 'url', 'count', 'enabled', 'checked', 'hidden']).optional(),
  expected:    z.string().optional(),
  description: z.string().optional(),
}));

export const TestCaseSchema = z.preprocess(normaliseTestCase, z.object({
  name:      z.string().min(1),
  steps:     z.array(TestStepSchema).min(1),
  dataNeeds: z.array(z.string()).default([]),
  tags:      z.array(z.string()).default([]),
  priority:  z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
}));

export const TestPlanSchema = z.object({
  testSuite:   z.string().min(1),
  description: z.string(),
  tests:       z.array(TestCaseSchema).min(1),
  fixtures:    z.array(z.string()).default([]),
});

export const ValidationReportSchema = z.object({
  valid:       z.boolean(),
  score:       z.number().min(0).max(100),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'suggestion']),
    message:  z.string(),
    line:     z.number().optional(),
  })),
  suggestions: z.array(z.string()),
});

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type GeneratedUserData          = z.infer<typeof GeneratedUserSchema>;
export type GeneratedProductData       = z.infer<typeof GeneratedProductSchema>;
export type TestPlan                   = z.infer<typeof TestPlanSchema>;
export type TestCase                   = z.infer<typeof TestCaseSchema>;
export type TestStep                   = z.infer<typeof TestStepSchema>;
export type ValidationReport           = z.infer<typeof ValidationReportSchema>;
export type VisualComparisonResultData = z.infer<typeof VisualComparisonResultSchema>;
export type SelectorAlternativeData    = z.infer<typeof SelectorAlternativeSchema>;

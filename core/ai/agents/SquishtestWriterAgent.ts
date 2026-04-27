import * as fs              from 'fs/promises';
import * as path            from 'path';
import { AIClient }         from '../AIClient';
import { aiEventBus }       from '../ops/AIEventBus';
import { GeneratedTestSpec } from '../types';
import { logger }           from '../../utils/logger';
import * as crypto          from 'crypto';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a senior SDET writing production-grade Squishtest Python test scripts for Qt/desktop applications.

Given a user story, manual test case description, or feature requirement, generate a complete, runnable
Squishtest Python script following these strict conventions.

════════════════════════════════════════════════════════════
  SQUISHTEST PYTHON API
═══════════════════════════════���════════════════════════════

Object lookup:
  squish.waitForObject(name)                 — wait for widget by object name, returns widget
  squish.waitForObjectExists(name)           — returns True/False, non-blocking check
  squish.findObject(name)                    — find widget synchronously
  squish.waitForObjectItem(name, item)       — for list/combo widgets, wait for a specific item

Interaction:
  squish.mouseClick(objOrName)               — left click
  squish.doubleClick(objOrName)              — double click
  squish.mouseButton(squish.MouseButton.LeftButton)
  squish.type(objOrName, "text")             — type text into widget (clears first)
  squish.pressKey("Return")                 — keyboard press
  squish.activateItem(objOrName, "menuPath") — activate menu item
  squish.selectOption(objOrName, "value")   — select from combo/list
  squish.setChecked(objOrName, True/False)  — check/uncheck checkbox
  squish.dragAndDrop(src, target)           — drag and drop

Application lifecycle:
  squish.startApplication("AppName")        — launch application
  squish.attachToApplication("AppName")     — attach to already-running app
  squish.closeApplication()                 — close the application under test

Assertions:
  test.verify(condition, "message")         — assertion, marks test FAIL on False
  test.compare(actual, expected, "message") — equality assertion
  test.vp("vpName")                         — visual verification point
  test.log("message")                       — info log
  test.warning("message")                   — warning log
  test.fail("message")                      — explicit fail

Property access:
  obj = squish.findObject(name)
  obj.text                                  — QLabel / QLineEdit text
  obj.currentIndex                          — QComboBox current index
  obj.checked                               — QCheckBox state
  obj.enabled                               — widget enabled state
  obj.visible                               — widget visibility

════════════════════════════════════════════════════════════
  OBJECT NAMING CONVENTION (Squishtest object map)
════════════════════════════════════════════════════════════

Widget names follow the pattern:  ":WidgetName_QClassName"
Examples:
  ":MainWindow"                              — main window
  ":usernameLineEdit_QLineEdit"              — username field
  ":passwordLineEdit_QLineEdit"              — password field
  ":loginButton_QPushButton"                 — login button
  ":statusLabel_QLabel"                      — status display
  ":fileMenu_QMenu"                          — File menu
  ":tableView_QTableWidget"                  — data table
  ":OKButton_QPushButton"                    — confirmation button

For nested widgets: ":ParentName.childName_QClassName"

════════════════════════════════════════════════════════════
  SCRIPT STRUCTURE
════════════════════════════════════════════════════════════

Every script must follow this exact structure:

\`\`\`python
# -*- coding: utf-8 -*-
# [Test case name] — [brief description]
# Framework: Squishtest + Python
# Target: Qt application

import squish
import test


def main():
    """[Test purpose docstring]"""

    # 1. Launch / attach
    squish.startApplication("AppName")

    # 2. Test setup / preconditions
    # ...

    # 3. Test steps
    # ...

    # 4. Assertions
    test.verify(condition, "description")

    # 5. Cleanup
    squish.closeApplication()
\`\`\`

════════════════════════════════════════════════════════════
  CODING RULES
════════════════════════════════════════════════════════════

1. Always use squish.waitForObject() — never findObject() for first access (race condition)
2. Never use hardcoded sleep(); use squish.waitForObject() or squish.waitForObjectExists()
3. Every interaction step must be followed by an assertion verifying the expected state change
4. Use test.log() at the start of each major section ("# Login", "# Navigate to settings")
5. If a widget name is unknown, use a descriptive placeholder: ":ACTION_QPushButton"
6. Minimum 2 test.verify() or test.compare() calls per script
7. Always call squish.closeApplication() in a try/finally block for cleanup
8. Use UTF-8 encoding header (# -*- coding: utf-8 -*-)
9. Add a module-level docstring describing the test purpose
10. Variable names: camelCase for widget handles, snake_case for local data

════════════════════��═══════════════════════════════════════
  STRICT OUTPUT FORMAT
════════════════════════════════════════════════════════════

Return EXACTLY one fenced Python code block — nothing else:

\`\`\`python
# content here
\`\`\`
`.trim();

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface SquishtestResult {
  code:       string;
  filename:   string;
  testCount:  number;
}

export async function squishtestWriterAgent(
  input:      string,
  outputPath?: string,
  ai?:         AIClient,
): Promise<SquishtestResult> {
  const client    = ai ?? AIClient.getInstance();
  const sessionId = `squish-${crypto.randomBytes(3).toString('hex')}`;

  aiEventBus.emitTestGen({
    sessionId,
    source: 'story',
    stage:  'writing',
    input:  input.substring(0, 120),
    timestamp: Date.now(),
  });

  logger.info(`[SquishtestWriter] Generating for: "${input.substring(0, 80)}…"`);

  const raw = await client.complete({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:
      `Generate a complete Squishtest Python test script for the following requirement:\n\n${input}\n\n` +
      `Return exactly one fenced Python code block.`,
    maxTokens: 6_000,
    operation: 'write',
  });

  const match  = raw.match(/```(?:python|py)?\s*([\s\S]+?)```/);
  const code   = match ? match[1].trim() : raw.trim();

  // Count test.verify / test.compare calls as "test steps"
  const testCount = (code.match(/test\.(verify|compare|vp)\s*\(/g) ?? []).length;

  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);

  const filename = outputPath ?? `aut/tests/squishtest/tst_${slug}/test.py`;

  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(filename)), { recursive: true });
    await fs.writeFile(path.resolve(filename), code, 'utf8');
    logger.info(`[SquishtestWriter] Script → ${filename}`);
  }

  aiEventBus.emitTestGen({
    sessionId,
    source: 'story',
    stage:  'complete',
    output: code,
    score:  testCount >= 2 ? 85 : 60,
    timestamp: Date.now(),
  });

  return { code, filename, testCount };
}

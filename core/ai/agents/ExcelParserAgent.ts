import * as ExcelJS from 'exceljs';
import { logger }   from '../../utils/logger';

export interface ParsedTestCase {
  id:             string;
  title:          string;
  preconditions:  string;
  steps:          string[];
  expectedResult: string;
  priority:       string;
  tags:           string[];
}

/**
 * Parses Excel (.xlsx) manual test case sheets into a structured array.
 *
 * Accepted column headers (case-insensitive, order-independent):
 *   ID | Test ID | #
 *   Title | Test Name | Test Case | Summary
 *   Preconditions | Pre-conditions | Pre Conditions
 *   Steps | Test Steps | Action
 *   Expected Result | Expected | Expected Output
 *   Priority
 *   Tags | Labels | Category
 *
 * Steps can be:
 *   - A single cell with numbered lines ("1. Do X\n2. Do Y")
 *   - Multiple consecutive "Step N" columns (Step 1, Step 2 …)
 */
export class ExcelParserAgent {

  async parseBuffer(buffer: Buffer): Promise<ParsedTestCase[]> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);

    const results: ParsedTestCase[] = [];

    for (const ws of wb.worksheets) {
      const parsed = this.parseSheet(ws);
      results.push(...parsed);
    }

    logger.info(`[ExcelParserAgent] Parsed ${results.length} test case(s) from ${wb.worksheets.length} sheet(s)`);
    return results;
  }

  async parseFile(filePath: string): Promise<ParsedTestCase[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const results: ParsedTestCase[] = [];
    for (const ws of wb.worksheets) {
      results.push(...this.parseSheet(ws));
    }
    logger.info(`[ExcelParserAgent] Parsed ${results.length} test case(s) from "${filePath}"`);
    return results;
  }

  private parseSheet(ws: ExcelJS.Worksheet): ParsedTestCase[] {
    if (!ws.rowCount || ws.rowCount < 2) return [];

    // Build header → column-index map from first row
    const headerRow = ws.getRow(1);
    const colMap    = this.mapHeaders(headerRow);

    if (!colMap.title) {
      logger.warn(`[ExcelParserAgent] Sheet "${ws.name}" — no recognisable Title column, skipping`);
      return [];
    }

    const results: ParsedTestCase[] = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const title = this.cell(row, colMap.title);
      if (!title) continue; // skip blank rows

      const stepsRaw = colMap.steps ? this.cell(row, colMap.steps) : '';
      const steps    = this.parseSteps(stepsRaw, row, colMap.stepColumns);

      results.push({
        id:             this.cell(row, colMap.id)             || `TC-${String(r - 1).padStart(3, '0')}`,
        title,
        preconditions:  this.cell(row, colMap.preconditions)  || '',
        steps,
        expectedResult: this.cell(row, colMap.expectedResult) || '',
        priority:       this.cell(row, colMap.priority)       || 'Medium',
        tags:           this.cell(row, colMap.tags)
                          ?.split(/[,;|]/).map(t => t.trim()).filter(Boolean) ?? [],
      });
    }

    return results;
  }

  private mapHeaders(row: ExcelJS.Row): {
    id?:             number;
    title?:          number;
    preconditions?:  number;
    steps?:          number;
    expectedResult?: number;
    priority?:       number;
    tags?:           number;
    stepColumns:     number[];
  } {
    const result: ReturnType<typeof this.mapHeaders> = { stepColumns: [] };

    row.eachCell((cell, col) => {
      const h = String(cell.value ?? '').toLowerCase().trim();
      if      (/^(id|test\s*id|#)$/i.test(h))                               result.id             = col;
      else if (/^(title|test\s*name|test\s*case|summary)$/i.test(h))        result.title          = col;
      else if (/^(pre.?conditions?)$/i.test(h))                              result.preconditions  = col;
      else if (/^(steps?|test\s*steps?|actions?)$/i.test(h))                result.steps          = col;
      else if (/^(expected\s*(result|output|behaviour)?)$/i.test(h))        result.expectedResult = col;
      else if (/^priority$/i.test(h))                                        result.priority       = col;
      else if (/^(tags?|labels?|categor(y|ies))$/i.test(h))                 result.tags           = col;
      else if (/^step\s*\d+$/i.test(h))                                     result.stepColumns.push(col);
    });

    return result;
  }

  private parseSteps(raw: string, row: ExcelJS.Row, stepColumns: number[]): string[] {
    // Priority 1: numbered columns (Step 1, Step 2 …)
    if (stepColumns.length > 0) {
      return stepColumns
        .map(col => this.cell(row, col))
        .filter(Boolean);
    }
    // Priority 2: single cell with numbered lines
    if (raw) {
      return raw
        .split(/\r?\n/)
        .map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
    }
    return [];
  }

  private cell(row: ExcelJS.Row, col: number | undefined): string {
    if (!col) return '';
    const v = row.getCell(col).value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text);
    return String(v).trim();
  }

  /** Convert parsed TCs to a prompt string the TestGenerator understands. */
  static toPrompt(testCases: ParsedTestCase[]): string {
    const tcs = testCases.map(tc => [
      `Test Case: ${tc.id} — ${tc.title}`,
      tc.preconditions ? `Preconditions: ${tc.preconditions}` : '',
      tc.steps.length  ? `Steps:\n${tc.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}` : '',
      tc.expectedResult ? `Expected Result: ${tc.expectedResult}` : '',
      tc.priority       ? `Priority: ${tc.priority}` : '',
    ].filter(Boolean).join('\n'));

    return (
      `Generate a production-grade Playwright TypeScript spec for the following Excel test cases.\n` +
      `Follow the project POM conventions and fixture patterns exactly.\n\n` +
      tcs.join('\n\n---\n\n')
    );
  }
}

export const excelParser = new ExcelParserAgent();

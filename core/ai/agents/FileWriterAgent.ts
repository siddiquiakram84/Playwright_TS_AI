import * as fs   from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface WrittenArtifacts {
  specFile:      string;
  dataFile?:     string;
  utilFile?:     string;
  backupFiles:   string[];
}

/**
 * Handles all file I/O for generated test artifacts.
 * Always creates a timestamped .bak before overwriting an existing file.
 */
export class FileWriterAgent {

  write(params: {
    specCode:   string;
    specPath:   string;
    dataJson?:  string;
    utilCode?:  string;
  }): WrittenArtifacts {
    const { specCode, specPath, dataJson, utilCode } = params;
    const backupFiles: string[] = [];

    // ── Spec file ─────────────────────────────────────────────────────────────
    const specDir = path.dirname(specPath);
    fs.mkdirSync(specDir, { recursive: true });

    if (fs.existsSync(specPath)) {
      const bak = this.backupPath(specPath);
      fs.copyFileSync(specPath, bak);
      backupFiles.push(bak);
      logger.info(`[FileWriterAgent] Backup: ${bak}`);
    }

    fs.writeFileSync(specPath, specCode, 'utf-8');
    logger.info(`[FileWriterAgent] Spec written: ${specPath}`);

    // ── Test data JSON ────────────────────────────────────────────────────────
    let dataFile: string | undefined;
    if (dataJson) {
      dataFile = specPath.replace(/\.spec\.ts$/, '.data.json');
      if (fs.existsSync(dataFile)) {
        const bak = this.backupPath(dataFile);
        fs.copyFileSync(dataFile, bak);
        backupFiles.push(bak);
      }
      fs.writeFileSync(dataFile, dataJson, 'utf-8');
      logger.info(`[FileWriterAgent] Data written: ${dataFile}`);
    }

    // ── Utility file ──────────────────────────────────────────────────────────
    let utilFile: string | undefined;
    if (utilCode) {
      utilFile = path.join(specDir, 'generated-utils.ts');
      if (fs.existsSync(utilFile)) {
        const bak = this.backupPath(utilFile);
        fs.copyFileSync(utilFile, bak);
        backupFiles.push(bak);
      }
      fs.writeFileSync(utilFile, utilCode, 'utf-8');
      logger.info(`[FileWriterAgent] Utils written: ${utilFile}`);
    }

    return { specFile: specPath, dataFile, utilFile, backupFiles };
  }

  /**
   * Patch healed selectors back into the source file.
   * Creates a .bak before patching if no backup exists yet.
   */
  patchSelectors(
    specPath:        string,
    healedSelectors: Array<{ original: string; healed: string }>,
  ): boolean {
    if (!fs.existsSync(specPath) || healedSelectors.length === 0) return false;

    let src = fs.readFileSync(specPath, 'utf-8');
    let patched = false;

    for (const { original, healed } of healedSelectors) {
      if (src.includes(original)) {
        // Back up only once before first patch
        if (!patched) {
          const bak = this.backupPath(specPath, 'heal');
          if (!fs.existsSync(bak)) fs.copyFileSync(specPath, bak);
          logger.info(`[FileWriterAgent] Heal backup: ${bak}`);
        }
        src = src.split(original).join(healed);
        patched = true;
        logger.info(`[FileWriterAgent] Patched selector: "${original}" → "${healed}"`);
      }
    }

    if (patched) fs.writeFileSync(specPath, src, 'utf-8');
    return patched;
  }

  private backupPath(filePath: string, tag = 'bak'): string {
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = path.extname(filePath);
    const base = filePath.slice(0, -ext.length);
    return `${base}.${ts}.${tag}${ext}`;
  }
}

export const fileWriter = new FileWriterAgent();

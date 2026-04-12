import path from 'node:path';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import { ScanConfig, ScanInventory } from './types';
import { debug, warn } from './logger';

const DEFAULT_IGNORES = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**', '**/coverage/**'];
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const LANGUAGE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.html', '.htm', '.json']);
const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.bmp', '.tiff', '.tif', '.apng', '.avif']);
const LICENSE_FILES = new Set(['license', 'license.md', 'license.txt', 'license.rst', 'copying', 'copying.md', 'copying.txt']);
const FRONTEND_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.html', '.htm', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.bmp', '.tiff', '.tif', '.apng', '.avif', '.ttf', '.otf', '.woff', '.woff2']);
const NON_FRONTEND_SEGMENTS = new Set(['server', 'backend', 'functions', 'migrations', 'tests', 'test']);
const MAX_TEXT_SAMPLE_SIZE = 50000;
const MAX_CONCURRENT_READS = 10;
const MAX_LANGUAGE_FILES_TO_SAMPLE = 50;

function isFrontendFile(file: string, projectPath: string): boolean {
  const rel = path.relative(projectPath, file).replace(/\\/g, '/');
  const segments = rel.split('/');
  if (segments.some((s) => NON_FRONTEND_SEGMENTS.has(s.toLowerCase()))) {
    return false;
  }
  return FRONTEND_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isLicenseFile(file: string): boolean {
  return LICENSE_FILES.has(path.basename(file).toLowerCase());
}

function classifyFile(ext: string): 'font' | 'language' | 'image' | null {
  if (FONT_EXTENSIONS.has(ext)) return 'font';
  if (LANGUAGE_EXTENSIONS.has(ext)) return 'language';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return null;
}

function detectFrameworkHints(frontendFiles: string[]): string[] {
  const hints = new Set<string>();
  let hasVue = false;
  let hasReact = false;
  let hasVanilla = false;

  for (const file of frontendFiles) {
    if (file.endsWith('.vue')) {
      hasVue = true;
    } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
      hasReact = true;
    } else if (file.endsWith('.html') || file.endsWith('.htm')) {
      hasVanilla = true;
    }
    if (hasVue && hasReact && hasVanilla) break;
  }

  if (hasVue) hints.add('vue');
  if (hasReact) hints.add('react');
  if (hasVanilla) hints.add('vanilla');
  if (hints.size === 0 && frontendFiles.length > 0) hints.add('frontend-generic');

  return Array.from(hints);
}

async function readFileSafe(filePath: string, maxSize: number): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > maxSize * 2) {
      warn('scanner', `File too large, skipping: ${filePath}`, { size: stat.size });
      return null;
    }
    const content = await fs.readFile(filePath, 'utf8');
    return content.slice(0, maxSize);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('scanner', `Failed to read file: ${filePath}`, { error: msg });
    return null;
  }
}

async function extractTextContent(languageFiles: string[]): Promise<string> {
  const filesToSample = languageFiles.slice(0, MAX_LANGUAGE_FILES_TO_SAMPLE);
  const chunks: string[] = [];
  let totalLength = 0;

  for (let i = 0; i < filesToSample.length; i += MAX_CONCURRENT_READS) {
    const batch = filesToSample.slice(i, i + MAX_CONCURRENT_READS);
    const results = await Promise.all(batch.map((f) => readFileSafe(f, MAX_TEXT_SAMPLE_SIZE)));

    for (const content of results) {
      if (!content) continue;
      if (totalLength >= MAX_TEXT_SAMPLE_SIZE) break;
      const remaining = MAX_TEXT_SAMPLE_SIZE - totalLength;
      const chunk = content.slice(0, remaining);
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    if (totalLength >= MAX_TEXT_SAMPLE_SIZE) break;
  }

  return chunks.join('\n').slice(0, MAX_TEXT_SAMPLE_SIZE);
}

export async function scanProjectFiles(config: ScanConfig): Promise<ScanInventory> {
  const projectPath = path.resolve(config.projectPath);
  const ignore = [...DEFAULT_IGNORES, ...(config.ignorePatterns ?? [])];
  debug('scanner', 'Starting file scan', { projectPath, ignore });

  let files: string[] = [];
  try {
    files = await fg('**/*', {
      cwd: projectPath,
      ignore,
      onlyFiles: true,
      absolute: true,
      dot: false
    });
    debug('scanner', 'File scan completed', { totalFiles: files.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('scanner', `File scan failed: ${msg}`, { projectPath });
    return {
      allFiles: [],
      frontendFrameworkHints: [],
      fontFiles: [],
      languageFiles: [],
      imageFiles: [],
      licenseFiles: [],
      mergedTextContent: ''
    };
  }

  const frontendFiles: string[] = [];
  const licenseFiles: string[] = [];
  const fontFiles: string[] = [];
  const languageFiles: string[] = [];
  const imageFiles: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (isFrontendFile(file, projectPath)) {
      frontendFiles.push(file);
      const type = classifyFile(ext);
      if (type === 'font') fontFiles.push(file);
      else if (type === 'language') languageFiles.push(file);
      else if (type === 'image') imageFiles.push(file);
    }
    if (isLicenseFile(file)) {
      licenseFiles.push(file);
    }
  }

  const frontendFrameworkHints = detectFrameworkHints(frontendFiles);

  let mergedTextContent = '';
  try {
    mergedTextContent = await extractTextContent(languageFiles);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('scanner', `Text content extraction failed: ${msg}`);
  }

  debug('scanner', 'File scan completed', {
    frontendFiles: frontendFiles.length,
    fontFiles: fontFiles.length,
    languageFiles: languageFiles.length,
    imageFiles: imageFiles.length,
    licenseFiles: licenseFiles.length,
    textContentLength: mergedTextContent.length
  });

  return {
    allFiles: frontendFiles,
    frontendFrameworkHints,
    fontFiles,
    languageFiles,
    imageFiles,
    licenseFiles,
    mergedTextContent
  };
}

import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';

export type ScanMode = 'strict' | 'normal' | 'loose' | 'ignore';

const imageDetectionSchema = z.object({
  enabled: z.boolean().default(false),
  apiEndpoint: z.string().default(''),
  apiKey: z.string().default(''),
  strictMode: z.boolean().default(false)
});

const aiDetectionSchema = z.object({
  enabled: z.boolean().default(false),
  apiEndpoint: z.string().default(''),
  apiKey: z.string().default(''),
  model: z.string().default('gpt-4o')
});

const trademarkDetectionSchema = z.object({
  enabled: z.boolean().default(false),
  apiEndpoint: z.string().default(''),
  apiKey: z.string().default(''),
  regions: z.array(z.string()).default(['zh-CN', 'zh-Hant', 'en', 'ja', 'ko'])
});

const ignoreRuleSchema = z.object({
  type: z.enum(['font', 'image', 'language', 'license']),
  pattern: z.string(),
  reason: z.string().optional()
});

const settingsSchema = z.object({
  scanMode: z.enum(['strict', 'normal', 'loose', 'ignore']).default('normal'),
  imageDetection: imageDetectionSchema,
  aiDetection: aiDetectionSchema,
  trademarkDetection: trademarkDetectionSchema,
  userIgnores: z.record(z.string(), z.array(ignoreRuleSchema)).default({})
});

export type Settings = z.infer<typeof settingsSchema>;

function getGlobalSettingsPath(): string {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path.join(homeDir, '.ipguard', 'settings.json');
}

function getProjectSettingsPath(projectPath: string): string {
  return path.join(projectPath, '.ipguard.json');
}

function mergeSettings(global: Partial<Settings>, project: Partial<Settings>): Settings {
  const defaultSettings: Settings = {
    scanMode: 'normal',
    imageDetection: { enabled: false, apiEndpoint: '', apiKey: '', strictMode: false },
    aiDetection: { enabled: false, apiEndpoint: '', apiKey: '', model: 'gpt-4o' },
    trademarkDetection: { enabled: false, apiEndpoint: '', apiKey: '', regions: ['zh-CN', 'zh-Hant', 'en', 'ja', 'ko'] },
    userIgnores: {}
  };

  const merged: Settings = {
    scanMode: project.scanMode ?? global.scanMode ?? defaultSettings.scanMode,
    imageDetection: {
      enabled: project.imageDetection?.enabled ?? global.imageDetection?.enabled ?? defaultSettings.imageDetection.enabled,
      apiEndpoint: project.imageDetection?.apiEndpoint ?? global.imageDetection?.apiEndpoint ?? defaultSettings.imageDetection.apiEndpoint,
      apiKey: project.imageDetection?.apiKey ?? global.imageDetection?.apiKey ?? defaultSettings.imageDetection.apiKey,
      strictMode: project.imageDetection?.strictMode ?? global.imageDetection?.strictMode ?? defaultSettings.imageDetection.strictMode
    },
    aiDetection: {
      enabled: project.aiDetection?.enabled ?? global.aiDetection?.enabled ?? defaultSettings.aiDetection.enabled,
      apiEndpoint: project.aiDetection?.apiEndpoint ?? global.aiDetection?.apiEndpoint ?? defaultSettings.aiDetection.apiEndpoint,
      apiKey: project.aiDetection?.apiKey ?? global.aiDetection?.apiKey ?? defaultSettings.aiDetection.apiKey,
      model: project.aiDetection?.model ?? global.aiDetection?.model ?? defaultSettings.aiDetection.model
    },
    trademarkDetection: {
      enabled: project.trademarkDetection?.enabled ?? global.trademarkDetection?.enabled ?? defaultSettings.trademarkDetection.enabled,
      apiEndpoint: project.trademarkDetection?.apiEndpoint ?? global.trademarkDetection?.apiEndpoint ?? defaultSettings.trademarkDetection.apiEndpoint,
      apiKey: project.trademarkDetection?.apiKey ?? global.trademarkDetection?.apiKey ?? defaultSettings.trademarkDetection.apiKey,
      regions: project.trademarkDetection?.regions ?? global.trademarkDetection?.regions ?? defaultSettings.trademarkDetection.regions
    },
    userIgnores: {
      ...defaultSettings.userIgnores,
      ...global.userIgnores,
      ...project.userIgnores
    }
  };
  return merged;
}

export interface LoadedSettings {
  settings: Settings;
  projectName: string;
  source: 'global' | 'project' | 'default';
  effectiveIgnores: IgnoreRule[];
}

export interface IgnoreRule {
  type: 'font' | 'image' | 'language' | 'license';
  pattern: string;
  reason?: string;
}

export function loadSettings(projectPath: string): LoadedSettings {
  const resolvedPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedPath);

  const globalPath = getGlobalSettingsPath();
  const projectPath_ = getProjectSettingsPath(resolvedPath);

  let globalSettings: Partial<Settings> = {};
  let projectSettings: Partial<Settings> = {};
  let globalLoaded = false;
  let projectLoaded = false;

  try {
    if (fs.existsSync(globalPath)) {
      const content = fs.readFileSync(globalPath, 'utf8');
      const parsed = JSON.parse(content);
      globalSettings = settingsSchema.parse(parsed);
      globalLoaded = true;
    }
  } catch {
    globalSettings = {};
  }

  try {
    if (fs.existsSync(projectPath_)) {
      const content = fs.readFileSync(projectPath_, 'utf8');
      const parsed = JSON.parse(content);
      projectSettings = settingsSchema.parse(parsed);
      projectLoaded = true;
    }
  } catch {
    projectSettings = {};
  }

  const source: 'global' | 'project' | 'default' = projectLoaded ? 'project' : globalLoaded ? 'global' : 'default';

  const merged = mergeSettings(globalSettings, projectSettings);

  const effectiveIgnores: IgnoreRule[] = merged.userIgnores[projectName] ?? [];

  return {
    settings: merged,
    projectName,
    source,
    effectiveIgnores
  };
}

export function shouldIgnore(filePath: string, rules: IgnoreRule[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const rule of rules) {
    if (matchGlobPattern(normalizedPath, rule.pattern)) {
      return true;
    }
  }
  return false;
}

function matchGlobPattern(filePath: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filePath);
}

function globToRegex(glob: string): RegExp {
  const charClassPlaces: string[] = [];
  let sanitized = glob.replace(/\[.*?\]/g, (match) => {
    charClassPlaces.push(match);
    return `\x00CHAR_CLASS_${charClassPlaces.length - 1}\x00`;
  });

  sanitized = sanitized
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  sanitized = sanitized.replace(/\x00CHAR_CLASS_(\d+)\x00/g, (_, idx) => {
    const charClass = charClassPlaces[parseInt(idx, 10)];
    return charClass.replace(/[\\^]/g, (c) => '\\' + c);
  });

  if (!glob.startsWith('**/') && !glob.startsWith('/')) {
    sanitized = '(^|/)' + sanitized;
  }
  sanitized = sanitized + '$';
  return new RegExp(sanitized);
}

export function isOnlineMode(settings: Settings): boolean {
  return (
    settings.imageDetection.enabled ||
    settings.aiDetection.enabled ||
    settings.trademarkDetection.enabled
  );
}

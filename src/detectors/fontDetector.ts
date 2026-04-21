import path from 'node:path';
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { ScanResult } from '../types';

interface FontReplacement {
  name: string;
  style?: string;
  license?: string;
}

interface FontRule {
  name: string;
  family: string[];
  risk: 'high' | 'medium' | 'low';
  reason: string;
  replacements?: FontReplacement[];
}

interface WhitelistFont {
  name: string;
  style?: string;
  license?: string;
  language?: string;
  website?: string;
}

interface BlacklistFile {
  blacklist: FontRule[];
  cautions?: FontRule[];
}

interface WhitelistFile {
  whitelist: (string | WhitelistFont)[];
}

const FONT_CONFIDENCE_WITH_METADATA = 0.92;
const FONT_CONFIDENCE_FILENAME_ONLY = 0.85;
const RISK_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险'
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
}

function loadJsonConfig<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function extractPostScriptName(fontPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    opentype.load(fontPath, (error, font) => {
      if (error || !font) {
        resolve(null);
        return;
      }
      const name = font.names.postScriptName?.en ?? null;
      resolve(typeof name === 'string' ? name : null);
    });
  });
}

export async function detectFonts(
  fontFiles: string[],
  configDir: string
): Promise<ScanResult[]> {
  const blacklistFile = path.join(configDir, 'blacklist.json');
  const whitelistFile = path.join(configDir, 'whitelist.json');
  const blacklistData = loadJsonConfig<BlacklistFile>(blacklistFile);
  const whitelistData = loadJsonConfig<WhitelistFile>(whitelistFile);

  const blacklist = [
    ...blacklistData.blacklist,
    ...(blacklistData.cautions ?? [])
  ];

  const normalizedBlacklist = blacklist.map((rule) => ({
    rule,
    names: [rule.name, ...rule.family].map(normalize)
  }));

  const whitelistNames: string[] = [];
  for (const item of whitelistData.whitelist) {
    if (typeof item === 'string') {
      whitelistNames.push(item);
    } else {
      whitelistNames.push(item.name);
    }
  }

  const whitelistSet = new Set(whitelistNames.map(normalize));
  const results: ScanResult[] = [];

  for (const file of fontFiles) {
    const fileBase = path.basename(file, path.extname(file));
    const metadataName = await extractPostScriptName(file);
    const candidates = [fileBase, metadataName ?? ''].filter(Boolean).map(normalize);

    if (candidates.some((name) => whitelistSet.has(name))) {
      continue;
    }

    const hit = normalizedBlacklist.find(({ names }) => {
      return candidates.some((candidate) => names.some((name) => candidate.includes(name) || name.includes(candidate)));
    });

    if (!hit) {
      continue;
    }

    const replacements = hit.rule.replacements ?? [];
    const replacementText = replacements.length > 0
      ? replacements.map((r) => `${r.name}${r.style ? ` (${r.style})` : ''}`).join(', ')
      : 'Noto Sans, Source Han Sans';

    results.push({
      type: 'font',
      risk: hit.rule.risk,
      file,
      confidence: metadataName ? FONT_CONFIDENCE_WITH_METADATA : FONT_CONFIDENCE_FILENAME_ONLY,
      message: `检测到${RISK_LABEL[hit.rule.risk]}字体 ${hit.rule.name}：${hit.rule.reason}`,
      suggestion: `建议替换为：${replacementText}`
    });
  }

  return results;
}

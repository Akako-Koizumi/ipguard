import fs from 'node:fs/promises';
import { franc } from 'franc';
import TradOrSimp from 'traditional-or-simplified';
import { LanguageDetection, ScanResult } from '../types';

const CHINESE_CHAR_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;
const JAPANESE_CHAR_REGEX = /[\u3040-\u30ff]/gu;
const KOREAN_CHAR_REGEX = /[\uac00-\ud7af]/gu;
const DEVANAGARI_CHAR_REGEX = /[\u0900-\u097f]/gu;
export const LANGUAGE_SAMPLE_LIMIT = 80;
const PER_FILE_CHAR_LIMIT = 12000;
const CONFIDENCE_NO_SAMPLE = 0.3;
const CONFIDENCE_HIGH = 0.92;
const CONFIDENCE_MEDIUM = 0.82;
const CONFIDENCE_LOW = 0.72;
const SCRIPT_MIN_COUNT = 8;
const FRANC_MIN_LENGTH = 20;

function normalizeForLanguageDetection(content: string): string {
  return content.replace(/[^\p{L}\p{N}\s]/gu, ' ');
}

function countMatches(content: string, regex: RegExp): number {
  return content.match(regex)?.length ?? 0;
}

function resolveChineseMarket(text: string): Pick<LanguageDetection, 'market' | 'marketLabel' | 'confidence'> {
  const detail = TradOrSimp.detect(text);
  if (detail.traditionalCharacters > detail.simplifiedCharacters) {
    return {
      market: 'zh-Hant',
      marketLabel: '台湾/香港（繁体）/新加坡（部分繁体）',
      confidence: CONFIDENCE_MEDIUM
    };
  }
  return {
    market: 'zh-CN',
    marketLabel: '中国大陆简体',
    confidence: CONFIDENCE_HIGH
  };
}

function resolveFromFranc(languageCode: string, text: string): Pick<LanguageDetection, 'market' | 'marketLabel' | 'confidence'> {
  if (languageCode === 'eng') {
    return { market: 'en', marketLabel: '英文国家（英语）', confidence: CONFIDENCE_HIGH };
  }
  if (['cmn', 'zho', 'wuu', 'yue'].includes(languageCode)) {
    return resolveChineseMarket(text);
  }
  if (languageCode === 'jpn') {
    return { market: 'ja', marketLabel: '日本日语', confidence: CONFIDENCE_HIGH };
  }
  if (languageCode === 'kor') {
    return { market: 'ko', marketLabel: '韩国韩语', confidence: CONFIDENCE_HIGH };
  }
  if (languageCode === 'hin') {
    return { market: 'hi', marketLabel: '印度（印地语）', confidence: CONFIDENCE_MEDIUM };
  }
  return { market: 'other', marketLabel: '其他语言区域', confidence: CONFIDENCE_LOW };
}

export async function detectLanguage(languageFiles: string[]): Promise<LanguageDetection> {
  const sampleFiles = languageFiles.slice(0, LANGUAGE_SAMPLE_LIMIT);
  const chunks: string[] = [];

  for (const file of sampleFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      chunks.push(normalizeForLanguageDetection(content).slice(0, PER_FILE_CHAR_LIMIT));
    } catch {
      continue;
    }
  }
  const mergedContent = chunks.join('\n').trim();
  const totalCount = mergedContent.length;

  if (totalCount === 0) {
    return {
      market: 'other',
      marketLabel: '其他语言区域',
      languageCode: 'und',
      confidence: CONFIDENCE_NO_SAMPLE,
      ratio: 0,
      sampledFiles: sampleFiles.length,
      sampledCharacters: 0,
      detector: 'franc+traditional-or-simplified'
    };
  }

  const chineseCount = countMatches(mergedContent, CHINESE_CHAR_REGEX);
  const japaneseCount = countMatches(mergedContent, JAPANESE_CHAR_REGEX);
  const koreanCount = countMatches(mergedContent, KOREAN_CHAR_REGEX);
  const hindiCount = countMatches(mergedContent, DEVANAGARI_CHAR_REGEX);
  const chineseRatio = chineseCount / totalCount;
  const japaneseRatio = japaneseCount / totalCount;
  const koreanRatio = koreanCount / totalCount;
  const hindiRatio = hindiCount / totalCount;

  if (chineseCount >= SCRIPT_MIN_COUNT && chineseCount >= japaneseCount + koreanCount) {
    const chineseMarket = resolveChineseMarket(mergedContent);
    return {
      ...chineseMarket,
      languageCode: 'zho',
      ratio: chineseRatio,
      sampledFiles: sampleFiles.length,
      sampledCharacters: totalCount,
      detector: 'script-priority+traditional-or-simplified'
    };
  }
  if (japaneseCount >= SCRIPT_MIN_COUNT && japaneseCount >= chineseCount) {
    return {
      market: 'ja',
      marketLabel: '日本日语',
      languageCode: 'jpn',
      confidence: CONFIDENCE_HIGH,
      ratio: japaneseRatio,
      sampledFiles: sampleFiles.length,
      sampledCharacters: totalCount,
      detector: 'script-priority'
    };
  }
  if (koreanCount >= SCRIPT_MIN_COUNT) {
    return {
      market: 'ko',
      marketLabel: '韩国韩语',
      languageCode: 'kor',
      confidence: CONFIDENCE_HIGH,
      ratio: koreanRatio,
      sampledFiles: sampleFiles.length,
      sampledCharacters: totalCount,
      detector: 'script-priority'
    };
  }
  if (hindiCount >= SCRIPT_MIN_COUNT) {
    return {
      market: 'hi',
      marketLabel: '印度（印地语）',
      languageCode: 'hin',
      confidence: CONFIDENCE_MEDIUM,
      ratio: hindiRatio,
      sampledFiles: sampleFiles.length,
      sampledCharacters: totalCount,
      detector: 'script-priority'
    };
  }

  const languageCode = franc(mergedContent, { minLength: FRANC_MIN_LENGTH });

  if (languageCode === 'und') {
    if (japaneseCount > 0) {
      return {
        market: 'ja',
        marketLabel: '日本日语',
        languageCode: 'jpn',
        confidence: CONFIDENCE_MEDIUM,
        ratio: japaneseRatio,
        sampledFiles: sampleFiles.length,
        sampledCharacters: totalCount,
        detector: 'script-fallback'
      };
    }
    if (koreanCount > 0) {
      return {
        market: 'ko',
        marketLabel: '韩国韩语',
        languageCode: 'kor',
        confidence: CONFIDENCE_MEDIUM,
        ratio: koreanRatio,
        sampledFiles: sampleFiles.length,
        sampledCharacters: totalCount,
        detector: 'script-fallback'
      };
    }
    if (hindiCount > 0) {
      return {
        market: 'hi',
        marketLabel: '印度（印地语）',
        languageCode: 'hin',
        confidence: CONFIDENCE_MEDIUM,
        ratio: hindiRatio,
        sampledFiles: sampleFiles.length,
        sampledCharacters: totalCount,
        detector: 'script-fallback'
      };
    }
    if (chineseCount > 0) {
      const chineseMarket = resolveChineseMarket(mergedContent);
      return {
        ...chineseMarket,
        languageCode: 'zho',
        ratio: chineseRatio,
        sampledFiles: sampleFiles.length,
        sampledCharacters: totalCount,
        detector: 'script-fallback+traditional-or-simplified'
      };
    }
    return {
      market: 'en',
      marketLabel: '英文国家（英语）',
      languageCode: 'eng',
      confidence: CONFIDENCE_LOW,
      ratio: 0,
      sampledFiles: sampleFiles.length,
      sampledCharacters: totalCount,
      detector: 'fallback-default'
    };
  }

  const resolved = resolveFromFranc(languageCode, mergedContent);
  const ratioByLanguageCode: Record<string, number> = {
    eng: 0,
    cmn: chineseRatio,
    zho: chineseRatio,
    wuu: chineseRatio,
    yue: chineseRatio,
    jpn: japaneseRatio,
    kor: koreanRatio,
    hin: hindiRatio
  };
  return {
    ...resolved,
    languageCode,
    confidence: resolved.confidence,
    ratio: ratioByLanguageCode[languageCode] ?? 0,
    sampledFiles: sampleFiles.length,
    sampledCharacters: totalCount,
    detector: 'franc+traditional-or-simplified'
  };
}

export function toLanguageResult(language: LanguageDetection): ScanResult {
  const mediumRiskMarkets = new Set<LanguageDetection['market']>(['zh-CN', 'zh-Hant', 'ja', 'ko', 'hi']);
  const riskLevel: 'low' | 'medium' = mediumRiskMarkets.has(language.market) ? 'medium' : 'low';
  return {
    type: 'language',
    risk: riskLevel,
    confidence: language.confidence,
    message: `语言分析结果：目标市场为 ${language.marketLabel}（代码=${language.languageCode}, 样本文件=${language.sampledFiles}）`,
    suggestion: '可结合业务市场和合规策略进行人工复核'
  };
}

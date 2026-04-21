import fs from 'node:fs';
import { ScanResult } from '../types';
import { Region } from '../types';

const MAX_FILES_TO_SCAN = 50;
const MAX_FILE_SIZE = 5000;
const MAX_CONCURRENT_READS = 10;

export interface PrivacyRisk {
  code: string;
  name: string;
  risk: 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
}

export interface PrivacyAnalysis {
  hasPrivacyRisks: boolean;
  confidence: number;
  message: string;
  risks: PrivacyRisk[];
  details: string[];
}

interface PrivacyCheck {
  pattern: RegExp;
  weight: number;
  riskType: 'high' | 'medium' | 'low';
}

const GDPR_KEYWORDS_EUROPE: PrivacyCheck[] = [
  { pattern: /privacy\s*policy/gi, weight: 1, riskType: 'low' },
  { pattern: /cookie\s*consent/gi, weight: 1, riskType: 'low' },
  { pattern: /gdpr|general\s*data\s*protection/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*subject\s*rights/gi, weight: 1, riskType: 'low' },
  { pattern: /consent\s*mechanism/gi, weight: 1, riskType: 'low' },
  { pattern: /cross[\s-]?border\s*transfer/gi, weight: 1, riskType: 'low' },
  { pattern: /right\s*to\s*(be\s*forgotten|erasure|deletion)/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*portability/gi, weight: 1, riskType: 'low' },
  { pattern: /DPO|data\s*protection\s*officer/gi, weight: 1, riskType: 'low' }
];

const GDPR_KEYWORDS: PrivacyCheck[] = [
  { pattern: /privacy\s*policy/gi, weight: 1, riskType: 'low' },
  { pattern: /cookie\s*consent/gi, weight: 1, riskType: 'low' },
  { pattern: /gdpr|general\s*data\s*protection/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*subject\s*rights/gi, weight: 1, riskType: 'low' },
  { pattern: /consent\s*mechanism/gi, weight: 1, riskType: 'low' },
  { pattern: /cross[\s-]?border\s*transfer/gi, weight: 1, riskType: 'low' },
  { pattern: /right\s*to\s*(be\s*forgotten|erasure|deletion)/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*portability/gi, weight: 1, riskType: 'low' },
  { pattern: /DPO|data\s*protection\s*officer/gi, weight: 1, riskType: 'low' }
];

const CCPA_KEYWORDS: PrivacyCheck[] = [
  { pattern: /privacy\s*policy/gi, weight: 1, riskType: 'low' },
  { pattern: /CCPA|california\s*consumer\s*privacy/gi, weight: 1, riskType: 'low' },
  { pattern: /do\s*not\s*(sell|share)\s*(my\s*)?personal\s*information/gi, weight: 1, riskType: 'low' },
  { pattern: /consumer\s*rights/gi, weight: 1, riskType: 'low' },
  { pattern: /opt[\s-]?out/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*collection\s*practices/gi, weight: 1, riskType: 'low' }
];

const LGPD_KEYWORDS: PrivacyCheck[] = [
  { pattern: /privacidade|pol[ií]tica\s*de\s*privacidade/gi, weight: 1, riskType: 'low' },
  { pattern: /LGPD|lei\s*geral\s*de\s*proteção\s*de\s*dados/gi, weight: 1, riskType: 'low' },
  { pattern: /consentimento|aceite/gi, weight: 1, riskType: 'low' },
  { pattern: /dados\s*pessoais|titular\s*dos\s*dados/gi, weight: 1, riskType: 'low' },
  { pattern: /tratamento|processamento/gi, weight: 1, riskType: 'low' },
  { pattern: /encarregado\s*de\s*dados|DPO/gi, weight: 1, riskType: 'low' }
];

const POPIA_KEYWORDS: PrivacyCheck[] = [
  { pattern: /privacy\s*policy|POPIA|protection\s*of\s*personal\s*information/gi, weight: 1, riskType: 'low' },
  { pattern: /responsible\s*party|information\s*officer/gi, weight: 1, riskType: 'low' },
  { pattern: /consent|processing\s*condition/gi, weight: 1, riskType: 'low' },
  { pattern: /personal\s*information\s*regulator/gi, weight: 1, riskType: 'low' }
];

function checkKeywords(text: string, checks: PrivacyCheck[]): { score: number; maxScore: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  for (const check of checks) {
    check.pattern.lastIndex = 0;
    const matches = text.match(check.pattern);
    if (matches) {
      score += check.weight;
      matched.push(...new Set(matches.map((m) => m.toLowerCase())));
    }
  }

  return {
    score,
    maxScore: checks.length,
    matched: [...new Set(matched)]
  };
}

function getRegionRegulation(region: Region): { checks: PrivacyCheck[]; regulation: string } {
  switch (region) {
    case 'europe':
      return { checks: [...GDPR_KEYWORDS_EUROPE, ...CCPA_KEYWORDS], regulation: 'GDPR/CCPA' };
    case 'north-america':
      return { checks: [...GDPR_KEYWORDS, ...CCPA_KEYWORDS], regulation: 'CCPA/GDPR' };
    case 'east-asia':
      return { checks: [...GDPR_KEYWORDS], regulation: 'GDPR' };
    case 'south-america':
      return { checks: [...LGPD_KEYWORDS], regulation: 'LGPD' };
    case 'africa':
      return { checks: [...POPIA_KEYWORDS], regulation: 'POPIA' };
    case 'other':
    default:
      return { checks: [...GDPR_KEYWORDS], regulation: 'GDPR' };
  }
}

async function readFileSafe(filePath: string, maxSize: number): Promise<string | null> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > maxSize * 2) {
      return null;
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content.slice(0, maxSize);
  } catch {
    return null;
  }
}

async function readLanguageFilesConcurrently(files: string[]): Promise<string> {
  const filesToScan = files.slice(0, MAX_FILES_TO_SCAN);
  const chunks: string[] = [];
  let totalLength = 0;

  for (let i = 0; i < filesToScan.length; i += MAX_CONCURRENT_READS) {
    const batch = filesToScan.slice(i, i + MAX_CONCURRENT_READS);
    const results = await Promise.all(batch.map((f) => readFileSafe(f, MAX_FILE_SIZE)));

    for (const content of results) {
      if (!content) continue;
      if (totalLength >= MAX_FILES_TO_SCAN * MAX_FILE_SIZE) break;
      const remaining = MAX_FILES_TO_SCAN * MAX_FILE_SIZE - totalLength;
      const chunk = content.slice(0, remaining);
      chunks.push(chunk);
      totalLength += chunk.length;
    }

    if (totalLength >= MAX_FILES_TO_SCAN * MAX_FILE_SIZE) break;
  }

  return chunks.join('\n');
}

export async function detectPrivacy(
  projectPath: string,
  languageFiles: string[],
  imageFiles: string[],
  region: Region = 'europe'
): Promise<PrivacyAnalysis> {
  const risks: PrivacyRisk[] = [];
  const details: string[] = [];

  const { checks, regulation } = getRegionRegulation(region);
  details.push(`目标地区: ${region}, 适用法规: ${regulation}`);

  let allText = '';
  try {
    if (languageFiles && languageFiles.length > 0) {
      allText = await readLanguageFilesConcurrently(languageFiles);
    }
  } catch {
    details.push('读取语言文件时发生错误');
  }

  if (!allText) {
    details.push('未读取到任何文本内容');
  } else {
    details.push(`已扫描 ${Math.min(languageFiles.length, MAX_FILES_TO_SCAN)} 个文件`);
  }

  const result = checkKeywords(allText, checks);
  details.push(`隐私政策关键词得分: ${result.score}/${result.maxScore}`);

  if (result.matched.length > 0) {
    details.push(`匹配关键词: ${result.matched.slice(0, 5).join(', ')}${result.matched.length > 5 ? '...' : ''}`);
  }

  const hasPrivacyPolicy = result.score > 0;

  if (!hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_001',
      name: '缺少隐私政策声明',
      risk: 'high',
      message: `面向 ${region} 市场的网站未检测到隐私政策关键词（${regulation}）`,
      suggestion: `根据 ${regulation} 法规要求，添加隐私政策页面并包含相关关键词`
    });
  }

  const hasCookieConsent = /cookie\s*consent|cookie\s*banner|cookie[\s-]?notice/gi.test(allText);
  if (!hasCookieConsent && hasPrivacyPolicy && (region === 'europe' || region === 'north-america')) {
    risks.push({
      code: 'PRIVACY_002',
      name: '缺少 Cookie 同意机制',
      risk: 'medium',
      message: '未检测到 Cookie 同意相关代码',
      suggestion: '根据隐私法规要求，添加 Cookie 同意横幅或通知'
    });
  }

  const hasConsentMechanism = /consent\s* mechanism|opt[\s-]?in|opt[\s-]?out|同意|consent/gi.test(allText);
  if (!hasConsentMechanism && hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_003',
      name: '缺少用户同意机制',
      risk: 'medium',
      message: '未检测到用户同意/选择退出机制',
      suggestion: '添加用户同意收集个人信息的机制'
    });
  }

  const hasDataSubjectRights = /right\s*to|access\s*request|delete\s*request|erasure\s*request|데이터\s*주체\s*권리|データ主体の権利/gi.test(allText);
  if (!hasDataSubjectRights && hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_004',
      name: '缺少数据主体权利支持',
      risk: 'medium',
      message: '未检测到用户数据访问/删除请求的处理机制',
      suggestion: '根据隐私法规添加数据主体权利行使接口'
    });
  }

  const hasThirdPartyDisclosure = /third[\s-]?party|제3자|第三者/gi.test(allText);
  if (!hasThirdPartyDisclosure && hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_005',
      name: '缺少第三方数据共享披露',
      risk: 'low',
      message: '未检测到第三方数据共享的明确披露',
      suggestion: '在隐私政策中明确披露与第三方的数据共享'
    });
  }

  const riskCounts = { high: 0, medium: 0, low: 0 };
  for (const risk of risks) {
    riskCounts[risk.risk]++;
  }

  let message: string;
  if (risks.length === 0) {
    message = `未检测到明显隐私风险（${regulation}）`;
  } else {
    message = `检测到 ${risks.length} 项隐私相关问题（高危${riskCounts.high}项，中危${riskCounts.medium}项，低危${riskCounts.low}项）`;
  }

  const confidence = hasPrivacyPolicy ? 0.7 : 0.5;

  return {
    hasPrivacyRisks: risks.length > 0,
    confidence,
    message,
    risks,
    details
  };
}

export function toPrivacyResult(analysis: PrivacyAnalysis): ScanResult {
  if (analysis.risks.length === 0) {
    return {
      type: 'privacy',
      risk: 'low',
      confidence: analysis.confidence,
      message: analysis.message,
      suggestion: '继续关注隐私合规，建议定期审查隐私政策'
    };
  }

  const topRisk = analysis.risks[0];
  return {
    type: 'privacy',
    risk: topRisk.risk,
    confidence: analysis.confidence,
    message: analysis.message,
    suggestion: analysis.risks.map((r) => `[${r.code}] ${r.message}`).join('; ')
  };
}

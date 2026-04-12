import { ScanResult } from '../types';
import { LanguageMarket } from '../types';

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

const APPI_KEYWORDS: PrivacyCheck[] = [
  { pattern: /privacy\s*policy|个人信息保護/gi, weight: 1, riskType: 'low' },
  { pattern: /purpose\s*specification|目的の明示/gi, weight: 1, riskType: 'low' },
  { pattern: /consent|同意/gi, weight: 1, riskType: 'low' },
  { pattern: /個人情報|personal\s*information/gi, weight: 1, riskType: 'low' },
  { pattern: / sensitive\s*data| special\s*care[\s-]?required/gi, weight: 1, riskType: 'low' },
  { pattern: /data\s*disclosure|開示/gi, weight: 1, riskType: 'low' }
];

const PIPA_KEYWORDS: PrivacyCheck[] = [
  { pattern: /개인정보\s*처리방침|개인정보 보호/gi, weight: 1, riskType: 'low' },
  { pattern: /PIPA|개인정보\s*보호\s*법/gi, weight: 1, riskType: 'low' },
  { pattern: /정정|삭제|열람/gi, weight: 1, riskType: 'low' },
  { pattern: /개인정보\s*보호\s*책임관|PIPO/gi, weight: 1, riskType: 'low' },
  { pattern: /민감정보|취급위탁/gi, weight: 1, riskType: 'low' },
  { pattern: /third[\s-]?party\s*disclosure|제3자\s*제공/gi, weight: 1, riskType: 'low' }
];

function checkKeywords(text: string, checks: PrivacyCheck[]): { score: number; maxScore: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];

  for (const check of checks) {
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

function detectForRegion(text: string, market: LanguageMarket): {
  hasPrivacyPolicy: boolean;
  score: number;
  maxScore: number;
  keywords: string[];
} {
  let checks: PrivacyCheck[];
  switch (market) {
    case 'zh-CN':
      checks = GDPR_KEYWORDS;
      break;
    case 'en':
      checks = [...GDPR_KEYWORDS, ...CCPA_KEYWORDS];
      break;
    case 'zh-Hant':
      checks = GDPR_KEYWORDS;
      break;
    case 'ja':
      checks = APPI_KEYWORDS;
      break;
    case 'ko':
      checks = PIPA_KEYWORDS;
      break;
    default:
      checks = GDPR_KEYWORDS;
  }

  const result = checkKeywords(text, checks);
  return {
    hasPrivacyPolicy: result.score > 0,
    score: result.score,
    maxScore: result.maxScore,
    keywords: result.matched
  };
}

export function detectPrivacy(
  projectPath: string,
  languageFiles: string[],
  imageFiles: string[]
): PrivacyAnalysis {
  const risks: PrivacyRisk[] = [];
  const details: string[] = [];

  let marketHint: LanguageMarket = 'other';
  const allText = (languageFiles.length + imageFiles.length).toString();
  const zhCNCount = allText.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  if (zhCNCount > 100) {
    const jaCount = allText.match(/[\u3040-\u309f\u30a0-\u30ff]/g)?.length ?? 0;
    const koCount = allText.match(/[\uac00-\ud7af]/g)?.length ?? 0;
    if (jaCount > koCount && jaCount > zhCNCount / 2) {
      marketHint = 'ja';
    } else if (koCount > jaCount && koCount > zhCNCount / 3) {
      marketHint = 'ko';
    } else {
      marketHint = 'zh-CN';
    }
  } else {
    marketHint = 'en';
  }

  details.push(`检测到目标市场: ${marketHint}`);

  const regionResult = detectForRegion(allText, marketHint);
  details.push(`隐私政策关键词得分: ${regionResult.score}/${regionResult.maxScore}`);

  if (regionResult.keywords.length > 0) {
    details.push(`匹配关键词: ${regionResult.keywords.slice(0, 5).join(', ')}${regionResult.keywords.length > 5 ? '...' : ''}`);
  }

  if (!regionResult.hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_001',
      name: '缺少隐私政策声明',
      risk: 'high',
      message: `面向 ${marketHint} 市场的网站未检测到隐私政策关键词`,
      suggestion: `根据 ${marketHint === 'zh-CN' ? 'GDPR' : marketHint === 'en' ? 'CCPA/GDPR' : marketHint === 'ja' ? 'APPI' : 'PIPA'} 法规要求，添加隐私政策页面并包含相关关键词`
    });
  }

  const hasCookieConsent = /cookie\s*consent|cookie\s*banner|cookie[\s-]?notice/gi.test(allText);
  if (!hasCookieConsent && regionResult.hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_002',
      name: '缺少 Cookie 同意机制',
      risk: 'medium',
      message: '未检测到 Cookie 同意相关代码',
      suggestion: '根据隐私法规要求，添加 Cookie 同意横幅或通知'
    });
  }

  const hasConsentMechanism = /consent\s* mechanism|opt[\s-]?in|opt[\s-]?out|同意|consent/gi.test(allText);
  if (!hasConsentMechanism && regionResult.hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_003',
      name: '缺少用户同意机制',
      risk: 'medium',
      message: '未检测到用户同意/选择退出机制',
      suggestion: '添加用户同意收集个人信息的机制'
    });
  }

  const hasDataSubjectRights = /right\s*to|access\s*request|delete\s*request|erasure\s*request|데이터\s*주체\s*권리|データ主体の権利/gi.test(allText);
  if (!hasDataSubjectRights && regionResult.hasPrivacyPolicy) {
    risks.push({
      code: 'PRIVACY_004',
      name: '缺少数据主体权利支持',
      risk: 'medium',
      message: '未检测到用户数据访问/删除请求的处理机制',
      suggestion: '根据隐私法规添加数据主体权利行使接口'
    });
  }

  const hasThirdPartyDisclosure = /third[\s-]?party|제3자|第三者/gi.test(allText);
  if (!hasThirdPartyDisclosure && regionResult.hasPrivacyPolicy) {
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

  let overallRisk: 'high' | 'medium' | 'low' = 'low';
  if (riskCounts.high > 0) {
    overallRisk = 'high';
  } else if (riskCounts.medium > 0) {
    overallRisk = 'medium';
  }

  let message: string;
  if (risks.length === 0) {
    message = '未检测到明显隐私风险';
  } else {
    message = `检测到 ${risks.length} 项隐私相关问题（高危${riskCounts.high}项，中危${riskCounts.medium}项，低危${riskCounts.low}项）`;
  }

  const confidence = regionResult.hasPrivacyPolicy ? 0.7 : 0.5;

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

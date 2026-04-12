import { ScanResult } from '../types';

export type LicenseRisk = 'high' | 'medium' | 'low' | 'unknown';

export interface LicenseRule {
  id: string;
  name: string;
  risk: LicenseRisk;
  reason: string;
  commercialUse?: string;
  distribution?: string;
  modification?: string;
  privateUse?: string;
}

export interface LicenseAnalysis {
  licenseId: string | null;
  licenseName: string | null;
  risk: LicenseRisk;
  confidence: number;
  message: string;
  details: string[];
}

const LICENSE_CONFIDENCE_WITH_FILE = 0.95;
const LICENSE_CONFIDENCE_INFERENCE = 0.6;
const LICENSE_CONFIDENCE_UNKNOWN = 0.3;

const HIGH_RISK_LICENSES: LicenseRule[] = [
  {
    id: 'GPL-3.0',
    name: 'GNU General Public License v3.0',
    risk: 'high',
    reason: '要求修改后的代码必须开源',
    commercialUse: '允许但需遵守开源条款',
    distribution: '必须开源',
    modification: '修改必须开源',
    privateUse: '允许'
  },
  {
    id: 'AGPL-3.0',
    name: 'GNU Affero General Public License v3.0',
    risk: 'high',
    reason: '网络使用也必须开源',
    commercialUse: '允许但需遵守开源条款',
    distribution: '必须开源',
    modification: '修改必须开源',
    privateUse: '允许'
  },
  {
    id: 'GPL-2.0',
    name: 'GNU General Public License v2.0',
    risk: 'high',
    reason: '要求修改后的代码必须开源',
    commercialUse: '允许但需遵守开源条款',
    distribution: '必须开源',
    modification: '修改必须开源',
    privateUse: '允许'
  },
  {
    id: 'CC-BY-NC-SA',
    name: 'Creative Commons Attribution-NonCommercial-ShareAlike',
    risk: 'high',
    reason: '禁止商业使用',
    commercialUse: '禁止',
    distribution: '允许但需相同方式共享',
    modification: '允许但必须相同方式共享',
    privateUse: '允许'
  },
  {
    id: 'CC-BY-NC',
    name: 'Creative Commons Attribution-NonCommercial',
    risk: 'high',
    reason: '禁止商业使用',
    commercialUse: '禁止',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'EUPL-1.2',
    name: 'European Union Public License',
    risk: 'high',
    reason: '强制开源的许可证变体',
    commercialUse: '允许',
    distribution: '必须开源（某些变体）',
    modification: '修改必须开源（某些变体）',
    privateUse: '允许'
  }
];

const MEDIUM_RISK_LICENSES: LicenseRule[] = [
  {
    id: 'MPL-2.0',
    name: 'Mozilla Public License 2.0',
    risk: 'medium',
    reason: '文件级开源要求，需评估是否影响闭源分发',
    commercialUse: '允许',
    distribution: '文件级开源要求',
    modification: '修改的文件必须开源',
    privateUse: '允许'
  },
  {
    id: 'LGPL-2.1',
    name: 'GNU Lesser General Public License v2.1',
    risk: 'medium',
    reason: '动态链接通常可用，静态链接需谨慎',
    commercialUse: '允许',
    distribution: '动态链接通常允许',
    modification: '修改必须开源',
    privateUse: '允许'
  },
  {
    id: 'LGPL-3.0',
    name: 'GNU Lesser General Public License v3.0',
    risk: 'medium',
    reason: '动态链接通常可用，静态链接需谨慎',
    commercialUse: '允许',
    distribution: '动态链接通常允许',
    modification: '修改必须开源',
    privateUse: '允许'
  },
  {
    id: 'EPL-2.0',
    name: 'Eclipse Public License 2.0',
    risk: 'medium',
    reason: '文件级开源要求，需评估是否影响闭源分发',
    commercialUse: '允许',
    distribution: '文件级开源要求',
    modification: '修改的文件必须开源',
    privateUse: '允许'
  },
  {
    id: 'CDDL-1.0',
    name: 'Common Development and Distribution License',
    risk: 'medium',
    reason: '文件级开源要求，需评估是否影响闭源分发',
    commercialUse: '允许',
    distribution: '文件级开源要求',
    modification: '修改的文件必须开源',
    privateUse: '允许'
  },
  {
    id: 'CPAL-1.0',
    name: 'Common Public Attribution License',
    risk: 'medium',
    reason: '文件级开源要求，需要提供源代码',
    commercialUse: '允许',
    distribution: '需要提供源代码',
    modification: '修改的文件必须开源',
    privateUse: '允许'
  }
];

const LOW_RISK_LICENSES: LicenseRule[] = [
  {
    id: 'MIT',
    name: 'MIT License',
    risk: 'low',
    reason: '宽松开源许可证，允许商业使用和闭源',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    risk: 'low',
    reason: '宽松开源许可证，允许商业使用和闭源，需要保留版权声明',
    commercialUse: '允许',
    distribution: '允许，需保留版权声明',
    modification: '允许，需保留版权声明',
    privateUse: '允许'
  },
  {
    id: 'BSD-3-Clause',
    name: 'BSD 3-Clause Clear License',
    risk: 'low',
    reason: '宽松许可证，允许商业使用和闭源',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'BSD-2-Clause',
    name: 'BSD 2-Clause Simplified License',
    risk: 'low',
    reason: '宽松许可证，允许商业使用和闭源',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'ISC',
    name: 'ISC License',
    risk: 'low',
    reason: '宽松开源许可证，与 MIT 类似',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'CC0-1.0',
    name: 'Creative Commons Zero v1.0 Universal',
    risk: 'low',
    reason: '公共领域贡献，无版权限制',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'Unlicense',
    name: 'The Unlicense',
    risk: 'low',
    reason: '公共领域贡献，无版权限制',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: 'WTFPL',
    name: 'Do What The F*ck You Want To Public License',
    risk: 'low',
    reason: '极度宽松，几乎无限制',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  },
  {
    id: '0BSD',
    name: 'BSD Zero Clause License',
    risk: 'low',
    reason: '公共领域贡献，无版权限制',
    commercialUse: '允许',
    distribution: '允许',
    modification: '允许',
    privateUse: '允许'
  }
];

const ALL_LICENSES: Map<string, LicenseRule> = new Map([
  ...HIGH_RISK_LICENSES.map((l): [string, LicenseRule] => [l.id, l]),
  ...MEDIUM_RISK_LICENSES.map((l): [string, LicenseRule] => [l.id, l]),
  ...LOW_RISK_LICENSES.map((l): [string, LicenseRule] => [l.id, l])
]);

function normalizeLicenseId(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9+\-\.]/g, '');
}

function findLicenseById(licenseId: string): LicenseRule | null {
  const normalized = normalizeLicenseId(licenseId);
  for (const [id, rule] of ALL_LICENSES) {
    if (normalizeLicenseId(id) === normalized) {
      return rule;
    }
  }
  if (normalized.includes('GPL') && !normalized.includes('LGPL') && !normalized.includes('AGPL')) {
    return ALL_LICENSES.get('GPL-3.0') ?? null;
  }
  if (normalized.includes('APACHE') && normalized.includes('2')) {
    return ALL_LICENSES.get('Apache-2.0') ?? null;
  }
  if (normalized.includes('MIT')) {
    return ALL_LICENSES.get('MIT') ?? null;
  }
  if (normalized.includes('BSD') && normalized.includes('3') && normalized.includes('CLAUSE')) {
    return ALL_LICENSES.get('BSD-3-Clause') ?? null;
  }
  if (normalized.includes('BSD') && normalized.includes('2') && normalized.includes('CLAUSE')) {
    return ALL_LICENSES.get('BSD-2-Clause') ?? null;
  }
  if (normalized.includes('CC0') || normalized.includes('CC-0')) {
    return ALL_LICENSES.get('CC0-1.0') ?? null;
  }
  return null;
}

export function detectLicense(projectPath: string, licenseContent: string | null): LicenseAnalysis {
  if (!licenseContent) {
    return {
      licenseId: null,
      licenseName: null,
      risk: 'unknown',
      confidence: LICENSE_CONFIDENCE_UNKNOWN,
      message: '未检测到 LICENSE 文件',
      details: ['建议添加 LICENSE 文件以明确项目许可证']
    };
  }

  const lines = licenseContent.split('\n').map((l) => l.trim()).filter(Boolean);
  let detectedLicense: LicenseRule | null = null;
  let confidence = LICENSE_CONFIDENCE_INFERENCE;

  for (const line of lines.slice(0, 50)) {
    const matched = findLicenseById(line);
    if (matched) {
      detectedLicense = matched;
      confidence = LICENSE_CONFIDENCE_WITH_FILE;
      break;
    }
  }

  if (!detectedLicense) {
    const fullText = licenseContent.toUpperCase();
    const gplMatch = /\bGNU\s*(GENERAL\s*)?PUBLIC\s*LICENSE\b/i.test(licenseContent);
    const lgplMatch = /\bGNU\s*LESSER\s*(GENERAL\s*)?PUBLIC\s*LICENSE\b/i.test(licenseContent) || /\bLGPL\b/i.test(licenseContent);
    const agplMatch = /\bGNU\s*AFFERO\s*GENERAL\s*PUBLIC\s*LICENSE\b/i.test(licenseContent) || /\bAGPL\b/i.test(licenseContent);

    if (agplMatch) {
      detectedLicense = ALL_LICENSES.get('AGPL-3.0') ?? null;
    } else if (lgplMatch) {
      if (/\bLGPL-3\.0\b/i.test(licenseContent)) {
        detectedLicense = ALL_LICENSES.get('LGPL-3.0') ?? null;
      } else if (/\bLGPL-2\.1\b/i.test(licenseContent)) {
        detectedLicense = ALL_LICENSES.get('LGPL-2.1') ?? null;
      } else {
        detectedLicense = ALL_LICENSES.get('LGPL-3.0') ?? null;
      }
    } else if (gplMatch) {
      if (/\bGPL-3\.0\b/i.test(licenseContent)) {
        detectedLicense = ALL_LICENSES.get('GPL-3.0') ?? null;
      } else if (/\bGPL-2\.0\b/i.test(licenseContent)) {
        detectedLicense = ALL_LICENSES.get('GPL-2.0') ?? null;
      } else {
        detectedLicense = ALL_LICENSES.get('GPL-3.0') ?? null;
      }
    } else if (/\bAPACHE\s*(LICENSE\s*)?2\.0\b/i.test(licenseContent)) {
      detectedLicense = ALL_LICENSES.get('Apache-2.0') ?? null;
    } else if (/\bCREATIVE\s*COMMONS\s*(ZERO|CC0)\b/i.test(licenseContent) || /\bCC0\b/i.test(licenseContent)) {
      detectedLicense = ALL_LICENSES.get('CC0-1.0') ?? null;
    } else if (/\bCC-BY-NC-SA\b/i.test(licenseContent) || (/\bCREATIVE\s*COMMONS\b/i.test(licenseContent) && /\bNONCOMMERCIAL\b/i.test(licenseContent) && /\bSHAREALIKE\b/i.test(licenseContent))) {
      detectedLicense = ALL_LICENSES.get('CC-BY-NC-SA') ?? null;
    } else if (/\bCC-BY-NC\b/i.test(licenseContent) || (/\bCREATIVE\s*COMMONS\b/i.test(licenseContent) && /\bNONCOMMERCIAL\b/i.test(licenseContent))) {
      detectedLicense = ALL_LICENSES.get('CC-BY-NC') ?? null;
    }
  }

  if (detectedLicense) {
    const riskLabel: Record<LicenseRisk, string> = {
      high: '危险',
      medium: '中等风险',
      low: '低风险',
      unknown: '未知'
    };

    const details: string[] = [];
    if (detectedLicense.commercialUse) {
      details.push(`商业使用: ${detectedLicense.commercialUse}`);
    }
    if (detectedLicense.distribution) {
      details.push(`分发: ${detectedLicense.distribution}`);
    }
    if (detectedLicense.modification) {
      details.push(`修改: ${detectedLicense.modification}`);
    }

    return {
      licenseId: detectedLicense.id,
      licenseName: detectedLicense.name,
      risk: detectedLicense.risk,
      confidence,
      message: `检测到许可证: ${detectedLicense.name} (${riskLabel[detectedLicense.risk]})`,
      details: [detectedLicense.reason, ...details]
    };
  }

  return {
    licenseId: null,
    licenseName: null,
    risk: 'unknown',
    confidence: LICENSE_CONFIDENCE_UNKNOWN,
    message: '无法识别的许可证类型',
    details: ['建议使用标准开源许可证如 MIT、Apache-2.0']
  };
}

export function toLicenseResult(analysis: LicenseAnalysis): ScanResult {
  const riskMap: Record<LicenseRisk, 'high' | 'medium' | 'low'> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
    unknown: 'low'
  };

  return {
    type: 'license',
    risk: riskMap[analysis.risk],
    confidence: analysis.confidence,
    message: analysis.message,
    suggestion: analysis.details.join('; ')
  };
}

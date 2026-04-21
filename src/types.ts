export type RiskLevel = 'high' | 'medium' | 'low';
export type ScanType = 'font' | 'license' | 'language' | 'image' | 'privacy' | 'trademark';
export type LanguageMarket =
  | 'zh-CN'
  | 'en'
  | 'zh-Hant'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'other';

export type Region = 'east-asia' | 'europe' | 'north-america' | 'africa' | 'south-america' | 'other';

export type LicenseRisk = 'high' | 'medium' | 'low' | 'unknown';

export interface ScanResult {
  type: ScanType;
  risk: RiskLevel;
  file?: string;
  message: string;
  suggestion?: string;
  confidence?: number;
}

export interface ScanConfig {
  projectPath: string;
  ignorePatterns?: string[];
  region?: Region;
}

export interface LanguageDetection {
  market: LanguageMarket;
  marketLabel: string;
  languageCode: string;
  confidence: number;
  ratio: number;
  sampledFiles: number;
  sampledCharacters: number;
  detector: string;
}

export interface LicenseAnalysis {
  licenseId: string | null;
  licenseName: string | null;
  risk: LicenseRisk;
  confidence: number;
  message: string;
  details: string[];
}

export interface PrivacyAnalysis {
  hasPrivacyRisks: boolean;
  confidence: number;
  message: string;
  risks: Array<{
    code: string;
    name: string;
    risk: RiskLevel;
    message: string;
    suggestion?: string;
  }>;
  details: string[];
}

export interface Report {
  timestamp: string;
  projectPath: string;
  scanMode: string;
  settingsSource: 'global' | 'project' | 'default';
  language: {
    market: LanguageMarket;
    marketLabel: string;
    languageCode: string;
    confidence: number;
  };
  license: {
    licenseId: string | null;
    licenseName: string | null;
    risk: LicenseRisk;
    confidence: number;
    message: string;
    details: string[];
  };
  onlineDetection: {
    enabled: boolean;
    success: boolean;
    error?: string;
  };
  results: ScanResult[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDetails: {
    scannedFrontendFiles: number;
    scannedFontFiles: number;
    scannedImageFiles: number;
    scannedLicenseFiles: number;
    sampledLanguageFiles: number;
    frontendFrameworkHints: string[];
    notes: string[];
  };
}

export interface ScanInventory {
  allFiles: string[];
  frontendFrameworkHints: string[];
  fontFiles: string[];
  languageFiles: string[];
  imageFiles: string[];
  licenseFiles: string[];
  mergedTextContent: string;
}

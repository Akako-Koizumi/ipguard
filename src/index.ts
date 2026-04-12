import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { detectFonts } from './detectors/fontDetector';
import { detectLanguage, toLanguageResult } from './detectors/languageDetector';
import { detectLicense, toLicenseResult } from './detectors/licenseDetector';
import { detectPrivacy, toPrivacyResult } from './detectors/privacyDetector';
import { runOnlineDetection } from './detectors/onlineDetector';
import { generateReport, formatReport } from './report';
import { scanProjectFiles } from './scanner';
import { loadSettings, isOnlineMode, shouldIgnore } from './settingsLoader';
import { debug, warn, error as logError } from './logger';
import { Report, ScanConfig, LanguageDetection, LicenseAnalysis, ScanResult } from './types';

const scanConfigSchema = z.object({
  projectPath: z.string().min(1),
  ignorePatterns: z.array(z.string()).optional(),
  customBlacklist: z.array(z.string()).optional(),
  customWhitelist: z.array(z.string()).optional()
});

export type { Report, ScanConfig, ScanResult };
export { formatReport };

async function readLicenseContent(licenseFiles: string[]): Promise<string | null> {
  if (licenseFiles.length === 0) {
    return null;
  }
  const priorityNames = ['license', 'license.txt', 'license.md', 'copying', 'copying.txt'];
  const mainLicense = licenseFiles.find((f) => priorityNames.includes(path.basename(f).toLowerCase()));
  const filePath = mainLicense ?? licenseFiles[0];
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('index', `Failed to read license file: ${filePath}`, { error: msg });
    return null;
  }
}

function createDefaultLanguage(): LanguageDetection {
  return {
    market: 'other',
    marketLabel: '未知',
    languageCode: 'und',
    confidence: 0,
    ratio: 0,
    sampledFiles: 0,
    sampledCharacters: 0,
    detector: 'unknown'
  };
}

function createDefaultLicense(): LicenseAnalysis {
  return {
    licenseId: null,
    licenseName: null,
    risk: 'unknown',
    confidence: 0,
    message: '许可证检测失败',
    details: ['无法完成许可证分析']
  };
}

export async function scan(config: ScanConfig): Promise<Report> {
  debug('index', 'Starting scan', { projectPath: config.projectPath });

  let parsed: z.infer<typeof scanConfigSchema>;
  try {
    parsed = scanConfigSchema.parse(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('index', `Invalid config: ${msg}`);
    throw new Error(`配置无效: ${msg}`);
  }

  let inventory: ReturnType<typeof scanProjectFiles> extends Promise<infer T> ? T : never;
  try {
    inventory = await scanProjectFiles(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('index', `File scan failed: ${msg}`);
    logError('index', `Stage 1 (file scan) failed: ${msg}`);
    inventory = {
      allFiles: [],
      frontendFrameworkHints: [],
      fontFiles: [],
      languageFiles: [],
      imageFiles: [],
      licenseFiles: [],
      mergedTextContent: ''
    };
  }

  let loadedSettings: ReturnType<typeof loadSettings>;
  try {
    loadedSettings = loadSettings(parsed.projectPath);
    debug('index', 'Settings loaded', {
      source: loadedSettings.source,
      scanMode: loadedSettings.settings.scanMode,
      projectName: loadedSettings.projectName
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn('index', `Settings loading failed: ${msg}, using defaults`);
    logError('index', `Stage 2 (settings) failed: ${msg}`);
    loadedSettings = {
      settings: {
        scanMode: 'normal',
        imageDetection: { enabled: false, apiEndpoint: '', apiKey: '', strictMode: false },
        aiDetection: { enabled: false, apiEndpoint: '', apiKey: '', model: 'gpt-4o' },
        trademarkDetection: { enabled: false, apiEndpoint: '', apiKey: '', regions: [] },
        userIgnores: {}
      },
      projectName: path.basename(path.resolve(parsed.projectPath)),
      source: 'default' as const,
      effectiveIgnores: []
    };
  }

  const { settings, projectName, source: settingsSource, effectiveIgnores } = loadedSettings;
  const configDir = path.resolve(__dirname, 'config');
  const filteredFontFiles = inventory.fontFiles.filter((f) => !shouldIgnore(f, effectiveIgnores));
  const filteredImageFiles = inventory.imageFiles.filter((f) => !shouldIgnore(f, effectiveIgnores));

  const [fonts, langResult, licenseContent, iconResults] = await Promise.all([
    detectFonts(filteredFontFiles, configDir, parsed.customBlacklist, parsed.customWhitelist),
    detectLanguage(inventory.languageFiles),
    readLicenseContent(inventory.licenseFiles),
    (async () => {
      try {
        const { detectIcons } = await import('./detectors/iconDetector');
        return await detectIcons(filteredImageFiles);
      } catch (err) {
        warn('index', `Icon detection failed: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    })()
  ]);

  const [license, privacyResult] = await Promise.all([
    (async () => {
      try {
        return detectLicense(parsed.projectPath, licenseContent);
      } catch (err) {
        warn('index', `License detection failed: ${err instanceof Error ? err.message : String(err)}`);
        return createDefaultLicense();
      }
    })(),
    (async () => {
      try {
        return detectPrivacy(parsed.projectPath, inventory.languageFiles, inventory.imageFiles);
      } catch (err) {
        warn('index', `Privacy detection failed: ${err instanceof Error ? err.message : String(err)}`);
        return { hasPrivacyRisks: false, confidence: 0, message: '隐私检测执行失败', risks: [], details: ['隐私检测执行过程中发生错误'] };
      }
    })()
  ]);

  debug('index', 'Stage 3 (local detection) completed', {
    fontResults: fonts.length,
    language: langResult.market,
    hasLicense: licenseContent !== null,
    iconResults: iconResults.length,
    privacyRisks: privacyResult.risks.length
  });

  const localResults: ScanResult[] = [
    ...fonts,
    toLanguageResult(langResult),
    toLicenseResult(license),
    toPrivacyResult(privacyResult),
    ...iconResults
  ];

  let onlineResults: ScanResult[] = [];
  let onlineDetectionEnabled = false;
  let onlineDetectionSuccess = false;
  let onlineDetectionError: string | undefined;

  const language = langResult;

  if (isOnlineMode(settings)) {
    onlineDetectionEnabled = true;
    debug('index', 'Online detection enabled, starting');
    try {
      const onlineResult = await runOnlineDetection(inventory.mergedTextContent, filteredImageFiles, settings);
      onlineDetectionSuccess = onlineResult.success;
      onlineDetectionError = onlineResult.error;
      onlineResults = [
        ...onlineResult.textResults,
        ...onlineResult.imageResults,
        ...onlineResult.trademarkResults
      ];
      debug('index', 'Online detection completed', {
        success: onlineDetectionSuccess,
        textResults: onlineResults.length
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warn('index', `Online detection failed: ${msg}`);
      logError('index', `Stage 3 (online detection) failed: ${msg}`);
      onlineDetectionSuccess = false;
      onlineDetectionError = msg;
    }
  }

  const results = [...localResults, ...onlineResults];

  let report: Report;
  try {
    report = generateReport(
      results,
      parsed,
      language,
      license,
      inventory,
      settings,
      settingsSource,
      onlineDetectionEnabled,
      onlineDetectionSuccess,
      onlineDetectionError
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('index', `Stage 4 (report generation) failed: ${msg}`);
    logError('index', 'Creating fallback report');
    report = {
      timestamp: new Date().toISOString(),
      projectPath: path.resolve(parsed.projectPath),
      scanMode: settings.scanMode,
      settingsSource,
      language: {
        market: language.market,
        marketLabel: language.marketLabel,
        languageCode: language.languageCode,
        confidence: language.confidence
      },
      license: {
        licenseId: license.licenseId,
        licenseName: license.licenseName,
        risk: license.risk,
        confidence: license.confidence,
        message: license.message,
        details: license.details
      },
      onlineDetection: {
        enabled: onlineDetectionEnabled,
        success: onlineDetectionSuccess,
        error: onlineDetectionError
      },
      results,
      summary: {
        total: results.length,
        high: results.filter((r) => r.risk === 'high').length,
        medium: results.filter((r) => r.risk === 'medium').length,
        low: results.filter((r) => r.risk === 'low').length
      },
      scanDetails: {
        scannedFrontendFiles: inventory.allFiles.length,
        scannedFontFiles: inventory.fontFiles.length,
        scannedImageFiles: inventory.imageFiles.length,
        scannedLicenseFiles: inventory.licenseFiles.length,
        sampledLanguageFiles: 0,
        frontendFrameworkHints: inventory.frontendFrameworkHints,
        notes: [`报告生成部分失败: ${msg}`, '检测结果可能不完整']
      }
    };
  }

  debug('index', 'Scan completed', {
    projectPath: report.projectPath,
    totalResults: report.summary.total,
    high: report.summary.high
  });

  return report;
}

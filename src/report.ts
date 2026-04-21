import path from 'node:path';
import { Report, ScanConfig, ScanInventory, ScanResult } from './types';
import { LicenseAnalysis } from './types';
import { Settings } from './settingsLoader';
import { Region } from './cli';

export interface CLIOutput {
  success: boolean;
  status: 'completed' | 'failed' | 'partial';
  data: {
    summary: { high: number; medium: number; low: number; total: number };
    results: Array<{
      type: string;
      severity: string;
      file?: string;
      issue: string;
      recommendation?: string;
      confidence?: number;
    }>;
    language?: {
      market: string;
      marketLabel: string;
      confidence: number;
    };
    license?: {
      name: string | null;
      risk: string;
      message: string;
    };
  };
  errors: string[];
  executionTime: number;
  version: string;
  environment: {
    nodeVersion: string;
    platform: string;
    region: Region;
  };
  aiMessage: string;
  htmlReportFile?: string;
}

function escapeHtml(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, (char) => escapeMap[char]);
}

function summarize(results: ScanResult[]): Report['summary'] {
  return {
    total: results.length,
    high: results.filter((result) => result.risk === 'high').length,
    medium: results.filter((result) => result.risk === 'medium').length,
    low: results.filter((result) => result.risk === 'low').length
  };
}

export function generateReport(
  results: ScanResult[],
  config: ScanConfig,
  region: Region,
  license: LicenseAnalysis,
  inventory: ScanInventory,
  settings: Settings,
  settingsSource: 'global' | 'project' | 'default',
  onlineDetectionEnabled: boolean,
  onlineDetectionSuccess: boolean,
  onlineDetectionError?: string
): Report {
  const summary = summarize(results);
  const notes: string[] = [
    '仅扫描前端相关文件（Vue/React/原生前端常见扩展名）'
  ];

  if (onlineDetectionEnabled) {
    if (onlineDetectionSuccess) {
      notes.push('已启用联网检测（图片/AI/商标）');
    } else {
      notes.push(`联网检测失败: ${onlineDetectionError ?? '未知错误'}`);
    }
  } else {
    notes.push('未启用联网检测（图片/AI/商标检测需在设置中开启）');
  }

  notes.push('检测结果仅供工程风险排查参考，不构成法律建议');

  const regionLabels: Record<Region, string> = {
    'east-asia': '东亚地区',
    'europe': '欧洲地区',
    'north-america': '北美地区',
    'africa': '非洲地区',
    'south-america': '南美地区',
    'other': '其他地区'
  };

  return {
    timestamp: new Date().toISOString(),
    projectPath: path.resolve(config.projectPath),
    scanMode: settings.scanMode,
    settingsSource,
    language: {
      market: 'other',
      marketLabel: regionLabels[region] || region,
      languageCode: 'und',
      confidence: 1
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
    summary,
    scanDetails: {
      scannedFrontendFiles: inventory.allFiles.length,
      scannedFontFiles: inventory.fontFiles.length,
      scannedImageFiles: inventory.imageFiles.length,
      scannedLicenseFiles: inventory.licenseFiles.length,
      sampledLanguageFiles: 0,
      frontendFrameworkHints: inventory.frontendFrameworkHints,
      notes
    }
  };
}

function toCLIOutput(report: Report, executionTime: number, region: Region): CLIOutput {
  const highResults = report.results.filter((r) => r.risk === 'high');
  const mediumResults = report.results.filter((r) => r.risk === 'medium');
  const lowResults = report.results.filter((r) => r.risk === 'low');

  let aiMessage = '';

  if (report.summary.total === 0) {
    aiMessage = `✅ IP风险扫描完成，未检测到风险项。项目"${path.basename(report.projectPath)}"在${getRegionLabel(region)}市场无明显知识产权风险。建议开发者继续关注代码开源合规和第三方资源引用规范。`;
  } else {
    aiMessage = `⚠️ IP风险扫描完成，检测到${report.summary.total}项风险（高危${report.summary.high}项，中危${report.summary.medium}项，低危${report.summary.low}项）。请开发者审阅以下问题并按建议修复：\n\n`;

    const riskOrder: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    for (const risk of riskOrder) {
      const riskResults = report.results.filter((r) => r.risk === risk);
      for (let i = 0; i < riskResults.length; i++) {
        const result = riskResults[i];
        const riskEmoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
        aiMessage += `${riskEmoji} [${result.type.toUpperCase()}] ${result.message}`;
        if (result.file) {
          aiMessage += `\n   📄 ${result.file}`;
        }
        if (result.suggestion) {
          aiMessage += `\n   💡 建议: ${result.suggestion}`;
        }
        aiMessage += '\n\n';
      }
    }

    aiMessage += `请开发者根据上述问题逐一修复后重新扫描。如有疑问，请咨询法务团队。`;
  }

  return {
    success: true,
    status: report.summary.high > 0 ? 'partial' : 'completed',
    data: {
      summary: {
        high: report.summary.high,
        medium: report.summary.medium,
        low: report.summary.low,
        total: report.summary.total
      },
      results: report.results.map((r) => ({
        type: r.type,
        severity: r.risk,
        file: r.file,
        issue: r.message,
        recommendation: r.suggestion,
        confidence: r.confidence
      })),
      language: {
        market: report.language.market,
        marketLabel: report.language.marketLabel,
        confidence: report.language.confidence
      },
      license: {
        name: report.license.licenseName,
        risk: report.license.risk,
        message: report.license.message
      }
    },
    errors: report.onlineDetection.enabled && !report.onlineDetection.success ? [report.onlineDetection.error ?? 'Unknown error'] : [],
    executionTime,
    version: '2.0.0',
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      region
    },
    aiMessage
  };
}

function getRegionLabel(region: Region): string {
  const labels: Record<Region, string> = {
    'east-asia': '东亚地区',
    'europe': '欧洲地区',
    'north-america': '北美地区',
    'africa': '非洲地区',
    'south-america': '南美地区',
    'other': '其他地区'
  };
  return labels[region] || region;
}

export function formatReport(
  report: Report,
  format: 'ai-json' | 'html',
  executionTime: number,
  region: Region
): CLIOutput | string {
  if (format === 'ai-json') {
    return toCLIOutput(report, executionTime, region);
  }

  if (format === 'html') {
    const riskBadgeClass: Record<string, string> = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };

    const riskIcon: Record<string, string> = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const rows = report.results
      .map(
        (result) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${riskBadgeClass[result.risk] || 'bg-gray-100 text-gray-800'}">
              ${riskIcon[result.risk] || '⚪'} ${result.risk.toUpperCase()}
            </span>
          </td>
          <td class="px-4 py-3 text-sm font-medium text-gray-900 capitalize">${result.type}</td>
          <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${result.file ?? ''}">${result.file ? result.file.split(/[/\\]/).pop() : '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-700">${escapeHtml(result.message)}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(result.suggestion ?? '-')}</td>
        </tr>`
      )
      .join('');

    const totalFiles = report.scanDetails.scannedFrontendFiles;
    const highPercent = totalFiles > 0 ? Math.round((report.summary.high / Math.max(report.summary.total, 1)) * 100) : 0;
    const mediumPercent = totalFiles > 0 ? Math.round((report.summary.medium / Math.max(report.summary.total, 1)) * 100) : 0;
    const lowPercent = totalFiles > 0 ? 100 - highPercent - mediumPercent : 0;

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IP Guard - 扫描报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <header class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-lg">IP</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">IP Guard 扫描报告</h1>
      </div>
      <p class="text-gray-500 text-sm">${new Date(report.timestamp).toLocaleString('zh-CN')} | 目标市场: ${getRegionLabel(region)}</p>
    </header>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">项目信息</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">项目路径</p>
          <p class="text-sm font-medium text-gray-900 truncate" title="${escapeHtml(report.projectPath)}">${escapeHtml(report.projectPath.split(/[/\\]/).pop() || report.projectPath)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">扫描模式</p>
          <p class="text-sm font-medium text-gray-900">${report.scanMode} <span class="text-gray-400">(${report.settingsSource})</span></p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">目标市场</p>
          <p class="text-sm font-medium text-gray-900">${escapeHtml(report.language.marketLabel)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">项目许可证</p>
          <p class="text-sm font-medium ${report.license.licenseId ? (report.license.risk === 'high' ? 'text-red-600' : report.license.risk === 'medium' ? 'text-amber-600' : 'text-green-600') : 'text-gray-400'}">${escapeHtml(report.license.licenseName || '未检测到')}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-500 text-sm">总风险项</span>
          <span class="text-2xl font-bold text-gray-900">${report.summary.total}</span>
        </div>
        <p class="text-xs text-gray-400">扫描了 ${report.scanDetails.scannedFrontendFiles} 个文件</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border-red-200 p-6 ${report.summary.high > 0 ? 'ring-2 ring-red-100' : ''}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-500 text-sm">高风险</span>
          <span class="text-2xl font-bold text-red-600">${report.summary.high}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-1.5">
          <div class="bg-red-500 h-1.5 rounded-full" style="width: ${highPercent}%"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border-amber-200 p-6 ${report.summary.medium > 0 ? 'ring-2 ring-amber-100' : ''}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-500 text-sm">中风险</span>
          <span class="text-2xl font-bold text-amber-600">${report.summary.medium}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-1.5">
          <div class="bg-amber-500 h-1.5 rounded-full" style="width: ${mediumPercent}%"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border-green-200 p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-500 text-sm">低风险</span>
          <span class="text-2xl font-bold text-green-600">${report.summary.low}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-1.5">
          <div class="bg-green-500 h-1.5 rounded-full" style="width: ${lowPercent}%"></div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">扫描详情</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">${report.scanDetails.scannedFrontendFiles}</p>
          <p class="text-xs text-gray-500">前端文件</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">${report.scanDetails.scannedFontFiles}</p>
          <p class="text-xs text-gray-500">字体文件</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">${report.scanDetails.scannedImageFiles}</p>
          <p class="text-xs text-gray-500">图片文件</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">${report.scanDetails.scannedLicenseFiles}</p>
          <p class="text-xs text-gray-500">许可证文件</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-2xl font-bold text-gray-900">${report.scanDetails.sampledLanguageFiles}</p>
          <p class="text-xs text-gray-500">语言采样</p>
        </div>
      </div>
      ${report.scanDetails.frontendFrameworkHints.length > 0 ? `
      <div class="mt-4 flex flex-wrap gap-2">
        <span class="text-sm text-gray-500">识别框架：</span>
        ${report.scanDetails.frontendFrameworkHints.map(hint => `<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">${escapeHtml(hint)}</span>`).join('')}
      </div>` : ''}
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">检测结果</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">风险</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">文件</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">说明</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">建议</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows || '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">未检测到风险项 ✓</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div class="flex gap-2">
        <span class="text-amber-500 text-lg">⚠️</span>
        <div>
          <h4 class="font-medium text-amber-800 mb-1">免责声明</h4>
          <ul class="text-sm text-amber-700 space-y-1">
            ${report.scanDetails.notes.map(note => `<li>• ${escapeHtml(note)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>

    <footer class="text-center text-gray-400 text-sm">
      <p>由 IP Guard 生成 · 仅供工程风险排查参考</p>
    </footer>
  </div>
</body>
</html>`;
  }

  throw new Error(`Unsupported format: ${format}`);
}

export { toCLIOutput };

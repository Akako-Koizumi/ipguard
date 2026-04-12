import { ScanResult } from '../types';
import { Settings } from '../settingsLoader';

export interface OnlineDetectionConfig {
  apiEndpoint: string;
  apiKey: string;
  model?: string;
  regions?: string[];
}

export interface OnlineDetectionResult {
  success: boolean;
  textResults: ScanResult[];
  imageResults: ScanResult[];
  trademarkResults: ScanResult[];
  error?: string;
}

export interface TextDetectionResult {
  text: string;
  language: string;
  risk: 'high' | 'medium' | 'low';
  suggestion?: string;
}

export interface ImageDetectionResult {
  file: string;
  risk: 'high' | 'medium' | 'low';
  reason?: string;
  suggestion?: string;
}

export interface TrademarkDetectionResult {
  text: string;
  region: string;
  risk: 'high' | 'medium' | 'low';
  reason?: string;
  suggestion?: string;
}

export async function detectTextWithAI(
  text: string,
  language: string,
  config: OnlineDetectionConfig
): Promise<TextDetectionResult[]> {
  if (!config.apiEndpoint || !config.apiKey) {
    return [];
  }
  return [];
}

export async function detectImageRisks(
  imageFiles: string[],
  config: OnlineDetectionConfig
): Promise<ImageDetectionResult[]> {
  if (!config.apiEndpoint || !config.apiKey || imageFiles.length === 0) {
    return [];
  }
  return [];
}

export async function detectTrademarkRisks(
  text: string,
  regions: string[],
  config: OnlineDetectionConfig
): Promise<TrademarkDetectionResult[]> {
  if (!config.apiEndpoint || !config.apiKey || !text) {
    return [];
  }
  return [];
}

export async function runOnlineDetection(
  text: string,
  imageFiles: string[],
  settings: Settings
): Promise<OnlineDetectionResult> {
  const results: OnlineDetectionResult = {
    success: false,
    textResults: [],
    imageResults: [],
    trademarkResults: []
  };

  if (!settings.aiDetection.enabled && !settings.imageDetection.enabled && !settings.trademarkDetection.enabled) {
    results.success = true;
    return results;
  }

  const aiConfig: OnlineDetectionConfig = {
    apiEndpoint: settings.aiDetection.apiEndpoint,
    apiKey: settings.aiDetection.apiKey,
    model: settings.aiDetection.model
  };

  const imageConfig: OnlineDetectionConfig = {
    apiEndpoint: settings.imageDetection.apiEndpoint,
    apiKey: settings.imageDetection.apiKey
  };

  const trademarkConfig: OnlineDetectionConfig = {
    apiEndpoint: settings.trademarkDetection.apiEndpoint,
    apiKey: settings.trademarkDetection.apiKey,
    regions: settings.trademarkDetection.regions
  };

  try {
    if (settings.aiDetection.enabled && text) {
      const textResults = await detectTextWithAI(text, '', aiConfig);
      results.textResults = textResults.map((r) => ({
        type: 'language' as const,
        risk: r.risk,
        message: `AI文字检测: ${r.text}`,
        suggestion: r.suggestion,
        confidence: 0.9
      }));
    }

    if (settings.imageDetection.enabled && imageFiles.length > 0) {
      const imageResults = await detectImageRisks(imageFiles, imageConfig);
      results.imageResults = imageResults.map((r) => ({
        type: 'image' as const,
        risk: r.risk,
        file: r.file,
        message: `图片侵权检测: ${r.reason ?? '风险'}`,
        suggestion: r.suggestion,
        confidence: 0.85
      }));
    }

    if (settings.trademarkDetection.enabled && text) {
      const trademarkResults = await detectTrademarkRisks(
        text,
        settings.trademarkDetection.regions,
        trademarkConfig
      );
      results.trademarkResults = trademarkResults.map((r) => ({
        type: 'trademark' as const,
        risk: r.risk,
        message: `商标检测(${r.region}): ${r.text}`,
        suggestion: r.suggestion,
        confidence: 0.85
      }));
    }

    results.success = true;
  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error);
  }

  return results;
}

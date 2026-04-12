import { ScanResult } from '../types';

export async function detectIcons(
  imageFiles: string[],
  _config?: unknown
): Promise<ScanResult[]> {
  if (imageFiles.length === 0) {
    return [];
  }

  return imageFiles.map((file) => ({
    type: 'image',
    risk: 'low',
    file,
    confidence: 0.35,
    message: '检测到图片文件，当前为预留接口，需人工审查图片授权来源',
    suggestion: '建议确认图片来源或替换为明确开源协议图片'
  }));
}

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { formatReport, scan } from './index';

const program = new Command();

program.name('ipguard').description('IP Guard 核心扫描工具').version('0.1.0');

program
  .command('scan')
  .argument('[projectPath]', '要扫描的项目路径', '.')
  .option('--format <format>', '输出格式: text|json|html', 'text')
  .option('--blacklist <path>', '自定义字体黑名单 JSON 文件')
  .option('--whitelist <path>', '自定义字体白名单 JSON 文件')
  .option('--ignore <patterns...>', '额外忽略模式')
  .action(async (projectPath: string, options) => {
    try {
      const customBlacklist = options.blacklist ? await loadListFromFile(options.blacklist, 'blacklist') : undefined;
      const customWhitelist = options.whitelist ? await loadListFromFile(options.whitelist, 'whitelist') : undefined;

      const report = await scan({
        projectPath: path.resolve(projectPath),
        ignorePatterns: options.ignore,
        customBlacklist,
        customWhitelist
      });

      const format = normalizeFormat(options.format);
      const output = formatReport(report, format);
      console.log(output);

      if (report.summary.high > 0) {
        process.exitCode = 2;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`[ipguard] 扫描失败: ${message}`));
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`[ipguard] 执行失败: ${message}`));
  process.exitCode = 1;
});

function normalizeFormat(format: string): 'text' | 'json' | 'html' {
  if (format === 'json' || format === 'html' || format === 'text') {
    return format;
  }
  throw new Error(`不支持的格式: ${format}`);
}

async function loadListFromFile(filePath: string, key: 'blacklist' | 'whitelist'): Promise<string[]> {
  const raw = await fs.readFile(path.resolve(filePath), 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === 'string');
  }

  if (parsed && typeof parsed === 'object' && key in parsed) {
    const value = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }

  throw new Error(`配置文件格式错误: ${filePath}`);
}

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { scan } from './index';
import { formatReport, CLIOutput } from './report';

export type Region = 'east-asia' | 'europe' | 'north-america' | 'africa' | 'south-america' | 'other';

const VALID_REGIONS: Region[] = ['east-asia', 'europe', 'north-america', 'africa', 'south-america', 'other'];

const program = new Command();

program
  .name('ipguard')
  .description('IP Guard - AI Service Intellectual Property Risk Scanner')
  .version('2.0.0');

program
  .command('scan')
  .argument('[projectPath]', 'Project path to scan', '.')
  .option('--region <region>', 'Target region for privacy compliance: east-asia|europe|north-america|africa|south-america|other', 'europe')
  .option('--html', 'Generate HTML report file alongside JSON output', false)
  .option('--ignore <patterns...>', 'Additional ignore patterns (glob)')
  .action(async (projectPath: string, options) => {
    const startTime = Date.now();

    const region = normalizeRegion(options.region);
    if (!region) {
      outputError({
        success: false,
        status: 'failed',
        data: null,
        errors: [`Invalid region: ${options.region}. Valid options: ${VALID_REGIONS.join('|')}`],
        executionTime: Date.now() - startTime,
        version: '2.0.0',
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          region: options.region
        }
      });
      process.exitCode = 1;
      return;
    }

    try {
      const report = await scan({
        projectPath: path.resolve(projectPath),
        ignorePatterns: options.ignore,
        region
      });

      const exitTime = Date.now() - startTime;
      const cliOutput = formatReport(report, 'ai-json', exitTime, region);

      console.log(JSON.stringify(cliOutput, null, 2));

      if (options.html) {
        const htmlOutput = formatReport(report, 'html', exitTime, region);
        const htmlFileName = `可视化报告.html`;
        await fs.writeFile(path.join(process.cwd(), htmlFileName), htmlOutput as string, 'utf8');
        (cliOutput as CLIOutput).htmlReportFile = htmlFileName;
        console.log(JSON.stringify(cliOutput, null, 2));
      }

      if (report.summary.high > 0) {
        process.exitCode = 2;
      } else if (report.summary.medium > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputError({
        success: false,
        status: 'failed',
        data: null,
        errors: [message],
        executionTime: Date.now() - startTime,
        version: '2.0.0',
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          region
        }
      });
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  outputError({
    success: false,
    status: 'failed',
    data: null,
    errors: [`CLI execution failed: ${message}`],
    executionTime: Date.now(),
    version: '2.0.0',
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      region: 'unknown'
    }
  });
  process.exitCode = 1;
});

function normalizeRegion(region: string): Region | null {
  const normalized = region.toLowerCase().replace(/\s+/g, '-') as Region;
  return VALID_REGIONS.includes(normalized) ? normalized : null;
}

function outputError(output: ReturnType<typeof createErrorOutput>): void {
  console.error(JSON.stringify(output, null, 2));
}

function createErrorOutput(params: {
  success: boolean;
  status: string;
  data: null;
  errors: string[];
  executionTime: number;
  version: string;
  environment: { nodeVersion: string; platform: string; region: string };
}) {
  return params;
}

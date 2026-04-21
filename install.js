#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = __dirname;
const SKILL_SOURCE = path.join(ROOT_DIR, 'packages', 'skills', 'ip-guard', 'SKILL.md');
const SKILLS_TARGET_BASE = path.join(process.env.HOME || process.env.USERPROFILE, '.agents', 'skills');

function getGlobalNpmPrefix() {
  try {
    return execSync('npm root -g', { encoding: 'utf8' }).trim();
  } catch {
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'npm');
    }
    return '/usr/local/lib/node_modules';
  }
}

function installSkills() {
  const targetDir = path.join(SKILLS_TARGET_BASE, 'ip-guard');
  console.log('\n📦 安装 IP Guard Skills...\n');
  console.log(`   源: ${SKILL_SOURCE}`);
  console.log(`   目标: ${targetDir}`);

  if (!fs.existsSync(SKILL_SOURCE)) {
    console.error('\n❌ 安装失败: SKILL.md 源文件不存在');
    console.error(`   请确认文件路径: ${SKILL_SOURCE}`);
    return false;
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(SKILL_SOURCE, path.join(targetDir, 'SKILL.md'));
    console.log('✅ Skills 安装成功！');
    return true;
  } catch (error) {
    console.error('\n❌ Skills 安装失败:', error.message);
    return false;
  }
}

function installCli() {
  console.log('\n🔧 安装 IP Guard CLI...\n');

  const distCli = path.join(ROOT_DIR, 'dist', 'cli.js');

  if (!fs.existsSync(distCli)) {
    console.log('   首次安装，正在构建...');
    try {
      console.log('   执行: npm run build');
      execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (error) {
      console.error('\n❌ 构建失败，请手动执行 npm run build');
      return false;
    }
  }

  const globalPrefix = getGlobalNpmPrefix();

  try {
    if (process.platform === 'win32') {
      const npmCmd = path.join(globalPrefix, 'ipguard.cmd');
      const cliContent = `@echo off\nnode "${distCli}" %*`;
      fs.writeFileSync(npmCmd, cliContent, 'utf8');
      console.log(`   Windows 批处理文件: ${npmCmd}`);
    } else {
      const binDir = path.join(globalPrefix, '..', 'bin');
      const linkTarget = path.join(binDir, 'ipguard');
      fs.mkdirSync(binDir, { recursive: true });
      const cliContent = `#!/bin/sh\nnode "${distCli}" "$@"`;
      fs.writeFileSync(linkTarget, cliContent, 'utf8');
      fs.chmodSync(linkTarget, '755');
      console.log(`   Unix 符号链接: ${linkTarget}`);
    }
    console.log('✅ CLI 安装成功！');
    return true;
  } catch (error) {
    console.error('\n❌ CLI 安装失败:', error.message);
    console.error('\n💡 请尝试手动全局链接：');
    console.error('   npm link');
    console.error('   或');
    console.error('   pnpm add -g .');
    return false;
  }
}

function verifyInstall() {
  console.log('\n🔍 验证安装...\n');

  const skillPath = path.join(SKILLS_TARGET_BASE, 'ip-guard', 'SKILL.md');
  const skillOk = fs.existsSync(skillPath);
  console.log(`   Skills: ${skillOk ? '✅' : '❌'} ${skillPath}`);

  const distCli = path.join(ROOT_DIR, 'dist', 'cli.js');
  const cliOk = fs.existsSync(distCli);
  console.log(`   CLI: ${cliOk ? '✅' : '❌'} ${distCli}`);

  return skillOk && cliOk;
}

function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   IP Guard 安装程序 v2.0.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const skillOk = installSkills();
  const cliOk = installCli();

  if (!skillOk || !cliOk) {
    console.error('\n❌ 安装过程中有错误，请查看上方信息\n');
    process.exit(1);
  }

  if (verifyInstall()) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✅ IP Guard 安装成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📖 使用方法：\n');
    console.log('   ipguard scan . --region europe');
    console.log('\n   在 AI 编程助手中说：');
    console.log('   "帮我检测项目 IP 风险，目标市场是欧洲"\n');
    console.log('🌐 了解更多: https://github.com/ipguard/ipguard\n');
  } else {
    console.error('\n❌ 验证失败，请重新安装\n');
    process.exit(1);
  }
}

main();

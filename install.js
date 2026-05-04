#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = __dirname;
const USER_HOME = process.env.HOME || process.env.USERPROFILE;

const SKILL_SOURCE = path.join(ROOT_DIR, 'packages', 'skills', 'ip-guard', 'SKILL.md');
const SKILLS_TARGET = path.join(USER_HOME, '.agents', 'skills', 'ip-guard');
const CLI_TARGET_BASE = path.join(USER_HOME, '.ipguard');
const CLI_TARGET_BIN = path.join(CLI_TARGET_BASE, 'bin');

function installSkills() {
  console.log('\n📦 安装 IP Guard Skills...\n');
  console.log(`   源: ${SKILL_SOURCE}`);
  console.log(`   目标: ${SKILLS_TARGET}`);

  if (!fs.existsSync(SKILL_SOURCE)) {
    console.error('\n❌ 安装失败: SKILL.md 源文件不存在');
    return false;
  }

  try {
    fs.mkdirSync(SKILLS_TARGET, { recursive: true });
    fs.copyFileSync(SKILL_SOURCE, path.join(SKILLS_TARGET, 'SKILL.md'));
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
      execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch {
      console.error('\n❌ 构建失败，请手动执行 npm run build');
      return false;
    }
  }

  console.log(`   目标: ${CLI_TARGET_BIN}`);

  try {
    fs.mkdirSync(CLI_TARGET_BIN, { recursive: true });

    if (process.platform === 'win32') {
      const cliCmd = path.join(CLI_TARGET_BIN, 'ipguard.cmd');
      const cliContent = `@echo off\nnode "${distCli}" %*`;
      fs.writeFileSync(cliCmd, cliContent, 'utf8');
      console.log(`   批处理文件: ${cliCmd}`);
    } else {
      const cliShell = path.join(CLI_TARGET_BIN, 'ipguard');
      const cliContent = `#!/bin/sh\nnode "${distCli}" "$@"`;
      fs.writeFileSync(cliShell, cliContent, 'utf8');
      fs.chmodSync(cliShell, '755');
      console.log(`   Shell 脚本: ${cliShell}`);
    }
    console.log('✅ CLI 安装成功！');
    return true;
  } catch (error) {
    console.error('\n❌ CLI 安装失败:', error.message);
    return false;
  }
}

function updatePathHint() {
  console.log('\n📝 请将以下路径添加到 PATH 环境变量：\n');
  console.log(`   ${CLI_TARGET_BIN}\n`);
  console.log('   Windows 永久添加（PowerShell 管理员）：');
  console.log(`   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";${CLI_TARGET_BIN}", "User")`);
  console.log('\n   或临时测试（当前终端有效）：');
  console.log(`   $env:Path += ";${CLI_TARGET_BIN}"\n`);
}

function verifyInstall() {
  console.log('\n🔍 验证安装...\n');

  const skillOk = fs.existsSync(path.join(SKILLS_TARGET, 'SKILL.md'));
  console.log(`   Skills: ${skillOk ? '✅' : '❌'} ${SKILLS_TARGET}`);

  const cliOk = process.platform === 'win32'
    ? fs.existsSync(path.join(CLI_TARGET_BIN, 'ipguard.cmd'))
    : fs.existsSync(path.join(CLI_TARGET_BIN, 'ipguard'));
  console.log(`   CLI: ${cliOk ? '✅' : '❌'} ${CLI_TARGET_BIN}`);

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
    updatePathHint();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

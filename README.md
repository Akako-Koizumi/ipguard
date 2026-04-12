# IP Guard - 智能知识产权检测工具

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**IP Guard** 是一款面向**出海开发者**的**智能知识产权检测工具**，在开发阶段自动发现字体版权、许可证合规、隐私政策等风险，保护你的项目远离侵权纠纷。

***

## 🎯 解决什么问题？

- ⚠️ 这个字体能免费商用吗？
- ⚠️ 这个开源协议允许闭源使用吗？
- ⚠️ 项目面向海外市场，隐私政策合规吗？
- ⚠️ 有没有遗漏的版权风险？

**IP Guard 就是为解决这些问题而生的，让你在开发时就把控知识产权风险。**

***

## ✨ 核心特性

### 🔍 五大检测模块

| 检测项       | 说明                          | 状态             |
| --------- | --------------------------- | -------------- |
| **字体检测**  | 检测商业字体，提供开源替代推荐             | ✅ 本地检测 已实现     |
| **许可证检测** | 识别 GPL/MIT/Apache 等 15+ 种协议 | ✅ 本地检测 已实现     |
| **隐私检测**  | 支持 GDPR/CCPA/APPI/PIPA 合规检查 | ✅ 本地检测 已实现     |
| **图片检测**  | SVG/PNG 等图片侵权检测             | 🔶 联网检测（需配置）   |
| **AI 增强** | 联网调用 AI 进行深度检测              | 🔶 联网检测（需配置）   |

### 🌏 多语言市场支持

- 中国大陆（简体中文）
- 港澳台（繁体中文）
- 英语市场（欧美）
- 日语市场（日本）
- 韩语市场（韩国）

### 🛡️ 隐私法规支持

| 法规       | 适用地区        |
| -------- | ----------- |
| **GDPR** | 欧盟、中国大陆、港澳台 |
| **CCPA** | 美国加州        |
| **APPI** | 日本          |
| **PIPA** | 韩国          |

### ⚡ 简单易用

**模式一：AI IDE 集成（Skills）**

在 Claude Code、Cursor、WindSurf 等 AI 辅助开发工具中，通过 Skills 集成 IP Guard。当项目收尾时，自动运行合规检测，即时返回检测结果。

```
用户：/scan
IP Guard：正在扫描项目...
       检测到 2 个高风险项
       - GPL-3.0 许可证（要求开源）
       - 微软雅黑字体（商业授权）
```

**模式二：IDE 插件**

在 JetBrains（WebStorm、IntelliJ IDEA）和 VSCode 中安装 IP Guard 插件。每次打开项目或修改前端文件时，自动检测新增内容的合规性。

- 实时监测新文件
- 风险高亮提示
- 一键生成报告

### 🔥 高性能设计

- **并发扫描**：文件分类、文字提取并行处理
- **智能熔断**：各检测模块独立，异常不影响整体
- **离线优先**：本地规则检测，API 接口按需启用

***

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 构建项目

```bash
pnpm run build
```

### 扫描项目

```bash
# 进入项目目录
cd ipguard-main

# 基本用法
node dist/cli.js scan ./test/sample-project

# 输出 JSON 格式（便于程序处理）
node dist/cli.js scan ./test/sample-project --format json

# 输出 HTML 可视化报告
node dist/cli.js scan ./test/sample-project --format html > report.html
```

生成 `report.html` 后，用浏览器打开即可查看美观的可视化报告。

### 作为库使用

```typescript
import { scan, formatReport } from '@ipguard/core';

const report = await scan({ projectPath: './your-project' });
console.log(formatReport(report, 'text'));
```

***

## ⚙️ 用户设置

### 配置文件位置

| 类型  | 路径                         | 作用域   |
| --- | -------------------------- | ----- |
| 全局  | `~/.ipguard/settings.json` | 所有项目  |
| 项目级 | `./.ipguard.json`          | 仅当前项目 |

### 设置项示例

```json
{
  "scanMode": "normal",
  "imageDetection": {
    "enabled": true,
    "apiEndpoint": "https://api.example.com/vision",
    "apiKey": "your-api-key"
  },
  "aiDetection": {
    "enabled": true,
    "apiEndpoint": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4o"
  },
  "userIgnores": {
    "my-project": [
      { "type": "font", "pattern": "**/msyh.ttc", "reason": "已购买授权" }
    ]
  }
}
```

### 扫描模式

| 模式       | 说明       |
| -------- | -------- |
| `strict` | 严格模式     |
| `normal` | 正常模式（默认） |
| `loose`  | 宽松模式     |
| `ignore` | 忽略模式     |

***

## 🏗️ 技术栈

| 类别       | 技术                                |
| -------- | --------------------------------- |
| **语言**   | TypeScript                        |
| **运行时**  | Node.js                           |
| **包管理**  | pnpm                              |
| **类型检查** | Zod                               |
| **语言识别** | franc + traditional-or-simplified |
| **字体解析** | opentype.js                       |
| **文件扫描** | fast-glob                         |
| **命令行**  | commander + chalk                 |

***

## 📁 项目结构

```
ipguard-main/
├── src/
│   ├── index.ts              # 主入口
│   ├── scanner.ts             # 文件扫描器
│   ├── report.ts              # 报告生成器
│   ├── settingsLoader.ts      # 设置加载器
│   ├── logger.ts              # 日志工具
│   ├── detectors/
│   │   ├── fontDetector.ts    # 字体检测
│   │   ├── licenseDetector.ts  # 许可证检测
│   │   ├── languageDetector.ts # 语言检测
│   │   ├── privacyDetector.ts  # 隐私检测
│   │   ├── iconDetector.ts     # 图标检测
│   │   └── onlineDetector.ts   # 联网检测
│   └── config/
│       ├── blacklist.json     # 字体黑名单
│       ├── whitelist.json     # 字体白名单
│       ├── settings.json      # 默认设置
│       └── settingSchema.json # 设置校验规则
├── test/
│   └── sample-project/        # 测试项目
├── PROJECT_LOGIC.md           # 详细逻辑说明
└── API_INTERFACE.md          # 接口文档
```

***

## 📖 了解更多

- [项目逻辑说明](./PROJECT_LOGIC.md) - 深入了解各模块工作原理
- [接口文档](./API_INTERFACE.md) - API 详细说明

***

## ⚠️ 免责声明

IP Guard 检测结果仅供**工程风险排查参考**，不构成法律建议。许可证和版权问题具有法律复杂性，建议咨询专业律师或法务团队。

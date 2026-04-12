# IP Guard 开发文档

## 1. 项目概述

**IP Guard** 是一款面向前端项目的知识产权风险检测工具，帮助快速发现字体版权、许可证合规、隐私政策等问题。

### 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| 运行时 | Node.js |
| 包管理 | pnpm |
| 类型检查 | Zod |
| 语言识别 | franc + traditional-or-simplified |
| 字体解析 | opentype.js |
| 文件扫描 | fast-glob |
| 命令行 | commander + chalk |

### 项目结构

```
ipguard-main/
├── src/
│   ├── index.ts              # 主入口，scan() 函数
│   ├── scanner.ts            # 文件扫描器
│   ├── report.ts             # 报告生成器
│   ├── settingsLoader.ts     # 设置加载器
│   ├── logger.ts            # 日志工具
│   ├── types.ts             # 类型定义
│   ├── cli.ts                # CLI 入口
│   ├── detectors/
│   │   ├── fontDetector.ts   # 字体检测
│   │   ├── licenseDetector.ts # 许可证检测
│   │   ├── languageDetector.ts # 语言检测
│   │   ├── privacyDetector.ts # 隐私检测
│   │   ├── iconDetector.ts   # 图标检测（预留）
│   │   └── onlineDetector.ts # 联网检测（预留）
│   └── config/
│       ├── blacklist.json    # 字体黑名单
│       ├── whitelist.json     # 字体白名单
│       ├── settings.json      # 默认设置
│       └── settingSchema.json # 设置校验规则
├── test/sample-project/       # 测试项目
└── package.json
```

---

## 2. 扫描流程

### 四阶段执行模型

```
┌─────────────────────────────────────────────────────────────┐
│ 阶段一：文件扫描（串行）                                        │
│ - scanner.ts 遍历文件，默认跳过 node_modules/dist/.git 等      │
│ - 分类：字体文件、语言样本文件、图片文件、LICENSE 文件           │
│ - 提取文字内容（最多 50 个文件，50000 字符，分批并发读取）        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段二：设置加载 + 语言检测（并行）                              │
│ - settingsLoader.ts 加载用户设置（全局+项目级）                  │
│ - languageDetector.ts 识别目标市场                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段三：5 项检测并行                                           │
│ - licenseDetector.ts：许可证检测                              │
│ - fontDetector.ts：字体检测                                   │
│ - privacyDetector.ts：隐私检测                               │
│ - iconDetector.ts：图标检测（预留）                           │
│ - onlineDetector.ts：联网检测（按需）                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 阶段四：报告生成                                               │
│ - report.ts 聚合结果，生成 text/json/html 报告                │
└─────────────────────────────────────────────────────────────┘
```

### 异常处理

各阶段独立 try-catch，异常仅记录日志，不阻断后续执行：
- 阶段一异常 → 返回空清单，继续
- 阶段二异常 → 使用默认设置，继续
- 阶段三异常 → 部分成功返回部分结果
- 阶段四异常 → 生成降级报告

---

## 3. 检测模块详解

### 3.1 字体检测（已完成）

**输入**：`.ttf` `.otf` `.woff` `.woff2` 文件

**规则**：
- `blacklist.json`：高危字体（含替代推荐）、中风险字体
- `whitelist.json`：免费可商用字体（50+ 种）

**风险分级**：
| 等级 | 示例字体 | 说明 |
|------|----------|------|
| 高危 | 微软雅黑、方正系列、华文系列 | 商业授权 |
| 中危 | Times New Roman、Arial、Helvetica | 仅系统附带许可 |

**推荐替代**：Noto Sans SC、Source Han Sans、Roboto 等

### 3.2 许可证检测（已完成）

**输入**：`LICENSE`、`license.txt`、`license.md` 等文件

**规则**：内置 15+ 种许可证规则

**风险分级**：
| 等级 | 许可证 | 说明 |
|------|--------|------|
| 高危 | GPL-3.0、AGPL-3.0、CC-BY-NC | 要求开源/禁止商用 |
| 中危 | MPL-2.0、LGPL-3.0、EPL-2.0 | 文件级开源要求 |
| 低危 | MIT、Apache-2.0、BSD | 宽松许可证 |

### 3.3 语言检测（已完成）

**输入**：`.js` `.jsx` `.ts` `.tsx` `.vue` `.svelte` `.html` `.htm` `.json`

**规则**：
- `franc`：识别语言
- `traditional-or-simplified`：判断简繁体

**市场分类**：
`zh-CN` | `zh-Hant` | `en` | `ja` | `ko` | `hi` | `other`

### 3.4 隐私检测（已完成）

**输入**：代码和图片文件中的文字

**支持市场**：
| 市场 | 法规 | 关键词 |
|------|------|--------|
| 欧美 | GDPR + CCPA | 15 个 |
| 中国大陆 | GDPR | 9 个 |
| 港澳台 | GDPR | 9 个 |
| 日本 | APPI | 6 个 |
| 韩国 | PIPA | 6 个 |

**检测项**：
| 代码 | 名称 | 风险 |
|------|------|------|
| PRIVACY_001 | 缺少隐私政策声明 | 高危 |
| PRIVACY_002 | 缺少 Cookie 同意机制 | 中危 |
| PRIVACY_003 | 缺少用户同意机制 | 中危 |
| PRIVACY_004 | 缺少数据主体权利支持 | 中危 |
| PRIVACY_005 | 缺少第三方数据共享披露 | 低危 |

### 3.5 图标检测（预留）

**接口已定义**，待接入外部 API 实现。

### 3.6 联网检测（预留）

**功能**：
- AI 文字检测
- 图片侵权检测
- 商标检测

**触发条件**：用户设置中开启对应功能。

---

## 4. 用户设置系统

### 配置文件位置

| 类型 | 路径 | 作用域 |
|------|------|--------|
| 全局 | `~/.ipguard/settings.json` | 所有项目 |
| 项目 | `{项目根目录}/.ipguard.json` | 仅该项目 |

两者合并，项目设置优先。

### 设置项

```json
{
  "scanMode": "normal",
  "imageDetection": {
    "enabled": false,
    "apiEndpoint": "",
    "apiKey": "",
    "strictMode": false
  },
  "aiDetection": {
    "enabled": false,
    "apiEndpoint": "",
    "apiKey": "",
    "model": "gpt-4o"
  },
  "trademarkDetection": {
    "enabled": false,
    "apiEndpoint": "",
    "apiKey": "",
    "regions": ["zh-CN", "zh-Hant", "en", "ja", "ko"]
  },
  "userIgnores": {}
}
```

### 扫描模式

`strict` | `normal` | `loose` | `ignore`

### 用户忽略规则

按项目名隔离，支持 glob 模式：

```json
{
  "userIgnores": {
    "my-project": [
      {
        "type": "font",
        "pattern": "**/msyh.ttc",
        "reason": "已购买授权"
      }
    ]
  }
}
```

---

## 5. 对外接口

### 5.1 scan(config) → Report

```typescript
import { scan } from '@ipguard/core';

const report = await scan({
  projectPath: './your-project',
  ignorePatterns: ['**/vendor/**'],
  customBlacklist: ['CustomFont'],
  customWhitelist: ['MyFont']
});
```

### 5.2 formatReport(report, format) → string

```typescript
import { formatReport } from '@ipguard/core';

console.log(formatReport(report, 'text'));  // 可读文本
console.log(formatReport(report, 'json')); // JSON
console.log(formatReport(report, 'html'));  // HTML
```

### 5.3 Report 结构

```typescript
interface Report {
  timestamp: string;           // ISO 时间戳
  projectPath: string;         // 项目路径
  scanMode: string;           // 扫描模式
  settingsSource: 'global' | 'project' | 'default';
  language: {
    market: string;            // 市场代码
    marketLabel: string;       // 市场名称
    languageCode: string;      // ISO 639-3
    confidence: number;       // 置信度 0-1
  };
  license: {
    licenseId: string | null;
    licenseName: string | null;
    risk: 'high' | 'medium' | 'low' | 'unknown';
    confidence: number;
    message: string;
    details: string[];
  };
  onlineDetection: {
    enabled: boolean;
    success: boolean;
    error?: string;
  };
  results: ScanResult[];       // 详细检测结果
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
```

### 5.4 ScanResult 结构

```typescript
interface ScanResult {
  type: 'font' | 'license' | 'language' | 'image' | 'privacy' | 'trademark';
  risk: 'high' | 'medium' | 'low';
  file?: string;
  message: string;
  suggestion?: string;
  confidence?: number;
}
```

---

## 6. CLI 用法

```bash
# 基本扫描
pnpm exec ipguard scan ./test/sample-project

# JSON 格式
pnpm exec ipguard scan ./test/sample-project --format json

# 指定黑白名单
pnpm exec ipguard scan ./test/sample-project \
  --blacklist ./my-blacklist.json \
  --whitelist ./my-whitelist.json

# 额外忽略模式
pnpm exec ipguard scan ./test/sample-project \
  --ignore "**/vendor/**" "**/assets/**"
```

---

## 7. 日志系统

`logger.ts` 提供分级日志：

| 级别 | 用途 |
|------|------|
| debug | 调试信息 |
| info | 一般信息 |
| warn | 警告 |
| error | 错误 |

格式：`[时间戳] [级别] [模块] 消息 {额外信息}`

---

## 8. 检测能力边界

| 功能 | 状态 | 说明 |
|------|------|------|
| 文件扫描 | ✅ | 识别前端文件并分类 |
| 语言检测 | ✅ | 识别市场定位 |
| License 检测 | ✅ | 内置 15+ 种许可证规则 |
| 字体检测 | ✅ | 内置 20+ 高危字体 + 50+ 白名单 |
| 隐私检测 | ✅ | 关键词匹配，支持 5 种市场 |
| 图片检测 | 🔶 | 预留接口，需配置联网 API |
| AI 文字检测 | 🔶 | 预留接口，需配置联网 API |
| 商标检测 | 🔶 | 预留接口，需配置联网 API |

---

## 9. 开发命令

```bash
# 安装依赖
pnpm install

# 构建
pnpm run build

# 扫描测试项目
pnpm exec ipguard scan ./test/sample-project
```

---

## 10. 免责声明

IP Guard 检测结果仅供**工程风险排查参考**，不构成法律建议。许可证和版权问题具有法律复杂性，建议咨询专业律师或法务团队。

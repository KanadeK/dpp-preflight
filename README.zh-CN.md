# DPP Preflight

把产品主数据、BOM、供应商记录和本地证据文件，转换成可审计的数字产品护照（DPP）就绪包。

[在线缺口报告](https://kanadek.github.io/dpp-preflight/demo/report.html) · [项目站点](https://kanadek.github.io/dpp-preflight/) · [English](README.md)

DPP 的前期数据通常散落在产品表、BOM 导出、供应商目录和各类声明文件中。DPP Preflight 在下游 Schema 校验之前完成这层整理：指出每个缺口由谁修复，计算证据哈希，生成 JSON-LD 就绪草稿与 GS1 Digital Link 二维码，并把结果封装成可离线验证、可重复生成的 ZIP。

本工具**不宣称法律合规**，不代替具体产品组的授权法案，不证明证据作者身份，也不会提交到欧盟 DPP Registry。

## 真实输出

| 文件 | 用途 |
| --- | --- |
| `report.html` | 可离线打开的缺口优先审阅报告 |
| `report.json` | 机器可读的规则结果与证据链 |
| `gaps.csv` | 每个未解决字段一行 |
| `supplier-requests.csv` | 分配到供应商或内部责任方的具体追问 |
| `passport-draft.jsonld` | 明确标注“非 Registry 提交物”的就绪草稿 |
| `data-carrier.svg` | 编码持久 URI 的二维码 |
| `source-receipt.json` | 输入和证据文件的 SHA-256 回执 |
| `manifest.json`、`SHA256SUMS` | 离线一致性校验 |
| `dpp-preflight-bundle.zip` | 包含全部结果的确定性压缩包 |

## 快速开始

需要 Node.js 20 或更高版本。

```bash
git clone https://github.com/KanadeK/dpp-preflight.git
cd dpp-preflight
npm ci

node src/cli.js analyze \
  --input-dir examples/northstar-gaps \
  --out dist/my-first-preflight \
  --as-of 2026-07-30T00:00:00.000Z \
  --allow-gaps

node src/cli.js verify dist/my-first-preflight/dpp-preflight-bundle.zip
```

内置缺口示例的预期结果是 `55.5/100`、9 个阻断项、1 个审阅项和 11 条责任方请求；完整示例必须达到 `100/100`。

创建自己的输入目录：

```bash
node src/cli.js init my-product
# 替换虚构数据与证据文件
node src/cli.js analyze --input-dir my-product --out dist/my-product
```

已有输出目录默认不会被覆盖；只有明确指定同一目标并添加 `--force` 才会替换。

## 输入结构

```text
my-product/
├── product.json
├── bom.csv
├── suppliers.csv
├── evidence.csv
└── evidence/
    └── supplier-declaration.pdf
```

以 [`templates/starter`](templates/starter) 为准。证据路径只能位于输入目录内，防止意外读取其他文件。

内置规则包包含 23 条可解释检查，覆盖唯一标识、数据载体、经济运营者与工厂、访问权限、隐私、BOM 可追溯性、证据文件与日期、质量平衡和维修链接。可直接查看规则依据和修复动作：

```bash
node src/cli.js explain EVD-002
node src/cli.js explain MASS-001 --json
```

## 退出码

| 代码 | 含义 |
| ---: | --- |
| `0` | 成功；或用 `--allow-gaps` 明确允许缺口 |
| `2` | 分析完成，但仍有阻断缺口 |
| `3` | 输入、规则、参数或输出目标无效 |
| `4` | 结果包校验失败 |
| `1` | 未预期的运行错误 |

## 验收

```bash
npm ci
npm run release:check
```

这条发布门会运行静态检查、覆盖率测试、两套端到端示例、ZIP 篡改校验、1 万行性能基线、站点组装、npm 包打包、发布文件哈希和独立复验。

如果失败，请按 [故障与修复流程](docs/TROUBLESHOOTING.md) 定位；不要为了让规则变绿而删除源证据或放宽关键规则。

调研依据与不重复性判断见 [RESEARCH.md](docs/RESEARCH.md)，架构和信任边界见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)，规则扩展方法见 [RULEPACK.md](docs/RULEPACK.md)。

MIT 开源，第三方声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

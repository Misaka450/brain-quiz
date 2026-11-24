# 大脑出厂设置测评（v1.5 · 50 题池自适应静态站点）

面向移动端（375–430px）优先的纯静态趣味认知风格探索应用，零构建步骤、零外部 CDN / 字体依赖，支持本地双击 `file://` 直开与 Cloudflare Pages 一键部署。

## 核心架构与规格（v1.5）

- **50 题三层正交题库**（`js/questions.js`）：
  - **Tier A（`C01–C24`，6 个 4 题正交块）**：遍历对称群 $S_4$ 全部 24 个互异正交置换矩阵，支撑同一用户连续 3 刷 Stage 1 基线零重题。
  - **Tier B（`P01–P24`，6 个双维对决块）**：`VL / VQ / VD / LQ / LD / QD` 每组 4 题，目标双维缩放 2×（平方信息增益 4×）。
  - **Tier S（`S01–S02`，终局特种底色题）**：`scales=[0,0,0,0]` 零缩放正交隔离，零污染产出 4 枚「处世底色副章」与 SSR 极化变异触发。
  - 全局格拉姆矩阵严格满足 $\mathbf{W}_{50}^T\mathbf{W}_{50} = 2100 I_4$。
- **三阶自适应路由 + 终局收官**（`js/engine.js`）：单次实答严格落在 **16–20 题**（8 基线 + 7~11 靶向对决 + 1 终局特种），采用余弦相似度 + 三级确定性平局决胜 + 单题最坏逆向扰动早停。
- **12 种认知原型 × 4 枚处世底色**（`js/archetypes.js`）：48 种主视觉组合，配纯原生 `<svg>` 四维雷达图与 Cornish-Fisher 离线常模分位推算（`OFFLINE_COHORT_MODEL_V1_5`）。
- **纯原生 Canvas 3:4 海报**（`js/poster.js`）：`750×1000` 逻辑分辨率，`scale = min(devicePixelRatio, 3)`，移动端全屏 `<img>` 长按存相册，桌面端提供 PNG 下载按钮。
- **离线 HMAC-SHA256 卡密门禁**（`js/auth.js` & `scripts/gen_codes.py`）：前 4 题免费试玩，答完第 4 题弹毛玻璃门禁；支持 URL `?code=XXXX` 静默核销与 `claim.html` 自助核销入口；单码本地限用 5 次。
- **持久化与埋点**：自动保存断点续答草稿（`mxge_quiz_draft_v15`）、滚动记忆最近 2 轮已答题号（`mxge_recent_runs_v15`）；`ENABLE_REMOTE_TRACKING = false`，本地队列埋点支持一键导出 JSON。

## 目录结构

```text
site/
├── index.html               # 主应用（SEO / OG / JSON-LD / 5大视图 / 合规页脚）
├── claim.html               # 静态自助核销验真入口
├── css/main.css             # 新锐认知实验室杂志风样式（#FAF8F5 + #1A1A1A + 克莱因蓝/朱砂红）
├── js/
│   ├── config.js            # 全局配置常量（v1.5.0-50q）
│   ├── questions.js         # 50 题完整正交题库（C01-C24 / P01-P24 / S01-S02）
│   ├── archetypes.js        # 12 种认知原型完整文案与特征向量（P01-P12）
│   ├── auth.js              # 纯 JS 同步 SHA-256 / HMAC-SHA256 核销与本地限次
│   ├── engine.js            # 四阶自适应路由、早停、离线分位与原生 SVG 雷达图
│   ├── poster.js            # 纯原生 Canvas 750×1000 海报离屏绘制
│   ├── tracker.js           # 本地无感埋点与 JSON 导出
│   └── app.js               # 状态机、四阶收敛进度条、门禁与断点续答
├── scripts/
│   ├── gen_codes.py         # Python 3 零依赖卡密批量生成与基准向量自检
│   ├── verify_matrix.py     # Python 50 题正交矩阵与 §2.2 总表对拍脚本
│   └── verify_bank_50.js    # Node.js 7 项硬验收断言（盲选/避重/确定性/体积/合规）
├── _qa/                     # Playwright 390×844 验收截图
├── README.md
├── LICENSE                  # MIT License (Copyright (c) 2026 Misaka450)
└── .gitignore
```

## 本地预览与部署

### 本地预览

```bash
# 方式 1：本地 HTTP 服务（推荐，支持完整 URL 参数测试）
cd site
python3 -m http.server 8099
# 浏览器打开 http://127.0.0.1:8099/ 或 http://127.0.0.1:8099/?code=DM-TEST-ZXZZ

# 方式 2：直接双击 site/index.html（file:// 零 CORS 依赖直开）
```

### Cloudflare Pages 一键部署

```bash
# 无需构建命令，直接推送纯静态目录至 *.pages.dev
npx wrangler pages deploy site --project-name mxge-brain-lab
```

## 验收演示卡密（开发默认盐值）

以下演示码均基于默认验收盐值 `MXGE_BRAIN_V1_2026_SALT_9F3A` 生成，并经 Python 与 JS 双端实机对拍验证有效（每码单设备限用 5 次）：

- `DM-TEST-ZXZZ`（基准向量演示码）
- `DM-X5CH-CLYY`
- `DM-5XC4-89CZ`
- `DM-D6GH-9QEQ`
- `DM-TA5T-KSLA`
- `DM-LZVV-ALWT`

其他 SKU 前缀基准向量（均已双端验真）：`S1-8K9P-YKNF`、`B3-7H4N-PM4V`、`CP-5X2L-RSGB`。

> **生产发版安全提示**：正式上线售卖前，请将 `js/config.js` 中的 `HMAC_SECRET` 替换为私有高熵密钥，并通过环境变量 `MXGE_HMAC_SECRET` 运行 `gen_codes.py` 生成生产批次码；切勿将生产 `codes.txt` / `*.csv` 提交至仓库（已由 `.gitignore` 拦截）。

## 卡密生成与双端算法对拍

```bash
cd site

# 1. 运行 Python 基准向量自检
python3 scripts/gen_codes.py --self-test

# 2. 批量生成卡密（支持 --prefix DM|S1|B3|CP，输出 .txt 或 .csv）
python3 scripts/gen_codes.py --prefix S1 --count 500 --secret "YOUR_PROD_SECRET" --out codes.txt

# 3. 50 题正交矩阵自检（Python）+ 7 项全链路数学与体积自检（Node.js）
python3 scripts/verify_matrix.py
node scripts/verify_bank_50.js
```

## 已知限制

1. **纯静态本地限次**：在 `LOCAL_FALLBACK = true` 模式下，单码 5 次核销上限存储于用户浏览器的 `localStorage`，清除站点缓存或更换设备会重置本地计数；如需跨设备强限次，可接入后端 `/api/verify` 并将 `LOCAL_FALLBACK` 设为 `false`。
2. **离线分位模型**：人群击败率百分比由本地固定常模参数 `OFFLINE_COHORT_MODEL_V1_5`（Cornish-Fisher 偏度修正正态 CDF）确定性推算，不向外部服务器上传用户答题数据。
3. **合规声明**：本应用仅作日常趣味娱乐与思维风格探索，不含任何医疗诊断、心理咨询或专业职业评估功能。

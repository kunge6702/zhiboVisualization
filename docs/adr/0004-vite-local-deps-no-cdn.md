# Vite 原型开发，无 CDN 依赖

初始原型使用 Vite + React 构建，所有依赖通过 npm 安装到本地，运行时不依赖任何 CDN。

**选择的理由：**

ADR 0001 要求"支持离线使用（PWA）"，而直播现场的网络环境不可控。单 HTML 文件 + CDN 加载 React、Babel 和 Google Fonts 的方案在离线环境下直接失效。Vite 提供快速的开发服务器和构建能力，配置简单，对 AI 辅助编码友好。React、ReactDOM 以及三款字体（Bricolage Grotesque、Sora、JetBrains Mono）通过 @fontsource 包安装为本地 npm 依赖，构建后全部内联到 dist 目录，运行时零外部依赖。

**否决的方案：**

单 HTML 文件 + CDN 加载 React/Babel/Google Fonts。运行时需要互联网连接，不适合离线使用场景；Babel 浏览器端编译性能差，不适合生产环境；Google Fonts CDN 在国内访问不稳定。

**与 ADR 0002 的关系：**

ADR 0002 确定的 Next.js + Supabase 仍是产品化阶段的目标技术栈。Vite 原型是该目标的过渡步骤：组件代码（DeviceNode、ConnectionLayer、RequirementsTab 等）以标准 ES 模块编写，迁移至 Next.js 时只需调整入口文件和路由配置，组件本身无需重写。Next.js 提供的 SSR、API 路由和 Supabase 集成能力将在添加用户认证和数据持久化时启用。

**当前项目结构：**

```
├── package.json          # 依赖与脚本
├── vite.config.js        # Vite 配置
├── index.html            # 入口 HTML
├── src/
│   ├── main.jsx          # React 入口，字体引入
│   ├── App.jsx           # 全部组件
│   ├── constants.js      # 设备类型定义、初始状态
│   ├── icons.jsx         # SVG 图标
│   ├── utils.js          # 端口定位、路径计算、BFS 路由搜索
│   └── style.css         # 全局样式
├── CONTEXT.md
└── docs/adr/
```

**运行方式：**

- 开发：`npm run dev`（启动 Vite 开发服务器，热更新）
- 构建：`npm run build`（生产构建到 dist/）
- 预览：`npm run preview`（预览生产构建）

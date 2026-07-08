## 撤销/重做：每项目独立历史栈，50 步上限，只记结构性变更

### 目标
误删设备/连线/需求等结构性变更可撤销/重做，拖动不进栈。Ctrl+Z 撤销、Ctrl+Shift+Z / Ctrl+Y 重做。

### 核心设计

**历史栈结构**：`useState` 存一个 `Map<projectId, { past: [snapshots], future: [snapshots] }>`。每个快照是当前项目的 `{ devices, connections, requirements }` 深拷贝。切换项目时不动历史，切回来仍在。

**区分结构性变更 vs 拖动**：当前所有数据变更都走 `updateCurrentProject(updates)`，包括拖动（`handleMouseMove` 第 803/813 行）。方案：
- 新增 `commitProject(updates)` -- 先把**当前**项目状态压入 past 栈、清空 future，再 apply updates。**只用于结构性变更**（增删设备/连线/需求、重命名）。
- `updateCurrentProject(updates)` 保持原样，**只用于拖动**（不记历史）。
- 把所有结构性 handler（handleAddDevice/handleDeleteDevice/handleDeleteConnection/handleAddRequirement/handleDeleteRequirement/handleRenameDevice/handleRenameProject/handlePortClick 连线创建/handleImportProject）从 `updateCurrentProject` / `setProjects` 切到 `commitProject` / `commitProjects`。

**撤销/重做逻辑**：
- `undo()`：取当前项目的 past 栈顶 -> 推当前状态到 future -> 应用快照到 projects。
- `redo()`：取 future 栈顶 -> 推当前到 past -> 应用快照。
- 50 步上限：past 超过 50 时 shift 掉最旧的。

**快捷键**：扩展现有 `handleKeyDown`（第 578 行），加 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y。注意拦截输入框焦点（重命名 input 里按 Ctrl+Z 应走浏览器原生，不拦截）。

### 改动范围

**1. App.jsx 状态层**
- 新增 `const [histories, setHistories] = useState(new Map())`
- 新增 `commitProject(updates)` -- 压栈 + apply，替代结构性 handler 里的 `updateCurrentProject`
- 新增 `commitProjects(newProjects)` -- 压栈 + setProjects，用于 create/duplicate/delete/import 等替换整个 projects 数组的操作
- 新增 `undo()` / `redo()` -- 从 histories 读写当前项目的栈
- 8 个结构性 handler 切换到 commit 系列

**2. App.jsx 快捷键**
- 扩展 `handleKeyDown`：Ctrl+Z 调 undo，Ctrl+Shift+Z/Ctrl+Y 调 redo
- 焦点在 input/textarea 时不拦截（重命名场景）

**3. UI 入口**
- toolbar 加撤销/重做按钮（带禁用态：past/future 空时灰掉）
- 不加 CSS（复用 `.btn`）

### 不做
- 不记拖动历史（拖动走原 `updateCurrentProject`，不碰 histories）
- 不记 UI 临时状态（selectedDevices/connectingFrom 等，这些本就不持久化）
- 不做"操作描述"（只存快照，不存"删除了设备X"这种文字标签--MVP 不需要，按钮和快捷键够用）
- 项目级操作（create/delete/duplicate 项目本身）不进撤销栈--删了整个项目还撤销回来太混乱，且 localStorage 已兜底

### 边界处理
- **导入项目**：作为新增项目，不压当前项目历史（新项目自带空历史）
- **重命名项目**：走 commitProjects（projects 数组变了），压栈
- **切换项目**：完全不动 histories
- **快照深拷贝**：用 `JSON.parse(JSON.stringify(...))`，和 `handleDuplicateProject` 现有做法一致

### 验证
- `npm run build` 通过
- `npm test` 不回归
- 手动：删设备 -> Ctrl+Z 恢复（含连带删除的连线/需求）；拖动设备 -> Ctrl+Z 不回退拖动；切项目再切回 -> 历史仍在

### 提交
单个 commit：历史栈 + commit 系列 + 快捷键 + UI 按钮。
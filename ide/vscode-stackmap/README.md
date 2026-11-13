# 栈析 · VS Code 扩展原型（F14）

从编辑器里的方法名一键跳到「栈析 / StackMap」知识库条目。这是**原型**：零第三方依赖，只做「解析名字 → 拼深链 → 打开/复制」，不读取、不修改 `content/*.json`，也不依赖 App 的内部实现。

## 安装

- **直接用**：把整个 `ide/vscode-stackmap/` 目录复制到 `~/.vscode/extensions/stackmap-vscode/`（Windows 为 `%USERPROFILE%\.vscode\extensions\stackmap-vscode\`），重启 VS Code。
- **调试**：在 VS Code 中把本目录作为单独文件夹打开，按 `F5` 启动「Extension Development Host」；在新窗口里打开任意 JS/TS 文件即可看到 CodeLens。

前置条件：栈析 App 已启动且 `stackmap.baseUrl` 指向的地址可访问（默认 `http://localhost:5173`，见仓库根 `README.md` 的 `node serve.mjs`）。

## 配置项

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `stackmap.baseUrl` | `http://localhost:5173` | App 访问根地址，末尾斜杠会被自动去掉 |
| `stackmap.methodMap` | `{}` | 方法名 → `methodId` 的显式映射，例如 `{ "createOrder": "m.bff.createOrder" }`；命中时优先生成 id 深链，用于消歧 |
| `stackmap.projectRoot` | `""` | 计算深链 `ref`（相对路径）的基准目录；留空用当前工作区根，可填绝对路径或相对工作区路径 |

配置示例（`.vscode/settings.json`）：

```json
{
  "stackmap.baseUrl": "http://localhost:5173",
  "stackmap.methodMap": {
    "useUploadQueue": "m.fe.useUploadQueue",
    "uploadFileToOSS": "m.fe.uploadFile",
    "createUploadToken": "m.bff.createUploadToken",
    "submitOrder": "m.fe.submitOrder",
    "createOrder": "m.bff.createOrder"
  },
  "stackmap.projectRoot": "samples"
}
```

## 三种跳转方式

1. **CodeLens**：在函数声明、箭头函数、class 方法行，以及带 `// @stackmap <methodId>` 的行上方，出现「栈析：打开 …」与「栈析：复制深链」两个可点链接。
2. **命令面板**：`Ctrl+Shift+P` → `栈析：打开方法条目` / `栈析：复制方法深链`。把光标放到方法名上或选中方法名（选中时取其中最后一个标识符，便于处理 `obj.method(...)`）。
3. **注释标签**：在方法上方写 `// @stackmap m.fe.useUploadQueue`，光标落在该行附近（上下各 2 行）时直接用这个 `methodId`，跳过按名解析。适合同名方法或名字与知识库不一致的场景。

`stackmap.openMethod` 用 `vscode.env.openExternal` 在浏览器打开；`stackmap.copyDeepLink` 把同一条链接写入剪贴板。

## 与 App 深链的对应关系

| 场景 | 深链 |
| --- | --- |
| 命中 `methodMap` 或 `@stackmap` 标签 | `${baseUrl}/#/entry/<methodId>?ref=<relativePath>&line=<n>`（App 已有的 `#/entry/<id>` 路由） |
| 未命中（by-name，主 Agent 新增路由） | `${baseUrl}/#/entry/by-name/${encodeURIComponent(name)}?ref=${encodeURIComponent(relativePath)}&line=${line}` |

- `by-name` 这一条是**与主 Agent 约定的严格格式**，不要改成查询参数形式（如 `?name=`）。
- `ref` 是源码相对 `projectRoot` 的路径（已 `encodeURIComponent`），`line` 是 1 起始的行号；App 侧据此显示「来源：文件 + 行号」，并渲染该条目的四问卡片与链路。
- `name` 需要与 `content/methods.json` 里的 `name` 或 `signature` 中的函数名一致，App 才能按名解析到条目。

## 已知边界

- 静态原型，不做 AST / 类型解析，只靠标识符与正则识别声明；复杂的装饰器、重载、动态调用不保证识别。
- 只注册 `javascript / typescript / javascriptreact / typescriptreact` 四种语言；`.java / .tf / .xml / .md` 等条目源码不会显示 CodeLens（命令面板仍可用）。
- 忽略 `node_modules` 与非 `file:` 文档；光标处无标识符时给出中文提示，不生成空链接。
- 同名方法（例如 `createOrder` 同时出现在 BFF 路由与领域层）必须靠 `methodMap` 或注释标签消歧，否则只能走 by-name 由 App 侧决定。
- `by-name` 路由依赖主 Agent 在 App 中实现；若 App 尚未上线该路由，请先把方法名加进 `stackmap.methodMap`。
- 不联网（除调用系统浏览器）、不写文件、不发送任何数据到第三方。

# 阿尼亚：接入 AI 的本地运行说明

## 1. 安装 Node.js

请安装 Node.js 18 或更高版本。

## 2. 创建本地密钥文件

复制 `.env.example` 并将副本重命名为 `.env`。在 `.env` 中填入你自己创建的 `OPENAI_API_KEY`。

`.env` 不会被 Git 提交。不要把密钥发到聊天、微信或公开代码仓库。

## 3. 在 PowerShell 中启动

在本文件夹打开 PowerShell 后运行：

```powershell
$env:OPENAI_API_KEY="你的密钥"
node server.mjs
```

然后在浏览器打开：`http://localhost:3000`

要使用 `.env` 文件或发布到公网，需要在后续部署步骤中把 `OPENAI_API_KEY` 配置为部署平台的环境变量。

## 本项目的安全措施

- API 密钥只由后端读取，网页不会接触它。
- 每个 IP 5 分钟最多发送 20 条消息，避免滥用。
- 消息先经过审核接口；高风险内容会优先收到现实求助提示。
- 给模型的角色说明禁止其自称真人、心理医生或拥有超能力。
- `store: false`，避免主动要求保存 API 响应状态。

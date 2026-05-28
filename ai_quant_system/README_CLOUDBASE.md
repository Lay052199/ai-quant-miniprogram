# 腾讯云 CloudBase 云托管部署说明

## 适用范围

本说明用于将 `ai_quant_system` 的 FastAPI 后端部署到腾讯云 CloudBase 云托管，供微信小程序调用。

当前服务仅用于量化研究与历史回测展示：

- 不接入真实交易
- 不允许真实下单
- 不包含登录功能
- 不包含支付功能

## 后端入口

FastAPI 启动入口保留为：

- `api_server.py`

健康检查接口：

- `GET /health`

该接口可直接用于云托管的健康检查配置。

## Docker 说明

项目已提供：

- `Dockerfile`
- `.dockerignore`

容器配置要求如下：

- 基础镜像：`python:3.10-slim`
- 安装依赖：`pip install -r requirements.txt`
- 对外暴露端口：`80`
- 启动命令：

```bash
uvicorn api_server:app --host 0.0.0.0 --port 80
```

## 本地启动命令

```powershell
cd ai_quant_system
py -m uvicorn api_server:app --reload
```

本地健康检查：

- [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## CloudBase 云托管部署步骤

1. 将 `ai_quant_system` 目录上传到 GitHub，或准备本地代码包。
2. 登录腾讯云 CloudBase 控制台。
3. 进入“云托管”。
4. 创建新服务。
5. 选择“从代码仓库部署”或“上传代码包”。
6. 部署目录选择 `ai_quant_system`。
7. 如果平台要求填写端口，使用 `80`。
8. 如果平台要求填写启动命令，使用：

```bash
uvicorn api_server:app --host 0.0.0.0 --port 80
```

9. 健康检查路径可设置为：

```text
/health
```

10. 部署成功后，可通过云托管提供的 HTTPS 地址访问：

- `/health`
- `/docs`
- `/api/strategies`
- `/api/backtest`

## 微信小程序对接建议

- 小程序正式环境必须使用 HTTPS 域名
- CloudBase 云托管默认更适合微信小程序正式调用
- 小程序前端中的 `API_BASE_URL` 后续可改为云托管分配的 HTTPS 地址

## 不要上传的内容

以下内容不应上传到仓库或镜像构建上下文：

- `cache/`
- `outputs/`
- `__pycache__/`
- `.env`
- 本地日志文件

这些规则已写入：

- `.gitignore`
- `.dockerignore`

## 建议上传到 GitHub 的文件

- `api_server.py`
- `api_models.py`
- `config.py`
- `requirements.txt`
- `Dockerfile`
- `.dockerignore`
- `.gitignore`
- `README.md`
- `README_API.md`
- `README_DEPLOY.md`
- `README_CLOUDBASE.md`
- `data/`
- `strategy/`
- `backtest/`
- `risk/`
- `report/`
- `tests/`

## 说明

- 本次仅整理部署文件，不修改核心回测逻辑
- Streamlit 页面 `app.py` 仍保留，但 CloudBase 本次部署目标为 FastAPI 后端

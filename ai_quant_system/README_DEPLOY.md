# FastAPI 后端部署说明

## 部署目标

本说明用于将 `ai_quant_system` 的 FastAPI 后端部署到 Render、Railway 等云平台。

当前后端仅提供历史行情获取、策略回测、风险分析和中文报告生成能力：

- 不接入真实交易
- 不允许真实下单
- 不包含登录功能
- 不包含支付功能

## 运行入口

FastAPI 启动文件：

- `api_server.py`

健康检查接口：

- `GET /health`

该接口可直接用于云平台健康检查。

## 本地启动命令

```powershell
cd ai_quant_system
py -m uvicorn api_server:app --reload
```

本地启动后可访问：

- [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## 云端启动命令

```bash
uvicorn api_server:app --host 0.0.0.0 --port $PORT
```

说明：

- Render 和 Railway 通常会通过环境变量注入 `PORT`
- 服务需要监听 `0.0.0.0`

## 依赖要求

当前 `requirements.txt` 已包含后端部署所需核心依赖：

- `fastapi`
- `uvicorn`
- `akshare`
- `pandas`
- `numpy`
- `matplotlib`
- `python-dotenv`

以及项目中已使用的其他依赖：

- `streamlit`
- `openpyxl`
- `pytest`

## 建议部署流程

1. 将 `ai_quant_system` 目录上传到 GitHub 仓库
2. 在 Render 或 Railway 创建新的 Web Service
3. 选择 Python 环境
4. 安装命令使用：

```bash
pip install -r requirements.txt
```

5. 启动命令使用：

```bash
uvicorn api_server:app --host 0.0.0.0 --port $PORT
```

6. 健康检查路径可设置为：

```text
/health
```

## 不应上传的内容

以下内容不建议上传到 GitHub：

- `cache/`
- `outputs/`
- `__pycache__/`
- `.env`
- 本地日志文件

相关忽略规则已写入 `.gitignore`。

## 适合上传 GitHub 的核心文件

- `api_server.py`
- `api_models.py`
- `config.py`
- `requirements.txt`
- `README.md`
- `README_API.md`
- `README_DEPLOY.md`
- `AGENTS.md`
- `data/`
- `strategy/`
- `backtest/`
- `risk/`
- `report/`
- `tests/`

## 说明

- 当前部署说明仅针对 FastAPI 后端
- Streamlit 页面 `app.py` 仍保留，但不是本次云端 API 部署的启动入口
- 若后续接入环境变量、外部密钥或第三方服务，必须通过 `.env` 或平台环境变量管理，不能写入代码

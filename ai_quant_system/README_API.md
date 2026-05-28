# FastAPI 接口说明

## 简介

本项目在保留 Streamlit 页面能力的基础上，新增了 FastAPI 后端服务，用于将历史行情获取、策略回测、风险分析和中文报告能力封装为 API，方便未来接入微信小程序、App 或其他前端。

当前 API 仅支持历史研究与模拟分析：

- 不接入真实交易
- 不允许真实下单
- 不包含任何券商实盘接口

## 启动方式

```powershell
cd ai_quant_system
py -m uvicorn api_server:app --reload
```

启动后默认访问：

- 健康检查: `http://127.0.0.1:8000/health`
- Swagger 文档: `http://127.0.0.1:8000/docs`

## 接口列表

### 1. `GET /health`

返回服务健康状态。

示例响应：

```json
{
  "status": "ok",
  "service": "ai_quant_system_api"
}
```

### 2. `GET /api/strategies`

返回当前支持的策略及默认参数。

### 3. `POST /api/backtest`

执行单股票历史回测。

请求体示例：

```json
{
  "symbol": "000001",
  "start_date": "20200101",
  "end_date": "20241231",
  "strategy": "双均线策略",
  "initial_cash": 100000,
  "commission_rate": 0.0003,
  "slippage_rate": 0.0002,
  "strategy_params": {
    "short_window": 5,
    "long_window": 20
  },
  "benchmark_symbol": "000300",
  "adjust": "qfq"
}
```

返回字段包括：

- `metrics`: 核心指标
- `risk_report`: 风险提示
- `report`: 中文分析报告
- `equity_curve`: 净值曲线数据
- `trades`: 交易记录

## 说明

- 所有日期字段统一通过 `safe_date_to_str` 安全转换为字符串
- 若日期字段为 `None`、`NaT`、`NaN` 或空值，将返回 `null`
- 所有 pandas、numpy 类型已转换为 Python 原生类型，便于 JSON 序列化
- 当前 API 会复用本地缓存和现有回测逻辑
- 报告模块当前使用规则模板生成，不依赖 OpenAI API
- 即使 `trades` 中存在未平仓记录，例如 `sell_date=null`，接口也不应报错

"""FastAPI 请求与响应模型。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    """回测请求模型。"""

    symbol: str = Field(..., description="股票代码，例如 000001")
    start_date: str = Field(..., description="开始日期，格式 YYYYMMDD")
    end_date: str = Field(..., description="结束日期，格式 YYYYMMDD")
    strategy: str = Field(..., description="策略名称，例如 双均线策略")
    initial_cash: float = Field(100000, description="初始资金")
    commission_rate: float = Field(0.0003, description="手续费率")
    slippage_rate: float = Field(0.0002, description="滑点率")
    strategy_params: Dict[str, Any] = Field(default_factory=dict, description="策略参数")
    benchmark_symbol: str = Field("000300", description="基准指数代码")
    adjust: str = Field("qfq", description="复权方式，可选 qfq、hfq 或空字符串")
    allow_mock: bool = Field(False, description="是否允许在真实行情失败时回退到模拟数据")
    demo_mode: bool = Field(False, description="是否启用演示模式，启用后允许使用模拟行情")


class HealthResponse(BaseModel):
    """健康检查响应模型。"""

    status: str
    service: str


class StrategyItem(BaseModel):
    """策略信息模型。"""

    name: str
    description: str
    default_params: Dict[str, Any]


class StrategyListResponse(BaseModel):
    """策略列表响应模型。"""

    strategies: List[StrategyItem]


class BacktestResponse(BaseModel):
    """回测响应模型。"""

    metrics: Dict[str, Any]
    risk_report: List[str]
    report: str
    equity_curve: List[Dict[str, Any]]
    trades: List[Dict[str, Any]]

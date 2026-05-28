"""FastAPI 后端服务。"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import akshare as ak
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

from api_models import BacktestRequest, HealthResponse, StrategyItem, StrategyListResponse
from backtest.engine import run_backtest
from backtest.metrics import calculate_metrics
from config import BENCHMARK, CACHE_PATH
from data.akshare_loader import _normalize_price_df, get_index_daily
from data.data_cleaner import clean_price_data
from report.report_generator import generate_text_report
from risk.risk_manager import generate_risk_report
from strategy.ma_strategy import generate_ma_signal
from strategy.momentum_strategy import generate_momentum_signal
from strategy.rsi_strategy import generate_rsi_signal

app = FastAPI(
    title="AI Quant System API",
    description="基于 Python + AKShare 的量化研究与历史回测 API，仅用于学习、研究和模拟分析。",
    version="1.0.0",
)


def get_strategy_registry() -> Dict[str, Dict[str, Any]]:
    """返回策略注册表。"""
    return {
        "双均线策略": {
            "description": "基于短期均线与长期均线金叉/死叉的趋势跟踪策略。",
            "default_params": {"short_window": 5, "long_window": 20},
            "handler": lambda df, params: generate_ma_signal(
                df,
                short_window=int(params.get("short_window", 5)),
                long_window=int(params.get("long_window", 20)),
            ),
        },
        "动量策略": {
            "description": "基于过去一段时间价格涨跌幅的简单动量策略。",
            "default_params": {"window": 20, "threshold": 0},
            "handler": lambda df, params: generate_momentum_signal(
                df,
                window=int(params.get("window", params.get("momentum_window", 10))),
                threshold=float(params.get("threshold", 0)),
            ),
        },
        "RSI 策略": {
            "description": "基于 RSI 超买超卖区间的反转型策略。",
            "default_params": {"window": 14, "lower": 30, "upper": 70},
            "handler": lambda df, params: generate_rsi_signal(
                df,
                window=int(params.get("window", params.get("rsi_window", 14))),
                lower=float(params.get("lower", 30)),
                upper=float(params.get("upper", 70)),
            ),
        },
    }


def resolve_strategy_name(strategy_value: str) -> str | None:
    """兼容中文策略名与英文短码。"""
    mapping = {
        "ma": "双均线策略",
        "双均线策略": "双均线策略",
        "momentum": "动量策略",
        "动量策略": "动量策略",
        "rsi": "RSI 策略",
        "rsi策略": "RSI 策略",
        "RSI策略": "RSI 策略",
        "RSI 策略": "RSI 策略",
    }
    return mapping.get(strategy_value)


def safe_date_to_str(value: Any, fmt: str = "%Y%m%d") -> str | None:
    """安全转换日期字段。"""
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (pd.Timestamp, datetime, date)):
        if pd.isna(value):
            return None
        return value.strftime(fmt)
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return None


def safe_number(value: Any, digits: int = 6) -> float | int | None:
    """安全转换数值。"""
    if value is None:
        return None
    try:
        if pd.isna(value) or np.isinf(value):
            return None
    except TypeError:
        pass
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return round(float(value), digits)
    return value


def to_json_compatible(value: Any) -> Any:
    """递归转换为 JSON 兼容类型。"""
    if isinstance(value, str):
        return value
    if isinstance(value, (pd.Timestamp, datetime, date)) or value is pd.NaT:
        return safe_date_to_str(value)
    if isinstance(value, np.generic):
        return to_json_compatible(value.item())
    if isinstance(value, dict):
        return {str(key): to_json_compatible(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_compatible(item) for item in value]
    if isinstance(value, pd.Series):
        return [to_json_compatible(item) for item in value.tolist()]
    try:
        if pd.isna(value) or np.isinf(value):
            return None
    except TypeError:
        pass
    return value


def dataframe_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """将 DataFrame 转换为可 JSON 序列化的记录列表。"""
    records = df.to_dict(orient="records")
    return [{key: to_json_compatible(value) for key, value in record.items()} for record in records]


def metrics_to_python(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """将指标字典转换为原生类型。"""
    return {key: to_json_compatible(value) for key, value in metrics.items()}


def build_cache_path(symbol: str, start_date: str, end_date: str, adjust: str = "qfq") -> Path:
    """构建本地缓存路径。"""
    adjust_tag = adjust if adjust else "bfq"
    return CACHE_PATH / f"{symbol}_{start_date}_{end_date}_{adjust_tag}.csv"


def build_mock_data(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """构造演示用 mock 行情。"""
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    dates = pd.bdate_range(start=start, end=end)
    if len(dates) < 90:
        dates = pd.bdate_range(end=end, periods=max(150, len(dates) + 60))

    trend = np.linspace(18, 36, len(dates))
    wave1 = 1.6 * np.sin(np.arange(len(dates)) / 4.8)
    wave2 = 0.9 * np.cos(np.arange(len(dates)) / 9.5)
    noise = 0.25 * np.sin(np.arange(len(dates)) / 2.4)
    close = trend + wave1 + wave2 + noise
    open_price = close * (1 + 0.003 * np.cos(np.arange(len(dates)) / 5.0))
    high = np.maximum(open_price, close) * 1.015
    low = np.minimum(open_price, close) * 0.985
    volume = 800000 + (np.arange(len(dates)) % 18) * 32000
    amount = volume * close

    return pd.DataFrame(
        {
            "date": dates,
            "open": open_price,
            "close": close,
            "high": high,
            "low": low,
            "volume": volume,
            "amount": amount,
            "amplitude": 0,
            "pct_change": 0,
            "change_amount": 0,
            "turnover": 0,
        }
    )


def build_mock_index_data(start_date: str, end_date: str) -> pd.DataFrame:
    """构造演示用 mock 基准指数。"""
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    dates = pd.bdate_range(start=start, end=end)
    if len(dates) < 90:
        dates = pd.bdate_range(end=end, periods=max(150, len(dates) + 60))

    trend = np.linspace(4000, 4300, len(dates))
    wave = 45 * np.sin(np.arange(len(dates)) / 8.0)
    close = trend + wave
    open_price = close * (1 + 0.0015 * np.cos(np.arange(len(dates)) / 6.0))
    high = np.maximum(open_price, close) * 1.006
    low = np.minimum(open_price, close) * 0.994
    volume = 1000000 + (np.arange(len(dates)) % 10) * 50000
    amount = volume * close

    return pd.DataFrame(
        {
            "date": dates,
            "open": open_price,
            "close": close,
            "high": high,
            "low": low,
            "volume": volume,
            "amount": amount,
        }
    )


def read_cached_market_data(symbol: str, start_date: str, end_date: str, adjust: str = "qfq") -> pd.DataFrame | None:
    """读取缓存行情，并检查区间是否完整覆盖。"""
    cache_path = build_cache_path(symbol, start_date, end_date, adjust)
    if not cache_path.exists():
        return None

    cached_df = pd.read_csv(cache_path)
    normalized = _normalize_price_df(cached_df)
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    if normalized.empty:
        return None
    if normalized["date"].min() > start or normalized["date"].max() < end:
        return None
    return normalized


def fetch_akshare_market_data(symbol: str, start_date: str, end_date: str, adjust: str = "qfq") -> pd.DataFrame:
    """调用 AKShare 获取真实行情。"""
    raw_df = ak.stock_zh_a_hist(
        symbol=symbol,
        period="daily",
        start_date=start_date,
        end_date=end_date,
        adjust=adjust,
        timeout=15,
    )
    if raw_df is None or raw_df.empty:
        raise ValueError("AKShare 返回空数据")
    normalized = _normalize_price_df(raw_df)
    if normalized.empty:
        raise ValueError("标准化后行情为空")
    return normalized


def save_market_data_cache(df: pd.DataFrame, symbol: str, start_date: str, end_date: str, adjust: str = "qfq") -> None:
    """保存真实行情缓存。"""
    cache_path = build_cache_path(symbol, start_date, end_date, adjust)
    df.to_csv(cache_path, index=False, encoding="utf-8-sig")


def get_market_data(
    symbol: str,
    start_date: str,
    end_date: str,
    demo_mode: bool = False,
    allow_mock: bool = False,
    adjust: str = "qfq",
) -> Tuple[pd.DataFrame | None, str, str]:
    """统一市场数据获取函数。"""
    cache_error = ""
    try:
        cached_df = read_cached_market_data(symbol, start_date, end_date, adjust=adjust)
        if cached_df is not None and not cached_df.empty:
            return cached_df, "cache", "使用缓存真实行情数据"
    except Exception as exc:
        cache_error = f"缓存读取异常：{exc}"

    try:
        real_df = fetch_akshare_market_data(symbol, start_date, end_date, adjust=adjust)
        save_market_data_cache(real_df, symbol, start_date, end_date, adjust=adjust)
        return real_df, "akshare", "使用 AKShare 真实行情数据"
    except Exception:
        if demo_mode or allow_mock:
            mock_df = build_mock_data(symbol, start_date, end_date)
            message = "真实行情数据源暂不可用，当前使用模拟行情数据，仅用于功能演示"
            if cache_error:
                message = f"{cache_error}；{message}"
            return mock_df, "mock", message

        message = "真实行情数据源暂不可用，请稍后重试或开启演示模式"
        if cache_error:
            message = f"{cache_error}；{message}"
        return None, "none", message


def get_benchmark_data(start_date: str, end_date: str, use_mock: bool = False) -> pd.DataFrame | None:
    """获取基准数据，失败时在演示模式下回退 mock。"""
    try:
        return get_index_daily(
            symbol=BENCHMARK,
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
            use_cache=True,
        )
    except Exception:
        if use_mock:
            return build_mock_index_data(start_date, end_date)
        return None


def build_demo_report_prefix(data_source: str) -> str:
    """生成报告前缀提示。"""
    if data_source == "mock":
        return "当前使用模拟行情数据，仅用于功能演示，不构成真实投资分析。\n\n"
    return ""


def build_failure_analysis(error_code: str) -> Dict[str, Any]:
    """构造失败原因分析。"""
    mapping = {
        "DATA_SOURCE_UNAVAILABLE": {
            "reason": "真实行情数据源暂不可用",
            "possible_causes": [
                "AKShare 数据源临时不可达",
                "回测区间较长导致请求压力较大",
                "股票代码无有效历史数据",
                "网络环境暂时不稳定"
            ],
            "suggestions": [
                "稍后重试",
                "缩短回测区间",
                "开启演示模式",
                "检查股票代码是否正确"
            ]
        },
        "INVALID_PARAMS": {
            "reason": "参数错误",
            "possible_causes": [
                "日期格式不是 YYYYMMDD",
                "股票代码为空或格式异常",
                "策略参数超出合理范围"
            ],
            "suggestions": [
                "检查日期格式是否为 YYYYMMDD",
                "检查股票代码是否为 6 位数字",
                "检查策略参数是否合理"
            ]
        },
        "STRATEGY_ERROR": {
            "reason": "策略执行失败",
            "possible_causes": [
                "策略名称不受支持",
                "策略参数和行情长度不匹配",
                "行情样本不足以支撑指标计算"
            ],
            "suggestions": [
                "更换策略",
                "调整参数",
                "缩短时间区间"
            ]
        },
        "DATE_RANGE_TOO_LONG": {
            "reason": "回测区间过长",
            "possible_causes": [
                "请求时间跨度超过 3 年",
                "长区间增加了真实数据源不稳定概率"
            ],
            "suggestions": [
                "缩短回测区间",
                "优先按年度或阶段性拆分测试",
                "如仅用于演示，可开启演示模式"
            ]
        }
    }
    return mapping.get(
        error_code,
        {
            "reason": "未知错误",
            "possible_causes": ["服务处理过程中出现未预期问题"],
            "suggestions": ["稍后重试", "检查输入参数"]
        }
    )


def build_backtest_failure_response(
    error_code: str,
    message: str,
    data_source: str = "none",
    data_message: str = "",
) -> Dict[str, Any]:
    """构造统一失败响应。"""
    return {
        "success": False,
        "error_code": error_code,
        "message": message,
        "data_source": data_source,
        "data_message": data_message,
        "symbol": None,
        "strategy": None,
        "start_date": None,
        "end_date": None,
        "metrics": {},
        "benchmark_analysis": {},
        "analysis_conclusion": {},
        "risk_report": [],
        "report": "",
        "trades": [],
        "equity_curve": [],
        "failure_analysis": build_failure_analysis(error_code),
    }


def get_metric_value(metrics: Dict[str, Any], *keys: str) -> float:
    """从指标中按多个候选键提取数值。"""
    for key in keys:
        if key in metrics and metrics[key] is not None:
            try:
                return float(metrics[key])
            except (TypeError, ValueError):
                continue
    return 0.0


def build_benchmark_analysis(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """生成策略与基准收益对比分析。"""
    strategy_return = get_metric_value(metrics, "策略收益", "总收益率")
    benchmark_return = get_metric_value(metrics, "基准收益", "基准收益率")
    excess_return = get_metric_value(metrics, "超额收益", "超额收益率")

    if abs(strategy_return - benchmark_return) <= 0.01:
        conclusion = "策略表现接近基准"
        explanation = "策略收益与基准收益差异较小，说明该策略在当前区间内并未显著偏离大盘表现，更适合作为观察策略稳定性的样本。"
    elif strategy_return > benchmark_return:
        conclusion = "策略跑赢基准"
        if strategy_return < 0 and benchmark_return < strategy_return:
            explanation = "虽然策略收益为负，但相对基准具有一定防御效果，说明其在下行阶段可能减少了部分回撤。"
        else:
            explanation = "策略在当前样本期内取得了高于基准的收益，说明该策略的信号在这一阶段对市场节奏有一定适配性。"
    else:
        conclusion = "策略跑输基准"
        if strategy_return < 0 and benchmark_return < 0:
            explanation = "该策略在当前区间未能有效捕捉行情，可能存在信号滞后或震荡损耗。"
        else:
            explanation = "基准表现优于策略，说明在当前区间内，策略的信号优势并不明显，可能受到参数选择或市场结构变化影响。"

    return {
        "strategy_return": safe_number(strategy_return),
        "benchmark_return": safe_number(benchmark_return),
        "excess_return": safe_number(excess_return),
        "conclusion": conclusion,
        "explanation": explanation,
    }


def build_analysis_conclusion(strategy_name: str, metrics: Dict[str, Any], benchmark_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """生成教学型回测结论。"""
    strategy_return = get_metric_value(metrics, "策略收益", "总收益率")
    benchmark_return = get_metric_value(metrics, "基准收益", "基准收益率")
    max_drawdown = get_metric_value(metrics, "最大回撤")
    sharpe_ratio = get_metric_value(metrics, "夏普比率")

    if strategy_return > benchmark_return:
        summary = "策略整体表现优于基准，说明在当前回测区间内具备一定主动收益能力。"
    elif strategy_return < benchmark_return:
        summary = "策略整体表现弱于基准，说明当前参数下对市场节奏的适配性不足。"
    else:
        summary = "策略整体表现接近基准，说明主动收益优势尚不明显。"

    return_analysis = (
        f"本次回测中，策略收益为 {strategy_return:.2%}，基准收益为 {benchmark_return:.2%}。"
        f"{benchmark_analysis.get('explanation', '')}"
    )

    if abs(max_drawdown) < 0.15 and sharpe_ratio > 0.5:
        risk_analysis = "从风险角度看，策略回撤控制相对平稳，且风险调整后收益具备一定可解释性。"
    elif abs(max_drawdown) < 0.25:
        risk_analysis = "策略在当前区间内存在一定波动与回撤压力，但整体仍处于可学习和可分析范围内。"
    else:
        risk_analysis = "策略回撤较大，说明在不利市场阶段容易出现净值快速回吐，需要重点关注风险控制机制。"

    strategy_limitation_map = {
        "双均线策略": "双均线策略更适合趋势明确行情，在震荡环境中容易出现频繁交易和信号滞后。",
        "动量策略": "动量策略更适合趋势延续阶段，在快速反转行情中容易出现追高或杀跌问题。",
        "RSI 策略": "RSI 策略更适合震荡和均值回归场景，在单边强趋势下可能出现指标钝化。"
    }

    learning_note = "历史回测不等于未来实盘表现，策略评价应结合不同时间区间、不同参数组合和不同市场环境进行交叉验证。"

    return {
        "summary": summary,
        "return_analysis": return_analysis,
        "risk_analysis": risk_analysis,
        "strategy_limitation": strategy_limitation_map.get(strategy_name, "策略适用边界需要结合具体市场环境进一步分析。"),
        "learning_note": learning_note,
    }


def build_success_metrics(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """清洗并补齐教学展示用指标字段。"""
    strategy_return = get_metric_value(metrics, "总收益率")
    benchmark_return = get_metric_value(metrics, "基准收益率")
    excess_return = get_metric_value(metrics, "超额收益率")
    annual_return = get_metric_value(metrics, "年化收益率")
    max_drawdown = get_metric_value(metrics, "最大回撤")
    sharpe_ratio = get_metric_value(metrics, "夏普比率")
    win_rate = get_metric_value(metrics, "胜率")
    trade_count = get_metric_value(metrics, "交易次数")
    final_value = get_metric_value(metrics, "最终资产")

    return {
        "策略收益": safe_number(strategy_return),
        "基准收益": safe_number(benchmark_return),
        "超额收益": safe_number(excess_return),
        "年化收益率": safe_number(annual_return),
        "最大回撤": safe_number(max_drawdown),
        "夏普比率": safe_number(sharpe_ratio),
        "胜率": safe_number(win_rate),
        "交易次数": safe_number(trade_count, 0),
        "最终资产": safe_number(final_value, 2),
        "总收益率": safe_number(strategy_return),
        "基准收益率": safe_number(benchmark_return),
        "超额收益率": safe_number(excess_return),
    }


def build_equity_curve(result_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """生成统一净值曲线结构。"""
    return [
        {
            "date": safe_date_to_str(row["date"]),
            "net_value": round(float(row["strategy_nav"]), 4) if row["strategy_nav"] is not None else None,
        }
        for _, row in result_df[["date", "strategy_nav"]].iterrows()
    ]


def execute_strategy_backtest(
    payload: BacktestRequest,
    strategy_name: str,
    strategy_params: Dict[str, Any],
    data_df: pd.DataFrame,
    benchmark_df: pd.DataFrame | None,
) -> Tuple[Dict[str, Any], List[str], str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """执行单次策略回测并返回标准结果。"""
    registry = get_strategy_registry()
    clean_df = clean_price_data(data_df)
    strategy_df = registry[strategy_name]["handler"](clean_df, strategy_params or {})
    result_df, trades_df = run_backtest(
        strategy_df,
        initial_cash=payload.initial_cash,
        commission_rate=payload.commission_rate,
        slippage_rate=payload.slippage_rate,
        benchmark_df=benchmark_df,
    )
    raw_metrics = calculate_metrics(result_df, trades_df)
    metrics = build_success_metrics(raw_metrics)
    risk_report = generate_risk_report(result_df, trades_df)
    report = generate_text_report(
        metrics=metrics,
        risk_report=risk_report,
        strategy_name=strategy_name,
        symbol=payload.symbol,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return metrics, risk_report, str(report), dataframe_to_records(trades_df.copy()), build_equity_curve(result_df)


def build_sensitivity_param_sets(strategy_name: str) -> List[Dict[str, Any]]:
    """返回参数敏感性测试组合。"""
    if strategy_name == "双均线策略":
        return [
            {"short_window": 5, "long_window": 20, "params_label": "MA(5,20)"},
            {"short_window": 10, "long_window": 30, "params_label": "MA(10,30)"},
            {"short_window": 20, "long_window": 60, "params_label": "MA(20,60)"},
        ]
    if strategy_name == "动量策略":
        return [
            {"window": 5, "params_label": "Momentum(5)"},
            {"window": 10, "params_label": "Momentum(10)"},
            {"window": 20, "params_label": "Momentum(20)"},
        ]
    return [
        {"window": 6, "params_label": "RSI(6)"},
        {"window": 14, "params_label": "RSI(14)"},
        {"window": 21, "params_label": "RSI(21)"},
    ]


def build_sensitivity_conclusion(total_return: float, max_drawdown: float, sharpe_ratio: float) -> str:
    """生成参数组合简短评价。"""
    if total_return > 0 and sharpe_ratio > 0.5:
        return "收益表现相对较稳健。"
    if total_return > 0:
        return "收益为正，但仍需关注回撤控制。"
    if abs(max_drawdown) > 0.2:
        return "收益承压且回撤偏大。"
    return "表现一般，适合用于参数对比学习。"


def build_sensitivity_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """汇总参数敏感性分析结果。"""
    if not results:
        return {
            "best_params": "",
            "worst_params": "",
            "is_sensitive": False,
            "explanation": "当前没有可用的参数组合结果。"
        }

    sorted_results = sorted(results, key=lambda item: item.get("total_return", -999), reverse=True)
    best = sorted_results[0]
    worst = sorted_results[-1]
    spread = abs((best.get("total_return") or 0) - (worst.get("total_return") or 0))
    is_sensitive = spread > 0.1
    explanation = (
        "参数变化对结果影响较大，说明该策略对参数选择较敏感，不能只依据单组参数下结论。"
        if is_sensitive
        else "参数变化对结果影响相对有限，说明该策略在当前区间的参数稳定性尚可。"
    )
    return {
        "best_params": best.get("params_label", ""),
        "worst_params": worst.get("params_label", ""),
        "is_sensitive": is_sensitive,
        "explanation": explanation,
    }


@app.get("/", response_model=HealthResponse)
def root() -> HealthResponse:
    """根路径健康检查接口。"""
    return HealthResponse(status="ok", service="ai_quant_system_api")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """健康检查接口。"""
    return HealthResponse(status="ok", service="ai_quant_system_api")


@app.get("/api/strategies", response_model=StrategyListResponse)
def get_strategies() -> StrategyListResponse:
    """返回支持的策略列表。"""
    registry = get_strategy_registry()
    strategies = [
        StrategyItem(
            name=name,
            description=config["description"],
            default_params=config["default_params"],
        )
        for name, config in registry.items()
    ]
    return StrategyListResponse(strategies=strategies)


@app.post("/api/backtest")
def backtest(payload: BacktestRequest) -> Dict[str, Any]:
    """执行历史回测并返回 JSON 结果。"""
    try:
        registry = get_strategy_registry()
        strategy_name = resolve_strategy_name(str(payload.strategy))
        if strategy_name is None or strategy_name not in registry:
            raise HTTPException(status_code=400, detail=f"不支持的策略名称: {payload.strategy}")

        if not str(payload.symbol).strip():
            raise HTTPException(status_code=400, detail="股票代码不能为空")

        if not str(payload.symbol).strip().isdigit() or len(str(payload.symbol).strip()) != 6:
            raise HTTPException(status_code=400, detail="股票代码应为 6 位数字")

        try:
            start = pd.to_datetime(payload.start_date)
            end = pd.to_datetime(payload.end_date)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYYMMDD") from exc

        if end < start:
            raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")

        if (end - start).days > 365 * 3:
            return build_backtest_failure_response(
                error_code="DATE_RANGE_TOO_LONG",
                message="回测区间过长，建议缩短区间",
                data_source="none",
                data_message="当前请求区间超过 3 年，建议缩短区间以提升稳定性和响应速度。",
            )

        demo_mode = bool(payload.demo_mode)
        allow_mock = bool(payload.allow_mock)
        adjust = "" if payload.adjust in {"", "不复权"} else payload.adjust
        price_df, data_source, data_message = get_market_data(
            symbol=payload.symbol,
            start_date=payload.start_date.replace("-", ""),
            end_date=payload.end_date.replace("-", ""),
            demo_mode=demo_mode,
            allow_mock=allow_mock,
            adjust=adjust,
        )

        if price_df is None:
            return build_backtest_failure_response(
                error_code="DATA_SOURCE_UNAVAILABLE",
                message="真实行情数据源暂不可用，请稍后重试或开启演示模式",
                data_source="none",
                data_message=data_message,
            )

        benchmark_df = get_benchmark_data(payload.start_date, payload.end_date, use_mock=(data_source == "mock" or demo_mode or allow_mock))
        metrics, risk_report, report, trades, equity_curve = execute_strategy_backtest(
            payload=payload,
            strategy_name=strategy_name,
            strategy_params=payload.strategy_params or {},
            data_df=price_df,
            benchmark_df=benchmark_df,
        )
        report = build_demo_report_prefix(data_source) + report
        benchmark_analysis = build_benchmark_analysis(metrics)
        analysis_conclusion = build_analysis_conclusion(strategy_name, metrics, benchmark_analysis)

        return {
            "success": True,
            "data_source": data_source,
            "data_message": data_message,
            "symbol": payload.symbol,
            "strategy": strategy_name,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "metrics": metrics,
            "benchmark_analysis": benchmark_analysis,
            "analysis_conclusion": analysis_conclusion,
            "risk_report": [str(item) for item in risk_report],
            "report": report,
            "trades": trades,
            "equity_curve": equity_curve,
            "failure_analysis": {},
        }
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        return build_backtest_failure_response(
            error_code="STRATEGY_ERROR",
            message="策略执行失败，请稍后重试或调整参数",
            data_source="none",
            data_message=f"系统已安全拦截异常：{exc}",
        )


@app.post("/api/sensitivity")
def sensitivity(payload: BacktestRequest) -> Dict[str, Any]:
    """参数敏感性分析接口。"""
    try:
        registry = get_strategy_registry()
        strategy_name = resolve_strategy_name(str(payload.strategy))
        if strategy_name is None or strategy_name not in registry:
            raise HTTPException(status_code=400, detail=f"不支持的策略名称: {payload.strategy}")

        demo_mode = bool(payload.demo_mode)
        allow_mock = bool(payload.allow_mock)
        adjust = "" if payload.adjust in {"", "不复权"} else payload.adjust
        price_df, data_source, data_message = get_market_data(
            symbol=payload.symbol,
            start_date=payload.start_date.replace("-", ""),
            end_date=payload.end_date.replace("-", ""),
            demo_mode=demo_mode,
            allow_mock=allow_mock,
            adjust=adjust,
        )

        if price_df is None:
            return build_backtest_failure_response(
                error_code="DATA_SOURCE_UNAVAILABLE",
                message="真实行情数据源暂不可用，请稍后重试或开启演示模式",
                data_source="none",
                data_message=data_message,
            )

        benchmark_df = get_benchmark_data(payload.start_date, payload.end_date, use_mock=(data_source == "mock" or demo_mode or allow_mock))
        param_sets = build_sensitivity_param_sets(strategy_name)
        results = []

        for params in param_sets:
            strategy_params = {key: value for key, value in params.items() if key != "params_label"}
            metrics, _, _, _, _ = execute_strategy_backtest(
                payload=payload,
                strategy_name=strategy_name,
                strategy_params=strategy_params,
                data_df=price_df,
                benchmark_df=benchmark_df,
            )
            results.append(
                {
                    "params_label": params["params_label"],
                    "total_return": metrics.get("策略收益"),
                    "max_drawdown": metrics.get("最大回撤"),
                    "sharpe_ratio": metrics.get("夏普比率"),
                    "conclusion": build_sensitivity_conclusion(
                        float(metrics.get("策略收益") or 0),
                        float(metrics.get("最大回撤") or 0),
                        float(metrics.get("夏普比率") or 0),
                    ),
                }
            )

        return {
            "success": True,
            "data_source": data_source,
            "data_message": data_message,
            "symbol": payload.symbol,
            "strategy": strategy_name,
            "sensitivity_results": to_json_compatible(results),
            "sensitivity_summary": build_sensitivity_summary(results),
            "failure_analysis": {},
        }
    except HTTPException as exc:
        raise exc
    except Exception as exc:
        return build_backtest_failure_response(
            error_code="STRATEGY_ERROR",
            message="参数敏感性分析执行失败",
            data_source="none",
            data_message=f"系统已安全拦截异常：{exc}",
        )

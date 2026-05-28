"""AI 量化交易回测系统 Flask 后端入口。

该服务用于提供：
1. 健康检查
2. 系统信息
3. A 股历史回测接口

仅用于学习、研究和模拟分析：
- 不接入真实交易
- 不允许真实下单
- 不包含登录功能
- 不包含支付功能
"""

from __future__ import annotations

from datetime import datetime
from math import sqrt
from typing import Any, Dict, List, Tuple

import akshare as ak
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def safe_number(value: Any, digits: int = 6) -> float | int | None:
    """安全转换数值，避免 NaN / inf 导致 JSON 序列化失败。"""
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


def safe_date_str(value: Any) -> str | None:
    """安全转换日期。"""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if value is pd.NaT:
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        if pd.isna(value):
            return None
        return value.strftime("%Y-%m-%d")
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return str(value)


def normalize_json_value(value: Any) -> Any:
    """递归转换为 JSON 兼容类型。"""
    if isinstance(value, dict):
        return {str(key): normalize_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_json_value(item) for item in value]
    if isinstance(value, tuple):
        return [normalize_json_value(item) for item in value]
    if isinstance(value, (pd.Timestamp, datetime)) or value is pd.NaT:
        return safe_date_str(value)
    if isinstance(value, (np.integer, int, np.floating, float)):
        return safe_number(value)
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return value


def dataframe_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """将 DataFrame 转成 JSON 兼容的记录列表。"""
    records = df.to_dict(orient="records")
    return [normalize_json_value(record) for record in records]


def build_mock_price_data(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """构造回退用模拟行情数据。"""
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    dates = pd.bdate_range(start=start, end=end)
    if len(dates) == 0:
        dates = pd.bdate_range(end=end, periods=120)

    base = np.linspace(100, 130, len(dates))
    seasonal = 3 * np.sin(np.arange(len(dates)) / 6)
    close = base + seasonal
    open_price = close * (1 + 0.002 * np.cos(np.arange(len(dates)) / 5))
    high = np.maximum(open_price, close) * 1.01
    low = np.minimum(open_price, close) * 0.99
    volume = 1_000_000 + (np.arange(len(dates)) % 10) * 50_000

    return pd.DataFrame(
        {
            "date": dates,
            "open": open_price,
            "close": close,
            "high": high,
            "low": low,
            "volume": volume,
        }
    )


def normalize_akshare_columns(df: pd.DataFrame) -> pd.DataFrame:
    """统一 AKShare 常见字段。"""
    column_map = {
        "日期": "date",
        "date": "date",
        "开盘": "open",
        "open": "open",
        "收盘": "close",
        "close": "close",
        "最高": "high",
        "high": "high",
        "最低": "low",
        "low": "low",
        "成交量": "volume",
        "volume": "volume",
    }

    renamed = df.rename(columns=column_map)
    required_columns = ["date", "open", "close", "high", "low", "volume"]
    missing = [column for column in required_columns if column not in renamed.columns]
    if missing:
        raise ValueError(f"行情字段缺失: {missing}")

    normalized = renamed[required_columns].copy()
    normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce")
    for column in ["open", "close", "high", "low", "volume"]:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce")
    normalized = normalized.dropna(subset=["date", "open", "close", "high", "low"])
    normalized = normalized.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
    return normalized


def get_price_data(symbol: str, start_date: str, end_date: str) -> Tuple[pd.DataFrame, str]:
    """优先通过 AKShare 获取数据，失败则回退模拟数据。"""
    try:
        start_tag = pd.to_datetime(start_date).strftime("%Y%m%d")
        end_tag = pd.to_datetime(end_date).strftime("%Y%m%d")
        raw_df = ak.stock_zh_a_hist(
            symbol=symbol,
            period="daily",
            start_date=start_tag,
            end_date=end_tag,
            adjust="qfq",
        )
        if raw_df is None or raw_df.empty:
            raise ValueError("AKShare 返回空数据")
        return normalize_akshare_columns(raw_df), "akshare"
    except Exception:
        return build_mock_price_data(symbol, start_date, end_date), "mock"


def apply_ma_strategy(df: pd.DataFrame, short_window: int = 5, long_window: int = 20) -> pd.DataFrame:
    """双均线策略。"""
    if short_window >= long_window:
        raise ValueError("short_window 必须小于 long_window")

    result = df.copy()
    result["ma_short"] = result["close"].rolling(short_window, min_periods=short_window).mean()
    result["ma_long"] = result["close"].rolling(long_window, min_periods=long_window).mean()
    buy_signal = (result["ma_short"] > result["ma_long"]) & (
        result["ma_short"].shift(1) <= result["ma_long"].shift(1)
    )
    sell_signal = (result["ma_short"] < result["ma_long"]) & (
        result["ma_short"].shift(1) >= result["ma_long"].shift(1)
    )
    result["signal"] = 0
    result.loc[buy_signal, "signal"] = 1
    result.loc[sell_signal, "signal"] = -1
    return result


def apply_momentum_strategy(df: pd.DataFrame, momentum_window: int = 10) -> pd.DataFrame:
    """动量策略。"""
    result = df.copy()
    result["momentum"] = result["close"].pct_change(momentum_window)
    result["signal"] = np.where(result["momentum"] > 0, 1, -1)
    return result


def apply_rsi_strategy(df: pd.DataFrame, rsi_window: int = 14) -> pd.DataFrame:
    """RSI 策略。"""
    result = df.copy()
    delta = result["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(rsi_window, min_periods=rsi_window).mean()
    avg_loss = loss.rolling(rsi_window, min_periods=rsi_window).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    result["rsi"] = 100 - (100 / (1 + rs))
    result["signal"] = 0
    result.loc[result["rsi"] < 30, "signal"] = 1
    result.loc[result["rsi"] > 70, "signal"] = -1
    return result


def generate_signals(price_df: pd.DataFrame, payload: Dict[str, Any]) -> pd.DataFrame:
    """根据策略名称生成交易信号。"""
    strategy = str(payload.get("strategy", "ma")).lower()
    if strategy == "ma":
        return apply_ma_strategy(
            price_df,
            short_window=int(payload.get("short_window", 5)),
            long_window=int(payload.get("long_window", 20)),
        )
    if strategy == "momentum":
        return apply_momentum_strategy(
            price_df,
            momentum_window=int(payload.get("momentum_window", 10)),
        )
    if strategy == "rsi":
        return apply_rsi_strategy(
            price_df,
            rsi_window=int(payload.get("rsi_window", 14)),
        )
    raise ValueError("未知策略类型，仅支持 ma、momentum、rsi")


def run_backtest(signal_df: pd.DataFrame, initial_cash: float = 100000) -> Tuple[pd.DataFrame, List[Dict[str, Any]], int]:
    """简单多头回测。"""
    result = signal_df.copy().sort_values("date").reset_index(drop=True)
    result["executed_signal"] = result["signal"].shift(1).fillna(0)

    cash = float(initial_cash)
    shares = 0.0
    position = 0
    trade_count = 0
    trades: List[Dict[str, Any]] = []
    open_trade: Dict[str, Any] | None = None

    positions = []
    total_values = []

    for _, row in result.iterrows():
        signal = int(row["executed_signal"])
        price = float(row["close"])

        if signal == 1 and position == 0 and price > 0:
            shares = cash / price
            cash = 0.0
            position = 1
            trade_count += 1
            open_trade = {
                "date": row["date"],
                "action": "buy",
                "price": price,
                "shares": shares,
            }
            trades.append(open_trade.copy())
        elif signal == -1 and position == 1 and shares > 0:
            cash = shares * price
            trade_count += 1
            trades.append(
                {
                    "date": row["date"],
                    "action": "sell",
                    "price": price,
                    "shares": shares,
                }
            )
            shares = 0.0
            position = 0
            open_trade = None

        total_value = cash + shares * price
        positions.append(position)
        total_values.append(total_value)

    result["position"] = positions
    result["total_value"] = total_values
    result["nav"] = result["total_value"] / float(initial_cash)
    result["daily_return"] = result["nav"].pct_change().fillna(0)
    return result, trades, trade_count


def calculate_metrics(result_df: pd.DataFrame, initial_cash: float, trade_count: int) -> Dict[str, Any]:
    """计算回测指标。"""
    final_value = float(result_df["total_value"].iloc[-1]) if not result_df.empty else float(initial_cash)
    total_return = final_value / float(initial_cash) - 1 if initial_cash else 0

    if not result_df.empty:
        days = max((result_df["date"].iloc[-1] - result_df["date"].iloc[0]).days, 1)
        annual_return = (1 + total_return) ** (365 / days) - 1
        rolling_max = result_df["nav"].cummax()
        drawdown = result_df["nav"] / rolling_max - 1
        max_drawdown = float(drawdown.min())
        daily_std = float(result_df["daily_return"].std(ddof=0))
        sharpe_ratio = 0.0 if daily_std == 0 else float((result_df["daily_return"].mean() / daily_std) * sqrt(252))
    else:
        annual_return = 0.0
        max_drawdown = 0.0
        sharpe_ratio = 0.0

    return {
        "final_value": safe_number(final_value, 4),
        "total_return": safe_number(total_return, 6),
        "annual_return": safe_number(annual_return, 6),
        "max_drawdown": safe_number(max_drawdown, 6),
        "sharpe_ratio": safe_number(sharpe_ratio, 6),
        "trade_count": int(trade_count),
    }


def validate_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """校验并补齐请求参数。"""
    if not isinstance(payload, dict):
        raise ValueError("请求体必须为 JSON 对象")

    validated = {
        "symbol": str(payload.get("symbol", "600519")).strip(),
        "strategy": str(payload.get("strategy", "ma")).strip().lower(),
        "start_date": str(payload.get("start_date", "2023-01-01")).strip(),
        "end_date": str(payload.get("end_date", "2024-12-31")).strip(),
        "short_window": int(payload.get("short_window", 5)),
        "long_window": int(payload.get("long_window", 20)),
        "momentum_window": int(payload.get("momentum_window", 10)),
        "rsi_window": int(payload.get("rsi_window", 14)),
        "initial_cash": float(payload.get("initial_cash", 100000)),
    }

    if not validated["symbol"]:
        raise ValueError("symbol 不能为空")
    return validated


@app.get("/")
def root() -> Any:
    """根路径接口。"""
    return jsonify(
        {
            "name": "AI Quant Backtest API",
            "version": "1.0.0",
            "status": "running",
            "endpoints": ["/health", "/api/backtest"],
        }
    )


@app.get("/health")
def health() -> Any:
    """健康检查接口。"""
    return jsonify(
        {
            "status": "ok",
            "message": "AI quant API is running",
            "service": "ai-quant-api",
        }
    )


@app.post("/api/backtest")
def api_backtest() -> Any:
    """回测接口。"""
    try:
        payload = validate_payload(request.get_json(silent=True) or {})
        price_df, data_source = get_price_data(payload["symbol"], payload["start_date"], payload["end_date"])
        signal_df = generate_signals(price_df, payload)
        result_df, trades, trade_count = run_backtest(signal_df, initial_cash=payload["initial_cash"])
        metrics = calculate_metrics(result_df, initial_cash=payload["initial_cash"], trade_count=trade_count)

        net_value_curve = [
            {
                "date": safe_date_str(row["date"]),
                "net_value": safe_number(row["nav"], 6),
            }
            for _, row in result_df[["date", "nav"]].iterrows()
        ]

        signals = [
            {
                "date": safe_date_str(row["date"]),
                "signal": safe_number(row["signal"], 0),
                "close": safe_number(row["close"], 4),
            }
            for _, row in signal_df[["date", "signal", "close"]].iterrows()
            if safe_number(row["signal"], 0) not in (0, None)
        ]

        response = {
            "symbol": payload["symbol"],
            "strategy": payload["strategy"],
            "start_date": payload["start_date"],
            "end_date": payload["end_date"],
            "initial_cash": safe_number(payload["initial_cash"], 2),
            "final_value": metrics["final_value"],
            "total_return": metrics["total_return"],
            "annual_return": metrics["annual_return"],
            "max_drawdown": metrics["max_drawdown"],
            "sharpe_ratio": metrics["sharpe_ratio"],
            "trade_count": metrics["trade_count"],
            "net_value_curve": net_value_curve,
            "signals": signals,
            "trades": normalize_json_value(trades),
            "data_source": data_source,
            "message": "回测执行成功",
        }
        return jsonify(normalize_json_value(response))
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 400
    except Exception as exc:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"回测执行失败: {exc}",
                }
            ),
            500,
        )


if __name__ == "__main__":
    # 本地调试默认使用 5000 端口；部署到 CloudBase 云托管时由 gunicorn 监听 80 端口。
    app.run(host="0.0.0.0", port=5000, debug=True)

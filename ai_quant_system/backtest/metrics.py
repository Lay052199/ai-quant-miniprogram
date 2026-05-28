"""回测指标计算模块。"""

from __future__ import annotations

import math
from typing import Dict

import numpy as np
import pandas as pd


def calculate_total_return(result_df: pd.DataFrame) -> float:
    """计算总收益率。"""
    if result_df.empty:
        return 0.0
    initial_value = float(result_df["total_value"].iloc[0])
    final_value = float(result_df["total_value"].iloc[-1])
    if initial_value == 0:
        return 0.0
    return final_value / initial_value - 1


def calculate_annual_return(result_df: pd.DataFrame) -> float:
    """计算年化收益率。"""
    if result_df.empty:
        return 0.0
    days = max((result_df["date"].iloc[-1] - result_df["date"].iloc[0]).days, 1)
    total_return = calculate_total_return(result_df)
    return (1 + total_return) ** (365 / days) - 1


def calculate_benchmark_return(result_df: pd.DataFrame) -> float:
    """计算基准总收益率。"""
    if result_df.empty or "benchmark_nav" not in result_df.columns:
        return 0.0
    return float(result_df["benchmark_nav"].iloc[-1] - 1)


def calculate_excess_return(result_df: pd.DataFrame) -> float:
    """计算超额收益率。"""
    return calculate_total_return(result_df) - calculate_benchmark_return(result_df)


def calculate_max_drawdown(result_df: pd.DataFrame) -> float:
    """计算最大回撤。"""
    if result_df.empty:
        return 0.0
    nav = result_df["total_value"].astype(float)
    rolling_max = nav.cummax()
    drawdown = nav / rolling_max - 1
    return float(drawdown.min())


def calculate_sharpe_ratio(result_df: pd.DataFrame, risk_free_rate: float = 0.02) -> float:
    """计算年化夏普比率。"""
    if result_df.empty:
        return 0.0
    returns = result_df["strategy_return"].astype(float).fillna(0)
    if returns.std(ddof=0) == 0:
        return 0.0
    excess_daily_return = returns.mean() - risk_free_rate / 252
    sharpe = excess_daily_return / returns.std(ddof=0) * math.sqrt(252)
    if np.isnan(sharpe) or np.isinf(sharpe):
        return 0.0
    return float(sharpe)


def calculate_volatility(result_df: pd.DataFrame) -> float:
    """计算年化波动率。"""
    if result_df.empty:
        return 0.0
    returns = result_df["strategy_return"].astype(float).fillna(0)
    return float(returns.std(ddof=0) * math.sqrt(252))


def calculate_win_rate(trades_df: pd.DataFrame) -> float:
    """计算胜率。"""
    if trades_df.empty or "sell_date" not in trades_df.columns:
        return 0.0
    closed_trades = trades_df.dropna(subset=["sell_date"])
    if closed_trades.empty:
        return 0.0
    return float((closed_trades["profit"] > 0).mean())


def calculate_trade_count(trades_df: pd.DataFrame) -> int:
    """计算交易次数。"""
    if trades_df.empty:
        return 0
    return int(len(trades_df.dropna(subset=["buy_date"])))


def calculate_metrics(result_df: pd.DataFrame, trades_df: pd.DataFrame) -> Dict[str, float]:
    """汇总核心回测指标。"""
    initial_capital = float(result_df["total_value"].iloc[0]) if not result_df.empty else 0.0
    final_capital = float(result_df["total_value"].iloc[-1]) if not result_df.empty else 0.0

    return {
        "总收益率": calculate_total_return(result_df),
        "基准收益率": calculate_benchmark_return(result_df),
        "超额收益率": calculate_excess_return(result_df),
        "年化收益率": calculate_annual_return(result_df),
        "最大回撤": calculate_max_drawdown(result_df),
        "夏普比率": calculate_sharpe_ratio(result_df),
        "年化波动率": calculate_volatility(result_df),
        "交易次数": calculate_trade_count(trades_df),
        "胜率": calculate_win_rate(trades_df),
        "最终资产": final_capital,
        "初始资金": initial_capital,
    }

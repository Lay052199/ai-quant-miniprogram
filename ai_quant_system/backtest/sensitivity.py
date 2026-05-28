"""参数敏感性分析模块。"""

from __future__ import annotations

from typing import Iterable, List

import pandas as pd

from backtest.engine import run_backtest
from backtest.metrics import calculate_metrics
from strategy.ma_strategy import generate_ma_signal


def analyze_ma_parameter_sensitivity(
    df: pd.DataFrame,
    short_windows: Iterable[int],
    long_windows: Iterable[int],
    benchmark_df: pd.DataFrame | None = None,
    initial_cash: float = 100000,
    commission_rate: float = 0.0003,
    slippage_rate: float = 0.0002,
) -> pd.DataFrame:
    """分析双均线参数组合的回测表现。"""
    rows: List[dict] = []

    for short_window in short_windows:
        for long_window in long_windows:
            if short_window >= long_window:
                continue

            signal_df = generate_ma_signal(df, short_window=short_window, long_window=long_window)
            result_df, trades_df = run_backtest(
                signal_df,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                benchmark_df=benchmark_df,
            )
            metrics = calculate_metrics(result_df, trades_df)
            rows.append(
                {
                    "short_window": short_window,
                    "long_window": long_window,
                    "总收益率": metrics["总收益率"],
                    "超额收益率": metrics["超额收益率"],
                    "年化收益率": metrics["年化收益率"],
                    "最大回撤": metrics["最大回撤"],
                    "夏普比率": metrics["夏普比率"],
                    "交易次数": metrics["交易次数"],
                }
            )

    if not rows:
        return pd.DataFrame(
            columns=["short_window", "long_window", "总收益率", "超额收益率", "年化收益率", "最大回撤", "夏普比率", "交易次数"]
        )

    return pd.DataFrame(rows).sort_values(["超额收益率", "总收益率"], ascending=[False, False]).reset_index(drop=True)

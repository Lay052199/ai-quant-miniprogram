"""双均线策略。"""

from __future__ import annotations

import numpy as np
import pandas as pd


def generate_ma_signal(df: pd.DataFrame, short_window: int = 5, long_window: int = 20) -> pd.DataFrame:
    """生成双均线交易信号。

    参数:
        df: 至少包含 close 列的行情数据。
        short_window: 短期均线窗口。
        long_window: 长期均线窗口。

    返回:
        pandas.DataFrame: 包含均线、信号和持仓状态的数据。
    """
    if "close" not in df.columns:
        raise ValueError("双均线策略需要 close 列。")
    if short_window >= long_window:
        raise ValueError("short_window 必须小于 long_window。")

    strategy_df = df.copy()
    strategy_df["ma_short"] = strategy_df["close"].rolling(window=short_window, min_periods=short_window).mean()
    strategy_df["ma_long"] = strategy_df["close"].rolling(window=long_window, min_periods=long_window).mean()

    prev_short = strategy_df["ma_short"].shift(1)
    prev_long = strategy_df["ma_long"].shift(1)
    current_short = strategy_df["ma_short"]
    current_long = strategy_df["ma_long"]

    buy_condition = (current_short > current_long) & (prev_short <= prev_long)
    sell_condition = (current_short < current_long) & (prev_short >= prev_long)

    strategy_df["signal"] = 0
    strategy_df.loc[buy_condition, "signal"] = 1
    strategy_df.loc[sell_condition, "signal"] = -1

    state = 0
    positions = []
    for signal in strategy_df["signal"].fillna(0):
        if signal == 1:
            state = 1
        elif signal == -1:
            state = 0
        positions.append(state)

    strategy_df["position"] = positions
    return strategy_df

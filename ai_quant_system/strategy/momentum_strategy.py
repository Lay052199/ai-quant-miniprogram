"""动量策略。"""

from __future__ import annotations

import pandas as pd


def generate_momentum_signal(df: pd.DataFrame, window: int = 20, threshold: float = 0) -> pd.DataFrame:
    """生成简单动量策略信号。

    参数:
        df: 至少包含 close 列的行情数据。
        window: 回看窗口。
        threshold: 动量阈值。

    返回:
        pandas.DataFrame: 包含动量、信号和持仓状态的数据。
    """
    if "close" not in df.columns:
        raise ValueError("动量策略需要 close 列。")

    strategy_df = df.copy()
    strategy_df["momentum"] = strategy_df["close"].pct_change(periods=window)
    strategy_df["signal"] = 0
    strategy_df.loc[strategy_df["momentum"] > threshold, "signal"] = 1
    strategy_df.loc[strategy_df["momentum"] < -threshold, "signal"] = -1

    position_state = 0
    positions = []
    for signal in strategy_df["signal"].fillna(0):
        if signal == 1:
            position_state = 1
        elif signal == -1:
            position_state = 0
        positions.append(position_state)

    strategy_df["position"] = positions
    return strategy_df

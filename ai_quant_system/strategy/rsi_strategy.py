"""RSI 策略。"""

from __future__ import annotations

import pandas as pd


def generate_rsi_signal(
    df: pd.DataFrame,
    window: int = 14,
    lower: float = 30,
    upper: float = 70,
) -> pd.DataFrame:
    """生成 RSI 交易信号。

    参数:
        df: 至少包含 close 列的行情数据。
        window: RSI 计算窗口。
        lower: 超卖阈值。
        upper: 超买阈值。

    返回:
        pandas.DataFrame: 包含 RSI、信号和持仓状态的数据。
    """
    if "close" not in df.columns:
        raise ValueError("RSI 策略需要 close 列。")

    strategy_df = df.copy()
    delta = strategy_df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=window, min_periods=window).mean()
    avg_loss = loss.rolling(window=window, min_periods=window).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    strategy_df["rsi"] = 100 - (100 / (1 + rs))
    strategy_df["rsi"] = strategy_df["rsi"].fillna(50)

    strategy_df["signal"] = 0
    strategy_df.loc[strategy_df["rsi"] < lower, "signal"] = 1
    strategy_df.loc[strategy_df["rsi"] > upper, "signal"] = -1

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

"""数据清洗模块。"""

from __future__ import annotations

import pandas as pd


def clean_price_data(df: pd.DataFrame) -> pd.DataFrame:
    """清洗行情数据并返回可用于回测的结果。

    参数:
        df: 原始或已标准化的行情数据。

    返回:
        pandas.DataFrame: 清洗后的行情数据。
    """
    required_columns = [
        "date",
        "open",
        "close",
        "high",
        "low",
        "volume",
        "amount",
    ]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(f"行情数据缺少必要字段: {missing_columns}")

    cleaned_df = df.copy()
    cleaned_df["date"] = pd.to_datetime(cleaned_df["date"], errors="coerce")

    numeric_columns = ["open", "close", "high", "low", "volume", "amount"]
    for column in numeric_columns:
        cleaned_df[column] = pd.to_numeric(cleaned_df[column], errors="coerce")

    cleaned_df = cleaned_df.dropna(subset=["date", "open", "close", "high", "low"])
    cleaned_df = cleaned_df.sort_values("date").reset_index(drop=True)
    return cleaned_df

"""FastAPI 接口序列化测试。"""

from __future__ import annotations

import numpy as np
import pandas as pd

from api_server import dataframe_to_records, metrics_to_python, safe_date_to_str


def test_safe_date_to_str_handles_nat() -> None:
    """测试 NaT 日期安全转换。"""
    assert safe_date_to_str(pd.NaT) is None
    assert safe_date_to_str(None) is None
    assert safe_date_to_str("2024-01-01") == "2024-01-01"


def test_dataframe_to_records_handles_open_trade_sell_date() -> None:
    """测试未平仓交易中的空卖出日期可正常序列化。"""
    trades_df = pd.DataFrame(
        {
            "buy_date": [pd.Timestamp("2024-01-02")],
            "sell_date": [pd.NaT],
            "buy_signal_date": [pd.Timestamp("2024-01-01")],
            "sell_signal_date": [pd.NaT],
            "shares": [1000],
            "holding_days": [5],
        }
    )
    records = dataframe_to_records(trades_df)
    assert records[0]["buy_date"] == "2024-01-02"
    assert records[0]["sell_date"] is None
    assert records[0]["sell_signal_date"] is None
    assert records[0]["holding_days"] == 5


def test_metrics_to_python_handles_numpy_values() -> None:
    """测试 numpy 指标值可正常转换。"""
    metrics = {"总收益率": np.float64(0.1), "交易次数": np.int64(3)}
    converted = metrics_to_python(metrics)
    assert isinstance(converted["总收益率"], float)
    assert isinstance(converted["交易次数"], int)

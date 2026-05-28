"""回测指标与防未来函数测试。"""

from __future__ import annotations

import pandas as pd

from backtest.engine import run_backtest
from backtest.metrics import calculate_max_drawdown, calculate_sharpe_ratio, calculate_total_return


def build_result_df() -> pd.DataFrame:
    """构造测试用资金曲线。"""
    return pd.DataFrame(
        {
            "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"]),
            "total_value": [100000, 110000, 99000, 120000],
            "strategy_return": [0.0, 0.1, -0.1, 0.212121],
            "benchmark_nav": [1.0, 1.01, 0.99, 1.03],
        }
    )


def test_calculate_max_drawdown() -> None:
    """测试最大回撤。"""
    result_df = build_result_df()
    max_drawdown = calculate_max_drawdown(result_df)
    assert round(max_drawdown, 2) == -0.10


def test_calculate_total_return() -> None:
    """测试总收益率。"""
    result_df = build_result_df()
    total_return = calculate_total_return(result_df)
    assert round(total_return, 2) == 0.20


def test_calculate_sharpe_ratio_no_error() -> None:
    """测试夏普比率函数可正常执行。"""
    result_df = build_result_df()
    sharpe_ratio = calculate_sharpe_ratio(result_df)
    assert isinstance(sharpe_ratio, float)


def test_run_backtest_uses_next_day_execution() -> None:
    """测试信号必须下一交易日执行，防止未来函数。"""
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
            "close": [10.0, 20.0, 30.0],
            "signal": [1, 0, -1],
        }
    )
    benchmark_df = pd.DataFrame(
        {
            "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
            "close": [100.0, 101.0, 102.0],
        }
    )

    result_df, trades_df = run_backtest(
        df,
        initial_cash=100000,
        commission_rate=0.0,
        slippage_rate=0.0,
        benchmark_df=benchmark_df,
    )

    assert result_df.loc[0, "executed_signal"] == 0
    assert result_df.loc[0, "position"] == 0
    assert result_df.loc[1, "executed_signal"] == 1
    assert result_df.loc[1, "position"] == 1
    assert not trades_df.empty
    assert trades_df.loc[0, "buy_date"] == pd.Timestamp("2024-01-02")

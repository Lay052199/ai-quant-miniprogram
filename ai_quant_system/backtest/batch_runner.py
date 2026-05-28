"""多股票批量回测模块。"""

from __future__ import annotations

from typing import Callable, Dict, List, Tuple

import pandas as pd

from backtest.engine import run_backtest
from backtest.metrics import calculate_metrics
from data.akshare_loader import get_a_stock_daily
from data.data_cleaner import clean_price_data


def parse_symbols(symbols_text: str) -> List[str]:
    """解析英文逗号分隔的股票代码。"""
    symbols = [item.strip() for item in symbols_text.split(",")]
    return [symbol for symbol in symbols if symbol]


def run_batch_backtest(
    symbols: List[str],
    strategy_func: Callable[[pd.DataFrame], pd.DataFrame],
    benchmark_df: pd.DataFrame,
    start_date: str,
    end_date: str,
    adjust: str,
    initial_cash: float,
    commission_rate: float,
    slippage_rate: float,
) -> Tuple[pd.DataFrame, Dict[str, dict]]:
    """对多只股票执行同一策略回测并汇总排行榜数据。"""
    leaderboard_rows: List[Dict[str, object]] = []
    details: Dict[str, dict] = {}

    for symbol in symbols:
        try:
            raw_df = get_a_stock_daily(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                adjust=adjust,
                use_cache=True,
            )
            clean_df = clean_price_data(raw_df)
            signal_df = strategy_func(clean_df)
            result_df, trades_df = run_backtest(
                signal_df,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                benchmark_df=benchmark_df,
            )
            metrics = calculate_metrics(result_df, trades_df)

            leaderboard_rows.append(
                {
                    "股票代码": symbol,
                    "总收益率": metrics["总收益率"],
                    "年化收益率": metrics["年化收益率"],
                    "最大回撤": metrics["最大回撤"],
                    "夏普比率": metrics["夏普比率"],
                    "胜率": metrics["胜率"],
                    "交易次数": metrics["交易次数"],
                }
            )

            details[symbol] = {
                "raw_df": raw_df,
                "clean_df": clean_df,
                "signal_df": signal_df,
                "result_df": result_df,
                "trades_df": trades_df,
                "metrics": metrics,
                "error": None,
            }
        except Exception as exc:
            leaderboard_rows.append(
                {
                    "股票代码": symbol,
                    "总收益率": None,
                    "年化收益率": None,
                    "最大回撤": None,
                    "夏普比率": None,
                    "胜率": None,
                    "交易次数": None,
                    "错误信息": str(exc),
                }
            )
            details[symbol] = {"error": str(exc)}

    leaderboard_df = pd.DataFrame(leaderboard_rows)
    return leaderboard_df, details

"""回测引擎。"""

from __future__ import annotations

from typing import Dict, List, Tuple

import pandas as pd


def run_backtest(
    df: pd.DataFrame,
    initial_cash: float = 100000,
    commission_rate: float = 0.0003,
    slippage_rate: float = 0.0002,
    benchmark_df: pd.DataFrame | None = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """执行单标的历史回测。

    规则说明:
        - 使用前一日产生的信号，在下一交易日执行。
        - signal=1 全仓买入，signal=-1 全仓卖出。
        - 仅允许做多，不允许做空。

    参数:
        df: 至少包含 date、close、signal。
        initial_cash: 初始资金。
        commission_rate: 手续费率。
        slippage_rate: 滑点率。
        benchmark_df: 基准指数行情数据，至少包含 date 和 close。

    返回:
        result_df: 每日资金曲线与执行记录。
        trades_df: 每笔交易记录。
    """
    required_columns = ["date", "close", "signal"]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(f"回测数据缺少必要字段: {missing_columns}")

    result_df = df.copy().sort_values("date").reset_index(drop=True)
    result_df["date"] = pd.to_datetime(result_df["date"], errors="coerce")
    result_df["close"] = pd.to_numeric(result_df["close"], errors="coerce")
    result_df = result_df.dropna(subset=["date", "close"])
    result_df["signal"] = pd.to_numeric(result_df["signal"], errors="coerce").fillna(0).astype(int)
    result_df["executed_signal"] = result_df["signal"].shift(1).fillna(0).astype(int)

    if benchmark_df is not None and not benchmark_df.empty:
        benchmark_clean = benchmark_df[["date", "close"]].copy()
        benchmark_clean["date"] = pd.to_datetime(benchmark_clean["date"], errors="coerce")
        benchmark_clean["close"] = pd.to_numeric(benchmark_clean["close"], errors="coerce")
        benchmark_clean = benchmark_clean.dropna(subset=["date", "close"]).sort_values("date")
        benchmark_clean = benchmark_clean.rename(columns={"close": "benchmark_close"})
        result_df = result_df.merge(benchmark_clean, on="date", how="left")
    else:
        result_df["benchmark_close"] = result_df["close"]

    result_df["benchmark_close"] = result_df["benchmark_close"].ffill().bfill()

    cash = float(initial_cash)
    shares = 0
    position = 0
    open_trade = None
    trades: List[Dict[str, object]] = []

    cash_history = []
    holdings_history = []
    total_value_history = []
    position_history = []
    trade_flags = []

    previous_total_value = float(initial_cash)
    strategy_returns = []
    benchmark_returns = result_df["benchmark_close"].pct_change().fillna(0)

    for idx, row in enumerate(result_df.itertuples(index=False)):
        executed_signal = int(row.executed_signal)
        close_price = float(row.close)
        trade_flag = 0

        if executed_signal == 1 and position == 0:
            buy_price = close_price * (1 + slippage_rate)
            max_shares = int(cash / (buy_price * (1 + commission_rate)))
            if max_shares > 0:
                trade_amount = max_shares * buy_price
                commission = trade_amount * commission_rate
                cash -= trade_amount + commission
                shares = max_shares
                position = 1
                trade_flag = 1
                open_trade = {
                    "buy_date": row.date,
                    "buy_price": buy_price,
                    "shares": shares,
                    "buy_signal_date": result_df.iloc[idx - 1]["date"] if idx > 0 else pd.NaT,
                }

        elif executed_signal == -1 and position == 1 and shares > 0:
            sell_price = close_price * (1 - slippage_rate)
            trade_amount = shares * sell_price
            commission = trade_amount * commission_rate
            cash += trade_amount - commission
            profit = (sell_price - open_trade["buy_price"]) * shares - (
                open_trade["buy_price"] * shares * commission_rate
            ) - commission
            return_rate = profit / (open_trade["buy_price"] * shares) if shares > 0 else 0
            holding_days = (row.date - open_trade["buy_date"]).days
            trades.append(
                {
                    "buy_date": open_trade["buy_date"],
                    "buy_signal_date": open_trade.get("buy_signal_date"),
                    "buy_price": round(open_trade["buy_price"], 4),
                    "sell_date": row.date,
                    "sell_signal_date": result_df.iloc[idx - 1]["date"] if idx > 0 else pd.NaT,
                    "sell_price": round(sell_price, 4),
                    "shares": shares,
                    "profit": round(profit, 4),
                    "return_rate": round(return_rate, 6),
                    "holding_days": holding_days,
                }
            )
            shares = 0
            position = 0
            open_trade = None
            trade_flag = -1

        holdings = shares * close_price
        total_value = cash + holdings
        daily_return = (total_value / previous_total_value - 1) if previous_total_value else 0

        cash_history.append(round(cash, 4))
        holdings_history.append(round(holdings, 4))
        total_value_history.append(round(total_value, 4))
        position_history.append(position)
        trade_flags.append(trade_flag)
        strategy_returns.append(daily_return)

        previous_total_value = total_value

    if open_trade is not None and shares > 0:
        final_close = float(result_df.iloc[-1]["close"])
        unrealized_profit = (final_close - open_trade["buy_price"]) * shares - (
            open_trade["buy_price"] * shares * commission_rate
        )
        unrealized_return = unrealized_profit / (open_trade["buy_price"] * shares) if shares > 0 else 0
        holding_days = (result_df.iloc[-1]["date"] - open_trade["buy_date"]).days
        trades.append(
            {
                "buy_date": open_trade["buy_date"],
                "buy_signal_date": open_trade.get("buy_signal_date"),
                "buy_price": round(open_trade["buy_price"], 4),
                "sell_date": pd.NaT,
                "sell_signal_date": pd.NaT,
                "sell_price": None,
                "shares": shares,
                "profit": round(unrealized_profit, 4),
                "return_rate": round(unrealized_return, 6),
                "holding_days": holding_days,
            }
        )

    result_df["position"] = position_history
    result_df["cash"] = cash_history
    result_df["holdings"] = holdings_history
    result_df["total_value"] = total_value_history
    result_df["strategy_return"] = pd.Series(strategy_returns).fillna(0)
    result_df["benchmark_return"] = benchmark_returns
    result_df["strategy_nav"] = result_df["total_value"] / float(initial_cash) if initial_cash else 0
    result_df["benchmark_nav"] = (1 + result_df["benchmark_return"]).cumprod()
    excess_base = result_df["benchmark_nav"].replace(0, pd.NA)
    result_df["excess_nav"] = (result_df["strategy_nav"] / excess_base).astype("float64")
    result_df["excess_nav"] = result_df["excess_nav"].ffill().fillna(1.0)
    result_df["excess_return"] = result_df["strategy_return"] - result_df["benchmark_return"]
    result_df["drawdown"] = result_df["strategy_nav"] / result_df["strategy_nav"].cummax() - 1
    result_df["trade_flag"] = trade_flags
    result_df["buy_marker"] = result_df["close"].where(result_df["trade_flag"] == 1)
    result_df["sell_marker"] = result_df["close"].where(result_df["trade_flag"] == -1)

    trades_df = pd.DataFrame(
        trades,
        columns=[
            "buy_date",
            "buy_signal_date",
            "buy_price",
            "sell_date",
            "sell_signal_date",
            "sell_price",
            "shares",
            "profit",
            "return_rate",
            "holding_days",
        ],
    )
    return result_df, trades_df

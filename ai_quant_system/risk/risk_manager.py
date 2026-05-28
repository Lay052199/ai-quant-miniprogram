"""基础风险评估模块。"""

from __future__ import annotations

from typing import List

import pandas as pd

from backtest.metrics import calculate_max_drawdown


def check_max_drawdown(result_df: pd.DataFrame, max_drawdown_limit: float = 0.2) -> str:
    """检查最大回撤是否超限。"""
    max_drawdown = abs(calculate_max_drawdown(result_df))
    if max_drawdown > max_drawdown_limit:
        return f"最大回撤为 {max_drawdown:.2%}，已超过阈值 {max_drawdown_limit:.2%}。"
    return f"最大回撤为 {max_drawdown:.2%}，未超过阈值 {max_drawdown_limit:.2%}。"


def check_single_trade_loss(trades_df: pd.DataFrame, loss_limit: float = 0.05) -> str:
    """检查是否存在单笔大额亏损。"""
    if trades_df.empty:
        return "暂无交易记录，无法评估单笔亏损风险。"

    heavy_loss = trades_df[trades_df["return_rate"] < -loss_limit]
    if heavy_loss.empty:
        return f"未发现单笔亏损超过 {loss_limit:.2%} 的交易。"
    return f"发现 {len(heavy_loss)} 笔交易亏损超过 {loss_limit:.2%}，需要重点复盘。"


def generate_risk_report(result_df: pd.DataFrame, trades_df: pd.DataFrame) -> List[str]:
    """生成文字型风险提示。"""
    report = [
        check_max_drawdown(result_df),
        check_single_trade_loss(trades_df),
    ]

    trade_count = len(trades_df.dropna(subset=["buy_date"])) if not trades_df.empty else 0
    if trade_count > 50:
        report.append(f"交易次数为 {trade_count} 次，换手较高，需关注手续费侵蚀。")
    else:
        report.append(f"交易次数为 {trade_count} 次，频率处于可控范围。")

    if not result_df.empty:
        empty_position_streak = (result_df["position"] == 0).astype(int)
        max_idle_days = int(
            empty_position_streak.groupby((empty_position_streak != empty_position_streak.shift()).cumsum()).sum().max()
        )
        if max_idle_days > 60:
            report.append(f"最长连续空仓约 {max_idle_days} 个交易日，策略可能存在较长等待期。")
        else:
            report.append(f"最长连续空仓约 {max_idle_days} 个交易日，资金利用率尚可。")
    else:
        report.append("结果数据为空，无法评估空仓时长。")

    return report

"""回测结果导出模块。"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from config import OUTPUT_PATH


def _safe_name(value: str) -> str:
    """将名称转换为适合文件名的文本。"""
    return value.replace(" ", "_").replace("/", "_")


def export_backtest_result(
    result_df: pd.DataFrame,
    trades_df: pd.DataFrame,
    metrics: Dict[str, float],
    symbol: str,
    strategy_name: str,
) -> Path:
    """导出回测结果 Excel。"""
    file_path = OUTPUT_PATH / f"backtest_{symbol}_{_safe_name(strategy_name)}.xlsx"
    metrics_df = pd.DataFrame({"指标": list(metrics.keys()), "数值": list(metrics.values())})

    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        result_df.to_excel(writer, sheet_name="回测结果", index=False)
        trades_df.to_excel(writer, sheet_name="交易明细", index=False)
        metrics_df.to_excel(writer, sheet_name="核心指标", index=False)

    return file_path


def export_trades_detail(
    trades_df: pd.DataFrame,
    symbol: str,
    strategy_name: str,
) -> Path:
    """导出交易明细 Excel。"""
    file_path = OUTPUT_PATH / f"trades_{symbol}_{_safe_name(strategy_name)}.xlsx"
    trades_df.to_excel(file_path, index=False, engine="openpyxl")
    return file_path


def export_sensitivity_result(
    sensitivity_df: pd.DataFrame,
    symbol: str,
    strategy_name: str,
) -> Optional[Path]:
    """导出参数敏感性分析结果。"""
    if sensitivity_df.empty:
        return None

    file_path = OUTPUT_PATH / f"sensitivity_{symbol}_{_safe_name(strategy_name)}.xlsx"
    sensitivity_df.to_excel(file_path, index=False, engine="openpyxl")
    return file_path


def export_batch_backtest_result(
    leaderboard_df: pd.DataFrame,
    strategy_name: str,
    start_date: str,
    end_date: str,
) -> Path:
    """导出批量回测排行榜结果。"""
    file_path = OUTPUT_PATH / f"batch_backtest_{_safe_name(strategy_name)}_{start_date}_{end_date}.xlsx"
    leaderboard_df.to_excel(file_path, index=False, engine="openpyxl")
    return file_path

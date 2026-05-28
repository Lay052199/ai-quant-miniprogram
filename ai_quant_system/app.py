"""Streamlit 应用入口。"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Dict, Iterable

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from backtest.batch_runner import parse_symbols, run_batch_backtest
from backtest.exporter import (
    export_batch_backtest_result,
    export_backtest_result,
    export_sensitivity_result,
    export_trades_detail,
)
from backtest.sensitivity import analyze_ma_parameter_sensitivity
from config import BENCHMARK, COMMISSION_RATE, INITIAL_CASH, SLIPPAGE_RATE
from data.akshare_loader import get_index_daily
from report.report_generator import generate_text_report
from risk.risk_manager import generate_risk_report
from strategy.ma_strategy import generate_ma_signal
from strategy.momentum_strategy import generate_momentum_signal
from strategy.rsi_strategy import generate_rsi_signal


def configure_matplotlib() -> None:
    """设置 matplotlib 中文字体兼容。"""
    plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def inject_mobile_styles() -> None:
    """注入移动端友好的页面样式。"""
    st.markdown(
        """
        <style>
        .block-container {
            padding-top: 1.2rem;
            padding-bottom: 3rem;
            padding-left: 1rem;
            padding-right: 1rem;
            max-width: 1200px;
        }
        .mobile-panel {
            background: linear-gradient(145deg, #f7f4ea 0%, #ffffff 100%);
            border: 1px solid rgba(179, 146, 74, 0.18);
            border-radius: 18px;
            padding: 1rem 1rem 0.5rem 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 12px 30px rgba(68, 56, 30, 0.08);
        }
        .summary-card {
            background: #ffffff;
            border: 1px solid rgba(20, 28, 58, 0.08);
            border-radius: 16px;
            padding: 0.9rem 1rem;
            box-shadow: 0 8px 24px rgba(21, 35, 60, 0.06);
            min-height: 108px;
        }
        .summary-card-label {
            font-size: 0.85rem;
            color: #6b7280;
            margin-bottom: 0.35rem;
        }
        .summary-card-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.2;
        }
        .summary-card-sub {
            font-size: 0.8rem;
            color: #64748b;
            margin-top: 0.35rem;
        }
        .section-note {
            color: #475569;
            font-size: 0.95rem;
            margin-bottom: 0.6rem;
        }
        .report-box {
            background: #fcfcfd;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 16px;
            padding: 1rem;
            white-space: pre-wrap;
            line-height: 1.75;
            font-size: 0.95rem;
        }
        .table-scroll {
            overflow-x: auto;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 16px;
            padding: 0.35rem;
            background: #fff;
        }
        @media (max-width: 768px) {
            .block-container {
                padding-left: 0.75rem;
                padding-right: 0.75rem;
            }
            .summary-card {
                min-height: 94px;
            }
            .summary-card-value {
                font-size: 1.25rem;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def build_strategy_map() -> Dict[str, Callable[[pd.DataFrame], pd.DataFrame]]:
    """构建策略名称与函数映射。"""
    return {
        "双均线策略": lambda df: generate_ma_signal(df, short_window=5, long_window=20),
        "动量策略": lambda df: generate_momentum_signal(df, window=20, threshold=0),
        "RSI 策略": lambda df: generate_rsi_signal(df, window=14, lower=30, upper=70),
    }


def format_metrics(metrics: Dict[str, float]) -> pd.DataFrame:
    """格式化核心指标表。"""
    ratio_keys = {"总收益率", "基准收益率", "超额收益率", "年化收益率", "最大回撤", "胜率", "年化波动率"}
    number_keys = {"最终资产", "初始资金"}
    formatted_values = []

    for key, value in metrics.items():
        if key in ratio_keys:
            formatted_values.append(f"{value:.2%}")
        elif key == "夏普比率":
            formatted_values.append(f"{value:.4f}")
        elif key in number_keys:
            formatted_values.append(f"{value:,.2f}")
        else:
            formatted_values.append(value)

    return pd.DataFrame({"指标": list(metrics.keys()), "数值": formatted_values})


def format_leaderboard(leaderboard_df: pd.DataFrame) -> pd.DataFrame:
    """格式化排行榜表格。"""
    display_df = leaderboard_df.copy()
    for column in ["总收益率", "年化收益率", "最大回撤", "胜率"]:
        if column in display_df.columns:
            display_df[column] = display_df[column].apply(lambda x: f"{x:.2%}" if pd.notna(x) else "")
    if "夏普比率" in display_df.columns:
        display_df["夏普比率"] = display_df["夏普比率"].apply(lambda x: f"{x:.4f}" if pd.notna(x) else "")
    return display_df


def format_metric_value(metric_name: str, value: float) -> str:
    """格式化单个指标值。"""
    if metric_name in {"总收益率", "基准收益率", "超额收益率", "年化收益率", "最大回撤", "胜率", "年化波动率"}:
        return f"{value:.2%}"
    if metric_name == "夏普比率":
        return f"{value:.4f}"
    if metric_name in {"最终资产", "初始资金"}:
        return f"{value:,.2f}"
    return str(value)


def sort_leaderboard(leaderboard_df: pd.DataFrame, sort_by: str) -> pd.DataFrame:
    """按指定指标排序排行榜。"""
    if leaderboard_df.empty or sort_by not in leaderboard_df.columns:
        return leaderboard_df

    sorted_df = leaderboard_df.copy()
    if sort_by == "最大回撤":
        sorted_df["_sort_value"] = sorted_df[sort_by].abs()
        sorted_df = sorted_df.sort_values(by="_sort_value", ascending=True, na_position="last").drop(columns="_sort_value")
    else:
        sorted_df = sorted_df.sort_values(by=sort_by, ascending=False, na_position="last")
    sorted_df = sorted_df.reset_index(drop=True)
    return sorted_df


def plot_nav_chart(result_df: pd.DataFrame) -> plt.Figure:
    """绘制策略、基准和超额净值曲线。"""
    fig, ax = plt.subplots(figsize=(10, 4.8))
    ax.plot(result_df["date"], result_df["strategy_nav"], label="策略净值", linewidth=2, color="#1f77b4")
    ax.plot(result_df["date"], result_df["benchmark_nav"], label="基准净值", linewidth=2, color="#ff7f0e")
    ax.plot(result_df["date"], result_df["excess_nav"], label="超额净值", linewidth=1.6, color="#2ca02c")
    ax.set_title("策略、基准与超额净值曲线")
    ax.set_xlabel("日期")
    ax.set_ylabel("净值")
    ax.legend(loc="best", fontsize=9)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


def plot_drawdown_chart(result_df: pd.DataFrame) -> plt.Figure:
    """绘制回撤曲线。"""
    fig, ax = plt.subplots(figsize=(10, 3.8))
    ax.fill_between(result_df["date"], result_df["drawdown"], 0, color="#d62728", alpha=0.3, label="回撤")
    ax.plot(result_df["date"], result_df["drawdown"], color="#d62728", linewidth=1.5)
    ax.set_title("策略回撤曲线")
    ax.set_xlabel("日期")
    ax.set_ylabel("回撤")
    ax.legend(loc="best", fontsize=9)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


def plot_trade_points_chart(result_df: pd.DataFrame, symbol: str, strategy_name: str) -> plt.Figure:
    """绘制买卖点标记图。"""
    fig, ax = plt.subplots(figsize=(10, 4.2))
    ax.plot(result_df["date"], result_df["close"], label="收盘价", linewidth=1.8, color="#1f77b4")
    buy_df = result_df[result_df["trade_flag"] == 1]
    sell_df = result_df[result_df["trade_flag"] == -1]
    if not buy_df.empty:
        ax.scatter(buy_df["date"], buy_df["close"], marker="^", color="#d62728", s=60, label="买点")
    if not sell_df.empty:
        ax.scatter(sell_df["date"], sell_df["close"], marker="v", color="#2ca02c", s=60, label="卖点")
    ax.set_title(f"{symbol} {strategy_name} 买卖点标记图")
    ax.set_xlabel("日期")
    ax.set_ylabel("价格")
    ax.legend(loc="best", fontsize=9)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


def build_sensitivity_ranges() -> tuple[Iterable[int], Iterable[int]]:
    """生成默认双均线敏感性分析参数范围。"""
    short_windows = [3, 5, 8, 10]
    long_windows = [15, 20, 30, 60]
    return short_windows, long_windows


def render_metric_cards(metrics: Dict[str, float]) -> None:
    """以卡片形式展示核心指标。"""
    cards = [
        ("总收益率", metrics.get("总收益率", 0.0), "收益表现"),
        ("年化收益率", metrics.get("年化收益率", 0.0), "折算到年化口径"),
        ("夏普比率", metrics.get("夏普比率", 0.0), "风险调整后收益"),
        ("最大回撤", metrics.get("最大回撤", 0.0), "越小越稳健"),
    ]
    columns = st.columns(2)
    for idx, (label, value, sub_text) in enumerate(cards):
        with columns[idx % 2]:
            st.markdown(
                f"""
                <div class="summary-card">
                    <div class="summary-card-label">{label}</div>
                    <div class="summary-card-value">{format_metric_value(label, value)}</div>
                    <div class="summary-card-sub">{sub_text}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def render_scrollable_dataframe(df: pd.DataFrame, height: int | None = None) -> None:
    """渲染支持横向滚动的数据表。"""
    st.markdown('<div class="table-scroll">', unsafe_allow_html=True)
    st.dataframe(df, use_container_width=True, height=height)
    st.markdown("</div>", unsafe_allow_html=True)


def render_mobile_first_form() -> Dict[str, object]:
    """渲染移动优先的参数表单。"""
    st.markdown('<div class="mobile-panel">', unsafe_allow_html=True)
    st.subheader("快速回测")
    st.caption("优先展示移动端最常用参数，其他设置可在高级参数中展开。")

    with st.form("backtest_form", clear_on_submit=False):
        symbols_text = st.text_input("股票代码", value="000001", help="支持多个股票代码，使用英文逗号分隔。")
        strategy_name = st.selectbox("策略选择", options=["双均线策略", "动量策略", "RSI 策略"], index=0)

        with st.expander("高级参数", expanded=False):
            benchmark_symbol = st.text_input("基准指数代码", value=BENCHMARK)
            date_col1, date_col2 = st.columns(2)
            with date_col1:
                start_date = st.text_input("开始日期", value="20200101")
            with date_col2:
                end_date = st.text_input("结束日期", value="20241231")

            adjust_option = st.selectbox("复权方式", options=["qfq", "hfq", "不复权"], index=0)
            sort_by = st.selectbox("排行榜排序字段", options=["总收益率", "夏普比率", "最大回撤"], index=0)
            initial_cash = st.number_input("初始资金", min_value=1000.0, value=float(INITIAL_CASH), step=1000.0)
            commission_rate = st.number_input("手续费", min_value=0.0, value=float(COMMISSION_RATE), step=0.0001, format="%.4f")
            slippage_rate = st.number_input("滑点", min_value=0.0, value=float(SLIPPAGE_RATE), step=0.0001, format="%.4f")
            enable_sensitivity = st.checkbox("启用双均线参数敏感性分析", value=True)

        run_button = st.form_submit_button("运行回测", use_container_width=True, type="primary")

    st.markdown("</div>", unsafe_allow_html=True)

    return {
        "symbols_text": symbols_text.strip(),
        "strategy_name": strategy_name,
        "benchmark_symbol": benchmark_symbol.strip(),
        "start_date": start_date.strip(),
        "end_date": end_date.strip(),
        "adjust_option": adjust_option,
        "sort_by": sort_by,
        "initial_cash": initial_cash,
        "commission_rate": commission_rate,
        "slippage_rate": slippage_rate,
        "enable_sensitivity": enable_sensitivity,
        "run_button": run_button,
    }


def render_single_stock_detail(
    symbol: str,
    strategy_name: str,
    clean_df: pd.DataFrame,
    benchmark_df: pd.DataFrame,
    signal_df: pd.DataFrame,
    result_df: pd.DataFrame,
    trades_df: pd.DataFrame,
    metrics: Dict[str, float],
    risk_report: list[str],
    report_text: str,
    backtest_excel: Path,
    trades_excel: Path,
    sensitivity_df: pd.DataFrame,
    sensitivity_path: Path | None,
) -> None:
    """渲染单股票详细回测页面。"""
    st.subheader(f"单股票详细结果：{symbol}")
    render_metric_cards(metrics)

    st.subheader("策略、基准与超额净值曲线")
    st.pyplot(plot_nav_chart(result_df), clear_figure=True, use_container_width=True)

    st.subheader("自动生成的中文分析报告")
    st.markdown(f'<div class="report-box">{report_text}</div>', unsafe_allow_html=True)

    with st.expander("查看更多详细结果", expanded=False):
        st.subheader("回撤曲线")
        st.pyplot(plot_drawdown_chart(result_df), clear_figure=True, use_container_width=True)

        st.subheader("买卖点标记图")
        st.pyplot(plot_trade_points_chart(result_df, symbol, strategy_name), clear_figure=True, use_container_width=True)

        st.subheader("策略信号数据预览")
        preview_df = signal_df.copy()
        if "executed_signal" in result_df.columns:
            preview_df["executed_signal"] = result_df["executed_signal"]
        if "position" in result_df.columns:
            preview_df["position"] = result_df["position"]
        preview_columns = [
            column
            for column in ["date", "close", "signal", "executed_signal", "position", "ma_short", "ma_long", "momentum", "rsi"]
            if column in preview_df.columns
        ]
        render_scrollable_dataframe(preview_df[preview_columns].head(30), height=280)

        st.subheader("核心指标表")
        st.table(format_metrics(metrics))

        st.subheader("交易记录表")
        if trades_df.empty:
            st.warning("当前策略在该区间内没有产生完整交易记录。")
        else:
            render_scrollable_dataframe(trades_df, height=320)

        st.subheader("风险提示")
        for item in risk_report:
            st.write(f"- {item}")

        if not sensitivity_df.empty:
            st.subheader("双均线参数敏感性分析")
            render_scrollable_dataframe(sensitivity_df, height=300)

        st.subheader("原始行情数据预览")
        render_scrollable_dataframe(clean_df.head(20), height=260)

        st.subheader("基准行情数据预览")
        render_scrollable_dataframe(benchmark_df.head(20), height=260)

        st.subheader("导出文件")
        st.write(f"- 回测结果 Excel：`{backtest_excel}`")
        st.write(f"- 交易明细 Excel：`{trades_excel}`")
        if sensitivity_path is not None:
            st.write(f"- 参数敏感性分析 Excel：`{sensitivity_path}`")


def main() -> None:
    """运行 Streamlit 页面。"""
    configure_matplotlib()
    st.set_page_config(page_title="AI 量化策略研究与回测系统", layout="wide")
    inject_mobile_styles()
    st.title("AI 量化策略研究与回测系统")
    st.caption("当前版本仅支持历史回测与模拟分析，不包含真实交易或真实下单功能。")

    strategy_map = build_strategy_map()
    form_values = render_mobile_first_form()

    if not form_values["run_button"]:
        st.markdown(
            '<div class="section-note">默认优先展示股票代码、策略选择、回测按钮、收益指标、净值曲线和分析报告。桌面端高级功能已保留在展开区域中。</div>',
            unsafe_allow_html=True,
        )
        return

    symbols = parse_symbols(str(form_values["symbols_text"]))
    if not symbols:
        st.error("请至少输入一个股票代码。")
        return

    adjust = "" if form_values["adjust_option"] == "不复权" else str(form_values["adjust_option"])
    strategy_name = str(form_values["strategy_name"])
    benchmark_symbol = str(form_values["benchmark_symbol"])
    start_date = str(form_values["start_date"])
    end_date = str(form_values["end_date"])
    sort_by = str(form_values["sort_by"])
    initial_cash = float(form_values["initial_cash"])
    commission_rate = float(form_values["commission_rate"])
    slippage_rate = float(form_values["slippage_rate"])
    enable_sensitivity = bool(form_values["enable_sensitivity"])

    try:
        benchmark_df = get_index_daily(symbol=benchmark_symbol, start_date=start_date, end_date=end_date, use_cache=True)
        leaderboard_df, batch_details = run_batch_backtest(
            symbols=symbols,
            strategy_func=strategy_map[strategy_name],
            benchmark_df=benchmark_df,
            start_date=start_date,
            end_date=end_date,
            adjust=adjust,
            initial_cash=initial_cash,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
        )
        sorted_leaderboard_df = sort_leaderboard(leaderboard_df, sort_by=sort_by)
        batch_excel = export_batch_backtest_result(sorted_leaderboard_df, strategy_name, start_date, end_date)
    except Exception as exc:
        st.error(f"运行失败：{exc}")
        return

    primary_symbol = next((symbol for symbol in symbols if not batch_details.get(symbol, {}).get("error")), None)
    if primary_symbol is None:
        st.warning("所有股票均回测失败，无法展示单股票详情。")
        if "错误信息" in sorted_leaderboard_df.columns:
            render_scrollable_dataframe(sorted_leaderboard_df[["股票代码", "错误信息"]], height=260)
        return

    primary_detail = batch_details.get(primary_symbol, {})
    clean_df = primary_detail["clean_df"]
    signal_df = primary_detail["signal_df"]
    result_df = primary_detail["result_df"]
    trades_df = primary_detail["trades_df"]
    metrics = primary_detail["metrics"]
    risk_report = generate_risk_report(result_df, trades_df)
    report_text = generate_text_report(metrics, risk_report, strategy_name, primary_symbol, start_date, end_date)
    backtest_excel = export_backtest_result(result_df, trades_df, metrics, primary_symbol, strategy_name)
    trades_excel = export_trades_detail(trades_df, primary_symbol, strategy_name)

    sensitivity_df = pd.DataFrame()
    sensitivity_path: Path | None = None
    if enable_sensitivity and strategy_name == "双均线策略":
        try:
            short_windows, long_windows = build_sensitivity_ranges()
            sensitivity_df = analyze_ma_parameter_sensitivity(
                clean_df,
                short_windows=short_windows,
                long_windows=long_windows,
                benchmark_df=benchmark_df,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
            )
            sensitivity_path = export_sensitivity_result(sensitivity_df, primary_symbol, strategy_name)
        except Exception as exc:
            st.warning(f"参数敏感性分析执行失败：{exc}")

    if len(symbols) > 1:
        st.subheader("批量回测排行榜")
        render_scrollable_dataframe(format_leaderboard(sorted_leaderboard_df), height=280)
        st.write(f"- 批量回测结果 Excel：`{batch_excel}`")

        failed_symbols = (
            sorted_leaderboard_df[sorted_leaderboard_df.get("错误信息", pd.Series(dtype=object)).notna()]
            if "错误信息" in sorted_leaderboard_df.columns
            else pd.DataFrame()
        )
        if not failed_symbols.empty:
            st.caption("以下股票在本次批量回测中未成功获取结果。")
            render_scrollable_dataframe(failed_symbols[["股票代码", "错误信息"]], height=220)

    render_single_stock_detail(
        symbol=primary_symbol,
        strategy_name=strategy_name,
        clean_df=clean_df,
        benchmark_df=benchmark_df,
        signal_df=signal_df,
        result_df=result_df,
        trades_df=trades_df,
        metrics=metrics,
        risk_report=risk_report,
        report_text=report_text,
        backtest_excel=backtest_excel,
        trades_excel=trades_excel,
        sensitivity_df=sensitivity_df,
        sensitivity_path=sensitivity_path,
    )


if __name__ == "__main__":
    main()

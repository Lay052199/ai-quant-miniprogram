"""AKShare 数据加载模块。"""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import akshare as ak
import pandas as pd

from config import CACHE_PATH


RAW_TO_STANDARD_COLUMNS = {
    "日期": "date",
    "开盘": "open",
    "收盘": "close",
    "最高": "high",
    "最低": "low",
    "成交量": "volume",
    "成交额": "amount",
    "振幅": "amplitude",
    "涨跌幅": "pct_change",
    "涨跌额": "change_amount",
    "换手率": "turnover",
}

INDEX_RAW_TO_STANDARD_COLUMNS = {
    "日期": "date",
    "date": "date",
    "开盘": "open",
    "open": "open",
    "收盘": "close",
    "close": "close",
    "最高": "high",
    "high": "high",
    "最低": "low",
    "low": "low",
    "成交量": "volume",
    "volume": "volume",
    "成交额": "amount",
    "amount": "amount",
}

INDEX_SYMBOL_ALIAS: Dict[str, str] = {
    "000300": "000300",
    "399905": "399905",
    "000001": "000001",
    "000016": "000016",
    "000852": "000852",
}


def _build_cache_path(symbol: str, start_date: str, end_date: str, adjust: str) -> Path:
    """构建缓存文件路径。"""
    adjust_tag = adjust if adjust else "bfq"
    return CACHE_PATH / f"{symbol}_{start_date}_{end_date}_{adjust_tag}.csv"


def _normalize_price_df(df: pd.DataFrame) -> pd.DataFrame:
    """统一 AKShare 返回字段并完成基础清洗。"""
    renamed = df.rename(columns=RAW_TO_STANDARD_COLUMNS)
    required_columns = list(RAW_TO_STANDARD_COLUMNS.values())
    missing_columns = [column for column in required_columns if column not in renamed.columns]
    if missing_columns:
        raise ValueError(f"行情数据字段缺失: {missing_columns}")

    normalized = renamed[required_columns].copy()
    normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce")
    normalized = normalized.dropna(subset=["date"])
    normalized = normalized.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)

    numeric_columns = [column for column in required_columns if column != "date"]
    for column in numeric_columns:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce")

    if normalized[["open", "close", "high", "low"]].isnull().any().any():
        raise ValueError("行情数据存在关键价格字段空值，请检查数据源返回结果。")

    return normalized


def _normalize_index_df(df: pd.DataFrame) -> pd.DataFrame:
    """统一指数历史行情字段。"""
    renamed = df.rename(columns=INDEX_RAW_TO_STANDARD_COLUMNS)
    required_columns = ["date", "open", "close", "high", "low"]
    missing_columns = [column for column in required_columns if column not in renamed.columns]
    if missing_columns:
        raise ValueError(f"指数数据字段缺失: {missing_columns}")

    normalized = renamed.copy()
    for optional_column in ["volume", "amount"]:
        if optional_column not in normalized.columns:
            normalized[optional_column] = 0

    normalized = normalized[["date", "open", "close", "high", "low", "volume", "amount"]].copy()
    normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce")
    normalized = normalized.dropna(subset=["date"]).sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)

    numeric_columns = ["open", "close", "high", "low", "volume", "amount"]
    for column in numeric_columns:
        normalized[column] = pd.to_numeric(normalized[column], errors="coerce")

    normalized = normalized.dropna(subset=["open", "close", "high", "low"])
    return normalized


def _build_index_cache_path(symbol: str, start_date: str, end_date: str) -> Path:
    """构建指数缓存文件路径。"""
    return CACHE_PATH / f"index_{symbol}_{start_date}_{end_date}.csv"


def _resolve_index_symbol(symbol: str) -> str:
    """标准化指数代码，便于后续兼容多数据源。"""
    return INDEX_SYMBOL_ALIAS.get(symbol, symbol)


def get_a_stock_daily(
    symbol: str,
    start_date: str,
    end_date: str,
    adjust: str = "qfq",
    use_cache: bool = True,
) -> pd.DataFrame:
    """获取 A 股日线历史行情。

    参数:
        symbol: 股票代码，例如 "000001"。
        start_date: 开始日期，格式 YYYYMMDD。
        end_date: 结束日期，格式 YYYYMMDD。
        adjust: 复权方式，可选 qfq、hfq 或空字符串。
        use_cache: 是否优先使用本地缓存。

    返回:
        pandas.DataFrame: 标准化后的历史行情数据。
    """
    cache_path = _build_cache_path(symbol, start_date, end_date, adjust)

    try:
        if use_cache and cache_path.exists():
            cached_df = pd.read_csv(cache_path)
            return _normalize_price_df(cached_df)

        raw_df = ak.stock_zh_a_hist(
            symbol=symbol,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust=adjust,
        )

        if raw_df is None or raw_df.empty:
            raise ValueError(
                f"未获取到股票 {symbol} 在 {start_date} 至 {end_date} 区间的历史行情，请检查代码或日期范围。"
            )

        normalized_df = _normalize_price_df(raw_df)
        normalized_df.to_csv(cache_path, index=False, encoding="utf-8-sig")
        return normalized_df
    except Exception as exc:
        message = (
            f"AKShare 历史行情获取失败，股票代码={symbol}，区间={start_date}-{end_date}。"
            f"详细原因: {exc}"
        )
        raise RuntimeError(message) from exc


def get_index_daily(
    symbol: str,
    start_date: str,
    end_date: str,
    use_cache: bool = True,
) -> pd.DataFrame:
    """获取指数日线历史行情，默认用于基准收益比较。

    参数:
        symbol: 指数代码，例如沪深 300 使用 "000300"。
        start_date: 开始日期，格式 YYYYMMDD。
        end_date: 结束日期，格式 YYYYMMDD。
        use_cache: 是否优先使用本地缓存。

    返回:
        pandas.DataFrame: 标准化后的指数行情数据。
    """
    normalized_symbol = _resolve_index_symbol(symbol)
    cache_path = _build_index_cache_path(normalized_symbol, start_date, end_date)

    try:
        if use_cache and cache_path.exists():
            cached_df = pd.read_csv(cache_path)
            return _normalize_index_df(cached_df)

        errors = []

        try:
            raw_df = ak.index_zh_a_hist(
                symbol=normalized_symbol,
                period="daily",
                start_date=start_date,
                end_date=end_date,
            )
            normalized_df = _normalize_index_df(raw_df)
            if normalized_df.empty:
                raise ValueError("index_zh_a_hist 返回空数据。")
            normalized_df.to_csv(cache_path, index=False, encoding="utf-8-sig")
            return normalized_df
        except Exception as exc:
            errors.append(f"index_zh_a_hist 接口失败: {exc}")

        try:
            raw_df = ak.stock_zh_index_daily_em(
                symbol=f"csi{normalized_symbol}",
                start_date=start_date,
                end_date=end_date,
            )
            normalized_df = _normalize_index_df(raw_df)
            if normalized_df.empty:
                raise ValueError("stock_zh_index_daily_em 返回空数据。")
            normalized_df.to_csv(cache_path, index=False, encoding="utf-8-sig")
            return normalized_df
        except Exception as exc:
            errors.append(f"stock_zh_index_daily_em 接口失败: {exc}")

        prefix = "sh" if normalized_symbol.startswith(("000", "880", "899")) else "sz"
        try:
            raw_df = ak.stock_zh_index_daily(symbol=f"{prefix}{normalized_symbol}")
            normalized_df = _normalize_index_df(raw_df)
            normalized_df = normalized_df[
                (normalized_df["date"] >= pd.to_datetime(start_date))
                & (normalized_df["date"] <= pd.to_datetime(end_date))
            ].reset_index(drop=True)
            if normalized_df.empty:
                raise ValueError("指数历史数据为空。")
            normalized_df.to_csv(cache_path, index=False, encoding="utf-8-sig")
            return normalized_df
        except Exception as exc:
            errors.append(f"stock_zh_index_daily 接口失败: {exc}")

        raise RuntimeError("；".join(errors))
    except Exception as exc:
        message = (
            f"基准指数行情获取失败，指数代码={normalized_symbol}，区间={start_date}-{end_date}。"
            f"详细原因: {exc}"
        )
        raise RuntimeError(message) from exc

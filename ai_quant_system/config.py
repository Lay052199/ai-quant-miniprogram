"""项目基础配置。"""

from pathlib import Path

INITIAL_CASH = 100000
COMMISSION_RATE = 0.0003
SLIPPAGE_RATE = 0.0002
ADJUST = "qfq"
BENCHMARK = "000300"
CACHE_DIR = "cache"
OUTPUT_DIR = "outputs"

BASE_DIR = Path(__file__).resolve().parent
CACHE_PATH = BASE_DIR / CACHE_DIR
OUTPUT_PATH = BASE_DIR / OUTPUT_DIR

CACHE_PATH.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

const FALLBACK_STRATEGIES = [
  {
    name: '双均线策略',
    category: '趋势跟踪',
    description: '使用短期与长期均线交叉判断趋势。',
    principle: '短期均线上穿长期均线买入，下穿时卖出。',
    market: '趋势方向清晰且持续性较强的行情。',
    failure: '横盘震荡时容易出现假信号。',
    focus: '均线滞后、窗口选择和趋势过滤。',
    defaultParams: { short_window: 5, long_window: 20 }
  },
  {
    name: '动量策略',
    category: '趋势跟踪',
    description: '根据近期价格强弱顺势参与。',
    principle: '近期收益超过阈值时买入，转弱时退出。',
    market: '强弱分化明显、趋势延续性较强的行情。',
    failure: '行情快速反转时容易追涨。',
    focus: '动量窗口、反转风险和交易阈值。',
    defaultParams: { window: 20, threshold: 0 }
  },
  {
    name: 'RSI 策略',
    category: '震荡反转',
    description: '利用 RSI 超买超卖区寻找反转。',
    principle: 'RSI 进入超卖区买入，进入超买区卖出。',
    market: '震荡或均值回归特征明显的行情。',
    failure: '强趋势中指标可能长期钝化。',
    focus: '指标钝化、阈值和反转确认。',
    defaultParams: { window: 14, lower: 30, upper: 70 }
  },
  {
    name: 'MACD 策略',
    category: '趋势跟踪',
    description: '使用快慢指数均线差与信号线交叉判断趋势。',
    principle: 'MACD 上穿信号线买入，下穿信号线卖出。',
    market: '趋势逐步形成且方向较稳定的行情。',
    failure: '窄幅震荡时容易反复交叉。',
    focus: '快慢周期、信号滞后和震荡过滤。',
    defaultParams: { fast: 12, slow: 26, signal_window: 9 }
  },
  {
    name: '布林带策略',
    category: '震荡反转',
    description: '利用价格偏离布林带后的回归机会。',
    principle: '价格跌破下轨买入，回到中轨退出。',
    market: '波动有界、均值回归特征明显的行情。',
    failure: '单边下跌中可能过早抄底。',
    focus: '波动率、标准差倍数和趋势过滤。',
    defaultParams: { window: 20, num_std: 2 }
  },
  {
    name: '均值回归策略',
    category: '震荡反转',
    description: '根据价格相对均值的标准化偏离寻找反转。',
    principle: 'z-score 显著为负时买入，回归均值附近退出。',
    market: '价格围绕稳定中枢波动的行情。',
    failure: '单边趋势会导致均值持续迁移。',
    focus: '观察窗口、入场偏离和退出阈值。',
    defaultParams: { window: 20, entry_z: 1.5, exit_z: 0.3 }
  },
  {
    name: '突破策略',
    category: '通道突破',
    description: '突破前期价格通道时跟随趋势。',
    principle: '突破前期高点买入，跌破短期低点退出。',
    market: '整理后出现方向性突破的行情。',
    failure: '假突破会造成快速止损。',
    focus: '通道窗口、信号确认和突破有效性。',
    defaultParams: { entry_window: 20, exit_window: 10 }
  },
  {
    name: '海龟交易策略',
    category: '通道突破',
    description: '唐奇安通道突破结合 ATR 风险观察。',
    principle: '突破长期通道入场，跌破短期通道退出。',
    market: '持续时间较长的大级别趋势行情。',
    failure: '震荡期会连续遭遇小额亏损。',
    focus: '通道周期、ATR 风险和交易纪律。',
    defaultParams: { entry_window: 20, exit_window: 10, atr_window: 14 }
  },
  {
    name: 'KDJ 策略',
    category: '震荡反转',
    description: '使用随机指标的低位金叉和高位死叉。',
    principle: '低位 K 上穿 D 买入，高位 K 下穿 D 卖出。',
    market: '区间边界和反转节奏清晰的行情。',
    failure: '强趋势中超买超卖信号可能失效。',
    focus: '交叉位置、指标钝化和阈值确认。',
    defaultParams: { n: 9, m1: 3, m2: 3, lower: 20, upper: 80 }
  }
]

function findStrategy(name) {
  return FALLBACK_STRATEGIES.find(item => item.name === name) || FALLBACK_STRATEGIES[0]
}

module.exports = { FALLBACK_STRATEGIES, findStrategy }

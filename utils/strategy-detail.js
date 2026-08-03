const { findStrategy } = require('./strategy-catalog')

const DETAIL_STRATEGIES = [
  {
    key: 'ma',
    sourceNames: ['双均线策略'],
    name: '双均线策略',
    risk: '低风险',
    riskTone: 'low-risk',
    category: '趋势跟踪',
    tags: ['趋势跟踪', '均线', '通用'],
    icon: '/assets/strategy/icons/ma.svg',
    summary: '通过短期均线与长期均线的交叉判断趋势变化。',
    principle: '比较短周期和长周期移动平均线的位置关系，以价格趋势的形成与减弱作为交易依据。',
    market: '适合方向清晰、趋势持续时间较长的市场。',
    failure: '震荡行情中均线频繁交叉，容易产生连续假信号。',
    focus: '重点理解趋势跟随、信号滞后和均线周期敏感性。',
    signalRules: [
      { title: '买入信号', content: '短期均线上穿长期均线形成金叉。' },
      { title: '卖出信号', content: '短期均线下穿长期均线形成死叉。' }
    ],
    advantages: ['规则清晰，便于验证和复现', '能够跟随中长期趋势', '参数少，适合初学者理解'],
    risks: ['震荡期可能频繁反复交易', '趋势反转后信号存在滞后', '周期选择会明显影响结果'],
    suitableMarkets: ['上涨或下跌趋势清晰', '波动率处于中等水平', '方向性行情持续时间较长'],
    unsuitableMarkets: ['窄幅横盘震荡', '快速反转且缺少延续'],
    profile: ['学习难度：低', '信号频率：中等', '稳定性：取决于趋势质量'],
    parameterDefinitions: [
      { key: 'short_window', label: '短期均线', unit: '日' },
      { key: 'long_window', label: '长期均线', unit: '日' }
    ]
  },
  {
    key: 'macd',
    sourceNames: ['MACD 策略', 'MACD趋势策略'],
    name: 'MACD趋势策略',
    risk: '中风险',
    riskTone: 'medium-risk',
    category: '趋势动量',
    tags: ['趋势跟踪', 'MACD', '动量'],
    icon: '/assets/strategy/icons/macd.svg',
    summary: '用快慢指数均线的差值与信号线交叉确认趋势动量。',
    principle: 'MACD 通过快慢指数移动平均线之差刻画趋势动量，并用信号线降低短期噪声。',
    market: '适合趋势逐步形成、动量变化较清晰的行情。',
    failure: '横盘或剧烈跳空时交叉信号可能滞后或反复。',
    focus: '关注快慢周期、信号周期和零轴位置。',
    signalRules: [
      { title: '买入信号', content: 'MACD 线上穿信号线时确认多头动量。' },
      { title: '卖出信号', content: 'MACD 线下穿信号线时退出持仓。' }
    ],
    advantages: ['同时观察趋势与动量', '信号规则明确可复现', '适用于多个交易周期'],
    risks: ['盘整阶段容易反复交叉', '极端行情下信号确认偏慢', '不同周期组合差异明显'],
    suitableMarkets: ['趋势逐渐增强', '成交与价格方向一致', '中等以上波动行情'],
    unsuitableMarkets: ['低波动横盘', '频繁跳空反转'],
    profile: ['学习难度：中等', '信号频率：中等', '稳定性：依赖动量延续'],
    parameterDefinitions: [
      { key: 'fast', label: '快速周期', unit: '日' },
      { key: 'slow', label: '慢速周期', unit: '日' },
      { key: 'signal_window', label: '信号周期', unit: '日' }
    ]
  },
  {
    key: 'boll',
    sourceNames: ['布林带策略'],
    name: '布林带策略',
    risk: '中风险',
    riskTone: 'medium-risk',
    category: '均值回归',
    tags: ['均值回归', '布林带', '反转'],
    icon: '/assets/strategy/icons/boll.svg',
    summary: '根据价格相对布林带上下轨的位置寻找偏离与回归机会。',
    principle: '布林带用移动均值和标准差构造动态通道，以价格触及上下轨衡量短期偏离。',
    market: '适合价格围绕中枢波动、区间边界较稳定的行情。',
    failure: '强趋势中价格可能持续贴轨，反转信号会提前出现。',
    focus: '关注观察窗口、标准差倍数和趋势过滤。',
    signalRules: [
      { title: '买入信号', content: '价格触及下轨后出现回归迹象时入场。' },
      { title: '卖出信号', content: '价格回到中轨或触及上轨时退出。' }
    ],
    advantages: ['通道随波动率动态变化', '适合识别短期价格偏离', '图形直观便于解释'],
    risks: ['强趋势中可能逆势入场', '波动突增会扩大通道', '参数过短时噪声较多'],
    suitableMarkets: ['区间震荡明显', '价格中枢相对稳定', '波动率周期性变化'],
    unsuitableMarkets: ['单边快速趋势', '重大事件驱动跳空'],
    profile: ['学习难度：中等', '信号频率：较高', '稳定性：依赖中枢有效性'],
    parameterDefinitions: [
      { key: 'window', label: '观察窗口', unit: '日' },
      { key: 'num_std', label: '标准差倍数', unit: '倍' }
    ]
  },
  {
    key: 'rsi',
    sourceNames: ['RSI 策略', 'RSI反转策略'],
    name: 'RSI反转策略',
    risk: '低风险',
    riskTone: 'low-risk',
    category: '震荡反转',
    tags: ['均值回归', 'RSI', '反转'],
    icon: '/assets/strategy/icons/rsi.svg',
    summary: '利用 RSI 超买超卖区间观察短期反转机会。',
    principle: 'RSI 比较一定周期内上涨和下跌强度，以数值区间衡量市场短期情绪。',
    market: '适合震荡边界清晰、短期超买超卖容易修复的行情。',
    failure: '强趋势中指标可能长时间钝化，过早反向交易。',
    focus: '关注周期长度、上下阈值和趋势环境。',
    signalRules: [
      { title: '买入信号', content: 'RSI 进入超卖区并重新向上时入场。' },
      { title: '卖出信号', content: 'RSI 进入超买区或反向跌破阈值时退出。' }
    ],
    advantages: ['指标范围固定易于理解', '适合识别情绪极端区域', '参数结构简单清晰'],
    risks: ['强趋势中可能长期钝化', '阈值过窄会增加噪声', '反转确认可能不足'],
    suitableMarkets: ['震荡边界清晰', '短期情绪波动明显', '均值回归特征较强'],
    unsuitableMarkets: ['持续单边趋势', '快速突破后的延续行情'],
    profile: ['学习难度：低', '信号频率：较高', '稳定性：依赖震荡结构'],
    parameterDefinitions: [
      { key: 'window', label: 'RSI 周期', unit: '日' },
      { key: 'lower', label: '超卖阈值', unit: '' },
      { key: 'upper', label: '超买阈值', unit: '' }
    ]
  },
  {
    key: 'turtle',
    sourceNames: ['海龟交易策略', '海龟突破策略'],
    name: '海龟突破策略',
    risk: '高风险',
    riskTone: 'high-risk',
    category: '通道突破',
    tags: ['突破', '趋势跟踪', '海龟交易'],
    icon: '/assets/strategy/icons/turtle.svg',
    summary: '使用唐奇安通道突破跟随较长周期趋势。',
    principle: '价格突破长期通道高点时跟随趋势，跌破较短通道低点时退出。',
    market: '适合整理后出现持续方向性突破的大级别趋势。',
    failure: '震荡期假突破会造成多次小额亏损。',
    focus: '关注入场通道、退出通道、ATR 和交易纪律。',
    signalRules: [
      { title: '买入信号', content: '价格突破入场周期内的前期最高价。' },
      { title: '卖出信号', content: '价格跌破退出周期内的前期最低价。' }
    ],
    advantages: ['能够捕捉少数大级别趋势', '规则系统化且纪律明确', '入场退出逻辑相互独立'],
    risks: ['假突破可能连续止损', '收益分布依赖少数大行情', '回撤和持仓波动可能较高'],
    suitableMarkets: ['长期整理后突破', '方向性趋势持续', '流动性充足的品种'],
    unsuitableMarkets: ['无方向宽幅震荡', '频繁假突破行情'],
    profile: ['学习难度：中等', '信号频率：较低', '稳定性：依赖趋势机会'],
    parameterDefinitions: [
      { key: 'entry_window', label: '入场通道', unit: '日' },
      { key: 'exit_window', label: '退出通道', unit: '日' },
      { key: 'atr_window', label: 'ATR 周期', unit: '日' }
    ]
  },
  {
    key: 'mean',
    sourceNames: ['均值回归策略'],
    name: '均值回归策略',
    risk: '低风险',
    riskTone: 'low-risk',
    category: '统计回归',
    tags: ['均值回归', '统计套利', '通用'],
    icon: '/assets/strategy/icons/mean.svg',
    summary: '根据价格相对滚动均值的标准化偏离寻找回归机会。',
    principle: '用滚动均值和标准差计算价格偏离程度，在显著偏离后观察回归。',
    market: '适合均值稳定、价格围绕中枢反复波动的行情。',
    failure: '结构性趋势会让均值持续移动并放大逆势风险。',
    focus: '关注观察窗口、入场偏离、退出阈值和中枢稳定性。',
    signalRules: [
      { title: '买入信号', content: '价格标准化偏离低于负入场阈值时入场。' },
      { title: '卖出信号', content: '偏离回到退出阈值附近时退出。' }
    ],
    advantages: ['统计含义清晰', '适合稳定区间的反复机会', '参数可以进行敏感性分析'],
    risks: ['趋势行情中可能持续逆势', '均值发生结构变化时失效', '异常波动会放大偏离'],
    suitableMarkets: ['稳定震荡区间', '价格中枢可观察', '极端偏离后常有修复'],
    unsuitableMarkets: ['结构性单边趋势', '基本面突变造成重定价'],
    profile: ['学习难度：中等', '信号频率：中等', '稳定性：依赖均值稳定'],
    parameterDefinitions: [
      { key: 'window', label: '观察窗口', unit: '日' },
      { key: 'entry_z', label: '入场偏离', unit: 'σ' },
      { key: 'exit_z', label: '退出阈值', unit: 'σ' }
    ]
  }
]

function normalizeStrategyKey(value) {
  let normalized = String(value || '').trim().toLowerCase()
  normalized = normalized === 'ma_cross' ? 'ma' : normalized
  const found = DETAIL_STRATEGIES.find(item => (
    item.key === normalized ||
    item.name.toLowerCase() === normalized ||
    item.sourceNames.some(name => name.toLowerCase() === normalized)
  ))
  return found ? found.key : 'ma'
}

function findStrategyDetail(value) {
  const key = normalizeStrategyKey(value)
  const detail = DETAIL_STRATEGIES.find(item => item.key === key) || DETAIL_STRATEGIES[0]
  const source = findStrategy(detail.sourceNames[0])
  const requested = String(value || '').trim()
  const recognized = DETAIL_STRATEGIES.some(item => (
    item.key === requested.toLowerCase() ||
    item.name === requested ||
    item.sourceNames.includes(requested)
  ))
  return {
    ...detail,
    source,
    defaultParams: { ...(source.defaultParams || {}) },
    fallback: Boolean(requested && !recognized)
  }
}

module.exports = {
  DETAIL_STRATEGIES,
  findStrategyDetail,
  normalizeStrategyKey
}

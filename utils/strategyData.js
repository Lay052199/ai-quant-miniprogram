const STRATEGY_DATA = [
  {
    id: 'ma_cross',
    businessKey: 'ma',
    aliases: ['ma', 'ma_cross', '双均线策略'],
    name: '双均线策略',
    category: '趋势跟踪',
    period: '中短线',
    risk: '低风险',
    riskTone: 'low-risk',
    description: '基于短期与长期均线的交叉信号，识别趋势形成与转弱的经典策略。',
    logicCards: [
      {
        title: '移动平均线（MA）',
        tone: 'blue',
        description: '用一段时间内的平均价格平滑短期波动，观察市场方向。',
      },
      {
        title: '金叉信号',
        tone: 'green',
        description: '短期均线上穿长期均线，表示近期价格动能增强，形成买入信号。',
      },
      {
        title: '死叉信号',
        tone: 'red',
        description: '短期均线下穿长期均线，表示趋势可能转弱，形成卖出信号。',
      },
    ],
    formula: {
      title: '移动平均线公式',
      lines: ['MA(N) = (P1 + P2 + ... + Pn) / N'],
      note: 'N 为观察周期，P 为每日收盘价。',
    },
    parameters: [
      { key: 'short_window', label: '短期均线', value: 5, unit: '日', impact: '周期越短，响应越快，但噪声更多。', badge: '快速响应' },
      { key: 'long_window', label: '长期均线', value: 20, unit: '日', impact: '周期越长，趋势更稳定，但信号更滞后。', badge: '稳定趋势' },
    ],
    process: [
      { title: '历史价格数据', icon: 'bars' },
      { title: '计算短期/长期 MA', icon: 'wave' },
      { title: '判断均线交叉', icon: 'cross' },
      { title: '生成交易信号', icon: 'bell' },
      { title: '执行买卖', icon: 'trade' },
      { title: '计算策略收益', icon: 'chart' },
    ],
    sensitivityLabels: ['短期/长期', '年化收益', '最大回撤', '评价'],
    mechanismAsset: '/assets/strategy/mechanisms/ma-cross.svg',
    mechanismLegend: ['短期均线', '长期均线'],
    suitableMarket: {
      suitable: ['单边上涨或下跌', '趋势明确且持续', '波动率适中'],
      unsuitable: ['长期窄幅震荡', '频繁快速反转', '缺少方向的横盘'],
    },
    advantages: ['规则透明，容易理解', '便于程序化实现与复现', '适合捕捉中长期趋势', '参数结构简单'],
    limitations: ['信号基于历史价格，存在滞后', '震荡市场容易反复交易', '单一指标可能失效'],
    aiComment: [
      '双均线策略是理解趋势跟踪思想的良好起点：它不预测价格，而是等待趋势被价格行为确认。',
      '它的主要代价是滞后与震荡期的假信号。实盘研究时应结合成交量、波动率过滤和风险控制，而不是只追求更高收益。',
    ],
  },
  {
    id: 'macd',
    businessKey: 'macd',
    aliases: ['macd', 'MACD策略', 'MACD趋势策略'],
    name: 'MACD趋势策略',
    category: '趋势动量',
    period: '中短线',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: '结合快慢指数均线与信号线，观察趋势方向和动量强弱。',
    logicCards: [
      { title: 'DIF 快慢线差', tone: 'blue', description: '快线 EMA 与慢线 EMA 的差值，用于刻画短期动量相对长期趋势的变化。' },
      { title: '金叉与动量增强', tone: 'green', description: 'DIF 上穿 DEA 时关注多头动量，柱体由弱转强可作为辅助确认。' },
      { title: '死叉与动量衰减', tone: 'red', description: 'DIF 下穿 DEA 时趋势动量走弱，策略退出持仓或保持观望。' },
    ],
    formula: {
      title: 'MACD 公式',
      lines: ['DIF = EMA(12) - EMA(26)', 'DEA = EMA(DIF, 9)', 'MACD = 2 × (DIF - DEA)'],
      note: '指数移动平均线对近期价格赋予更高权重。',
    },
    parameters: [
      { key: 'fast', label: '快线周期', value: 12, unit: '日', impact: '越短越敏感，同时更容易受到短期噪声影响。', badge: '动量响应' },
      { key: 'slow', label: '慢线周期', value: 26, unit: '日', impact: '决定长期趋势基线，周期更长时信号更稳定。', badge: '趋势基线' },
      { key: 'signal_window', label: '信号线周期', value: 9, unit: '日', impact: '控制金叉死叉确认速度，过短会增加交易频率。', badge: '信号确认' },
    ],
    process: [
      { title: '价格数据', icon: 'bars' },
      { title: '计算 EMA12/26', icon: 'wave' },
      { title: '生成 DIF/DEA', icon: 'formula' },
      { title: '识别金叉死叉', icon: 'cross' },
      { title: '确认动量', icon: 'bell' },
      { title: '执行交易', icon: 'trade' },
    ],
    sensitivityLabels: ['快/慢/信号', '年化收益', '最大回撤', '评价'],
    mechanismAsset: '/assets/strategy/mechanisms/macd.svg',
    mechanismLegend: ['DIF', 'DEA', 'MACD 柱'],
    suitableMarket: {
      suitable: ['趋势逐步形成', '动量持续增强', '中等以上波动行情'],
      unsuitable: ['低波动横盘', '跳空后快速反转', '交叉信号频繁'],
    },
    advantages: ['同时观察趋势与动量', '信号规则清晰', '适配多个观察周期'],
    limitations: ['仍基于历史价格，存在滞后', '震荡市场容易产生假信号', '参数组合影响明显'],
    aiComment: [
      'MACD 通过指数移动平均捕捉市场动量变化，相比简单均线策略加入了趋势强弱判断。',
      '但指标仍由历史价格推导，在快速反转或低波动横盘中容易滞后或反复交叉，适合配合趋势与成交量过滤。',
    ],
  },
  {
    id: 'boll',
    businessKey: 'boll',
    aliases: ['boll', '布林带策略'],
    name: '布林带策略',
    category: '均值回归',
    period: '短中线',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: '利用移动均线和价格波动率构建动态通道，识别偏离与回归机会。',
    logicCards: [
      { title: '动态价格通道', tone: 'blue', description: '中轨代表价格中枢，上下轨随标准差变化，波动放大时通道变宽。' },
      { title: '下轨超卖观察', tone: 'green', description: '价格触及下轨并重新回到通道时，可能出现均值回归机会。' },
      { title: '上轨风险观察', tone: 'red', description: '价格突破上轨可能表示超买，也可能是强趋势延续，需要额外确认。' },
    ],
    formula: {
      title: '布林带公式',
      lines: ['中轨 = MA(N)', '上轨 = MA(N) + Kσ', '下轨 = MA(N) - Kσ'],
      note: 'σ 为价格标准差，K 决定通道宽度。',
    },
    parameters: [
      { key: 'window', label: '观察周期', value: 20, unit: '日', impact: '周期越短，通道变化越快，也更容易出现噪声。', badge: '中枢速度' },
      { key: 'num_std', label: '标准差倍数', value: 2, unit: '倍', impact: '倍数越大，通道越宽，触发信号越少。', badge: '通道宽度' },
    ],
    process: [
      { title: '价格数据', icon: 'bars' },
      { title: '计算移动均值', icon: 'wave' },
      { title: '计算波动率 σ', icon: 'formula' },
      { title: '构建上下轨', icon: 'channel' },
      { title: '判断触轨回归', icon: 'cross' },
      { title: '执行交易', icon: 'trade' },
    ],
    sensitivityLabels: ['周期/标准差', '年化收益', '最大回撤', '评价'],
    mechanismAsset: '/assets/strategy/mechanisms/boll.svg',
    mechanismLegend: ['上轨', '中轨', '下轨', '价格'],
    suitableMarket: {
      suitable: ['区间震荡明显', '价格中枢相对稳定', '波动具有周期性'],
      unsuitable: ['强单边趋势', '重大事件跳空', '波动率结构突变'],
    },
    advantages: ['通道随波动率动态变化', '偏离程度直观', '适合研究均值回归'],
    limitations: ['强趋势中容易逆势入场', '触轨不等于立即反转', '波动突增会改变信号质量'],
    aiComment: [
      '布林带的核心是均值回归与动态波动边界，而不是简单地“碰上轨就卖、碰下轨就买”。',
      '趋势行情里价格可能长期贴轨运行，因此需要结合趋势过滤，并检查标准差倍数对回撤与交易频率的影响。',
    ],
  },
  {
    id: 'rsi',
    businessKey: 'rsi',
    aliases: ['rsi', 'RSI策略', 'RSI反转策略'],
    name: 'RSI反转策略',
    category: '震荡反转',
    period: '短线',
    risk: '低风险',
    riskTone: 'low-risk',
    description: '比较一段时间内上涨与下跌力量，识别超买超卖后的反转机会。',
    logicCards: [
      { title: '相对强弱', tone: 'blue', description: 'RSI 将上涨与下跌力度标准化到 0 至 100，便于比较市场情绪。' },
      { title: '超卖区域', tone: 'green', description: 'RSI 低于 30 表示下跌力量集中，回升越过阈值后再确认反转。' },
      { title: '超买区域', tone: 'red', description: 'RSI 高于 70 表示上涨力量集中，但强趋势中可能长期保持高位。' },
    ],
    formula: {
      title: 'RSI 公式',
      lines: ['RSI = 100 - 100 / (1 + RS)', 'RS = 平均上涨幅度 / 平均下跌幅度'],
      note: '数值越高表示近期上涨力量相对越强。',
    },
    parameters: [
      { key: 'window', label: 'RSI 周期', value: 14, unit: '日', impact: '周期越短越敏感，极值信号也会更频繁。', badge: '情绪窗口' },
      { key: 'lower', label: '超卖阈值', value: 30, unit: '', impact: '阈值越低，买入条件越严格，信号更少。', badge: '入场阈值' },
      { key: 'upper', label: '超买阈值', value: 70, unit: '', impact: '阈值越高，退出条件越严格，持仓可能更久。', badge: '退出阈值' },
    ],
    process: [
      { title: '价格涨跌数据', icon: 'bars' },
      { title: '计算上涨/下跌均值', icon: 'formula' },
      { title: '生成 RSI', icon: 'wave' },
      { title: '识别 30/70 区域', icon: 'channel' },
      { title: '等待反向确认', icon: 'bell' },
      { title: '执行交易', icon: 'trade' },
    ],
    sensitivityLabels: ['周期/阈值', '年化收益', '最大回撤', '评价'],
    mechanismAsset: '/assets/strategy/mechanisms/rsi.svg',
    mechanismLegend: ['RSI', '超买 70', '超卖 30'],
    suitableMarket: {
      suitable: ['区间震荡', '短期情绪波动明显', '价格具备回归特征'],
      unsuitable: ['持续单边趋势', '突破后趋势延续', '极端事件行情'],
    },
    advantages: ['指标范围固定，容易解释', '适合识别情绪极端', '参数简单清晰'],
    limitations: ['强趋势中会长期钝化', '过早反向可能持续亏损', '需要趋势过滤确认'],
    aiComment: [
      'RSI 本质上衡量近期上涨与下跌力量，通过识别超买超卖区域寻找反转机会。',
      '强趋势行情中，超买或超卖状态可能长期维持，所以应等待 RSI 回穿阈值，并结合趋势方向进行过滤。',
    ],
  },
  {
    id: 'turtle',
    businessKey: 'turtle',
    aliases: ['turtle', '海龟交易策略', '海龟突破策略'],
    name: '海龟突破策略',
    category: '通道突破',
    period: '中长线',
    risk: '高风险',
    riskTone: 'high-risk',
    description: '用唐奇安通道识别价格突破，不预测拐点，而是跟随已经发生的大趋势。',
    logicCards: [
      { title: '突破入场', tone: 'green', description: '突破 N 日最高价时跟随多头趋势，不主观预测价格顶部。' },
      { title: '通道退出', tone: 'red', description: '跌破较短周期最低价时退出，让盈利趋势充分运行。' },
      { title: '盈亏分布', tone: 'blue', description: '通常依靠少数大行情覆盖多次小额止损，胜率并非核心目标。' },
    ],
    formula: {
      title: '唐奇安突破规则',
      lines: ['突破 N 日最高价 → 买入', '跌破 M 日最低价 → 卖出'],
      note: '突破 N 日最高价是趋势确认，不代表价格已经便宜。',
    },
    parameters: [
      { key: 'entry_window', label: '突破周期', value: 20, unit: '日', impact: '周期越长，信号更稳定，但可能错过趋势初段。', badge: '趋势确认' },
      { key: 'exit_window', label: '退出周期', value: 10, unit: '日', impact: '周期越短，保护利润更快，也更容易提前离场。', badge: '退出速度' },
      { key: 'atr_window', label: 'ATR 周期', value: 14, unit: '日', impact: '用于衡量波动与风险尺度，辅助控制仓位。', badge: '波动控制' },
    ],
    process: [
      { title: '历史高低价', icon: 'bars' },
      { title: '构建唐奇安通道', icon: 'channel' },
      { title: '识别向上突破', icon: 'cross' },
      { title: '按波动控制风险', icon: 'formula' },
      { title: '跟随趋势持仓', icon: 'trade' },
      { title: '跌破通道退出', icon: 'chart' },
    ],
    sensitivityLabels: ['突破/退出', '年化收益', '最大回撤', '评价'],
    mechanismAsset: '/assets/strategy/mechanisms/turtle.svg',
    mechanismLegend: ['上轨', '下轨', '突破价格'],
    suitableMarket: {
      suitable: ['整理后持续突破', '方向性大趋势', '流动性充足品种'],
      unsuitable: ['无方向宽幅震荡', '频繁假突破', '交易成本过高'],
    },
    advantages: ['能够捕捉少数大趋势', '规则系统化且纪律明确', '盈亏比通常高于胜率表现'],
    limitations: ['假突破会连续止损', '收益依赖少数大行情', '持仓回撤和波动可能较高'],
    aiComment: [
      '海龟突破策略代表经典趋势跟踪思想，核心不是预测价格，而是确认并跟随市场趋势。',
      '它通常胜率一般，却依靠少数大行情获得收益；评估时应重点看盈亏比、连续亏损和回撤承受能力。',
    ],
  },
]

function normalizeTeachingStrategyId(value) {
  const normalized = String(value || '').trim().toLowerCase()
  const found = STRATEGY_DATA.find(item => (
    item.id === normalized ||
    item.businessKey === normalized ||
    item.name.toLowerCase() === normalized ||
    item.aliases.some(alias => alias.toLowerCase() === normalized)
  ))
  return found ? found.id : 'ma_cross'
}

function findStrategyData(value) {
  const id = normalizeTeachingStrategyId(value)
  return STRATEGY_DATA.find(item => item.id === id) || STRATEGY_DATA[0]
}

module.exports = {
  STRATEGY_DATA,
  findStrategyData,
  normalizeTeachingStrategyId,
}

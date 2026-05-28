"""策略报告生成模块。"""

from __future__ import annotations

from typing import Dict, List, Optional

from config import OUTPUT_PATH


def _safe_strategy_name(strategy_name: str) -> str:
    """生成适合文件名的策略名称。"""
    return strategy_name.replace(" ", "_").replace("/", "_")


def _judge_return_level(total_return: float, annual_return: float) -> str:
    """判断收益表现等级。"""
    if total_return > 0.3 or annual_return > 0.15:
        return "整体收益表现较强"
    if total_return > 0.1 or annual_return > 0.08:
        return "整体收益表现稳健"
    if total_return > 0:
        return "整体收益为正，但收益弹性相对有限"
    return "整体收益表现偏弱，策略未能在样本区间内形成明显优势"


def _judge_risk_level(max_drawdown: float, volatility: float, sharpe_ratio: float) -> str:
    """判断风险表现等级。"""
    drawdown_abs = abs(max_drawdown)
    if drawdown_abs < 0.1 and volatility < 0.2 and sharpe_ratio > 1:
        return "风险控制较为良好，净值曲线相对平稳"
    if drawdown_abs < 0.2 and volatility < 0.3:
        return "风险水平处于可接受区间，但仍存在阶段性波动压力"
    return "风险暴露相对明显，回撤与波动对持有体验有一定影响"


def _describe_benchmark_comparison(excess_return: float, benchmark_return: float) -> str:
    """生成与基准比较的描述。"""
    if excess_return > 0.1:
        return f"相较基准取得了较为显著的超额收益，说明策略在样本期内具备一定主动管理能力。基准同期收益为 {benchmark_return:.2%}。"
    if excess_return > 0:
        return f"相较基准实现了正向超额收益，但优势幅度有限，说明策略有效性存在一定条件依赖。基准同期收益为 {benchmark_return:.2%}。"
    if excess_return > -0.05:
        return f"与基准相比未形成明显优势，整体表现接近基准水平。基准同期收益为 {benchmark_return:.2%}。"
    return f"相较基准存在一定程度跑输，说明当前参数或策略逻辑在该阶段适配性不足。基准同期收益为 {benchmark_return:.2%}。"


def _describe_drawdown(max_drawdown: float) -> str:
    """生成最大回撤解释。"""
    drawdown_abs = abs(max_drawdown)
    if drawdown_abs < 0.1:
        return "最大回撤控制在较低水平，说明策略在不利市场阶段具备一定防御性，资金曲线承压相对有限。"
    if drawdown_abs < 0.2:
        return "最大回撤处于中等水平，表明策略在趋势反复或震荡阶段仍会经历一定净值回吐，但整体尚在可接受区间。"
    if drawdown_abs < 0.3:
        return "最大回撤偏大，说明策略对市场节奏较为敏感，在错误信号或连续不利行情中可能出现较明显的资金回撤。"
    return "最大回撤较深，反映出策略在样本区间内对不利市场环境的适应性较弱，资金曲线修复难度相对较高。"


def _describe_trade_behavior(trade_count: int, win_rate: float) -> str:
    """生成交易行为分析。"""
    frequency_text = (
        "交易频率较高，策略偏向主动捕捉波动机会。"
        if trade_count >= 20
        else "交易频率适中，策略在信号确认后再进行换仓。"
        if trade_count >= 8
        else "交易次数相对较少，策略更依赖少数关键交易贡献收益。"
    )

    win_rate_text = (
        "胜率表现较高，说明信号方向判断具备一定稳定性。"
        if win_rate >= 0.6
        else "胜率处于中性区间，策略收益更依赖盈亏比而非单纯命中率。"
        if win_rate >= 0.45
        else "胜率偏低，策略可能需要依赖趋势延续来弥补错误交易带来的损耗。"
    )
    return f"{frequency_text}{win_rate_text}"


def _describe_market_regime(strategy_name: str, annual_return: float, excess_return: float) -> str:
    """描述策略适用市场环境。"""
    strategy_hint = {
        "双均线策略": "该策略通常更适合趋势较为明确、延续性较强的市场环境。",
        "动量策略": "该策略更适合价格惯性较为明显、强者恒强特征较突出的阶段。",
        "RSI 策略": "该策略更适合震荡波动较多、价格存在均值回归特征的市场环境。",
    }.get(strategy_name, "该策略的适用性取决于信号与市场结构之间的匹配程度。")

    if annual_return > 0 and excess_return > 0:
        effect_text = "从本次回测结果看，策略与样本期市场环境的匹配度尚可。"
    elif annual_return > 0:
        effect_text = "从本次回测结果看，策略能够实现绝对收益，但相对优势仍有待强化。"
    else:
        effect_text = "从本次回测结果看，策略与当前样本期市场环境的匹配度一般。"

    return f"{strategy_hint}{effect_text}"


def _build_limitations(total_return: float, max_drawdown: float, trade_count: int, excess_return: float) -> List[str]:
    """生成策略局限性。"""
    limitations: List[str] = [
        "当前报告基于历史样本区间统计，结论不代表未来市场中仍将保持同等有效性。",
        "策略仍以单一技术信号为核心，尚未引入基本面、风格因子或市场状态识别机制。 ",
    ]

    if total_return <= 0:
        limitations.append("样本期收益表现偏弱，说明现有参数在当前区间内未充分适配市场结构。")
    if abs(max_drawdown) > 0.2:
        limitations.append("回撤控制压力较大，策略在遭遇连续错误信号时资金曲线承压明显。")
    if trade_count <= 3:
        limitations.append("交易样本数量有限，统计稳定性和显著性仍需更长区间验证。")
    if excess_return <= 0:
        limitations.append("相对基准未体现持续超额收益，主动管理价值仍需进一步验证。")

    return limitations


def _build_optimization_suggestions(strategy_name: str, max_drawdown: float, trade_count: int) -> List[str]:
    """生成后续优化建议。"""
    suggestions = [
        "建议引入仓位控制、止盈止损或波动率约束机制，以提升回撤管理能力。",
        "建议增加滚动窗口或分阶段样本验证，检验策略在不同市场环境下的稳定性。",
        "建议补充交易成本敏感性分析，评估手续费与滑点对净收益的侵蚀程度。",
    ]

    if strategy_name == "双均线策略":
        suggestions.append("可继续扩展短中长期均线组合，并结合趋势过滤指标提升信号质量。")
    elif strategy_name == "动量策略":
        suggestions.append("可结合成交量、波动率或市场宽度指标，过滤动量衰减阶段的误判。")
    elif strategy_name == "RSI 策略":
        suggestions.append("可叠加趋势过滤条件，避免在单边行情中频繁逆势交易。")

    if abs(max_drawdown) > 0.2:
        suggestions.append("建议优先优化风险约束逻辑，而非单纯追求更高收益，以提升策略可执行性。")
    if trade_count < 5:
        suggestions.append("建议扩大样本区间或增加标的覆盖范围，提高交易样本数量与统计可靠性。")

    return suggestions


def generate_rule_based_report(
    metrics: Dict[str, float],
    risk_report: List[str],
    strategy_name: str,
    symbol: str,
    start_date: str,
    end_date: str,
) -> str:
    """基于规则模板生成更专业的中文策略分析报告。"""
    total_return = metrics.get("总收益率", 0.0)
    benchmark_return = metrics.get("基准收益率", 0.0)
    excess_return = metrics.get("超额收益率", 0.0)
    annual_return = metrics.get("年化收益率", 0.0)
    max_drawdown = metrics.get("最大回撤", 0.0)
    sharpe_ratio = metrics.get("夏普比率", 0.0)
    volatility = metrics.get("年化波动率", 0.0)
    win_rate = metrics.get("胜率", 0.0)
    trade_count = int(metrics.get("交易次数", 0))
    final_asset = metrics.get("最终资产", 0.0)
    initial_asset = metrics.get("初始资金", 0.0)

    return_assessment = _judge_return_level(total_return, annual_return)
    risk_assessment = _judge_risk_level(max_drawdown, volatility, sharpe_ratio)
    benchmark_comment = _describe_benchmark_comparison(excess_return, benchmark_return)
    drawdown_comment = _describe_drawdown(max_drawdown)
    trade_behavior_comment = _describe_trade_behavior(trade_count, win_rate)
    market_regime_comment = _describe_market_regime(strategy_name, annual_return, excess_return)
    limitations = _build_limitations(total_return, max_drawdown, trade_count, excess_return)
    suggestions = _build_optimization_suggestions(strategy_name, max_drawdown, trade_count)

    report_text = f"""策略分析报告

一、策略基本信息
本报告基于规则模板自动生成，用于对历史回测结果进行定量归纳与文字解释。
策略名称：{strategy_name}
回测标的：{symbol}
回测区间：{start_date} - {end_date}
初始资金：{initial_asset:,.2f} 元
期末资产：{final_asset:,.2f} 元

二、收益表现分析
从收益结果看，策略在样本区间内实现总收益率 {total_return:.2%}，对应年化收益率 {annual_return:.2%}。{return_assessment}。
若从资金增值角度观察，策略资产由 {initial_asset:,.2f} 元变动至 {final_asset:,.2f} 元，表明策略在既定交易成本假设下形成了相应的收益表现。

三、风险表现分析
从风险收益匹配情况看，策略夏普比率为 {sharpe_ratio:.2f}，年化波动率为 {volatility:.2%}。综合判断，{risk_assessment}。
结合风控检查结果，当前主要风险提示包括：
{chr(10).join(f"- {item}" for item in risk_report)}

四、与基准对比
回测期间，基准收益率为 {benchmark_return:.2%}，策略超额收益率为 {excess_return:.2%}。{benchmark_comment}

五、最大回撤解释
策略最大回撤为 {max_drawdown:.2%}。{drawdown_comment}
最大回撤反映了策略从阶段性净值高点回落至低点的最不利幅度，是衡量资金曲线承压能力和投资者持有体验的重要指标。

六、交易行为分析
样本期内策略共发生 {trade_count} 笔交易，交易胜率为 {win_rate:.2%}。{trade_behavior_comment}
从交易行为角度看，交易次数决定了策略对市场波动的响应频率，而胜率与盈亏比共同决定最终收益质量，因此不能孤立解读单一指标。

七、策略适用市场环境
{market_regime_comment}

八、策略局限性
{chr(10).join(f"- {item}" for item in limitations)}

九、后续优化建议
{chr(10).join(f"- {item}" for item in suggestions)}
"""
    return report_text


def generate_ai_report(
    metrics: Dict[str, float],
    risk_report: List[str],
    strategy_name: str,
    symbol: str,
    start_date: str,
    end_date: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """预留未来接入大模型报告生成的接口。

    当前版本不接入任何外部 API，仅抛出未实现提示。
    后续接入时应通过环境变量或 .env 管理密钥，不得将密钥写入代码。
    """
    raise NotImplementedError(
        "当前版本仅支持规则模板报告生成，尚未接入 OpenAI API 或其他大模型服务。"
    )


def save_report(report_text: str, symbol: str, strategy_name: str) -> str:
    """保存报告为 txt 文件并返回文件路径。"""
    report_path = OUTPUT_PATH / f"report_{symbol}_{_safe_strategy_name(strategy_name)}.txt"
    report_path.write_text(report_text, encoding="utf-8")
    return str(report_path)


def generate_text_report(
    metrics: Dict[str, float],
    risk_report: List[str],
    strategy_name: str,
    symbol: str,
    start_date: str,
    end_date: str,
) -> str:
    """生成中文策略分析报告并保存到输出目录。"""
    report_text = generate_rule_based_report(
        metrics=metrics,
        risk_report=risk_report,
        strategy_name=strategy_name,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
    )
    save_report(report_text, symbol=symbol, strategy_name=strategy_name)
    return report_text

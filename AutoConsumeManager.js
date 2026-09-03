// js/10-battle/AutoConsumeManager.js
// ============================================================
//  自动消耗管理器（重构版）
//  修复：移除直接修改 char._autoConsume.rules 的违规操作，
//  全部通过 CharController.updateAutoConsumeRules 合法写入
// ============================================================
(function(global) {
    'use strict';

    const CHECK_INTERVAL_MS = 1000;

    // ---------- 私有状态 ----------
    let _cooldowns = {}; // { ruleId: timestamp }

    // ============================================================
    //  1. 规则数据管理（只读访问）
    // ============================================================

    // 内部获取规则数组引用（仅供本模块内部读取，不直接用于写入）
    function _getRulesRef(char) {
        if (!char) return [];
        if (!char._autoConsume) char._autoConsume = { version: 1, rules: [] };
        if (!char._autoConsume.rules) char._autoConsume.rules = [];
        return char._autoConsume.rules;
    }

    // 公开获取规则（深拷贝，防止外部违规修改）
    function getRules(char) {
        const ref = _getRulesRef(char);
        return JSON.parse(JSON.stringify(ref));
    }

    // ============================================================
    //  2. 添加/删除/更新规则（全部通过合法入口）
    // ============================================================

    function addRule(char, rule) {
        if (!char) return { success: false, message: '角色不存在' };
        const rules = _getRulesRef(char);
        rule.id = rule.id || 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        rules.push(rule);

        if (global.CharController && typeof global.CharController.updateAutoConsumeRules === 'function') {
            const ok = global.CharController.updateAutoConsumeRules(rules);
            return ok ? { success: true, rule: rule } : { success: false, message: '保存失败' };
        }
        return { success: false, message: 'CharController.updateAutoConsumeRules 不可用' };
    }

    function removeRule(char, ruleId) {
        if (!char) return { success: false, message: '角色不存在' };
        const rules = _getRulesRef(char);
        const index = rules.findIndex(r => r.id === ruleId);
        if (index === -1) return { success: false, message: '规则不存在' };
        rules.splice(index, 1);

        if (global.CharController && typeof global.CharController.updateAutoConsumeRules === 'function') {
            const ok = global.CharController.updateAutoConsumeRules(rules);
            return ok ? { success: true } : { success: false, message: '保存失败' };
        }
        return { success: false, message: 'CharController.updateAutoConsumeRules 不可用' };
    }

    function updateRule(char, ruleId, updates) {
        if (!char) return { success: false, message: '角色不存在' };
        const rules = _getRulesRef(char);
        const rule = rules.find(r => r.id === ruleId);
        if (!rule) return { success: false, message: '规则不存在' };
        Object.assign(rule, updates);

        if (global.CharController && typeof global.CharController.updateAutoConsumeRules === 'function') {
            const ok = global.CharController.updateAutoConsumeRules(rules);
            return ok ? { success: true } : { success: false, message: '保存失败' };
        }
        return { success: false, message: 'CharController.updateAutoConsumeRules 不可用' };
    }

    // ============================================================
    //  3. 核心检查与执行
    // ============================================================

    let _lastCheckTime = 0;

    function checkAndUse(char) {
        if (!char) return;
        const now = Date.now();
        if (now - _lastCheckTime < CHECK_INTERVAL_MS) return;
        _lastCheckTime = now;

        const rules = _getRulesRef(char);
        if (rules.length === 0) return;

        const sorted = [...rules]
            .filter(r => r.enabled !== false)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const rule of sorted) {
            const cooldownEnd = _cooldowns[rule.id] || 0;
            if (now < cooldownEnd) continue;

            const stacks = global.InventoryService ? global.InventoryService.getAllStacks(false) : [];
            let stack = null;
            let stackKey = null;
            for (const s of stacks) {
                if (s.templateId === rule.itemId) {
                    stack = s;
                    stackKey = s.key;
                    break;
                }
            }
            if (!stack || stack.count < (rule.minCount || 1)) continue;

            let triggered = false;
            switch (rule.trigger) {
                case 'hpPercent': {
                    const maxHp = char._finalStats?.finalMaxHP || 100;
                    const hpPercent = (char.hp || 0) / maxHp * 100;
                    if (hpPercent <= rule.threshold) triggered = true;
                    break;
                }
                case 'spPercent': {
                    const maxSp = char._finalStats?.finalMaxSP || 50;
                    const spPercent = (char.sp || 0) / maxSp * 100;
                    if (spPercent <= rule.threshold) triggered = true;
                    break;
                }
                case 'status': {
                    if (!rule.status) break;
                    const scId = global.SC_CONSTANTS ? global.SC_CONSTANTS[rule.status] : null;
                    if (scId !== undefined && char.sc && typeof char.sc.hasSCE === 'function') {
                        if (char.sc.hasSCE(scId)) triggered = true;
                    }
                    break;
                }
                case 'buffEnd': {
                    if (!rule.buffId) break;
                    const scId = global.SC_CONSTANTS ? global.SC_CONSTANTS[rule.buffId] : null;
                    if (scId !== undefined && char.sc && typeof char.sc.hasSCE === 'function') {
                        if (!char.sc.hasSCE(scId)) triggered = true;
                    }
                    break;
                }
                default: break;
            }

            if (!triggered) continue;

            const result = global.InventoryService ? global.InventoryService.useItem(stackKey) : null;
            if (result && result.success) {
                if (rule.cooldown && rule.cooldown > 0) {
                    _cooldowns[rule.id] = now + rule.cooldown * 1000;
                }
                if (global.EventBus) {
                    global.EventBus.emit('autoConsume:used', { ruleId: rule.id, itemId: rule.itemId });
                }
                return true; // 每次只使用一个物品
            }
        }
        return false;
    }

    // ============================================================
    //  4. 重置冷却
    // ============================================================

    function resetCooldowns() {
        _cooldowns = {};
    }

    // ============================================================
    //  5. 初始化
    // ============================================================

    function init() {
        const bus = global.EventBus;
        if (bus) {
            bus.on('map:changed', function() {
                resetCooldowns();
            });
        }
        console.log('[AutoConsumeManager] ✅ 已加载（重构版：合法写入）');
    }

    // ============================================================
    //  暴露全局
    // ============================================================

    global.AutoConsumeManager = {
        getRules: getRules,
        addRule: addRule,
        removeRule: removeRule,
        updateRule: updateRule,
        checkAndUse: checkAndUse,
        resetCooldowns: resetCooldowns,
        init: init,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[AutoConsumeManager] ✅ 已加载');
})(window);
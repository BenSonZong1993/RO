// js/8-ui/UIPotions.js（最终修复：降低持久化频率，移除多余事件触发）
(function(global) {
    'use strict';

    var RULE_IDS = {
        HP: 'hpRule',
        SP: 'spRule',
        STATUS: 'statusRule',
        BATTLE: 'battleRule'
    };

    // ---------- 工具解析脚本 ----------
    function parseHealScript(script) {
        if (!script || typeof script !== 'string') return { hp: 0, sp: 0 };
        var hp = 0, sp = 0;
        var lines = script.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var match = line.match(/itemheal\s+(\d+)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                var minSp = parseInt(match[2], 10);
                var maxSp = parseInt(match[3], 10);
                sp += Math.floor((minSp + maxSp) / 2);
                continue;
            }
            match = line.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*(\d+)\s*;?/i);
            if (match) {
                var minHp = parseInt(match[1], 10);
                var maxHp = parseInt(match[2], 10);
                var spVal = parseInt(match[3], 10);
                hp += Math.floor((minHp + maxHp) / 2);
                sp += spVal;
                continue;
            }
            match = line.match(/itemheal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                sp += parseInt(match[2], 10);
                continue;
            }
            match = line.match(/itemheal\s+(\d+)\s*,\s*(\d+)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                sp += parseInt(match[2], 10);
                continue;
            }
            match = line.match(/percentheal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
            if (match) {
                hp = hp || 1;
                sp = sp || 1;
                continue;
            }
        }
        return { hp: hp, sp: sp };
    }

    // ---------- 获取背包消耗品 ----------
    function getUsableItemsFromBag() {
        var stacks = global.InventoryService ? global.InventoryService.getAllStacks(false) : [];
        var result = [];
        var sources = [
            global.ItemDataUsable || [],
            global.ItemDataEtc || []
        ];
        for (var i = 0; i < stacks.length; i++) {
            var stack = stacks[i];
            var def = null;
            for (var j = 0; j < sources.length; j++) {
                var found = sources[j].find(function(item) { return item.Id === stack.templateId; });
                if (found) { def = found; break; }
            }
            if (!def) continue;
            if (def.Type !== 'Healing' && def.Type !== 'Usable') continue;
            if (!def.Script) continue;
            var heal = parseHealScript(def.Script);
            var isStatus = /sc_start\s+/.test(def.Script);
            result.push({
                id: stack.templateId,
                name: def.cnName || def.Name || def.AegisName || '#' + stack.templateId,
                count: stack.count,
                healHp: heal.hp,
                healSp: heal.sp,
                isStatus: isStatus,
                script: def.Script
            });
        }
        return result;
    }

    // ---------- 分类 ----------
    function classify(items) {
        var hp = [], sp = [], status = [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.isStatus) {
                status.push(item);
                continue;
            }
            if (item.healHp > 0) hp.push(item);
            if (item.healSp > 0) sp.push(item);
        }
        hp.sort(function(a, b) {
            var aPure = a.healSp === 0 ? 1 : 0;
            var bPure = b.healSp === 0 ? 1 : 0;
            if (aPure !== bPure) return bPure - aPure;
            return (b.healHp || 0) - (a.healHp || 0);
        });
        sp.sort(function(a, b) {
            var aPure = a.healHp === 0 ? 1 : 0;
            var bPure = b.healHp === 0 ? 1 : 0;
            if (aPure !== bPure) return bPure - aPure;
            return (b.healSp || 0) - (a.healSp || 0);
        });
        status.sort(function(a, b) { return a.name.localeCompare(b.name); });
        return { hp: hp, sp: sp, status: status };
    }

    // ---------- 构建下拉选项（保留选中值） ----------
    function populateSelect(id, items, includeNone) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var currentValue = sel.value;
        sel.innerHTML = '';
        if (includeNone !== false) {
            var opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '无';
            sel.appendChild(opt);
        }
        for (var i = 0; i < items.length; i++) {
            var opt = document.createElement('option');
            opt.value = items[i].id;
            opt.textContent = items[i].name + ' (x' + items[i].count + ')';
            sel.appendChild(opt);
        }
        if (currentValue && sel.querySelector('option[value="' + currentValue + '"]')) {
            sel.value = currentValue;
        } else {
            sel.value = '';
        }
    }

    // ---------- 从规则恢复选中值 ----------
    function restoreSelectedFromRules(selId, ruleId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        var char = global.CharController ? global.CharController.getChar() : null;
        if (!char) return;
        // 使用重构后的 AutoConsumeManager.getRules（只读）
        var manager = global.AutoConsumeManager;
        if (!manager) return;
        var rules = manager.getRules(char);
        var rule = rules.find(function(r) { return r.id === ruleId; });
        if (rule && rule.itemId) {
            var itemId = String(rule.itemId);
            if (sel.querySelector('option[value="' + itemId + '"]')) {
                sel.value = itemId;
                return;
            }
        }
        sel.value = '';
    }

    // ---------- 更新当前选中物品的数量（而非总数） ----------
    function updateSelectedCounts() {
        var hpSel = document.getElementById('sel-hp-potion');
        var spSel = document.getElementById('sel-sp-potion');
        var statusSel = document.getElementById('sel-status-potion');

        var allItems = getUsableItemsFromBag();
        var countMap = {};
        for (var i = 0; i < allItems.length; i++) {
            countMap[allItems[i].id] = allItems[i].count;
        }

        if (hpSel) {
            var hpId = parseInt(hpSel.value, 10);
            var hpCount = countMap[hpId] || 0;
            var el = document.getElementById('hp-potion-count');
            if (el) el.textContent = hpCount;
        }
        if (spSel) {
            var spId = parseInt(spSel.value, 10);
            var spCount = countMap[spId] || 0;
            var el = document.getElementById('sp-potion-count');
            if (el) el.textContent = spCount;
        }
        if (statusSel) {
            var statusId = parseInt(statusSel.value, 10);
            var statusCount = countMap[statusId] || 0;
            var el = document.getElementById('status-potion-count');
            if (el) el.textContent = statusCount;
        }
        var elBattle = document.getElementById('battle-item-count');
        if (elBattle) elBattle.textContent = '0';
    }

    // ---------- 同步规则 ----------
    function syncRule(ruleId, itemId, trigger, threshold, cooldown, enabled) {
        var char = global.CharController ? global.CharController.getChar() : null;
        if (!char) return;
        var manager = global.AutoConsumeManager;
        if (!manager) return;
        var rules = manager.getRules(char);
        var rule = rules.find(function(r) { return r.id === ruleId; });
        if (itemId === '' || itemId === null || itemId === undefined) {
            if (rule) manager.removeRule(char, ruleId);
            // ⚠️ 不再手动触发 char:changed（由 AutoConsumeManager 内部触发）
            return;
        }
        var updates = {
            itemId: parseInt(itemId, 10),
            trigger: trigger,
            threshold: threshold,
            cooldown: cooldown || 2,
            enabled: enabled !== false,
            minCount: 1,
            priority: 10
        };
        if (!rule) {
            manager.addRule(char, { id: ruleId, ...updates });
        } else {
            manager.updateRule(char, ruleId, updates);
        }
        // ⚠️ 不再手动触发 char:changed（由 AutoConsumeManager 内部触发）
    }

function syncAllRules() {
    var hpSel = document.getElementById('sel-hp-potion');
    var spSel = document.getElementById('sel-sp-potion');
    var statusSel = document.getElementById('sel-status-potion');
    var hpThreshold = document.getElementById('sel-hp-threshold');
    var spThreshold = document.getElementById('sel-sp-threshold');
    var statusCooldown = document.getElementById('sel-status-cooldown');

    var char = global.CharController ? global.CharController.getChar() : null;
    if (!char) return;

    var manager = global.AutoConsumeManager;
    if (!manager) return;

    // 获取当前规则（用于判断是新增还是更新）
    var existingRules = manager.getRules(char);
    var newRules = [];

    // ---- HP 规则 ----
    var hpVal = hpSel ? hpSel.value : '';
    if (hpVal) {
        var hpThr = parseInt(hpThreshold ? hpThreshold.value : 50, 10);
        var hpRule = existingRules.find(function(r) { return r.id === RULE_IDS.HP; });
        newRules.push({
            id: RULE_IDS.HP,
            itemId: parseInt(hpVal, 10),
            trigger: 'hpPercent',
            threshold: hpThr,
            cooldown: 2,
            enabled: true,
            minCount: 1,
            priority: 10
        });
    }

    // ---- SP 规则 ----
    var spVal = spSel ? spSel.value : '';
    if (spVal) {
        var spThr = parseInt(spThreshold ? spThreshold.value : 30, 10);
        newRules.push({
            id: RULE_IDS.SP,
            itemId: parseInt(spVal, 10),
            trigger: 'spPercent',
            threshold: spThr,
            cooldown: 2,
            enabled: true,
            minCount: 1,
            priority: 10
        });
    }

    // ---- 状态规则（可选） ----
    var statusVal = statusSel ? statusSel.value : '';
    if (statusVal) {
        var cd = parseInt(statusCooldown ? statusCooldown.value : 5, 10);
        newRules.push({
            id: RULE_IDS.STATUS,
            itemId: parseInt(statusVal, 10),
            trigger: 'status',
            threshold: 0,
            cooldown: cd,
            enabled: true,
            minCount: 1,
            priority: 10
        });
    }

    // 合并现有规则中不属于这三类的（保留其他规则）
    var otherRules = existingRules.filter(function(r) {
        return r.id !== RULE_IDS.HP && r.id !== RULE_IDS.SP && r.id !== RULE_IDS.STATUS;
    });

    var finalRules = otherRules.concat(newRules);

    // 一次性保存所有规则
    if (global.CharController && typeof global.CharController.updateAutoConsumeRules === 'function') {
        global.CharController.updateAutoConsumeRules(finalRules);
    }

    updateSelectedCounts();
}

    // ---------- 刷新下拉选项 ----------
    function refreshDropdown(selId) {
        var items = getUsableItemsFromBag();
        var classified = classify(items);
        if (selId === 'sel-hp-potion') {
            populateSelect(selId, classified.hp, true);
            restoreSelectedFromRules(selId, RULE_IDS.HP);
        } else if (selId === 'sel-sp-potion') {
            populateSelect(selId, classified.sp, true);
            restoreSelectedFromRules(selId, RULE_IDS.SP);
        } else if (selId === 'sel-status-potion') {
            populateSelect(selId, classified.status, true);
            restoreSelectedFromRules(selId, RULE_IDS.STATUS);
        }
        updateSelectedCounts();
    }

    // ---------- 计数更新节流 ----------
    var _countUpdateTimer = null;
    function updateCountsThrottled() {
        if (_countUpdateTimer) return;
        _countUpdateTimer = setTimeout(function() {
            updateSelectedCounts();
            _countUpdateTimer = null;
        }, 200);
    }

    // ---------- 绑定事件 ----------
    function bindEvents() {
        var hpSel = document.getElementById('sel-hp-potion');
        var spSel = document.getElementById('sel-sp-potion');
        var statusSel = document.getElementById('sel-status-potion');
        var hpThr = document.getElementById('sel-hp-threshold');
        var spThr = document.getElementById('sel-sp-threshold');
        var statusCd = document.getElementById('sel-status-cooldown');

        function onChange() { syncAllRules(); }
        if (hpSel) hpSel.addEventListener('change', onChange);
        if (spSel) spSel.addEventListener('change', onChange);
        if (statusSel) statusSel.addEventListener('change', onChange);
        // 🔧 修复：将 input 改为 change，降低保存频率
        if (hpThr) hpThr.addEventListener('change', onChange);
        if (spThr) spThr.addEventListener('change', onChange);
        if (statusCd) statusCd.addEventListener('change', onChange);

        function onDropdownInteraction(e) {
            var target = e.target;
            if (target && target.id) {
                refreshDropdown(target.id);
            }
        }
        if (hpSel) hpSel.addEventListener('focus', onDropdownInteraction);
        if (spSel) spSel.addEventListener('focus', onDropdownInteraction);
        if (statusSel) statusSel.addEventListener('focus', onDropdownInteraction);

        var bus = global.EventBus;
        if (bus) {
            bus.on('inventory:changed', function() {
    refreshDropdown('sel-hp-potion');
    refreshDropdown('sel-sp-potion');
    refreshDropdown('sel-status-potion');
    updateCountsThrottled();
});
            bus.on('autoConsume:used', function(data) {
                updateCountsThrottled();
            });
            // 监听角色变化，恢复选中状态
            bus.on('char:changed', function() {
                restoreSelectedFromRules('sel-hp-potion', RULE_IDS.HP);
                restoreSelectedFromRules('sel-sp-potion', RULE_IDS.SP);
                restoreSelectedFromRules('sel-status-potion', RULE_IDS.STATUS);
                updateSelectedCounts();
            });
        }
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) updateCountsThrottled();
        });
    }

    // ---------- 初始化 ----------
    function init() {
        if (document.getElementById('sel-hp-potion')) {
            var items = getUsableItemsFromBag();
            var classified = classify(items);
            populateSelect('sel-hp-potion', classified.hp, true);
            populateSelect('sel-sp-potion', classified.sp, true);
            populateSelect('sel-status-potion', classified.status, true);
            restoreSelectedFromRules('sel-hp-potion', RULE_IDS.HP);
            restoreSelectedFromRules('sel-sp-potion', RULE_IDS.SP);
            restoreSelectedFromRules('sel-status-potion', RULE_IDS.STATUS);
            updateSelectedCounts();
            bindEvents();
            console.log('[UIPotions] ✅ 初始化完成（下拉保持 + 显示当前选中数量 + 低频保存）');
            return;
        }
        console.warn('[UIPotions] 静态面板元素缺失');
    }

    // ---------- 暴露全局 ----------
    global.UIPotions = {
        init: init,
        refreshDropdown: refreshDropdown,
        updateCounts: updateCountsThrottled,
        syncAllRules: syncAllRules
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[UIPotions] ✅ 加载完成');
})(window);
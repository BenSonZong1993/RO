// js/8-ui/UIAutoConsume.js（重构版：完全通过合法入口读写规则）
(function(global) {
    'use strict';

    var _container = null;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var _debouncedRender = null;

    // ---------- 获取可用物品列表（从 ItemDataUsable） ----------
    function _getUsableItems() {
        var items = [];
        var sources = [
            global.ItemDataUsable,
            global.ItemDataEquip,
            global.ItemDataEtc
        ];
        for (var s = 0; s < sources.length; s++) {
            var arr = sources[s];
            if (!arr || !Array.isArray(arr)) continue;
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                var type = item.Type || '';
                if (type === 'Healing' || type === 'Usable') {
                    if (item.Script) {
                        items.push({
                            id: item.Id,
                            name: item.cnName || item.Name || item.AegisName || '#' + item.Id
                        });
                    }
                }
            }
        }
        var unique = {};
        var result = [];
        for (var j = 0; j < items.length; j++) {
            if (!unique[items[j].id]) {
                unique[items[j].id] = true;
                result.push(items[j]);
            }
        }
        result.sort(function(a, b) { return a.name.localeCompare(b.name); });
        return result;
    }

    // ---------- 获取规则（只读，通过 AutoConsumeManager） ----------
    function _getRules() {
        var char = global.CharController ? global.CharController.getChar() : null;
        if (!char) return [];
        if (global.AutoConsumeManager && typeof global.AutoConsumeManager.getRules === 'function') {
            return global.AutoConsumeManager.getRules(char);
        }
        // 极低概率的降级（不应发生）
        if (!char._autoConsume) char._autoConsume = { version: 1, rules: [] };
        if (!char._autoConsume.rules) char._autoConsume.rules = [];
        return char._autoConsume.rules;
    }

    // ---------- 保存规则（通过 CharController 合法入口） ----------
    function _saveRules(rules) {
        if (global.CharController && typeof global.CharController.updateAutoConsumeRules === 'function') {
            return global.CharController.updateAutoConsumeRules(rules);
        }
        console.warn('[UIAutoConsume] CharController.updateAutoConsumeRules 不可用，保存失败');
        return false;
    }

    // ---------- 获取物品数量 ----------
    function _getItemCount(itemId) {
        var stacks = global.InventoryService ? global.InventoryService.getAllStacks(false) : [];
        var total = 0;
        for (var i = 0; i < stacks.length; i++) {
            if (stacks[i].templateId === itemId) {
                total += stacks[i].count;
            }
        }
        return total;
    }

    // ---------- 获取物品名称 ----------
    function _getItemName(itemId) {
        var items = _getUsableItems();
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === itemId) return items[i].name;
        }
        return '#' + itemId;
    }

    // ---------- 渲染面板 ----------
    function render() {
        if (!_container) return;
        var char = global.CharController ? global.CharController.getChar() : null;
        if (!char) {
            _container.innerHTML = '<p style="color:#aaa; padding:8px;">角色数据未加载</p>';
            return;
        }
        var rules = _getRules();
        var items = _getUsableItems();
        if (items.length === 0) {
            _container.innerHTML = '<p style="color:#aaa; padding:8px;">无可用的消耗品数据</p>';
            return;
        }
        var html = '<div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">';
        html += '<span style="font-size:0.8rem; color:#888;">自动消耗规则（按优先级降序）</span>';
        html += '<button id="auto-consume-add-btn" style="background:#4caf50; border:none; color:#fff; padding:4px 12px; border-radius:4px; cursor:pointer;">+ 添加规则</button>';
        html += '</div>';
        if (rules.length === 0) {
            html += '<p style="color:#888; font-size:0.85rem; padding:8px 0;">暂无规则，点击上方添加。</p>';
            _container.innerHTML = html;
            _bindAddButton();
            return;
        }
        var sorted = rules.slice().sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
        html += '<div style="max-height:320px; overflow-y:auto; padding-right:4px;">';
        for (var i = 0; i < sorted.length; i++) {
            var rule = sorted[i];
            var count = _getItemCount(rule.itemId);
            var itemName = _getItemName(rule.itemId);
            html += '<div class="auto-consume-rule" data-rule-id="' + rule.id + '" style="background:#3a3a3a; border-radius:6px; padding:8px 10px; margin-bottom:6px; display:flex; flex-wrap:wrap; align-items:center; gap:6px; border-left:3px solid ' + (rule.enabled !== false ? '#4caf50' : '#888') + ';">';
            html += '<label style="display:flex; align-items:center; gap:4px; font-size:0.8rem; cursor:pointer;">';
            html += '<input type="checkbox" class="rule-enabled" data-rule-id="' + rule.id + '" ' + (rule.enabled !== false ? 'checked' : '') + ' />';
            html += '启用</label>';
            html += '<select class="rule-item" data-rule-id="' + rule.id + '" style="background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 6px; font-size:0.8rem; flex:1; min-width:100px;">';
            for (var j = 0; j < items.length; j++) {
                var selected = items[j].id === rule.itemId ? 'selected' : '';
                html += '<option value="' + items[j].id + '" ' + selected + '>' + items[j].name + '</option>';
            }
            html += '</select>';
            html += '<span style="font-size:0.75rem; color:#aaa; white-space:nowrap;">x' + count + '</span>';
            html += '<select class="rule-trigger" data-rule-id="' + rule.id + '" style="background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 6px; font-size:0.8rem;">';
            var triggers = [
                { value: 'hpPercent', label: 'HP%' },
                { value: 'spPercent', label: 'SP%' },
                { value: 'status', label: '状态' },
                { value: 'buffEnd', label: 'Buff结束' },
            ];
            for (var t = 0; t < triggers.length; t++) {
                var selectedT = triggers[t].value === rule.trigger ? 'selected' : '';
                html += '<option value="' + triggers[t].value + '" ' + selectedT + '>' + triggers[t].label + '</option>';
            }
            html += '</select>';
            var showThreshold = (rule.trigger === 'hpPercent' || rule.trigger === 'spPercent');
            if (showThreshold) {
                html += '<span style="font-size:0.8rem;">&lt;</span>';
                html += '<input type="number" class="rule-threshold" data-rule-id="' + rule.id + '" value="' + (rule.threshold || 40) + '" min="1" max="99" style="width:48px; background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:0.8rem; text-align:center;" />%';
            } else if (rule.trigger === 'status') {
                html += '<input type="text" class="rule-status" data-rule-id="' + rule.id + '" value="' + (rule.status || 'SC_POISON') + '" placeholder="状态名" style="width:80px; background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:0.8rem;" />';
            } else if (rule.trigger === 'buffEnd') {
                html += '<input type="text" class="rule-buff" data-rule-id="' + rule.id + '" value="' + (rule.buffId || 'SC_ASPDPOTION0') + '" placeholder="Buff名" style="width:80px; background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:0.8rem;" />';
            }
            html += '<span style="font-size:0.75rem; color:#888;">优先</span>';
            html += '<input type="number" class="rule-priority" data-rule-id="' + rule.id + '" value="' + (rule.priority || 10) + '" min="0" max="100" style="width:40px; background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:0.8rem; text-align:center;" />';
            html += '<span style="font-size:0.75rem; color:#888;">冷却</span>';
            html += '<input type="number" class="rule-cooldown" data-rule-id="' + rule.id + '" value="' + (rule.cooldown || 2) + '" min="0" max="300" step="0.5" style="width:44px; background:#2d2d2d; color:#eee; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:0.8rem; text-align:center;" /><span style="font-size:0.7rem; color:#888;">s</span>';
            html += '<button class="rule-delete-btn" data-rule-id="' + rule.id + '" style="background:#d32f2f; border:none; color:#fff; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:0.8rem; margin-left:auto;">✕</button>';
            html += '</div>';
        }
        html += '</div>';
        _container.innerHTML = html;
        _bindEvents();
        _bindAddButton();
    }

    // ---------- 绑定事件（委托） ----------
    function _bindEvents() {
        if (!_container) return;
        if (_container._delegateHandler) {
            _container.removeEventListener('change', _container._delegateHandler);
            _container.removeEventListener('click', _container._delegateHandler);
            _container._delegateHandler = null;
        }
        var handler = function(e) {
            var target = e.target;
            var ruleId = target.dataset.ruleId;

            // 获取当前规则（只读副本）
            var rules = _getRules();
            var rule = rules.find(function(r) { return r.id === ruleId; });
            if (!rule) return;

            // 处理启用/禁用
            if (target.classList.contains('rule-enabled')) {
                rule.enabled = target.checked;
                _saveRules(rules);
                render();
                return;
            }
            // 处理物品选择
            if (target.classList.contains('rule-item')) {
                rule.itemId = parseInt(target.value, 10);
                _saveRules(rules);
                render();
                return;
            }
            // 处理触发条件
            if (target.classList.contains('rule-trigger')) {
                rule.trigger = target.value;
                if (rule.trigger === 'hpPercent' || rule.trigger === 'spPercent') {
                    rule.threshold = rule.threshold || 40;
                    delete rule.status;
                    delete rule.buffId;
                } else if (rule.trigger === 'status') {
                    rule.status = rule.status || 'SC_POISON';
                    delete rule.threshold;
                    delete rule.buffId;
                } else if (rule.trigger === 'buffEnd') {
                    rule.buffId = rule.buffId || 'SC_ASPDPOTION0';
                    delete rule.threshold;
                    delete rule.status;
                }
                _saveRules(rules);
                render();
                return;
            }
            // 处理删除（非阻塞模态框确认，替代原生 confirm）
            if (target.classList.contains('rule-delete-btn')) {
                var modal = global.UIPanel && global.UIPanel.showModal
                    ? global.UIPanel.showModal({ message: '确定删除此规则？', title: '确认' })
                    : Promise.resolve({ ok: false, value: null });
                modal.then(function(result) {
                    if (result.ok) {
                        var idx = rules.findIndex(function(r) { return r.id === ruleId; });
                        if (idx !== -1) {
                            rules.splice(idx, 1);
                            _saveRules(rules);
                            if (global.EventBus) {
                                global.EventBus.emit('autoConsume:ruleDeleted', { ruleId: ruleId });
                            }
                            render();
                        }
                    }
                });
                return;
            }
        };
        _container.addEventListener('change', handler);
        _container.addEventListener('click', handler);
        _container._delegateHandler = handler;
        _domListeners.push({ el: _container, event: 'change', fn: handler });
        _domListeners.push({ el: _container, event: 'click', fn: handler });

        // 输入框实时更新（阈值、状态名、优先级、冷却）
        var inputHandler = function(e) {
            var target = e.target;
            if (!target.dataset || !target.dataset.ruleId) return;
            var ruleId = target.dataset.ruleId;
            var rules = _getRules();
            var rule = rules.find(function(r) { return r.id === ruleId; });
            if (!rule) return;
            if (target.classList.contains('rule-threshold')) {
                rule.threshold = parseInt(target.value, 10) || 40;
            } else if (target.classList.contains('rule-status')) {
                rule.status = target.value.trim() || 'SC_POISON';
            } else if (target.classList.contains('rule-buff')) {
                rule.buffId = target.value.trim() || 'SC_ASPDPOTION0';
            } else if (target.classList.contains('rule-priority')) {
                rule.priority = parseInt(target.value, 10) || 10;
            } else if (target.classList.contains('rule-cooldown')) {
                rule.cooldown = parseFloat(target.value) || 2;
            }
            _saveRules(rules);
        };
        var inputs = _container.querySelectorAll('input.rule-threshold, input.rule-status, input.rule-buff, input.rule-priority, input.rule-cooldown');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener('input', inputHandler);
            _domListeners.push({ el: inputs[i], event: 'input', fn: inputHandler });
        }
        _container._inputHandler = inputHandler;
    }

    // ---------- 绑定添加按钮 ----------
    function _bindAddButton() {
        var btn = document.getElementById('auto-consume-add-btn');
        if (!btn) return;
        if (btn._addHandler) {
            btn.removeEventListener('click', btn._addHandler);
        }
        var handler = function() {
            var char = global.CharController ? global.CharController.getChar() : null;
            if (!char) { alert('角色数据未加载'); return; }
            var items = _getUsableItems();
            if (items.length === 0) { alert('无可用的消耗品'); return; }
            var rules = _getRules();
            var newRule = {
                id: 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                itemId: items[0].id,
                trigger: 'hpPercent',
                threshold: 40,
                priority: 10,
                cooldown: 2,
                enabled: true,
                minCount: 1
            };
            rules.push(newRule);
            _saveRules(rules);
            if (global.EventBus) {
                global.EventBus.emit('autoConsume:ruleAdded', { rule: newRule });
            }
            render();
        };
        btn.addEventListener('click', handler);
        btn._addHandler = handler;
        _domListeners.push({ el: btn, event: 'click', fn: handler });
    }

    // ---------- 打开/关闭 ----------
    function open() {
        if (_container) {
            _container.style.display = 'block';
            render();
        }
    }
    function close() {
        if (_container) {
            _container.style.display = 'none';
        }
    }
    function toggle() {
        if (_container) {
            if (_container.style.display === 'none') {
                open();
            } else {
                close();
            }
        }
    }

    // ---------- 初始化 ----------
    function init() {
        if (document.getElementById('sel-hp-potion')) {
            console.log('[UIAutoConsume] 检测到静态面板，跳过动态渲染');
            return;
        }
        if (_initialized) return;
        _container = document.getElementById('auto-consume-container');
        if (!_container) {
            console.warn('[UIAutoConsume] 未找到容器 #auto-consume-container');
            return;
        }
        if (global.UIManager && typeof global.UIManager.debounce === 'function') {
            _debouncedRender = global.UIManager.debounce(render.bind(this), 300);
        } else {
            _debouncedRender = function() { setTimeout(render, 50); };
        }
        var bus = global.EventBus;
        if (bus) {
            var onCharChanged = function() { _debouncedRender(); };
            var onInventoryChanged = function() { _debouncedRender(); };
            var onAutoConsumeUsed = function() { _debouncedRender(); };
            bus.on('char:changed', onCharChanged);
            _listeners.push({ event: 'char:changed', fn: onCharChanged });
            bus.on('inventory:changed', onInventoryChanged);
            _listeners.push({ event: 'inventory:changed', fn: onInventoryChanged });
            bus.on('autoConsume:used', onAutoConsumeUsed);
            _listeners.push({ event: 'autoConsume:used', fn: onAutoConsumeUsed });
        }
        _initialized = true;
        render();
        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIAutoConsume);
        }
        console.log('[UIAutoConsume] ✅ 已初始化（重构版：合法读写）');
    }

    // ---------- 清理 ----------
    function dispose() {
        if (_debouncedRender && typeof _debouncedRender.cancel === 'function') {
            _debouncedRender.cancel();
        }
        var bus = global.EventBus;
        if (bus) {
            for (var i = 0; i < _listeners.length; i++) {
                bus.off(_listeners[i].event, _listeners[i].fn);
            }
            _listeners = [];
        }
        for (var j = 0; j < _domListeners.length; j++) {
            var item = _domListeners[j];
            if (item.el && typeof item.el.removeEventListener === 'function') {
                item.el.removeEventListener(item.event, item.fn);
            }
        }
        _domListeners = [];
        if (_container && _container._delegateHandler) {
            _container.removeEventListener('change', _container._delegateHandler);
            _container.removeEventListener('click', _container._delegateHandler);
            _container._delegateHandler = null;
        }
        _initialized = false;
        console.log('[UIAutoConsume] 已清理');
    }

    // ---------- 暴露全局 ----------
    global.UIAutoConsume = {
        name: 'UIAutoConsume',
        init: init,
        dispose: dispose,
        render: render,
        open: open,
        close: close,
        toggle: toggle,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
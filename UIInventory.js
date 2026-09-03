// js/ui/UIInventory.js
(function(global) {
    'use strict';

    // ============================================================
    //  配置
    // ============================================================
    const CONFIG = {
        defaultSlot: null,
    };

    // ===== 状态变量 =====
    var isOpen = false;
    var currentCategory = '武器';
    var sortMode = 'default';
    var detailModal = null;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var _debouncedRender = null;
    var _dropInputModal = null;  // 自定义丢弃输入框

    var _elements = {};
    function _getEl(id) {
        if (!_elements[id]) _elements[id] = document.getElementById(id);
        return _elements[id];
    }

    // ============================================================
    //  工具函数（完全通过 Gateway 访问）
    // ============================================================
    function getItemName(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(templateId) : ('#' + templateId);
    }

    function getItemDef(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
    }

    function getItemType(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getType(templateId) : '其他';
    }

    function getSlotsForItem(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getEquipSlots(templateId) : [];
    }

    function getSellPrice(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getSellPrice(templateId) : 0;
    }



function getDetailedType(def) {
    if (!def) return '未知';
    var type = def.Type || '';

    // ---- 卡片 ----
    if (type === 'Card' || (def.SubType && def.SubType.includes('Card')) || (type === 'Etc' && def.SubType === 'Card')) {
        var locDisplay = global.ItemDataGateway ? global.ItemDataGateway.getCardLocationDisplay(def) : '';
        return locDisplay ? locDisplay : '卡片';
    }

    // ---- 武器 ----
    if (type === 'Weapon') {
        var subDisplay = global.ItemDataGateway ? global.ItemDataGateway.getSubTypeDisplay(def) : '';
        return subDisplay || '武器';
    }

    // ---- 消耗品 ----
    if (type === 'Healing' || type === 'Usable') {
        var subDisplay2 = global.ItemDataGateway ? global.ItemDataGateway.getSubTypeDisplay(def) : '';
        return subDisplay2 || '消耗品';
    }

    // ---- 材料 ----
    if (type === 'Etc') {
        var subDisplay3 = global.ItemDataGateway ? global.ItemDataGateway.getSubTypeDisplay(def) : '';
        return subDisplay3 || '材料';
    }

    // ---- 防具 / 饰品（细化部位） ----
    if (type === 'Armor' || type === 'Accessory') {
        var loc = def.Locations || {};
        var hasTop = !!(loc.Head_Top || loc.Head_Top2 || loc.Costume_Head_Top || loc.Costume_Head_Top2 || loc.Head || loc.Helm || loc.Helmet);
        var hasMid = !!(loc.Head_Mid || loc.Head_Mid2 || loc.Costume_Head_Mid || loc.Costume_Head_Mid2);
        var hasBottom = !!(loc.Head_Bottom || loc.Costume_Head_Bottom || loc.Head_Low);

        if (hasTop && hasMid && hasBottom) return '头饰（上中下）';
        if (hasTop && hasMid) return '头饰（上中）';
        if (hasMid && hasBottom) return '头饰（中下）';
        if (hasTop) return '头饰（上）';
        if (hasMid) return '头饰（中）';
        if (hasBottom) return '头饰（下）';

        if (loc.Accessory || loc.Both_Accessory) return '饰品';
        if (loc.Left_Hand || loc.Shield) return '盾牌';
        if (loc.Garment || loc.Costume_Garment || loc.Manteau || loc.Hood) return '披肩';
        if (loc.Shoes || loc.Boots) return '鞋子';
        if (loc.Armor) return '铠甲';
        return '防具';
    }

    return type || '其他';
}

function _getJobDisplayName(jobKey) {
    if (!jobKey) return '全部';
    // 优先从 JobGateway 获取（数据驱动）
    if (global.JobGateway && typeof global.JobGateway.getJobDef === 'function') {
        var def = global.JobGateway.getJobDef(jobKey);
        if (def && def.name) return def.name;
    }
    // 极少数情况下降级处理（防止 undefined）
    return jobKey;
}

    function getCardLocations(def) {
        if (!def || def.Type !== 'Card') return '';
        var loc = def.Locations || {};
        var keys = Object.keys(loc);
        if (keys.length === 0) return '通用';
        var map = {
            'Weapon': '武器', 'Shield': '盾牌', 'Head': '头饰',
            'Armor': '铠甲', 'Garment': '披肩', 'Shoes': '鞋子',
            'Accessory': '饰品', 'Both_Accessory': '饰品',
            'Head_Top': '头饰上', 'Head_Mid': '头饰中', 'Head_Bottom': '头饰下','Head_Low': '头饰下',
        };
        return keys.map(function(k) { return map[k] || k; }).join('/');
    }

    function getItemEffectDescription(def) {
        if (!def || !def.Script) return '';
        var script = def.Script;
        var matches = script.match(/bonus\s+(b\w+)\s*,\s*(\d+)/g);
        if (!matches) return '';
        var map = {
            'bStr': '力量', 'bAgi': '敏捷', 'bVit': '体质', 'bInt': '智力',
            'bDex': '灵巧', 'bLuk': '幸运',
            'bAtk': '攻击', 'bMatk': '魔攻', 'bDef': '防御', 'bMdef': '魔防',
            'bMaxHP': '最大HP', 'bMaxSP': '最大SP', 'bAspd': '攻速',
        };
        var parts = [];
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i];
            var match = m.match(/bonus\s+(b\w+)\s*,\s*(\d+)/);
            if (!match) continue;
            var key = match[1];
            var val = parseInt(match[2], 10);
            var name = map[key] || key.replace('b', '');
            parts.push(name + '+' + val);
        }
        return parts.join('、');
    }

    function sortStacks(stacks, mode) {
        if (mode === 'default') return stacks;
        var sorted = stacks.slice();
        if (mode === 'id_asc') sorted.sort(function(a, b) { return a.templateId - b.templateId; });
        else if (mode === 'id_desc') sorted.sort(function(a, b) { return b.templateId - a.templateId; });
        return sorted;
    }

    // ============================================================
    //  自定义丢弃输入模态框（替代 prompt）
    // ============================================================
    function _ensureDropInputModal() {
        if (_dropInputModal) return _dropInputModal;
        var div = document.createElement('div');
        div.id = 'drop-input-modal';
        div.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.4);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10040;
            backdrop-filter: blur(2px);
        `;
        div.innerHTML = `
            <div style="background:#fff; color:#333; border-radius:12px; padding:24px; max-width:360px; width:90%; box-shadow:0 8px 40px rgba(0,0,0,0.25);">
                <h4 style="margin:0 0 12px 0;">丢弃物品</h4>
                <p id="drop-input-hint" style="margin:0 0 10px 0; font-size:0.9rem; color:#666;">请输入要丢弃的数量：</p>
                <input id="drop-input-field" type="number" min="1" style="width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px; font-size:1rem; box-sizing:border-box;">
                <div style="display:flex; gap:10px; margin-top:14px; justify-content:flex-end;">
                    <button id="drop-input-cancel" style="padding:6px 20px; border:1px solid #ccc; border-radius:6px; background:#f0f0f0; cursor:pointer;">取消</button>
                    <button id="drop-input-confirm" style="padding:6px 20px; border:none; border-radius:6px; background:#cc4444; color:#fff; cursor:pointer;">确认丢弃</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        var field = div.querySelector('#drop-input-field');
        var confirmBtn = div.querySelector('#drop-input-confirm');
        var cancelBtn = div.querySelector('#drop-input-cancel');

        var closeHandler = function() { div.style.display = 'none'; };
        var confirmHandler = function() {
            var val = parseInt(field.value, 10);
            if (isNaN(val) || val < 1) { alert('请输入有效数量'); return; }
            if (_dropInputCallback) _dropInputCallback(val);
            div.style.display = 'none';
        };
        var keyHandler = function(e) {
            if (e.key === 'Enter') { confirmHandler(); }
            if (e.key === 'Escape') { div.style.display = 'none'; }
        };

        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', closeHandler);
        field.addEventListener('keydown', keyHandler);
        div.addEventListener('click', function(e) { if (e.target === div) div.style.display = 'none'; });

        _domListeners.push({ el: confirmBtn, event: 'click', fn: confirmHandler });
        _domListeners.push({ el: cancelBtn, event: 'click', fn: closeHandler });
        _domListeners.push({ el: field, event: 'keydown', fn: keyHandler });

        _dropInputModal = div;
        return div;
    }

    var _dropInputCallback = null;

    function showDropInput(maxCount, callback) {
        var modal = _ensureDropInputModal();
        var field = modal.querySelector('#drop-input-field');
        var hint = modal.querySelector('#drop-input-hint');
        hint.textContent = '请输入要丢弃的数量（1 ~ ' + maxCount + '）：';
        field.value = Math.min(1, maxCount);
        field.max = maxCount;
        field.min = 1;
        _dropInputCallback = callback;
        modal.style.display = 'flex';
        setTimeout(function() { field.focus(); field.select(); }, 50);
    }

    // ============================================================
    //  详情弹窗（纯 UI，数据通过事件获取）
    // ============================================================
    function _ensureDetailModal() {
        if (detailModal) return detailModal;
        var div = document.createElement('div');
        div.id = 'item-detail-modal';
        div.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.35);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10030;
            backdrop-filter: blur(2px);
        `;
        div.innerHTML = `
            <div style="background:#fff; color:#333; border-radius:12px; padding:22px; max-width:460px; width:92%; max-height:80vh; overflow-y:auto; box-shadow:0 8px 40px rgba(0,0,0,0.25);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e0e0e0; padding-bottom:8px; margin-bottom:12px;">
                    <h3 id="item-detail-title" style="margin:0; font-size:1.2rem;">物品详情</h3>
                    <button id="item-detail-close" style="background:none; border:none; font-size:1.6rem; cursor:pointer; color:#999;">&times;</button>
                </div>
                <div id="item-detail-body" style="font-size:0.92rem; line-height:1.6;"></div>
                <div id="item-detail-actions" style="border-top:1px solid #e0e0e0; padding-top:10px; margin-top:12px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;"></div>
            </div>
        `;
        document.body.appendChild(div);
        div.addEventListener('click', function(e) { if (e.target === div) closeDetail(); });

            // ★ 新增：为右上角 X 按钮绑定关闭事件
    var closeBtn = div.querySelector('#item-detail-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeDetail();
        });
    }

        detailModal = div;
        return div;
    }

    function _detailBtn(label, style, fn) {
        return { label: label, style: style, fn: fn };
    }

    // ---- 显示详情（数据从 Repository 直接读取，不经过 Service） ----
    function showItemDetail(key, fromEquipSlot) {
        // 获取数据
        var repo = global.InventoryRepository;
        if (!repo) { alert('背包仓储未加载'); return; }

        var target = null;
        var isEquipped = false;
        var equipSlot = null;
        var stackKey = null;

        if (fromEquipSlot) {
            var equipped = repo.getEquipped();
            var info = equipped[fromEquipSlot];
            if (!info) { alert('该槽位无装备'); return; }
            target = { templateId: info.templateId, refine: info.refine || 0, cards: info.cards || [], enchant: info.enchant || null };
            isEquipped = true;
            equipSlot = fromEquipSlot;
        } else {
            var stacks = repo.getAllStacks(true);
            var stack = null;
            for (var i = 0; i < stacks.length; i++) {
                if (stacks[i].key === key) { stack = stacks[i]; break; }
            }
            if (!stack) { alert('物品不存在'); return; }
            target = { templateId: stack.templateId, refine: stack.refine || 0, cards: stack.cards || [], enchant: stack.enchant || null };
            isEquipped = !!stack.equipped;
            stackKey = stack.key;
        }

        var def = getItemDef(target.templateId);
        if (!def) { alert('物品定义缺失（ID: ' + target.templateId + '）'); return; }

        // 渲染
        var modalEl = _ensureDetailModal();
        var refineText = target.refine > 0 ? '+' + target.refine + ' ' : '';
        var titleEl = modalEl.querySelector('#item-detail-title');
        titleEl.textContent = refineText + getItemName(target.templateId) + (isEquipped ? '（已装备）' : '');

        var stats = [];
        if (typeof def.Attack === 'number') stats.push('攻击 ' + def.Attack);
        if (typeof def.MagicAttack === 'number') stats.push('魔攻 ' + def.MagicAttack);
        if (typeof def.Defense === 'number') stats.push('防御 ' + def.Defense);
        if (typeof def.MagicDefense === 'number') stats.push('魔防 ' + def.MagicDefense);
        if (typeof def.Weight === 'number') stats.push('重量 ' + def.Weight);
        if (typeof def.Range === 'number') stats.push('射程 ' + def.Range + ' 格');
        if (typeof def.Slots === 'number') stats.push('孔数 ' + def.Slots);
        if (typeof def.EquipLevelMin === 'number' && def.EquipLevelMin > 0) stats.push('需求等级 ' + def.EquipLevelMin);
// 职业列表转换
var jobKeys = def.Jobs ? Object.keys(def.Jobs).filter(function(k) { return def.Jobs[k] && k !== 'All'; }) : [];
var jobLimit;
if (jobKeys.length === 0) {
    jobLimit = '全部';
} else {
    var jobNames = jobKeys.map(_getJobDisplayName);
    jobLimit = jobNames.join('、');  // 用顿号分隔，更符合中文习惯
}

        var cardsHtml = (target.cards && target.cards.length > 0)
            ? target.cards.map(function(cid, idx) {
                return '<div style="margin:2px 0;">· 卡片' + (idx + 1) + '：' + getItemName(cid) + '</div>';
              }).join('')
            : '<div style="color:#999;">无</div>';

        var effectText = getItemEffectDescription(def);

        // 附魔词条显示（ROUND4）
        var enchantHtml = '';
        if (target.enchant && global.EnchantConfig) {
            var affixDef = global.EnchantConfig.affixes[target.enchant.affixId];
            if (affixDef) {
                enchantHtml = '<div style="background:#f5f0ff; border-left:3px solid #8e44ad; padding:6px 10px; margin-top:8px;"><strong>附魔：</strong>Lv.' +
                    target.enchant.level + '「' + affixDef.name + '（' + target.enchant.quality + '）」</div>';
            }
        }

        var bodyEl = modalEl.querySelector('#item-detail-body');
        bodyEl.innerHTML = `
    <div><strong>类型：</strong>${getDetailedType(def)}</div>
    <div><strong>职业限制：</strong>${jobLimit}</div>
            ${stats.length > 0 ? '<div><strong>基础数值：</strong>' + stats.join('　|　') + '</div>' : ''}
            <div><strong>已插卡片：</strong>${cardsHtml}</div>
            ${enchantHtml}
            ${effectText ? '<div style="background:#f2f7ff; border-left:3px solid #4a90d9; padding:6px 10px; margin-top:8px;"><strong>效果：</strong>' + effectText + '</div>' : ''}
            ${def.Script && !effectText ? '<div style="background:#f7f7f7; padding:6px 10px; margin-top:8px; font-family:monospace; font-size:0.8rem; word-break:break-all;">' + def.Script.replace(/</g, '&lt;') + '</div>' : ''}
        `;

        // 操作按钮（全部通过事件发送）
        var actionsEl = modalEl.querySelector('#item-detail-actions');
        actionsEl.innerHTML = '';
        var buttons = [];
        var bus = global.EventBus;

        if (isEquipped) {
            buttons.push(_detailBtn('卸下装备', '#e67e22', function() {
                if (bus) bus.emit('ui:unequip-item', { slot: equipSlot });
                closeDetail();
            }));
        } else {
            var mainType = getItemType(target.templateId);
            var slots = getSlotsForItem(target.templateId);
            if (mainType === '消耗' || mainType === '消耗品') {
                buttons.push(_detailBtn('使用', '#4a90d9', function() {
                    if (bus) bus.emit('ui:use-item', { stackKey: stackKey });
                    closeDetail();
                }));
            } else if (slots.length > 0) {
                buttons.push(_detailBtn('装备到 ' + slots.join(','), '#4caf50', function() {
                    if (bus) bus.emit('ui:equip-item', {
                        slots: slots,
                        templateId: target.templateId,
                        refine: target.refine,
                        cards: target.cards,
                        stackKey: stackKey
                    });
                    closeDetail();
                }));
            } else {
                buttons.push(_detailBtn('无法装备', '#999', function() {}));
            }
            buttons.push(_detailBtn('丢弃', '#cc4444', function() {
                if (!stackKey) { alert('已装备物品请先卸下'); return; }
                // 获取当前数量
                var allStacks = repo.getAllStacks(true);
                var s = null;
                for (var si = 0; si < allStacks.length; si++) {
                    if (allStacks[si].key === stackKey) { s = allStacks[si]; break; }
                }
                if (!s) { alert('物品已不存在'); return; }
                if (s.count === 1) {
                    if (bus) bus.emit('ui:drop-item', { stackKey: stackKey, count: 1 });
                    closeDetail();
                } else {
                    showDropInput(s.count, function(count) {
                        if (bus) bus.emit('ui:drop-item', { stackKey: stackKey, count: count });
                        closeDetail();
                    });
                }
            }));
        }
        // buttons.push(_detailBtn('关闭', '#888', function() { closeDetail(); }));

        // ---- 精炼按钮（ROUND3：武器/防具类显示，走 RefineService，确认弹窗由 init.js 处理） ----
        if (global.RefineService && global.RefineService.isRefinable(def)) {
            buttons.unshift(_detailBtn(target.refine > 0 ? ('精炼 +' + (target.refine + 1)) : '精炼', '#8e44ad', function() {
                if (bus) bus.emit('ui:refine-item', isEquipped ? { slot: equipSlot } : { stackKey: stackKey });
                closeDetail();
            }));
        }

        // ---- 附魔按钮（ROUND4：装备类显示，走 EnchantService，确认弹窗由 init.js 处理） ----
        if (global.EnchantService && global.EnchantService.isEnchantable(def)) {
            buttons.unshift(_detailBtn('附魔', '#2980b9', function() {
                if (bus) bus.emit('ui:enchant-item', isEquipped ? { slot: equipSlot } : { stackKey: stackKey });
                closeDetail();
            }));
        }

        for (var bi = 0; bi < buttons.length; bi++) {
            var btnData = buttons[bi];
            var b = document.createElement('button');
            b.textContent = btnData.label;
            b.style.cssText = 'background:' + btnData.style + '; border:none; color:#fff; padding:6px 18px; border-radius:6px; cursor:pointer; font-size:0.9rem;';
            b.addEventListener('click', btnData.fn);
            actionsEl.appendChild(b);
        }

        modalEl.style.display = 'flex';
    }

    function closeDetail() {
        if (detailModal) detailModal.style.display = 'none';
    }

    // ============================================================
    //  主背包渲染（完全通过 Gateway 和 Repository）
    // ============================================================
    function renderInventory() {
        var repo = global.InventoryRepository;
        if (!repo) {
var body = document.getElementById('inventory-body');
            if (body) body.innerHTML = '<div style="padding:30px; text-align:center; color:#999;">背包仓储未加载</div>';
            return;
        }

        var allStacks = repo.getAllStacks(false);
        var stacks = allStacks.filter(function(s) {
            var t = getItemType(s.templateId);
            if (currentCategory === '消耗品') return t === '消耗';
            return t === currentCategory;
        });
        stacks = sortStacks(stacks, sortMode);

        var totalItems = 0;
        for (var si = 0; si < stacks.length; si++) totalItems += stacks[si].count;
        var distinctCount = stacks.length;

        var summary = document.getElementById('inventory-summary');
        if (summary) {
            summary.textContent = '共 ' + distinctCount + ' 种物品 | 总计 ' + totalItems + ' 件 | 排序: ' +
                (sortMode === 'default' ? '默认' : sortMode === 'id_asc' ? 'ID ↑' : 'ID ↓');
        }

       var body = document.getElementById('inventory-body');
        if (!body) return;

        if (stacks.length === 0) {
            body.innerHTML = '<div style="padding:40px; text-align:center; color:#999; font-size:1.1rem;">背包空空如也...</div>';
            return;
        }

        var groups = {};
        groups[currentCategory] = stacks;

        var order = ['武器', '防具', '饰品', '消耗品', '材料', '卡片', '其他'];
        var html = '';
        for (var ci = 0; ci < order.length; ci++) {
            var cat = order[ci];
            var items = groups[cat] || [];
            if (items.length === 0) continue;
            html += '<div style="margin-bottom:18px;">';
            html += '<div style="font-weight:bold; font-size:1.65rem; padding:4px 0; border-bottom:2px solid #ddd; margin-bottom:6px;">' + cat + '</div>';
            html += '<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">';
            html += '<thead><tr style="background:#f5f5f5; border-bottom:1px solid #ddd;">';


html += '<th style="text-align:left; padding:4px 6px; width:20%;">名称</th>';
html += '<th style="text-align:left; padding:4px 6px; width:15%;">子类型</th>';
html += '<th style="text-align:center; padding:4px 6px; width:5%;">孔</th>';
html += '<th style="text-align:center; padding:4px 6px; width:6%;">等级</th>';
html += '<th style="text-align:left; padding:4px 6px; width:22%;">职业</th>'; // 加大，给中文留空间
html += '<th style="text-align:center; padding:4px 6px; width:6%;">数量</th>';
html += '<th style="text-align:center; padding:4px 6px; width:16%;">操作</th>';
            html += '</tr></thead><tbody>';

            for (var ii = 0; ii < items.length; ii++) {
                var item = items[ii];
                var def = getItemDef(item.templateId);
                var name = getItemName(item.templateId);
                var refine = item.refine > 0 ? '+' + item.refine + ' ' : '';
                var displayName = refine + name;
                var mainType = getItemType(item.templateId);
                var subType = def ? getDetailedType(def) : '?';
                var slots = def ? getSlotsForItem(def.Id) : [];
                var slotStr = slots.join(',');

                var slotCount = def ? (def.Slots || 0) : 0;
                var levelReq = def ? (def.EquipLevelMin || '-') : '-';

var jobLimit = '全部';
if (def && def.Jobs) {
    var jobKeys = Object.keys(def.Jobs).filter(function(k) { return def.Jobs[k] && k !== 'All'; });
    if (jobKeys.length === 0) {
        jobLimit = '全部';
    } else {
        var jobNames = jobKeys.map(_getJobDisplayName);
        jobLimit = jobNames.length > 3 ? jobNames.slice(0, 3).join('/') + '…' : jobNames.join('/');
    }
}


                // var cardLoc = (def && def.Type === 'Card') ? getCardLocations(def) : '';

                var actions = '';
                var type = mainType;
                if (type === '消耗' || type === '消耗品') {
                    actions = '<button class="btn-action btn-use" data-key="' + item.key + '" data-action="use">使用</button>';
                } else if (type === '卡片') {
                    actions = '<button class="btn-action btn-insert" data-key="' + item.key + '" data-action="insert">镶嵌</button>';
                } else if (type === '武器' || type === '防具' || type === '饰品') {
                    var isEquipped = item.equipped || false;
                    if (isEquipped) {
                        actions = '<button class="btn-action btn-unequip" data-key="' + item.key + '" data-action="unequip">卸下</button>';
                    } else if (slotStr) {
                        actions = '<button class="btn-action btn-equip" data-key="' + item.key + '" data-slots="' + slotStr + '" data-template-id="' + item.templateId + '" data-refine="' + (item.refine || 0) + '" data-cards=\'' + JSON.stringify(item.cards || []) + '\' data-action="equip">装备</button>';
                    } else {
                        actions = '<span style="color:#999;font-size:12px;">无法装备</span>';
                    }
                }
                actions += '<button class="btn-action btn-drop" data-key="' + item.key + '" data-action="drop">丢弃</button>';

                html += '<tr style="border-bottom:1px solid #eee; cursor:pointer;" data-key="' + item.key + '" class="item-row">';
                html += '<td style="padding:4px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="' + displayName + '">' + displayName + '</td>';
                html += '<td style="padding:4px 6px;">' + subType + '</td>';
                html += '<td style="text-align:center; padding:4px 6px;">' + slotCount + '</td>';
                html += '<td style="text-align:center; padding:4px 6px;">' + levelReq + '</td>';
                html += '<td style="padding:4px 6px; font-size:0.8rem;">' + jobLimit + '</td>';
                html += '<td style="text-align:center; padding:4px 6px;">' + item.count + '</td>';
                html += '<td style="text-align:center; padding:4px 6px; white-space:nowrap;">' + actions + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table></div>';
        }

        body.innerHTML = html;
    }

    // ============================================================
    //  操作处理（全部改为事件发送）
    // ============================================================
    function handleAction(action, key, e) {
        var bus = global.EventBus;
        if (!bus) { alert('事件总线未加载'); return; }

        switch (action) {
            case 'equip': {
                var btn = e ? e.target.closest('.btn-equip') : null;
                if (!btn) { alert('按钮丢失'); return; }
                var slotsStr = btn.dataset.slots;
                if (!slotsStr) { alert('槽位数据缺失'); return; }
                var slots = slotsStr.split(',').filter(function(s) { return s; });
                var templateId = parseInt(btn.dataset.templateId, 10);
                var refine = parseInt(btn.dataset.refine, 10) || 0;
                var cards = JSON.parse(btn.dataset.cards || '[]');
                bus.emit('ui:equip-item', { slots: slots, templateId: templateId, refine: refine, cards: cards, stackKey: key });
                break;
            }
            case 'unequip': {
                var repo = global.InventoryRepository;
                if (!repo) { alert('背包仓储未加载'); return; }
                var equipped = repo.getEquipped();
                var targetSlot = null;
                for (var slot in equipped) {
                    if (equipped.hasOwnProperty(slot) && equipped[slot] && equipped[slot].stackKey === key) {
                        targetSlot = slot;
                        break;
                    }
                }
                if (!targetSlot) { alert('该物品未装备'); return; }
                bus.emit('ui:unequip-item', { slot: targetSlot });
                break;
            }
            case 'use': {
                bus.emit('ui:use-item', { stackKey: key });
                break;
            }
            case 'insert': {
                if (global.UICardManager && typeof global.UICardManager.open === 'function') {
                    global.UICardManager.open();
                } else {
                    alert('卡片管理器未加载');
                }
                break;
            }
            case 'drop': {
                var repo2 = global.InventoryRepository;
                if (!repo2) { alert('背包仓储未加载'); return; }
                var allStacks = repo2.getAllStacks(true);
                var stack = null;
                for (var si = 0; si < allStacks.length; si++) {
                    if (allStacks[si].key === key) { stack = allStacks[si]; break; }
                }
                if (!stack) { alert('物品已不存在'); return; }
                if (stack.count === 1) {
                    bus.emit('ui:drop-item', { stackKey: key, count: 1 });
                } else {
                    showDropInput(stack.count, function(count) {
                        bus.emit('ui:drop-item', { stackKey: key, count: count });
                    });
                }
                break;
            }
            default:
                console.warn('[UIInventory] 未知操作:', action);
        }
    }

    // ============================================================
    //  徽标、打开/关闭、初始化
    // ============================================================
    function updateBadge() {
        var repo = global.InventoryRepository;
        var badge = document.getElementById('bag-count');
        if (badge) {
            var total = 0;
            if (repo) {
                var stacks = repo.getAllStacks(true);
                for (var i = 0; i < stacks.length; i++) total += stacks[i].count;
            }
            badge.textContent = total;
        }
    }

    function openBag() {
        if (isOpen) {
            renderInventory();
            return;
        }

        // 只保留一次 UIPanel.show 调用，删除重复代码
        UIPanel.show({
            preset: 'large',
            title: { icon: '🎒', text: '背包' },
            content: `
                <div class="inventory-tabs" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; border-bottom:1px solid #e8eaee; padding-bottom:8px;">
                    ${['武器','防具','饰品','消耗品','材料','卡片'].map(function(cat) {
                        return '<button class="tab-btn ' + (cat === currentCategory ? 'active' : '') + '" data-cat="' + cat + '" style="padding:4px 16px; border:1px solid #ccc; background:' + (cat === currentCategory ? '#e0e0e0' : '#fff') + '; border-radius:6px; cursor:pointer; font-size:0.9rem; transition:0.1s;">' + cat + '</button>';
                    }).join('')}
                </div>
                <div id="inventory-body" style="flex:1; overflow-y:auto; padding:4px 0; min-height:320px;"></div>
                <div style="border-top:1px solid #e8eaee; padding-top:10px; margin-top:6px; display:flex; justify-content:space-between; align-items:center; font-size:0.9rem; color:#666;">
                    <span id="inventory-summary">共 0 种物品 | 总计 0 件</span>
                    <button id="inventory-refresh-btn" style="background:#f0f0f0; border:1px solid #d0d4da; border-radius:6px; padding:3px 16px; cursor:pointer; font-size:0.85rem;">刷新</button>
                </div>
            `,
            onClose: function() {
                isOpen = false;
            }
        });

        isOpen = true;
        renderInventory();
        updateBadge();
        setTimeout(_bindPanelEvents, 150);
    }

    function closeBag() {
        UIPanel.close();
        // onClose 回调中会设置 isOpen = false，但以防万一
        if (isOpen) isOpen = false;
    }

    function toggleBag() {
        if (isOpen) closeBag();
        else openBag();
    }

    // ---------- 绑定背包面板内部事件（委托） ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) {
            // 如果找不到容器，可能是 UIPanel 使用了不同的类名，尝试通过面板 ID 或其它方式
            console.warn('[UIInventory] 未找到面板容器 .ro-panel-container，事件委托可能失效');
            return;
        }

        // 移除旧委托（防止重复绑定）
        if (container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
        }

        var handler = function(e) {
            var target = e.target;

            // 1. 分类标签切换
            var tabBtn = target.closest('.tab-btn');
            if (tabBtn) {
                var cat = tabBtn.dataset.cat;
                if (cat && cat !== currentCategory) {
                    currentCategory = cat;
                    container.querySelectorAll('.tab-btn').forEach(function(b) {
                        var isActive = (b === tabBtn);
                        b.classList.toggle('active', isActive);
                        b.style.background = isActive ? '#e0e0e0' : '#fff';
                    });
                    renderInventory();
                }
                return;
            }

            // 2. 刷新按钮
            if (target.id === 'inventory-refresh-btn') {
                renderInventory();
                updateBadge();
                return;
            }

            // 3. 物品行点击 -> 详情
            var row = target.closest('.item-row');
            if (row) {
                var key = row.dataset.key;
                if (key) {
                    showItemDetail(key, null);
                }
                return;
            }

            // 4. 操作按钮（使用/装备/卸下/丢弃/镶嵌）
            var btn = target.closest('.btn-action');
            if (btn) {
                e.stopPropagation();
                var key = btn.dataset.key;
                var action = btn.dataset.action;
                if (key && action) {
                    handleAction(action, key, e);
                }
                return;
            }

            // 5. 表头排序
            var th = target.closest('.sortable');
            if (th) {
                if (sortMode === 'default') sortMode = 'id_asc';
                else if (sortMode === 'id_asc') sortMode = 'id_desc';
                else if (sortMode === 'id_desc') sortMode = 'default';
                renderInventory();
                return;
            }
        };

        container.addEventListener('click', handler);
        container._panelHandler = handler;
    }

    // ============================================================
    //  事件绑定
    // ============================================================
    function _bindEvents() {
        var bus = global.EventBus;
        if (!bus) return;

        _debouncedRender = global.UIManager ? global.UIManager.debounce(renderInventory.bind(this), 300) : renderInventory;

        function onOpenBag() { toggleBag(); }
        function onInventoryChanged() {
            if (isOpen) _debouncedRender();
            updateBadge();
        }
        function onCharChanged() {
            if (isOpen) _debouncedRender();
            updateBadge();
        }
        function onRefreshInventory() {
            _debouncedRender();
            updateBadge();
        }

        bus.on('ui:open-bag', onOpenBag);
        _listeners.push({ event: 'ui:open-bag', fn: onOpenBag });

        bus.on('inventory:changed', onInventoryChanged);
        _listeners.push({ event: 'inventory:changed', fn: onInventoryChanged });

        bus.on('char:changed', onCharChanged);
        _listeners.push({ event: 'char:changed', fn: onCharChanged });

        bus.on('ui:refresh-inventory', onRefreshInventory);
        _listeners.push({ event: 'ui:refresh-inventory', fn: onRefreshInventory });
    }

    // ============================================================
    //  init / dispose
    // ============================================================
    function init() {
        if (_initialized) return;
        if (!global.EventBus) {
            console.error('[UIInventory] EventBus 未加载');
            return;
        }
        _bindEvents();
        updateBadge();
        _initialized = true;
        console.log('[UIInventory] ✅ 已初始化（事件驱动，Gateway 数据源，自定义输入框）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIInventory);
        }
    }

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
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];

        // 清理面板上的事件委托
        var container = document.querySelector('.ro-panel-container');
        if (container && container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            delete container._panelHandler;
        }

        if (detailModal) detailModal.style.display = 'none';
        if (_dropInputModal) _dropInputModal.style.display = 'none';
        isOpen = false;
        _initialized = false;
        console.log('[UIInventory] 事件监听已清理');
    }

    global.UIInventory = {
        name: 'UIInventory',
        init: init,
        dispose: dispose,
        openBag: openBag,
        closeBag: closeBag,
        toggleBag: toggleBag,
        renderInventory: renderInventory,
        updateBadge: updateBadge,
        showItemDetail: showItemDetail,
        _handleAction: handleAction,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
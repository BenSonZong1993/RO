// js/ui/UIShop.js
// 重构版：使用 UIPanel 统一容器，支持装备商店和药水商店
(function(global) {
    'use strict';

    const PAGE_SIZE = 20;
    const DEFAULT_ZENY = 10000;

    let _isOpen = false;
    let _currentShopType = 'equip'; // 'equip' 或 'potion'
    let _allItems = {};            // { category: [items] }
    let _categoryList = [];        // 有序分类名数组
    let _catLabels = {};           // { category: '中文名' }
    let _catColors = {};           // { category: '#color' }
    let _tableHeaders = [];
    let _currentCategory = '';
    let _currentPage = 1;
    let _totalPages = 1;
    let _initialized = false;
    let _domListeners = [];

    // ---------- 辅助函数 ----------
    function _getItemDef(templateId) {
        const sources = [
            global.ItemDataEquip,
            global.ItemDataUsable,
            global.ItemDataEtc
        ];
        for (const arr of sources) {
            if (!arr) continue;
            const found = arr.find(item => item.Id === templateId);
            if (found) return found;
        }
        return null;
    }

function _getDisplayName(item) {
    if (!item) return '未知物品';
    // 使用 ItemDataGateway 统一获取名称（含孔数）
    if (global.ItemDataGateway && typeof global.ItemDataGateway.getDisplayName === 'function') {
        return global.ItemDataGateway.getDisplayName(item.Id);
    }
    // 降级：直接读取字段
    return item.cnName || item.Name || item.AegisName || '#' + item.Id;
}

    function _getTypeCN(item) {
        if (global.ItemTypeMap && typeof global.ItemTypeMap.getTypeCN === 'function') {
            const mapped = global.ItemTypeMap.getTypeCN(item.Type);
            if (mapped) return mapped;
        }
        const map = {
            'Weapon': '武器',
            'Armor': '防具',
            'Accessory': '饰品',
            'Healing': '消耗',
            'Usable': '消耗',
            'Etc': '材料',
            'Card': '卡片',
            'ShadowGear': '时/影装'
        };
        return map[item.Type] || item.Type || '其他';
    }

    function _getWeaponLevel(item) {
        if (item.Type === 'Weapon' && typeof item.WeaponLevel === 'number') {
            return item.WeaponLevel;
        }
        return '-';
    }

    function _getEquipLevel(item) {
        return item.EquipLevelMin || 0;
    }

    // ---------- 解析药水脚本 ----------
    function _parseHealScript(script) {
        if (!script || typeof script !== 'string') return { hp: 0, sp: 0 };
        let hp = 0, sp = 0;
        const lines = script.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            let match = trimmed.match(/itemheal\s+(\d+)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                const minSp = parseInt(match[2], 10);
                const maxSp = parseInt(match[3], 10);
                sp += Math.floor((minSp + maxSp) / 2);
                continue;
            }
            match = trimmed.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*(\d+)\s*;?/i);
            if (match) {
                const minHp = parseInt(match[1], 10);
                const maxHp = parseInt(match[2], 10);
                const spVal = parseInt(match[3], 10);
                hp += Math.floor((minHp + maxHp) / 2);
                sp += spVal;
                continue;
            }
            match = trimmed.match(/itemheal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                sp += parseInt(match[2], 10);
                continue;
            }
            match = trimmed.match(/itemheal\s+(\d+)\s*,\s*(\d+)\s*;?/i);
            if (match) {
                hp += parseInt(match[1], 10);
                sp += parseInt(match[2], 10);
                continue;
            }
        }
        return { hp, sp };
    }

    function _findItemByAegis(aegis) {
        const sources = [
            global.ItemDataEquip,
            global.ItemDataUsable,
            global.ItemDataEtc
        ];
        for (const arr of sources) {
            if (!arr) continue;
            for (const item of arr) {
                if (item.AegisName === aegis) return item;
            }
        }
        return null;
    }

    // ---------- 金币相关 ----------
    function _getZeny() {
        if (global.CharController && typeof global.CharController.getZeny === 'function') {
            return global.CharController.getZeny();
        }
        const char = global.CharController ? global.CharController.getChar() : null;
        if (char && typeof char.zeny === 'number') return char.zeny;
        return DEFAULT_ZENY;
    }

    function _deductZeny(amount) {
        if (global.CharController && typeof global.CharController.deductZeny === 'function') {
            return global.CharController.deductZeny(amount);
        }
        const char = global.CharController ? global.CharController.getChar() : null;
        if (char && typeof char.zeny === 'number' && char.zeny >= amount) {
            char.zeny -= amount;
            if (global.EventBus) global.EventBus.emit('char:changed', { char });
            return true;
        }
        return false;
    }

    function _addZeny(amount) {
        if (global.CharController && typeof global.CharController.addZeny === 'function') {
            return global.CharController.addZeny(amount);
        }
        const char = global.CharController ? global.CharController.getChar() : null;
        if (char && typeof char.zeny === 'number') {
            char.zeny += amount;
            if (global.EventBus) global.EventBus.emit('char:changed', { char });
            return true;
        }
        return false;
    }

// ---------- 构建商品列表 ----------
function _buildItemList(shopType) {
    var config = global.ShopConfig && global.ShopConfig[shopType];
    if (!config) {
        // 如果没有配置，返回空结构（或可保留原过滤作为降级，但建议强制配置）
        console.warn('[UIShop] 未找到 ShopConfig 配置，商店为空');
        return {
            categories: {},
            catList: [],
            catLabels: {},
            catColors: {},
            tableHeaders: []
        };
    }

    // 从 ItemDataGateway 获取物品数据
    var getItem = global.ItemDataGateway && typeof global.ItemDataGateway.getById === 'function'
        ? global.ItemDataGateway.getById
        : function(id) {
            // 降级：直接从全局数据查找（不推荐）
            var all = [].concat(global.ItemDataEquip || [], global.ItemDataUsable || [], global.ItemDataEtc || []);
            for (var i = 0; i < all.length; i++) {
                if (all[i].Id === id) return all[i];
            }
            return null;
        };

    var categories = {};
    var catList = Object.keys(config);
    var catLabels = {};
    var catColors = {};
    var allItems = [];

    // 遍历每个分类
    for (var i = 0; i < catList.length; i++) {
        var catKey = catList[i];
        var idList = config[catKey] || [];
        var items = [];
        for (var j = 0; j < idList.length; j++) {
            var item = getItem(idList[j]);
            if (item) {
                items.push(item);
            } else {
                console.warn('[UIShop] 未找到物品ID:', idList[j]);
            }
        }
        // 按 Id 排序
        items.sort(function(a, b) { return a.Id - b.Id; });
        categories[catKey] = items;
        allItems = allItems.concat(items);
    }

    // 从配置中读取标签和颜色（或者根据分类键名自动生成）
    var labelMap = {
        weapon: '武器', armor: '防具', accessory: '饰品', special: '特殊', other: '其他',
        hp: '回血', sp: '回蓝', both: '双效', status: '状态', other: '其他'
    };
    var colorMap = {
        weapon: '#4CAF50', armor: '#2196F3', accessory: '#FF9800', special: '#9C27B0', other: '#795548',
        hp: '#e74c3c', sp: '#3498db', both: '#9b59b6', status: '#e67e22', other: '#95a5a6'
    };

    for (var k = 0; k < catList.length; k++) {
        var key = catList[k];
        catLabels[key] = labelMap[key] || key;
        catColors[key] = colorMap[key] || '#888888';
    }

    // 根据商店类型决定表头
    var tableHeaders = [];
if (shopType === 'equip') {
    tableHeaders = ['序号', '名称', '子类型', '武器等级', '装备等级', '售价', '操作'];
} else if (shopType === 'potion') {
    tableHeaders = ['序号', '名称', '子类型', '恢复HP', '恢复SP', '售价', '操作'];
}
    else {
        tableHeaders = ['序号', '名称', '类型', '售价', '操作'];
    }

    return {
        categories: categories,
        catList: catList,
        catLabels: catLabels,
        catColors: catColors,
        tableHeaders: tableHeaders
    };
}

    // ---------- 购买逻辑 ----------
async function _handleBuy(aegisName, price) {
    if (!aegisName) {
        await Notification.alert('物品标识缺失', '提示');
        return;
    }
    const itemDef = _findItemByAegis(aegisName);
    if (!itemDef) {
        await Notification.alert('找不到该物品数据', '提示');
        return;
    }

    const input = await Notification.prompt(
        `购买 ${_getDisplayName(itemDef)}，单价 ${price} Zeny，请输入数量：`,
        '1',
        '购买数量'
    );
    if (input === null) return; // 用户取消

    const count = parseInt(input, 10);
    if (isNaN(count) || count <= 0) {
        await Notification.alert('请输入有效的正整数', '提示');
        return;
    }

    const totalCost = price * count;
    const currentZeny = _getZeny();
    if (currentZeny < totalCost) {
        await Notification.alert(`金币不足！需要 ${totalCost}，当前 ${currentZeny}`, '提示');
        return;
    }

    const deductOk = _deductZeny(totalCost);
    if (!deductOk) {
        await Notification.alert('扣除金币失败，请重试', '提示');
        return;
    }

    const addResult = global.InventoryService.addItem(itemDef.Id, 0, count, []);
    if (!addResult || !addResult.success) {
        _addZeny(totalCost);
        await Notification.alert('添加物品失败: ' + (addResult.error || '未知错误'), '提示');
        return;
    }

    _updateZenyDisplay();
    await Notification.alert(`购买成功！获得 ${count} 个 ${_getDisplayName(itemDef)}`, '购买成功');
}
    // ---------- 渲染 ----------
    function render() {
        var container = document.querySelector('.ro-panel-body');
        if (!container) return;

        const list = _allItems[_currentCategory] || [];
        const total = list.length;
        _totalPages = Math.ceil(total / PAGE_SIZE) || 1;
        if (_currentPage > _totalPages) _currentPage = _totalPages;
        if (_currentPage < 1) _currentPage = 1;

        const start = (_currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, total);
        const pageItems = list.slice(start, end);

        const titleMap = { equip: '🏪 装备商店', potion: '🧪 药水商店' };
        const title = titleMap[_currentShopType] || '商店';

        let html = `
            <div style="font-family:sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h2 style="margin:0; font-size:1.2rem;">${title}</h2>
                    <span style="font-size:0.95rem; color:#555;">💰 金币: <strong id="shop-zeny">${_getZeny()}</strong></span>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; border-bottom:1px solid #e8eaee; padding-bottom:8px;">
        `;
        for (const cat of _categoryList) {
            const active = cat === _currentCategory;
            const color = _catColors[cat] || '#999';
            html += `
                <button class="shop-category-btn" data-category="${cat}" style="
                    padding:4px 16px; border:1px solid #ccc; border-radius:6px;
                    background:${active ? color : '#fff'}; color:${active ? '#fff' : '#333'};
                    cursor:pointer; font-size:0.9rem; transition:0.1s;
                ">${_catLabels[cat]}</button>
            `;
        }
        html += `</div>`;

        html += `<div style="overflow-x:auto;">`;
        html += `<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">`;
        html += `<thead><tr style="background:#f5f5f5; border-bottom:2px solid #ddd;">`;
        const headers = _tableHeaders || ['序号','名称','类型','售价','操作'];
        for (const h of headers) {
            html += `<th style="padding:6px 8px; text-align:center;">${h}</th>`;
        }
        html += `</tr></thead><tbody>`;

        if (pageItems.length === 0) {
            html += `<tr><td colspan="${headers.length}" style="text-align:center;padding:20px;color:#999;">该分类暂无商品</td></tr>`;
        } else {
            for (let i = 0; i < pageItems.length; i++) {
                const item = pageItems[i];
                const idx = start + i + 1;

const name = _getDisplayName(item);
// 替换 typeCN 为子类型
let subType = '';
if (global.ItemDataGateway && typeof global.ItemDataGateway.getSubTypeDisplay === 'function') {
    subType = global.ItemDataGateway.getSubTypeDisplay(item);
} else {
    subType = item.SubType || '';  // 降级
}
const weaponLv = _getWeaponLevel(item);
const equipLv = _getEquipLevel(item);


                const buyPrice = item.Buy || 0;
                const aegis = item.AegisName;

                let healHp = '-', healSp = '-';
                if (_currentShopType === 'potion') {
                    const heal = _parseHealScript(item.Script);
                    healHp = heal.hp || '-';
                    healSp = heal.sp || '-';
                }

                html += `<tr style="border-bottom:1px solid #eee;">`;
                html += `<td style="padding:6px 8px; text-align:center;">${idx}</td>`;
                html += `<td style="padding:6px 8px; text-align:left;">${name}</td>`;
       html += `<td style="padding:6px 8px; text-align:center;">${subType}</td>`;
                
                if (_currentShopType === 'equip') {
                    html += `<td style="padding:6px 8px; text-align:center;">${weaponLv}</td>`;
                    html += `<td style="padding:6px 8px; text-align:center;">${equipLv}</td>`;
                } else {
                    html += `<td style="padding:6px 8px; text-align:center;">${healHp}</td>`;
                    html += `<td style="padding:6px 8px; text-align:center;">${healSp}</td>`;
                }
                html += `<td style="padding:6px 8px; text-align:center;">${buyPrice}</td>`;
                html += `<td style="padding:6px 8px; text-align:center;">
                    <button class="shop-buy-btn" data-aegis="${aegis}" data-price="${buyPrice}" style="
                        background:#2196F3; color:#fff; border:none; border-radius:4px;
                        padding:3px 12px; cursor:pointer; font-size:0.85rem;
                    ">购买</button>
                </td></tr>`;
            }
        }
        html += `</tbody></table></div>`;

        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:8px; border-top:1px solid #e8eaee; padding-top:10px;">`;
        html += `<div>
            <button class="shop-page-btn" data-page="prev" style="padding:3px 12px; border:1px solid #ccc; border-radius:4px; background:#fff; cursor:pointer;">上一页</button>
            <span style="margin:0 8px; font-size:0.9rem;">第 ${_currentPage} / ${_totalPages} 页</span>
            <button class="shop-page-btn" data-page="next" style="padding:3px 12px; border:1px solid #ccc; border-radius:4px; background:#fff; cursor:pointer;">下一页</button>
        </div>`;
        html += `<div>
            <span style="font-size:0.85rem;">跳转</span>
            <input id="shop-goto-input" type="number" min="1" max="${_totalPages}" value="${_currentPage}" style="width:48px; padding:2px 4px; border:1px solid #ccc; border-radius:4px; text-align:center;">
            <button id="shop-goto-btn" style="padding:3px 12px; border:1px solid #ccc; border-radius:4px; background:#fff; cursor:pointer;">GO</button>
        </div>`;
        html += `<div>
            <button id="shop-close-btn" style="padding:3px 16px; border:1px solid #ccc; border-radius:4px; background:#f44336; color:#fff; cursor:pointer;">关闭商店</button>
        </div></div>`;

        container.innerHTML = html;
        _updateZenyDisplay();
    }

    function _updateZenyDisplay() {
        const el = document.querySelector('#shop-zeny');
        if (el) el.textContent = _getZeny();
    }

    // ---------- 打开/关闭 ----------
    function open(shopType) {
        if (!shopType) shopType = 'equip';
        if (!['equip','potion'].includes(shopType)) shopType = 'equip';

        if (_isOpen && _currentShopType === shopType) {
            refresh();
            return;
        }

        _currentShopType = shopType;
        const built = _buildItemList(shopType);
        _allItems = built.categories;
        _categoryList = built.catList;
        _catLabels = built.catLabels;
        _catColors = built.catColors;
        _tableHeaders = built.tableHeaders;
        _currentCategory = _categoryList[0] || '';
        _currentPage = 1;

        UIPanel.show({
            preset: 'large',
            title: { icon: '🏪', text: shopType === 'equip' ? '装备商店' : '药水商店' },
            content: '<div id="shop-body" style="min-height:200px;"></div>',
            onClose: function() {
                _isOpen = false;
            }
        });

        _isOpen = true;
        // 先渲染内容再绑定事件
        render();
        _bindPanelEvents();
    }

    function close() {
        UIPanel.close();
        if (_isOpen) _isOpen = false;
    }

    function refresh() {
        if (!_isOpen) return;
        const built = _buildItemList(_currentShopType);
        _allItems = built.categories;
        _categoryList = built.catList;
        _catLabels = built.catLabels;
        _catColors = built.catColors;
        _tableHeaders = built.tableHeaders;
        if (!_categoryList.includes(_currentCategory)) {
            _currentCategory = _categoryList[0] || '';
        }
        render();
        _updateZenyDisplay();
    }

    // ---------- 事件绑定 ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        if (container._shopHandler) {
            container.removeEventListener('click', container._shopHandler);
            delete container._shopHandler;
        }

var handler = async function(e) {
    var target = e.target;

    // 分类切换
    var catBtn = target.closest('.shop-category-btn');
    if (catBtn) {
        var cat = catBtn.dataset.category;
        if (cat && cat !== _currentCategory) {
            _currentCategory = cat;
            _currentPage = 1;
            render();
        }
        return;
    }

    // 翻页
    var pageBtn = target.closest('.shop-page-btn');
    if (pageBtn) {
        var dir = pageBtn.dataset.page;
        if (dir === 'prev' && _currentPage > 1) {
            _currentPage--;
            render();
        } else if (dir === 'next' && _currentPage < _totalPages) {
            _currentPage++;
            render();
        }
        return;
    }

    // 跳转
    if (target.id === 'shop-goto-btn') {
        var input = document.getElementById('shop-goto-input');
        if (input) {
            var val = parseInt(input.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > _totalPages) val = _totalPages;
            _currentPage = val;
            render();
        }
        return;
    }

    // 购买
    var buyBtn = target.closest('.shop-buy-btn');
    if (buyBtn) {
        var aegis = buyBtn.dataset.aegis;
        var price = parseInt(buyBtn.dataset.price, 10);
        await _handleBuy(aegis, price);
        return;
    }

    // 关闭
    if (target.id === 'shop-close-btn') {
        close();
        return;
    }
};

        container.addEventListener('click', handler);
        container._shopHandler = handler;

        // 监听金币变化
        if (global.EventBus) {
            if (container._zenyListener) {
                global.EventBus.off('char:changed', container._zenyListener);
            }
            var zenyListener = function() {
                if (_isOpen) _updateZenyDisplay();
            };
            global.EventBus.on('char:changed', zenyListener);
            container._zenyListener = zenyListener;
        }
    }

    // ---------- 生命周期 ----------
    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container) {
            if (container._shopHandler) {
                container.removeEventListener('click', container._shopHandler);
                delete container._shopHandler;
            }
            if (container._zenyListener && global.EventBus) {
                global.EventBus.off('char:changed', container._zenyListener);
                delete container._zenyListener;
            }
        }
        close();
        _isOpen = false;
        console.log('[UIShop] 已卸载');
    }

    // ---------- 暴露全局 ----------
    global.UIShop = {
        open: open,
        close: close,
        refresh: refresh,
        dispose: dispose,
    };

    console.log('[UIShop] 模块已加载（支持装备商店和药水商店，UIPanel 版）');
})(window);
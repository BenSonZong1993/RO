// ============================================================
//  FILE: ItemDataGateway.js
//  LAYER: gateway（物品静态数据网关——window.ItemData* 唯一读取入口）
//  权限：无（静态只读数据；写入不存在）
//  依赖：window.ItemDataEquip / ItemDataUsable / ItemDataEtc / ItemNameMap / ItemTypeMap
//  契约：规则 GATE-1 —— 禁止任何模块直接访问 window.ItemData*，
//        一律通过 getById / getByAegis / getDisplayName / getType / search
//  接口：
//    getById(templateId)      → object|null（深拷贝）
//    getByAegis(aegisName)    → object|null（深拷贝）
//    getDisplayName(id)       → string（含孔数追加）
//    getType(templateId)      → string（中文分类）
//    getSellPrice(templateId) → number（售价，优先 Sell，缺省 Buy/2）
//    search(keyword)          → array（深拷贝列表，最多50条）
//    getEquipSlots(templateId)→ array（装备槽位列表）
//    getEquipSlotDisplayName(templateId) → string
//    getSubTypeDisplay(def)   → string（子类型中文）
//    getCardLocationDisplay(def) → string（卡片适用部位）
//    getSubCategories(category) → array（子分类列表，含过滤函数）
//    getPaginated(page, size, category, keyword, filterFn) → { total, page, size, data }
//    不再包含：getMonstersThatDropItem / getMapsForMonster（已移至 IndexService）
// ============================================================
(function(global) {
    'use strict';

    var _byId = null;        // templateId → def（原始引用，只读）
    var _byAegis = null;     // AegisName → def
    var _nameReverse = null; // templateId → 中文名（来自 ItemNameMap）
    var _initialized = false;

    function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    function _buildIndexes() {
        if (_initialized) return true;
        _byId = {};
        _byAegis = {};
        var sources = [global.ItemDataEquip, global.ItemDataUsable, global.ItemDataEtc];
        for (var s = 0; s < sources.length; s++) {
            var arr = sources[s];
            if (!Array.isArray(arr)) continue;
            for (var i = 0; i < arr.length; i++) {
                var def = arr[i];
                if (def && typeof def.Id === 'number') {
                    _byId[def.Id] = def;
                    if (def.AegisName) _byAegis[def.AegisName] = def;
                }
            }
        }
        if (global.ItemNameMap && typeof global.ItemNameMap === 'object') {
            _nameReverse = {};
            for (var name in global.ItemNameMap) {
                if (global.ItemNameMap.hasOwnProperty(name)) {
                    _nameReverse[global.ItemNameMap[name]] = name;
                }
            }
        }
        _initialized = true;
        console.log('[ItemDataGateway] ✅ 索引完成，共 ' + Object.keys(_byId).length + ' 件物品');
        return true;
    }
    

    function getById(templateId) {
        _buildIndexes();
        var def = _byId[templateId];
        return def ? _clone(def) : null;
    }

    function getByAegis(aegisName) {
        _buildIndexes();
        var def = _byAegis[aegisName];
        return def ? _clone(def) : null;
    }

    // ---- 中文名（cnName → Name → AegisName → ItemNameMap 反查 → #id） ----
    function getDisplayName(templateId) {
        _buildIndexes();
        var def = _byId[templateId];
        if (def) {
            var name = def.cnName || def.Name || def.AegisName || ('#' + templateId);
            // 孔数追加
            if (def.Slots && def.Slots > 0) {
                name += ' [' + def.Slots + ']';
            }
            return name;
        }
        if (_nameReverse && _nameReverse[templateId]) return _nameReverse[templateId];
        return '#' + templateId;
    }

    // ---- 中文分类（原 ItemStorage.getItemType 逻辑迁入） ----
function getType(templateId) {
    _buildIndexes();
    var def = _byId[templateId];
    if (!def) return '其他';

    // ---- 新增：检查是否有时装特征 ----
    if (def.Locations) {
        var locKeys = Object.keys(def.Locations);
        for (var i = 0; i < locKeys.length; i++) {
            if (locKeys[i].indexOf('Costume_') === 0) {
                return '时装';
            }
        }
    }

    var type = def.Type || '';
    var subType = def.SubType || '';

    // ---- 新增：影装类型 ----
    if (type === 'Shadowgear') return '影子';

    

    if (type === 'Card') return '卡片';
    if (subType && subType.indexOf('Card') !== -1) return '卡片';

    // ---- 头部防具识别 ----
    if (type === 'Armor' && def.Locations) {
        var loc = def.Locations;
        var isHead = !!(loc.Head_Top || loc.Head_Top2 || loc.Costume_Head_Top || loc.Costume_Head_Top2 ||
                        loc.Head_Mid || loc.Head_Mid2 || loc.Costume_Head_Mid || loc.Costume_Head_Mid2 ||
                        loc.Head_Bottom || loc.Costume_Head_Bottom || loc.Head_Low ||
                        loc.Head || loc.Helm || loc.Helmet);
        if (isHead) return '头饰';
        // 饰品：作为防具的子类，但一级分类仍返回"防具"（让饰品并入防具大类）
        // 注意：不要再返回"饰品"，统一归入"防具"
        return '防具';
    }

    // ---- 独立类型：时装/影子 ----
    if (subType && subType.indexOf('Costume') !== -1) return '时装';
    if (subType && subType.indexOf('Shadow') !== -1) return '影子';

    if (global.ItemTypeMap && typeof global.ItemTypeMap.getTypeCN === 'function') {
        var mapped = global.ItemTypeMap.getTypeCN(type);
        if (mapped) return mapped;
    }

    var fallbackMap = {
        'Weapon': '武器', 'Armor': '防具', 'Accessory': '防具',  // Accessory 也归入防具
        'Healing': '其他', 'Usable': '其他', 'Etc': '其他',
    };
    return fallbackMap[type] || '其他';
}

    // ---- 售价（回收商人/自动出售用；Sell 优先，缺省按 Buy/2，RO 惯例） ----
    function getSellPrice(templateId) {
        _buildIndexes();
        var def = _byId[templateId];
        if (!def) return 0;
        if (typeof def.Sell === 'number' && def.Sell > 0) return def.Sell;
        if (typeof def.Buy === 'number' && def.Buy > 0) return Math.floor(def.Buy / 2);
        return 0;
    }

    // ============================================================
    //  多槽位支持（唯一事实来源）
    // ============================================================
    var SLOT_MAP = {
        'Weapon': 'weapon',
        'Head_Top': 'headTop', 'Head_Top2': 'headTop', 'Costume_Head_Top': 'headTop', 'Costume_Head_Top2': 'headTop',
        'Head': 'headTop', 'Helm': 'headTop', 'Helmet': 'headTop',
        'Head_Mid': 'headMid', 'Head_Mid2': 'headMid', 'Costume_Head_Mid': 'headMid', 'Costume_Head_Mid2': 'headMid',
        'Head_Bottom': 'headBottom', 'Costume_Head_Bottom': 'headBottom', 'Head_Low': 'headBottom',
        'Accessory': 'accessory1', 'Both_Accessory': 'accessory1',
        'Armor': 'armor', 'Garment': 'garment', 'Manteau': 'garment', 'Hood': 'garment', 'Costume_Garment': 'garment',
        'Shoes': 'shoes', 'Boots': 'shoes',
        'Shield': 'shield', 'Left_Hand': 'shield',
        'Mount': 'mount',
    };

    // ---- 子类型中文映射 ----
    var SUB_TYPE_MAP = {
        'Dagger': '短剑',
        '1hSword': '单手剑',
        '2hSword': '双手剑',
        'Bow': '弓',
        'Mace': '钝器',
        'Staff': '法杖',
        'Book': '书',
        'Katar': '拳刃',
        'Knuckle': '拳套',
        'Whip': '鞭子',
        'Instrument': '乐器',
        'Revolver': '左轮枪',
        'Rifle': '步枪',
        'Gatling': '加特林',
        'Shotgun': '霰弹枪',
        'Grenade': '榴弹枪',
        'Huuma': '风魔手里剑',
        '2hAxe': '双手斧',
        '2hStaff': '双手杖',
        'Axe': '斧',
        '1hAxe': '单手斧',
        '2hAxe': '双手斧',
        '1hSpear': '单手矛',
        '2hSpear': '双手矛',
        'Musical': '乐器',
        'Mace2': '钝器',
        'Sword': '剑',
        'Rod': '魔杖',
        'Dagger2': '短剑',
        'Handgun': '手枪',
        'Rifle2': '步枪',
        'Whip2': '鞭子',
        'Book2': '书',
        'Knuckle2': '拳套',
        'Katar2': '拳刃',
    };

    // ---- 卡片部位中文映射 ----
    var CARD_LOCATION_MAP = {
        'Weapon': '武器',
        'Shield': '盾牌',
        'Head': '头饰',
        'Armor': '铠甲',
        'Garment': '披肩',
        'Shoes': '鞋子',
        'Accessory': '饰品',
        'Both_Accessory': '饰品',
        'Head_Top': '头饰上',
        'Head_Mid': '头饰中',
        'Head_Bottom': '头饰下',
        'Head_Low': '头饰下',
        'Right_Hand': '左手',
        'Left_Hand': '右手',
    };

    function getSubTypeDisplay(def) {
        if (!def) return '';
        var type = def.Type || '';
        if (type === 'Card') return '卡片';
        var sub = def.SubType || '';
        if (sub) {
            return SUB_TYPE_MAP[sub] || sub;
        }
        if (type === 'Armor' || type === 'Accessory') {
            return getEquipSlotDisplayName(def.Id);
        }
        return '';
    }

    function getCardLocationDisplay(def) {
        if (!def) return '';
        var loc = def.Locations || {};
        var keys = Object.keys(loc);
        if (keys.length === 0) return '通用';
        var displays = keys.map(function(k) { return CARD_LOCATION_MAP[k] || k; });
        return displays.join('/');
    }

    function getEquipSlots(templateId) {
        _buildIndexes();
        var def = _byId[templateId];
        if (!def) return [];
        var loc = def.Locations || {};
        var slots = [];

        // ---- 武器：直接根据 Type 判断，忽略 Locations ----
        if (def.Type && def.Type.toLowerCase() === 'weapon') {
            slots.push('weapon');
            return slots;
        }

        // ---- 头部多槽位检测（上、中、下） ----
        var headTopKeys = ['Head_Top','Head_Top2','Costume_Head_Top','Costume_Head_Top2','Head','Helm','Helmet'];
        var headMidKeys = ['Head_Mid','Head_Mid2','Costume_Head_Mid','Costume_Head_Mid2'];
        var headBottomKeys = ['Head_Bottom','Costume_Head_Bottom','Head_Low'];
        for (var i = 0; i < headTopKeys.length; i++) {
            if (loc[headTopKeys[i]]) { slots.push(SLOT_MAP[headTopKeys[i]] || 'headTop'); break; }
        }
        for (var i = 0; i < headMidKeys.length; i++) {
            if (loc[headMidKeys[i]]) { slots.push(SLOT_MAP[headMidKeys[i]] || 'headMid'); break; }
        }
        for (var i = 0; i < headBottomKeys.length; i++) {
            if (loc[headBottomKeys[i]]) { slots.push(SLOT_MAP[headBottomKeys[i]] || 'headBottom'); break; }
        }

        // 如果没有头部槽位，检测其他部位
        if (slots.length === 0) {
            if (loc.Accessory || loc.Both_Accessory) slots.push('accessory1');
            else if (loc.Armor) slots.push('armor');
            else if (loc.Garment || loc.Manteau || loc.Hood || loc.Costume_Garment) slots.push('garment');
            else if (loc.Shoes || loc.Boots) slots.push('shoes');
            else if (loc.Shield || loc.Left_Hand) slots.push('shield');
            else {
                for (var key in loc) {
                    if (loc[key] && SLOT_MAP[key]) { slots.push(SLOT_MAP[key]); break; }
                }
            }
        }
        return slots;
    }

    function getEquipSlotDisplayName(templateId) {
        _buildIndexes();
        var def = _byId[templateId];
        if (!def) return '未知';
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
        if (loc.Garment || loc.Manteau || loc.Hood || loc.Costume_Garment) return '披肩';
        if (loc.Shoes || loc.Boots) return '鞋子';
        if (loc.Armor) return '铠甲';
        return '防具';
    }

    function search(keyword) {
        _buildIndexes();
        if (!keyword) return [];
        var kw = String(keyword).toLowerCase();
        var result = [];
        for (var id in _byId) {
            if (!_byId.hasOwnProperty(id)) continue;
            var def = _byId[id];
            var display = getDisplayName(def.Id);
            if ((def.AegisName && def.AegisName.toLowerCase().indexOf(kw) !== -1) ||
                (display && display.toLowerCase().indexOf(kw) !== -1)) {
                result.push(_clone(def));
                if (result.length >= 50) break;
            }
        }
        return result;
    }

    // ============================================================
    //  图鉴扩展：子分类提取 + 分页（无 droppableOnly）
    // ============================================================

    /**
     * 获取指定大类的子分类列表（含过滤函数）
     * @param {string} category - '武器'、'防具'、'卡片' 等
     * @returns {Array<{label: string, filter: function|null}>}
     */
function getSubCategories(category) {
    _buildIndexes();
    var subMap = {};
    var allIds = Object.keys(_byId);
    for (var i = 0; i < allIds.length; i++) {
        var id = parseInt(allIds[i], 10);
        var def = _byId[id];
        if (!def) continue;
        if (getType(id) !== category) continue;
        var subs = _extractSubCategories(def, category);
        subs.forEach(function(item) {
            var key = item.key;
            if (!subMap[key]) {
                subMap[key] = { label: key, filter: item.filter };
            }
        });
    }
    var list = Object.keys(subMap).sort();
    var result = [{ label: '全部', filter: null }];
    list.forEach(function(key) {
        result.push(subMap[key]);
    });
    return result;
}


    function _extractSubCategories(def, category) {
    var subs = [];
    var type = def.Type || '';
    var subType = def.SubType || '';
    var loc = def.Locations || {};

    // ---- 武器：基于 SubType 转中文 ----
    if (category === '武器') {
        if (subType) {
            var display = global.ItemTypeMap ? global.ItemTypeMap.getSubTypeCN(subType) : subType;
            if (display) {
                subs.push({
                    key: display,
                    filter: function(item) {
                        return item.SubType === subType;
                    }
                });
            }
        }
        return subs;
    }


    // ---- 消耗品：Healing / Usable ----
if (category === '消耗') {
    var type = def.Type || '';
    var subType = def.SubType || '';
    var script = def.Script || '';

    function parseHealScript(script) {
        var hp = 0, sp = 0;
        if (!script) return { hp: 0, sp: 0 };
        var lines = script.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            // 先处理 percentheal
            var pMatch = line.match(/percentheal\s+(\d+)\s*,\s*(\d+)/i);
            if (pMatch) {
                hp += parseInt(pMatch[1], 10);
                sp += parseInt(pMatch[2], 10);
                continue;
            }
            // itemheal 各种格式
            var match = line.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (match) {
                hp += Math.floor((parseInt(match[1],10) + parseInt(match[2],10)) / 2);
                sp += Math.floor((parseInt(match[3],10) + parseInt(match[4],10)) / 2);
                continue;
            }
            match = line.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*(\d+)/i);
            if (match) {
                hp += Math.floor((parseInt(match[1],10) + parseInt(match[2],10)) / 2);
                sp += parseInt(match[3],10);
                continue;
            }
            match = line.match(/itemheal\s+(\d+)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (match) {
                hp += parseInt(match[1],10);
                sp += Math.floor((parseInt(match[2],10) + parseInt(match[3],10)) / 2);
                continue;
            }
            match = line.match(/itemheal\s+(\d+)\s*,\s*(\d+)/i);
            if (match) {
                hp += parseInt(match[1],10);
                sp += parseInt(match[2],10);
                continue;
            }
        }
        return { hp: hp, sp: sp };
    }

    if (type === 'Healing') {
        var heal = parseHealScript(script);
        if (heal.hp > 0 || heal.sp > 0) {
            if (heal.hp > 0 && heal.hp >= heal.sp) {
                subs.push({ key: '回血', filter: function(item) {
                    var h = parseHealScript(item.Script || '');
                    return h.hp > 0 && h.hp >= h.sp;
                }});
            }
            if (heal.sp > 0 && heal.sp > heal.hp) {
                subs.push({ key: '回蓝', filter: function(item) {
                    var h = parseHealScript(item.Script || '');
                    return h.sp > 0 && h.sp > h.hp;
                }});
            }
            if (!subs.some(s => s.key === '回血') && !subs.some(s => s.key === '回蓝')) {
                subs.push({ key: '恢复', filter: function(item) { return item.Type === 'Healing'; }});
            }
        } else {
            subs.push({ key: '其他消耗', filter: function(item) { return item.Type === 'Healing'; }});
        }
        return subs;
    }

    if (type === 'Usable') {
        if (subType && (subType.indexOf('Status') !== -1 || subType.indexOf('State') !== -1 || subType.indexOf('Cure') !== -1)) {
            subs.push({ key: '状态', filter: function(item) {
                var st = item.SubType || '';
                return st.indexOf('Status') !== -1 || st.indexOf('State') !== -1 || st.indexOf('Cure') !== -1;
            }});
        }
        if (subType && (subType.indexOf('Buff') !== -1 || subType.indexOf('Enhance') !== -1 || subType.indexOf('Boost') !== -1)) {
            subs.push({ key: '增幅', filter: function(item) {
                var st = item.SubType || '';
                return st.indexOf('Buff') !== -1 || st.indexOf('Enhance') !== -1 || st.indexOf('Boost') !== -1;
            }});
        }
        if (!subs.some(s => s.key === '状态') && !subs.some(s => s.key === '增幅')) {
            subs.push({ key: '道具', filter: function(item) { return item.Type === 'Usable'; }});
        }
        return subs;
    }

    // 如果既不是 Healing 也不是 Usable，归入其他
    subs.push({ key: '其他消耗', filter: function(item) { return true; }});
    return subs;
}

// ---- 防具：基于 Locations 和 SubType 组合 ----
if (category === '防具') {
    var armorMap = {
        'Armor': '铠甲',
        'Garment': '披肩',
        'Manteau': '披肩',
        'Hood': '披肩',
        'Costume_Garment': '披肩',
        'Shoes': '鞋子',
        'Boots': '鞋子',
        'Shield': '盾牌',
        'Left_Hand': '盾牌',
        'Accessory': '饰品',
        'Both_Accessory': '饰品',
    };
    var locKeys = Object.keys(loc);
    locKeys.forEach(function(k) {
        var label = armorMap[k];
        if (label && !subs.some(function(s) { return s.key === label; })) {
            subs.push({
                key: label,
                filter: function(item) {
                    return item.Locations && item.Locations[k] === true;
                }
            });
        }
    });
    // 如果 SubType 有值且未覆盖，按 SubType 兜底
    if (subs.length === 0 && subType) {
        var d = global.ItemTypeMap ? global.ItemTypeMap.getSubTypeCN(subType) : subType;
        if (d) {
            subs.push({
                key: d,
                filter: function(item) { return item.SubType === subType; }
            });
        }
    }
    // 去重
    var unique = {};
    subs = subs.filter(function(item) {
        if (unique[item.key]) return false;
        unique[item.key] = true;
        return true;
    });

    if (!subs.some(function(s) { return s.key === '饰品'; })) {
    }
    return subs;
}

    // ---- 饰品：只保留饰品相关 ----
    if (category === '饰品') {
        if (loc.Accessory || loc.Both_Accessory) {
            subs.push({
                key: '饰品',
                filter: function(item) {
                    var l = item.Locations || {};
                    return !!(l.Accessory || l.Both_Accessory);
                }
            });
        }

        // 如果 SubType 是 Ring/Earring/Necklace 等，也加入
        if (subType && ['Ring','Earring','Necklace','Bracelet','Brooch'].indexOf(subType) !== -1) {
            var d2 = global.ItemTypeMap ? global.ItemTypeMap.getSubTypeCN(subType) : subType;
            if (d2 && !subs.some(function(s) { return s.key === d2; })) {
                subs.push({
                    key: d2,
                    filter: function(item) { return item.SubType === subType; }
                });
            }
        }
        return subs;
    }

    // ---- 卡片：按适用部位 ----
    if (category === '卡片') {
        var cardMap = {
            'Weapon': '武器卡',
                'Right_Hand': '武器卡',
    'Left_Hand': '武器卡',
            'Shield': '盾牌卡',
            'Head': '头饰卡',
            'Armor': '铠甲卡',
            'Garment': '披肩卡',
            'Shoes': '鞋子卡',
            'Accessory': '饰品卡',
            'Both_Accessory': '饰品卡',
            'Head_Top': '头饰上卡',
            'Head_Mid': '头饰中卡',
            'Head_Bottom': '头饰下卡',
            'Head_Low': '头饰下卡',
        };
        var cKeys = Object.keys(loc);
        cKeys.forEach(function(k) {
            var label = cardMap[k];
            if (label && !subs.some(function(s) { return s.key === label; })) {
                subs.push({
                    key: label,
                    filter: function(item) {
                        return item.Locations && item.Locations[k] === true;
                    }
                });
            }
        });
        if (subs.length === 0) {
            subs.push({ key: '通用卡', filter: null });
        }
        return subs;
    }

    // ---- 头饰：基于 Locations 组合 ----
    if (category === '头饰') {
        var hasTop = !!(loc.Head_Top || loc.Head_Top2 || loc.Costume_Head_Top || loc.Costume_Head_Top2 || loc.Head || loc.Helm || loc.Helmet);
        var hasMid = !!(loc.Head_Mid || loc.Head_Mid2 || loc.Costume_Head_Mid || loc.Costume_Head_Mid2);
        var hasBottom = !!(loc.Head_Bottom || loc.Costume_Head_Bottom || loc.Head_Low);
        if (hasTop || hasMid || hasBottom) {
            var combo2 = '';
            if (hasTop && hasMid && hasBottom) combo2 = '上中下';
            else if (hasTop && hasMid) combo2 = '上中';
            else if (hasMid && hasBottom) combo2 = '中下';
            else if (hasTop) combo2 = '上';
            else if (hasMid) combo2 = '中';
            else if (hasBottom) combo2 = '下';
            if (combo2) {
                subs.push({
                    key: combo2,
                    filter: function(item) {
                        var l = item.Locations || {};
                        var ht = !!(l.Head_Top || l.Head_Top2 || l.Costume_Head_Top || l.Costume_Head_Top2 || l.Head || l.Helm || l.Helmet);
                        var hm = !!(l.Head_Mid || l.Head_Mid2 || l.Costume_Head_Mid || l.Costume_Head_Mid2);
                        var hb = !!(l.Head_Bottom || l.Costume_Head_Bottom || l.Head_Low);
                        var c2 = '';
                        if (ht && hm && hb) c2 = '上中下';
                        else if (ht && hm) c2 = '上中';
                        else if (hm && hb) c2 = '中下';
                        else if (ht) c2 = '上';
                        else if (hm) c2 = '中';
                        else if (hb) c2 = '下';
                        return c2 === combo2;
                    }
                });
            }
        }
        // 如果 SubType 包含 'Costume'，说明是时装，不应出现在头饰中（由时装分类处理）
        if (subType && subType.indexOf('Costume') !== -1) return [];
        return subs;
    }

    // ---- 时装：基于 SubType 包含 Costume ----
if (category === '时装') {
    var loc = def.Locations || {};
    var hasTop = !!(loc.Costume_Head_Top || loc.Costume_Head_Top2);
    var hasMid = !!(loc.Costume_Head_Mid || loc.Costume_Head_Mid2);
    var hasBottom = !!(loc.Costume_Head_Bottom || loc.Costume_Head_Low);
    var hasGarment = !!(loc.Costume_Garment);

    // 定义标签及对应的过滤函数（通用，不依赖当前物品）
    var labelMap = {
        '披风': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Garment);
        },
        '头饰上中下': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !!(l.Costume_Head_Mid || l.Costume_Head_Mid2) &&
                   !!(l.Costume_Head_Bottom || l.Costume_Head_Low);
        },
        '头饰上中': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !!(l.Costume_Head_Mid || l.Costume_Head_Mid2) &&
                   !(l.Costume_Head_Bottom || l.Costume_Head_Low);
        },
        '头饰中下': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Mid || l.Costume_Head_Mid2) &&
                   !!(l.Costume_Head_Bottom || l.Costume_Head_Low) &&
                   !(l.Costume_Head_Top || l.Costume_Head_Top2);
        },
        '头饰上下': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !!(l.Costume_Head_Bottom || l.Costume_Head_Low) &&
                   !(l.Costume_Head_Mid || l.Costume_Head_Mid2);
        },
        '头饰上': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !(l.Costume_Head_Mid || l.Costume_Head_Mid2) &&
                   !(l.Costume_Head_Bottom || l.Costume_Head_Low);
        },
        '头饰中': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Mid || l.Costume_Head_Mid2) &&
                   !(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !(l.Costume_Head_Bottom || l.Costume_Head_Low);
        },
        '头饰下': function(item) {
            var l = item.Locations || {};
            return !!(l.Costume_Head_Bottom || l.Costume_Head_Low) &&
                   !(l.Costume_Head_Top || l.Costume_Head_Top2) &&
                   !(l.Costume_Head_Mid || l.Costume_Head_Mid2);
        },
        '其他时装': function(item) {
            var l = item.Locations || {};
            // 存在任何 Costume_ 键，但不属于上述任何组合（即不是头饰组合也不是披风）
            // 但根据我们的键检查，所有可能的 Costume_ 键都被覆盖，因此此标签不会出现，保留作为兜底
            var hasTop = !!(l.Costume_Head_Top || l.Costume_Head_Top2);
            var hasMid = !!(l.Costume_Head_Mid || l.Costume_Head_Mid2);
            var hasBottom = !!(l.Costume_Head_Bottom || l.Costume_Head_Low);
            var hasGarment = !!(l.Costume_Garment);
            return (hasTop || hasMid || hasBottom || hasGarment) &&
                   !(hasTop && !hasMid && !hasBottom) && // 不是仅上
                   !(!hasTop && hasMid && !hasBottom) && // 不是仅中
                   !(!hasTop && !hasMid && hasBottom) && // 不是仅下
                   !(hasTop && hasMid && !hasBottom) &&  // 不是上中
                   !(!hasTop && hasMid && hasBottom) &&  // 不是中下
                   !(hasTop && !hasMid && hasBottom) &&  // 不是上下
                   !(hasTop && hasMid && hasBottom) &&   // 不是上中下
                   !hasGarment;                          // 不是披风
        }
    };

    // 确定当前物品的标签
    var label;
    if (hasGarment) {
        label = '披风';
    } else if (hasTop && hasMid && hasBottom) {
        label = '头饰上中下';
    } else if (hasTop && hasMid) {
        label = '头饰上中';
    } else if (hasMid && hasBottom) {
        label = '头饰中下';
    } else if (hasTop && hasBottom) {
        label = '头饰上下';
    } else if (hasTop) {
        label = '头饰上';
    } else if (hasMid) {
        label = '头饰中';
    } else if (hasBottom) {
        label = '头饰下';
    } else {
        label = '其他时装';
    }

    // 如果 subs 中还没有该标签，则添加
    if (!subs.some(function(s) { return s.key === label; })) {
        subs.push({ key: label, filter: labelMap[label] });
    }
    return subs;
}

    // ---- 影子：基于 SubType 包含 Shadow ----
if (category === '影子') {
    var loc = def.Locations || {};
    var labelMap = {
        '铠甲': function(item) { return !!(item.Locations && item.Locations.Shadow_Armor); },
        '武器': function(item) { return !!(item.Locations && item.Locations.Shadow_Weapon); },
        '盾牌': function(item) { return !!(item.Locations && item.Locations.Shadow_Shield); },
        '鞋子': function(item) { return !!(item.Locations && item.Locations.Shadow_Shoes); },
        '耳环': function(item) { return !!(item.Locations && item.Locations.Shadow_Right_Accessory); },
        '吊坠': function(item) { return !!(item.Locations && item.Locations.Shadow_Left_Accessory); }
    };

    var label = null;
    if (loc.Shadow_Armor) label = '铠甲';
    else if (loc.Shadow_Weapon) label = '武器';
    else if (loc.Shadow_Shield) label = '盾牌';
    else if (loc.Shadow_Shoes) label = '鞋子';
    else if (loc.Shadow_Right_Accessory) label = '耳环';
    else if (loc.Shadow_Left_Accessory) label = '吊坠';

    if (label && !subs.some(function(s) { return s.key === label; })) {
        subs.push({ key: label, filter: labelMap[label] });
    }

    // 兜底：如果没有任何匹配（理论上不会发生），归入“其他影子”
    if (subs.length === 0) {
        subs.push({ key: '其他影子', filter: function(item) { return item.Type === 'Shadowgear'; } });
    }
    return subs;
}

// ---- 防具：基于 Locations 和 SubType 组合 ----
if (category === '防具') {
    var armorMap = {
        'Armor': '铠甲',
        'Garment': '披肩',
        'Manteau': '披肩',
        'Hood': '披肩',
        'Costume_Garment': '披肩',
        'Shoes': '鞋子',
        'Boots': '鞋子',
        'Shield': '盾牌',
        'Left_Hand': '盾牌',
        // +++ 新增：饰品部位归入防具子类 +++
        'Accessory': '饰品',
        'Both_Accessory': '饰品',
    };
    var locKeys = Object.keys(loc);
    locKeys.forEach(function(k) {
        var label = armorMap[k];
        if (label && !subs.some(function(s) { return s.key === label; })) {
            subs.push({
                key: label,
                filter: function(item) {
                    return item.Locations && item.Locations[k] === true;
                }
            });
        }
    });
    // 如果 SubType 有值且未覆盖，按 SubType 兜底
    if (subs.length === 0 && subType) {
        var d = global.ItemTypeMap ? global.ItemTypeMap.getSubTypeCN(subType) : subType;
        if (d) {
            subs.push({
                key: d,
                filter: function(item) { return item.SubType === subType; }
            });
        }
    }
    // 去重
    var unique = {};
    subs = subs.filter(function(item) {
        if (unique[item.key]) return false;
        unique[item.key] = true;
        return true;
    });
    // +++ 确保饰品始终出现在防具子类中（即使没有物品符合，也不影响） +++
    if (!subs.some(function(s) { return s.key === '饰品'; })) {
        // 如果当前分类没有饰品物品，不强行添加（避免空分类）
        // 但保留过滤逻辑，以便将来有饰品时自动出现
    }
    return subs;
}



// ---- 其他：按 Type 细分 + 脚本解析回血/回蓝 ----
// ---- 其他：按 Type 细分 + 脚本解析回血/回蓝 ----
// if (category === '其他') {
//     var type = def.Type || '';
//     var subType = def.SubType || '';
//     var script = def.Script || '';

//     // 辅助：解析回血/回蓝（支持多种格式）
//     function parseHealScript(script) {
//         var hp = 0, sp = 0;
//         if (!script) return { hp: 0, sp: 0 };
//         var lines = script.split('\n');
//         for (var i = 0; i < lines.length; i++) {
//             var line = lines[i].trim();
//             // 匹配 itemheal rand(min,max), rand(min,max)
//             var match = line.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
//             if (match) {
//                 hp += Math.floor((parseInt(match[1],10) + parseInt(match[2],10)) / 2);
//                 sp += Math.floor((parseInt(match[3],10) + parseInt(match[4],10)) / 2);
//                 continue;
//             }
//             // 匹配 itemheal rand(min,max), sp
//             match = line.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*(\d+)/i);
//             if (match) {
//                 hp += Math.floor((parseInt(match[1],10) + parseInt(match[2],10)) / 2);
//                 sp += parseInt(match[3],10);
//                 continue;
//             }
//             // 匹配 itemheal hp, rand(min,max)
//             match = line.match(/itemheal\s+(\d+)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
//             if (match) {
//                 hp += parseInt(match[1],10);
//                 sp += Math.floor((parseInt(match[2],10) + parseInt(match[3],10)) / 2);
//                 continue;
//             }
//             // 匹配 itemheal hp, sp
//             match = line.match(/itemheal\s+(\d+)\s*,\s*(\d+)/i);
//             if (match) {
//                 hp += parseInt(match[1],10);
//                 sp += parseInt(match[2],10);
//                 continue;
//             }
//         }
//         return { hp: hp, sp: sp };
//     }

//     // ---- 消耗品：Healing ----
//     if (type === 'Healing') {
//         var heal = parseHealScript(script);
//         if (heal.hp > 0 || heal.sp > 0) {
//             if (heal.hp > 0 && heal.hp >= heal.sp) {
//                 subs.push({ key: '回血', filter: function(item) { var h = parseHealScript(item.Script || ''); return h.hp > 0 && h.hp >= h.sp; } });
//             }
//             if (heal.sp > 0 && heal.sp > heal.hp) {
//                 subs.push({ key: '回蓝', filter: function(item) { var h = parseHealScript(item.Script || ''); return h.sp > 0 && h.sp > h.hp; } });
//             }
//             if (!subs.some(s => s.key === '回血') && !subs.some(s => s.key === '回蓝')) {
//                 subs.push({ key: '恢复', filter: function(item) { return item.Type === 'Healing'; } });
//             }
//         } else {
//             subs.push({ key: '其他消耗', filter: function(item) { return item.Type === 'Healing'; } });
//         }
//         return subs;
//     }

//     // ---- 消耗品：Usable ----
//     if (type === 'Usable') {
//         if (subType && (subType.indexOf('Status') !== -1 || subType.indexOf('State') !== -1 || subType.indexOf('Cure') !== -1)) {
//             subs.push({ key: '状态', filter: function(item) { var st = item.SubType || ''; return st.indexOf('Status') !== -1 || st.indexOf('State') !== -1 || st.indexOf('Cure') !== -1; } });
//         }
//         if (subType && (subType.indexOf('Buff') !== -1 || subType.indexOf('Enhance') !== -1 || subType.indexOf('Boost') !== -1)) {
//             subs.push({ key: '增幅', filter: function(item) { var st = item.SubType || ''; return st.indexOf('Buff') !== -1 || st.indexOf('Enhance') !== -1 || st.indexOf('Boost') !== -1; } });
//         }
//         if (!subs.some(s => s.key === '状态') && !subs.some(s => s.key === '增幅')) {
//             subs.push({ key: '道具', filter: function(item) { return item.Type === 'Usable'; } });
//         }
//         return subs;
//     }

//     // ---- 材料：Etc ----
//     if (type === 'Etc') {
//         if (subType && (subType.indexOf('Pet') !== -1 || subType.indexOf('Food') !== -1)) {
//             subs.push({ key: '宠物相关', filter: function(item) { var st = item.SubType || ''; return st.indexOf('Pet') !== -1 || st.indexOf('Food') !== -1; } });
//         } else {
//             subs.push({ key: '材料', filter: function(item) { return item.Type === 'Etc'; } });
//         }
//         return subs;
//     }

//     // ---- 兜底（其他未分类） ----
//     subs.push({ key: '其他', filter: function(item) { return true; } });
//     return subs;
// }        
    

    return subs;
}





    /**
     * 分页查询物品（纯数据，不含掉落关联）
     * @param {number} page - 从1开始
     * @param {number} size - 每页条数
     * @param {string} category - 大类中文名
     * @param {string} keyword - 搜索关键词（可选）
     * @param {function} filterFn - 自定义过滤函数（可选，由子分类提供）
     * @returns {{ total: number, page: number, size: number, data: array }}
     */
    function getPaginated(page, size, category, keyword, filterFn) {
        _buildIndexes();
        var allIds = Object.keys(_byId);
        var results = [];

        for (var i = 0; i < allIds.length; i++) {
            var id = parseInt(allIds[i], 10);
            var def = _byId[id];
            if (!def) continue;

            if (category) {
                var typeCN = getType(id);
                if (typeCN !== category) continue;
            }
            if (keyword) {
                var kw = String(keyword).toLowerCase();
                var display = getDisplayName(id);
                var match = (def.AegisName && def.AegisName.toLowerCase().indexOf(kw) !== -1) ||
                            (display && display.toLowerCase().indexOf(kw) !== -1);
                if (!match) continue;
            }
            if (typeof filterFn === 'function') {
                if (!filterFn(def)) continue;
            }
            results.push(def);
        }

        var total = results.length;
        var start = (page - 1) * size;
        var end = Math.min(start + size, total);
        var data = results.slice(start, end).map(function(d) { return _clone(d); });

        return {
            total: total,
            page: page,
            size: size,
            data: data
        };
    }

    // ---- 调试 ----
    function _debug() {
        _buildIndexes();
        console.log('[ItemDataGateway] 物品总数:', Object.keys(_byId).length);
    }

    // ---- 暴露全局 ----
    var ItemDataGateway = {
        init: function() { return _buildIndexes(); },
        getById: getById,
        getByAegis: getByAegis,
        getDisplayName: getDisplayName,
        getType: getType,
        getSellPrice: getSellPrice,
        search: search,
        getEquipSlots: getEquipSlots,
        getEquipSlotDisplayName: getEquipSlotDisplayName,
        getSubTypeDisplay: getSubTypeDisplay,
        getCardLocationDisplay: getCardLocationDisplay,
        getSubCategories: getSubCategories,
        getPaginated: getPaginated,
        _debug: _debug,
    };

    // ---- 自动初始化 ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { ItemDataGateway.init(); });
    } else {
        ItemDataGateway.init();
    }

    global.ItemDataGateway = ItemDataGateway;
    console.log('[ItemDataGateway] ✅ 已加载（纯物品数据网关，关联查询已移除）');

})(window);
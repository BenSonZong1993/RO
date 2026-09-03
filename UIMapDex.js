// js/ui/UIMapDex.js
// 地图图鉴模块 – 等级/区域/属性/种族/BOSS筛选，城镇与战斗地图分离
// 修复：数据加载空问题、增加自检日志、兼容 MapDataGateway 未就绪场景
// TODO: Phase 4（暂缓）— 本文件存在 Gateway 违规（多处直读 global.MonsterData / global.MapFlagData / global.MapData），
//       后续应改走 MonsterService / MapDataGateway，本次不予修改。
(function(global) {
    'use strict';

    // ============================
    //  配置区
    // ============================
    var CONFIG = {
        pageSize: 18,
        levelRanges: [
            { label: '全部', min: 0, max: 999 },
            { label: '1~10级', min: 1, max: 10 },
            { label: '11~30级', min: 11, max: 30 },
            { label: '31~50级', min: 31, max: 50 },
            { label: '51~70级', min: 51, max: 70 },
            { label: '71~85级', min: 71, max: 85 },
            { label: '86~100级', min: 86, max: 100 },
            { label: '101~110级', min: 101, max: 110 },
            { label: '111~120级', min: 111, max: 120 },
            { label: '121级+', min: 121, max: 999 },
        ],
                // ---- 中文名称映射 ----
        elementNames: {
            'Neutral': '无属性', 'Water': '水', 'Earth': '地', 'Fire': '火',
            'Wind': '风', 'Poison': '毒', 'Holy': '圣', 'Dark': '暗',
            'Ghost': '念', 'Undead': '不死'
        },
        raceNames: {
            'Formless': '无形', 'Undead': '不死', 'Demon': '恶魔', 'Plant': '植物',
            'Insect': '昆虫', 'Fish': '鱼贝', 'Dragon': '龙族', 'Brute': '动物',
            'Human': '人类', 'Angel': '天使', 'Demi-Human': '人形'
        },
        regions: [
            '全部', '普隆德拉区域', '吉芬区域', '斐扬区域', '梦罗克区域',
            '艾尔帕兰区域', '朱诺/艾因区域', '拉赫/菲音斯区域', '古城区域', '东方区域', '其他区域'
        ],
        elements: ['Neutral', 'Water', 'Earth', 'Fire', 'Wind', 'Poison', 'Holy', 'Dark', 'Ghost', 'Undead'],
        elementIcons: {
            'Neutral': '⚪', 'Water': '💧', 'Earth': '🌍', 'Fire': '🔥',
            'Wind': '⚡', 'Poison': '🧪', 'Holy': '☀️', 'Dark': '🌑',
            'Ghost': '👻', 'Undead': '💀'
        },
        raceIcons: {
            'Formless': '🌀', 'Undead': '💀', 'Demon': '👿', 'Plant': '🌿',
            'Insect': '🐛', 'Fish': '🐟', 'Dragon': '🐉', 'Brute': '🐾',
            'Human': '🧑', 'Angel': '😇', 'Demi-Human': '🧑‍🤝‍🧑'
        }

    };

    // ============================
    //  状态管理
    // ============================
    var _state = {
        page: 1,
        size: CONFIG.pageSize,
        levelRange: '全部',
        region: '全部',
        elementFilter: null,
        raceFilter: null,
        bossFilter: 'all',    // 'all' | 'mvp' | 'mini' | 'hasBoss'
        keyword: '',
        total: 0,
        data: []
    };

    var _mapCache = {};
    var _isOpen = false;
    var _initialized = false;
    var _panelHandler = null;

    // ============================
    //  工具函数：区域划分
    // ============================

    function _getElementDisplayName(elem) {
    return CONFIG.elementNames[elem] || elem;
}
function _getRaceDisplayName(race) {
    return CONFIG.raceNames[race] || race;
}

    function _getRegion(mapId) {
        if (!mapId) return '其他区域';
        var id = String(mapId);
        if (id.startsWith('prt_') || id === 'prontera' || id === 'izlude' || id === 'alberta') return '普隆德拉区域';
        if (id.startsWith('gef_') || id === 'geffen') return '吉芬区域';
        if (id.startsWith('pay_') || id === 'payon') return '斐扬区域';
        if (id.startsWith('moc_') || id === 'morocc') return '梦罗克区域';
        if (id.startsWith('alde_') || id === 'aldebaran') return '艾尔帕兰区域';
        if (id.startsWith('yuno_') || id === 'yuno' || id.startsWith('ein_') || id === 'einbroch') return '朱诺/艾因区域';
        if (id.startsWith('ra_') || id === 'rachel' || id === 'veins') return '拉赫/菲音斯区域';
        if (id.startsWith('glast_')) return '古城区域';
        if (id.startsWith('gon_') || id === 'gonryun' || id === 'amatsu' || id === 'louyang') return '东方区域';
        return '其他区域';
    }

    function _getMonsterName(monsterId) {
        var monsters = global.MonsterData || [];
        for (var i = 0; i < monsters.length; i++) {
            var m = monsters[i];
            var mid = m.id !== undefined ? m.id : m.Id; // 兼容大小写
            if (mid === monsterId) {
                return m.ChineseName || m.name || m.Name || ('#' + monsterId);
            }
        }
        return '#' + monsterId;
    }

    function _getMonsterDef(monsterId) {
        var monsters = global.MonsterData || [];
        for (var i = 0; i < monsters.length; i++) {
            var m = monsters[i];
            var mid = m.id !== undefined ? m.id : m.Id;
            if (mid === monsterId) return m;
        }
        return null;
    }

    function _getMonsterDropItems(monsterDef) {
        if (!monsterDef || !monsterDef.drops) return [];
        var items = [];
        var seen = {};
        for (var i = 0; i < monsterDef.drops.length; i++) {
            var drop = monsterDef.drops[i];
            var itemAegis = drop.Item;
            if (!itemAegis) continue;
            var def = global.ItemDataGateway ? global.ItemDataGateway.getByAegis(itemAegis) : null;
            if (!def) {
                var idNum = parseInt(itemAegis, 10);
                if (!isNaN(idNum)) def = global.ItemDataGateway ? global.ItemDataGateway.getById(idNum) : null;
            }
            if (!def) continue;
            var name = global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(def.Id) : (def.Name || itemAegis);
            if (!seen[name]) {
                seen[name] = true;
                items.push({ id: def.Id, name: name, aegis: itemAegis });
            }
        }
        return items;
    }

    function _showMonsterDetail(monsterId) {
        var def = _getMonsterDef(monsterId);
        if (!def) return;
        var name = def.ChineseName || def.Name || ('#' + monsterId);
        var level = def.Level || 0;
        var size = def.Size || 'Medium';
        var element = def.Element || 'Neutral';
        var elementLevel = def.ElementLevel || 1;
        var race = def.Race || 'Formless';
        var classLabel = def.Class === 'Boss' ? (def.MvpExp ? '👑 MVP' : '⭐ MINI') : '普通';
        var drops = _getMonsterDropItems(def);
        var dropHtml = drops.length === 0 ? '<div style="color:#999;font-size:0.9rem;">无掉落物品</div>' :
            '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:4px;">' +
            drops.map(function(d) { return '<span style="background:#eef2ff;padding:2px 12px;border-radius:12px;font-size:0.85rem;">' + d.name + '</span>'; }).join('') +
            '</div>';
        var content = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin:8px 0;">' +
            '<div><strong>等级</strong> ' + level + '</div>' +
            '<div><strong>体型</strong> ' + size + '</div>' +
'<div><strong>属性</strong> ' + _getElementDisplayName(element) + ' Lv.' + elementLevel + '</div>' +
'<div><strong>种族</strong> ' + _getRaceDisplayName(race) + '</div>' +
            '<div style="grid-column:span 2;"><strong>类别</strong> ' + classLabel + '</div>' +
            '</div><div style="margin-top:8px;"><strong>💎 掉落物品</strong></div>' + dropHtml;
        if (typeof UIPanel !== 'undefined' && UIPanel.show) {
            UIPanel.show({ preset: 'small', title: { icon: '🐾', text: name }, content: content });
        } else {
            alert(content);
        }
    }

    // ============================
    //  数据聚合（核心修复点：增加日志和降级）
    // ============================
    function _aggregateMap(mapId) {
        if (_mapCache[mapId]) return _mapCache[mapId];

        var gateway = global.MapDataGateway;
        var flag = global.MapFlagData;
        if (!gateway) return null;

        var mapObj = gateway.getMapById(mapId);
        if (!mapObj) return null;

        var monsterIds = gateway.getMonsterIdsOnMap(mapId);
        if (!monsterIds || monsterIds.length === 0) {
            // 直接检查是否为城镇
            var isTown = flag ? flag.isTown(mapId) : false;
            var result = {
                mapId: mapId,
                name: gateway.getDisplayName(mapId) || mapId,
                terrain: gateway.getTerrain(mapId) || 'field',
                isTown: isTown,
                region: _getRegion(mapId),
                avgLevel: 0,
                monsterCount: 0,
                monsters: [],
                elementWeights: {},
                raceWeights: {},
                bossCount: 0,
                miniCount: 0,
            };
            _mapCache[mapId] = result;
            return result;
        }

        // 构建怪物索引（兼容 id/Id）
        var allMonsters = global.MonsterData || [];
        var monsterMap = {};
        for (var i = 0; i < allMonsters.length; i++) {
            var m = allMonsters[i];
            var mid = m.id !== undefined ? m.id : m.Id;
            if (mid !== undefined) monsterMap[mid] = m;
        }

        var monsters = [];
        var levelSum = 0;
        var elementCount = {};
        var raceCount = {};
        var bossCount = 0, miniCount = 0;

        for (var i = 0; i < monsterIds.length; i++) {
            var mid = monsterIds[i];
            var mdef = monsterMap[mid];
            if (!mdef) {
                // 尝试数字转换
                var numId = parseInt(mid, 10);
                if (!isNaN(numId) && numId !== mid) mdef = monsterMap[numId];
            }
            if (!mdef) continue; // 跳过未匹配的ID

            var level = mdef.level || mdef.Level || 0;
            var elem = mdef.Element || mdef.element || 'Neutral';
            var race = mdef.Race || mdef.race || 'Formless';
            levelSum += level;
            elementCount[elem] = (elementCount[elem] || 0) + 1;
            raceCount[race] = (raceCount[race] || 0) + 1;
            var isBoss = (mdef.Class === 'Boss' || mdef.class === 'Boss');
            if (isBoss) {
                if (mdef.MvpExp || mdef.mvpExp) bossCount++;
                else miniCount++;
            }
            monsters.push({
                id: mid,
                name: _getMonsterName(mid),
                level: level,
                element: elem,
                elementLevel: mdef.ElementLevel || mdef.elementLevel || 1,
                race: race,
                size: mdef.Size || mdef.size || 'Medium',
                _raw: mdef
            });
        }

        var total = monsters.length;
        var avgLevel = total > 0 ? Math.round(levelSum / total) : 0;
        var elementWeights = {};
        var raceWeights = {};
        if (total > 0) {
            for (var k in elementCount) elementWeights[k] = Math.round((elementCount[k] / total) * 100);
            for (var k in raceCount) raceWeights[k] = Math.round((raceCount[k] / total) * 100);
        }

        var isTown = flag ? flag.isTown(mapId) : false;
        var result = {
            mapId: mapId,
            name: gateway.getDisplayName(mapId) || mapId,
            terrain: gateway.getTerrain(mapId) || 'field',
            isTown: isTown,
            region: _getRegion(mapId),
            avgLevel: avgLevel,
            monsterCount: total,
            monsters: monsters,
            elementWeights: elementWeights,
            raceWeights: raceWeights,
            bossCount: bossCount,
            miniCount: miniCount,
        };
        _mapCache[mapId] = result;
        return result;
    }

    // ============================
    //  获取所有地图数据（增加日志）
    // ============================
    function _fetchAllMaps() {
        var gateway = global.MapDataGateway;
        if (!gateway) {
            console.error('[UIMapDex] MapDataGateway 不可用');
            return { towns: [], battleMaps: [] };
        }

        // 确保初始化
        if (typeof gateway.init === 'function') {
            gateway.init();
        }

        var all = gateway.getAllMaps() || [];
        console.log('[UIMapDex] 获取到地图总数:', all.length);
        if (all.length === 0) {
            console.warn('[UIMapDex] 警告：未获取到任何地图，尝试从 window.MapData 降级读取');
            var fallback = global.MapData || [];
            if (fallback.length > 0) {
                console.log('[UIMapDex] 从 window.MapData 降级读取到', fallback.length, '张地图');
                all = fallback;
            }
        }

        // 检查 MonsterData 是否加载
        var monsterData = global.MonsterData;
        if (!monsterData || (Array.isArray(monsterData) && monsterData.length === 0) || Object.keys(monsterData).length === 0) {
            console.warn('[UIMapDex] ⚠️ MonsterData 未加载或为空，地图怪物将无法匹配！');
        } else {
            var count = Array.isArray(monsterData) ? monsterData.length : Object.keys(monsterData).length;
            console.log('[UIMapDex] MonsterData 已加载，共', count, '个怪物');
        }

        var towns = [];
        var battleMaps = [];

        for (var i = 0; i < all.length; i++) {
            var m = all[i];
            if (!m || !m.id) continue;
            var agg = _aggregateMap(m.id);


            if (!agg) continue;


                        if (agg.isTown) {
                towns.push(agg);
            } else {
                // 即使 monsterCount 为 0，也显示该地图
                battleMaps.push(agg);
            }
        }

        towns.sort(function(a, b) { return a.name.localeCompare(b.name); });
        // 战斗地图按平均等级排序
        battleMaps.sort(function(a, b) { return a.avgLevel - b.avgLevel; });

        console.log('[UIMapDex] 聚合完成：城镇', towns.length, '张，战斗地图', battleMaps.length, '张');
        // 如果有缺失怪物ID，输出统计
        if (window._missingMonsterIds) {
            var totalMissing = 0;
            for (var mid in window._missingMonsterIds) {
                totalMissing += window._missingMonsterIds[mid].length;
            }
            console.warn('[UIMapDex] 存在', totalMissing, '个怪物ID未匹配，可能影响地图数据');
        }
        return { towns: towns, battleMaps: battleMaps };
    }

    // ============================
    //  筛选与排序
    // ============================
    function _applyMapFilters(maps) {
        var result = maps.slice();
        var state = _state;

        if (state.keyword) {
            var kw = state.keyword.toLowerCase();
            result = result.filter(function(m) {
                return m.name.toLowerCase().indexOf(kw) !== -1 ||
                    m.mapId.toLowerCase().indexOf(kw) !== -1;
            });
        }

        if (state.levelRange !== '全部') {
            var range = CONFIG.levelRanges.find(function(r) { return r.label === state.levelRange; });
            if (range) result = result.filter(function(m) { return m.avgLevel >= range.min && m.avgLevel <= range.max; });
        }

        if (state.region !== '全部') {
            result = result.filter(function(m) { return m.region === state.region; });
        }

        if (state.elementFilter) {
            result = result.filter(function(m) { return m.elementWeights[state.elementFilter] && m.elementWeights[state.elementFilter] > 0; });
            result.sort(function(a, b) { return (b.elementWeights[state.elementFilter] || 0) - (a.elementWeights[state.elementFilter] || 0); });
        }

        if (state.raceFilter) {
            result = result.filter(function(m) { return m.raceWeights[state.raceFilter] && m.raceWeights[state.raceFilter] > 0; });
            result.sort(function(a, b) { return (b.raceWeights[state.raceFilter] || 0) - (a.raceWeights[state.raceFilter] || 0); });
        }

        // BOSS/MINI 筛选
        if (state.bossFilter === 'mvp') {
            result = result.filter(function(m) { return m.bossCount > 0; });
        } else if (state.bossFilter === 'mini') {
            result = result.filter(function(m) { return m.miniCount > 0; });
        } else if (state.bossFilter === 'hasBoss') {
            result = result.filter(function(m) { return m.bossCount > 0 || m.miniCount > 0; });
        }

        if (!state.elementFilter && !state.raceFilter) {
            result.sort(function(a, b) { return a.avgLevel - b.avgLevel; });
        }

        return result;
    }

    // ============================
    //  渲染：工具栏
    // ============================
    function _renderMapToolbar() {
        var state = _state;
        var html = '';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px 12px;margin-bottom:12px;align-items:center;">';
        html += '<input id="dexhub-map-search" type="text" placeholder="搜索地图..." value="' + (state.keyword || '') + '" style="flex:1;min-width:140px;padding:4px 10px;border:1px solid #ccc;border-radius:6px;font-size:0.9rem;">';
        html += '<button id="dexhub-map-search-btn" style="padding:4px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;">搜索</button>';
        html += '<button id="dexhub-map-clear-btn" style="padding:4px 14px;background:#e5e7eb;border:1px solid #ccc;border-radius:6px;cursor:pointer;">清除</button>';
        html += '</div>';

        // 等级
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:8px;align-items:center;">';
        html += '<span style="font-weight:600;font-size:0.85rem;color:#555;margin-right:4px;">📊 等级</span>';
        for (var i = 0; i < CONFIG.levelRanges.length; i++) {
            var r = CONFIG.levelRanges[i];
            var active = (r.label === state.levelRange) ? 'background:#1e40af;color:#fff;' : 'background:#f3f4f6;color:#333;';
            html += '<button class="dexhub-map-filter-btn" data-type="level" data-value="' + r.label + '" style="padding:2px 12px;border:1px solid #d1d5db;border-radius:14px;cursor:pointer;font-size:0.75rem;' + active + '">' + r.label + '</button>';
        }
        html += '</div>';

        // 区域
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:8px;align-items:center;">';
        html += '<span style="font-weight:600;font-size:0.85rem;color:#555;margin-right:4px;">📍 区域</span>';
        for (var j = 0; j < CONFIG.regions.length; j++) {
            var r2 = CONFIG.regions[j];
            var active2 = (r2 === state.region) ? 'background:#1e40af;color:#fff;' : 'background:#f3f4f6;color:#333;';
            html += '<button class="dexhub-map-filter-btn" data-type="region" data-value="' + r2 + '" style="padding:2px 12px;border:1px solid #d1d5db;border-radius:14px;cursor:pointer;font-size:0.75rem;' + active2 + '">' + r2 + '</button>';
        }
        html += '</div>';

        // 属性
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:8px;align-items:center;">';
        html += '<span style="font-weight:600;font-size:0.85rem;color:#555;margin-right:4px;">⚔️ 属性</span>';
        var allElements = ['全部'].concat(CONFIG.elements);
        for (var k = 0; k < allElements.length; k++) {
            var elem = allElements[k];
            var isActive = (elem === '全部' && !state.elementFilter) || (elem === state.elementFilter);
            var active3 = isActive ? 'background:#1e40af;color:#fff;' : 'background:#f3f4f6;color:#333;';
            var icon = CONFIG.elementIcons[elem] || '';
            var displayName = CONFIG.elementNames[elem] || elem;
            var label = elem === '全部' ? '全部' : (icon + ' ' + displayName);
            var dataVal = elem === '全部' ? '' : elem;
            html += '<button class="dexhub-map-filter-btn" data-type="element" data-value="' + dataVal + '" style="padding:2px 12px;border:1px solid #d1d5db;border-radius:14px;cursor:pointer;font-size:0.75rem;' + active3 + '">' + label + '</button>';
        }
        html += '</div>';

        // 种族
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:8px;align-items:center;">';
        html += '<span style="font-weight:600;font-size:0.85rem;color:#555;margin-right:4px;">🧬 种族</span>';
        var allRaces = ['全部'].concat(Object.keys(CONFIG.raceIcons));
        for (var l = 0; l < allRaces.length; l++) {
            var race = allRaces[l];
            var isActive4 = (race === '全部' && !state.raceFilter) || (race === state.raceFilter);
            var active4 = isActive4 ? 'background:#1e40af;color:#fff;' : 'background:#f3f4f6;color:#333;';
            var icon2 = CONFIG.raceIcons[race] || '';
                var displayName2 = CONFIG.raceNames[race] || race;
            var label2 = race === '全部' ? '全部' : (icon2 + ' ' + displayName2);
            var dataVal2 = race === '全部' ? '' : race;
            html += '<button class="dexhub-map-filter-btn" data-type="race" data-value="' + dataVal2 + '" style="padding:2px 12px;border:1px solid #d1d5db;border-radius:14px;cursor:pointer;font-size:0.75rem;' + active4 + '">' + label2 + '</button>';
        }
        html += '</div>';

        // BOSS/MINI
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:8px;align-items:center;">';
        html += '<span style="font-weight:600;font-size:0.85rem;color:#555;margin-right:4px;">👑 BOSS</span>';
        var bossOptions = [
            { label: '全部', value: 'all' },
            { label: 'MVP', value: 'mvp' },
            { label: 'MINI', value: 'mini' },
            { label: '含MVP/MINI', value: 'hasBoss' }
        ];
        for (var b = 0; b < bossOptions.length; b++) {
            var opt = bossOptions[b];
            var isActive5 = (opt.value === state.bossFilter);
            var active5 = isActive5 ? 'background:#1e40af;color:#fff;' : 'background:#f3f4f6;color:#333;';
            html += '<button class="dexhub-map-filter-btn" data-type="boss" data-value="' + opt.value + '" style="padding:2px 12px;border:1px solid #d1d5db;border-radius:14px;cursor:pointer;font-size:0.75rem;' + active5 + '">' + opt.label + '</button>';
        }
        html += '</div>';

        return html;
    }

    // ============================
    //  渲染：卡片列表
    // ============================
    function _renderMapCardList(allMaps) {
        if (!allMaps || allMaps.length === 0) {
            return '<div style="padding:40px;text-align:center;color:#999;">没有找到匹配的地图</div>';
        }
        var state = _state;
        var total = allMaps.length;
        var start = (state.page - 1) * state.size;
        var end = Math.min(start + state.size, total);
        var pageData = allMaps.slice(start, end);
        state.total = total;

        var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">';
        for (var i = 0; i < pageData.length; i++) {
            var map = pageData[i];
            var bgColor = map.isTown ? '#f5f5f5' : '#ffffff';
            var borderColor = map.isTown ? '#e0e0e0' : '#d0d7e0';
            html += '<div class="dexhub-map-card" data-mapid="' + map.mapId + '" style="border:1px solid ' + borderColor + ';border-radius:10px;padding:12px 14px;background:' + bgColor + ';box-shadow:0 1px 4px rgba(0,0,0,0.04);cursor:pointer;transition:0.15s;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            var icon = map.isTown ? '🏠' : (map.terrain === 'dungeon' ? '🗡️' : '🌿');
            html += '<div><strong style="font-size:1.05rem;">' + icon + ' ' + map.name + '</strong>';
            if (map.bossCount > 0) html += ' <span style="background:#fef3c7;color:#92400e;font-size:0.7rem;padding:0 8px;border-radius:10px;">👑 MVP×' + map.bossCount + '</span>';
            if (map.miniCount > 0) html += ' <span style="background:#e0f2fe;color:#0369a1;font-size:0.7rem;padding:0 8px;border-radius:10px;">⭐ MINI×' + map.miniCount + '</span>';
            html += '</div>';
            html += '<span style="font-size:0.8rem;color:#888;">' + map.region + '</span>';
            html += '</div>';
            if (map.isTown) {
                html += '<div style="color:#999;font-size:0.9rem;margin-top:4px;">🛡️ 安全城镇 · 无战斗</div>';
            } else {
                html += '<div style="font-size:0.85rem;color:#666;margin-top:4px;">📊 平均等级 <strong>' + map.avgLevel + '</strong>  · 共 ' + map.monsterCount + ' 种怪物</div>';
                if (map.monsters && map.monsters.length > 0) {
                    html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px 8px;max-height:72px;overflow:hidden;">';
                    for (var mi = 0; mi < Math.min(map.monsters.length, 8); mi++) {
                        var mon = map.monsters[mi];
                        var elemIcon = CONFIG.elementIcons[mon.element] || '⚪';
                        html += '<span class="dexhub-map-monster-tag" data-monster-id="' + mon.id + '" style="font-size:0.75rem;background:#f0f2f5;padding:1px 8px;border-radius:10px;cursor:pointer;white-space:nowrap;">';
                        html += mon.name + ' Lv.' + mon.level + ' ' + elemIcon;
                        html += '</span>';
                    }
                    if (map.monsters.length > 8) html += '<span style="font-size:0.7rem;color:#999;">+' + (map.monsters.length - 8) + '...</span>';
                    html += '</div>';
                }
                var topElem = null, topElemPct = 0, topRace = null, topRacePct = 0;
                for (var ek in map.elementWeights) { if (map.elementWeights[ek] > topElemPct) { topElemPct = map.elementWeights[ek]; topElem = ek; } }
                for (var rk in map.raceWeights) { if (map.raceWeights[rk] > topRacePct) { topRacePct = map.raceWeights[rk]; topRace = rk; } }
                var weightTags = [];
if (topElem && topElemPct >= 30) weightTags.push((CONFIG.elementIcons[topElem] || '') + _getElementDisplayName(topElem) + ' ' + topElemPct + '%');
if (topRace && topRacePct >= 30) weightTags.push((CONFIG.raceIcons[topRace] || '') + _getRaceDisplayName(topRace) + ' ' + topRacePct + '%');
                if (weightTags.length > 0) {
                    html += '<div style="margin-top:4px;font-size:0.7rem;color:#777;display:flex;gap:8px;flex-wrap:wrap;">';
                    html += weightTags.map(function(t) { return '<span style="background:#eef2ff;padding:0 8px;border-radius:10px;">' + t + '</span>'; }).join('');
                    html += '</div>';
                }
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function _renderMapPagination() {
        var totalPages = Math.ceil(_state.total / _state.size) || 1;
        var page = _state.page;
        if (totalPages <= 1) return '';
        var html = '<div style="display:flex;justify-content:center;gap:6px;margin-top:12px;flex-wrap:wrap;">';
        if (page > 1) html += '<button class="dexhub-map-page-btn" data-page="' + (page - 1) + '" style="padding:4px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;">上一页</button>';
        var startP = Math.max(1, page - 2), endP = Math.min(totalPages, page + 2);
        for (var p = startP; p <= endP; p++) {
            var active = (p === page) ? 'background:#3b82f6;color:#fff;' : 'background:#fff;';
            html += '<button class="dexhub-map-page-btn" data-page="' + p + '" style="padding:4px 12px;border:1px solid #ccc;border-radius:4px;cursor:pointer;' + active + '">' + p + '</button>';
        }
        if (page < totalPages) html += '<button class="dexhub-map-page-btn" data-page="' + (page + 1) + '" style="padding:4px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;">下一页</button>';
        html += '</div>';
        return html;
    }

    // ============================
    //  主渲染
    // ============================
    function _renderContent() {
        if (!global.MapDataGateway || !global.MonsterData) {
            var body = document.querySelector('.ro-panel-body');
            if (body) body.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">地图数据加载中...</div>';
            setTimeout(_renderContent.bind(this), 300);
            return;
        }

        var raw = _fetchAllMaps();
        var towns = raw.towns || [];
        var filtered = _applyMapFilters(raw.battleMaps || []);

        var html = '';
        html += _renderMapToolbar();

        // 城镇
        html += '<div style="margin-top:4px;">';
        html += '<div style="font-weight:600;font-size:0.95rem;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">🏘️ 安全城镇</div>';
        if (towns.length === 0) {
            html += '<div style="color:#999;font-size:0.9rem;padding:8px 0;">暂无城镇数据</div>';
        } else {
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:16px;">';
            for (var t = 0; t < towns.length; t++) {
                var town = towns[t];
                html += '<div style="background:#f5f5f5;border-radius:8px;padding:8px 12px;border:1px solid #e8e8e8;text-align:center;">';
                html += '<div style="font-weight:300;font-size:0.65rem;">' + town.name + '</div>';
                html += '<div style="font-size:0.7rem;color:#999;">安全区域</div>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // 战斗地图
        html += '<div style="margin-top:4px;">';
        html += '<div style="font-weight:600;font-size:0.95rem;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">⚔️ 战斗地图（' + filtered.length + ' 张）</div>';
        html += _renderMapCardList(filtered);
        html += _renderMapPagination();
        html += '</div>';

        var body = document.querySelector('.ro-panel-body');
        if (body) body.innerHTML = html;
        _bindEvents();
    }

    // ============================
    //  事件绑定
    // ============================
    function _bindEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) { setTimeout(_bindEvents.bind(this), 100); return; }
        if (_panelHandler) { container.removeEventListener('click', _panelHandler); _panelHandler = null; }

        var handler = function(e) {
            var target = e.target;

            // ---- 筛选按钮 ----
            // ---- 筛选按钮（支持点击取消选中） ----
            var filterBtn = target.closest('.dexhub-map-filter-btn');
            if (filterBtn) {
                var type = filterBtn.dataset.type;
                var value = filterBtn.dataset.value;
                var state = _state;

                // 判断当前是否已激活该筛选值
                var isActive = false;
                if (type === 'level') isActive = (state.levelRange === value);
                else if (type === 'region') isActive = (state.region === value);
                else if (type === 'element') isActive = (state.elementFilter === value || (value === '' && state.elementFilter === null));
                else if (type === 'race') isActive = (state.raceFilter === value || (value === '' && state.raceFilter === null));
                else if (type === 'boss') isActive = (state.bossFilter === value);

                // 如果点击的是已激活项，则重置为该类型的默认值
                if (isActive) {
                    if (type === 'level') state.levelRange = '全部';
                    else if (type === 'region') state.region = '全部';
                    else if (type === 'element') state.elementFilter = null;
                    else if (type === 'race') state.raceFilter = null;
                    else if (type === 'boss') state.bossFilter = 'all';
                    state.page = 1;
                    _renderContent();
                    return;
                }

                // 否则正常设置
                if (type === 'level') { state.levelRange = value; state.page = 1; _renderContent(); return; }
                if (type === 'region') { state.region = value; state.page = 1; _renderContent(); return; }
                if (type === 'element') { state.elementFilter = value || null; state.raceFilter = null; state.page = 1; _renderContent(); return; }
                if (type === 'race') { state.raceFilter = value || null; state.elementFilter = null; state.page = 1; _renderContent(); return; }
                if (type === 'boss') { state.bossFilter = value; state.page = 1; _renderContent(); return; }
                return;
            }
            // ---- 分页 ----
            var pageBtn = target.closest('.dexhub-map-page-btn');
            if (pageBtn) {
                var p = parseInt(pageBtn.dataset.page, 10);
                if (!isNaN(p) && p >= 1) { _state.page = p; _renderContent(); }
                return;
            }

            // ---- 搜索 ----
            if (target.id === 'dexhub-map-search-btn') {
                var input = document.getElementById('dexhub-map-search');
                if (input) { _state.keyword = input.value.trim(); _state.page = 1; _renderContent(); }
                return;
            }
            if (target.id === 'dexhub-map-clear-btn') {
                var input2 = document.getElementById('dexhub-map-search');
                if (input2) { input2.value = ''; _state.keyword = ''; _state.page = 1; _renderContent(); }
                return;
            }

            // ---- 地图卡片点击 ----
            var mapCard = target.closest('.dexhub-map-card');
            if (mapCard) {
                var mapId = mapCard.dataset.mapid;
                if (mapId && _mapCache[mapId]) {
                    var data = _mapCache[mapId];
                    if (data.isTown) return;
                    var detailHtml = '<div style="margin-bottom:8px;"><strong>📍 ' + data.name + '</strong>  · 平均等级 ' + data.avgLevel + '  · ' + data.monsterCount + ' 种怪物</div>';
                    if (data.monsters.length === 0) {
                        detailHtml += '<div style="color:#999;">该地图暂无怪物数据</div>';
                    } else {
                        detailHtml += '<div style="display:flex;flex-direction:column;gap:4px;">';
                        for (var mi = 0; mi < data.monsters.length; mi++) {
                            var mon = data.monsters[mi];
                            var elemIcon = CONFIG.elementIcons[mon.element] || '⚪';
                            var raceIcon = CONFIG.raceIcons[mon.race] || '🧬';
                            detailHtml += '<div style="display:flex;justify-content:space-between;padding:4px 8px;background:#f8fafc;border-radius:6px;cursor:pointer;" class="dexhub-detail-monster" data-monster-id="' + mon.id + '">';
                            detailHtml += '<span>' + mon.name + ' <span style="color:#888;">Lv.' + mon.level + '</span></span>';
                            detailHtml += '<span>' + elemIcon + ' ' + _getElementDisplayName(mon.element) + '  ' + raceIcon + ' ' + _getRaceDisplayName(mon.race) + '</span>';
                            detailHtml += '</div>';
                        }
                        detailHtml += '</div>';
                    }
                    if (typeof UIPanel !== 'undefined' && UIPanel.show) {
                        UIPanel.show({ preset: 'small', title: { icon: '🗺️', text: data.name }, content: detailHtml });
                    }
                }
                return;
            }

            // ---- 怪物标签点击 ----
            var monTag = target.closest('.dexhub-map-monster-tag');
            if (monTag) {
                var mid = parseInt(monTag.dataset.monsterId, 10);
                if (!isNaN(mid)) _showMonsterDetail(mid);
                return;
            }

            // ---- 详情弹窗中的怪物行 ----
            var detailMon = target.closest('.dexhub-detail-monster');
            if (detailMon) {
                var mid2 = parseInt(detailMon.dataset.monsterId, 10);
                if (!isNaN(mid2)) _showMonsterDetail(mid2);
                return;
            }
        };

        container.addEventListener('click', handler);
        _panelHandler = handler;
    }

    // ============================
    //  公共接口
    // ============================
    function open() {
        var existingPanel = document.querySelector('.ro-panel-container');
        if (existingPanel) {
            _isOpen = true;
            _mapCache = {};
            _renderContent();
            return;
        }

        if (typeof UIPanel === 'undefined') {
            console.error('[UIMapDex] UIPanel 未加载');
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '🗺️', text: '地图图鉴' },
            content: '<div id="mapdex-body" style="min-height:400px;">加载中...</div>',
            onClose: function() {
                _isOpen = false;
            }
        });
        _isOpen = true;
        _mapCache = {};
        setTimeout(_renderContent.bind(this), 50);
    }


    function close() {
        if (typeof UIPanel !== 'undefined') UIPanel.close();
        _isOpen = false;
    }

    function refresh() {
        if (_isOpen) { _mapCache = {}; _renderContent(); }
    }

    function init() {
        if (_initialized) return;
        if (!global.MapDataGateway) {
            console.error('[UIMapDex] MapDataGateway 未加载');
            return;
        }
        if (!global.MonsterData) {
            console.warn('[UIMapDex] MonsterData 未加载，怪物详情将不可用');
        }
        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIMapDex);
        }
        _initialized = true;
        console.log('[UIMapDex] ✅ 已初始化（地图图鉴模块）');
        // 调试接口
        global.debugMapDex = function() {
            console.log('[UIMapDex] 当前状态:', _state);
            console.log('[UIMapDex] 缓存地图数:', Object.keys(_mapCache).length);
            var raw = _fetchAllMaps();
            console.log('[UIMapDex] 聚合结果: 城镇', raw.towns.length, '战斗', raw.battleMaps.length);
            console.log('[UIMapDex] 前3张战斗地图:', raw.battleMaps.slice(0, 3));
        };
    }

    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container && _panelHandler) {
            container.removeEventListener('click', _panelHandler);
            _panelHandler = null;
        }
        close();
        _initialized = false;
        console.log('[UIMapDex] 已清理');
    }

    global.UIMapDex = {
        name: 'UIMapDex',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
        refresh: refresh,
        // 暴露调试接口
        _debug: function() {
            var raw = _fetchAllMaps();
            console.log('[UIMapDex] 城镇:', raw.towns);
            console.log('[UIMapDex] 战斗地图:', raw.battleMaps);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
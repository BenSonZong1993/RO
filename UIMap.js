// js/ui/UIMap.js
(function(global) {
    'use strict';

    // ================================================================
    // 配置：排除地图规则（策划可编辑）
    // 支持精确字符串 或 对象规则：{ type: 'prefix', pattern: '...' }
    // 目前支持 type: 'prefix' （前缀匹配），可自行扩展 suffix / regex
    // ================================================================
    var EXCLUDE_RULES = [
        // 精确匹配（字符串）
        'prt_cas',
        'prt_fild08a',
        'prt_fild08b',
        'prt_fild08c',
        'prt_fild08d',
        'prt_prison',
        'prt_q',

        // 前缀匹配（对象示例）
        { type: 'prefix', pattern: 'gld2_' },
        { type: 'prefix', pattern: 'int_' },
        { type: 'prefix', pattern: 'gld_' },
        { type: 'prefix', pattern: 'schg_dun' },
        { type: 'prefix', pattern: 'arug_dun' },
        { type: 'prefix', pattern: 'ba_' },
        { type: 'prefix', pattern: 'sp_' },
        { type: 'prefix', pattern: 'rock' },
        { type: 'prefix', pattern: 'teg_' },
        { type: 'prefix', pattern: 'sp_' },
        { type: 'prefix', pattern: 'ver' },
        // 可继续添加其他前缀，如 { type: 'prefix', pattern: 'xxx_' }
    ];

    // ---------- 新增：独立匹配函数（解耦） ----------
    function isMapExcluded(mapId) {
        if (!EXCLUDE_RULES || !Array.isArray(EXCLUDE_RULES)) return false;
        for (var i = 0; i < EXCLUDE_RULES.length; i++) {
            var rule = EXCLUDE_RULES[i];
            var matched = false;
            if (typeof rule === 'string') {
                matched = (mapId === rule);
            } else if (rule && typeof rule === 'object') {
                if (rule.type === 'prefix') {
                    matched = mapId.startsWith(rule.pattern);
                }
                // 可扩展其他 type，如 suffix, regex 等
            }
            if (matched) return true;
        }
        return false;
    }

    // ================================================================
    // 配置：地图分组（策划可编辑） —— 不变
    // ================================================================
    var GROUP_CONFIG = [
        { name: '普隆德拉区域', prefixes: ['prt_'], townIds: ['prontera'] },
        { name: '吉芬区域',       prefixes: ['gef_','gefenia'], townIds: ['geffen'] },
        { name: '斐扬区域',       prefixes: ['pay_'], townIds: ['payon'] },
        { name: '梦罗克区域',     prefixes: ['moc_'], townIds: ['morocc'] },
        { name: '依斯鲁得区域',   prefixes: ['iz_'], townIds: ['izlude'] },
        { name: '艾尔帕兰区域',   prefixes: ['alde_', 'c_tower','alde_'], townIds: ['aldebaran'] },
        { name: '艾尔贝塔区域',   prefixes: ['alb_', 'alberta'] },
        { name: '妙勒尼区域',     prefixes: ['mjo_','mjolnir_'] },
        { name: '克魔岛区域',     prefixes: ['comodo', 'cmd_'] },
        { name: '昆仑区域',       prefixes: ['gon_'] },
        { name: '汶巴拉区域',     prefixes: ['um_'] },
        { name: '尼芙菲姆区域',   prefixes: ['nif_'] },
        { name: '洛阳区域',       prefixes: ['lou_'] },
        { name: '朱诺区域',       prefixes: ['mag_dun', 'yuno_'] },
        { name: '钢铁之都区域',   prefixes: ['ein_'] },
        { name: '企业之都区域',   prefixes: ['lhz_'] },
        { name: '田园都市区域',   prefixes: ['hu_'] },
        { name: '拉赫区域',       prefixes: ['ra_'] },
        { name: '伯仁斯区域',     prefixes: ['ve_'] },
        { name: '圣诞村区域',     prefixes: ['xmas_'] },
        { name: '天津区域',       prefixes: ['ama_'] },
        { name: '发勒斯灯塔岛',   prefixes: ['alb_ship'] },
        { name: '克雷斯特汉姆',   prefixes: ['gl_','glast_'] },
        { name: '无名岛',        prefixes: ['nameless_','abbey'] },
        { name: '毁葛区域',      prefixes: ['hu_fi','tha_','abyss_'] },
        { name: '甲虫洞',        prefixes: ['dic_dun'] },
        { name: '乌龟岛',        prefixes: ['tur_'] },

        { name: '其他', catchAll: true }
    ];

    // ================================================================
    // 地形显示名（不变）
    // ================================================================
    var TERRAIN_NAMES = {
        town: '城镇（安全区）', field: '野外', dungeon: '地下城', forest: '森林',
        mountain: '山地', ocean: '海洋', volcano: '火山', snow: '雪原',
    };

    // ================================================================
    // 城镇 NPC 配置（不变）
    // ================================================================
    var TOWN_NPC_CONFIG = {
        'prontera': [
            { id: 'prontera_changeJob',  name: '普隆德拉-转职导师', action: 'changeJob', },
            { id: 'prontera_potionShop', name: '普隆德拉-药水商人', action: 'openPotionShop' },
            { id: 'prontera_equipShop',  name: '普隆德拉-装备商人', action: 'openEquipShop' },
            { id: 'prontera_skillMaster', name: '普隆德拉-技能大师', action: 'resetSkillPoints' },
            { id: 'prontera_statMaster',  name: '普隆德拉-素质大师', action: 'resetStatPoints' },
            { id: 'prontera_recycleShop', name: '普隆德拉-回收商人', action: 'openRecycleShop' },
        ],
        'geffen': [
            { id: 'geffen_changeJob',    name: '吉芬-转职导师',     action: 'changeJob',},
        ],
        'payon': [
            { id: 'payon_changeJob',     name: '斐扬-转职导师',     action: 'changeJob', },
        ],
    };

    // ================================================================
    // 内部状态（修改：移除 _townPanelContainer，增加 _townPanelOverlay）
    // ================================================================
    var _mapSelect = null;
    var _initialized = false;
    var _listeners = [];
    var _domListeners = [];

    // [MOD] 用于保存当前城镇面板的 overlay 引用
    var _townPanelOverlay = null;

    function _getEl(id) { return document.getElementById(id); }

    function _getMonsterById(id) {
        if (global.MonsterService && typeof global.MonsterService.getMonsterById === 'function') {
            return global.MonsterService.getMonsterById(id);
        }
        return null;
    }

    function _calcMapAverageLevel(map, monsterIndex) {
        if (!map || !map.monsterIds || map.monsterIds.length === 0) return 0;
        var sum = 0, count = 0;
        for (var i = 0; i < map.monsterIds.length; i++) {
            var id = map.monsterIds[i];
            var mon = (monsterIndex && monsterIndex[id]) || _getMonsterById(id);
            if (mon) {
                var lv = mon.level !== undefined ? mon.level : mon.Level;
                if (typeof lv === 'number') {
                    sum += lv;
                    count++;
                }
            }
        }
        return count > 0 ? Math.round(sum / count) : 0;
    }

    function _extractSubType(id) {
        if (!id) return '';
        var parts = id.split('_');
        if (parts.length >= 3) {
            return parts.slice(2).join('_');
        } else if (parts.length === 2) {
            return parts[1];
        }
        return id;
    }

    function _extractNumber(id) {
        if (!id) return 0;
        var match = id.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
    }

    function _isTown(mapId) {
        for (var i = 0; i < GROUP_CONFIG.length; i++) {
            var cfg = GROUP_CONFIG[i];
            if (cfg.townIds && cfg.townIds.indexOf(mapId) !== -1) {
                return true;
            }
        }
        return false;
    }

    function _groupMaps(maps, monsterIndex) {
        var groups = {};
        var catchAllGroup = null;
        GROUP_CONFIG.forEach(function(cfg) {
            groups[cfg.name] = { items: [], cfg: cfg };
            if (cfg.catchAll) catchAllGroup = cfg.name;
        });

        maps.forEach(function(map) {
            var assigned = false;
            var mapAvgLevel = _calcMapAverageLevel(map, null);

            for (var i = 0; i < GROUP_CONFIG.length; i++) {
                var cfg = GROUP_CONFIG[i];
                var matched = false;

                if (cfg.townIds && cfg.townIds.indexOf(map.id) !== -1) {
                    matched = true;
                } else if (cfg.prefixes) {
                    for (var j = 0; j < cfg.prefixes.length; j++) {
                        if (map.id.indexOf(cfg.prefixes[j]) === 0) { matched = true; break; }
                    }
                } else if (cfg.catchAll && i === GROUP_CONFIG.length - 1) {
                    matched = true;
                }

                if (matched) {
                    groups[cfg.name].items.push({ map: map, avgLevel: mapAvgLevel });
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                var fallback = catchAllGroup || '其他';
                if (!groups[fallback]) groups[fallback] = { items: [], cfg: { name: fallback } };
                groups[fallback].items.push({ map: map, avgLevel: mapAvgLevel });
            }
        });

        var result = [];
        var groupNames = Object.keys(groups);
        groupNames.forEach(function(name) {
            var group = groups[name];
            if (group.items.length === 0) return;
            var cfg = group.cfg;

            group.items.sort(function(a, b) {
                var aIsTown = global.MapDataGateway ? global.MapDataGateway.isTown(a.map.id) : false;
                var bIsTown = global.MapDataGateway ? global.MapDataGateway.isTown(b.map.id) : false;

                if (aIsTown && !bIsTown) return -1;
                if (!aIsTown && bIsTown) return 1;

                var aSub = _extractSubType(a.map.id);
                var bSub = _extractSubType(b.map.id);
                if (aSub !== bSub) {
                    return aSub.localeCompare(bSub);
                }

                if (a.avgLevel !== b.avgLevel) return a.avgLevel - b.avgLevel;
                return _extractNumber(a.map.id) - _extractNumber(b.map.id);
            });

            var totalLevel = 0;
            group.items.forEach(function(item) { totalLevel += item.avgLevel; });
            var groupAvg = group.items.length > 0 ? Math.round(totalLevel / group.items.length) : 0;

            result.push({
                name: name,
                items: group.items,
                avgLevel: groupAvg,
                isFixed: (name === '普隆德拉区域' || name === '吉芬区域' || name === '斐扬区域' ||
                          name === '梦罗克区域' || name === '依斯鲁得区域' || name === '艾尔帕兰区域')
            });
        });

        var fixedGroups = [];
        var dynamicGroups = [];
        result.forEach(function(group) {
            if (group.isFixed) {
                fixedGroups.push(group);
            } else {
                dynamicGroups.push(group);
            }
        });

        var fixedOrderNames = ['普隆德拉区域', '吉芬区域', '斐扬区域', '梦罗克区域', '依斯鲁得区域', '艾尔帕兰区域'];
        fixedGroups.sort(function(a, b) {
            return fixedOrderNames.indexOf(a.name) - fixedOrderNames.indexOf(b.name);
        });
        dynamicGroups.sort(function(a, b) {
            return a.avgLevel - b.avgLevel;
        });

        return fixedGroups.concat(dynamicGroups);
    }

    // ---------- [MOD] 城镇面板渲染（使用 UIPanel） ----------
function _showTownPanel(mapId) {
    if (_townPanelOverlay) {
        UIPanel.closeAll();
        _townPanelOverlay = null;
    }

    var npcs = TOWN_NPC_CONFIG[mapId] || [];
    var html = '';
    if (npcs.length === 0) {
        html = '<div style="color:#999;font-size:2rem;text-align:center;padding:12px 0;">该城镇暂无NPC</div>';
    } else {
        html = '<div style="display:flex;flex-direction:column;gap:8px;">'; // gap 略大
        for (var i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            html += '<button class="town-npc-btn" data-action="' + npc.action + '" data-npc-id="' + (npc.id || '') 
            + '" data-job-filter="' + ((npc.jobFilter || []).join(',')) 
            + '" style="padding:12px 20px;border:1px solid #ccc;border-radius:8px;background:#f5f5f5;cursor:pointer;font-size:2.1rem;text-align:left;width:100%;">' 
            + npc.name + '</button>';
        }
        html += '</div>';
    }

    var overlay = UIPanel.show({
        preset: 'large',          // 使用 large 预设
        title: { icon: '🏘️', text: '城镇服务' },
        content: html,
        onClose: function() {
            _townPanelOverlay = null;
        }
    });
    _townPanelOverlay = overlay;

    if (overlay) {
        if (_townPanelOverlay._clickListener) {
            overlay.removeEventListener('click', _townPanelOverlay._clickListener);
        }
        var listener = function(e) {
            var btn = e.target.closest('.town-npc-btn');
            if (!btn) return;
            var action = btn.dataset.action;
            if (action && global.EventBus) {
                var currentMapId = _mapSelect ? _mapSelect.value : null;
                global.EventBus.emit('npc:action', {
                    action: action,
                    mapId: currentMapId,
                    npcId: btn.dataset.npcId || '',
                    jobFilter: btn.dataset.jobFilter ? btn.dataset.jobFilter.split(',') : null,
                });
            }
        };
        overlay.addEventListener('click', listener);
        overlay._clickListener = listener;
    }
}


    function _hideTownPanel() {
        if (_townPanelOverlay) {
            // 如果当前活动面板是城镇面板，则 close 会关闭它并恢复之前的
            // 如果不是，则 close 可能关闭其他，所以我们使用 closeAll 强制关闭所有
            // 为了安全，我们调用 UIPanel.closeAll() 关闭所有，因为城镇面板通常独立
            UIPanel.closeAll();
            _townPanelOverlay = null;
        }
    }

    // ---------- 地图下拉填充（核心修改仅在这里） ----------
    function _populateSelect() {
        var allMaps = global.MapService.getAllMaps();
        if (!allMaps || allMaps.length === 0) {
            _mapSelect.innerHTML = '<option value="">暂无地图数据</option>';
            return;
        }

        // ***** 修改点：使用 isMapExcluded 替代 indexOf *****
        var maps = allMaps.filter(function(map) {
            return !isMapExcluded(map.id);
        });

        if (maps.length === 0) {
            _mapSelect.innerHTML = '<option value="">所有地图均被排除</option>';
            return;
        }

        if (!global.MonsterService) {
            console.warn('[UIMap] ⚠️ MonsterService 未加载，地图平均等级将为 0');
        }

        var grouped = _groupMaps(maps, null);

        var html = '';
        var currentMapId = global.DataCoordinator ? global.DataCoordinator.get('map.currentId') : null;

        for (var g = 0; g < grouped.length; g++) {
            var group = grouped[g];
            html += '<optgroup label="' + group.name + ' (平均Lv.' + group.avgLevel + ')">';
            var items = group.items;
            for (var i = 0; i < items.length; i++) {
                var map = items[i].map;
                var displayName = map.chineseName || map.id;
                var isTownMap = map.terrain === 'town';
                var townSuffix = isTownMap ? ' 🏠' : '';
                var levelInfo = items[i].avgLevel > 0 ? ' [平均Lv.' + items[i].avgLevel + ']' : (isTownMap ? '' : ' [--]');
                html += '<option value="' + map.id + '">' + displayName + townSuffix + levelInfo + '</option>';
            }
            html += '</optgroup>';
        }

        _mapSelect.innerHTML = html;

        if (currentMapId && _mapSelect.querySelector('option[value="' + currentMapId + '"]')) {
            _mapSelect.value = currentMapId;
        } else {
            var firstOption = _mapSelect.querySelector('option');
            if (firstOption) {
                _mapSelect.selectedIndex = 0;
                currentMapId = _mapSelect.value;
                if (global.DataCoordinator) global.DataCoordinator.dispatch('UIMap', 'map.currentId', currentMapId);
            }
        }
        _updateMapInfo(currentMapId);

        if (currentMapId && _isTown(currentMapId)) {
            _showTownPanel(currentMapId);
        } else {
            _hideTownPanel();
        }

        var selectedMapId = _mapSelect.value;
        if (selectedMapId && global.CanvasRenderer) {
            global.CanvasRenderer.setBackground(selectedMapId);
        }
    }

    function _updateMapInfo(mapId) {
        var mapInfo = global.MapService.getMapById(mapId);
        var noteEl = _getEl('map-note');
        if (!noteEl) return;

        if (mapInfo) {
            var monsterCount = mapInfo.monsterIds ? mapInfo.monsterIds.length : 0;
            var terrain = TERRAIN_NAMES[mapInfo.terrain] || mapInfo.terrain || '未知';
            var avgLevel = _calcMapAverageLevel(mapInfo, null);
            var levelText = avgLevel > 0 ? 'Lv.' + avgLevel : '无';

            noteEl.innerHTML = '魔物: ' + monsterCount + ' 种 <br> 地形: ' + terrain + '<br>推荐等级: ' + levelText;
        } else {
            noteEl.textContent = '未知地图';
        }
    }

    // ---------- 初始化（修改：移除创建 _townPanelContainer 的代码） ----------
    function init() {
        if (_initialized) return;
        if (!global.MapService || !global.MapService.getAllMaps) {
            console.warn('[UIMap] MapService 未就绪');
            return false;
        }

        _mapSelect = _getEl('map-select');
        if (!_mapSelect) {
            console.warn('[UIMap] 找不到 #map-select');
            return false;
        }

        var changeHandler = function() {
            var mapId = this.value;
            if (!mapId) return;
            if (global.DataCoordinator) global.DataCoordinator.dispatch('UIMap', 'map.currentId', mapId);
            if (global.CanvasRenderer && typeof global.CanvasRenderer.setBackground === 'function') {
                global.CanvasRenderer.setBackground(mapId);
            }
            _updateMapInfo(mapId);
            if (global.EventBus) global.EventBus.emit('ui:map-change', { mapId: mapId });

            if (_isTown(mapId)) {
                _showTownPanel(mapId);
            } else {
                _hideTownPanel();
            }
        };
        _mapSelect.addEventListener('change', changeHandler);
        _domListeners.push({ el: _mapSelect, event: 'change', fn: changeHandler });

        // [MOD] 移除原有的创建 _townPanelContainer 的代码块

        _populateSelect();

        var bus = global.EventBus;
        if (bus) {
            var onMapChange = function(data) {
                if (data && data.mapId) {
                    if (global.DataCoordinator) global.DataCoordinator.dispatch('UIMap', 'map.currentId', data.mapId);
                    if (global.CanvasRenderer && typeof global.CanvasRenderer.setBackground === 'function') {
                        global.CanvasRenderer.setBackground(data.mapId);
                    }
                    _updateMapInfo(data.mapId);
                    if (_mapSelect) _mapSelect.value = data.mapId;
                    if (_isTown(data.mapId)) {
                        _showTownPanel(data.mapId);
                    } else {
                        _hideTownPanel();
                    }
                }
            };
            var onAppReady = function() {
                if (_initialized) _populateSelect();
            };
            bus.on('ui:map-change', onMapChange);
            _listeners.push({ event: 'ui:map-change', fn: onMapChange });
            bus.on('app:ready', onAppReady);
            _listeners.push({ event: 'app:ready', fn: onAppReady });
        }

        _initialized = true;
        console.log('[UIMap] ✅ 已初始化（排除规则支持精确+前缀，城镇面板使用 UIPanel）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIMap);
        }
        return true;
    }

    function dispose() {
        // 关闭城镇面板
        _hideTownPanel();

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

        _initialized = false;
        console.log('[UIMap] 事件监听和DOM已清理');
    }

    global.UIMap = {
        name: 'UIMap',
        init: init,
        dispose: dispose,
        refresh: _populateSelect,
        _excludeRules: EXCLUDE_RULES  // 暴露规则以便调试
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
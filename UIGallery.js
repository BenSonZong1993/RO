// js/ui/UIGallery.js
// 图鉴模块 – 支持二级分类、搜索、仅显示可掉落、怪物地图查看
// TODO: Phase 4（暂缓）— 本文件存在 Gateway 违规（多处直读 global.MonsterData / global.MapData），
//       后续应改走 MonsterService.getAllMonsters() 与 MapDataGateway.getAllMaps()，本次不予修改。
(function(global) {
    'use strict';

    // ============================
    //  配置区（可自由调整）
    // ============================
    var CONFIG = {
        pageSize: 20,
        defaultCategory: '武器',
        defaultSubCategory: null,
        showOnlyDroppableDefault: true,
        categories: ['武器', '防具', '头饰', '时装', '影子', '消耗', '卡片'],
    };

    var SUBCATEGORY_ORDER = {
        '武器': [
            '短剑', '单手剑', '双手剑', '单手斧', '双手斧', '单手矛', '双手矛',
            '猎弓', '单手杖', '双手杖', '书籍', '拳套', '拳刃', '乐器', '鞭子',
            '左轮手枪', '来福枪', '格林机枪', '散弹枪', '榴弹发射器', '钝器', '飞镖'
        ],
        '防具': [
            '铠甲', '披肩', '鞋子', '盾牌', '饰品'
        ],
        '卡片': [
            '武器卡', '盾牌卡', '头饰卡', '铠甲卡', '披肩卡', '鞋子卡', '饰品卡',
            '头饰上卡', '头饰中卡', '头饰下卡', '通用卡'
        ],
        '头饰': [
            '上', '中', '下', '上中', '中下', '上中下'
        ],
        '时装': [
            '头饰上', '头饰中', '头饰下', '头饰上中', '头饰中下', '头饰上下', '头饰上中下', '披风', '其他时装'
        ],
        '影子': [
            '铠甲', '武器', '盾牌', '鞋子', '耳环', '吊坠'
        ],
        '消耗': [
            '回血', '回蓝', '状态', '增幅', '道具', '恢复', '其他消耗'
        ]
    };

    // ============================
    //  内部状态
    // ============================
    var _state = {
        page: 1,
        size: CONFIG.pageSize,
        category: CONFIG.defaultCategory,
        subCategory: CONFIG.defaultSubCategory,
        keyword: '',
        showOnlyDroppable: CONFIG.showOnlyDroppableDefault,
        searchAll: false,
        total: 0,
        data: []
    };

    var _subCategories = [];
    var _isOpen = false;
    var _initialized = false;
    var _domListeners = [];
    var _panelHandler = null;
    var _keyHandler = null;

    // ============================
    //  工具函数
    // ============================
    function _getItemName(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(templateId) : ('#' + templateId);
    }

    function _getItemType(templateId) {
        return global.ItemDataGateway ? global.ItemDataGateway.getType(templateId) : '其他';
    }

    function _getMonstersForItem(itemId) {
        var result = [];
        var allMonsters = global.MonsterData || [];
        var def = global.ItemDataGateway ? global.ItemDataGateway.getById(itemId) : null;
        if (!def) return result;
        var aegis = def.AegisName;
        if (!aegis) return result;

        for (var i = 0; i < allMonsters.length; i++) {
            var mon = allMonsters[i];
            if (!mon || !mon.drops) continue;
            for (var j = 0; j < mon.drops.length; j++) {
                if (mon.drops[j].Item === aegis) {
                    result.push({
                        monsterId: mon.id || mon.Id, // 兼容小写 id
                        name: mon.ChineseName || mon.Name || ('#' + (mon.id || mon.Id)),
                        level: mon.level || 0,
                        race: mon.race || '',
                        element: mon.element || '',
                        dropRate: mon.drops[j].Rate || 0,
                        _raw: mon
                    });
                    break;
                }
            }
        }
        return result;
    }

    function _getMapsForMonster(monsterId) {
        var maps = [];
        var allMaps = global.MapData || [];
        for (var i = 0; i < allMaps.length; i++) {
            var map = allMaps[i];
            if (map && map.monsterIds && map.monsterIds.indexOf(monsterId) !== -1) {
                maps.push({
                    mapId: map.id,
                    name: map.chineseName || map.name || map.id,
                    terrain: map.terrain || 'field'
                });
            }
        }
        return maps;
    }

    // 新增：获取某地图上的怪物列表（用于等级计算）
    function _getMonstersForMap(mapId) {
        if (!global.IndexService) return [];
        return global.IndexService.getMonstersForMap(mapId);
    }

    function _getMonsterName(monsterId) {
        var monsters = global.MonsterData || [];
        for (var i = 0; i < monsters.length; i++) {
            if (monsters[i].Id === monsterId) {
                return monsters[i].ChineseName || monsters[i].Name || ('#' + monsterId);
            }
        }
        return '#' + monsterId;
    }

    function _formatMapNames(maps) {
        if (!maps || maps.length === 0) return '无地图信息';
        return maps.map(function(m) {
            return m.name || m.mapId || '未知';
        }).join('、');
    }

    // ============================
    //  子分类排序
    // ============================
    function _getOrderedSubCategories(category) {
        var gateway = global.ItemDataGateway;
        if (!gateway || typeof gateway.getSubCategories !== 'function') {
            return [];
        }
        var raw = gateway.getSubCategories(category);
        raw = raw.filter(function(s) {
            return s.label !== '全部';
        });
        var order = SUBCATEGORY_ORDER[category];

        if (order && Array.isArray(order) && order.length > 0) {
            var ordered = [];
            var remaining = [];
            var orderSet = new Set(order);

            for (var i = 0; i < order.length; i++) {
                var label = order[i];
                var found = raw.find(function(s) {
                    return s.label === label;
                });
                if (found) ordered.push(found);
            }
            for (var j = 0; j < raw.length; j++) {
                if (!orderSet.has(raw[j].label)) {
                    remaining.push(raw[j]);
                }
            }
            remaining.sort(function(a, b) {
                return a.label.localeCompare(b.label);
            });
            return ordered.concat(remaining);
        }
        return raw.slice();
    }

    function _loadSubCategories() {
        _subCategories = _getOrderedSubCategories(_state.category);
        var exists = _subCategories.some(function(s) {
            return s.label === _state.subCategory;
        });
        if (!exists && _subCategories.length > 0) {
            _state.subCategory = _subCategories[0].label;
        } else if (_subCategories.length === 0) {
            _state.subCategory = null;
        }
    }

    // ============================
    //  数据加载
    // ============================
    function _loadData() {
        var gateway = global.ItemDataGateway;
        if (!gateway) {
            _state.total = 0;
            _state.data = [];
            return;
        }

        var sub = _subCategories.find(function(s) {
            return s.label === _state.subCategory;
        });
        var filterFn = sub ? sub.filter : null;
        var category = _state.searchAll ? null : _state.category;
        var finalFilter = _state.searchAll ? null : filterFn;

        var result = gateway.getPaginated(
            _state.page,
            _state.size,
            category,
            _state.keyword || undefined,
            finalFilter
        );
        _state.total = result.total;
        _state.data = result.data;
    }

    // ============================
    //  渲染函数（UI 紧凑优化）
    // ============================
    function _renderFilterBar() {
        var html = '';
        html += '<div class="gallery-filter-bar" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">';

        CONFIG.categories.forEach(function(cat) {
            var subs = _getOrderedSubCategories(cat);
            html += '<div style="display:flex; align-items:center; gap:8px; background:#f8f9fa; padding:4px 16px; border-radius:8px; border:1px solid #e0e0e0; width:100%; box-sizing:border-box;">';
            html += '<span style="background:#6c757d; color:#fff; padding:0 14px; border-radius:20px; font-weight:bold; font-size:0.85rem; line-height:26px; white-space:nowrap; flex-shrink:0;">' + cat + '</span>';
            html += '<div style="display:flex; flex-wrap:wrap; gap:3px 6px; flex:1;">';
            subs.forEach(function(sub) {
                var label = sub.label;
                var active = (cat === _state.category && label === _state.subCategory);
                html += '<button class="gallery-sub-btn" data-category="' + cat + '" data-sub="' + label + '" style="padding:0 10px; border:1px solid ' + (active ? '#dc2626' : 'transparent') + '; background:' + (active ? '#dc2626' : 'transparent') + '; color:' + (active ? '#fff' : '#555') + '; border-radius:20px; cursor:pointer; font-size:0.75rem; line-height:22px; transition:0.1s; white-space:nowrap;">' + label + '</button>';
            });
            html += '</div></div>';
        });

        html += '</div>';
        return html;
    }

    function _renderCardList(displayData) {
        if (displayData.length === 0) {
            return '<div style="padding:40px; text-align:center; color:#999;">没有找到符合条件的物品</div>';
        }

        var html = '<div style="display:flex; flex-direction:column; gap:8px;">';

        for (var i = 0; i < displayData.length; i++) {
            var def = displayData[i];
            var name = _getItemName(def.Id);
            var type = _getItemType(def.Id);

            var stats = [];
            if (def.Attack) stats.push('ATK ' + def.Attack);
            if (def.MagicAttack) stats.push('MATK ' + def.MagicAttack);
            if (def.Defense) stats.push('DEF ' + def.Defense);
            if (def.MagicDefense) stats.push('MDEF ' + def.MagicDefense);
            if (def.Weight) stats.push('重量 ' + def.Weight);
            if (def.Slots) stats.push('孔 ' + def.Slots);

            // ----- 职业需求（折叠） -----
            var jobLimit = '全部';
            var hasJobLimit = false;
            var jobKeys = [];
            if (def && def.Jobs) {
                jobKeys = Object.keys(def.Jobs).filter(function(k) {
                    return def.Jobs[k] && k !== 'All';
                });
                if (jobKeys.length > 0) {
                    hasJobLimit = true;
                    if (global.JobGateway && typeof global.JobGateway.getJobDef === 'function') {
                        var names = jobKeys.map(function(key) {
                            var jobDef = global.JobGateway.getJobDef(key);
                            return jobDef ? jobDef.name : key;
                        });
                        jobLimit = names.join('、');
                    } else {
                        jobLimit = jobKeys.join('/');
                    }
                }
            }

            var jobToggleId = 'job-toggle-' + def.Id;
            var jobDetailId = 'job-detail-' + def.Id;

            var jobHtml = '';
            if (hasJobLimit) {
                jobHtml = '<div style="font-size:0.8rem; color:#777; margin-top:2px;">职业: ';
                jobHtml += '<span class="gallery-job-toggle" data-item-id="' + '" style="cursor:pointer; color:#1e40af; text-decoration:underline; font-weight:500;">展开</span>';
                jobHtml += '<div id="' + jobDetailId + '" style="display:none; margin-top:4px; padding-left:8px; border-left:2px solid #3b82f6; font-size:0.85rem; color:#333;">';
                jobHtml += jobLimit;
                jobHtml += '</div></div>';
            } else {
                jobHtml = '<div style="font-size:0.8rem; color:#777; margin-top:2px;">职业: 全部</div>';
            }

            html += '<div style="border:1px solid #d0d7e0; border-radius:10px; padding:10px 14px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">';
            html += '<div><strong style="font-size:1.05rem;">' + name + '</strong> <span style="color:#888;font-size:0.85rem;margin-left:8px;">' + '</span></div>';
            html += '<span style="background:#eef2f6; padding:2px 12px; border-radius:12px; font-size:0.8rem;">' + type + '</span>';
            html += '</div>';


            if (stats.length) {
                html += '<div style="margin-top:4px; font-size:0.9rem; color:#555;">' + stats.join(' | ') + '</div>';
            }

            // ---- 合并需求等级 + 职业限制 ----
            var reqParts = [];
            if (def.EquipLevelMin) {
                reqParts.push('等级 ' + def.EquipLevelMin);
            }

            // 判断职业限制（复用原有 jobKeys 和 jobLimit 计算逻辑，但需要提前定义）
            var hasJobLimit = false;
            var jobKeys = [];
            if (def && def.Jobs) {
                jobKeys = Object.keys(def.Jobs).filter(function(k) {
                    return def.Jobs[k] && k !== 'All';
                });
                hasJobLimit = jobKeys.length > 0;
            }
            var jobLimit = '全部';
            if (hasJobLimit) {
                if (global.JobGateway && typeof global.JobGateway.getJobDef === 'function') {
                    var names = jobKeys.map(function(key) {
                        var jobDef = global.JobGateway.getJobDef(key);
                        return jobDef ? jobDef.name : key;
                    });
                    jobLimit = names.join('、');
                } else {
                    jobLimit = jobKeys.join('/');
                }
            }
            var jobToggleId = 'job-toggle-' + def.Id;
            var jobDetailId = 'job-detail-' + def.Id;

            var jobHtmlInline = '';
            if (hasJobLimit) {
                jobHtmlInline = '<span class="gallery-job-toggle" data-item-id="' + def.Id + '" style="cursor:pointer; color:#1e40af; text-decoration:underline; font-weight:500;">展开</span>';
                jobHtmlInline += '<div id="' + jobDetailId + '" style="display:none; margin-top:4px; padding-left:8px; border-left:2px solid #3b82f6; font-size:0.85rem; color:#333;">' + jobLimit + '</div>';
                reqParts.push('职业 ' + jobHtmlInline);
            } else {
                reqParts.push('职业 全部');
            }

            if (reqParts.length > 0) {
                html += '<div style="font-size:0.85rem; color:#666; margin-top:2px; display:flex; flex-wrap:wrap; gap:0 6px;">物品需求：' + reqParts.join('、') + '</div>';
            }





            // ---- 掉落怪物（保持原样，确保可点击） ----
            var monsters = _getMonstersForItem(def.Id);
            if (monsters && monsters.length > 0) {
                html += '<div style="font-size:0.85rem; color:#2c5282; margin-top:4px; display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px;">';
                html += '<span style="font-weight:500; margin-right:4px;">掉落怪物：</span>';
                for (var mi = 0; mi < monsters.length; mi++) {
                    var m = monsters[mi];
                    var mName = m.name || _getMonsterName(m.monsterId);
                    var rate = (m.dropRate !== undefined) ? (m.dropRate / 100).toFixed(1) + '%' : '?%';
                    var level = m.level || 0;
                    var levelText = level > 0 ? 'Lv' + level : '?';
                    html += '<span style="background:#f0f2f5; padding:2px 10px; border-radius:14px; display:inline-flex; align-items:center; gap:2px; white-space:nowrap;">';
                    html += '<a href="javascript:void(0)" class="gallery-monster-link" data-monster-id="' + m.monsterId + '" style="font-weight:500; color:#1e40af; text-decoration:underline; cursor:pointer;">' + mName + '</a>';
                    html += '<span style="color:#888; font-size:0.75rem;">(' + levelText + ' ' + rate + ')</span>';
                    html += '</span>';
                }
                html += '</div>';
            }









            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function _renderPagination() {
        var page = _state.page;
        var totalPages = Math.ceil(_state.total / _state.size) || 1;

        var html = '<div style="display:flex; justify-content:center; gap:6px; margin-top:12px; flex-wrap:wrap;">';
        if (page > 1) {
            html += '<button class="gallery-page-btn" data-page="' + (page - 1) + '" style="padding:4px 12px; border:1px solid #ccc; background:#fff; border-radius:4px; cursor:pointer;">上一页</button>';
        }
        var startPage = Math.max(1, page - 2);
        var endPage = Math.min(totalPages, page + 2);
        for (var p = startPage; p <= endPage; p++) {
            var active = (p === page) ? 'background:#3b82f6;color:#fff;' : 'background:#fff;';
            html += '<button class="gallery-page-btn" data-page="' + p + '" style="padding:4px 12px; border:1px solid #ccc; border-radius:4px; cursor:pointer; ' + active + '">' + p + '</button>';
        }
        if (page < totalPages) {
            html += '<button class="gallery-page-btn" data-page="' + (page + 1) + '" style="padding:4px 12px; border:1px solid #ccc; background:#fff; border-radius:4px; cursor:pointer;">下一页</button>';
        }
        html += '</div>';
        return html;
    }

    // ============================
    //  怪物地图弹出（含推荐等级）
    // ============================
    function _showMonsterMaps(monsterId) {
        if (isNaN(monsterId)) return;
        var maps = _getMapsForMonster(monsterId);
        var monsterName = _getMonsterName(monsterId);

        var content = '<div><strong>' + '</strong> 出现的地图：</div>';
        if (maps.length === 0) {
            content += '<div style="color:#999;margin-top:8px;">未记录任何地图</div>';
        } else {
            content += '<ul style="list-style:none;padding:0;margin:8px 0;">';
            for (var j = 0; j < maps.length; j++) {
                var map = maps[j];
                // 显示地图名称（优先中文名，否则用mapId）
                var mapName = map.name || map.mapId || '未知';
                content += '<li style="padding:4px 0;border-bottom:1px solid #eee;">' + mapName + '</li>';
            }
            content += '</ul>';
        }

        if (typeof UIPanel !== 'undefined' && UIPanel.show) {
            UIPanel.show({
                preset: 'small',
                title: {
                    icon: '🗺️',
                    text: '怪物地图'
                },
                content: content,
                onClose: function() {}
            });
        } else {
            alert(content);
        }
    }

    // ============================
    //  渲染内容主体
    // ============================
    function _renderContent() {
        if (!global.ItemDataGateway || !global.MonsterData || !global.MapData) {
            console.warn('[UIGallery] 依赖未就绪，延迟重试');
            setTimeout(_renderContent.bind(this), 500);
            return;
        }


        if (global.IndexService) {
            // 强制重建索引，解决数据不全问题
            if (typeof global.IndexService.build === 'function') {
                global.IndexService.build(true);
            }
        }

        _loadSubCategories();
        _loadData();

        var rawData = _state.data;
        var displayData = rawData;
        if (_state.showOnlyDroppable) {
            displayData = rawData.filter(function(def) {
                var monsters = _getMonstersForItem(def.Id);
                return monsters && monsters.length > 0;
            });
        }

        // ---- 工具栏 ----
        var toolbarHtml = '';
        toolbarHtml += '<div style="display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">';
        toolbarHtml += '<input id="gallery-search-input" type="text" placeholder="搜索物品..." value="' + (_state.keyword || '') + '" style="flex:1; min-width:150px; padding:5px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.9rem;">';
        toolbarHtml += '<button id="gallery-search-btn" style="padding:5px 14px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:0.9rem;">搜索</button>';
        toolbarHtml += '<button id="gallery-clear-btn" style="padding:5px 14px; background:#e5e7eb; border:1px solid #ccc; border-radius:6px; cursor:pointer; font-size:0.9rem;">清除</button>';
        toolbarHtml += '<label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; cursor:pointer;">';
        toolbarHtml += '<input id="chk-search-all" type="checkbox" ' + (_state.searchAll ? 'checked' : '') + '> 搜索全部';
        toolbarHtml += '</label>';
        toolbarHtml += '<label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; cursor:pointer;">';
        toolbarHtml += '<input id="chk-show-droppable" type="checkbox" ' + (_state.showOnlyDroppable ? 'checked' : '') + '> 仅显示可掉落';
        toolbarHtml += '</label>';
        toolbarHtml += '</div>';

        var html = '';
        html += toolbarHtml;
        html += _renderFilterBar();
        html += _renderCardList(displayData);
        html += _renderPagination();

        var body = document.querySelector('.ro-panel-body');
        if (body) {
            body.innerHTML = html;
            _bindPanelEvents();
        }
    }

    // ============================
    //  面板事件委托
    // ============================
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) {
            setTimeout(_bindPanelEvents.bind(this), 200);
            return;
        }

        if (_panelHandler) {
            container.removeEventListener('click', _panelHandler);
            _panelHandler = null;
        }
        if (_keyHandler) {
            container.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
        }

        var handler = function(e) {
            var target = e.target;

            // 子分类按钮
            var subBtn = target.closest('.gallery-sub-btn');
            if (subBtn) {
                var cat = subBtn.dataset.category;
                var sub = subBtn.dataset.sub;
                if (cat && sub) {
                    if (cat !== _state.category) {
                        _state.category = cat;
                        _state.page = 1;
                        if (_state.searchAll) {
                            _state.searchAll = false;
                        }
                    }
                    if (sub !== _state.subCategory) {
                        _state.subCategory = sub;
                        _state.page = 1;
                    }
                    _renderContent();
                }
                return;
            }

            // 分页
            var pageBtn = target.closest('.gallery-page-btn');
            if (pageBtn) {
                var p = parseInt(pageBtn.dataset.page, 10);
                if (!isNaN(p) && p >= 1) {
                    _state.page = p;
                    _renderContent();
                }
                return;
            }

            // 怪物链接（点击弹出地图）
            var monsterLink = target.closest('.gallery-monster-link');
            if (monsterLink) {
                var mid = parseInt(monsterLink.dataset.monsterId, 10);
                if (!isNaN(mid)) {
                    _showMonsterMaps(mid);
                }
                return;
            }

            // 职业折叠切换
            var jobToggle = target.closest('.gallery-job-toggle');
            if (jobToggle) {
                var itemId = jobToggle.dataset.itemId;
                if (itemId) {
                    var detailEl = document.getElementById('job-detail-' + itemId);
                    if (detailEl) {
                        var isHidden = detailEl.style.display === 'none';
                        detailEl.style.display = isHidden ? 'block' : 'none';
                        jobToggle.textContent = isHidden ? '收起' : '展开';
                    }
                }
                return;
            }

            // 搜索按钮
            if (target.id === 'gallery-search-btn') {
                var input = document.getElementById('gallery-search-input');
                if (input) {
                    _state.keyword = input.value.trim();
                    _state.page = 1;
                    _renderContent();
                }
                return;
            }

            // 清除按钮
            if (target.id === 'gallery-clear-btn') {
                var input2 = document.getElementById('gallery-search-input');
                if (input2) {
                    input2.value = '';
                    _state.keyword = '';
                    _state.page = 1;
                    _renderContent();
                }
                return;
            }

            // 全局搜索复选框
            if (target.id === 'chk-search-all') {
                _state.searchAll = target.checked;
                _state.page = 1;
                _renderContent();
                return;
            }

            // 仅显示可掉落复选框
            if (target.id === 'chk-show-droppable') {
                _state.showOnlyDroppable = target.checked;
                _state.page = 1;
                _renderContent();
                return;
            }
        };

        var keyHandler = function(e) {
            if (e.target.id === 'gallery-search-input' && e.key === 'Enter') {
                var input = e.target;
                _state.keyword = input.value.trim();
                _state.page = 1;
                _renderContent();
                e.preventDefault();
            }
        };

        container.addEventListener('click', handler);
        container.addEventListener('keydown', keyHandler);
        _panelHandler = handler;
        _keyHandler = keyHandler;
    }

    // ============================
    //  打开 / 关闭 / 刷新
    // ============================
    function openGallery() {
        var existingPanel = document.querySelector('.ro-panel-container');
        if (existingPanel) {
            _isOpen = true;
            _renderContent();
            return;
        }

        if (typeof UIPanel === 'undefined') {
            console.error('[UIGallery] UIPanel 未加载');
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '📖', text: '道具图鉴' },
            content: '<div id="gallery-body-placeholder" style="min-height:300px;">加载中...</div>',
            onClose: function() {
                _isOpen = false;
            }
        });

        _isOpen = true;
        setTimeout(_renderContent.bind(this), 50);
    }

    function closeGallery() {
        if (typeof UIPanel !== 'undefined') {
            UIPanel.close();
            _isOpen = false;
        }
        _isOpen = false;
    }

    function refresh() {
        if (_isOpen) _renderContent();
    }

    // ============================
    //  生命周期
    // ============================
    function init() {
        if (_initialized) return;
        if (!global.ItemDataGateway) {
            console.error('[UIGallery] ItemDataGateway 未加载');
            return;
        }
        if (!global.IndexService) {
            console.warn('[UIGallery] IndexService 未加载，图鉴关联查询将不可用');
        }

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIGallery);
        }

        _initialized = true;
        console.log('[UIGallery] ✅ 已初始化（紧凑版，怪物链接可点击 + 职业折叠）');
    }

    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container) {
            if (_panelHandler) {
                container.removeEventListener('click', _panelHandler);
                _panelHandler = null;
            }
            if (_keyHandler) {
                container.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }

        for (var i = 0; i < _domListeners.length; i++) {
            var item = _domListeners[i];
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];

        closeGallery();
        _initialized = false;
        console.log('[UIGallery] 已清理');
    }

    global.UIGallery = {
        name: 'UIGallery',
        init: init,
        dispose: dispose,
        open: openGallery,
        close: closeGallery,
        refresh: refresh
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
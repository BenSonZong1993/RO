// js/ui/UIMechanicDex.js
// 机制/数据图鉴 – 等级惩罚 | 属性克制 | 体型修正 | 异常状态 | 职业树
(function(global) {
    'use strict';

    var _isOpen = false;
    var _initialized = false;
    var _panelHandler = null;
    var _state = { activeTab: 'levelPenalty' };

    // ============================
    //  配置：标签页定义
    // ============================
    var TABS = [
        { id: 'levelPenalty', icon: '📊', label: '等级惩罚' },
        { id: 'elementTable', icon: '⚔️', label: '属性克制' },
        { id: 'sizeFix', icon: '📏', label: '体型修正' },
        { id: 'status', icon: '🧪', label: '异常状态' },
        { id: 'skillTree', icon: '🌳', label: '职业树' },
    ];

    // ============================
    //  渲染：等级惩罚（紧凑布局）
    // ============================
function _renderLevelPenalty() {
    var config = global.LevelPenalty;
    if (!config) return '<div style="padding:40px;text-align:center;color:#999;">等级惩罚配置未加载</div>';

    var html = '<div style="margin-bottom:12px;color:#6b7280;font-size:0.95rem;">';
    html += '根据角色与怪物的等级差，影响经验获取和掉宝率。差距 = 怪物等级 - 角色等级。<br>';
    html += '左右两侧分别为经验和掉宝的独立分段，请分别查看对应范围。';
    html += '</div>';

    var expTable = config._expTable || [];
    var dropTable = config._dropTable || [];
    var maxLen = Math.max(expTable.length, dropTable.length);

    html += '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:8px;">';
    html += '<thead><tr style="background:#f3f4f6;">';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:left;">等级差范围（经验）</th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;">经验倍率</th>';
    // 间隔列（表头）
    html += '<th style="width:20px;border:none;background:transparent;"></th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:left;">等级差范围（掉宝）</th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:right;">掉宝倍率</th>';
    html += '</tr></thead><tbody>';

    for (var i = 0; i < maxLen; i++) {
        var expRow = i < expTable.length ? expTable[i] : null;
        var dropRow = i < dropTable.length ? dropTable[i] : null;

        var expRange = '';
        var expPct = '-';
        var expColor = '#999';
        if (expRow) {
            expRange = (expRow[0] === -Infinity ? '≤' + expRow[1] : expRow[0] + '~' + expRow[1]);
            expPct = Math.round(expRow[2] * 100) + '%';
            expColor = expRow[2] >= 1 ? '#166534' : '#991b1b';
        }

        var dropRange = '';
        var dropPct = '-';
        var dropColor = '#999';
        if (dropRow) {
            dropRange = (dropRow[0] === -Infinity ? '≤' + dropRow[1] : dropRow[0] + '~' + dropRow[1]);
            dropPct = Math.round(dropRow[2] * 100) + '%';
            dropColor = dropRow[2] >= 1 ? '#166534' : '#991b1b';
        }

        html += '<tr style="border-bottom:1px solid #f3f4f6;">';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;font-weight:500;">' + expRange + '</td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:' + expColor + ';">' + expPct + '</td>';
        // 间隔列（数据行），可选加一条竖线
        // html += '<td style="width:20px;border-left:1px dashed #d1d5db;background:transparent;"></td>';
        html += '<td style="border:none;background:transparent;width:10px;"></td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;font-weight:500;">' + dropRange + '</td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:' + dropColor + ';">' + dropPct + '</td>';
        html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
}

    // ============================
    //  渲染：属性克制（硬编码 RO 官方数据）
    // ============================
function _renderElementTable() {
    // ---- RO 官方属性克制表（Lv1 ~ Lv4） ----
    // 行：攻击属性，列：防御属性，值：[Lv1, Lv2, Lv3, Lv4]
    var ELEMENTS = ['Neutral','Water','Earth','Fire','Wind','Poison','Holy','Dark','Ghost','Undead'];

    // 中英文属性名映射（用于显示）
    var ELEMENT_NAMES = {
        'Neutral': '无属性',
        'Water':   '水属性',
        'Earth':   '地属性',
        'Fire':    '火属性',
        'Wind':    '风属性',
        'Poison':  '毒属性',
        'Holy':    '圣属性',
        'Dark':    '暗属性',
        'Ghost':   '念属性',
        'Undead':  '不死属性'
    };

    var DATA = {
        'Neutral': {
            'Neutral': [100,100,100,100], 'Water': [100,100,100,100], 'Earth': [100,100,100,100],
            'Fire': [100,100,100,100], 'Wind': [100,100,100,100], 'Poison': [100,100,100,100],
            'Holy': [100,100,100,100], 'Dark': [100,100,100,100],
            'Ghost': [90,70,50,0], 'Undead': [100,100,100,100]
        },
        'Water': {
            'Neutral': [100,100,100,100], 'Water': [25,0,0,0], 'Earth': [100,100,100,100],
            'Fire': [150,175,200,200], 'Wind': [90,80,70,60], 'Poison': [150,150,125,125],
            'Holy': [100,100,100,100], 'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100], 'Undead': [100,100,100,100]
        },
        'Earth': {
            'Neutral': [100,100,100,100], 'Water': [100,100,100,100], 'Earth': [25,0,0,0],
            'Fire': [90,80,70,60], 'Wind': [150,175,200,200], 'Poison': [150,150,125,125],
            'Holy': [100,100,100,100], 'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100], 'Undead': [100,100,100,100]
        },
        'Fire': {
            'Neutral': [100,100,100,100], 'Water': [90,80,70,60], 'Earth': [150,175,200,200],
            'Fire': [25,0,0,0], 'Wind': [100,100,100,100], 'Poison': [150,150,125,125],
            'Holy': [100,100,100,100], 'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100], 'Undead': [125,150,175,200]
        },
        'Wind': {
            'Neutral': [100,100,100,100], 'Water': [150,175,200,200], 'Earth': [90,80,70,60],
            'Fire': [100,100,100,100], 'Wind': [25,0,0,0], 'Poison': [150,150,125,125],
            'Holy': [100,100,100,100], 'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100], 'Undead': [100,100,100,100]
        },
        'Poison': {
            'Neutral': [100,100,100,100], 'Water': [150,150,125,125], 'Earth': [150,150,125,125],
            'Fire': [150,150,125,125], 'Wind': [150,150,125,125],
            'Poison': [0,0,0,0],
            'Holy': [75,75,50,50], 'Dark': [75,75,50,50],
            'Ghost': [75,75,50,50], 'Undead': [75,50,25,0]
        },
        'Holy': {
            'Neutral': [100,100,100,100], 'Water': [100,100,100,100], 'Earth': [100,100,100,100],
            'Fire': [100,100,100,100], 'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [0,0,0,0],
            'Dark': [125,150,175,200],
            'Ghost': [100,100,100,100], 'Undead': [125,150,175,200]
        },
        'Dark': {
            'Neutral': [100,100,100,100], 'Water': [100,100,100,100], 'Earth': [100,100,100,100],
            'Fire': [100,100,100,100], 'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [125,150,175,200],
            'Dark': [0,0,0,0],
            'Ghost': [100,100,100,100], 'Undead': [0,0,0,0]
        },
        'Ghost': {
            'Neutral': [90,70,50,0], 'Water': [100,100,100,100], 'Earth': [100,100,100,100],
            'Fire': [100,100,100,100], 'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [90,80,70,60], 'Dark': [90,80,70,60],
            'Ghost': [125,150,175,200], 'Undead': [100,125,150,175]
        },
        'Undead': {
            'Neutral': [100,100,100,100], 'Water': [100,100,100,100], 'Earth': [100,100,100,100],
            'Fire': [90,80,70,60], 'Wind': [100,100,100,100],
            'Poison': [75,50,25,0],
            'Holy': [125,150,175,200],
            'Dark': [0,0,0,0],
            'Ghost': [100,125,150,175], 'Undead': [0,0,0,0]
        }
    };

    var html = '<div style="margin-bottom:12px;color:#6b7280;font-size:0.95rem;">';
    html += '攻击方属性 → 防御方属性，数值为伤害百分比（100% = 无修正）。每个格子从上到下为 Lv1 → Lv4。<br>';
    html += '<span style="color:#7f1d1d;font-weight:700;">免疫</span> 表示该属性攻击完全无效（0%）。';
    html += '</div>';

    // ---- 渲染表格 ----
    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
    html += '<thead><tr style="background:#f3f4f6;">';
    html += '<th style="padding:8px 10px;border:1px solid #e5e7eb;position:sticky;left:0;background:#f3f4f6;z-index:1;font-size:0.9rem;">攻击\\防御</th>';
    // 表头：使用中文属性名
    for (var i = 0; i < ELEMENTS.length; i++) {
        var displayName = ELEMENT_NAMES[ELEMENTS[i]] || ELEMENTS[i];
        html += '<th style="padding:6px 8px;border:1px solid #e5e7eb;min-width:72px;font-size:0.85rem;">' + displayName + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var atkIdx = 0; atkIdx < ELEMENTS.length; atkIdx++) {
        var atkName = ELEMENTS[atkIdx];
        var rowData = DATA[atkName];
        if (!rowData) continue;
        html += '<tr>';
        // 行头：使用中文属性名
        var displayAtkName = ELEMENT_NAMES[atkName] || atkName;
        html += '<td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:600;position:sticky;left:0;background:#fff;z-index:1;font-size:0.85rem;">' + displayAtkName + '</td>';

        for (var defIdx = 0; defIdx < ELEMENTS.length; defIdx++) {
            var defName = ELEMENTS[defIdx];
            var vals = rowData[defName] || [100, 100, 100, 100];

            var hasZero = vals.some(function(v) { return v === 0; });
            var hasStrong = vals.some(function(v) { return v > 150; });
            var bg = '#ffffff';
            if (hasZero) bg = '#fef2f2';
            else if (hasStrong) bg = '#dcfce7';

            var lines = vals.map(function(v, idx) {
                var color = '#333';
                var bold = '';
                var displayText = v + '%';
                if (v === 0) {
                    color = '#7f1d1d';
                    bold = 'font-weight:700;';
                    displayText = '免疫';
                } else if (v > 150) {
                    color = '#166534';
                    bold = 'font-weight:600;';
                } else if (v > 125) {
                    color = '#15803d';
                } else if (v < 100) {
                    color = '#b91c1c';
                }
                return '<span style="' + bold + 'color:' + color + ';">' + displayText + '</span>';
            });

            html += '<td style="padding:4px 6px;border:1px solid #e5e7eb;text-align:center;background:' + bg + ';font-size:0.7rem;line-height:1.6;">';
            html += lines[0] + '<br>' + lines[1] + '<br>' + lines[2] + '<br>' + lines[3];
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    html += '</div>';

    // 图例
    html += '<div style="display:flex;gap:16px;margin-top:12px;font-size:0.8rem;color:#6b7280;flex-wrap:wrap;">';
    html += '<span><span style="display:inline-block;width:18px;height:18px;background:#dcfce7;border:1px solid #86efac;vertical-align:middle;"></span> 强克制 (>150%)</span>';
    html += '<span><span style="display:inline-block;width:18px;height:18px;background:#fef2f2;border:1px solid #fecaca;vertical-align:middle;"></span> 免疫 (0%)</span>';
    html += '<span><span style="display:inline-block;width:18px;height:18px;background:#ffffff;border:1px solid #d1d5db;vertical-align:middle;"></span> 普通 (100%)</span>';
    html += '</div>';

    return html;
}


    // ============================
    //  渲染：体型修正（仅 Renewal，无模式切换）
    // ============================
function _renderSizeFix() {
    var data = global.SizeFixData;
    if (!data) return '<div style="padding:40px;text-align:center;color:#999;">体型修正数据未加载</div>';

    // 武器类型中英文映射（用于显示）
    var WEAPON_TYPE_NAMES = {
        'Fist':      '徒手',
        'Dagger':    '匕首',
        '1hSword':   '单手剑',
        '2hSword':   '双手剑',
        '1hSpear':   '单手矛',
        '2hSpear':   '双手矛',
        '1hAxe':     '单手斧',
        '2hAxe':     '双手斧',
        'Mace':      '锤',
        '2hMace':    '双手锤',
        'Staff':     '法杖',
        'Bow':       '弓',
        'Musical':   '乐器',
        'Whip':      '鞭子',
        'Book':      '书',
        'Katar':     '拳刃',
        'Revolver':  '左轮手枪',
        'Rifle':     '步枪',
        'Gatling':   '加特林机枪',
        'Shotgun':   '霰弹枪',
        'Grenade':   '榴弹发射器',
        'Huuma':     '风魔手里剑',
        '2hStaff':   '双手杖',
        'Knuckle':   '指虎'
    };

    var html = '<div style="margin-bottom:12px;color:#6b7280;font-size:0.95rem;">';
    html += '不同武器类型对不同体型目标的伤害修正百分比（Renewal 版本）。100% = 无修正。';
    html += '</div>';

    // 直接取 Renewal 数据
    var allData = data.getAll ? data.getAll(true) : null;
    if (!allData) {
        var raw = data._raw || data.PRE_SIZE_FIX;
        if (!raw) return '<div style="padding:40px;text-align:center;color:#999;">无法读取体型修正数据</div>';
        // 手动应用 Renewal 覆盖
        allData = JSON.parse(JSON.stringify(raw));
        var reOverrides = data.RE_OVERRIDES || data._reOverrides || {};
        for (var key in reOverrides) {
            if (allData[key]) {
                for (var k2 in reOverrides[key]) {
                    allData[key][k2] = reOverrides[key][k2];
                }
            }
        }
    }

    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">';
    html += '<thead><tr style="background:#f3f4f6;">';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:left;position:sticky;left:0;background:#f3f4f6;z-index:1;font-size:0.95rem;">武器类型</th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.95rem;">小型</th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.95rem;">中型</th>';
    html += '<th style="padding:8px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.95rem;">大型</th>';
    html += '</tr></thead><tbody>';

    var weaponTypes = Object.keys(allData);
    for (var i = 0; i < weaponTypes.length; i++) {
        var wt = weaponTypes[i];
        var row = allData[wt];
        if (!row) continue;
        var small = row.Small || row.small || 100;
        var medium = row.Medium || row.medium || 100;
        var large = row.Large || row.large || 100;

        // 使用中文名称，若映射不存在则回退到英文
        var displayName = WEAPON_TYPE_NAMES[wt] || wt;

        html += '<tr style="border-bottom:1px solid #f3f4f6;">';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;font-weight:600;position:sticky;left:0;background:#fff;z-index:1;font-size:0.9rem;">' + displayName + '</td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.9rem;' + (small !== 100 ? 'font-weight:600;' : '') + '">' + small + '%</td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.9rem;' + (medium !== 100 ? 'font-weight:600;' : '') + '">' + medium + '%</td>';
        html += '<td style="padding:6px 14px;border:1px solid #e5e7eb;text-align:center;font-size:0.9rem;' + (large !== 100 ? 'font-weight:600;' : '') + '">' + large + '%</td>';
        html += '</tr>';
    }
    html += '</tbody></table>';
    html += '</div>';

    return html;
}


    

    // ============================
    //  渲染：异常状态（占位）
    // ============================
    function _renderStatus() {
        return '<div style="padding:60px 40px;text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:16px;">🧪</div>' +
            '<div style="font-size:1.1rem;font-weight:600;color:#6b7280;">异常状态表</div>' +
            '<div style="color:#9ca3af;margin-top:8px;font-size:0.95rem;">数据整理中，即将开放</div>' +
            '</div>';
    }

    // ============================
    //  渲染：职业树（占位）
    // ============================
    function _renderSkillTree() {
        return '<div style="padding:60px 40px;text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:16px;">🌳</div>' +
            '<div style="font-size:1.1rem;font-weight:600;color:#6b7280;">职业技能树</div>' +
            '<div style="color:#9ca3af;margin-top:8px;font-size:0.95rem;">数据整理中，即将开放</div>' +
            '</div>';
    }

    // ============================
    //  主渲染调度
    // ============================
    function _renderContent() {
        var container = document.getElementById('mechanic-content');
        if (!container) {
            setTimeout(_renderContent.bind(this), 100);
            return;
        }

        var html = '';
        // 标签栏
        html += '<div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;flex-wrap:wrap;">';
        for (var i = 0; i < TABS.length; i++) {
            var t = TABS[i];
            var active = (t.id === _state.activeTab) ? 'color:#1e40af;border-bottom:3px solid #1e40af;padding-bottom:6px;font-weight:700;font-size:1rem;' : 'color:#6b7280;font-weight:600;font-size:1rem;';
            html += '<span class="mechanic-tab" data-tab="' + t.id + '" style="cursor:pointer;padding:4px 14px;' + active + '">' + t.icon + ' ' + t.label + '</span>';
        }
        html += '</div>';

        // 内容
        html += '<div id="mechanic-content-inner">';
        switch (_state.activeTab) {
            case 'levelPenalty': html += _renderLevelPenalty(); break;
            case 'elementTable': html += _renderElementTable(); break;
            case 'sizeFix': html += _renderSizeFix(); break;
            case 'status': html += _renderStatus(); break;
            case 'skillTree': html += _renderSkillTree(); break;
            default: html += '<div>未知标签页</div>';
        }
        html += '</div>';

        container.innerHTML = html;
        _bindEvents();
    }

    // ============================
    //  事件绑定
    // ============================
    function _bindEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;
        if (_panelHandler) { container.removeEventListener('click', _panelHandler); _panelHandler = null; }

        var handler = function(e) {
            var target = e.target;

            // 标签切换
            var tab = target.closest('.mechanic-tab');
            if (tab) {
                var tabId = tab.dataset.tab;
                if (tabId && tabId !== _state.activeTab) {
                    _state.activeTab = tabId;
                    _renderContent();
                }
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
            _renderContent();
            return;
        }

        if (typeof UIPanel === 'undefined') {
            console.error('[UIMechanicDex] UIPanel 未加载');
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '📚', text: '数据手册' },
            content: '<div id="mechanic-content" style="min-height:400px;">加载中...</div>',
            onClose: function() {
                _isOpen = false;
            }
        });
        _isOpen = true;
        setTimeout(_renderContent.bind(this), 50);
    }

    function close() {
        if (typeof UIPanel !== 'undefined') {
            UIPanel.close();
        }
        _isOpen = false;
    }

    function init() {
        if (_initialized) return;
        if (typeof UIPanel === 'undefined') {
            setTimeout(function() { if (typeof UIPanel !== 'undefined') init(); }, 500);
            return;
        }
        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIMechanicDex);
        }
        _initialized = true;
        console.log('[UIMechanicDex] ✅ 已初始化（数据手册）');
    }

    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container && _panelHandler) {
            container.removeEventListener('click', _panelHandler);
            _panelHandler = null;
        }
        close();
        _initialized = false;
    }

    global.UIMechanicDex = {
        name: 'UIMechanicDex',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
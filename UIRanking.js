// ============================================================
//  FILE: UIRanking.js
//  LAYER: ui（排行榜面板——只读展示）
//  权限：无（UI 只读；数据经 CloudStorageService.getRankings）
//  依赖：CloudStorageService、CharRepository（当前角色高亮）、EventBus、UIManager
//  行为：
//    · 点击顶部 🏆 排行 按钮（btn-open-rank）打开面板
//    · 云模式：拉取 /api/rankings 显示 昵称/等级/职业/战力
//    · 离线模式：提示需连接存档服务器
//    · 当前角色行高亮
// ============================================================
(function(global) {
    'use strict';
    var isOpen = false;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var _rankingsCache = [];   // 缓存的排行榜数据
    var _myNameCache = null;   // 缓存的当前角色名

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

function renderList(rankings, myName) {
    var body = document.getElementById('ranking-body');
    if (!body) return;
    if (!rankings || rankings.length === 0) {
        body.innerHTML = '<p style="text-align:center; color:#999; padding:30px 0;">暂无上榜玩家</p>';
        return;
    }

    var JobGateway = global.JobGateway || null;
    var MapGateway = global.MapDataGateway || null;

    var party = (global.SocialService && global.SocialService.getParty) ? global.SocialService.getParty() : null;
    var partyCharId = party && party.partner ? party.partner.charId : null;
    var inParty = !!party;
    var myCharId = null;
    try { myCharId = (global.CloudAdapter && global.CloudAdapter.getIdentity) ? global.CloudAdapter.getIdentity().charId : null; } catch (e) {}

    var html = '<div id="ranking-msg" style="min-height:1.2em; font-size:0.85rem; margin-bottom:4px; color:#666;">' +
        (inParty ? '👥 当前队友：' + esc(party.partner.name) + '（' + (party.partner.online ? '🟢在线' : '⚪离线') + '）' : '') +
        '</div>';

    html += '<table style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr style="border-bottom:2px solid #e0e0e0; color:#666;">' +
        '<th style="padding:6px; text-align:left;">名次</th>' +
        '<th style="padding:6px; text-align:left;">昵称</th>' +
        '<th style="padding:6px; text-align:center;">等级</th>' +
        '<th style="padding:6px; text-align:left;">地图</th>' +   // 新增
        '<th style="padding:6px; text-align:left;">职业</th>' +
        '<th style="padding:6px; text-align:center;">状态</th>' +
        '<th style="padding:6px; text-align:center;">组队</th>' +
        '</tr></thead><tbody>';

    for (var i = 0; i < rankings.length; i++) {
        var r = rankings[i];
        var isMe = (myCharId && r.charId === myCharId) || (myName && !r.charId && r.name === myName);
        var bg = isMe ? 'background:#fff8e1;' : (i % 2 ? 'background:#fafafa;' : '');
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        var online = !!r.online;
        var canInvite = online && !isMe && !inParty && r.charId !== partyCharId;

        // 职业中文
        var jobName = r.job;
        if (JobGateway && typeof JobGateway.getJobDef === 'function') {
            var jobDef = JobGateway.getJobDef(r.job);
            if (jobDef && jobDef.name) jobName = jobDef.name;
        }

        // 地图中文
        var mapName = '--';
        if (MapGateway && typeof MapGateway.getDisplayName === 'function') {
            var mapId = r.mapId || r.map;
            if (mapId) {
                var display = MapGateway.getDisplayName(mapId);
                if (display) mapName = display;
            }
        }

        html += '<tr style="border-bottom:1px solid #eee; ' + bg + '">' +
            '<td style="padding:8px 6px;">' + medal + '</td>' +
            '<td style="padding:8px 6px; font-weight:' + (isMe ? 'bold' : 'normal') + ';">' +
                esc(r.name) + (isMe ? ' <span style="color:#d4880f; font-size:0.8rem;">（我）</span>' : '') + '</td>' +
            '<td style="padding:8px 6px; text-align:center;">Lv.' + (r.level || 1) + '</td>' +
            '<td style="padding:8px 6px;">' + esc(mapName) + '</td>' +   // 地图列
            '<td style="padding:8px 6px;">' + esc(jobName) + '</td>' +
            '<td style="padding:8px 6px; text-align:center;" title="' + (online ? '在线' : '离线') + '">' + (online ? '🟢' : '⚪') + '</td>' +
            '<td style="padding:8px 6px; text-align:center;">' +
                (canInvite
                    ? '<button class="rank-invite-btn" data-char="' + esc(r.charId) + '" style="background:#2a7a2a; border:none; color:#fff; padding:3px 10px; border-radius:5px; cursor:pointer; font-size:0.8rem;">邀请</button>'
                    : '<span style="color:#ccc;">-</span>') +
            '</td>' +
            '</tr>';
    }
    html += '</tbody></table>';
    body.innerHTML = html;

    var msgEl = document.getElementById('ranking-msg');
    if (msgEl) msgEl.innerHTML = (inParty ? '👥 当前队友：' + esc(party.partner.name) + '（' + (party.partner.online ? '🟢在线' : '⚪离线') + '）' : '');
}


    // 新函数：获取数据并渲染
    function _fetchAndRender() {
        var body = document.getElementById('ranking-body');
        if (!body) return;
        var myName = (global.CharRepository ? global.CharRepository.getLiveRef() : null);
        var myNameStr = myName ? myName.name : null;
        _myNameCache = myNameStr;

        if (global.CloudStorageService && global.CloudStorageService.getMode() === 'cloud') {
            body.innerHTML = '<p style="text-align:center; color:#999; padding:30px 0;">加载中…</p>';
            global.CloudStorageService.getRankings(50, 0).then(function(res) {
                if (!isOpen) return;
                if (res && res.unavailable) {
                    body.innerHTML = '<p style="text-align:center; color:#999; padding:30px 0;">服务器不可达</p>';
                    return;
                }
                _rankingsCache = res.rankings || [];
                renderList(_rankingsCache, myNameStr);
            }).catch(function(e) {
                if (isOpen) body.innerHTML = '<p style="text-align:center; color:#c00; padding:30px 0;">加载失败：' + esc(e.message) + '</p>';
            });
        } else {
            body.innerHTML = '<p style="text-align:center; color:#999; padding:40px 20px;">📴 离线模式暂无排行榜<br/><span style="font-size:0.85rem;">连接存档服务器后，排行榜将展示所有玩家</span></p>';
        }
    }

        // ---------- 绑定排行榜面板内部事件（邀请按钮） ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        if (container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
        }

        var handler = function(e) {
            var btn = e.target.closest('.rank-invite-btn');
            if (!btn || btn.disabled) return;
            var charId = btn.getAttribute('data-char');
            if (!charId || !global.SocialService) return;
            btn.disabled = true;
            btn.textContent = '发送中…';
            global.SocialService.sendInvite(charId).then(function(res) {
                var msg = document.getElementById('ranking-msg');
                if (msg) {
                    msg.textContent = (res && res.message) || '';
                    msg.style.color = (res && res.success) ? '#2a7a2a' : '#c00';
                }
                btn.textContent = (res && res.success) ? '已邀请' : '邀请';
                setTimeout(function() { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = '邀请'; } }, 4000);
            });
        };

        container.addEventListener('click', handler);
        container._panelHandler = handler;
    }
    

    function open() {
        if (isOpen) {
            // 如果已打开，仅刷新内容（不重建 DOM）
            renderList(_rankingsCache, _myNameCache);
            return;
        }

        UIPanel.show({
            preset: 'large',
            title: { icon: '🏆', text: '排行榜' },
            content: `
                <div id="ranking-msg" style="min-height:1.2em; font-size:0.85rem; margin-bottom:6px; color:#666;"></div>
                <div id="ranking-body" style="flex:1; overflow-y:auto; min-height:200px; padding:4px 0;">
                    <p style="text-align:center; color:#999; padding:30px 0;">加载中…</p>
                </div>
            `,
            onClose: function() {
                isOpen = false;
            }
        });

        isOpen = true;
        // 绑定事件委托
        _bindPanelEvents();
        // 加载数据
        _fetchAndRender();
    }

    function close() {
        UIPanel.close();
        if (isOpen) isOpen = false;
    }

    function init() {
        if (_initialized) return;
        var btn = document.getElementById('btn-open-rank');
        if (btn) {
            var handler = function() { open(); };
            btn.addEventListener('click', handler);
            _domListeners.push({ el: btn, event: 'click', fn: handler });
        } else {
            console.warn('[UIRanking] 未找到 #btn-open-rank');
        }
        _initialized = true;
        console.log('[UIRanking] ✅ 已初始化（排行榜面板）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIRanking);
        }
    }

    function dispose() {
        // 移除面板事件委托
        var container = document.querySelector('.ro-panel-container');
        if (container && container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            delete container._panelHandler;
        }

        for (var j = 0; j < _domListeners.length; j++) {
            _domListeners[j].el.removeEventListener(_domListeners[j].event, _domListeners[j].fn);
        }
        _domListeners = [];
        // 关闭面板
        close();
        isOpen = false;
        _initialized = false;
        console.log('[UIRanking] 已清理');
    }

    global.UIRanking = { name: 'UIRanking', init: init, dispose: dispose, open: open, close: close };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);

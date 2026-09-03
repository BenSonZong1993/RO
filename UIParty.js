// ============================================================
//  FILE: js/ui/UIParty.js
//  LAYER: ui（组队 UI：队伍徽章 / 邀请弹窗 / 排行角标 / 提示 toast）
//  权限：无（UI 只发事件/调用 SocialService、PartnerManager 公开方法）
//  依赖：SocialService（队伍/邀请）、PartnerManager（召唤开关）、EventBus、UIManager
//  行为：
//    · 队伍徽章（右上角固定条，组队时显示）：队友名/在线点 + [召唤|召回] + [退出队伍] + 经验提示
//    · 收到组队邀请：居中弹窗（面板内交互，UI-1）；同意/拒绝/忽略
//    · 🏆 排行按钮红点角标 = 待处理邀请数
//    · 佣兵召唤/消散/队伍解散 → toast 提示
//  注意：不使用原生 prompt/confirm（UI-1），全部面板内交互。
// ============================================================
(function(global) {
    'use strict';

    var chip = null;
    var inviteModal = null;
    var badge = null;
    var _handledInvites = {};   // inviteId -> true（忽略过不再弹）
    var _initialized = false;
    var _toastTimer = null;

    function _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ============================================================
    //  toast
    // ============================================================
    function toast(msg, color) {
        var t = document.getElementById('ro-party-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'ro-party-toast';
            t.style.cssText = 'position:fixed; top:52px; left:50%; transform:translateX(-50%);' +
                'background:rgba(40,90,50,0.95); color:#fff; padding:8px 16px; border-radius:8px;' +
                'z-index:10250; font-size:0.9rem; box-shadow:0 4px 16px rgba(0,0,0,0.3); display:none;';
            document.body.appendChild(t);
        }
        t.style.background = color || 'rgba(40,90,50,0.95)';
        t.textContent = msg;
        t.style.display = 'block';
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function() { t.style.display = 'none'; }, 5000);
    }

    // ============================================================
    //  队伍徽章（右上角固定条）
    // ============================================================
    function ensureChip() {
        if (chip) return chip;
        chip = document.createElement('div');
        chip.id = 'party-chip';
        chip.style.cssText = 'position:fixed; top:56px; right:12px; z-index:10060;' +
            'background:rgba(255,255,255,0.95); border:1px solid #d5dee8; border-radius:10px;' +
            'padding:8px 12px; font-size:0.85rem; color:#333; box-shadow:0 4px 14px rgba(0,0,0,0.18);' +
            'display:none; align-items:center; gap:8px;';
        document.body.appendChild(chip);
        return chip;
    }

    function renderChip(party) {
        var el = ensureChip();
        if (!party) { el.style.display = 'none'; return; }
        var summoned = !!(global.PartnerManager && global.PartnerManager.isSummoned());
        var online = party.partner && party.partner.online;
        var dot = online ? '🟢' : '⚪';
        el.innerHTML =
            '<span style="font-weight:600;">👥 ' + _esc((party.partner && party.partner.name) || '队友') +
            ' <span title="' + (online ? '在线' : '离线') + '">' + dot + '</span></span>' +
            '<span style="color:#8a7500; font-size:0.75rem;">经验×' +
                ((global.PartnerManager && global.PartnerManager.getExpMultiplier) ? global.PartnerManager.getExpMultiplier() : 0.75) + '</span>' +
            '<button id="party-summon-btn" style="background:' + (summoned ? '#8a8a8a' : '#2a7a2a') +
                '; border:none; color:#fff; padding:4px 10px; border-radius:6px; cursor:pointer;">' +
                (summoned ? '召回' : '召唤') + '</button>' +
            '<button id="party-leave-btn" style="background:#eee; border:none; color:#a33; padding:4px 10px; border-radius:6px; cursor:pointer;">退出</button>';
        el.style.display = 'flex';

        var summonBtn = el.querySelector('#party-summon-btn');
        summonBtn.addEventListener('click', function() {
            if (!global.PartnerManager) return;
            global.PartnerManager.toggle().then(function(res) {
                if (res && res.success) {
                    renderChip(party);
                } else {
                    toast('暂无法召唤（对方数据未同步或冷却中）', 'rgba(160,90,20,0.95)');
                }
            });
        });
        var leaveBtn = el.querySelector('#party-leave-btn');
        leaveBtn.addEventListener('click', function() {
            if (!global.SocialService) return;
            global.SocialService.leaveParty().then(function(res) {
                toast((res && res.message) || '已退出队伍', (res && res.success) ? null : 'rgba(160,90,20,0.95)');
            });
        });
    }

    // ============================================================
    //  排行按钮角标（待处理邀请数）
    // ============================================================
    function renderBadge(count) {
        var btn = document.getElementById('btn-open-rank');
        if (!btn) return;
        if (!badge || badge.ownerButton !== btn) {
            if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
            badge = document.createElement('span');
            badge.ownerButton = btn;
            btn.style.position = 'relative';
            badge.style.cssText = 'position:absolute; top:-7px; right:-7px; min-width:18px; height:18px;' +
                'background:#e0443a; color:#fff; border-radius:9px; font-size:0.72rem; line-height:18px;' +
                'text-align:center; padding:0 4px; display:none; box-shadow:0 2px 6px rgba(0,0,0,0.3);';
            btn.appendChild(badge);
        }
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    // ============================================================
    //  邀请弹窗（UI-1：面板内交互）
    // ============================================================
    function ensureInviteModal() {
        if (inviteModal) return inviteModal;
        var div = document.createElement('div');
        div.id = 'party-invite-modal';
        div.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%;' +
            'background:rgba(0,0,0,0.35); display:none; justify-content:center; align-items:center;' +
            'z-index:10120; backdrop-filter:blur(2px);';
        div.innerHTML =
            '<div style="background:#fff; color:#333; border-radius:12px; padding:20px; width:360px; max-width:90%; box-shadow:0 8px 40px rgba(0,0,0,0.3);">' +
            '<h3 style="margin:0 0 8px; font-size:1.1rem;">👥 组队邀请</h3>' +
            '<div id="party-invite-text" style="font-size:0.95rem; margin-bottom:14px; line-height:1.6;"></div>' +
            '<div style="display:flex; gap:10px; justify-content:flex-end;">' +
            '<button id="party-invite-decline" style="background:#eee; border:none; color:#555; padding:7px 16px; border-radius:6px; cursor:pointer;">拒绝</button>' +
            '<button id="party-invite-accept" style="background:#2a7a2a; border:none; color:#fff; padding:7px 16px; border-radius:6px; cursor:pointer;">同意组队</button>' +
            '</div></div>';
        document.body.appendChild(div);
        inviteModal = div;

        var acceptBtn = div.querySelector('#party-invite-accept');
        var declineBtn = div.querySelector('#party-invite-decline');
        acceptBtn.addEventListener('click', function() {
            var invite = inviteModal._currentInvite;
            hideInvite();
            if (invite && global.SocialService) {
                global.SocialService.respondInvite(invite.id, true).then(function(res) {
                    toast((res && res.message) || '已处理', (res && res.success) ? null : 'rgba(160,90,20,0.95)');
                });
            }
        });
        declineBtn.addEventListener('click', function() {
            var invite = inviteModal._currentInvite;
            hideInvite();
            if (invite && global.SocialService) {
                global.SocialService.respondInvite(invite.id, false);
            }
        });
        div.addEventListener('click', function(e) {
            if (e.target === div) {   // 忽略（不响应邀请，等服务器 TTL 过期）
                var invite = inviteModal._currentInvite;
                if (invite) _handledInvites[invite.id] = true;
                hideInvite();
            }
        });
        return inviteModal;
    }

    function hideInvite() {
        if (inviteModal) {
            inviteModal.style.display = 'none';
            inviteModal._currentInvite = null;
        }
    }

    function maybeShowInvite(invites) {
        if (!invites || invites.length === 0) {
            if (inviteModal && inviteModal.style.display === 'flex') hideInvite();
            return;
        }
        // 弹出最新一条未处理过的邀请
        var latest = invites[invites.length - 1];
        if (!latest || _handledInvites[latest.id]) return;
        if (inviteModal && inviteModal.style.display === 'flex' &&
            inviteModal._currentInvite && inviteModal._currentInvite.id === latest.id) return;
        var m = ensureInviteModal();
        m._currentInvite = latest;
        m.querySelector('#party-invite-text').innerHTML =
            '<b>' + _esc(latest.fromName) + '</b>（Lv.' + (latest.fromLevel || 1) + '）邀请你加入队伍。<br/>' +
            '<span style="color:#888; font-size:0.82rem;">同意后双方可召唤对方为佣兵（组队期间全局经验 ×' +
            ((global.PartnerManager && global.PartnerManager.getExpMultiplier) ? global.PartnerManager.getExpMultiplier() : 0.75) + '）</span>';
        m.style.display = 'flex';
    }

    // ============================================================
    //  事件接线
    // ============================================================
    function _onSocialState(data) {
        var party = data && data.party;
        renderChip(party);
        var invites = (data && data.invites) || [];
        renderBadge(invites.length);
        maybeShowInvite(invites);
    }

    function _onPartyEnded(data) {
        var reasonText = { offline: '队友已离线，队伍解散', left: '已退出队伍', server: '服务器重启，队伍解散' };
        toast(reasonText[data && data.reason] || '队伍已解散', 'rgba(160,90,20,0.95)');
    }

    function _onPartnerDespawned(data) {
        var reasonText = { dead: '队友已倒下', 'battle-end': '战斗结束，队友消散', 'player-down': '你倒下了，队友消散', 'party-ended': '队伍解散，召唤物消散', manual: '已召回召唤物', 'party-ended-sync': '召唤物消散' };
        if (data && data.reason === 'manual') return;   // 手动召回无需提示（按钮态已反馈）
        if (data && data.reason === 'party-ended') return; // 队伍解散另有提示
        toast(reasonText[data && data.reason] || '队友消散', 'rgba(160,90,20,0.95)');
    }

    function init() {
        if (_initialized) return;
        if (!global.EventBus) return;
        _initialized = true;

        global.EventBus.on('social:state', _onSocialState);
        global.EventBus.on('social:party-ended', _onPartyEnded);
        global.EventBus.on('partner:summoned', function(data) {
            toast('👥 已召唤队友：' + (data && data.name ? data.name + ' Lv.' + data.level : ''));
        });
        global.EventBus.on('partner:despawned', _onPartnerDespawned);

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIParty);
        }
        console.log('[UIParty] ✅ 已初始化（队伍徽章/邀请弹窗/排行角标）');
    }

    function dispose() {
        if (global.EventBus) {
            global.EventBus.off('social:state', _onSocialState);
            global.EventBus.off('social:party-ended', _onPartyEnded);
            global.EventBus.off('partner:despawned', _onPartnerDespawned);
        }
        if (chip) chip.style.display = 'none';
        if (inviteModal) inviteModal.style.display = 'none';
        if (badge) badge.style.display = 'none';
        _initialized = false;
    }

    global.UIParty = { name: 'UIParty', init: init, dispose: dispose, toast: toast };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);

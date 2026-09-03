// ============================================================
//  FILE: UISettings.js
//  LAYER: ui（设置面板：账号登录 / 昵称修改 / 云端删档 / 存档冲突选择）
//  依赖：CloudStorageService、CharRepository、EventBus、UIManager
//  功能：全部保留，使用 UIPanel 统一容器
// ============================================================
(function(global) {
    'use strict';

    var DEFAULT_NAME = '冒险者';
    var conflictModal = null;
    var _acctMode = 'login';        // 'login' | 'register'
    var _toastTimer = null;
    var _initialized = false;
    var _domListeners = [];
    var _ebListeners = [];
    var isOpen = false;             // 面板打开状态

    // ---- 工具 ----
    function _getChar() {
        return global.CharRepository ? global.CharRepository.getLiveRef() : null;
    }

    function _sanitize(name) {
        name = String(name || '').trim();
        name = name.replace(/[<>"'\\\/]/g, '');
        name = name.replace(/\s+/g, ' ');
        return name;
    }

    function _escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function _isValid(name) {
        if (!name) return '昵称不能为空';
        var len = Array.from(name).length;
        if (len > 12) return '昵称最多 12 个字符';
        return null;
    }

    // ---- 应用昵称 ----
    function applyNickname(name, caller) {
        var err = _isValid(name);
        if (err) return { success: false, message: err };
        var ok = global.CharRepository.update(function(ch) {
            ch.name = name;
        }, caller || 'UISettings');
        if (!ok) return { success: false, message: '保存失败' };
        if (global.EventBus) {
            global.EventBus.emit('char:changed', { char: global.CharRepository.getLiveRef() });
        }
        return { success: true, name: name };
    }

    // ---- 应用性别 ----
    function applyGender(gender) {
        var ok = global.CharRepository.update(function(ch) {
            ch.gender = gender;
        }, 'UISettings');
        if (ok && global.EventBus) {
            global.EventBus.emit('char:changed', { char: global.CharRepository.getLiveRef() });
        }
        _updateGenderButtons();
    }

    function _updateGenderButtons() {
        var char = _getChar();
        var g = (char && char.gender === 'female') ? 'female' : 'male';
        var mb = document.getElementById('settings-gender-male');
        var fb = document.getElementById('settings-gender-female');
        if (mb) mb.style.opacity = g === 'male' ? '1' : '0.45';
        if (fb) fb.style.opacity = g === 'female' ? '1' : '0.45';
    }

    // ---- 账号区消息 ----
    function acctMsg(text, color) {
        var el = document.getElementById('acct-msg');
        if (el) {
            el.textContent = text || '';
            el.style.color = color || '#c00';
        }
    }

    // ---- 刷新账号区域 ----
    function refreshAccountArea() {
        var area = document.getElementById('settings-account-area');
        if (!area) return;
        var cs = global.CloudStorageService;
        var isCloud = cs && cs.getMode && cs.getMode() === 'cloud';
        area.style.display = isCloud ? '' : 'none';
        if (!isCloud) return;

        var info = cs.getAccountInfo ? cs.getAccountInfo() : null;
        var loginForm = document.getElementById('acct-login-form');
        var infoBox = document.getElementById('acct-info');
        if (!info) {
            loginForm.style.display = '';
            infoBox.style.display = 'none';
            return;
        }
        loginForm.style.display = 'none';
        infoBox.style.display = '';
        var char = _getChar();
        var role = char ? ('Lv.' + (char.level || 1) + ' ' + (char.jobKey || 'Novice')) : '无';
        var summaryEl = document.getElementById('acct-summary');
        if (summaryEl) {
            summaryEl.innerHTML = '当前账号：<b>' + _escapeHtml(info.username) + '</b><br>角色：' + role + (info.bound ? '（已绑定）' : '（未绑定，进度暂不上云）');
        }
        var bindBtn = document.getElementById('acct-bind-btn');
        if (bindBtn) bindBtn.style.display = info.bound ? 'none' : '';
    }

    // ---- 提交登录/注册 ----
    function submitAccountForm() {
        if (!global.CloudStorageService) return;
        var user = _sanitize(document.getElementById('acct-user').value);
        var pass = document.getElementById('acct-pass').value;
        var cs = global.CloudStorageService;
        if (!user) { acctMsg('请输入用户名'); return; }
        if (!pass) { acctMsg('请输入密码'); return; }
        acctMsg('…', '#666');
        if (_acctMode === 'register') {
            cs.accountRegister(user, pass).then(function(res) {
                if (!res || !res.success) { acctMsg((res && res.message) || '注册失败'); return; }
                acctMsg('✅ 注册成功，自动登录中…', '#2a7a2a');
                return cs.accountLogin(user, pass).then(handleLoginResult);
            });
        } else {
            cs.accountLogin(user, pass).then(handleLoginResult);
        }
    }

    function handleLoginResult(res) {
        if (!res || res.success === false) {
            acctMsg((res && res.message) || '登录失败');
            return;
        }
        if (res.pull && res.summary) {
            acctMsg('☁️ 云端进度较新（' + summaryLine(res.summary) + '），正在静默拉取…', '#2a7a2a');
            global.CloudStorageService.pullCloudOverLocal();
            return;
        }
        if (res.conflict && res.summary) {
            acctMsg('');
            close();
            openConflictPanel({ local: localSummaryForPanel(), cloud: res.summary });
            return;
        }
        refreshAccountArea();
        if (res.bindCandidate) {
            acctMsg('✅ 登录成功。该账号还没有角色，可点击下方按钮绑定本机当前角色。', '#2a7a2a');
        } else {
            acctMsg('✅ 登录成功：' + summaryLine(res.summary), '#2a7a2a');
        }
    }

    // ---- 冲突面板（独立，不迁移） ----
    function summaryLine(s) {
        if (!s) return '（无存档）';
        return 'Lv.' + (s.level || 1) + ' ' + (s.jobKey || 'Novice') +
            ' · ' + fmtTime(s.updatedAt) + ' · 版本' + (s.version || 0);
    }

    function fmtTime(ts) {
        if (!ts) return '—';
        var d = new Date(ts);
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
            ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function localSummaryForPanel() {
        var char = _getChar();
        var meta = (global.CloudStorageService && global.CloudStorageService.getLastSync) ||
                   function() { return { time: 0, version: 0 }; };
        var sync = meta();
        return {
            level: (char && char.level) || 1,
            jobKey: (char && char.jobKey) || 'Novice',
            updatedAt: sync.time || 0,
            version: sync.version || 0,
        };
    }

    function openConflictPanel(data) {
        if (!conflictModal) createConflictModal();
        conflictModal.querySelector('#conflict-cloud-row').textContent = '☁️ 云端：' + summaryLine(data.cloud);
        conflictModal.querySelector('#conflict-local-row').textContent = '💻 本地：' + summaryLine(data.local);
        conflictModal.querySelector('#conflict-msg').textContent = '';
        conflictModal.style.display = 'flex';
    }

    function closeConflictPanel() {
        if (conflictModal) conflictModal.style.display = 'none';
        if (global.CloudStorageService && global.CloudStorageService.clearPendingConflict) {
            global.CloudStorageService.clearPendingConflict();
        }
    }

    function createConflictModal() {
        var div = document.createElement('div');
        div.id = 'conflict-modal';
        div.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.45); display: none;
            justify-content: center; align-items: center;
            z-index: 10100; backdrop-filter: blur(2px);
        `;
        div.innerHTML = `
            <div style="background:#fff; color:#333; border-radius:12px; padding:22px; width:440px; max-width:92%; box-shadow:0 8px 40px rgba(0,0,0,0.3);">
                <h2 style="margin:0 0 6px; font-size:1.15rem;">⚠️ 检测到两端存档冲突</h2>
                <div style="font-size:0.85rem; color:#777; margin-bottom:12px;">本地与云端的进度不一致，请选择保留哪一侧（默认建议保留本地并上传）。</div>
                <div style="background:#f5f8fc; border:1px solid #dde6f0; border-radius:8px; padding:10px; font-size:0.92rem; line-height:1.8;">
                    <div id="conflict-cloud-row" style="color:#2a6db0;">☁️ 云端：-</div>
                    <div id="conflict-local-row" style="color:#a06a1e;">💻 本地：-</div>
                </div>
                <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
                    <button id="conflict-keep-local" style="background:#2a7a2a; border:none; color:#fff; padding:8px 14px; border-radius:6px; cursor:pointer;">用本地覆盖云端（推荐）</button>
                    <button id="conflict-pull-cloud" style="background:#4a90d9; border:none; color:#fff; padding:8px 14px; border-radius:6px; cursor:pointer;">拉取云端覆盖本地</button>
                    <button id="conflict-dismiss" style="background:#eee; border:none; color:#555; padding:8px 14px; border-radius:6px; cursor:pointer;">暂不处理</button>
                </div>
                <div id="conflict-msg" style="color:#c00; font-size:0.85rem; min-height:1.2em; margin-top:8px;"></div>
            </div>
        `;
        document.body.appendChild(div);
        conflictModal = div;

        conflictModal.querySelector('#conflict-keep-local').addEventListener('click', function() {
            var msg = conflictModal.querySelector('#conflict-msg');
            msg.style.color = '#666';
            msg.textContent = '正在上传本地存档…';
            global.CloudStorageService.forcePushLocal().then(function(res) {
                if (res && res.success) {
                    msg.style.color = '#2a7a2a';
                    msg.textContent = '✅ 已用本地存档覆盖云端（v' + res.version + '）';
                    setTimeout(closeConflictPanel, 900);
                } else {
                    msg.style.color = '#c00';
                    msg.textContent = (res && res.message) || '上传失败';
                }
            });
        });
        conflictModal.querySelector('#conflict-pull-cloud').addEventListener('click', function() {
            var msg = conflictModal.querySelector('#conflict-msg');
            msg.style.color = '#666';
            msg.textContent = '正在拉取云端存档…';
            global.CloudStorageService.pullCloudOverLocal().then(function(ok) {
                if (!ok) { msg.style.color = '#c00'; msg.textContent = '拉取失败（继续本地）'; }
                // 成功会自动刷新页面
            });
        });
        conflictModal.querySelector('#conflict-dismiss').addEventListener('click', function() {
            closeConflictPanel();
        });
        return conflictModal;
    }

    // ---- Toast / alert ----
    function showToast(msg) {
        var t = document.getElementById('ro-takeover-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'ro-takeover-toast';
            t.style.cssText = 'position:fixed; top:14px; left:50%; transform:translateX(-50%);' +
                'background:rgba(200,60,50,0.95); color:#fff; padding:10px 18px; border-radius:8px;' +
                'z-index:10200; font-size:0.95rem; box-shadow:0 4px 16px rgba(0,0,0,0.3); display:none;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.display = 'block';
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function() { t.style.display = 'none'; }, 6000);
    }

    function alertSafe(msg) {
        var msgEl = document.getElementById('settings-msg');
        if (msgEl) { msgEl.textContent = msg; msgEl.style.color = '#c00'; }
        if (global.alert) global.alert(msg);
    }

    // ============================================================
    //  主面板（UIPanel）
    // ============================================================
    function open(focusInput) {
        if (isOpen) {
            refreshAccountArea();
            _updateGenderButtons();
            return;
        }
    // 面板显示后绑定按钮事件（确保 DOM 已插入）
    var resetBtn = document.getElementById('btn-reset-save');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            // 这里写原来重置存档的逻辑，比如调用某个函数
            if (confirm('确定要重置存档吗？')) {
                // 执行重置操作
            }
        });
    }
        var isCloud = global.CloudStorageService && global.CloudStorageService.getMode() === 'cloud';
        var contentHtml = `
            <div style="font-size:0.95rem;">
                <div style="margin-bottom:6px;">同步状态：<span id="settings-mode">${isCloud ? '☁️ 云端同步（存档自动上传）' : '📴 离线模式（进度仅保存在本地）'}</span></div>
                <div style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                    <span>性别：</span>
                    <button id="settings-gender-male" style="background:#3B82F6; border:none; color:#fff; padding:5px 14px; border-radius:6px; cursor:pointer;">男</button>
                    <button id="settings-gender-female" style="background:#E56A90; border:none; color:#fff; padding:5px 14px; border-radius:6px; cursor:pointer;">女</button>
                    <span id="settings-gender-note" style="color:#888; font-size:0.8rem;">影响本人与队友侧的你的外观</span>
                </div>
                <div id="settings-account-area" style="display:${isCloud ? '' : 'none'}; margin-bottom:12px; padding:10px; background:#f5f8fc; border:1px solid #dde6f0; border-radius:8px;">
                    <div style="font-weight:bold; margin-bottom:8px;">👤 账号</div>
                    <div id="acct-login-form">
                        <input id="acct-user" maxlength="24" placeholder="用户名（2-24 字符）" style="width:100%; box-sizing:border-box; padding:6px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.95rem; outline:none; margin-bottom:6px;" />
                        <input id="acct-pass" type="password" maxlength="64" placeholder="密码（至少 4 位）" style="width:100%; box-sizing:border-box; padding:6px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.95rem; outline:none; margin-bottom:8px;" />
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button id="acct-submit" style="background:#4a90d9; border:none; color:#fff; padding:6px 18px; border-radius:6px; cursor:pointer;">登录</button>
                            <a id="acct-switch" href="javascript:void(0)" style="font-size:0.85rem; color:#4a90d9; cursor:pointer;">没有账号？去注册</a>
                        </div>
                    </div>
                    <div id="acct-info" style="display:none;">
                        <div id="acct-summary" style="margin-bottom:8px; font-size:0.9rem; line-height:1.5;"></div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button id="acct-bind-btn" style="display:none; background:#e08a2e; border:none; color:#fff; padding:6px 14px; border-radius:6px; cursor:pointer;">绑定当前角色到此账号</button>
                            <button id="acct-logout-btn" style="background:#8a8a8a; border:none; color:#fff; padding:6px 14px; border-radius:6px; cursor:pointer;">退出登录</button>
                        </div>
                    </div>
                    <div id="acct-msg" style="color:#c00; font-size:0.85rem; min-height:1.2em; margin-top:6px;"></div>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin:10px 0;">
                    <span>昵称：</span>
                    <input id="settings-nick-input" maxlength="12" placeholder="最多12个字符" style="flex:1; padding:6px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.95rem; outline:none;" />
                    <button id="settings-rename-btn" style="background:#4a90d9; border:none; color:#fff; padding:6px 14px; border-radius:6px; cursor:pointer;">确认</button>
                </div>
                <div id="settings-msg" style="color:#c00; font-size:0.85rem; min-height:1.2em;"></div>
            </div>
           

                    <div style="border-top:1px solid #e0e0e0; margin-top:14px; padding-top:12px; text-align:right;">
             <button id="btn-reset-save">重置存档</button>
            <button id="settings-del-btn" style="padding: 10px 20px;
    cursor: pointer;
    background: #ef4444d6;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: 16px;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;">删除云端角色</button>
            </div>
        `;




        UIPanel.show({
            preset: 'large',
            title: { icon: '⚙️', text: '设置' },
            content: contentHtml,
            onClose: function() {
                isOpen = false;
            }
        });

        isOpen = true;
        _bindPanelEvents();
        refreshAccountArea();
        _updateGenderButtons();

        if (focusInput) {
            var input = document.getElementById('settings-nick-input');
            if (input) {
                input.value = '';
                setTimeout(function() { input.focus(); }, 50);
            }
        }
    }

    function close() {
        UIPanel.close();
        if (isOpen) isOpen = false;
    }

    // ---------- 面板内部事件绑定 ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        if (container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            container.removeEventListener('keydown', container._panelKeyHandler);
            delete container._panelHandler;
            delete container._panelKeyHandler;
        }

        var clickHandler = function(e) {
            var target = e.target;

            // 性别按钮
            if (target.id === 'settings-gender-male') {
                applyGender('male');
                return;
            }
            if (target.id === 'settings-gender-female') {
                applyGender('female');
                return;
            }

            // 昵称修改
            if (target.id === 'settings-rename-btn') {
                var input = document.getElementById('settings-nick-input');
                var msg = document.getElementById('settings-msg');
                if (!input) return;
                var result = applyNickname(_sanitize(input.value), 'UISettings');
                if (result.success) {
                    msg.style.color = '#4caf50';
                    msg.textContent = '✅ 昵称已更新并同步';
                    input.value = result.name;
                    var char = _getChar();
                    if (char) {
                        var modeEl = document.getElementById('settings-mode');
                        if (modeEl) modeEl.textContent = '当前昵称：' + char.name;
                    }
                } else {
                    msg.style.color = '#c00';
                    msg.textContent = result.message;
                }
                return;
            }

            // 账号提交
            if (target.id === 'acct-submit') {
                submitAccountForm();
                return;
            }

            // 切换登录/注册
            if (target.id === 'acct-switch') {
                _acctMode = (_acctMode === 'login') ? 'register' : 'login';
                var submit = document.getElementById('acct-submit');
                var sw = document.getElementById('acct-switch');
                if (_acctMode === 'register') {
                    submit.textContent = '注册';
                    sw.textContent = '已有账号？去登录';
                    acctMsg('注册只创建账号，不创建角色；注册后自动登录。', '#666');
                } else {
                    submit.textContent = '登录';
                    sw.textContent = '没有账号？去注册';
                    acctMsg('');
                }
                return;
            }

            // 绑定当前角色
            if (target.id === 'acct-bind-btn') {
                var btn = target;
                btn.disabled = true;
                global.CloudStorageService.accountBindCurrentChar().then(function(res) {
                    btn.disabled = false;
                    if (res && res.success) {
                        acctMsg('✅ 已绑定角色 ' + res.charId + '，此后进度自动同步此账号', '#2a7a2a');
                        refreshAccountArea();
                    } else {
                        acctMsg((res && res.message) || '绑定失败', '#c00');
                    }
                });
                return;
            }

            // 退出登录
            if (target.id === 'acct-logout-btn') {
                global.CloudStorageService.accountLogout();
                return;
            }

            // 删除云端角色
            if (target.id === 'settings-del-btn') {
                if (!global.confirm || !global.confirm('将删除【云端】存档与本机进度，角色永久消失！\n是否继续？')) return;
                if (!global.CloudStorageService) return;
                global.CloudStorageService.deleteRemoteSave().then(function() {
                    global.CharRepository.delete('GMConsole');
                    global.InventoryRepository.reset('InventoryService');
                    global.MapRepository.reset('GMConsole');
                    global.PersistenceManager.flush();
                    try { localStorage.removeItem('RO_Cloud_Auth'); } catch (e) {}
                    if (global.AttributeMediator) global.AttributeMediator.forceRecalc();
                    alertSafe('已删除。页面即将刷新以创建新角色。');
                    global.location.reload();
                }).catch(function(e) {
                    alertSafe('删除失败：' + (e && e.message ? e.message : '未知错误'));
                });
                return;
            }
        };

        var keyHandler = function(e) {
            if (e.target.id === 'settings-nick-input' && e.key === 'Enter') {
                var renameBtn = document.getElementById('settings-rename-btn');
                if (renameBtn) renameBtn.click();
            }
            if ((e.target.id === 'acct-user' || e.target.id === 'acct-pass') && e.key === 'Enter') {
                var submitBtn = document.getElementById('acct-submit');
                if (submitBtn) submitBtn.click();
            }
        };

        container.addEventListener('click', clickHandler);
        container.addEventListener('keydown', keyHandler);
        container._panelHandler = clickHandler;
        container._panelKeyHandler = keyHandler;
    }

    // ============================================================
    //  初始化与销毁
    // ============================================================
    function _bindButton() {
        var btn = document.getElementById('btn-settings');
        if (!btn) { console.warn('[UISettings] 未找到 #btn-settings'); return; }
        var handler = function() { open(false); };
        btn.addEventListener('click', handler);
        _domListeners.push({ el: btn, event: 'click', fn: handler });
    }

    function init() {
        if (_initialized) return;
        if (!global.EventBus) return;
        _bindButton();
        _initialized = true;
        console.log('[UISettings] ✅ 已初始化（UIPanel 版）');

        global.EventBus.on('cloud:conflict', function(data) { openConflictPanel(data); });
        global.EventBus.on('net:status', function(payload) {
            if (payload && payload.takeover && payload.message) showToast(payload.message);
        });

        // 首次进入自动打开
        setTimeout(function() {
            var char = _getChar();
            if (char && (!char.name || char.name === DEFAULT_NAME)) {
                open(true);
            }
        }, 1500);

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UISettings);
        }
    }

    function dispose() {
        var container = document.querySelector('.ro-panel-container');
        if (container) {
            if (container._panelHandler) {
                container.removeEventListener('click', container._panelHandler);
                container.removeEventListener('keydown', container._panelKeyHandler);
                delete container._panelHandler;
                delete container._panelKeyHandler;
            }
        }
        for (var j = 0; j < _domListeners.length; j++) {
            _domListeners[j].el.removeEventListener(_domListeners[j].event, _domListeners[j].fn);
        }
        _domListeners = [];
        // 清空事件总线监听（这里可保留，因为模块卸载时一并清理）
        // 但我们保留了 _ebListeners 未使用，可删除。
        close();
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        _initialized = false;
        console.log('[UISettings] 已清理');
    }

    // ============================================================
    //  暴露全局
    // ============================================================
    global.UISettings = {
        name: 'UISettings',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
        applyNickname: applyNickname,
        openConflictPanel: openConflictPanel,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
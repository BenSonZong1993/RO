// js/ui/UIPanel.js
// v2.2 – 修复按钮点击与遮罩关闭
(function(global) {
    'use strict';

    var _activePanel = null;    // 当前显示的覆盖层
    var _stack = [];           // 隐藏的面板栈

    var PRESETS = {
        large: {
            maxWidth: '960px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.6)',
            shadow: '0 20px 60px rgba(0,0,0,0.20)',
            padding: '24px 28px',
            fontSize: '1.5rem',
            bg: 'rgba(255,255,255,0.92)',
        },
        small: {
            maxWidth: '480px',
            borderRadius: '18px',
            border: '1px solid rgba(0,0,0,0.08)',
            shadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '18px 22px',
            fontSize: '1.25rem',
            bg: 'rgba(255,255,255,0.96)',
        },
        dialog: {
            maxWidth: '380px',
            borderRadius: '14px',
            border: 'none',
            shadow: '0 4px 24px rgba(0,0,0,0.15)',
            padding: '20px 24px',
            fontSize: '0.95rem',
            bg: '#ffffff',
        }
    };

function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'ro-panel-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center;
        animation: roFadeIn 0.25s ease;
        padding: 16px;
        pointer-events: auto;   /* ← 改为 auto，使遮罩可点击 */
    `;
    return overlay;
}
    function createContainer(preset, styleOverrides) {
        var cfg = PRESETS[preset] || PRESETS.large;
        var merged = Object.assign({}, cfg, styleOverrides || {});

        var container = document.createElement('div');
        container.className = 'ro-panel-container';
        container.style.cssText = `
            background: ${merged.bg};
            border-radius: ${merged.borderRadius};
            border: ${merged.border};
            box-shadow: ${merged.shadow};
            max-width: ${merged.maxWidth};
            width: 100%;
            max-height: 95vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: roSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: var(--panel-font, system-ui, sans-serif);
            color: var(--panel-text-primary, #1a2639);
            font-size: ${merged.fontSize};
            pointer-events: auto;
        `;
        if (merged.extraStyle) {
            Object.assign(container.style, merged.extraStyle);
        }
        return container;
    }

    function buildHeader(title, onClose) {
        var header = document.createElement('div');
        header.className = 'ro-panel-header';
        header.style.cssText = `
            padding: 14px 20px;
            background: rgba(255,255,255,0.4);
            backdrop-filter: blur(4px);
            border-bottom: 1px solid rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            pointer-events: auto;
        `;
        header.innerHTML = `
            <h2 style="margin:0; font-size:1.2rem; font-weight:700; letter-spacing:-0.01em; display:flex; align-items:center; gap:8px;">
                <span style="color:var(--panel-accent-blue, #3b82f6);">${title.icon || '📋'}</span>
                ${title.text || '面板'}
            </h2>
            <button class="ro-panel-close" style="
                background: none; border: none; 
                width: 36px; height: 36px; 
                border-radius: 50%; 
                cursor: pointer;
                font-size: 1.5rem; line-height: 1;
                color: var(--panel-text-secondary, #4a5b72);
                transition: background 0.2s;
                display: flex; align-items: center; justify-content: center;
                pointer-events: auto;
            " onmouseover="this.style.background='rgba(0,0,0,0.06)'" onmouseout="this.style.background='transparent'">
                ✕
            </button>
        `;
        var closeBtn = header.querySelector('.ro-panel-close');
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (onClose) onClose();
            UIPanel.close();
        });
        return header;
    }

    function buildBody(contentHtml) {
        var body = document.createElement('div');
        body.className = 'ro-panel-body';
        body.style.cssText = `
            padding: 16px 20px 20px 20px;
            overflow-y: auto;
            flex: 1;
            color: var(--panel-text-primary, #1a2639);
            line-height: 1.6;
            scroll-behavior: smooth;
            pointer-events: auto;
        `;
        if (typeof contentHtml === 'string') {
            body.innerHTML = contentHtml;
        } else if (contentHtml instanceof HTMLElement) {
            body.appendChild(contentHtml);
        }
        // 确保所有按钮可点击
        var buttons = body.querySelectorAll('button');
        buttons.forEach(function(btn) {
            btn.style.setProperty('pointer-events', 'auto', 'important');
        });
        return body;
    }

    function injectStyles() {
        if (document.getElementById('ro-panel-styles')) return;
        var style = document.createElement('style');
        style.id = 'ro-panel-styles';
        style.textContent = `
            @keyframes roFadeIn {
                from { opacity: 0; } to { opacity: 1; }
            }
            @keyframes roSlideUp {
                from { opacity: 0; transform: translateY(24px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .ro-panel-body::-webkit-scrollbar {
                width: 4px;
            }
            .ro-panel-body::-webkit-scrollbar-track {
                background: transparent;
            }
            .ro-panel-body::-webkit-scrollbar-thumb {
                background: var(--panel-accent-blue, #3b82f6);
                border-radius: 10px;
            }
            .ro-panel-body {
                scrollbar-width: thin;
                scrollbar-color: var(--panel-accent-blue, #3b82f6) transparent;
            }
            .ro-card {
                background: #fff6f8;
                border-radius: 16px;
                padding: 12px 16px;
                border: 1px solid #e0e2e6;
                margin-bottom: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }
            .ro-stat-row {
                display: flex;
                justify-content: space-between;
                padding: 6px 0;
                border-bottom: 1px solid rgba(0,0,0,0.04);
            }
            .ro-stat-row:last-child {
                border-bottom: none;
            }
            .ro-badge {
                display: inline-block;
                background: var(--panel-accent-blue, #3b82f6);
                color: white;
                border-radius: 20px;
                padding: 2px 12px;
                font-size: 1.25rem;
                font-weight: 60vw;
            }
            .ro-panel-body button {
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ---- 公共 API ----
    var UIPanel = {
        show: function(options) {
            injectStyles();
            // 如果有活动面板，压栈并隐藏
            if (_activePanel) {
                _stack.push(_activePanel);
                _activePanel.style.display = 'none';
            }

            var preset = options.preset || 'large';
            var styleOverrides = options.style || {};
            var overlay = createOverlay();
            var container = createContainer(preset, styleOverrides);
            var header = buildHeader(options.title || { text: '面板' }, options.onClose || null);
            var body = buildBody(options.content || '<p>内容加载中...</p>');

            container.appendChild(header);
            container.appendChild(body);
            overlay.appendChild(container);
            document.body.appendChild(overlay);

            _activePanel = overlay;

            // 点击遮罩关闭
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    UIPanel.close();
                    if (options.onClose) options.onClose();
                }
            });

            return overlay;
        },

        close: function() {
            if (_activePanel) {
                document.body.removeChild(_activePanel);
                _activePanel = null;
            }
            // 恢复上一个面板
            if (_stack.length > 0) {
                var prev = _stack.pop();
                prev.style.display = 'flex';
                _activePanel = prev;
            }
        },

        updateContent: function(newHtml) {
            if (!_activePanel) return;
            var body = _activePanel.querySelector('.ro-panel-body');
            if (body) {
                if (typeof newHtml === 'string') body.innerHTML = newHtml;
                else if (newHtml instanceof HTMLElement) {
                    body.innerHTML = '';
                    body.appendChild(newHtml);
                }
                // 重新强制按钮可点击
                var buttons = body.querySelectorAll('button');
                buttons.forEach(function(btn) {
                    btn.style.setProperty('pointer-events', 'auto', 'important');
                });
            }
        },

        closeAll: function() {
            while (_activePanel) {
                document.body.removeChild(_activePanel);
                _activePanel = null;
            }
            _stack = [];
        },

        // ---- 非阻塞 alert ----
        alert: function(message, title) {
            return new Promise(function(resolve) {
                var overlay = UIPanel.show({
                    preset: 'dialog',
                    title: { icon: 'ℹ️', text: title || '提示' },
                    content: `
                        <p style="margin: 8px 0 16px; word-break:break-word;">${message}</p>
                        <div style="display:flex; justify-content:flex-end;">
                            <button class="ro-alert-ok" style="background:#3b82f6; border:none; color:#fff; padding:6px 20px; border-radius:6px; cursor:pointer; font-size:0.95rem;">确定</button>
                        </div>
                    `,
                    onClose: function() { resolve(); }
                });
                // 绑定按钮（使用 overlay 查找）
                var retries = 0;
                function bind() {
                    var body = overlay.querySelector('.ro-panel-body');
                    if (!body) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    var okBtn = body.querySelector('.ro-alert-ok');
                    if (okBtn) {
                        okBtn.style.pointerEvents = 'auto';
                        okBtn.onclick = function() {
                            UIPanel.close();
                            resolve();
                        };
                    } else {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                    }
                }
                bind();
            });
        },

        // ---- 非阻塞 confirm ----
        confirm: function(options) {
            return new Promise(function(resolve) {
                var overlay = UIPanel.show({
                    preset: 'dialog',
                    title: { icon: '❓', text: options.title || '确认' },
                    content: `
                        <p style="margin: 8px 0 16px;">${options.message}</p>
                        <div style="display:flex; gap:12px; margin-top:16px; justify-content:flex-end;">
                            <button class="ro-confirm-no" style="background:#eee; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.95rem;">取消</button>
                            <button class="ro-confirm-yes" style="background:#3b82f6; border:none; color:#fff; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.95rem;">确定</button>
                        </div>
                    `,
                    onClose: function() { resolve(false); }
                });
                var retries = 0;
                function bind() {
                    var body = overlay.querySelector('.ro-panel-body');
                    if (!body) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    var yesBtn = body.querySelector('.ro-confirm-yes');
                    var noBtn = body.querySelector('.ro-confirm-no');
                    if (!yesBtn || !noBtn) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    yesBtn.style.pointerEvents = 'auto';
                    noBtn.style.pointerEvents = 'auto';
                    yesBtn.onclick = function() {
                        UIPanel.close();
                        resolve(true);
                    };
                    noBtn.onclick = function() {
                        UIPanel.close();
                        resolve(false);
                    };
                }
                bind();
            });
        },

        // ---- 非阻塞 prompt ----
        prompt: function(message, defaultValue, title) {
            return new Promise(function(resolve) {
                var overlay = UIPanel.show({
                    preset: 'dialog',
                    title: { icon: '✏️', text: title || '输入' },
                    content: `
                        <p style="margin: 8px 0 12px;">${message}</p>
                        <input id="ro-prompt-input" type="text" value="${defaultValue || ''}" style="width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px; font-size:1rem; box-sizing:border-box;" />
                        <div style="display:flex; gap:12px; margin-top:16px; justify-content:flex-end;">
                            <button class="ro-prompt-cancel" style="background:#eee; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">取消</button>
                            <button class="ro-prompt-ok" style="background:#3b82f6; border:none; color:#fff; padding:6px 16px; border-radius:6px; cursor:pointer;">确定</button>
                        </div>
                    `,
                    onClose: function() { resolve(null); }
                });
                var retries = 0;
                function bind() {
                    var body = overlay.querySelector('.ro-panel-body');
                    if (!body) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    var input = body.querySelector('#ro-prompt-input');
                    var okBtn = body.querySelector('.ro-prompt-ok');
                    var cancelBtn = body.querySelector('.ro-prompt-cancel');
                    if (!okBtn || !cancelBtn || !input) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    okBtn.style.pointerEvents = 'auto';
                    cancelBtn.style.pointerEvents = 'auto';
                    input.style.pointerEvents = 'auto';

                    input.focus();
                    input.select();
                    input.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') { okBtn.click(); }
                        if (e.key === 'Escape') { cancelBtn.click(); }
                    });

                    okBtn.onclick = function() {
                        UIPanel.close();
                        resolve(input.value);
                    };
                    cancelBtn.onclick = function() {
                        UIPanel.close();
                        resolve(null);
                    };
                }
                bind();
            });
        },

        // ---- 通用异步模态框（非阻塞，基于 <div>） ----
        // options: { message, title, icon, showInput, defaultValue, okText, cancelText }
        // 返回 Promise<{ ok: boolean, value: string | null }>，主循环不会被阻塞
        showModal: function(options) {
            options = options || {};
            return new Promise(function(resolve) {
                var overlay = UIPanel.show({
                    preset: 'dialog',
                    title: { icon: options.icon || '❓', text: options.title || '提示' },
                    content: `
                        <p style="margin: 8px 0 16px; word-break:break-word;">${options.message || ''}</p>
                        ${options.showInput ? `<input id="ro-modal-input" type="text" value="${options.defaultValue || ''}" style="width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px; font-size:1rem; box-sizing:border-box;" />` : ''}
                        <div style="display:flex; gap:12px; margin-top:16px; justify-content:flex-end;">
                            <button class="ro-modal-cancel" style="background:#eee; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.95rem;">${options.cancelText || '取消'}</button>
                            <button class="ro-modal-ok" style="background:#3b82f6; border:none; color:#fff; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.95rem;">${options.okText || '确定'}</button>
                        </div>
                    `,
                    onClose: function() { resolve({ ok: false, value: null }); }
                });
                var retries = 0;
                function bind() {
                    var body = overlay.querySelector('.ro-panel-body');
                    if (!body) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    var okBtn = body.querySelector('.ro-modal-ok');
                    var cancelBtn = body.querySelector('.ro-modal-cancel');
                    var input = body.querySelector('#ro-modal-input');
                    if (!okBtn || !cancelBtn || (options.showInput && !input)) {
                        if (retries < 5) { retries++; setTimeout(bind, 100); }
                        return;
                    }
                    okBtn.style.pointerEvents = 'auto';
                    cancelBtn.style.pointerEvents = 'auto';
                    if (input) {
                        input.style.pointerEvents = 'auto';
                        input.focus();
                        input.select();
                        input.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter') { okBtn.click(); }
                            if (e.key === 'Escape') { cancelBtn.click(); }
                        });
                    }
                    okBtn.onclick = function() {
                        UIPanel.close();
                        resolve({ ok: true, value: input ? input.value : null });
                    };
                    cancelBtn.onclick = function() {
                        UIPanel.close();
                        resolve({ ok: false, value: null });
                    };
                }
                bind();
            });
        },

        // ---- Toast ----
        toast: function(message, type) {
            var colors = {
                info: '#3b82f6',
                success: '#22c55e',
                error: '#ef4444'
            };
            var bg = colors[type] || colors.info;
            var toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
                background: ${bg}; color: #fff; padding: 10px 24px;
                border-radius: 30px; font-size: 0.95rem; z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                opacity: 0; transition: opacity 0.3s ease;
                pointer-events: none;
                max-width: 80%;
                text-align: center;
                font-family: system-ui, sans-serif;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(function() {
                toast.style.opacity = '1';
            });
            setTimeout(function() {
                toast.style.opacity = '0';
                setTimeout(function() { toast.remove(); }, 300);
            }, 3000);
        }
    };

    global.UIPanel = UIPanel;

    // 全局通知服务
    global.Notification = {
        alert: function(message, title) { return UIPanel.alert(message, title); },
        confirm: function(message, title) { return UIPanel.confirm({ message: message, title: title }); },
        prompt: function(message, defaultValue, title) { return UIPanel.prompt(message, defaultValue, title); },
        toast: function(message, type) { UIPanel.toast(message, type); }
    };
    console.log('[Notification] ✅ 全局通知服务已就绪（v2.2）');

    console.log('[UIPanel] ✅ v2.2 已加载（修复遮罩关闭与按钮事件）');
})(window);
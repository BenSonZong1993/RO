// js/ui/UIDexHub.js
// 图鉴导航中心 + 浮动导航条
// v2 - 修复 Object.defineProperty 和初始化顺序问题
(function(global) {
    'use strict';

    // ============================
    //  导航项配置（可扩展）
    // ============================
    var NAV_ITEMS = [
        {
            id: 'item',
            icon: '📖',
            label: '物品',
            moduleName: 'UIGallery',
            openFn: function() { if (global.UIGallery && typeof global.UIGallery.open === 'function') global.UIGallery.open(); },
            closeFn: function() { if (global.UIGallery && typeof global.UIGallery.close === 'function') global.UIGallery.close(); },
            isOpen: function() { return global.UIGallery ? !!global.UIGallery._isOpen : false; }
        },
        {
            id: 'map',
            icon: '🗺️',
            label: '地图',
            moduleName: 'UIMapDex',
            openFn: function() { if (global.UIMapDex && typeof global.UIMapDex.open === 'function') global.UIMapDex.open(); },
            closeFn: function() { if (global.UIMapDex && typeof global.UIMapDex.close === 'function') global.UIMapDex.close(); },
            isOpen: function() { return global.UIMapDex ? !!global.UIMapDex._isOpen : false; }
        },
        {
            id: 'monster',
            icon: '👹',
            label: '怪物',
            moduleName: 'UIMonsterDex',
            openFn: function() { /* 预留 */ },
            closeFn: function() { /* 预留 */ },
            isOpen: function() { return false; },
            disabled: true
        },
        {
            id: 'card',
            icon: '🃏',
            label: '卡片',
            moduleName: 'UICardDex',
            openFn: function() { /* 预留 */ },
            closeFn: function() { /* 预留 */ },
            isOpen: function() { return false; },
            disabled: true
        },
                {
            id: 'mechanic',
            icon: '📚',
            label: '数据手册',
            moduleName: 'UIMechanicDex',
            openFn: function() { if (global.UIMechanicDex && typeof global.UIMechanicDex.open === 'function') global.UIMechanicDex.open(); },
            closeFn: function() { if (global.UIMechanicDex && typeof global.UIMechanicDex.close === 'function') global.UIMechanicDex.close(); },
            isOpen: function() { return global.UIMechanicDex ? !!global.UIMechanicDex._isOpen : false; },
            disabled: false
        },

        {
            id: 'pet',
            icon: '🐣',
            label: '宠物',
            moduleName: 'UIPetDex',
            openFn: function() { /* 预留 */ },
            closeFn: function() { /* 预留 */ },
            isOpen: function() { return false; },
            disabled: true
        }
    ];

    // ============================
    //  状态
    // ============================
    var _state = {
        mode: 'closed',       // 'closed' | 'panel' | 'bar'
        currentTabId: null,
        navBarVisible: false,
    };

    var _navBarEl = null;
    var _panelHandler = null;
    var _initialized = false;
    var _isOpen = false;
    var _originalOnClose = null;
    var _watcherInterval = null;

    // ============================
    //  导航面板
    // ============================
    function _renderPanel() {
        var html = '';
        html += '<div style="text-align:center;margin-bottom:20px;color:#6b7280;font-size:0.95rem;">选择你要查阅的图鉴</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;">';
        for (var i = 0; i < NAV_ITEMS.length; i++) {
            var item = NAV_ITEMS[i];
            var disabled = item.disabled === true;
            var opacity = disabled ? '0.4' : '1';
            var cursor = disabled ? 'not-allowed' : 'pointer';
            html += '<div class="dexhub-panel-item" data-id="' + item.id + '" data-disabled="' + (disabled ? 'true' : 'false') + '" style="';
            html += 'border:2px solid #e5e7eb;border-radius:16px;padding:20px 12px;text-align:center;background:#fff;';
            html += 'transition:all 0.2s ease;cursor:' + cursor + ';opacity:' + opacity + ';';
            html += 'box-shadow:0 2px 8px rgba(0,0,0,0.04);">';
            html += '<div style="font-size:2.8rem;line-height:1.2;">' + item.icon + '</div>';
            html += '<div style="font-weight:700;font-size:1.05rem;margin-top:6px;color:#1f2937;">' + item.label + '</div>';
            html += '<div style="font-size:0.75rem;color:#9ca3af;margin-top:2px;">' + (disabled ? '即将开放' : '点击进入') + '</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function _openPanel() {
        if (typeof UIPanel === 'undefined') {
            console.error('[UIDexHub] UIPanel 未加载，延迟重试...');
            setTimeout(_openPanel.bind(this), 300);
            return;
        }
        _state.mode = 'panel';
        _state.currentTabId = null;

        _originalOnClose = UIPanel._onClose || null;

        UIPanel.show({
            preset: 'medium',
            title: { icon: '📚', text: '图鉴总览' },
            content: '<div id="dexhub-panel-body" style="min-height:200px;">' + _renderPanel() + '</div>',
            onClose: function() {
                _state.mode = 'closed';
                _state.currentTabId = null;
                _hideNavBar();
                if (typeof _originalOnClose === 'function') _originalOnClose();
                _isOpen = false;
                _stopWatcher();
            }
        });
        _isOpen = true;
        _bindPanelEvents();
    }

    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) { setTimeout(_bindPanelEvents.bind(this), 100); return; }
        if (_panelHandler) { container.removeEventListener('click', _panelHandler); _panelHandler = null; }

        var handler = function(e) {
            var target = e.target.closest('.dexhub-panel-item');
            if (!target) return;
            var disabled = target.dataset.disabled === 'true';
            if (disabled) return;
            var id = target.dataset.id;
            var item = NAV_ITEMS.find(function(it) { return it.id === id; });
            if (item && typeof item.openFn === 'function') {
                UIPanel.close();
                _state.mode = 'bar';
                _state.currentTabId = id;
                _showNavBar(id);
                setTimeout(function() {
                    item.openFn();
                    _isOpen = true;
                    _startWatcher();
                }, 50);
            }
        };
        container.addEventListener('click', handler);
        _panelHandler = handler;
    }

    // ============================
    //  导航条（浮动）
    // ============================



    // ============================
    //  辅助：创建导航条DOM（纯创建，不挂载）→ 竖排右侧固定
    // ============================
    function _createNavBarElement(activeId) {
        _navBarEl = document.createElement('div');
        _navBarEl.id = 'dexhub-navbar';
        _navBarEl.style.cssText =
            'position:fixed;right:20px;top:40%;transform:translateY(-50%);' +
            'z-index:100000;' +
            'display:flex;flex-direction:column;gap:6px;padding:8px 6px;' +
            'background:rgba(30,40,60,0.88);backdrop-filter:blur(8px);' +
            'border-radius:40px;box-shadow:0 4px 20px rgba(0,0,0,0.3);' +
            'border:1px solid rgba(255,255,255,0.08);' +
            'transition:all 0.25s ease;pointer-events:auto;' +
            'user-select:none;';

        for (var i = 0; i < NAV_ITEMS.length; i++) {
            var item = NAV_ITEMS[i];
            var isActive = (item.id === activeId);
            var isDisabled = item.disabled === true;
            var btn = document.createElement('button');
            btn.className = 'dexhub-nav-btn';
            btn.dataset.id = item.id;
            btn.dataset.disabled = isDisabled ? 'true' : 'false';
            btn.title = item.label + (isDisabled ? ' (未开放)' : '');
            btn.style.cssText =
                'border:none;background:' + (isActive ? 'rgba(255,255,255,0.2)' : 'transparent') + ';' +
                'color:' + (isActive ? '#fff' : 'rgba(255,255,255,0.6)') + ';' +
                'font-size:1.3rem;padding:6px 8px;border-radius:30px;cursor:' + (isDisabled ? 'not-allowed' : 'pointer') + ';' +
                'transition:all 0.15s ease;opacity:' + (isDisabled ? '0.3' : '1') + ';' +
                'display:flex;flex-direction:column;align-items:center;justify-content:center;width:40px;';
            if (!isDisabled) {
                btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.15)'; this.style.color = '#fff'; };
                btn.onmouseout = function() {
                    var isAct = this.dataset.id === _state.currentTabId;
                    this.style.background = isAct ? 'rgba(255,255,255,0.2)' : 'transparent';
                    this.style.color = isAct ? '#fff' : 'rgba(255,255,255,0.6)';
                };
            }
            // 图标
            var iconSpan = document.createElement('span');
            iconSpan.textContent = item.icon;
            iconSpan.style.fontSize = '1.2rem';
            btn.appendChild(iconSpan);
            // 如果是激活状态，显示文字小标签
            if (isActive) {
                var textSpan = document.createElement('span');
                textSpan.textContent = item.label;
                textSpan.style.cssText = 'font-size:0.6rem;font-weight:500;color:rgba(255,255,255,0.8);margin-top:2px;';
                btn.appendChild(textSpan);
            }
            _navBarEl.appendChild(btn);
        }

        // 关闭按钮
        var closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText =
            'border:none;background:transparent;color:rgba(255,255,255,0.3);' +
            'font-size:0.7rem;padding:6px 0;cursor:pointer;' +
            'transition:color 0.15s;border-top:1px solid rgba(255,255,255,0.08);' +
            'width:40px;display:flex;justify-content:center;';
        closeBtn.onmouseover = function() { this.style.color = 'rgba(255,255,255,0.8)'; };
        closeBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.3)'; };
        closeBtn.onclick = function() {
            var currentItem = NAV_ITEMS.find(function(it) { return it.id === _state.currentTabId; });
            if (currentItem && typeof currentItem.closeFn === 'function') {
                currentItem.closeFn();
            }
            _hideNavBar();
            _state.mode = 'closed';
            _state.currentTabId = null;
            _isOpen = false;
            _stopWatcher();
        };
        _navBarEl.appendChild(closeBtn);

        // 添加 hover 动画（整体微光）
        _navBarEl.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
        });
        _navBarEl.addEventListener('mouseleave', function() {
            this.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        });
    }

    // ============================
    //  导航条（固定在右侧居中）
    // ============================
    function _showNavBar(activeId) {
        // 如果已有导航条元素，则更新显示和激活状态
        if (_navBarEl) {
            _navBarEl.style.display = 'flex';
            _updateNavBarActive(activeId);
            return;
        }

        // 创建导航条并添加到body
        _createNavBarElement(activeId);
        document.body.appendChild(_navBarEl);
        _state.navBarVisible = true;
        _bindNavBarEvents();
    }


    function _bindNavBarEvents() {
        if (!_navBarEl) return;
        _navBarEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.dexhub-nav-btn');
            if (!btn) return;
            var disabled = btn.dataset.disabled === 'true';
            if (disabled) return;
            var id = btn.dataset.id;
            var currentId = _state.currentTabId;
            if (id === currentId) return;

            var targetItem = NAV_ITEMS.find(function(it) { return it.id === id; });
            if (!targetItem || typeof targetItem.openFn !== 'function') return;





                     var currentItem = NAV_ITEMS.find(function(it) { return it.id === currentId; });
            if (currentItem && typeof currentItem.closeFn === 'function') {
                currentItem.closeFn();
            }

       _state.currentTabId = id;
            _updateNavBarActive(id);

            setTimeout(function() {
   targetItem.openFn();
            _isOpen = true;
            _startWatcher();
            }, 30);

            
        });
    }




    function _updateNavBarActive(activeId) {
        if (!_navBarEl) return;
        var btns = _navBarEl.querySelectorAll('.dexhub-nav-btn');
        for (var i = 0; i < btns.length; i++) {
            var btn = btns[i];
            var id = btn.dataset.id;
            var isActive = (id === activeId);
            btn.style.background = isActive ? 'rgba(255,255,255,0.2)' : 'transparent';
            btn.style.color = isActive ? '#fff' : 'rgba(255,255,255,0.6)';
            var iconSpan = btn.querySelector('span:first-child');
            var textSpan = btn.querySelector('span:last-child');
            if (textSpan && textSpan !== iconSpan) {
                if (isActive) {
                    var item = NAV_ITEMS.find(function(it) { return it.id === id; });
                    textSpan.textContent = ' ' + (item ? item.label : '');
                } else {
                    textSpan.textContent = '';
                }
            }
        }
    }

    function _hideNavBar() {
        if (_navBarEl) {
            _navBarEl.style.display = 'none';
            _state.navBarVisible = false;
        }
        _state.mode = 'closed';
    }

    function _removeNavBar() {
        if (_navBarEl && _navBarEl.parentNode) {
            _navBarEl.parentNode.removeChild(_navBarEl);
            _navBarEl = null;
        }
        _state.navBarVisible = false;
    }

    // ============================
    //  轮询检测 UIPanel 状态
    // ============================
    function _startWatcher() {
        _stopWatcher();
        _watcherInterval = setInterval(function() {
            if (_state.mode === 'closed') { _stopWatcher(); return; }
            var panel = document.querySelector('.ro-panel-container');
            if (!panel || panel.style.display === 'none') {
                _hideNavBar();
                _state.mode = 'closed';
                _state.currentTabId = null;
                _isOpen = false;
                _stopWatcher();
            }
        }, 500);
    }

    function _stopWatcher() {
        if (_watcherInterval) {
            clearInterval(_watcherInterval);
            _watcherInterval = null;
        }
    }

    // ============================
    //  公共接口
    // ============================
    function open() {
        if (typeof UIPanel === 'undefined') {
            console.error('[UIDexHub] UIPanel 未加载，延迟重试...');
            setTimeout(open.bind(this), 300);
            return;
        }
        if (_isOpen && _state.mode === 'bar') {
            if (_navBarEl) _navBarEl.style.display = 'flex';
            return;
        }
        if (_isOpen && _state.mode === 'panel') {
            var body = document.getElementById('dexhub-panel-body');
            if (body) { body.innerHTML = _renderPanel(); _bindPanelEvents(); }
            return;
        }
        _openPanel();
    }

    function close() {
        if (_navBarEl) { _removeNavBar(); }
        if (typeof UIPanel !== 'undefined') UIPanel.close();
        _state.mode = 'closed';
        _state.currentTabId = null;
        _isOpen = false;
        _stopWatcher();
    }

    function init() {
        if (_initialized) return;
        // 注册到 UIManager（如果有）
        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIDexHub);
        }
        _initialized = true;
        console.log('[UIDexHub] ✅ 已初始化（导航中心 + 浮动导航条）');
    }

    function dispose() {
        close();
        _initialized = false;
        console.log('[UIDexHub] 已清理');
    }

    // ============================
    //  暴露全局（关键：先定义对象，再定义属性，再初始化）
    // ============================
    global.UIDexHub = {
        name: 'UIDexHub',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
    };

    // 为外部提供 _isOpen 只读属性
    Object.defineProperty(global.UIDexHub, '_isOpen', {
        get: function() { return _isOpen; }
    });

    // 立即初始化
    init();

})(window);
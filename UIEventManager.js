// js/core/UIEventManager.js (修正版)
(function(global) {
    'use strict';

    // ============================================================
    //  配置映射：DOM事件 → EventBus 事件名称 + 数据提取函数
    // ============================================================
    const EVENT_MAP = {
        // ---------- 角色操作 ----------
        'btn-reset-save': {
            event: 'click',
            emit: 'ui:reset-save',
            data: () => ({})
        },
        // 属性分配按钮（动态绑定）
        '.stat-line button[data-stat]': {
            event: 'click',
            emit: 'ui:allocate-stat',
            data: (el) => ({ stat: el.dataset.stat, amount: 1 })
        },

        // ---------- 地图与战斗 ----------
        'map-select': {
            event: 'change',
            emit: 'ui:map-change',
            data: (el) => ({ mapId: el.value })
        },
        'btn-start-farming': {
            event: 'click',
            emit: 'ui:start-farming',
            data: () => ({})
        },
        'btn-stop-farming': {
            event: 'click',
            emit: 'ui:stop-farming',
            data: () => ({})
        },

        // ---------- 装备与背包 ----------
        'btn-open-bag': {
            event: 'click',
            emit: 'ui:open-bag',
            data: () => ({})
        },
        // 卡片按钮（动态绑定）
        '[id^="btn-equip-"][id$="-card"]': {
            event: 'click',
            emit: 'ui:manage-card',
            data: (el) => {
                const slot = el.id.replace('btn-equip-', '').replace('-card', '');
                return { slot };
            }
        },

        // ---------- 通用按钮 ----------
        'btn-gm': {
            event: 'click',
            emit: 'ui:toggle-gm',
            data: () => ({})
        },
        'btn-skill-tree': {
            event: 'click',
            emit: 'ui:open-skill-tree',
            data: () => ({})
        },

        // ---------- 复选框（状态切换） ----------
        'chk-auto-skill': {
            event: 'change',
            emit: 'ui:auto-skill-toggle',
            data: (el) => ({ enabled: el.checked })
        },
        'chk-death-return': {
            event: 'change',
            emit: 'ui:death-return-toggle',
            data: (el) => ({ enabled: el.checked })
        },
        'chk-auto-sell': {
            event: 'change',
            emit: 'ui:auto-sell-toggle',
            data: (el) => ({ enabled: el.checked })
        },
        'chk-fear-mvp': {
            event: 'change',
            emit: 'ui:fear-mvp-toggle',
            data: (el) => ({ enabled: el.checked })
        },
        'chk-fear-elite': {
            event: 'change',
            emit: 'ui:fear-elite-toggle',
            data: (el) => ({ enabled: el.checked })
        },

        // ---------- 药水下拉（值变更） ----------
        'sel-hp-potion': {
            event: 'change',
            emit: 'ui:potion-change',
            data: (el) => ({ type: 'hp', value: el.value })
        },
        'sel-sp-potion': {
            event: 'change',
            emit: 'ui:potion-change',
            data: (el) => ({ type: 'sp', value: el.value })
        },
        // 可扩展更多...
    };

    // ============================================================
    //  核心：绑定所有事件
    // ============================================================
    function bindAll() {
        const bus = global.EventBus;
        if (!bus) {
            console.error('[UIEventManager] EventBus 未加载');
            return;
        }

        for (const [selector, config] of Object.entries(EVENT_MAP)) {
            const isDynamic = selector.includes('[') || selector.startsWith('.');
            let elements;

            if (isDynamic) {
                // 动态选择器（类或属性），使用全局代理或直接查询
                elements = document.querySelectorAll(selector);
            } else {
                elements = [document.getElementById(selector)].filter(Boolean);
            }

            elements.forEach(el => {
                if (!el) return;
                el.addEventListener(config.event, function(e) {
                    const data = typeof config.data === 'function' ? config.data(e.currentTarget) : {};
                    bus.emit(config.emit, data);
                });
            });
        }

        console.log('[UIEventManager] ✅ 所有UI事件已绑定');
    }

    // 暴露初始化方法
    global.UIEventManager = {
        bindAll
    };

    // 如果DOM已加载，自动绑定；否则等待
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAll);
    } else {
        bindAll();
    }

})(window);
// ============================================================
//  FILE: DataCoordinator.js
//  LAYER: core（数据协调门面——路径式读写的统一入口，内部代理 Repository 层）
//  权限：data:char / data:inventory / data:map / data:ui（经 AccessControl）
//  依赖：CharRepository、InventoryRepository、MapRepository、PersistenceManager、AccessControl、EventBus
//  契约（v4.0 变更）：
//    get(path)                  → char→仓储 | inventory→仓储 | map→仓储 | ui→PersistenceManager
//    dispatch(module, path, v)  → char 路径拒绝（走 CharacterContext）；
//                                 inventory/map/ui 按 root 路由到对应仓储并触发 data:changed
//    flush()                    → 立即落盘
//  规则：D3 / ARCH-1 —— char 不再经由本模块返回活引用（旧 _getCharRef 移除），
//        由 CharRepository 统一持有；本模块仅代理非 char 路径
// ============================================================
(function(global) {
    'use strict';

    function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    // ============================================================
    //  get：按 root 路由
    // ============================================================
    function get(path) {
        if (!path) {
            // 无路径：组合全量快照（调试用途）
            return {
                char: (global.CharRepository ? global.CharRepository.get() : null),
                inventory: (global.InventoryRepository ? global.InventoryRepository.get() : null),
                map: (global.MapRepository ? _clone({ currentId: global.MapRepository.get('currentId') }) : null),
                ui: (global.PersistenceManager ? global.PersistenceManager.get('ui') : null),
            };
        }

        var root = path.split('.')[0];

        // ---- char：代理仓储（深拷贝快照；活引用请走 CharRepository.getLiveRef） ----
        if (root === 'char') {
            if (!global.CharRepository) return undefined;
            var rest = path.slice(5); // 去掉 'char.'
            if (!rest) return global.CharRepository.get();
            var charObj = global.CharRepository.get();
            var parts = rest.split('.');
            var current = charObj;
            for (var i = 0; i < parts.length; i++) {
                if (current === undefined || current === null) return undefined;
                current = current[parts[i]];
            }
            return current;
        }

        // ---- inventory：代理仓储 ----
        if (root === 'inventory') {
            if (!global.InventoryRepository) return undefined;
            if (path === 'inventory') return global.InventoryRepository.get();
            var invObj = global.InventoryRepository.get();
            var invParts = path.split('.');
            invParts.shift();
            var cur = invObj;
            for (var j = 0; j < invParts.length; j++) {
                if (cur === undefined || cur === null) return undefined;
                cur = cur[invParts[j]];
            }
            return cur;
        }

        // ---- map /：代理地图状态仓储 ----
        if (root === 'map') {
            if (!global.MapRepository) return undefined;
            var mapPath = path.slice(4); // 去掉 'map.'
            if (!mapPath) {
                return {
                    currentId: global.MapRepository.get('currentId'),
                };
            }
            return global.MapRepository.get(mapPath);
        }

        // ---- ui 及其他：PersistenceManager ----
        if (global.PersistenceManager) {
            return global.PersistenceManager.get(path);
        }
        return undefined;
    }

    // ============================================================
    //  dispatch：按 root 路由写入（权限检查）
    // ============================================================
    function dispatch(moduleName, path, value) {
        if (!path || typeof path !== 'string') {
            console.warn('[DataCoordinator] 路径无效:', path);
            return false;
        }
        var root = path.split('.')[0];

        // ---- char：禁止（唯一入口 CharacterContext / CharController） ----
        if (root === 'char') {
            console.error('[DataCoordinator] 禁止直接写入 char 路径，请使用 CharacterContext / CharController');
            return false;
        }

        // ---- 权限检查 ----
        if (global.AccessControl && !global.AccessControl.check('data:' + root, moduleName)) {
            console.error('[DataCoordinator] 拒绝：模块 "' + moduleName + '" 无权修改 "' + root + '"');
            return false;
        }

        if (value === undefined) {
            console.warn('[DataCoordinator] 警告：写入 undefined 到 ' + path);
            return false;
        }

        var ok = false;
        if (root === 'inventory') {
            // 兼容路由：整对象写入 → 仓储导入
            ok = global.InventoryRepository ? global.InventoryRepository.importData(value, moduleName) : false;
        } 
        else if (root === 'map') {
            ok = global.MapRepository ? global.MapRepository.set(path.slice(4), value, moduleName) : false;
        } 
        else {
            // ui 及其他：PersistenceManager（内部自带深拷贝与防抖保存）
            ok = global.PersistenceManager ? global.PersistenceManager.set(path, value) : false;
        }

        if (ok && global.EventBus) {
            global.EventBus.emit('data:changed', { path: path, value: value, module: moduleName });
        }
        return ok;
    }

    // ---- 立即落盘 ----
    function flush() {
        if (global.PersistenceManager && typeof global.PersistenceManager.flush === 'function') {
            global.PersistenceManager.flush();
        }
        if (global.CharRepository) global.CharRepository.save();
        if (global.InventoryRepository) global.InventoryRepository.save();
        if (global.MapRepository) global.MapRepository.save();
    }

    var DataCoordinator = { dispatch: dispatch, get: get, flush: flush };

    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', flush);
    }

    global.DataCoordinator = DataCoordinator;
    console.log('[DataCoordinator] ✅ 已加载（v4.0：Repository 代理门面）');
})(window);

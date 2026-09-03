// ============================================================
//  FILE: LocalStorageAdapter.js
//  LAYER: services/adapters（本地存储适配器——默认适配器）
//  权限：无（仅被 CloudStorageService 调度，业务模块禁止直连）
//  依赖：PersistenceManager
//  职责：把现有 PersistenceManager 的 localStorage 能力包装为标准
//        适配器契约（同步分节读写），供 CloudStorageService 调度。
//  契约（同步）：
//    name / isAvailable()
//    loadAll()                → 完整存档对象（深拷贝）
//    loadSection(section)     → any
//    saveSection(section, v)  → boolean
//    reset() / flush()
//  未来云端迁移：本适配器始终保留作为镜像与降级后端（离线可玩）。
// ============================================================
(function(global) {
    'use strict';

    var LocalStorageAdapter = {
        name: 'local',

        isAvailable: function() {
            return !!global.PersistenceManager;
        },

        init: function(config) {
            // config.local.storageKey 预留：PersistenceManager 当前固定 v3 键
            if (!global.PersistenceManager) {
                console.error('[LocalStorageAdapter] PersistenceManager 未加载');
                return false;
            }
            return true;
        },

        // ---- 完整存档 ----
        loadAll: function() {
            return global.PersistenceManager ? global.PersistenceManager.getData() : null;
        },

        // ---- 分节读写（Repository 层主通道） ----
        loadSection: function(section) {
            return global.PersistenceManager ? global.PersistenceManager.get(section) : undefined;
        },

        saveSection: function(section, value) {
            return global.PersistenceManager ? global.PersistenceManager.set(section, value) : false;
        },

        reset: function() {
            return global.PersistenceManager ? global.PersistenceManager.reset() : false;
        },

        flush: function() {
            if (global.PersistenceManager && typeof global.PersistenceManager.flush === 'function') {
                global.PersistenceManager.flush();
            }
        },
    };

    global.LocalStorageAdapter = LocalStorageAdapter;
    console.log('[LocalStorageAdapter] ✅ 已加载（本地存储适配器）');
})(window);

// ================================================================
//  FILE: PersistenceManager.js
//  LAYER: core（唯一持久化存储核心——localStorage 适配器）
//  权限：无（仅被 CloudStorageService / DataCoordinator 调用，业务模块禁止直连）
//  职责：localStorage 读写、v2→v3 一次性迁移（旧键封存备份）、防抖保存、深拷贝隔离
//  依赖：无
//  契约：load / save / flush / get / set / reset / getData
//  v4.0 存档切换策略：
//    1) v3 键存在 → 直接使用（现行存档）；
//    2) 仅 v2 键存在 → 迁移到 v3，并将 v2 键改名为 RO_Place_Save_v2.migrated（保留回滚能力）；
//    3) 都不存在 → 默认数据。
//    迁移完成后 v2 键不再参与读取，v3 成为唯一活动键（避免旧快照覆盖新进度）。
// ================================================================

(function(global) {
    'use strict';

    const STORAGE_KEY = 'RO_Place_Save_v3';
    const OLD_STORAGE_KEY = 'RO_Place_Save_v2';
    const MIGRATED_SUFFIX = '.migrated';
    const CURRENT_VERSION = 1;
    const DEBOUNCE_DELAY = 200;

    // ---------- 默认数据结构 ----------
    const DEFAULT_DATA = {
        _version: CURRENT_VERSION,
        char: {
            id: '',
            name: '冒险者',
            gender: 'male',          // 性别（男 male 蓝 24px / 女 female 红粉 22px；UIConfig.render.GENDER）
            level: 1,
            jobLevel: 1,
            jobKey: 'Novice',
            exp: 0,
            jobExp: 0,
            statPoints: 48,
            skillPoints: 0,
            hp: 100,
            sp: 50,
            maxHp: 100,
            maxSp: 50,
            zeny: 10000,
            stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
            learnedSkills: {},
            equippedItems: {},
            _autoConsume: { version: 1, rules: [] },
            _autoSkill: { skills: [], strategy: 'priority', enabled: true },
        },
        inventory: { stacks: {}, equipped: {} },
        map: { currentId: 'prt_fild08' },
        ui: { showDamageNumbers: true },
        extras: {}
    };

    let _data = null;
    let _saveTimer = null;

    // ---------- 辅助函数 ----------
    function _deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

    function _mergeDeep(target, source) {
        if (!source) return target;
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    _mergeDeep(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    // ---------- v2 存档迁移（迁移成功后封存旧键） ----------
    function _migrateFromV2() {
        try {
            const raw = localStorage.getItem(OLD_STORAGE_KEY);
            if (!raw) return null;
            const oldData = JSON.parse(raw);
            const migrated = _deepClone(DEFAULT_DATA);
            if (oldData.char) migrated.char = _mergeDeep(migrated.char, oldData.char);
            if (oldData.inventory) migrated.inventory = _mergeDeep(migrated.inventory, oldData.inventory);
            if (oldData.map) migrated.map = _mergeDeep(migrated.map, oldData.map);
            if (oldData.ui) migrated.ui = _mergeDeep(migrated.ui, oldData.ui);
            if (oldData.extras) migrated.extras = oldData.extras;
            migrated._version = CURRENT_VERSION;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            // 封存旧键（保留回滚能力，但不再参与读取）
            try {
                localStorage.setItem(OLD_STORAGE_KEY + MIGRATED_SUFFIX, raw);
                localStorage.removeItem(OLD_STORAGE_KEY);
            } catch (e2) {
                console.warn('[PersistenceManager] 旧键封存失败（不影响迁移结果）', e2);
            }
            console.log('[PersistenceManager] ✅ v2 存档已迁移到 v3（旧键已封存为 ' + OLD_STORAGE_KEY + MIGRATED_SUFFIX + '）');
            return migrated;
        } catch (e) {
            console.warn('[PersistenceManager] v2 存档迁移失败，使用默认数据', e);
            return null;
        }
    }

    // ---------- 加载 ----------
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed._version === CURRENT_VERSION) {
                    _data = parsed;
                    return _data;
                }
                // v3 键存在但版本异常：尝试从 v2 恢复
                console.warn('[PersistenceManager] v3 版本异常，尝试从 v2 恢复');
                const migrated = _migrateFromV2();
                if (migrated) { _data = migrated; return _data; }
                return _resetToDefault();
            }
            // v3 不存在：尝试 v2 一次性迁移
            const migrated = _migrateFromV2();
            if (migrated) { _data = migrated; return _data; }
            return _resetToDefault();
        } catch (e) {
            console.error('[PersistenceManager] 加载异常，重置默认', e);
            return _resetToDefault();
        }
    }

    function _resetToDefault() {
        _data = _deepClone(DEFAULT_DATA);
        _persist();
        return _data;
    }

    // ---------- 持久化 ----------
    function _persist() {
        if (!_data) return;
        try {
            const toStore = _deepClone(_data);
            // 剔除运行时字段（不应存储）
            if (toStore.char && toStore.char._finalStats) delete toStore.char._finalStats;
            if (toStore.char && toStore.char.sc) delete toStore.char.sc;
            if (toStore.char && toStore.char.inventory) delete toStore.char.inventory;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        } catch (e) {
            console.error('[PersistenceManager] 写入失败', e);
        }
    }

    function save(immediate) {
        if (!_data) { load(); }
        if (immediate) {
            if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
            _persist();
        } else {
            if (_saveTimer) clearTimeout(_saveTimer);
            _saveTimer = setTimeout(() => {
                _saveTimer = null;
                _persist();
            }, DEBOUNCE_DELAY);
        }
    }

    function flush() {
        if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
        _persist();
    }

    // ---------- 路径式读写（返回深拷贝） ----------
    function get(path) {
        if (!_data) load();
        if (!path) return _deepClone(_data);
        const parts = path.split('.');
        let current = _data;
        for (const key of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[key];
        }
        return (typeof current === 'object' && current !== null) ? _deepClone(current) : current;
    }

    function set(path, value) {
        if (!_data) load();
        const parts = path.split('.');
        const lastKey = parts.pop();
        let current = _data;
        for (const key of parts) {
            if (current === undefined || current === null) {
                console.warn('[PersistenceManager] 路径无效，拒绝写入', path);
                return false;
            }
            if (typeof current[key] !== 'object' || current[key] === null) {
                console.warn('[PersistenceManager] 中间路径不是对象', path);
                return false;
            }
            current = current[key];
        }
        // 只允许写入已存在根级字段或 extras 下的任意字段
        if (parts.length === 0 && lastKey !== 'extras' && !(lastKey in _data)) {
            console.warn('[PersistenceManager] 根级字段不存在，拒绝写入', lastKey);
            return false;
        }
        current[lastKey] = (typeof value === 'object' && value !== null) ? _deepClone(value) : value;
        save(false);
        return true;
    }

    function reset() {
        _data = _deepClone(DEFAULT_DATA);
        _persist();
        console.log('[PersistenceManager] 已重置为默认数据');
        return _data;
    }

    function getData() { return get(); }

    // ---------- 自动绑定页面卸载 ----------
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', flush);
    }

    // ---------- 暴露全局 ----------
    global.PersistenceManager = {
        load,
        save,
        flush,
        get,
        set,
        reset,
        getData,
        _debug: () => console.log('[PersistenceManager] 当前数据:', _data)
    };

    // 自动加载
    global.PersistenceManager.load();

    console.log('[PersistenceManager] ✅ 已加载（持久化引擎 v4.0：v3 单一活动键）');
})(window);

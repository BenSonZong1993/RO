// ============================================================
//  FILE: CharRepository.js
//  LAYER: repositories（角色仓储——char 数据唯一持有者）
//  权限：data:char / char:resetCharacter（经 AccessControl 校验，调用方传模块名）
//  依赖：CloudStorageService（存储适配）、AccessControl、StatusChange(可选)
//  契约：
//    get()             → object（深拷贝快照；sc 序列化为普通对象）
//    getLiveRef()      → object（框架内部专用：AttributeMediator/处理器/Controller 门面）
//    update(fn, caller)→ boolean（受控变更唯一入口；fn(liveChar) 原地修改）
//    replace(state|null, caller) → boolean（原子替换；null = 全新默认角色）
//    clearSkills(caller) / delete(caller) / save() / load()
//  规则：ARCH-1 —— 禁止绕过本仓储直接修改持久化缓存
//  存档兼容：v2 键一次性迁移到 v3（由 PersistenceManager 完成），数据无损
// ============================================================
(function(global) {
    'use strict';

    var _char = null;
    var _storage = null;          // CloudStorageService
    var _equippedProvider = null; // () => equippedInfo（由 init.js 注入，兼容旧存档字段）

    function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    // ---- 默认角色（与 PersistenceManager.DEFAULT_DATA.char 对齐） ----
    function _defaultChar() {
        return {
            name: '冒险者',
            level: 1,
            jobLevel: 1,
            jobKey: 'Novice',
            exp: 0,
            jobExp: 0,
            statPoints: 48,
            skillPoints: 0,
            hp: 100,
            maxHp: 100,
            sp: 50,
            maxSp: 50,
            zeny: 10000,
            stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
            learnedSkills: {},
            equippedItems: {},
            rebirthCount: 0,
            _autoConsume: { version: 1, rules: [] },
        };
    }

    // ---- 状态效果容器（原 CharController._ensureSc） ----
    function _ensureSc(char) {
        if (!char.sc || typeof char.sc.hasSCE !== 'function') {
            if (global.StatusChange) {
                char.sc = new global.StatusChange();
            } else {
                char.sc = {
                    _data: {},
                    hasSCE: function(id) { return !!this._data[id]; },
                    setSCE: function(id, obj) { this._data[id] = obj; },
                    clearSCE: function(id) { delete this._data[id]; },
                    getAll: function() { return this._data; },
                };
            }
        }
        return char.sc;
    }

    // ---- 完整性兜底（原 CharController._ensureIntegrity） ----
    function _ensureIntegrity(char) {
        if (!char) return null;
        char.name = char.name || '冒险者';
        char.gender = (char.gender === 'female') ? 'female' : 'male';   // 性别（存量档自动补默认男）
        char.level = (typeof char.level === 'number' && !isNaN(char.level)) ? char.level : 1;
        char.jobLevel = (typeof char.jobLevel === 'number' && !isNaN(char.jobLevel)) ? char.jobLevel : 1;
        char.jobKey = char.jobKey || 'Novice';
        char.exp = (typeof char.exp === 'number' && !isNaN(char.exp)) ? char.exp : 0;
        char.jobExp = (typeof char.jobExp === 'number' && !isNaN(char.jobExp)) ? char.jobExp : 0;
        char.statPoints = (typeof char.statPoints === 'number' && !isNaN(char.statPoints)) ? char.statPoints : 48;
        char.skillPoints = (typeof char.skillPoints === 'number' && !isNaN(char.skillPoints)) ? char.skillPoints : 0;
        char.zeny = (typeof char.zeny === 'number' && !isNaN(char.zeny)) ? char.zeny : 10000;
        char.hp = (typeof char.hp === 'number' && !isNaN(char.hp)) ? char.hp : 100;
        char.sp = (typeof char.sp === 'number' && !isNaN(char.sp)) ? char.sp : 50;
        char.maxHp = (typeof char.maxHp === 'number' && !isNaN(char.maxHp)) ? char.maxHp : 100;
        char.maxSp = (typeof char.maxSp === 'number' && !isNaN(char.maxSp)) ? char.maxSp : 50;
        if (typeof char.rebirthCount !== 'number' || isNaN(char.rebirthCount)) char.rebirthCount = 0;

        if (!char.stats) char.stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
        var statKeys = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
        for (var i = 0; i < statKeys.length; i++) {
            var k = statKeys[i];
            if (typeof char.stats[k] !== 'number' || isNaN(char.stats[k])) char.stats[k] = 1;
        }
        if (!char.learnedSkills) char.learnedSkills = {};
        if (!char.inventory) char.inventory = { stacks: {}, equipped: {} };
        if (!char.equippedItems) char.equippedItems = {};
        if (!char._autoConsume) char._autoConsume = { version: 1, rules: [] };
        if (!Array.isArray(char._autoConsume.rules)) char._autoConsume.rules = [];
        if (!char._finalStats) char._finalStats = {};
        _ensureSc(char);
        return char;
    }

    function init(deps) {
        _storage = (deps && deps.storage) || global.CloudStorageService || null;
        if (deps && typeof deps.equippedProvider === 'function') _equippedProvider = deps.equippedProvider;
        if (!_storage) {
            console.error('[CharRepository] CloudStorageService 未注入');
            return false;
        }
        return load();
    }

    // ---- 加载（从 v3 存档；v2 由 PersistenceManager 一次性迁移） ----
    function load() {
        try {
            var data = _storage ? _storage.load() : null;
            var charData = (data && data.char) ? data.char : null;
            if (charData && charData.level !== undefined) {
                _char = _ensureIntegrity(charData);
                console.log('[CharRepository] ✅ 角色已加载:', _char.name, 'Lv.' + _char.level, _char.jobKey);
            } else {
                _char = _ensureIntegrity(_defaultChar());
                save();
                console.log('[CharRepository] 无存档，已创建默认角色');
            }
            return true;
        } catch (e) {
            console.error('[CharRepository] 加载失败，使用默认角色', e);
            _char = _ensureIntegrity(_defaultChar());
            return false;
        }
    }

    // ---- 持久化（旧格式兼容：equippedItems 由注入方同步；sc/_finalStats 由适配器剔除） ----
    function save() {
        if (!_char || !_storage) return false;
        try {
            var snapshot = JSON.parse(JSON.stringify(_char, function(key, value) {
                if (key === '_finalStats' || key === 'sc' || key === 'inventory') return undefined;
                return value;
            }));
            if (!snapshot.stats) snapshot.stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
            if (!snapshot.learnedSkills) snapshot.learnedSkills = {};
            if (!snapshot.equippedItems) snapshot.equippedItems = {};
            if (_equippedProvider) {
                var equippedInfo = _equippedProvider();
                if (equippedInfo) snapshot.equippedItems = equippedInfo;
            }
            return _storage.saveSection('char', snapshot);
        } catch (e) {
            console.error('[CharRepository] 保存失败:', e);
            return false;
        }
    }

    // ---- 读取 ----
    function get() {
        if (!_char) load();
        return _char ? _clone(_char) : null;
    }

    function getLiveRef() {
        if (!_char) load();
        return _char;
    }

    // ---- 受控变更（唯一写入口；调用方需持 AccessControl 权限） ----
    function update(mutatorFn, caller) {
        if (!_char) load();
        if (typeof mutatorFn !== 'function') return false;
        if (global.AccessControl && !global.AccessControl.check('data:char', caller || 'CharRepository')) {
            console.error('[CharRepository] 拒绝：', caller, '无权修改 char');
            return false;
        }
        try {
            mutatorFn(_char);
            _ensureIntegrity(_char);
            save();
            return true;
        } catch (e) {
            console.error('[CharRepository] update 执行异常:', e);
            return false;
        }
    }

    // ---- 原子替换（转生 / 全量重置） ----
    function replace(newState, caller) {
        if (global.AccessControl && !global.AccessControl.check('char:resetCharacter', caller || 'CharRepository')) {
            console.error('[CharRepository] 拒绝：', caller, '无权执行 char:resetCharacter');
            return false;
        }
        _char = _ensureIntegrity(newState ? _clone(newState) : _defaultChar());
        save();
        return true;
    }

    function clearSkills(caller) {
        return update(function(char) {
            char.learnedSkills = {};
        }, caller || 'CharRepository');
    }

    // ---- 全量删除存档（重置存档按钮） ----
    function deleteSave(caller) {
        if (global.AccessControl && !global.AccessControl.check('char:resetCharacter', caller || 'CharRepository')) {
            console.error('[CharRepository] 拒绝：', caller, '无权删除存档');
            return false;
        }
        if (_storage && typeof _storage.reset === 'function') _storage.reset();
        _char = _ensureIntegrity(_defaultChar());
        save();
        return true;
    }

    var CharRepository = {
        init: init,
        load: load,
        save: save,
        get: get,
        getLiveRef: getLiveRef,
        update: update,
        replace: replace,
        clearSkills: clearSkills,
        delete: deleteSave,
    };

    global.CharRepository = CharRepository;
    console.log('[CharRepository] ✅ 已加载（角色仓储）');
})(window);

// ============================================================
//  FILE: MapRepository.js
//  LAYER: repositories（地图状态仓储——currentId 唯一持有者）
//  权限：data:map（经 AccessControl 校验）
//  依赖：CloudStorageService（存储适配）、AccessControl
//  契约：
//    get(path)               → any（'currentId' / 自定义子键）
//    set(path, value, caller)→ boolean
//    getCurrentId() / setCurrentId(id, caller)
//    reset(caller) / save() / load()
//  说明：仅存玩家地图状态；地图静态数据走 MapDataGateway
// ============================================================
(function(global) {
    'use strict';

    var _state = null;
    var _storage = null;

    function _defaultState() {
return { currentId: 'prt_fild08' };
    }

    function init(deps) {
        _storage = (deps && deps.storage) || global.CloudStorageService || null;
        if (!_storage) {
            console.error('[MapRepository] CloudStorageService 未注入');
            return false;
        }
        return load();
    }

    function load() {
        try {
            var data = _storage ? _storage.loadSection('map') : null;
            _state = (data && typeof data === 'object') ? data : _defaultState();
            if (!_state.currentId) _state.currentId = 'prt_fild08';
            return true;
        } catch (e) {
            console.error('[MapRepository] 加载失败，使用默认地图状态', e);
            _state = _defaultState();
            return false;
        }
    }

    function save() {
        if (!_state || !_storage) return false;
        return _storage.saveSection('map', JSON.parse(JSON.stringify(_state)));
    }

    function get(path) {
        if (!_state) load();
        if (!path || !_state) return _state ? JSON.parse(JSON.stringify(_state)) : null;
        var parts = path.split('.');
        var current = _state;
        for (var i = 0; i < parts.length; i++) {
            if (current === undefined || current === null) return undefined;
            current = current[parts[i]];
        }
        return current;
    }

    function set(path, value, caller) {
        if (global.AccessControl && !global.AccessControl.check('data:map', caller || 'MapRepository')) {
            console.error('[MapRepository] 拒绝：', caller, '无权修改 map 状态');
            return false;
        }
        if (!_state) load();
        var parts = path.split('.');
        var current = _state;
        for (var i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined || current[parts[i]] === null) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return save();
    }

    function getCurrentId() { return get('currentId'); }
    function setCurrentId(mapId, caller) { return set('currentId', mapId, caller); }
    function reset(caller) {
        if (global.AccessControl && !global.AccessControl.check('data:map', caller || 'MapRepository')) {
            return false;
        }
        _state = _defaultState();
        return save();
    }

    var MapRepository = {
        init: init,
        load: load,
        save: save,
        get: get,
        set: set,
        getCurrentId: getCurrentId,
        setCurrentId: setCurrentId,
        reset: reset,
    };

    global.MapRepository = MapRepository;
    console.log('[MapRepository] ✅ 已加载（地图状态仓储）');
})(window);

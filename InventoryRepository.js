// ============================================================
//  FILE: InventoryRepository.js
//  LAYER: repositories（背包/装备仓储——inventory 数据唯一持有者）
//  权限：data:inventory（经 AccessControl 校验）
//  依赖：CloudStorageService（存储适配）、AccessControl
//  契约：
//    get() / getRaw()                  → object（深拷贝 / 活引用[框架内部]）
//    getAllStacks(includeEquipped)     → array（原始行，不含显示名）
//    getStack(stackKey)                → object|null
//    getEquipped() / getEquippedEntry(slot)
//    addItemRaw(templateId, refine, count, cards) → { success, stackKey }（可堆叠合并，无业务校验）
//    removeItem(stackKey, count)       → boolean
//    equipEntry(slot, entry) / unequipEntry(slot) / updateEquipped(slot, fn)
//    reset(caller) / save() / importData(inv, caller)（DataCoordinator 兼容路由）
//  规则：D2 —— 业务校验（能否装备/使用）在 Service 层，本层只做纯数据操作
// ============================================================
(function(global) {
    'use strict';

    var _inv = null;
    var _storage = null;

    function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

    function _emptyInv() { return { stacks: {}, equipped: {} }; }

    function _makeKey(templateId, refine, cards) {
        var cardsStr = (cards || []).join('_');
        return templateId + '_' + refine + '_' + cardsStr + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    function _compareCards(arr1, arr2) {
        arr1 = arr1 || [];
        arr2 = arr2 || [];
        if (arr1.length !== arr2.length) return false;
        var sorted1 = arr1.slice().sort();
        var sorted2 = arr2.slice().sort();
        for (var i = 0; i < sorted1.length; i++) {
            if (sorted1[i] !== sorted2[i]) return false;
        }
        return true;
    }

    function _canMerge(stack1, cand) {
        if (stack1.templateId !== cand.templateId) return false;
        if ((stack1.refine || 0) !== (cand.refine || 0)) return false;
        return _compareCards(stack1.cards || [], cand.cards || []);
    }

    function _isEquipped(equipped, stackKey) {
        for (var slot in equipped) {
            if (equipped.hasOwnProperty(slot) && equipped[slot] && equipped[slot].stackKey === stackKey) return true;
        }
        return false;
    }

    function init(deps) {
        _storage = (deps && deps.storage) || global.CloudStorageService || null;
        if (!_storage) {
            console.error('[InventoryRepository] CloudStorageService 未注入');
            return false;
        }
        return load();
    }

    function _ensureInstanceIds() {
    if (!_inv || !_inv.equipped) return;
    var modified = false;
    for (var slot in _inv.equipped) {
        var entry = _inv.equipped[slot];
        if (entry && !entry._instanceId) {
            entry._instanceId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            modified = true;
        }
    }
    if (modified) save();
}


function load() {
    try {
        var data = _storage ? _storage.loadSection('inventory') : null;
        _inv = (data && data.stacks) ? data : _emptyInv();
        if (!_inv.stacks) _inv.stacks = {};
        if (!_inv.equipped) _inv.equipped = {};
        console.log('[InventoryRepository] ✅ 背包已加载:', Object.keys(_inv.stacks).length, '堆叠');
        _ensureInstanceIds(); // ← 新增
        return true;
    } catch (e) {
        console.error('[InventoryRepository] 加载失败，使用空背包', e);
        _inv = _emptyInv();
        return false;
    }
}

    function save() {
        if (!_inv || !_storage) return false;
        return _storage.saveSection('inventory', _clone(_inv));
    }

    // ---- 读取 ----
    function get() { if (!_inv) load(); return _clone(_inv); }
    function getRaw() { if (!_inv) load(); return _inv; }

    function getAllStacks(includeEquipped) {
        if (!_inv) load();
        var result = [];
        var stacks = _inv.stacks;
        var equipped = _inv.equipped;
        for (var key in stacks) {
            if (!stacks.hasOwnProperty(key)) continue;
            var stack = stacks[key];
            var isEquipped = _isEquipped(equipped, key);
            if (!includeEquipped && isEquipped) continue;
            result.push({
                key: key,
                templateId: stack.templateId,
                refine: stack.refine || 0,
                count: stack.count,
                cards: (stack.cards || []).slice(),
                enchant: stack.enchant || null,   // ROUND4：附魔字段透传（UI/服务消费）
                equipped: isEquipped,
            });
        }
        return result;
    }

    function getStack(stackKey) {
        if (!_inv) load();
        var stack = _inv.stacks[stackKey];
        return stack ? _clone(stack) : null;
    }

    function getEquipped() {
        if (!_inv) load();
        return _clone(_inv.equipped || {});
    }

    function getEquippedEntry(slot) {
        if (!_inv) load();
        var entry = _inv.equipped && _inv.equipped[slot];
        return entry ? _clone(entry) : null;
    }

    // ---- 写入（纯数据操作，无业务校验） ----
    // extra（可选，ROUND4）：装备实例扩展字段透传（如 enchant），携带 extra 的物品不与普通堆叠合并
    function addItemRaw(templateId, refine, count, cards, extra) {
        if (!_inv) load();
        refine = refine || 0;
        count = count || 1;
        cards = cards || [];
        var stacks = _inv.stacks;
        var equipped = _inv.equipped;
        var remaining = count;
        var targetKey = null;
        var hasExtra = !!(extra && extra.enchant);

        if (!hasExtra) {
            for (var key in stacks) {
                if (!stacks.hasOwnProperty(key)) continue;
                if (_isEquipped(equipped, key)) continue;
                var stack = stacks[key];
                if (_canMerge(stack, { templateId: templateId, refine: refine, cards: cards })) {
                    var add = Math.min(remaining, 9999 - stack.count);
                    if (add > 0) {
                        stack.count += add;
                        remaining -= add;
                        if (remaining === 0) { targetKey = key; break; }
                    }
                }
            }
        }

        if (remaining > 0) {
            var newKey = _makeKey(templateId, refine, cards);
            var newStack = { templateId: templateId, refine: refine, count: remaining, cards: cards.slice() };
            if (hasExtra) newStack.enchant = extra.enchant;   // 装备实例扩展字段（附魔）随实例走
            stacks[newKey] = newStack;
            targetKey = newKey;
        }

        save();
        return { success: true, stackKey: targetKey, remaining: 0 };
    }

    function removeItem(stackKey, count) {
        if (!_inv) load();
        count = count || 1;
        var stacks = _inv.stacks;
        if (!stacks[stackKey]) return false;
        var stack = stacks[stackKey];
        if (stack.count <= count) {
            var equipped = _inv.equipped;
            for (var slot in equipped) {
                if (equipped.hasOwnProperty(slot) && equipped[slot] && equipped[slot].stackKey === stackKey) {
                    delete equipped[slot];
                }
            }
            delete stacks[stackKey];
        } else {
            stack.count -= count;
        }
        return save();
    }

function equipEntry(slot, entry) {
    if (!_inv) load();
    if (!slot || !entry) return false;
    // 若 entry 无 _instanceId，生成一个
    if (!entry._instanceId) {
        entry._instanceId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    _inv.equipped[slot] = _clone(entry); // 复制时保留 _instanceId
    return save();
}

    function unequipEntry(slot) {
        if (!_inv) load();
        var entry = _inv.equipped && _inv.equipped[slot];
        if (!entry) return null;
        delete _inv.equipped[slot];
        save();
        return _clone(entry);
    }

    function updateEquipped(slot, mutatorFn) {
        if (!_inv) load();
        var entry = _inv.equipped && _inv.equipped[slot];
        if (!entry || typeof mutatorFn !== 'function') return false;
        mutatorFn(entry);
        return save();
    }

    function reset(caller) {
        if (global.AccessControl && !global.AccessControl.check('data:inventory', caller || 'InventoryRepository')) {
            console.error('[InventoryRepository] 拒绝：', caller, '无权重置背包');
            return false;
        }
        _inv = _emptyInv();
        return save();
    }

    // ---- DataCoordinator 兼容路由（旧调用 dispatch('X','inventory',inv)） ----
    function importData(inv, caller) {
        if (global.AccessControl && !global.AccessControl.check('data:inventory', caller || 'DataCoordinator')) {
            return false;
        }
        if (!inv || typeof inv !== 'object') return false;
        _inv = {
            stacks: (inv.stacks && typeof inv.stacks === 'object') ? inv.stacks : {},
            equipped: (inv.equipped && typeof inv.equipped === 'object') ? inv.equipped : {},
        };
        return save();
    }



    var InventoryRepository = {
        init: init,
        load: load,
        save: save,
        get: get,
        getRaw: getRaw,
        getAllStacks: getAllStacks,
        getStack: getStack,
        getEquipped: getEquipped,
        getEquippedEntry: getEquippedEntry,
        addItemRaw: addItemRaw,
        removeItem: removeItem,
        equipEntry: equipEntry,
        unequipEntry: unequipEntry,
        updateEquipped: updateEquipped,
        reset: reset,
        importData: importData,
    };

    global.InventoryRepository = InventoryRepository;
    console.log('[InventoryRepository] ✅ 已加载（背包仓储）');
})(window);

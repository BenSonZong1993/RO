// ============================================================
//  FILE: EquipService.js
//  LAYER: services（装备子系统——穿脱条件检查与执行、装备加成汇总）
//  权限：inventory:equip / inventory:unequip（经 AccessControl）
//  依赖：InventoryRepository、ItemDataGateway、AttributeGateway、CharacterContext、
//        CharRepository、EventBus、Element/Race/Size 常量、SkillGateway
//  契约：
//    canEquip(char, templateId, slot)    → { allowed, reason? }   // slot 可选
//    doEquip(slots, templateId, refine, cards, caller) → { success, message }
//    doUnequip(slot, caller)             → { success, message }
//    getEquipBonuses()                   → object（装备+卡片脚本加成汇总）
//  规则：
//    - 数据流 Service → Context → Gateway/Repository；UI 不直接调用（ARCH-2）
//    - 特殊机制由 SKILL_PATCHES 配置驱动（MECH-1）
//    - 双持配置通过 SkillGateway 读取，不硬编码系数
//  修改：
//    - 支持多槽位（上中下）——槽位列表由 ItemDataGateway 提供
//    - 双持机制基于 AS_LEFT/AS_RIGHT 技能，允许武器类型：Dagger, 1hSword, 1hAxe
//    - 双持伤害系数从 SkillPatches 动态读取
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[EquipService] ✅ 已加载（装备子系统，支持多槽位 + 双持（配置驱动））');
        return true;
    }

    // ============================================================
    //  工具函数：读取双持补丁配置（通过 SkillGateway）
    // ============================================================
    function getDualWieldPatch(skillAegis) {
        var gateway = global.SkillGateway;
        if (!gateway || typeof gateway.getSkillByAegis !== 'function') {
            // 降级：返回 null，调用方使用默认值
            return null;
        }
        var skill = gateway.getSkillByAegis(skillAegis);
        if (skill && skill.dual_wield && typeof skill.dual_wield.restoreRate !== 'undefined') {
            return skill.dual_wield;
        }
        return null;
    }

    // ============================================================
    //  双持系数默认值（仅当补丁缺失时使用）
    // ============================================================
    var DEFAULT_RIGHT_RESTORE = [0, 0.6, 0.7, 0.8, 0.9, 1.0];
    var DEFAULT_LEFT_RESTORE = [0, 0.4, 0.5, 0.6, 0.7, 0.8];

    // 可双持的武器类型（RO 官方：短剑、单手剑、单手斧）
    var DUAL_WIELD_WEAPON_TYPES = ['Dagger', '1hSword', '1hAxe'];

    // ============================================================
    //  穿戴条件检查
    // ============================================================
function canEquip(char, templateId, slot) {
    var def = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
    if (!def) return { allowed: false, reason: '未知物品' };

    var minLv = def.EquipLevelMin || 0;
    var maxLv = def.EquipLevelMax || 0;
    if (char.level < minLv) return { allowed: false, reason: '需要基础等级 ' + minLv };
    if (maxLv > 0 && char.level > maxLv) return { allowed: false, reason: '超过最大等级 ' + maxLv };

    // ============================================================
    //  【改动点】职业继承检查（递归查父职业链）
    // ============================================================
    if (def.Jobs && typeof def.Jobs === 'object') {
        function isJobAllowed(jobKey, allowedJobs, visited) {
            visited = visited || new Set();
            if (visited.has(jobKey)) return false;
            visited.add(jobKey);
            if (allowedJobs[jobKey] || allowedJobs['All']) return true;
            var prevJobs = global.JobGateway ? global.JobGateway.getPrevJobs(jobKey) : [];
            for (var i = 0; i < prevJobs.length; i++) {
                if (isJobAllowed(prevJobs[i], allowedJobs, visited)) return true;
            }
            return false;
        }
        if (!isJobAllowed(char.jobKey, def.Jobs)) {
            return { allowed: false, reason: '该职业无法装备此物品' };
        }
    }

    // ---- 以下为原有检查，未改动 ----
    if (def.Classes && typeof def.Classes === 'object' && char.classType) {
        if (!def.Classes[char.classType] && !def.Classes['All']) {
            return { allowed: false, reason: '职业类型不符' };
        }
    }

    if (def.Gender && def.Gender !== 'Both') {
        if (char.gender && char.gender !== def.Gender) {
            return { allowed: false, reason: '性别不符' };
        }
    }

    if (def.AttributeRequirement && typeof def.AttributeRequirement === 'object') {
        for (var attr in def.AttributeRequirement) {
            if (!def.AttributeRequirement.hasOwnProperty(attr)) continue;
            var need = def.AttributeRequirement[attr];
            var current = (char.stats && char.stats[attr.toLowerCase()]) || 0;
            if (current < need) {
                return { allowed: false, reason: '需要 ' + attr + ' ' + need };
            }
        }
    }

    // --- [Dual Wield] 副手武器双持检查 ---
    if (slot === 'shield') {
        if (def.Type === 'Weapon' && DUAL_WIELD_WEAPON_TYPES.indexOf(def.SubType) !== -1) {
            var leftLevel = (char.learnedSkills && char.learnedSkills['AS_LEFT']) || 0;
            if (leftLevel < 1) {
                return { allowed: false, reason: '需要学习「左手修炼」至少1级才能双持' };
            }
            return { allowed: true };
        }
    }

    return { allowed: true };
}

    // ============================================================
    //  穿戴执行
    // ============================================================
    function doEquip(slots, templateId, refine, cards, caller) {
        var repo = global.InventoryRepository;
        var bus = _bus || global.EventBus;
        if (!repo) return { success: false, message: '背包仓储未加载' };

        if (global.AccessControl && !global.AccessControl.check('inventory:equip', caller || 'EquipService')) {
            return { success: false, message: '权限不足' };
        }

        refine = refine || 0;
        cards = cards || [];

        // 规范化 slots
        if (typeof slots === 'string') {
            slots = slots.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(function(s) { return s; });
        } else if (Array.isArray(slots)) {
            slots = slots.map(function(s) { return typeof s === 'string' ? s.trim().toLowerCase() : s; }).filter(function(s) { return s; });
        } else {
            return { success: false, message: '无效装备槽位格式' };
        }

        if (slots.length === 0) {
            return { success: false, message: '无效装备槽位' };
        }

        var live = repo.getRaw();
        var stacks = live.stacks;
        var foundKey = null;
        for (var key in stacks) {
            if (!stacks.hasOwnProperty(key)) continue;
            var stack = stacks[key];
            if (stack.templateId === templateId && stack.refine === refine &&
                _compareCards(stack.cards || [], cards)) {
                foundKey = key;
                break;
            }
        }
        if (!foundKey) return { success: false, message: '背包中无此物品' };

        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return { success: false, message: '角色数据未加载' };

        var targetSlot = slots[0];
        var reqCheck = canEquip(char, templateId, targetSlot);
        if (!reqCheck.allowed) return { success: false, message: reqCheck.reason };

        var actualSlots = slots.slice();
        var equipped = live.equipped || {};

        // ---- 智能双持：若主手被占用，自动转为副手 ----
        if (actualSlots.length === 1 && actualSlots[0] === 'weapon') {
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
            if (def && def.Type === 'Weapon' && DUAL_WIELD_WEAPON_TYPES.indexOf(def.SubType) !== -1) {
                var leftLevel = (char.learnedSkills && char.learnedSkills['AS_LEFT']) || 0;
                if (leftLevel >= 1) {
                    var mainWeapon = equipped['weapon'];
                    if (mainWeapon && !equipped['shield']) {
                        actualSlots = ['shield'];
                        console.log('[doEquip] 智能双持：自动装备到副手');
                    }
                }
            }
        }

        // ---- 智能分配饰品槽位（优先 accessory2） ----
        if (actualSlots.length === 1) {
            var preferred = actualSlots[0];
            if (preferred === 'accessory1' || preferred === 'accessory2') {
                var trySlots = ['accessory2', 'accessory1'];
                var foundSlot = null;
                for (var i = 0; i < trySlots.length; i++) {
                    var slot = trySlots[i];
                    if (!equipped.hasOwnProperty(slot) || equipped[slot] === null || equipped[slot] === undefined) {
                        foundSlot = slot;
                        break;
                    }
                }
   if (foundSlot) {
    actualSlots = [foundSlot];
} else {
    // 两个都满，默认选择 accessory2 进行替换（后续循环会卸下它）
    actualSlots = ['accessory2'];
}
            }
        }

        // ---- 检查主手是否为双手武器，若是则拒绝副手装备 ----
        if (actualSlots.length === 1 && actualSlots[0] === 'shield') {
            var def2 = global.ItemDataGateway ? global.ItemDataGateway.getById(templateId) : null;
            if (def2 && def2.Type === 'Weapon' && DUAL_WIELD_WEAPON_TYPES.indexOf(def2.SubType) !== -1) {
                var mainWeapon2 = equipped['weapon'];
                if (mainWeapon2) {
                    var mainDef = global.ItemDataGateway ? global.ItemDataGateway.getById(mainWeapon2.templateId) : null;
                    if (mainDef && mainDef.Locations && mainDef.Locations['Both_Hand']) {
                        return { success: false, message: '主手装备了双手武器，无法双持' };
                    }
                }
            }
        }

// 检查实际槽位，若被占用则自动卸下
for (var j = 0; j < actualSlots.length; j++) {
    var slot = actualSlots[j];
    if (equipped[slot]) {
        // 调用本服务卸下旧装备（放回背包）
        var unequipResult = doUnequip(slot, caller);
        if (!unequipResult.success) {
            return { success: false, message: '无法卸下旧装备: ' + unequipResult.message };
        }
    }
}
// 现在所有目标槽位都已空闲，继续执行装备...

        // 从背包移除一件
        var stackToEquip = stacks[foundKey];
        if (stackToEquip.count > 1) {
            stackToEquip.count -= 1;
        } else {
            delete stacks[foundKey];
        }

        // 装备到实际槽位（ROUND4：enchant 等装备实例扩展字段随实例透传，避免穿脱丢失）
        var entry = { templateId: templateId, refine: refine, cards: cards.slice() };
        if (stackToEquip.enchant) entry.enchant = stackToEquip.enchant;
        for (var k = 0; k < actualSlots.length; k++) {
            repo.equipEntry(actualSlots[k], entry);
        }
        repo.save();

        if (global.CharacterContext) {
            global.CharacterContext.applyModifier('equip', { slots: actualSlots, action: 'equip', templateId: templateId }, caller || 'EquipService');
        }
        if (bus) {
            bus.emit('inventory:changed');
            bus.emit('equip:changed', { slots: actualSlots, item: { templateId: templateId, refine: refine, cards: cards } });
        }

        return {
            success: true,
            message: '装备成功: ' + (global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(templateId) : templateId) + ' (' + actualSlots.join(',') + ')',
            item: { templateId: templateId, refine: refine, cards: cards },
        };
    }

    // ============================================================
    //  卸下执行
    // ============================================================
    function doUnequip(slot, caller) {
        var repo = global.InventoryRepository;
        var bus = _bus || global.EventBus;
        if (!repo) return { success: false, message: '背包仓储未加载' };

        if (global.AccessControl && !global.AccessControl.check('inventory:unequip', caller || 'EquipService')) {
            return { success: false, message: '权限不足' };
        }

        var live = repo.getRaw();
        var equipped = live.equipped || {};
        var entry = equipped[slot];
        if (!entry) return { success: true, message: '该槽位无装备，无需卸下' };

        var def = global.ItemDataGateway ? global.ItemDataGateway.getById(entry.templateId) : null;
        var slotsToClear = [slot];
        if (def) {
            var allSlots = global.ItemDataGateway ? global.ItemDataGateway.getEquipSlots(entry.templateId) : [];
            if (allSlots.length > 0) {
                slotsToClear = allSlots.slice();
                if (slotsToClear.indexOf(slot) === -1) slotsToClear.push(slot);
            }
        }

        var removedItem = null;
        var actuallyCleared = [];
        for (var i = 0; i < slotsToClear.length; i++) {
            var s = slotsToClear[i];
            if (equipped[s] && equipped[s]._instanceId === entry._instanceId) {
                if (!removedItem) removedItem = equipped[s];
                delete equipped[s];
                actuallyCleared.push(s);
            }
        }
        if (!removedItem) {
            if (equipped[slot]) {
                removedItem = equipped[slot];
                delete equipped[slot];
                actuallyCleared = [slot];
            } else {
                return { success: true, message: '该槽位已空，无需卸下' };
            }
        }

        var addResult = repo.addItemRaw(removedItem.templateId, removedItem.refine || 0, 1, removedItem.cards || [],
            removedItem.enchant ? { enchant: removedItem.enchant } : undefined);
        if (!addResult.success) {
            for (var j = 0; j < actuallyCleared.length; j++) {
                repo.equipEntry(actuallyCleared[j], removedItem);
            }
            return { success: false, message: '放回背包失败' };
        }

        if (global.CharacterContext) {
            global.CharacterContext.applyModifier('equip', { slots: actuallyCleared, action: 'unequip' }, caller || 'EquipService');
        }
        if (bus) {
            bus.emit('inventory:changed');
            bus.emit('equip:changed', { slots: actuallyCleared, removed: true });
        }

        return {
            success: true,
            message: '卸下成功: ' + (global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(removedItem.templateId) : removedItem.templateId),
            item: removedItem,
            clearedSlots: actuallyCleared,
        };
    }

    function _compareCards(arr1, arr2) {
        arr1 = arr1 || [];
        arr2 = arr2 || [];
        if (arr1.length !== arr2.length) return false;
        var a1 = arr1.slice().sort();
        var a2 = arr2.slice().sort();
        for (var i = 0; i < a1.length; i++) {
            if (a1[i] !== a2[i]) return false;
        }
        return true;
    }

    // ============================================================
    //  装备加成汇总（双持伤害惩罚配置驱动）
    // ============================================================
    function getEquipBonuses() {
        var bonuses = {
            str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0,
            atk: 0, matk: 0, def: 0, mdef: 0,
            maxHp: 0, maxSp: 0, aspd: 0,
            hit: 0, flee: 0, crit: 0, perfectDodge: 0,
            attackRange: 0,
            weaponElement: 'Neutral',
            weaponElementLevel: 1,
            armorElement: 'Neutral',
            armorElementLevel: 1,
            fixedCastReduction: 0,
            weaponType: 'None',
            modifiers: {
                raceAddDamage: {}, raceReduceDamage: {},
                elementalAddDamage: {}, elementalReduceDamage: {},
                sizeAddDamage: {}, sizeReduceDamage: {},
                statusAttackChance: {}, statusResistance: {},
                baseAtk: 0, baseMatk: 0, aspdRate: 0, atkRate: 0, matkRate: 0,
                maxHpRate: 0, maxSpRate: 0,
            },
        };
        var ELE_LIST = global.ELEMENT_LIST || ['Neutral', 'Water', 'Earth', 'Fire', 'Wind', 'Poison', 'Holy', 'Dark', 'Ghost', 'Undead'];
        var RACE_LIST = global.RACE_LIST || ['Angel', 'Brute', 'Demihuman', 'Demon', 'Dragon', 'Fish', 'Formless', 'Insect', 'Plant', 'Player_Doram', 'Player_Human', 'Undead'];
        var SIZE_LIST = global.SIZE_LIST || ['Small', 'Medium', 'Large'];

        function normalizeElement(scriptName) {
            if (!scriptName) return 'Neutral';
            var raw = scriptName.replace(/^Ele_/, '');
            var normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
            if (ELE_LIST.indexOf(normalized) !== -1) return normalized;
            if (ELE_LIST.indexOf(raw) !== -1) return raw;
            return 'Neutral';
        }
        function normalizeRace(scriptName) {
            if (!scriptName) return '';
            var raw = scriptName.replace(/^RC_/, '');
            var parts = raw.toLowerCase().split('_');
            var normalized = parts.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('_');
            if (RACE_LIST.indexOf(normalized) !== -1) return normalized;
            if (RACE_LIST.indexOf(raw) !== -1) return raw;
            return '';
        }
        function normalizeSize(scriptName) {
            if (!scriptName) return '';
            var raw = scriptName.replace(/^Size_/, '');
            var normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
            if (SIZE_LIST.indexOf(normalized) !== -1) return normalized;
            if (SIZE_LIST.indexOf(raw) !== -1) return raw;
            return '';
        }

        // ---- bonus / bonus2 / bonus3 脚本解析 ----
        function applyBonus(type, arg, target, slot) {
            var numVal = parseInt(arg, 10);
            var simpleMap = {
                'bStr': 'str', 'bAgi': 'agi', 'bVit': 'vit',
                'bInt': 'int', 'bDex': 'dex', 'bLuk': 'luk',
                'bAtk': 'atk', 'bMatk': 'matk',
                'bDef': 'def', 'bMdef': 'mdef',
                'bMaxHP': 'maxHp', 'bMaxSP': 'maxSp',
                'bAspd': 'aspd', 'bBaseAtk': 'baseAtk', 'bBaseMatk': 'baseMatk',
                'bAspdRate': 'aspdRate', 'bAtkRate': 'atkRate', 'bMatkRate': 'matkRate',
                'bMaxHPrate': 'maxHpRate', 'bMaxSPrate': 'maxSpRate',
                'bHit': 'hit', 'bFlee': 'flee', 'bCritical': 'crit',
                'bFlee2': 'perfectDodge',
            };
            if (simpleMap[type] !== undefined && !isNaN(numVal)) {
                var field = simpleMap[type];
                target[field] = (target[field] || 0) + numVal;
                return;
            }
            if (type === 'bAtkEle' && slot === 'weapon') {
                target.weaponElement = normalizeElement(arg);
                target.weaponElementLevel = 1;
                return;
            }
            if (type === 'bDefEle' && slot === 'armor') {
                target.armorElement = normalizeElement(arg);
                target.armorElementLevel = 1;
                return;
            }
            if (type === 'bFixedCast' && !isNaN(numVal)) {
                target.fixedCastReduction = (target.fixedCastReduction || 0) + (numVal / 1000);
                return;
            }
        }

        function applyBonus2(type, arg1, value, target) {
            var mods = target.modifiers;
            if (type === 'bAddRace') {
                var race = normalizeRace(arg1);
                if (race) mods.raceAddDamage[race] = (mods.raceAddDamage[race] || 0) + value;
            } else if (type === 'bSubRace') {
                var race2 = normalizeRace(arg1);
                if (race2) mods.raceReduceDamage[race2] = (mods.raceReduceDamage[race2] || 0) + value;
            } else if (type === 'bAddEle') {
                var elem = normalizeElement(arg1);
                if (elem) mods.elementalAddDamage[elem] = (mods.elementalAddDamage[elem] || 0) + value;
            } else if (type === 'bSubEle') {
                var elem2 = normalizeElement(arg1);
                if (elem2) mods.elementalReduceDamage[elem2] = (mods.elementalReduceDamage[elem2] || 0) + value;
            } else if (type === 'bAddSize') {
                var size = normalizeSize(arg1);
                if (size) mods.sizeAddDamage[size] = (mods.sizeAddDamage[size] || 0) + value;
            } else if (type === 'bSubSize') {
                var size2 = normalizeSize(arg1);
                if (size2) mods.sizeReduceDamage[size2] = (mods.sizeReduceDamage[size2] || 0) + value;
            } else if (type === 'bAddEff') {
                var statusName = arg1.replace(/^Eff_/, '');
                mods.statusAttackChance[statusName] = (mods.statusAttackChance[statusName] || 0) + value;
            } else if (type === 'bResEff') {
                var statusName2 = arg1.replace(/^Eff_/, '');
                mods.statusResistance[statusName2] = (mods.statusResistance[statusName2] || 0) + value;
            }
        }

        function applyBonus3(type, arg1, arg2, target) {
            var mods = target.modifiers;
            if (type === 'bAddEff') {
                var statusName = arg1.replace(/^Eff_/, '');
                var chance = parseInt(arg2, 10);
                mods.statusAttackChance[statusName] = (mods.statusAttackChance[statusName] || 0) + chance;
            } else if (type === 'bResEff') {
                var statusName2 = arg1.replace(/^Eff_/, '');
                var resist = parseInt(arg2, 10);
                mods.statusResistance[statusName2] = (mods.statusResistance[statusName2] || 0) + resist;
            }
        }

        function parseScriptToModifiers(script, slot, currentBonuses) {
            if (!script || typeof script !== 'string') return;
            var lines = script.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;

                var bonus2Match = line.match(/bonus2\s+(\w+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*;/);
                if (bonus2Match) {
                    applyBonus2(bonus2Match[1], bonus2Match[2].trim(), parseInt(bonus2Match[3], 10), currentBonuses);
                    continue;
                }
                var bonus3Match = line.match(/bonus3\s+(\w+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*([^;]+)\s*;/);
                if (bonus3Match) {
                    applyBonus3(bonus3Match[1], bonus3Match[2].trim(), parseInt(bonus3Match[3], 10), currentBonuses);
                    continue;
                }
                var bonusMatch = line.match(/bonus\s+(\w+)\s*,\s*([^,]+)\s*;/);
                if (bonusMatch) {
                    applyBonus(bonusMatch[1], bonusMatch[2].trim(), currentBonuses, slot);
                    continue;
                }
            }
        }

        var equipped = global.InventoryRepository ? global.InventoryRepository.getEquipped() : {};
        var processedSet = new Set();

        // 先收集所有物品的原始加成（含基础属性）
        for (var slot in equipped) {
            if (!equipped.hasOwnProperty(slot)) continue;
            var item = equipped[slot];
            if (!item) continue;

            if (!item._instanceId) {
                item._instanceId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            }
            if (processedSet.has(item._instanceId)) continue;
            processedSet.add(item._instanceId);

            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(item.templateId) : null;
            if (!def) continue;

            // 基础加成（武器、防具基础数值）
            if (slot === 'weapon') {
                if (typeof def.Range === 'number') bonuses.attackRange = def.Range;
                if (typeof def.Attack === 'number') bonuses.atk += def.Attack;
                if (typeof def.MagicAttack === 'number') bonuses.matk += def.MagicAttack;
                if (typeof def.WeaponLevel === 'number') bonuses.weaponLevel = def.WeaponLevel;
                var weaponTypeMap = {
                    '1hSword': '1hSword', '2hSword': '2hSword', 'Dagger': 'Dagger',
                    '1hSpear': '1hSpear', '2hSpear': '2hSpear', 'Bow': 'Bow',
                    'Knuckle': 'Knuckle', 'Book': 'Book', 'Staff': 'Staff',
                    'Musical': 'Musical', 'Whip': 'Whip', 'Revolver': 'Revolver',
                };
                bonuses.weaponType = weaponTypeMap[def.SubType || ''] || 'None';
            }

            if (slot === 'armor' || slot === 'garment' || slot === 'shoes' || slot === 'shield' ||
                slot === 'headTop' || slot === 'headMid' || slot === 'headBottom' ||
                slot === 'accessory1' || slot === 'accessory2') {
                if (typeof def.Defense === 'number') bonuses.def += def.Defense;
                if (typeof def.MagicDefense === 'number') bonuses.mdef += def.MagicDefense;
                if (typeof def.ArmorLevel === 'number') bonuses.armorLevel = def.ArmorLevel;
            }

            if (def.Script) parseScriptToModifiers(def.Script, slot, bonuses);

            var cards = item.cards || [];
            for (var c = 0; c < cards.length; c++) {
                var cardDef = global.ItemDataGateway ? global.ItemDataGateway.getById(cards[c]) : null;
                if (cardDef && cardDef.Script) parseScriptToModifiers(cardDef.Script, slot, bonuses);
            }

            // ---- 精炼加成（ROUND3：经 RefineService.getRefineBonus 纯函数，配置驱动） ----
            var refineLvl = item.refine || 0;
            if (refineLvl > 0 && global.RefineService) {
                var rb = global.RefineService.getRefineBonus(def, refineLvl);
                bonuses.atk += rb.atk;
                bonuses.matk += rb.matk;
                bonuses.def += rb.def;
                bonuses.mdef += rb.mdef;
                bonuses.maxHp += rb.maxHp;
            }

            // ---- 附魔加成（ROUND4：经 EnchantService.getEnchantBonus 纯函数，配置驱动） ----
            if (item.enchant && global.EnchantService) {
                var eb = global.EnchantService.getEnchantBonus(def, item.enchant);
                for (var attrKey in eb.attrs) {
                    if (eb.attrs.hasOwnProperty(attrKey)) bonuses[attrKey] = (bonuses[attrKey] || 0) + eb.attrs[attrKey];
                }
                for (var raceKey in eb.raceAddDamage) {
                    if (eb.raceAddDamage.hasOwnProperty(raceKey)) {
                        bonuses.modifiers.raceAddDamage[raceKey] = (bonuses.modifiers.raceAddDamage[raceKey] || 0) + eb.raceAddDamage[raceKey];
                    }
                }
            }
        }

        // --- [Dual Wield] 应用双持伤害惩罚（配置驱动） ---
        var weaponItem = equipped['weapon'];
        var shieldItem = equipped['shield'];
        if (weaponItem && shieldItem) {
            var shieldDef = global.ItemDataGateway ? global.ItemDataGateway.getById(shieldItem.templateId) : null;
            // 副手必须是允许双持的武器类型
            if (shieldDef && shieldDef.Type === 'Weapon' && DUAL_WIELD_WEAPON_TYPES.indexOf(shieldDef.SubType) !== -1) {
                var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                if (char) {
                    var rightLevel = (char.learnedSkills && char.learnedSkills['AS_RIGHT']) || 0;
                    var leftLevel = (char.learnedSkills && char.learnedSkills['AS_LEFT']) || 0;

                    // 从 SkillGateway 读取补丁配置
                    var rightPatch = getDualWieldPatch('AS_RIGHT');
                    var leftPatch = getDualWieldPatch('AS_LEFT');

                    var rightFactor = (rightPatch && rightPatch.restoreRate && rightPatch.restoreRate[rightLevel] !== undefined)
                        ? rightPatch.restoreRate[rightLevel]
                        : (DEFAULT_RIGHT_RESTORE[rightLevel] || 0.6);

                    var leftFactor = (leftPatch && leftPatch.restoreRate && leftPatch.restoreRate[leftLevel] !== undefined)
                        ? leftPatch.restoreRate[leftLevel]
                        : (DEFAULT_LEFT_RESTORE[leftLevel] || 0.4);

                    var mainDef = global.ItemDataGateway ? global.ItemDataGateway.getById(weaponItem.templateId) : null;
                    var subDef = shieldDef;
                    if (mainDef && subDef) {
                        var mainBaseAtk = (typeof mainDef.Attack === 'number') ? mainDef.Attack : 0;
                        var subBaseAtk = (typeof subDef.Attack === 'number') ? subDef.Attack : 0;
                        // 主手：减去已加的基础攻击，乘系数后加回
                        bonuses.atk -= mainBaseAtk;
                        bonuses.atk += Math.floor(mainBaseAtk * rightFactor);
                        // 副手：基础攻击从未累加，直接乘系数加回
                        bonuses.atk += Math.floor(subBaseAtk * leftFactor);
                    }
                }
            }
        }

        return bonuses;
    }

    var EquipService = {
        init: init,
        canEquip: canEquip,
        doEquip: doEquip,
        doUnequip: doUnequip,
        getEquipBonuses: getEquipBonuses,
    };

    global.EquipService = EquipService;
})(window);
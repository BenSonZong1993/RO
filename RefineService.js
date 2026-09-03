// ============================================================
//  FILE: RefineService.js
//  LAYER: services（装备精炼子系统——ROUND3 新增）
//  权限：refine:perform / data:inventory（扣矿）/ char:deductZeny（扣费），均经 AccessControl
//  依赖：RefineConfig、InventoryRepository、ItemDataGateway、MaterialService、
//        CharacterContext、CharRepository、EventBus
//  契约：
//    getRefineBonus(equipDef, refineLevel)  → { atk, matk, def, mdef, maxHp }
//        ★ 纯函数（读 RefineConfig，不触碰任何仓储）——与属性管线的唯一接缝，
//          由 EquipService.getEquipBonuses() 消费；禁止在战斗核心里加精炼逻辑
//    getRefineInfo(target)   → { ok, level, targetLevel, successRate, safe, zeny, ores, message }
//        供 UI 确认弹窗展示（材料/费用/成功率）
//    refine(target, caller)  → { success, newLevel, broken, cost:{zeny,ores}, message }
//        target = { slot: 'weapon' }（已装备）或 { stackKey: 'xxx' }（背包内）
//    isRefinable(equipDef)   → boolean（武器或防具类才可精炼）
//  数据流：UI → EventBus('ui:refine-item') → init.js → 本 Service → Repository/Context
//  持久化：refineLevel 直接写在装备实例的 refine 字段上（equipped[slot].refine /
//          stacks[key].refine），随背包 v3 存档走，无新增持久化键
//  破裂数据流：移除装备实例（不回背包）+ 'refine:broken' 事件 → UI Notification 提示
//  组织约定：文件结构与注释按"将来旁边会加 EnchantService（ROUND4 附魔）"来组织——
//          配置在 config/RefineConfig.js，加成纯函数在本文件，接缝统一走 getEquipBonuses
//  ROUND5：数值全部切换为官方 refine.yml Normal 档（RefineConfig.table，按物品等级
//          WeaponLevel/ArmorLevel 取档）；HD/Enriched 档矿石/费用已在 Config 预留，
//          本 Service 暂只消费 Normal（_getOreRequirements 的 costType 参数已留位）
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        if (global.AccessControl) {
            global.AccessControl.register('refine:perform', ['RefineService', 'init', 'GMConsole']);
        }
        console.log('[RefineService] ✅ 已加载（精炼子系统，配置驱动，旁留 EnchantService 扩展位）');
        return true;
    }

    // ============================================================
    //  纯函数：精炼加成计算（属性管线唯一接缝）
    //  equipDef：ItemDataGateway.getById(templateId) 的物品定义
    //  返回各项增量（未精炼返回全 0）
    //  ROUND5：按官方 refine.yml 累计 Bonus 表（Group×物品等级）直接取值
    // ============================================================
    function getRefineBonus(equipDef, refineLevel) {
        var result = { atk: 0, matk: 0, def: 0, mdef: 0, maxHp: 0 };
        var cfg = global.RefineConfig;
        if (!cfg || !equipDef || !refineLevel || refineLevel <= 0) return result;
        if (refineLevel > cfg.maxLevel) refineLevel = cfg.maxLevel;

        var entry = cfg.getEntry(equipDef);
        var bonus = entry.bonus || {};
        if (equipDef.Type === 'Weapon') {
            result.atk = bonus.atk ? bonus.atk[refineLevel] || 0 : 0;
            result.matk = bonus.matk ? bonus.matk[refineLevel] || 0 : 0;
        } else {
            result.def = bonus.def ? bonus.def[refineLevel] || 0 : 0;
            result.mdef = bonus.mdef ? bonus.mdef[refineLevel] || 0 : 0;
            result.maxHp = bonus.maxHp ? bonus.maxHp[refineLevel] || 0 : 0;
        }
        return result;
    }

    // ---- 生效安全档：官方各档 Rate=10000 段与全局兜底取较大者 ----
    function _effectiveSafeLevel(equipDef) {
        var cfg = global.RefineConfig;
        var entry = cfg.getEntry(equipDef);
        return Math.max(cfg.safeLevel, entry.safeLevel || cfg.safeLevel);
    }

    // ---- 可精炼判定：武器或防具类槽位物品 ----
    function isRefinable(equipDef) {
        if (!equipDef) return false;
        return equipDef.Type === 'Weapon' || equipDef.Type === 'Armor' || equipDef.Type === 'Equip';
    }

    // ============================================================
    //  目标定位：{ slot }（已装备，取活引用）或 { stackKey }（背包堆叠，取活引用）
    //  返回 { kind, slot?, key?, entry(ref), def } | null
    // ============================================================
    function _locate(target) {
        var repo = global.InventoryRepository;
        if (!repo || !target) return null;

        if (target.slot) {
            var raw = repo.getRaw();
            var equipped = raw.equipped || {};
            var entry = equipped[target.slot];
            if (!entry) return null;
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(entry.templateId) : null;
            return { kind: 'equipped', slot: target.slot, entry: entry, def: def };
        }

        if (target.stackKey) {
            var raw2 = repo.getRaw();
            var stack = raw2.stacks && raw2.stacks[target.stackKey];
            if (!stack) return null;
            var def2 = global.ItemDataGateway ? global.ItemDataGateway.getById(stack.templateId) : null;
            return { kind: 'stack', key: target.stackKey, entry: stack, def: def2 };
        }
        return null;
    }

    // ---- 按装备类型取矿石需求（官方 Normal 档：每次 1 个对应矿石） ----
    // ROUND5 预留：costType 参数将来支持 'hd' / 'enriched'（RefineConfig 已备 oreHd/oreEnriched）
    function _getOreRequirements(def, targetLevel, costType) {
        var cfg = global.RefineConfig;
        var entry = cfg.getEntry(def);
        var ore = (costType === 'hd') ? entry.oreHd
                : (costType === 'enriched') ? entry.oreEnriched
                : entry.ore;
        if (!ore || typeof ore.templateId !== 'number') return [];
        return [{ templateId: ore.templateId, count: 1 }];
    }

    // ============================================================
    //  精炼信息（UI 确认弹窗数据源）
    // ============================================================
    function getRefineInfo(target) {
        var cfg = global.RefineConfig;
        if (!cfg) return { ok: false, message: '精炼配置未加载' };
        var loc = _locate(target);
        if (!loc) return { ok: false, message: '装备不存在' };
        if (!loc.def || !isRefinable(loc.def)) return { ok: false, message: '该物品不可精炼' };

        var level = loc.entry.refine || 0;
        if (level >= cfg.maxLevel) return { ok: false, level: level, message: '已达精炼上限 +' + cfg.maxLevel };

        var targetLevel = level + 1;
        var safe = targetLevel <= _effectiveSafeLevel(loc.def);
        var entry = cfg.getEntry(loc.def);
        var ores = _getOreRequirements(loc.def, targetLevel);
        var zeny = entry.zeny || 0;
        return {
            ok: true,
            level: level,
            targetLevel: targetLevel,
            successRate: safe ? 1.0 : (entry.successRate[targetLevel] || 0),
            safe: safe,
            zeny: zeny,
            ores: ores.map(function(o) {
                return { templateId: o.templateId, count: o.count, name: global.ItemDataGateway ? global.ItemDataGateway.getDisplayName(o.templateId) : ('#' + o.templateId) };
            }),
            isEquipped: loc.kind === 'equipped',
            slot: loc.slot,
            stackKey: loc.key,
        };
    }

    // ============================================================
    //  精炼执行（读装备 → 查表判定 → 扣材料/费用 → 写 refineLevel → 返回结果）
    //  注意：材料/费用在判定前扣（RO 惯例：失败不退还）
    // ============================================================
    function refine(target, caller) {
        if (global.AccessControl && !global.AccessControl.check('refine:perform', caller || 'RefineService')) {
            return { success: false, message: '权限不足' };
        }
        var cfg = global.RefineConfig;
        var repo = global.InventoryRepository;
        if (!cfg || !repo) return { success: false, message: '精炼系统未加载' };

        var loc = _locate(target);
        if (!loc) return { success: false, message: '装备不存在' };
        if (!loc.def || !isRefinable(loc.def)) return { success: false, message: '该物品不可精炼' };

        var level = loc.entry.refine || 0;
        if (level >= cfg.maxLevel) return { success: false, message: '已达精炼上限 +' + cfg.maxLevel };

        var targetLevel = level + 1;
        var entry = cfg.getEntry(loc.def);
        var zeny = entry.zeny || 0;
        var ores = _getOreRequirements(loc.def, targetLevel);

        // ---- 扣矿石（经 MaterialService，全部满足才扣） ----
        var matSvc = global.MaterialService;
        if (ores.length > 0) {
            if (!matSvc || !matSvc.hasMaterials(ores)) {
                return { success: false, message: '矿石不足' };
            }
            if (!matSvc.deductForCraft(ores, 'RefineService')) {
                return { success: false, message: '扣矿失败' };
            }
        }

        // ---- 扣 Zeny（经 CharacterContext，权限表已放行 RefineService） ----
        if (zeny > 0) {
            var ctx = global.CharacterContext;
            if (!ctx || !ctx.deductZeny(zeny, 'RefineService')) {
                return { success: false, message: 'Zeny 不足' };
            }
        }

        var cost = { zeny: zeny, ores: ores };

        // ---- 成功判定（官方安全段 + 全局兜底档强制成功） ----
        var safe = targetLevel <= _effectiveSafeLevel(loc.def);
        var roll = Math.random();
        var succeeded = safe || roll < (entry.successRate[targetLevel] || 0);

        function _writeRefine(newLevel) {
            if (loc.kind === 'equipped') {
                repo.updateEquipped(loc.slot, function(entry) { entry.refine = newLevel; });
            } else {
                loc.entry.refine = newLevel;
                repo.save();
            }
        }

        if (succeeded) {
            _writeRefine(targetLevel);
            _invalidate('refine', { slot: loc.slot, stackKey: loc.key, level: targetLevel });
            _emit('refine:changed', { level: targetLevel, broken: false, slot: loc.slot, stackKey: loc.key });
            return { success: true, newLevel: targetLevel, broken: false, cost: cost, message: '精炼成功：+' + targetLevel };
        }

        // ---- 失败处理（safeLevel 内不会走到这里；官方 Normal 档：高等级普通精炼失败即碎，
        //      Armor 物品等级 2 失败降 3 级） ----
        var rule = entry.failureRule[level] || { downgradeAmount: 0, breakChance: 0 };
        var broken = Math.random() < (rule.breakChance || 0);

        if (broken) {
            _removeEntry(loc);
            _invalidate('refineBroken', { slot: loc.slot, stackKey: loc.key });
            _emit('refine:broken', { slot: loc.slot, stackKey: loc.key, level: level });
            return { success: false, newLevel: 0, broken: true, cost: cost, message: '精炼失败，装备已碎裂！' };
        }

        var downAmount = rule.downgradeAmount || 0;
        var newLevel = downAmount > 0 ? Math.max(0, level - downAmount) : level;
        _writeRefine(newLevel);
        _invalidate('refine', { slot: loc.slot, stackKey: loc.key, level: newLevel });
        _emit('refine:changed', { level: newLevel, broken: false, downgraded: newLevel < level, slot: loc.slot, stackKey: loc.key });
        return {
            success: false,
            newLevel: newLevel,
            broken: false,
            cost: cost,
            downgraded: newLevel < level,
            message: newLevel < level ? ('精炼失败，降级至 +' + newLevel) : '精炼失败，等级维持 +' + newLevel,
        };
    }

    // ---- 碎裂：移除装备实例（不回背包） ----
    function _removeEntry(loc) {
        var repo = global.InventoryRepository;
        if (!repo) return;
        if (loc.kind === 'equipped') {
            repo.unequipEntry(loc.slot); // 碎裂即销毁：不将装备放回背包
        } else {
            repo.removeItem(loc.key, 1);
        }
    }

    function _invalidate(source, payload) {
        if (global.CharacterContext) {
            global.CharacterContext.applyModifier(source, payload, 'RefineService');
        }
    }

    function _emit(evt, payload) {
        if (_bus || global.EventBus) (_bus || global.EventBus).emit(evt, payload);
    }

    var RefineService = {
        init: init,
        getRefineBonus: getRefineBonus,
        getRefineInfo: getRefineInfo,
        isRefinable: isRefinable,
        refine: refine,
    };

    global.RefineService = RefineService;
})(window);

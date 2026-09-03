// ============================================================
//  FILE: EnchantService.js
//  LAYER: services（装备附魔子系统——ROUND4 新增 / ROUND6 官方数值真实化）
//  权限：enchant:perform / char:deductZeny，均经 AccessControl
//  依赖：EnchantConfig、InventoryRepository、ItemDataGateway、CharacterContext、EventBus
//  契约：
//    getEnchantBonus(equipDef, enchant)  → { attrs:{...}, raceAddDamage:{Race:n} }
//        ★ 纯函数（读 EnchantConfig，不触碰任何仓储）——与属性管线的唯一接缝，
//          由 EquipService.getEquipBonuses() 消费；禁止在战斗核心里加附魔逻辑
//        数值公式（ROUND6 官方化）：value = floor(perLevel × level × qualityMult[quality])
//        qualityMult = 1 + 官方 Grade Bonus/100（白1.0/蓝1.1/紫1.3/橙1.5）
//    getEnchantInfo(target, city) → { ok, level, maxLevel, zeny, upgradeChance,
//                                     gradeFee, cityName, ... }（UI 确认弹窗数据源）
//    enchant(target, city, caller) → { success, level, affix, quality, qualityChanged,
//                                      cost:{zeny, gradeFee}, changed, message }
//        target = { slot }（已装备）或 { stackKey }（背包内）；city 缺省 'prontera'
//        洗练语义（ROUND6 官方化）：
//          · 附魔等级 +1（永不降级，城市间等级互通）
//          · 词条按城市池均匀重掷（官方 Wolf 池 6 属均匀 9900×6 佐证）
//          · 品阶只升不降：按官方 Grade 概率表（enchantgrade.yml Chances）以装备
//            精炼等级取档判定升阶（白→蓝→紫→橙 ↔ None→D→C→B）；升阶成功收取
//            官方 Etel 宝石兑换价（10万/20万/30万），失败不收
//    isEnchantable(equipDef) → boolean（武器/防具/饰品均可，时装不可）
//  数据流：UI → EventBus('ui:enchant-item') → init.js → 本 Service → Repository/Context
//  持久化：装备实例 enchant 字段 { city, level, affixId, quality }，随背包 v3 存档，无新键
//  组织约定：与 RefineService 同构（Config + Service + getEquipBonuses 接缝）；
//          将来的多词条槽（maxSlot>1）、洗练材料按 RefineService 先例扩展
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        if (global.AccessControl) {
            global.AccessControl.register('enchant:perform', ['EnchantService', 'init', 'GMConsole']);
        }
        console.log('[EnchantService] ✅ 已加载（附魔子系统：城市词条池 + 官方品阶升阶制，配置驱动）');
        return true;
    }

    // ============================================================
    //  纯函数：附魔加成计算（属性管线唯一接缝）
    //  enchant = { level, affixId, quality }（无字段视为未附魔）
    //  返回 { attrs, raceAddDamage }：attrs 平铺进 bonuses，raceAddDamage 进 modifiers
    // ============================================================
    function getEnchantBonus(equipDef, enchant) {
        var result = { attrs: {}, raceAddDamage: {} };
        var cfg = global.EnchantConfig;
        if (!cfg || !enchant || !enchant.level || !enchant.affixId || !enchant.quality) return result;
        var def = cfg.affixes[enchant.affixId];
        if (!def) return result;

        var mult = cfg.qualityMult[enchant.quality] || cfg.qualityMult['白'];
        var value = Math.floor(def.perLevel * enchant.level * mult);

        if (def.type === 'attr') {
            result.attrs[def.attr] = (result.attrs[def.attr] || 0) + value;
        } else if (def.type === 'raceAdd') {
            result.raceAddDamage[def.race] = (result.raceAddDamage[def.race] || 0) + value;
        }
        return result;
    }

    // ---- 可附魔判定：装备类（时装除外） ----
    function isEnchantable(equipDef) {
        if (!equipDef) return false;
        if (equipDef.Type !== 'Weapon' && equipDef.Type !== 'Armor' && equipDef.Type !== 'Equip') return false;
        // 时装（Costume_* 槽位）不可附魔
        if (equipDef.Locations) {
            var keys = Object.keys(equipDef.Locations);
            for (var i = 0; i < keys.length; i++) {
                if (keys[i].indexOf('Costume_') === 0) return false;
            }
        }
        return true;
    }

    // ============================================================
    //  目标定位（与 RefineService 同构）：{ slot } 或 { stackKey } → 活引用
    // ============================================================
    function _locate(target) {
        var repo = global.InventoryRepository;
        if (!repo || !target) return null;

        if (target.slot) {
            var equipped = repo.getRaw().equipped || {};
            var entry = equipped[target.slot];
            if (!entry) return null;
            var def = global.ItemDataGateway ? global.ItemDataGateway.getById(entry.templateId) : null;
            return { kind: 'equipped', slot: target.slot, entry: entry, def: def };
        }
        if (target.stackKey) {
            var stack = repo.getRaw().stacks && repo.getRaw().stacks[target.stackKey];
            if (!stack) return null;
            var def2 = global.ItemDataGateway ? global.ItemDataGateway.getById(stack.templateId) : null;
            return { kind: 'stack', key: target.stackKey, entry: stack, def: def2 };
        }
        return null;
    }

    // ---- 从城市池随机词条（均匀——官方属性珠池 6 属等概率佐证） ----
    function _rollAffix(cfg, city) {
        var pool = cfg.cityPools[city] || cfg.cityPools.prontera;
        var id = pool[Math.floor(Math.random() * pool.length)];
        return id;
    }

    // ---- 官方品阶升阶判定（只升不降）：当前品阶 → 下一阶，按装备精炼等级取档 ----
    //  返回 { quality, changed, fee, chance }（fee = 升阶成功时收取的官方 Etel 兑换价）
    function _gradeStep(cfg, refineLevel, curLabel) {
        var curIdx = -1;
        for (var i = 0; i < cfg.grades.length; i++) {
            if (cfg.grades[i].label === curLabel) { curIdx = i; break; }
        }
        if (curIdx < 0 || curIdx >= cfg.grades.length - 1) {
            return { quality: curLabel || '白', changed: false, fee: 0, chance: 0 };
        }
        var next = cfg.grades[curIdx + 1];
        var chance = cfg.getUpgradeChance(next.label, refineLevel);
        if (chance > 0 && Math.random() < chance) {
            return { quality: next.label, changed: true, fee: next.fee, chance: chance };
        }
        return { quality: curLabel || '白', changed: false, fee: 0, chance: chance };
    }

    // ============================================================
    //  附魔信息（UI 确认弹窗数据源）
    // ============================================================
    function getEnchantInfo(target, city) {
        var cfg = global.EnchantConfig;
        if (!cfg) return { ok: false, message: '附魔配置未加载' };
        var loc = _locate(target);
        if (!loc) return { ok: false, message: '装备不存在' };
        if (!loc.def || !isEnchantable(loc.def)) return { ok: false, message: '该物品不可附魔' };

        city = cfg.cityPools[city] ? city : 'prontera';
        var en = loc.entry.enchant || { level: 0 };
        var level = en.level || 0;
        if (level >= cfg.maxLevel) return { ok: false, level: level, message: '已达附魔等级上限 Lv.' + cfg.maxLevel };

        var cityName = { prontera: '普隆德拉（基础属性）', morroc: '梦罗克（攻击进阶）', payon: '斐扬（种族增伤）' }[city] || city;
        var curLabel = en.quality || '白';
        // 下一阶升阶概率与费用预览（实际判定在洗练时进行）
        var nextGrade = null, upgradeChance = 0, gradeFee = 0;
        for (var i = 0; i < cfg.grades.length - 1; i++) {
            if (cfg.grades[i].label === curLabel) {
                nextGrade = cfg.grades[i + 1];
                upgradeChance = cfg.getUpgradeChance(nextGrade.label, loc.entry.refine || 0);
                gradeFee = nextGrade.fee;
                break;
            }
        }
        return {
            ok: true,
            level: level,
            nextLevel: level + 1,
            city: city,
            cityName: cityName,
            zeny: cfg.zenyCost(level),
            gradeFee: gradeFee,
            upgradeChance: upgradeChance,
            nextGradeLabel: nextGrade ? nextGrade.label : null,
            current: en.affixId ? { id: en.affixId, name: cfg.affixes[en.affixId].name, quality: en.quality } : null,
            previewPoolSize: cfg.cityPools[city].length,
            isEquipped: loc.kind === 'equipped',
            slot: loc.slot,
            stackKey: loc.key,
        };
    }

    // ============================================================
    //  洗练执行（查表 → 升阶判定 → 扣费 → 重掷词条 → 等级+1 → 返回结果）
    //  等级必 +1（永不降级）；随机性在词条（均匀重掷）与品阶（官方概率升阶）上
    // ============================================================
    function enchant(target, city, caller) {
        if (global.AccessControl && !global.AccessControl.check('enchant:perform', caller || 'EnchantService')) {
            return { success: false, message: '权限不足' };
        }
        var cfg = global.EnchantConfig;
        var repo = global.InventoryRepository;
        if (!cfg || !repo) return { success: false, message: '附魔系统未加载' };

        var loc = _locate(target);
        if (!loc) return { success: false, message: '装备不存在' };
        if (!loc.def || !isEnchantable(loc.def)) return { success: false, message: '该物品不可附魔' };

        city = cfg.cityPools[city] ? city : 'prontera';
        var en = loc.entry.enchant || { level: 0 };
        var level = en.level || 0;
        if (level >= cfg.maxLevel) return { success: false, message: '已达附魔等级上限 Lv.' + cfg.maxLevel };

        // ---- 先判定后扣费：词条重掷 + 官方品阶升阶判定（按装备精炼等级取档） ----
        var affixId = _rollAffix(cfg, city);
        var step = _gradeStep(cfg, loc.entry.refine || 0, en.quality || '白');
        var newLevel = level + 1;
        var baseZeny = cfg.zenyCost(level);
        var totalZeny = baseZeny + (step.changed ? step.fee : 0);

        // ---- 扣 Zeny（经 CharacterContext，权限表已放行 EnchantService） ----
        if (totalZeny > 0) {
            var ctx = global.CharacterContext;
            if (!ctx || !ctx.deductZeny(totalZeny, 'EnchantService')) {
                return { success: false, message: 'Zeny 不足（需 ' + totalZeny + '）' };
            }
        }

        function _writeEnchant() {
            // entry 为 getRaw() 活引用（已装备/背包两种来源一致），mutate 后统一落盘
            loc.entry.enchant = { city: city, level: newLevel, affixId: affixId, quality: step.quality };
            repo.save();
        }
        _writeEnchant();

        var changed = !en.affixId || en.affixId !== affixId;
        _invalidate('enchant', { slot: loc.slot, stackKey: loc.key, level: newLevel });
        _emit('enchant:changed', { level: newLevel, affixId: affixId, quality: step.quality,
            qualityChanged: step.changed, slot: loc.slot, stackKey: loc.key });

        var msg = '附魔成功：Lv.' + newLevel + '「' + cfg.affixes[affixId].name + '（' + step.quality + '）」';
        if (step.changed) msg += '，品阶提升至' + step.quality + '（' + step.fee + ' Zeny）！';

        return {
            success: true,
            level: newLevel,
            affix: { id: affixId, name: cfg.affixes[affixId].name, quality: step.quality },
            qualityChanged: step.changed,
            cost: { zeny: totalZeny, gradeFee: step.changed ? step.fee : 0 },
            changed: changed,
            message: msg,
        };
    }

    function _invalidate(source, payload) {
        if (global.CharacterContext) {
            global.CharacterContext.applyModifier(source, payload, 'EnchantService');
        }
    }

    function _emit(evt, payload) {
        if (_bus || global.EventBus) (_bus || global.EventBus).emit(evt, payload);
    }

    var EnchantService = {
        init: init,
        getEnchantBonus: getEnchantBonus,
        getEnchantInfo: getEnchantInfo,
        isEnchantable: isEnchantable,
        enchant: enchant,
    };

    global.EnchantService = EnchantService;
})(window);

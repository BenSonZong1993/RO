// ============================================================
//  FILE: SkillProcessor.js
//  LAYER: processors（被动技能加成处理器——由 AttributeMediator 调度）
//  权限：无（只读计算，输出标准化修正对象）
//  依赖：SkillGateway（被动数据唯一入口：getSkillByAegis/getApplyFlags）、ArithmeticCore
//  契约：process(char) → { type, priority, modifications, metadata }
//  规则：GATE-1 —— 数据读取全部经 SkillGateway（蓝图 3.3：SkillProcessor 只做
//        加成转换，数据读取由网关负责）
// ============================================================
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[SkillProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    // ---- 硬编码回退映射（每级加成值；SkillData 无 Passive/ApplyFlags 时使用） ----
    var FALLBACK_BONUS_MAP = {
        // 剑士系
        'SM_SWORD': { atk: 4 },
        'SM_TWOHAND': { atk: 4 },
        'KN_SPEARMASTERY': { atk: 4 },
        // 弓箭手系
        'AC_VULTURE': { hit: 2, attackRange: 1 },
        'AC_OWL': { dex: 1 },
        // 盗贼系
        'TF_DOUBLE': { flee: 2 },
        'AS_KATAR': { atk: 3 },
        // 商人系
        'MC_INCCARRY': { maxHp: 20 },
        'BS_WEAPONRESEARCH': { atk: 2 },
        // 法师系
        'MG_SRECOVERY': { spRegen: 3 },
        // 服事系
        'AL_DP': { def: 1 },
        'AL_DEMONBANE': { atk: 4 },
        // 猎人
        'HT_BEASTBANE': { atk: 4 },
        // 刺客
        'ASC_KATAR': { crit: 5 },
        // 扩展职业
        'RA_RANGERMAIN': { atk: 5 },
        'NC_RESEARCHFE': { atk: 10 },
        'NC_MADOLICENCE': { atk: 15 },
        'GN_TRAINING_SWORD': { atk: 10 },
        'AM_AXEMASTERY': { atk: 3 },
        'MO_IRONHAND': { atk: 3 },
        'BA_MUSICALLESSON': { atk: 3 },
        'DC_DANCINGLESSON': { atk: 3 },
        'SA_ADVANCEDBOOK': { atk: 3 },
        'PR_MACEMASTERY': { atk: 3 },
    };

    var SkillProcessor = {

        process: function(char) {
            var result = {
                type: 'skill',
                priority: 90,
                source: 'learnedSkills',
                modifications: {},
                metadata: {
                    activeSkills: [],
                    appliedFrom: 'fallback',
                },
            };

            if (!char || !char.learnedSkills) {
                return result;
            }

            var learned = char.learnedSkills;

            for (var skillName in learned) {
                if (!learned.hasOwnProperty(skillName)) continue;
                var skillLevel = learned[skillName] || 0;
                if (skillLevel <= 0) continue;

                var applyFlags = null;
                var appliedFrom = 'fallback';

                // ---- 1. 经 SkillGateway 读取被动定义（唯一数据入口） ----
                var skillDef = global.SkillGateway ? global.SkillGateway.getSkillByAegis(skillName) : null;
                if (skillDef) {
                    if (skillDef.Passive === true && skillDef.ApplyFlags) {
                        applyFlags = skillDef.ApplyFlags;
                        appliedFrom = 'SkillGateway';
                    }
                }

                // ---- 2. 网关未提供 → 回退硬编码映射（兼容旧数据） ----
                if (!applyFlags) {
                    var fallback = FALLBACK_BONUS_MAP[skillName];
                    if (fallback) {
                        applyFlags = fallback;
                        appliedFrom = 'fallback';
                    }
                }

                if (!applyFlags) continue;

                // ---- 应用加成（支持每级递增） ----
                for (var attr in applyFlags) {
                    if (!applyFlags.hasOwnProperty(attr)) continue;
                    var valueDef = applyFlags[attr];
                    var total = 0;

                    if (typeof valueDef === 'number') {
                        total = valueDef * skillLevel;
                    } else if (typeof valueDef === 'object' && valueDef !== null) {
                        var perLevel = valueDef.perLevel || 0;
                        var base = valueDef.base || 0;
                        total = base + perLevel * skillLevel;
                    } else {
                        continue;
                    }

                    this._applyBonus(result.modifications, attr, total, skillName);
                }

                result.metadata.activeSkills.push({
                    name: skillName,
                    level: skillLevel,
                    appliedFrom: appliedFrom,
                });
            }

            return result;
        },

        // ---- 核心加成应用函数（扩展版，逻辑与 v3.0 一致） ----
        _applyBonus: function(mods, attr, value, skillName) {
            var sourceTag = 'skill:' + skillName;

            switch (attr) {
                // ----- 元素抗性 -----
                case 'resistFire':
                case 'resistNeutral':
                case 'resistHoly':
                case 'resistWater':
                case 'resistEarth':
                case 'resistWind':
                case 'resistPoison':
                case 'resistDark':
                case 'resistGhost':
                case 'resistUndead':
                    mods._resistances = mods._resistances || {};
                    var elemName = attr.replace('resist', '');
                    mods._resistances[elemName] = (mods._resistances[elemName] || 0) + value;
                    return;

                // ----- 种族增伤（复合键拆分） -----
                case 'atk_vs_animal_insect':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Animal'] = (mods.raceAddDamage['Animal'] || 0) + value;
                    mods.raceAddDamage['Insect'] = (mods.raceAddDamage['Insect'] || 0) + value;
                    return;
                case 'atk_vs_demon_undead':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Demon'] = (mods.raceAddDamage['Demon'] || 0) + value;
                    mods.raceAddDamage['Undead'] = (mods.raceAddDamage['Undead'] || 0) + value;
                    return;
                case 'atk_vs_plant':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Plant'] = (mods.raceAddDamage['Plant'] || 0) + value;
                    return;
                case 'atk_vs_brute':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Brute'] = (mods.raceAddDamage['Brute'] || 0) + value;
                    return;
                case 'atk_vs_fish':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Fish'] = (mods.raceAddDamage['Fish'] || 0) + value;
                    return;
                case 'atk_vs_insect':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Insect'] = (mods.raceAddDamage['Insect'] || 0) + value;
                    return;
                case 'atk_vs_human':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Human'] = (mods.raceAddDamage['Human'] || 0) + value;
                    return;
                case 'atk_vs_demon':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Demon'] = (mods.raceAddDamage['Demon'] || 0) + value;
                    return;
                case 'atk_vs_undead':
                    mods.raceAddDamage = mods.raceAddDamage || {};
                    mods.raceAddDamage['Undead'] = (mods.raceAddDamage['Undead'] || 0) + value;
                    return;

                // ----- 种族防御 -----
                case 'def_vs_demon_undead':
                    mods.raceDefense = mods.raceDefense || {};
                    mods.raceDefense['Demon'] = (mods.raceDefense['Demon'] || 0) + value;
                    mods.raceDefense['Undead'] = (mods.raceDefense['Undead'] || 0) + value;
                    return;

                // ----- 特殊功能字段 -----
                case 'weightLimit':
                    mods.weightLimit = (mods.weightLimit || 0) + value;
                    return;
                case 'discount':
                case 'overcharge':
                    mods._shopModifier = mods._shopModifier || {};
                    mods._shopModifier[attr] = (mods._shopModifier[attr] || 0) + value;
                    return;
                case 'falconDamage':
                    mods.falconDamage = (mods.falconDamage || 0) + value;
                    return;
                case 'potionEffect':
                    mods.potionEffect = (mods.potionEffect || 0) + value;
                    return;
                case 'msp':
                    mods.maxSpRate = (mods.maxSpRate || 0) + value * 100;
                    return;
                case '':
                case undefined:
                    return;
            }

            // ---- 常规字段走 fieldMap ----
            var fieldMap = {
                'str': 'stat_str', 'agi': 'stat_agi', 'vit': 'stat_vit',
                'int': 'stat_int', 'dex': 'stat_dex', 'luk': 'stat_luk',
                'atk': 'equipATK', 'matk': 'matk', 'def': 'def', 'mdef': 'mdef',
                'maxHp': 'maxHp', 'maxSp': 'maxSp',
                'hit': 'hit', 'flee': 'flee', 'crit': 'crit',
                'spRegen': 'spRegen', 'hpRegen': 'hpRegen',
                'attackRange': 'attackRange', 'attackSpeed': 'aspd',
                'atkPercent': 'atkPercent', 'defPercent': 'defPercent',
                'mdefPercent': 'mdefPercent', 'maxHpRate': 'maxHpRate', 'maxSpRate': 'maxSpRate',
                'hitPercent': 'hitPercent', 'fleePercent': 'fleePercent',
                'castReductionPercent': 'castReductionPercent',
                'fixedCastReduction': 'fixedCastReduction',
                'elementalAddDamage': 'elementalAddDamage',
            };

            var targetField = fieldMap[attr];
            if (targetField) {
                if (typeof value === 'object' && value !== null) {
                    if (!mods[targetField]) mods[targetField] = {};
                    for (var k in value) {
                        if (value.hasOwnProperty(k)) {
                            mods[targetField][k] = (mods[targetField][k] || 0) + value[k];
                        }
                    }
                } else {
                    mods[targetField] = (mods[targetField] || 0) + value;
                }
                if (!mods._sources) mods._sources = {};
                if (!mods._sources[targetField]) mods._sources[targetField] = [];
                mods._sources[targetField].push(sourceTag + '=' + value);
            }
        },
    };

    global.SkillProcessor = SkillProcessor;
    console.log('[SkillProcessor] ✅ 已加载（v4.0：数据读取经 SkillGateway）');
})(window);

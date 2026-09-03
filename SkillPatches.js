// ============================================================
//  📁 js/config/SkillPatches.js
//  L2 - 技能专属补丁（最高优先级）+ 特殊机制配置层
//  用途：键为 AegisName，值为覆盖字段对象；mechanism 字段声明特殊机制，
//        由 SkillExecutor（执行期效果）与 SkillTriggerManager（事件触发）消费。
//
//  维护原则（蓝图规则 MECH-1）：
//    机制配置驱动，禁止硬编码进战斗核心；
//    BattleController 只保留 additive guard（霸体防打断一处）。
//
//  mechanism 字段速查：
//    'taunt'        强制目标攻击自己（配合 MonsterAI 仇恨）
//    'endure'       霸体：持续时间内咏唱不受受伤打断（SkillRuntime 运行时标志）
//    'sp_drain'     伤害按比例恢复自身 SP（spDrainPercent）
//    'zeny_cost'    施放消耗 Zeny（zenyCostPerLevel × 技能级）
//    'true_damage'  无视防御的伤害（直接倍率计算，不走防御减免）
//    'ultimate'     终极爆发：消耗全部 SP（spDamageFactor × 消耗量转化为伤害加成）
//    'ground'       地面持续效果（GroundEffectManager：位置/时长/tick 间隔/范围伤害与治疗）
//    'combo'        连击链（comboNext：本技能命中后强制锁定下一个技能）
//    'dual_wield'   双持伤害惩罚（hand + restoreRate 数组，由 EquipService 读取）
//
//  其他可用字段：
//    status         施加的状态名（覆盖 L0 数据）
//    statusChance   状态几率（0~1，覆盖占位公式）
//    healPercent    NoDamage 治疗技的治疗比例（MaxHP × n）
//    reflectPercent 反射：受击时把伤害的 n% 返回攻击者（SkillTriggerManager 消费）
//    onKillHealPercent    击杀敌人后恢复 MaxHP 的 n%（SkillTriggerManager 消费）
//    proc           普攻概率触发（SkillTriggerManager 消费）：{ chance, extraHits }
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  双持配置（提供给 EquipService 使用）
    //  手部恢复率数组：索引 = 技能等级（0~5），值 = 伤害保留比例（百分比小数）
    // ============================================================
    const DUAL_WIELD_CONFIG = {
        'AS_LEFT': {
            mechanic: 'dual_wield',
            dual_wield: {
                hand: 'left',
                restoreRate: [0, 0.4, 0.5, 0.6, 0.7, 0.8]   // 等级0~5
            }
        },
        'AS_RIGHT': {
            mechanic: 'dual_wield',
            dual_wield: {
                hand: 'right',
                restoreRate: [0, 0.6, 0.7, 0.8, 0.9, 1.0]  // 等级0~5
            }
        }
    };

    // ============================================================
    //  其他技能补丁
    // ============================================================
    const SKILL_PATCHES = {
        // ---------- 剑士系 ----------
        // 挑衅：强制目标攻击自己（坦克核心）
        'SM_PROVOKE': {
            mechanism: 'taunt',
            tauntMs: 10000,
        },
        // 霸体：咏唱不受受伤打断（简化：按时长，未实现 7 次受击上限）
        // + 状态挂载（Endure：功能状态，Mdef/Dspd 走 CalcFlags；免疫击退经 SkillRuntime.setEndure）
        'SM_ENDURE': {
            mechanism: 'endure',
            endureMs: 10000,
            status: 'Endure',
            statusTarget: 'self',
            statusDurationMs: 10000,
        },

        // ---------- 商人系 ----------
        // 金钱攻击：消耗 Zeny 强化伤害
        'MC_MAMMONITE': {
            mechanism: 'zeny_cost',
            zenyCostPerLevel: 100,
        },

        // ---------- 魔法师系 ----------
        // 吸魂术：伤害的 50% 转为自身 SP
        'HW_SOULDRAIN': {
            mechanism: 'sp_drain',
            spDrainPercent: 0.5,
        },

        // ---------- 服事系 ----------
        // 光耀之堂：地面持续效果
        'PR_SANCTUARY': {
            mechanism: 'ground',
            ground: {
                durationMs: 16000,
                tickMs: 1000,
                radiusCells: 2,
                damageRatioPerTick: 30,      // 每 tick 对怪物的技能倍率（%）
                healPercentPerTick: 0.01,    // 每 tick 恢复 MaxHP 的 1%
                element: 'Holy',
            },
        },

// ---------- 武僧系（连击链 + 终极爆发） ----------
'MO_TRIPLEATTACK': {
    mechanism: 'combo',
    onNormalAttack: {
        type: 'triggerSkill',
        skill: 'MO_TRIPLEATTACK',
        chance: 0.3,            // 30% 官方概率
        comboNext: 'MO_CHAINCOMBO',
        comboWindowMs: 1000,
    }
},
'MO_CHAINCOMBO': {
    mechanism: 'combo',
    requiresComboFrom: 'MO_TRIPLEATTACK',   // 由六合拳触发
    comboNext: 'MO_COMBOFINISH',
    comboWindowMs: 1000,
},
'MO_COMBOFINISH': {
    mechanism: 'combo',
    requiresComboFrom: 'MO_CHAINCOMBO',     // 由连环拳触发
    // 无 comboNext，连招结束
},
'MO_EXTREMITYFIST': {
    mechanism: 'ultimate',
    spDamageFactor: 10,
},



// ---------- 盗贼系 ----------
// 二刀连击（被动）：普攻触发额外一段伤害（与官方一致：概率随等级提升）
'TF_DOUBLE': {
    onNormalAttack: {
        type: 'extraHits',
        chanceFormula: '7 * skill_lv',   // 1级7%，10级70%
        extraHits: 1,
        damageMultiplier: 1.0,           // 额外段100%伤害
        canCrit: false,
        requiresWeapon: ['Dagger'],
        priority: 10,
    },
    ApplyFlags: {
        hit: 1,
    },
},

// 连锁动作（手枪版二刀连击，示例）
'GS_CHAINACTION': {
    onNormalAttack: {
        type: 'extraHits',
        chanceFormula: '5 * skill_lv',   // Lv1=5%, Lv10=50%
        extraHits: 1,
        damageMultiplier: 1.0,
        canCrit: false,
        requiresWeapon: ['Revolver'],
        priority: 10,
    },
},



        // 反射盾（十字军）：受击反射 30% 伤害
        'CR_REFLECTSHIELD': {
            reflectPercent: 0.3,
        },

        // ---------- 状态覆盖示例 ----------
        // 施毒：附加中毒状态（若 L0 数据未带 Status 字段则由此补充）
        'TF_POISON': {
            status: 'Poison',
            statusChance: 0.5,
        },

        // ============================================================
        //  ★ 动态状态技能（生命周期：施放 → status_change_start → 到期 status_change_end）
        //  statusTarget: 'self' = 施法者本人（增益）；缺省 = 目标（如施毒）
        //  statusDurationMs: 持续时间（状态引擎的 timer 到期自动 status_change_end）
        // ============================================================

        // 天赐：STR/DEX/INT +技能等级（CalcFlags 动态公式）+ 攻击侧 H1（STATUS_MODIFIERS.Blessing）
        'AL_BLESSING': {
            status: 'Blessing',
            statusTarget: 'self',
            statusDurationMs: 60000,
        },

        // 涂毒：武器属性转毒（H6 forceElement，经 STATUS_MODIFIERS.Encpoison）
        'AS_ENCHANTPOISON': {
            status: 'Encpoison',
            statusTarget: 'self',
            statusDurationMs: 60000,
        },

        // 风之步：Flee/Speed 提升（CalcFlags → StatusProcessor，九孔外）
        'SN_WINDWALK': {
            status: 'Windwalk',
            statusTarget: 'self',
            statusDurationMs: 60000,
        },

        // 速度激发：ASPD/Hit 提升（CalcFlags → StatusProcessor，九孔外；与风之步可叠加）
        'BS_ADRENALINE': {
            status: 'Adrenaline',
            statusTarget: 'self',
            statusDurationMs: 60000,
        },

        // ============================================================
        //  ★ 加成插入点系统（BonusCollector 消费，孔位 H1~H9）
        //  modifiers: [{ hook, condition, value, valuePerLevel, valueType }]
        //    - 熟练度类被动：SKILL_PATCHES 声明（condition 限定武器系列）
        //    - 状态类（涂毒等）：生效期间由状态系统写入 global.ACTIVE_SKILL_MODIFIERS
        //  valueType 语义：flat=Σ直加 / percent=Σ百分点 / multiplier=Σ加算倍率(1+Σ)
        // ============================================================

        // 单手剑熟练度（H1 baseAtkFlat）：剑系列武器时 +4/级 ATK（Lv10 = +40）
        'SM_SWORD': {
            modifiers: [
                {
                    hook: 'baseAtkFlat',
                    condition: { type: 'weaponSeries', values: ['Sword'] },
                    value: 4,
                    valuePerLevel: 4,
                    valueType: 'flat',
                },
            ],
        },

        // 拳刃修炼（H5 critMultiplier）：拳刃系列时暴击倍率 +0.2（即爆伤 +20% 基数）
        'AS_KATAR': {
            modifiers: [
                {
                    hook: 'critMultiplier',
                    condition: { type: 'weaponSeries', values: ['Katar'] },
                    value: 0.2,
                    valueType: 'multiplier',
                },
            ],
        },

        // 十字驱魔（H8 raceModifier）：目标为不死系时倍率 +1.0（+100%）
        'PR_MAGNUS': {
            modifiers: [
                {
                    hook: 'raceModifier',
                    condition: { type: 'targetRace', values: ['Undead'] },
                    value: 1.0,
                    valueType: 'multiplier',
                },
            ],
        },
        // 涂毒（H6 forceElement）为状态类加成：不在此声明！
        // 生效期间由状态系统 push 到 global.ACTIVE_SKILL_MODIFIERS：
        //   { source: 'AS_ENCHANTPOISON', skillLevel: n, modifiers: [
        //       { hook: 'forceElement', value: 'Poison' } ] }
    };

    // ============================================================
    //  ★ 动态状态加成配置（rAthenaStatus 消费）
    //  键 = STATUS_DATA 的 Status 名（SC_NAMES 的字符串形式，无 SC_ 前缀）
    //  状态 start → 推入 global.ACTIVE_SKILL_MODIFIERS；end/覆盖 → 移除
    //  BonusCollector 消费 ACTIVE_SKILL_MODIFIERS 映射九孔
    //  注意：
    //    - 属性类状态（Blessing 的 Str/Int/Dex、Windwalk 的 Flee、Adrenaline 的 Aspd）
    //      其 CalcFlags 已由 StatusProcessor → AttributeMediator 属性管线消费（九孔外）；
    //      此处只声明需要进九孔的攻击侧加成。
    //    - 纯功能状态（Endure）不需要 modifiers → 不在此登记（霸体由 mechanism:'endure' 处理）。
    // ============================================================
    const STATUS_MODIFIERS = {
        // 天赐：属性 +技能等级（StatusProcessor 动态公式），攻击侧经 H1 体现
        'Blessing': [
            { hook: 'baseAtkFlat', value: 5, valueType: 'flat' },
        ],
        // 涂毒：武器属性强制转为毒（H6）
        'Encpoison': [
            { hook: 'forceElement', value: 'Poison' },
        ],
        // 风之步 / 速度激发：Flee/Speed/Aspd 走 CalcFlags → StatusProcessor（九孔外），不在此登记
        // 霸体 Endure：功能状态（免疫击退经 SkillRuntime.setEndure），不在此登记
    };
    global.STATUS_MODIFIERS = STATUS_MODIFIERS;

    // ============================================================
    //  合并双持配置到主补丁对象（避免覆盖同名技能）
    // ============================================================
    for (var key in DUAL_WIELD_CONFIG) {
        if (DUAL_WIELD_CONFIG.hasOwnProperty(key)) {
            if (SKILL_PATCHES[key]) {
                // 如果已有同名补丁，合并 dual_wield 字段（保留其他字段）
                SKILL_PATCHES[key].dual_wield = DUAL_WIELD_CONFIG[key].dual_wield;
                if (!SKILL_PATCHES[key].mechanic) {
                    SKILL_PATCHES[key].mechanic = 'dual_wield';
                }
            } else {
                SKILL_PATCHES[key] = DUAL_WIELD_CONFIG[key];
            }
        }
    }

    global.SKILL_PATCHES = SKILL_PATCHES;
    console.log('[SkillPatches] ✅ 已加载 ' + Object.keys(SKILL_PATCHES).length + ' 个技能补丁（含特殊机制配置）');
})(window);
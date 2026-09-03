//  ═════════════════════════════════════════════════════════════
//  【配表字段说明】（图形化工具可解析此注释区块）
//  ═════════════════════════════════════════════════════════════
//  ┌─────────────────────────────────────────────────────────────┐
//  │ 一级节点   二级节点      类型    说明                      │
//  ├─────────────────────────────────────────────────────────────┤
//  │ char       atk          float   角色攻击倍率 (1.0=100%)   │
//  │ char       def          float   角色防御倍率               │
//  │ char       aspd         float   角色攻速倍率 (影响攻击间隔)│
//  │ char       expGain      float   经验获取倍率               │
//  │ char.regen mode         string  恢复模式: smooth/pulse     │
//  │ char.regen hpInterval   number  pulse模式HP间隔(秒)       │
//  │ char.regen spInterval   number  pulse模式SP间隔(秒)       │
//  │ char.regen combatPenalty number  战斗中恢复折扣(0~1)      │
//  │ char.battle preRatio    number  攻击前摇占比(0~1)         │
//  │ char.battle postRatio   number  攻击后摇占比(0~1)         │
//  │ char.battle defaultGcd  number  技能公共延迟(秒)          │
//  │ char.battle minInterval number  最小攻击间隔(秒)          │
//  │ char.battle maxInterval number  最大攻击间隔(秒)          │
//  │ char.battle critChance  float   基础暴击率                │
//  │ char.battle interruptCD  number  受击打断冷却(秒)         │
//  │ char.battle dmgScaleMonster number  怪物受击数字缩放      │
//  │ char.battle dmgScalePlayer number  玩家受击数字缩放       │
//  │ char.skillAction ★新增   object  技能动作时间参数         │
//  │   ├─ basePre            number  基础前摇(秒)              │
//  │   ├─ basePost           number  基础后摇(秒)              │
//  │   ├─ weightFactor       number  每单位重量增加前摇(秒)    │
//  │   ├─ agiReduction       number  每点AGI减少前摇(秒)       │
//  │   ├─ levelPreReduction  number  每级技能减少前摇(秒)      │
//  │   ├─ aspdReduction      number  攻速最大缩减值(秒)        │
//  │   ├─ spCostFactor       number  每点SP消耗增加后摇(秒)    │
//  │   ├─ powerFactor        number  每1%倍率增加后摇(秒)      │
//  │   ├─ dexReduction       number  每点DEX减少后摇(秒)       │
//  │   ├─ levelPostReduction number  每级技能减少后摇(秒)      │
//  │   ├─ maxInterval        number  归一化最大间隔(秒)        │
//  │   ├─ minPre             number  前摇最小保底(秒)          │
//  │   ├─ maxPre             number  前摇最大限制(秒)          │
//  │   ├─ minPost            number  后摇最小保底(秒)          │
//  │   ├─ maxPost            number  后摇最大限制(秒)          │
//  │   ├─ minTotal           number  总时间最小保底(秒)        │
//  │   └─ maxTotal           number  总时间最大限制(秒)        │
//  │ monster    hp           float   怪物HP倍率                 │
//  │ monster    atk          float   怪物攻击倍率               │
//  │ monster    def          float   怪物防御倍率               │
//  │ monster    exp          float   怪物基础经验倍率           │
//  │ monster    jobExp       float   怪物职业经验倍率           │
//  │ monster.wave interval   number  波次间隔(秒)              │
//  │ monster.wave sizeMin    number  波次最小怪物数            │
//  │ monster.wave sizeMax    number  波次最大怪物数            │
//  │ monster.ai  chaseRange  number  索敌范围(像素)            │
//  │ monster.ai  moveSpeed   number  移动速度(像素/秒)         │
//  │ monster.ai  returnSpeed number  归位速度(像素/秒)         │
//  │ monster.ai  wanderRadius number  闲逛半径(像素)           │
//  │ monster.ai  chaseMult   float   追击速度倍率               │
//  │ monster.ai  attackRange number  攻击距离(像素)            │
//  │ monster.ai  attackInterval number  攻击间隔(秒)           │
//  │ drop       rate         float   掉落几率倍率               │
//  │ drop       amount       float   掉落数量倍率               │
//  │ flags      isPermaDeath boolean 是否为永久死亡模式         │
//  │ flags      respawnMap   string  死亡后传送回的地图ID       │
//  │ engine     minDamage    number  最小伤害保底值             │
//  │ engine     renewal      boolean 是否启用Renewal公式        │
//  └─────────────────────────────────────────────────────────────┘
//  ============================================================
// ============================================================
//  📁 js/config/ConfigProfiles.js
//  功能：全局游戏模式配置中心（图层系统）
//  说明：所有数值参数在此集中管理，业务代码通过 ConfigProfileManager 读取
//  暴露：global.ConfigProfiles.getProfile(modeName)
// ============================================================

(function(global) {
    'use strict';

// ============================================================
//  ★ RO 物理常量（逻辑与渲染分离，唯一维护点） ★
// ============================================================
if (!window.RO_CONSTANTS) {
    window.RO_CONSTANTS = {
        // 逻辑距离：1 格 = 64 像素（改动此值，攻击/射程/索敌全部同步）
        PIXELS_PER_CELL: 64,
        // 渲染瓦片：默认与逻辑保持同步，但可独立调整
        TILE_BASE_SIZE: 64,
        // 后备默认值（防止 undefined 导致 NaN）
        DEFAULT_ATTACK_RANGE: 64,
        DEFAULT_SKILL_RANGE: 64,
    };
}
    // ---- 底层完整基准配置（仅保留实际使用的字段） ----
    var DEFAULT_PROFILE = {
        char: {
            atk: 1.0,
            def: 1.0,
            aspd: 1.0,
            expGain: 1.0,
            regen: {
                mode: 'smooth',
                hpInterval: 6,
                spInterval: 8,
                combatPenalty: 0.5,
            },
            battle: {
                attackPreRatio: 0.25,
                attackPostRatio: 0.75,
                defaultGcd: 0.2,
                minAttackInterval: 0.14,
                maxAttackInterval: 2.0,
                critChance: 0.1,
                interruptCooldown: 2.0,
                damageScaleMonster: 1.5,
                damageScalePlayer: 1.0,
                            // ★★★ 新增：技能范围调节（仅影响技能，不影响普攻和怪物索敌） ★★★
            skillCastRangeMultiplier: 1.0,   // 施法距离倍率（推荐 0.8 ~ 1.5）
            skillSplashAreaMultiplier: 1.8,  // 溅射半径倍率（这就是你要的“一窝端”开关）
            },
            skillAction: {
                basePre: 0.10,
                basePost: 0.15,
                weightFactor: 0.002,
                agiReduction: 0.0008,
                levelPreReduction: 0.001,
                aspdReduction: 0.12,
                spCostFactor: 0.0015,
                powerFactor: 0.0003,
                dexReduction: 0.0008,
                levelPostReduction: 0.001,
                maxInterval: 2.0,
                minPre: 0.05,
                maxPre: 0.40,
                minPost: 0.05,
                maxPost: 0.80,
                minTotal: 0.10,
                maxTotal: 1.20,
            },
            formula: {
                vitCoef: 0.2,
                mhpCoef: 0.005,
                intCoef: 0.1667,
                mspCoef: 0.01,
                bonusInt: 120,
                bonusAdd: 4,
                bonusPer: 0.5
            },
            // ---- 玩家碰撞独立配置 ----
            collision: {
                radiusPx: 18,
            }
        },
        monster: {
            hp: 1.0,
            atk: 1.0,
            def: 1.0,
            exp: 1.0,
            jobExp: 1.0,
            // ---- 波次节奏（仅控制间隔和数量） ----
            wave: {
                mode: 0,
                sizeMin: 1,
                sizeMax: 4,
                interval: 0.5,
                enabled: true,
            },
            // ---- 怪物战斗行为（生成、移动、碰撞） ----
            formation: {
                // 生成参数
                minRadiusPx: 680,
                maxRadiusPx: 800,
                generationType: 'fan',
                fanAngleDeg: 120,
                spawnBiasAngleDeg: -90,
                clusterSpreadPx: 60,
                // 移动参数
                speedBasePxPerSec: 200,
                speedVariance: 0.25,
                separationForcePx: 40,
                enableSeparation: true,
                // 碰撞参数
                collisionRadiusPx: 18,
                 spreadRadius: 198,   // ★ 新增：提前散开触发距离（像素）
            }
        },
        drop: {
            rate: 1.0,
            amount: 1.0,
        },
        flags: {
            isPermaDeath: false,
            respawnMap: 'prontera',
        },

            // ★ 新增：死亡惩罚配置
    deathPenalty: {
        enabled: true,                // 总开关
        baseExpPercent: 0.20,         // 扣除当前 BASE 经验的百分比（0~1）
        jobExpPercent: 0.25,          // 扣除当前 JOB 经验的百分比
        zenyPercent: 0.01,            // 扣除当前 Zeny 的百分比
        minZeny: 0,                   // 最低保留 Zeny（扣到该值为止）
        maxBaseExpDeduction: 0,       // 单次 BASE 经验扣除上限（0=无上限）
        maxJobExpDeduction: 0,        // 单次 JOB 经验扣除上限
    },

        engine: {
            minDamage: 6,
            renewal: true,
        }
    };

    // ---- 上层覆盖图层（只写差异） ----
    var OVERLAY_PROFILES = {
        'nightmare': {
            monster: {
                hp: 3.0,
                atk: 3.0,
                def: 1.5,
                exp: 2.0,
                jobExp: 2.0,
                wave: { sizeMin: 2, sizeMax: 6, interval: 0.3 },
                formation: {
                    minRadiusPx: 500,
                    maxRadiusPx: 700,
                    fanAngleDeg: 100,
                }
            },
            drop: { rate: 1.2 },
            flags: { respawnMap: 'prt_sewb1' }
        },
        'event_dungeon': {
            char: {
                aspd: 1.2,
                expGain: 2.0,
                battle: { defaultGcd: 0.1, minAttackInterval: 0.14, maxAttackInterval: 2.0 },
                skillAction: { basePre: 0.08, basePost: 0.12 }
            },
            monster: {
                hp: 1.2,
                atk: 1.2,
                exp: 2.5,
                jobExp: 2.5,
                wave: { sizeMin: 3, sizeMax: 8, interval: 0.2 },
                formation: {
                    minRadiusPx: 450,
                    maxRadiusPx: 650,
                    fanAngleDeg: 140,
                    speedBasePxPerSec: 90,
                }
            },
            drop: { rate: 1.5, amount: 1.5 }
        },
        'infinite_tower': {
            char: {
                atk: 1.2,
                def: 0.8,
                aspd: 1.1,
                expGain: 1.5,
                regen: { mode: 'pulse', combatPenalty: 0.4 },
                battle: { attackPreRatio: 0.5, attackPostRatio: 0.5, defaultGcd: 0.3 }
            },
            monster: {
                hp: 1.5,
                atk: 1.5,
                def: 1.2,
                exp: 1.8,
                jobExp: 1.8,
                wave: { sizeMin: 1, sizeMax: 5, interval: 0.4 }
            },
            flags: { isPermaDeath: true, respawnMap: 'prontera' }
        }
    };

    // ---- 深度合并函数 ----
    function mergeDeep(target, source) {
        if (!source) return target;
        var output = {};
        for (var key in target) output[key] = target[key];
        for (var key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!output[key]) output[key] = {};
                output[key] = mergeDeep(output[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    // ---- 获取指定模式的配置（图层覆盖） ----
    function getProfile(modeName) {
        if (!modeName || modeName === 'default') {
            return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
        }
        var overlay = OVERLAY_PROFILES[modeName];
        if (!overlay) return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
        return mergeDeep(JSON.parse(JSON.stringify(DEFAULT_PROFILE)), overlay);
    }

    // ---- 全局其他配置（与模式无关） ----
    var GLOBAL_CONFIG = {
        resetService: {
            freeMaxBaseLevel: 50,
            skillResetZeny: 5000000,
            statResetZeny: 5000000,
        },
        partner: {
            cell: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
            melee: { offsetX: 60, offsetY: 0, partnerWeaponDir: -1, playerWeaponDir: 1 },
            ranged: { offsetX: 0, offsetY: 96, partnerWeaponDir: 0, playerWeaponDir: 0 },
            rangedJobs: ['Mage','Wizard','High_Wizard','Warlock','Arch_Mage','Sage','Professor','Sorcerer','Elemental_Master','Archer','Hunter','Sniper','Ranger','Windhawk','Bard','Clown','Minstrel','Troubadour','Dancer','Gypsy','Wanderer','Trouvere','Acolyte','Priest','High_Priest','Arch_Bishop','Cardinal'],
            rangedWeapons: ['Bow','Staff','Musical','Whip','Book','Revolver'],
        },
        network: {
            enabled: true,
            probeTimeoutMs: 1500,
            retryIntervalMs: 60000,
            // 服务器地址唯一来源：default.network.candidates（此处不再维护任何硬编码 IP）
            candidates: [
                'http://localhost:3000',
            ],
        },
    };

    // ---- 暴露全局配置 ----
    global.ConfigProfiles = {
        getProfile: getProfile,
        getWave: function(modeName) {
            var profile = getProfile(modeName);
            return profile.monster && profile.monster.wave ? profile.monster.wave : null;
        },
        getFormation: function(modeName) {
            var profile = getProfile(modeName);
            return profile.monster && profile.monster.formation ? profile.monster.formation : null;
        },
        global: GLOBAL_CONFIG,
        _default: DEFAULT_PROFILE,
        _overlays: OVERLAY_PROFILES,
    };

    // =============================================================
    //  动态 GlobalExpConfig（CharService 每次读取 baseRate 时实时计算）
    // =============================================================
    (function() {
        function getChar() {
            return window.CharController ? window.CharController.getChar() : null;
        }
        function getMaxLevel(jobKey) {
            return window.CharService ? window.CharService.getMaxLevel(jobKey) : 99;
        }
        function getMaxJobLevel(jobKey) {
            return window.CharService ? window.CharService.getMaxJobLevel(jobKey) : 50;
        }

        function calcRate(level, maxLevel, rebirth, target) {
            if (!level || level < 1) level = 1;
            if (!maxLevel || maxLevel < 1) maxLevel = 99;
            var progress = Math.min(1, (level - 1) / (maxLevel - 1));
            var minRate = 1 + (rebirth || 0) * 0.2;          // 转生因子
            var effectiveTarget = Math.max(target || 10, minRate);
            var rate = minRate + (effectiveTarget - minRate) * Math.pow(progress, 1.8);
            return Math.round(Math.min(effectiveTarget, Math.max(minRate, rate)) * 100) / 100;
        }

        var expObj = {
            get baseRate() {
                try {
                    var char = getChar();
                    if (!char) return 1;
                    var level = char.level || 1;
                    var jobKey = char.jobKey || 'Novice';
                    var rebirth = char.rebirthCount || 0;
                    var maxLevel = getMaxLevel(jobKey);
                    return calcRate(level, maxLevel, rebirth, 10);
                } catch(e) {
                    return 1;
                }
            },
            get jobRate() {
                try {
                    var char = getChar();
                    if (!char) return 1;
                    var jobLevel = char.jobLevel || 1;
                    var jobKey = char.jobKey || 'Novice';
                    var rebirth = char.rebirthCount || 0;
                    var maxJobLevel = getMaxJobLevel(jobKey);
                    return calcRate(jobLevel, maxJobLevel, rebirth, 10);
                } catch(e) {
                    return 1;
                }
            }
        };

        // 直接挂载到全局，覆盖任何已有静态值
        window.GlobalExpConfig = expObj;
        console.log('[ConfigProfiles] ✅ 动态 GlobalExpConfig 已注入');
    })();

    console.log('[ConfigProfiles] ✅ 已加载（图层系统：' + Object.keys(OVERLAY_PROFILES).length + ' 个覆盖模式）');
})(window);
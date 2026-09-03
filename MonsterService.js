// js/services/MonsterService.js
(function(global) {
    'use strict';

    // 直接使用全局 MonsterData，无内部缓存
    function getMonsterData() {
        return global.MonsterData || [];
    }

    function getMonsterById(monsterId) {
        const data = getMonsterData();
        return data.find(m => m.id === monsterId) || null;
    }

    // 全量怪物列表（MonsterData 的唯一合法批量读取入口）
    function getAllMonsters() {
        return getMonsterData();
    }

    // ============================================================
    //  🆕 新增：获取完整显示数据（优先轻量级映射表，回退完整数据）
    // ============================================================
    function getMonsterDisplay(monsterId) {
        // 1. 优先查轻量级映射表
        if (global.MONSTER_DISPLAY_MAP && global.MONSTER_DISPLAY_MAP[monsterId]) {
            return global.MONSTER_DISPLAY_MAP[monsterId];
        }
        // 2. 回退完整数据
        const full = getMonsterById(monsterId);
        if (full) {
            return {
                n: full.name || '',
                c: full.ChineseName || '',
                lv: full.level || 1,
                hp: full.hp || 0,
                be: full.baseExp || 0,
                je: full.jobExp || 0,
                el: full.element || 'Neutral',
                elv: full.elementLevel || 1,
                sz: full.size || 'Medium',
                rc: full.race || 'Formless',
            };
        }
        return null;
    }

    // ============================================================
    //  🆕 修改：获取怪物显示名（优先中文名，回退英文名）
    // ============================================================
    function getMonsterName(monsterId) {
        const display = getMonsterDisplay(monsterId);
        if (display) {
            // 优先返回中文名，若为空则回退英文名
            return display.c || display.n || '未知怪物';
        }
        return '未知怪物';
    }

    // ============================================================
    //  修改：spawnMonsterUnit（返回前应用配置组修正）
    // ============================================================
function spawnMonsterUnit(monsterId, x, y) {
    const template = getMonsterById(monsterId);
    if (!template) {
        console.warn('[MonsterService] 找不到怪物模板:', monsterId);
        return null;
    }

    const hp = template.hp || 100;
    const sp = template.sp || 0;
    const atk = template.attack || 0;
    const matk = template.attack2 || 0;
    const def = template.defense || 0;
    const mdef = template.magicDefense || 0;
    const dex = template.dex || 1;
    const agi = template.agi || 1;
    const walkSpeed = template.walkSpeed || 200;
    const attackDelay = template.attackDelay || 1000;

    // ============================================================
    // ★★★ 统一距离转换：从源数据（格数）转为像素 ★★★
    // ============================================================
    const PIXELS_PER_CELL = (global.SKILL_CONFIG && global.SKILL_CONFIG.PIXELS_PER_CELL) || RO_CONSTANTS.DEFAULT_ATTACK_RANGE;
    const attackRange = (template.attackRange || 1) * PIXELS_PER_CELL;
    const chaseRange = (template.chaseRange || 12) * PIXELS_PER_CELL;

    const baseExp = template.baseExp || 0;
    const jobExp = template.jobExp || 0;
    const drops = template.drops || [];

    const attackInterval = Math.max(0.3, Math.min(3.0, attackDelay / 1000));

    // 构建怪物单位
    let unit = {
        id: 'monster_' + monsterId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: getMonsterName(monsterId),
        level: template.level || 1,
        hp: hp,
        maxHp: hp,
        sp: sp,
        maxSp: sp,
        atk: atk,
        matk: matk,
        def: def,
        mdef: mdef,
        hit: 175 + (template.level || 1) + (template.dex || 0),
        flee: 100 + (template.level || 1) + (template.agi || 0),
        crit: 0,
        // ---- 元素/种族/体型（战斗修正管线的目标侧输入；此前缺失导致克制/种族/体型加成静默失效） ----
        race: template.race || template.Race || 'Formless',
        element: template.element || template.Element || 'Neutral',
        elementLevel: template.elementLevel || template.ElementLevel || 1,
        ElementLevel: template.elementLevel || template.ElementLevel || 1,
        size: template.size || template.Size || 'Medium',
        moveSpeed: walkSpeed,
        attackInterval: attackInterval,
        attackRange: attackRange,          // 像素
        sightRange: chaseRange,            // 像素
        exp: baseExp,
        jobExp: jobExp,
        drops: drops,
        x: x,
        y: y,
        homeX: x,
        homeY: y,
        alive: true,
        visible: true,
        state: 'idle',
        _template: template
    };

    // 应用配置组修正（如果有）
    if (global.ConfigProfileManager) {
        const currentProfile = global.ConfigProfileManager.getCurrentProfile();
        if (currentProfile && currentProfile.monster) {
            const mod = currentProfile.monster;
            if (mod.hp && mod.hp !== 1.0) {
                unit.hp = Math.floor(unit.hp * mod.hp);
                unit.maxHp = Math.floor(unit.maxHp * mod.hp);
            }
            if (mod.atk && mod.atk !== 1.0) {
                unit.atk = Math.floor(unit.atk * mod.atk);
            }
            if (mod.def && mod.def !== 1.0) {
                unit.def = Math.floor(unit.def * mod.def);
            }
            if (mod.exp && mod.exp !== 1.0) {
                unit.exp = Math.floor(unit.exp * mod.exp);
            }
            if (mod.jobExp && mod.jobExp !== 1.0) {
                unit.jobExp = Math.floor(unit.jobExp * mod.jobExp);
            }
            unit._activeProfileId = currentProfile.id;
        }
    }

    unit.sc = new StatusChange();
    return unit;
}

    function spawnBatch(spawnConfigs, width, height) {
        const result = [];
        for (const cfg of spawnConfigs) {
            // 兼容两种字段名
            const monsterId = cfg.monsterId || cfg.mobId;
            const count = cfg.count || cfg.amount || 1;
            const x = cfg.x || 0;
            const y = cfg.y || 0;
            const xs = cfg.xs || 0;
            const ys = cfg.ys || 0;

            if (!monsterId) {
                console.warn('[MonsterService] 刷怪配置缺少 monsterId/mobId:', cfg);
                continue;
            }

            for (let i = 0; i < count; i++) {
                let posX, posY;
                if (x === 0 && y === 0 && xs === 0 && ys === 0) {
                    posX = Math.floor(Math.random() * (width || 1920));
                    posY = Math.floor(Math.random() * (height || 1080));
                } else {
                    posX = x + Math.floor(Math.random() * xs);
                    posY = y + Math.floor(Math.random() * ys);
                }
                const unit = spawnMonsterUnit(monsterId, posX, posY);
                if (unit) {
                    unit.respawnMs = cfg.respawnMs || 5000;
                    unit._spawnConfig = cfg;
                    result.push(unit);
                }
            }
        }
        return result;
    }

    // ============================================================
    //  暴露接口（保持原风格：独立函数引用）
    // ============================================================
    global.MonsterService = {
        getMonsterById: getMonsterById,
        getAllMonsters: getAllMonsters,
        getMonsterName: getMonsterName,
        getMonsterDisplay: getMonsterDisplay,   // 🆕 新增
        spawnMonsterUnit: spawnMonsterUnit,
        spawnBatch: spawnBatch
    };

    console.log('[MonsterService] ✅ 已加载（直连全局 MonsterData，支持中文名映射）');
})(window);
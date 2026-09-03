// ============================================================
//  rAthenaConfig.js - battle_config 全部参数
//  可在此实时修改战斗参数
// ============================================================
(function(global) {
    'use strict';
    global.CONFIG = global.CONFIG || {};
    Object.assign(global.CONFIG, {
        // 属性恢复率（0=关闭，1=开启）——控制角色属性点（如STR、AGI等）的自然恢复机制
        "attr_recover": 1,

        // 最小命中率（百分比），攻击时实际命中率不会低于此值
        "min_hitrate": 5,

        // 最大命中率（百分比），攻击时实际命中率不会高于此值
        "max_hitrate": 100,

        // 技能造成的最小伤害值，避免技能伤害过低
        "skill_min_damage": 6,

        // 公会战（GVG）中近战物理攻击的伤害倍率（百分比），80表示造成80%伤害
        "gvg_short_damage_rate": 80,

        // 公会战（GVG）中远程物理攻击的伤害倍率（百分比），80表示造成80%伤害
        "gvg_long_damage_rate": 80,

        // PK模式（0=关闭，1=开启）——开启后允许玩家间自由战斗
        "pk_mode": 0,

        // 是否启用 Renewal 版本公式（true=启用，false=关闭），影响伤害计算、属性加成等
        "RENEWAL": true
    });
    console.log('✅ rAthenaConfig 已加载');
})(window);
(function(global) {
    'use strict';

    const SKILL_CONFIG = {
        DEFAULT_COOLDOWN: 2.0,
        DEFAULT_SP_COST: 5,
        DEFAULT_CAST_TIME: 0,
        DEFAULT_GCD: 0.3,
        DEFAULT_AFTER_CAST_DELAY: 0.3,

        MIN_SKILL_RATIO: 100,
        MAX_SKILL_RATIO: 5000,

        PIXELS_PER_CELL: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
        DEFAULT_SKILL_RANGE: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,
        DEFAULT_WEAPON_RANGE: RO_CONSTANTS.DEFAULT_ATTACK_RANGE,

        // （已移除 USE_WEAPON_RANGE_SKILLS）

        CAN_BE_INTERRUPTED_BY_DAMAGE: true,
        DEFAULT_CAST_PROTECTION_RATE: 0.2,
        INDEPENDENT_COOLDOWN: true,
    };

    global.SKILL_CONFIG = SKILL_CONFIG;
    console.log('[SkillConfig] ✅ 已加载（已移除弃用字段）');
})(window);
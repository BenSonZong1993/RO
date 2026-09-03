// Auto-generated from MonsterData.js
// DO NOT EDIT MANUALLY
(function(global) {
    'use strict';
    const ELEMENT_CONSTANTS = {
        ELE_DARK: 1,  // Dark
        ELE_EARTH: 2,  // Earth
        ELE_FIRE: 3,  // Fire
        ELE_GHOST: 4,  // Ghost
        ELE_HOLY: 5,  // Holy
        ELE_NEUTRAL: 6,  // Neutral
        ELE_POISON: 7,  // Poison
        ELE_UNDEAD: 8,  // Undead
        ELE_WATER: 9,  // Water
        ELE_WIND: 10,  // Wind
    };
    const ELEMENT_NAMES = {};
    Object.keys(ELEMENT_CONSTANTS).forEach(k => { ELEMENT_NAMES[ELEMENT_CONSTANTS[k]] = k; });
    const ELEMENT_LIST = [
        'Dark',
        'Earth',
        'Fire',
        'Ghost',
        'Holy',
        'Neutral',
        'Poison',
        'Undead',
        'Water',
        'Wind',
    ];
    global.ELEMENT_CONSTANTS = ELEMENT_CONSTANTS;
    global.ELEMENT_NAMES = ELEMENT_NAMES;
    global.ELEMENT_LIST = ELEMENT_LIST;
    console.log('[ElementConstants] ✅ 已加载 (' + ELEMENT_LIST.length + ' 个属性)');
})(window);
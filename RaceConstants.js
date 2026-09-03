// Auto-generated from MonsterData.js
// DO NOT EDIT MANUALLY
(function(global) {
    'use strict';
    const RACE_CONSTANTS = {
        RC_ANGEL: 1,  // Angel
        RC_BRUTE: 2,  // Brute
        RC_DEMIHUMAN: 3,  // Demihuman
        RC_DEMON: 4,  // Demon
        RC_DRAGON: 5,  // Dragon
        RC_FISH: 6,  // Fish
        RC_FORMLESS: 7,  // Formless
        RC_INSECT: 8,  // Insect
        RC_PLANT: 9,  // Plant
        RC_PLAYER_DORAM: 10,  // Player_Doram
        RC_PLAYER_HUMAN: 11,  // Player_Human
        RC_UNDEAD: 12,  // Undead
    };
    const RACE_NAMES = {};
    Object.keys(RACE_CONSTANTS).forEach(k => { RACE_NAMES[RACE_CONSTANTS[k]] = k; });
    const RACE_LIST = [
        'Angel',
        'Brute',
        'Demihuman',
        'Demon',
        'Dragon',
        'Fish',
        'Formless',
        'Insect',
        'Plant',
        'Player_Doram',
        'Player_Human',
        'Undead',
    ];
    global.RACE_CONSTANTS = RACE_CONSTANTS;
    global.RACE_NAMES = RACE_NAMES;
    global.RACE_LIST = RACE_LIST;
    console.log('[RaceConstants] ✅ 已加载 (' + RACE_LIST.length + ' 个种族)');
})(window);
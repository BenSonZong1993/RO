(function(global) {
    'use strict';

    var ELEMENTS = ['Neutral','Water','Earth','Fire','Wind','Poison','Holy','Dark','Ghost','Undead'];

    var MODIFIERS = {
        'Neutral': {
            'Neutral': [100,100,100,100],
            'Water': [100,100,100,100],
            'Earth': [100,100,100,100],
            'Fire': [100,100,100,100],
            'Wind': [100,100,100,100],
            'Poison': [100,100,100,100],
            'Holy': [100,100,100,100],
            'Dark': [100,100,100,100],
            'Ghost': [90,70,50,0],
            'Undead': [100,100,100,100]
        },
        'Water': {
            'Neutral': [100,100,100,100],
            'Water': [25,0,0,0],
            'Earth': [100,100,100,100],
            'Fire': [150,175,200,200],
            'Wind': [90,80,70,60],
            'Poison': [150,150,125,125],
            'Holy': [100,100,100,100],
            'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100],
            'Undead': [100,100,100,100]
        },
        'Earth': {
            'Neutral': [100,100,100,100],
            'Water': [100,100,100,100],
            'Earth': [25,0,0,0],
            'Fire': [90,80,70,60],
            'Wind': [150,175,200,200],
            'Poison': [150,150,125,125],
            'Holy': [100,100,100,100],
            'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100],
            'Undead': [100,100,100,100]
        },
        'Fire': {
            'Neutral': [100,100,100,100],
            'Water': [90,80,70,60],
            'Earth': [150,175,200,200],
            'Fire': [25,0,0,0],
            'Wind': [100,100,100,100],
            'Poison': [150,150,125,125],
            'Holy': [100,100,100,100],
            'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100],
            'Undead': [125,150,175,200]
        },
        'Wind': {
            'Neutral': [100,100,100,100],
            'Water': [150,175,200,200],
            'Earth': [90,80,70,60],
            'Fire': [100,100,100,100],
            'Wind': [25,0,0,0],
            'Poison': [150,150,125,125],
            'Holy': [100,100,100,100],
            'Dark': [100,100,100,100],
            'Ghost': [100,100,100,100],
            'Undead': [100,100,100,100]
        },
        'Poison': {
            'Neutral': [100,100,100,100],
            'Water': [150,150,125,125],
            'Earth': [150,150,125,125],
            'Fire': [150,150,125,125],
            'Wind': [150,150,125,125],
            'Poison': [0,0,0,0],
            'Holy': [75,75,50,50],
            'Dark': [75,75,50,50],
            'Ghost': [75,75,50,50],
            'Undead': [75,50,25,0]
        },
        'Holy': {
            'Neutral': [100,100,100,100],
            'Water': [100,100,100,100],
            'Earth': [100,100,100,100],
            'Fire': [100,100,100,100],
            'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [0,0,0,0],
            'Dark': [125,150,175,200],
            'Ghost': [100,100,100,100],
            'Undead': [125,150,175,200]
        },
        'Dark': {
            'Neutral': [100,100,100,100],
            'Water': [100,100,100,100],
            'Earth': [100,100,100,100],
            'Fire': [100,100,100,100],
            'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [125,150,175,200],
            'Dark': [0,0,0,0],
            'Ghost': [100,100,100,100],
            'Undead': [0,0,0,0]
        },
        'Ghost': {
            'Neutral': [90,70,50,0],
            'Water': [100,100,100,100],
            'Earth': [100,100,100,100],
            'Fire': [100,100,100,100],
            'Wind': [100,100,100,100],
            'Poison': [75,75,50,50],
            'Holy': [90,80,70,60],
            'Dark': [90,80,70,60],
            'Ghost': [125,150,175,200],
            'Undead': [100,125,150,175]
        },
        'Undead': {
            'Neutral': [100,100,100,100],
            'Water': [100,100,100,100],
            'Earth': [100,100,100,100],
            'Fire': [90,80,70,60],
            'Wind': [100,100,100,100],
            'Poison': [75,50,25,0],
            'Holy': [125,150,175,200],
            'Dark': [0,0,0,0],
            'Ghost': [100,125,150,175],
            'Undead': [0,0,0,0]
        }
    };

    function getModifier(attackElem, targetElem, level) {
        if (!attackElem || !targetElem) return 100;
        function normalize(name) {
            if (!name) return 'Neutral';
            var raw = name.replace(/^Ele_/, '');
            return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        }
        var a = normalize(attackElem);
        var t = normalize(targetElem);
        level = Math.min(Math.max(level || 1, 1), 4);
        var table = MODIFIERS[a];
        if (!table) return 100;
        var values = table[t];
        if (!values) return 100;
        return values[level - 1] || 100;
    }

    function getFullTable(level) {
        var result = {};
        level = Math.min(Math.max(level || 1, 1), 4);
        for (var attack in MODIFIERS) {
            result[attack] = {};
            for (var target in MODIFIERS[attack]) {
                result[attack][target] = MODIFIERS[attack][target][level - 1] || 100;
            }
        }
        return result;
    }

    var ElementDB = {
        getModifier: getModifier,
        getFullTable: getFullTable,
        ELEMENTS: ELEMENTS
    };

    global.ElementDB = ElementDB;

    console.log('[ElementDB] ✅ 已加载完整克制表 (Lv1~4)');
})(window);
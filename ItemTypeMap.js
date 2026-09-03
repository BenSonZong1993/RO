// js/config/ItemTypeMap.js
(function(global) {
    'use strict';

    // 一级类型映射 (Type)
    const TYPE_MAP = {
        'Weapon': '武器',
        'Armor': '防具',
        'Accessory': '饰品',
        'Healing': '消耗',
        'Usable': '消耗',
        'Etc': '材料',
        'Card': '卡片',
        'DelayConsume': '消耗',
        // 若有其他类型，继续添加
    };

    // 二级类型映射 (SubType) —— 用于更精确的描述
const SUBTYPE_MAP = {
    // 武器
    '1hSword': '单手剑',
    '2hSword': '双手剑',
    '1hAxe': '单手斧',
    '2hAxe': '双手斧',
    'Dagger': '短剑',
    '1hSpear': '单手矛',
    '2hSpear': '双手矛',
    'Bow': '猎弓',
    'Staff': '单手杖',
    '2hStaff': '双手杖',
    'Book': '书籍',
    'Knuckle': '拳套',
    'Katar': '拳刃',
    'Instrument': '乐器',
    'Musical': '乐器',
    'Whip': '鞭子',
    'Revolver': '左轮手枪',
    'Rifle': '来福枪',
    'Gatling': '格林机枪',
    'Shotgun': '散弹枪',
    'Grenade': '榴弹发射器',
    'Mace': '钝器',
    'Huuma': '飞镖',
    // 防具
    'Armor': '铠甲',
    'Shield': '盾牌',
    'Garment': '披肩',
    'Manteau': '披肩',
    'Hood': '披肩',
    'Shoes': '鞋子',
    'Boots': '鞋子',
    'Accessory': '饰品',
    'Both_Accessory': '饰品',
    'Ring': '饰品',
    'Earring': '饰品',
    'Necklace': '饰品',
    // 头饰
    'Head_Top': '头饰(上)',
    'Head_Mid': '头饰(中)',
    'Head_Bottom': '头饰(下)',
    'Head_Low': '头饰(下)',
    'Helm': '头盔',
    'Helmet': '头盔',
    // 时装
    'Costume_Garment': '时装披风',
    // 影子
    'Shadow_Armor': '铠甲',
    'Shadow_Weapon': '武器',
    'Shadow_Shield': '盾牌',
    'Shadow_Shoes': '鞋子',
    'Shadow_Earring': '耳环',
    'Shadow_Pendant': '吊坠',
    // 其他
    'Healing': '消耗治疗类',
    'Usable': '消耗功能类',
    'DelayConsume': '延迟消耗类',
    'Etc': '杂物',
    'Pet': '宠物相关',
    'Food': '宠物相关',
};

    /**
     * 获取物品的一级分类中文名
     * @param {string} type - Type 字段
     * @returns {string}
     */
    function getTypeCN(type) {
        return TYPE_MAP[type] || type || '其他';
    }

    /**
     * 获取物品的二级分类中文名
     * @param {string} subType - SubType 字段
     * @returns {string}
     */
    function getSubTypeCN(subType) {
        return SUBTYPE_MAP[subType] || subType || '';
    }

    /**
     * 获取完整分类描述（如“武器·双手剑”），可选
     */
    function getFullTypeName(type, subType) {
        const typeName = getTypeCN(type);
        const subName = getSubTypeCN(subType);
        if (subName) return `${typeName}·${subName}`;
        return typeName;
    }

    global.ItemTypeMap = {
        TYPE_MAP,
        SUBTYPE_MAP,
        getTypeCN,
        getSubTypeCN,
        getFullTypeName
    };

    console.log(`[ItemTypeMap] ✅ 已加载 (${Object.keys(TYPE_MAP).length} 种类型, ${Object.keys(SUBTYPE_MAP).length} 种子类型)`);
})(window);
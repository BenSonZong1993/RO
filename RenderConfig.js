// js/config/RenderConfig.js
// ================================================================
//  渲染配置表（策划可自由调整）
//  所有数值均影响画布渲染外观，修改后无需重启游戏
// ================================================================
window.RenderConfig = (() => {
    'use strict';

    const CONFIG = {
        // ============================================================
        //  玩家角色（Player）外观配置
        // ============================================================
        PLAYER: {
            radius: 24,                                 // 玩家身体半径（像素）
            bodyGrad: {                                 // 身体径向渐变颜色（从内到外）
                light: '#4B8DF1',                       // 高光色（中心）
                mid: '#3B82F6',                         // 中间色
                dark: '#3171EC'                         // 边缘色（最暗）
            },
            headGrad: {                                 // 头部（眼睛区域）渐变
                light: '#F2FFF2',                       // 高光
                mid: '#F8F8F8',                         // 中调
                dark: '#F0F0F0'                         // 边缘
            },
            weaponLengthRatio: 1.2,                     // 武器长度 = 半径 × 此系数
            weaponAngleDeg: 30,                         // 武器偏离角色朝向的角度（度）
            weaponLineWidth: 4,                         // 武器线条粗细（像素）
            weaponColor: '#FFFFFF',                     // 武器颜色
            shadowAlpha: 0.3,                           // 角色投影透明度（0~1）
        },

        // ============================================================
        //  怪物（Monster）外观及头顶信息配置
        // ============================================================
        MONSTER: {
            radius: 24,                                 // 怪物身体半径（像素）
            eyeOffsetX: 0.35,                           // 双眼水平偏移系数（相对半径）
            eyeOffsetY: -0.2,                           // 双眼垂直偏移系数（负值向上）
            eyeRadiusRatio: 0.08,                       // 眼珠半径 = 身体半径 × 此系数
            barWidth: 60,                               // 血条宽度（像素）
            barHeight: 8,                               // 血条高度（像素）
            barYOffset: 18,                             // 血条在怪物头顶的纵向偏移（像素）
            hpTextFont: 'bold 12px Arial, sans-serif',  // HP数值字体
            nameTextFont: 'bold 11px Arial, sans-serif',// 怪物名字字体
            shadowAlpha: 0.3,                           // 怪物投影透明度
            hpTextColor: '#FFFFFF',                     // HP数字颜色
            nameTextColor: '#FFD700',                   // 名字颜色（金色）
        },

        // ============================================================
        //  伤害数字（Damage Number）飘字配置
        // ============================================================
        DAMAGE: {
            lifetime: 1.0,                              // 数字显示时长（秒）
            riseSpeed: 180,                             // 每秒上飘速度（像素/秒）
            fadeStartRatio: 0.4,                        // 从生命周期的多少比例开始淡出（0~1）
            fontSize: 54,                               // 字号
            font: 'bold 54px monospace',                // 完整字体声明
            strokeWidth: 3,                             // 文字描边宽度（像素）
            strokeColor: '#000000',                     // 描边颜色（黑色）
            critColor: '#ffaa00',                       // 暴击伤害颜色（橙色）
            normalColor: '#ffffff',                     // 普通伤害颜色（白色）
            shadowBlur: 12,                             // 文字阴影模糊半径（像素）
        },

        // ============================================================
        //  经验值获取（EXP）飘字配置
        // ============================================================
        EXP: {
            riseDuration: 2.2,                          // 显示持续时间（秒）
            riseDistance: 130,                          // 总上飘距离（像素）
            maxCount: 5,                                // 同时最多显示几条经验飘字
            fadeStartRatio: 0.55,                       // 淡出开始的时间比例
            baseOffsetX: 150,                           // 相对于角色的横向偏移（像素）
            baseOffsetY: -30,                           // 相对于角色的纵向偏移（像素，负值向上）
            randomOffsetX: 40,                          // 横向随机散布范围（±）
            randomOffsetY: 15,                          // 纵向随机散布范围（±）
            spacing: 55,                                // 多条经验之间的纵向间隔（像素）
            fontSize: 36,                               // 字号
            padding: 8,                                 // 背景框内边距（像素）
            lineHeightRatio: 1.3,                       // 行高倍数（相对于字号）
            boxBgAlpha: 0.7,                            // 背景框透明度（0~1）
            boxRadius: 6,                               // 背景框圆角半径（像素）
            baseColor: '#FFD700',                       // 基础经验值颜色（金色）
            jobColor: '#87CEEB',                        // 职业经验值颜色（天蓝）
            positionX: 0.85,                            // 经验显示区域在屏幕上的水平位置（比例，0~1）
            shadowBlur: 10,                             // 文字阴影模糊半径
            font: 'bold 36px monospace',                // 完整字体声明
        },

        // ============================================================
        //  拾取物品（Loot）飘字配置
        // ============================================================
        LOOT: {
            riseDuration: 2.8,                          // 显示持续时间（秒）
            riseDistance: 110,                          // 总上飘距离（像素）
            maxCount: 4,                                // 同时最大显示条数
            fadeStartRatio: 0.45,                       // 淡出开始时间比例
            baseOffsetX: 160,                           // 横向基础偏移
            baseOffsetY: 70,                            // 纵向基础偏移（向下）
            randomOffsetX: 30,                          // 横向随机散布范围
            randomOffsetY: 15,                          // 纵向随机散布范围
            spacing: 55,                                // 多条间的纵向间隔
            font: 'bold 28px monospace',                // 文字字体
            bgAlpha: 0.5,                               // 背景框透明度
            borderColor: '#FFD700',                     // 边框颜色（金色）
            textColor: '#FFD700',                       // 文字颜色（金色）
            shadowBlur: 8,                              // 阴影模糊半径
            padding: 10,                                // 内边距
            height: 42,                                 // 背景框高度（像素）
            positionX: 0.6,                             // 屏幕水平位置比例
            positionY: 0.4,                             // 屏幕垂直位置比例
        },

        // ============================================================
        //  HUD（头像、血条、能量条）配置
        // ============================================================
        HUD: {
            nameFont: '16px Arial, sans-serif',         // 玩家名字字体
            nameColor: '#FFFFFF',                       // 名字颜色
            hpBarWidth: 240,                            // 血条宽度（像素）
            hpBarHeight: 18,                            // 血条高度
            hpBarRadius: 12,                            // 血条圆角半径
            hpColor: '#33CC66',                         // 生命值颜色（绿色）
            spColor: '#66AAFF',                         // 能量值颜色（蓝色）
            barBgAlpha: 0.1,                            // 条背景透明度
            strokeAlpha: 0.2,                           // 条描边透明度
            highlightTopAlpha: 0.2,                     // 顶部高光透明度
            highlightBottomAlpha: 0.08,                 // 底部阴影透明度
            valueFont: 'bold 12px Arial, sans-serif',   // 数值文字字体
            valueColor: '#FFFFFF',                      // 数值文字颜色
            nameShadow: 'rgba(0,0,0,0.5)',              // 名字阴影
            valueShadow: 'rgba(0,0,0,0.8)',             // 数值阴影
            yNameOffset: 0,                             // 名字纵向偏移（像素）
            yHpBarOffset: 20,                           // 血条纵向偏移（像素）
            spGap: 6,                                   // 能量条与血条的间距（像素）
        },

        // ============================================================
        //  地形（Terrain）渲染配置
        // ============================================================
        TERRAIN: {
            tileSize: 32,                               // 每个瓦片（格子）的像素尺寸
                                                        // 注意：必须为512的因数（如32或64），
                                                        // 否则纹理图集边缘会产生接缝重叠，导致画面“脏”
            drawTerrain: true,                          // 是否绘制地形（false则只显示背景）
        },
    };

    // 返回配置对象，并冻结防止意外修改
    return Object.freeze(CONFIG);
})();
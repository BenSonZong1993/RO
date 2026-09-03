// ================================================================
//  FILE: TerrainTemplates.js
//  PURPOSE: 地形视觉配置字典 + 瓦片纹理生成器
//  配色原则：雪地≠纯白，沙漠≠金黄，保留质感但不过曝
// ================================================================
window.TerrainTemplates = (() => {
    'use strict';

    // ============================================================
    //  模板定义
    // ============================================================

    // 1️⃣ 野外（field）
    var field = {
        bgColor: '#141d2b',
        palette: {
            base: ['#8ea5c2', '#7a91b0', '#9eb6d0'],
            accent: ['#243852', '#1a2c42', '#2e4460'],
            shadow: ['#0a121c', '#040810']
        },
        noise: { scale: 0.012, patchSize: 32, colorVariance: 3, density: 0.08 },
        tileAlpha: 0.42,
        style: 'default',
        description: '野外（亮冷蓝·边界清晰）'
    };

    // 2️⃣ 森林（forest）
    var forest = {
        bgColor: '#0d1725',
        palette: {
            base: ['#4a6685', '#3a5675', '#5a7695'],
            accent: ['#142433', '#0a1825', '#1e3045'],
            shadow: ['#060c14', '#020408']
        },
        noise: { scale: 0.010, patchSize: 36, colorVariance: 2, density: 0.06 },
        tileAlpha: 0.38,
        style: 'default',
        description: '森林（冷藏青·层次分明）'
    };

    // 3️⃣ 海底（ocean）
    var ocean = {
        bgColor: '#0A1A2A',
        palette: {
            base: ['#0A2A4A', '#1A3A5A', '#0A1A3A'],
            accent: ['#2A4A6A', '#3A5A7A', '#1A2A4A'],
            shadow: ['#050A1A', '#000A1A']
        },
        noise: { scale: 0.02, patchSize: 24, colorVariance: 10, density: 0.40 },
        tileAlpha: 0.65,
        style: 'ocean',
        description: '海底 / 深蓝'
    };

    // 4️⃣ 雪地（snow）
    var snow = {
        bgColor: '#C0C8D0',
        palette: {
            base: ['#D0D8E0', '#DCE4EC', '#C0C8D0'],
            accent: ['#E0E8F0', '#E8F0F8', '#B0B8C0'],
            shadow: ['#A0A8B0', '#889098']
        },
        noise: { scale: 0.015, patchSize: 20, colorVariance: 4, density: 0.15 },
        tileAlpha: 0.70,
        style: 'crystalline',
        description: '雪地 / 灰白'
    };

    // 5️⃣ 火山（volcano）
    var volcano = {
        bgColor: '#2A0A00',
        palette: {
            base: ['#4A4A4A', '#3A3A3A', '#5A5A5A'],
            accent: ['#2A2A2A', '#6A6A6A', '#3A3A3A'],
            shadow: ['#1A1A1A', '#0A0A0A']
        },
        noise: { scale: 0.03, patchSize: 28, colorVariance: 12, density: 0.50 },
        tileAlpha: 0.80,
        style: 'volcano',
        description: '火山 / 暗红+明红'
    };

    // 6️⃣ 山岩（mountain）
    var mountain = {
        bgColor: '#4A4A4A',
        palette: {
            base: ['#6A6A6A', '#7A7A7A', '#5A5A5A'],
            accent: ['#8A8A8A', '#9A9A9A', '#4A4A4A'],
            shadow: ['#3A3A3A', '#2A2A2A']
        },
        noise: { scale: 0.03, patchSize: 28, colorVariance: 10, density: 0.30 },
        tileAlpha: 0.70,
        style: 'mountain',
        description: '山岩 / 灰褐'
    };

    // 7️⃣ 沙漠（desert）
    var desert = {
        bgColor: '#C0A070',
        palette: {
            base: ['#C8A870', '#B89860', '#D0B880'],
            accent: ['#A88850', '#D8C090', '#987848'],
            shadow: ['#806840', '#685030']
        },
        noise: { scale: 0.02, patchSize: 20, colorVariance: 6, density: 0.25 },
        tileAlpha: 0.75,
        style: 'dune',
        description: '沙漠 / 驼色'
    };

    // ============================================================
    //  瓦片纹理生成器（供 CanvasRenderer 调用）
    // ============================================================
    function generateTile(mapId, tileSize) {
        tileSize = tileSize || 512;
        var canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        var ctx = canvas.getContext('2d');

        // 1. 获取地形类型
        var terrain = 'field';
        if (window.MapDataGateway && typeof window.MapDataGateway.getTerrain === 'function') {
            var t = window.MapDataGateway.getTerrain(mapId);
            if (t) terrain = t;
        }

        // 2. 获取模板配置
        var template = { field: field, forest: forest, ocean: ocean, snow: snow, volcano: volcano, mountain: mountain, desert: desert }[terrain] || field;
        if (!template) {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, tileSize, tileSize);
            return canvas;
        }

        var palette = template.palette;
        var colors = [].concat(palette.base, palette.accent, palette.shadow);
        var alpha = template.tileAlpha || 0.3;
        var patchSize = template.noise?.patchSize || 16;
        var variance = template.noise?.colorVariance || 10;

        // 3. 背景色
        ctx.fillStyle = template.bgColor || '#2a2a2a';
        ctx.fillRect(0, 0, tileSize, tileSize);

        // 4. 随机数生成器
        var seed = 42;
        if (mapId && typeof mapId === 'string') {
            for (var i = 0; i < mapId.length; i++) {
                seed = (seed * 31 + mapId.charCodeAt(i)) & 0x7fffffff;
            }
        }
        function rng() {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        // 5. 彩色马赛克色块
        var cols = Math.ceil(tileSize / patchSize);
        var rows = Math.ceil(tileSize / patchSize);
        for (var col = 0; col < cols; col++) {
            for (var row = 0; row < rows; row++) {
                var x = col * patchSize;
                var y = row * patchSize;
                var colorIndex = Math.floor(rng() * colors.length);
                var baseColor = colors[colorIndex];
                var brightnessShift = Math.floor(rng() * variance * 2 - variance);
                var hex = baseColor.replace('#', '');
                var r = parseInt(hex.substring(0, 2), 16) || 0;
                var g = parseInt(hex.substring(2, 4), 16) || 0;
                var b = parseInt(hex.substring(4, 6), 16) || 0;
                r = Math.min(255, Math.max(0, r + brightnessShift));
                g = Math.min(255, Math.max(0, g + brightnessShift));
                b = Math.min(255, Math.max(0, b + brightnessShift));
                ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
                ctx.globalAlpha = alpha;
                ctx.fillRect(x, y, patchSize, patchSize);
            }
        }

        // 6. TerrainPatterns 细节
        ctx.globalAlpha = 1.0;
        var styleKey = template.style || 'default';
        if (window.TerrainPatterns && typeof window.TerrainPatterns.draw === 'function') {
            var detailSeed = seed + 999;
            function detailRng() {
                detailSeed |= 0;
                detailSeed = detailSeed + 0x6D2B79F5 | 0;
                var t = Math.imul(detailSeed ^ detailSeed >>> 15, 1 | detailSeed);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
            window.TerrainPatterns.draw(ctx, styleKey, tileSize, detailRng, palette);
        } else {
            // 降级：随机圆点
            for (var i2 = 0; i2 < 20; i2++) {
                var x2 = rng() * tileSize;
                var y2 = rng() * tileSize;
                var radius = 1 + rng() * 2;
                var bright = rng() > 0.5 ? 50 : -30;
                var hex2 = colors[Math.floor(rng() * colors.length)].replace('#', '');
                var r2 = Math.min(255, Math.max(0, (parseInt(hex2.substring(0, 2), 16) || 0) + bright));
                var g2 = Math.min(255, Math.max(0, (parseInt(hex2.substring(2, 4), 16) || 0) + bright));
                var b2 = Math.min(255, Math.max(0, (parseInt(hex2.substring(4, 6), 16) || 0) + bright));
                ctx.fillStyle = 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
                ctx.beginPath();
                ctx.arc(x2, y2, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        return canvas;
    }

    // ============================================================
    //  对外暴露
    // ============================================================
    return {
        field: field,
        forest: forest,
        ocean: ocean,
        snow: snow,
        volcano: volcano,
        mountain: mountain,
        desert: desert,
        generateTile: generateTile
    };

})();

console.log('[TerrainTemplates] ✅ 已加载（含 generateTile 方法）');
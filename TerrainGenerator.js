// js/render/TerrainGenerator.js
(function(global) {
    'use strict';

    // ---------- 配置 ----------
    const DEFAULT_TILE_SIZE = 32;  // 可被外部覆盖

    // 地形类型枚举
    const TILE_TYPES = {
        WATER: 0,
        LAND_DARK: 1,
        LAND_LIGHT: 2,
    };

    // 默认颜色映射（可被组策略替换）
    const DEFAULT_PALETTE = {
        [TILE_TYPES.WATER]: '#1a5276',      // 深蓝
        [TILE_TYPES.LAND_DARK]: '#2e6b3a',  // 深绿
        [TILE_TYPES.LAND_LIGHT]: '#4a8c5a', // 浅绿
    };

    // ---------- 私有状态 ----------
    let _seed = 0;
    let _palette = { ...DEFAULT_PALETTE };
    let _tileSize = DEFAULT_TILE_SIZE;

    // ---------- 哈希函数（用于值噪声） ----------
    function hash(x, y) {
        // 使用 Math.imul 做 32 位整数乘法，避免大坐标下浮点精度丢失
        let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
        h = Math.imul(h ^ (h >> 13), 1274126177);
        return (h ^ (h >> 16)) & 0x7fffffff;
    }

    // ---------- 平滑插值 ----------
    function smoothNoise(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;

        // 平滑曲线
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const v00 = (hash(ix + _seed, iy + _seed) & 0xffff) / 65536;
        const v10 = (hash(ix + 1 + _seed, iy + _seed) & 0xffff) / 65536;
        const v01 = (hash(ix + _seed, iy + 1 + _seed) & 0xffff) / 65536;
        const v11 = (hash(ix + 1 + _seed, iy + 1 + _seed) & 0xffff) / 65536;

        const vx0 = v00 + (v10 - v00) * ux;
        const vx1 = v01 + (v11 - v01) * ux;
        return vx0 + (vx1 - vx0) * uy;
    }

    // ---------- 获取瓦片类型 ----------
    function getTileType(worldX, worldY) {
        const nx = worldX / _tileSize;
        const ny = worldY / _tileSize;
        const value = smoothNoise(nx, ny);

        // 阈值划分（可配置）
        if (value < 0.4) return TILE_TYPES.WATER;
        if (value < 0.7) return TILE_TYPES.LAND_DARK;
        return TILE_TYPES.LAND_LIGHT;
    }

    // ---------- 获取颜色 ----------
    function getTileColor(type) {
        return _palette[type] || '#000000';
    }

    // ---------- 初始化（设置地图种子，可传入调色板） ----------
    function init(mapId, palette) {
        // 使用地图 ID 的简单哈希作为种子
        const id = typeof mapId === 'string' ? mapId : String(mapId || '');
        let seed = 0;
        for (let i = 0; i < id.length; i++) {
            seed = (seed * 31 + id.charCodeAt(i)) & 0x7fffffff;
        }
        _seed = seed || 1; // 避免 0 种子导致全零

        // 更新调色板（如果传入）
        if (palette) {
            _palette = { ...DEFAULT_PALETTE, ...palette };
        } else {
            _palette = { ...DEFAULT_PALETTE };
        }

        console.log('[TerrainGenerator] 初始化，地图:', id, '种子:', _seed);
    }

    // ---------- 设置瓦片大小（外部可调） ----------
    function setTileSize(size) {
        if (typeof size === 'number' && size > 0) {
            _tileSize = size;
        }
    }

    function getTileSize() {
        return _tileSize;
    }

    // ---------- 对外暴露 ----------
    global.TerrainGenerator = {
        init,
        setTileSize,
        getTileSize,
        getTileType,
        getTileColor,
        TILE_TYPES, // 暴露枚举，便于外部扩展
    };

    console.log('[TerrainGenerator] ✅ 已加载（值噪声地形生成器）');
})(typeof window !== 'undefined' ? window : globalThis);
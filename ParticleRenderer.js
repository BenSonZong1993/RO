// ================================================================
//  FILE: ParticleRenderer.js
//  PURPOSE: 动态粒子系统（落雪、水泡等）
//  所有效果参数集中在 CONFIG 对象中，策划可直接调参
// ================================================================
window.ParticleRenderer = (() => {
    'use strict';

    // =============================================================
    //  🎛️ 策划配置区（直接修改数值即可调整效果）
    // =============================================================
    const CONFIG = {
       // ---------- 雪花粒子 ----------
        snow: {
            enabled: true,
            maxParticles: 100,          // 80 → 100（稍微增加密度）
            sizeMin: 2.0,               // 1.5 → 2.0（稍大一点）
            sizeMax: 4.5,               // 3.5 → 4.5（更大更明显）
            speedY: 28,                 // 25 → 28（略微加快，更自然）
            drift: 40,                  // 35 → 40（飘动幅度加大）
            opacityMin: 0.5,            // 0.4 → 0.5
            opacityMax: 0.95,           // 0.9 → 0.95
            color: '#FFFFFF',
            spawnRate: 0.5,             // 0.6 → 0.5（略微稀疏，避免过密）
        },

        // ---------- 水泡粒子（海底） ----------
bubble: {
    enabled: true,
    maxParticles: 90,              // 60 → 90（更多气泡）
    sizeMin: 5,
    sizeMax: 25,
    speedY: -12,                   // -14 → -12（更慢，飘更久）
    drift: 25,                     // 10 → 25（水平飘动幅度大幅增加）
    opacityMin: 0.3,
    opacityMax: 0.65,
    color: 'rgba(160, 230, 255, ',
    spawnRate: 0.5,               // 0.4 → 0.5（生成更快）
}
    };
    // =============================================================
    //  内部状态
    // =============================================================
    let _particles = {};   // { 'snow': [], 'bubble': [] }
    let _initialized = false;

    // ---------- 工具：随机数 ----------
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    // ---------- 初始化粒子池 ----------
    function _initPools() {
        if (_initialized) return;
        _particles.snow = [];
        _particles.bubble = [];
        _initialized = true;
    }

    // ---------- 生成单个雪花 ----------
    function _createSnow(size) {
        return {
            x: rand(0, size),
            y: rand(-size, 0),          // 从顶部分布，避免瞬间全屏出现
            size: rand(CONFIG.snow.sizeMin, CONFIG.snow.sizeMax),
            speedY: rand(CONFIG.snow.speedY * 0.6, CONFIG.snow.speedY * 1.4),
            drift: rand(-CONFIG.snow.drift, CONFIG.snow.drift),
            opacity: rand(CONFIG.snow.opacityMin, CONFIG.snow.opacityMax),
            phase: rand(0, Math.PI * 2) // 用于正弦飘动
        };
    }

    // ---------- 生成单个水泡 ----------
    function _createBubble(size) {
        return {
            x: rand(0, size),
            y: rand(size * 0.8, size * 1.2), // 从底部生成
            radius: rand(CONFIG.bubble.sizeMin, CONFIG.bubble.sizeMax),
            speedY: rand(CONFIG.bubble.speedY * 0.7, CONFIG.bubble.speedY * 1.3),
            drift: rand(-CONFIG.bubble.drift, CONFIG.bubble.drift),
            opacity: rand(CONFIG.bubble.opacityMin, CONFIG.bubble.opacityMax),
            phase: rand(0, Math.PI * 2)
        };
    }

    // ---------- 更新粒子（每帧调用） ----------
    function update(deltaMs, mapWidth, mapHeight, terrain) {
        _initPools();
        const delta = deltaMs / 1000; // 转为秒
        const size = Math.max(mapWidth, mapHeight);

        // 1. 更新雪花（仅雪地地图）
        if (terrain === 'snow' && CONFIG.snow.enabled) {
            const pool = _particles.snow;
            // 补充新粒子
            while (pool.length < CONFIG.snow.maxParticles) {
                if (Math.random() < CONFIG.snow.spawnRate) {
                    pool.push(_createSnow(size));
                } else {
                    break;
                }
            }
            // 更新位置
            for (let i = pool.length - 1; i >= 0; i--) {
                const p = pool[i];
                p.y += p.speedY * delta;
                p.x += Math.sin(p.phase + Date.now() * 0.001 * 0.5) * p.drift * delta;
                // 重置到底部
                if (p.y > mapHeight + 20) {
                    pool.splice(i, 1);
                    // 立即补一个新粒子（顶部分布）
                    if (pool.length < CONFIG.snow.maxParticles && Math.random() < 0.8) {
                        pool.push(_createSnow(size));
                    }
                }
            }
        } else {
            // 非雪地：清空雪花池（释放内存）
            if (_particles.snow) _particles.snow = [];
        }

        // 2. 更新水泡（仅海底地图）
        if (terrain === 'ocean' && CONFIG.bubble.enabled) {
            const pool = _particles.bubble;
            while (pool.length < CONFIG.bubble.maxParticles) {
                if (Math.random() < CONFIG.bubble.spawnRate) {
                    pool.push(_createBubble(size));
                } else {
                    break;
                }
            }
            for (let i = pool.length - 1; i >= 0; i--) {
                const p = pool[i];
                p.y += p.speedY * delta;
                p.x += Math.sin(p.phase + Date.now() * 0.001 * 0.3) * p.drift * delta;
                // 浮到顶部消失
                if (p.y < -20) {
                    pool.splice(i, 1);
                    if (pool.length < CONFIG.bubble.maxParticles && Math.random() < 0.6) {
                        pool.push(_createBubble(size));
                    }
                }
            }
        } else {
            if (_particles.bubble) _particles.bubble = [];
        }
    }

    // ---------- 绘制粒子（每帧调用） ----------
    function draw(ctx, viewX, viewY, width, height, terrain) {
        _initPools();
        const w = width;
        const h = height;

        // 绘制雪花
        if (terrain === 'snow' && CONFIG.snow.enabled) {
            const pool = _particles.snow;
            ctx.save();
            for (const p of pool) {
                const sx = p.x - viewX;
                const sy = p.y - viewY;
                // 视口裁剪
                if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = CONFIG.snow.color;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 绘制水泡
        if (terrain === 'ocean' && CONFIG.bubble.enabled) {
            const pool = _particles.bubble;
            ctx.save();
            for (const p of pool) {
                const sx = p.x - viewX;
                const sy = p.y - viewY;
                if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
                const alpha = p.opacity;
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = CONFIG.bubble.color + alpha + ')';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
                ctx.stroke();
                // 高光点（让水泡立体）
                if (p.radius > 8) {
                    ctx.fillStyle = CONFIG.bubble.color + (alpha * 0.5) + ')';
                    ctx.beginPath();
                    ctx.arc(sx - p.radius * 0.25, sy - p.radius * 0.3, p.radius * 0.15, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    }

    // ---------- 重置（切换地图时调用） ----------
    function reset() {
        _particles.snow = [];
        _particles.bubble = [];
    }

    // =============================================================
    //  对外接口
    // =============================================================
    return {
        update: update,
        draw: draw,
        reset: reset,
        // 暴露配置以便控制台调试
        CONFIG: CONFIG
    };

})();

console.log('[ParticleRenderer] ✅ 已加载（落雪/水泡粒子）');
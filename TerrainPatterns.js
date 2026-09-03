// ================================================================
//  FILE: TerrainPatterns.js
//  PURPOSE: 地形专属图案绘制器（策略模式）
//  每个函数接收 (ctx, size, rng, palette) 并绘制专属纹理
// ================================================================
window.TerrainPatterns = (() => {
    'use strict';

    const patterns = {

        // ---------- 默认（保留原有的随机噪点） ----------
        default: function(ctx, size, rng, palette) {
            const colors = [...palette.base, ...palette.accent, ...palette.shadow];
            for (let i = 0; i < 20; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const radius = 1 + rng() * 2;
                const bright = rng() > 0.5 ? 50 : -30;
                const rgb = _hexToRgb(colors[Math.floor(rng() * colors.length)]);
                const r = Math.min(255, Math.max(0, rgb.r + bright));
                const g = Math.min(255, Math.max(0, rgb.g + bright));
                const b = Math.min(255, Math.max(0, rgb.b + bright));
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        // ---------- 沙漠 / 沙丘 ----------
        dune: function(ctx, size, rng, palette) {
            // 1. 沙丘波浪线
            for (let i = 0; i < 30; i++) {
                const y = (i / 30) * size + rng() * 8;
                const phase = rng() * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x < size; x += 4) {
                    const waveY = y + Math.sin(x * 0.03 + phase) * 6 + Math.sin(x * 0.07 + phase * 1.5) * 3;
                    ctx.lineTo(x, waveY);
                }
                ctx.strokeStyle = `rgba(180, 140, 80, ${0.15 + rng() * 0.2})`;
                ctx.lineWidth = 1.5 + rng() * 2;
                ctx.stroke();
            }
            // 2. 沙粒噪点
            for (let i = 0; i < 200; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const r = 1 + rng() * 2;
                ctx.fillStyle = `rgba(200, 170, 120, ${0.3 + rng() * 0.3})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        // ---------- 雪地 / 冰晶 ----------
        crystalline: function(ctx, size, rng, palette) {
            // 1. 柔和的大块雪斑
            for (let i = 0; i < 60; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const radius = 5 + rng() * 20;
                const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                grad.addColorStop(0, `rgba(255, 255, 255, ${0.2 + rng() * 0.3})`);
                grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            // 2. 冰晶闪光（十字星）
            for (let i = 0; i < 30; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const s = 2 + rng() * 4;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + rng() * 0.5})`;
                ctx.fillRect(x - s/2, y - 1, s, 2);
                ctx.fillRect(x - 1, y - s/2, 2, s);
            }
        },

        // ---------- 草地 / 草叶 ----------
        grassy: function(ctx, size, rng, palette) {
            for (let i = 0; i < 100; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const height = 3 + rng() * 6;
                const green = 100 + rng() * 80;
                ctx.strokeStyle = `rgba(60, ${green}, 40, 0.25)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + (rng() - 0.5) * 2, y - height);
                ctx.stroke();
            }
        },

        // ---------- 森林 / 树丛 ----------
        forest: function(ctx, size, rng, palette) {
            // 绘制深绿色的小圆团（树冠）
            for (let i = 0; i < 40; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const radius = 3 + rng() * 10;
                const green = 60 + rng() * 60;
                ctx.fillStyle = `rgba(30, ${green}, 20, 0.3)`;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        // ---------- 海底 ----------
        // ---------- 海底（ocean）：马赛克风海草 + 立体海星 + 贝壳 ----------
        ocean: function(ctx, size, rng, palette) {
            // 1. 海草（弯曲叶片，半透明）
            for (let i = 0; i < 35; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const len = 6 + rng() * 18;
                const sway = (rng() - 0.5) * 0.8;
                const green = 80 + rng() * 70;
                ctx.strokeStyle = `rgba(40, ${green}, 50, ${0.15 + rng() * 0.2})`;
                ctx.lineWidth = 1.5 + rng() * 2.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.quadraticCurveTo(
                    x + sway * len * 0.6,
                    y - len * 0.5,
                    x + sway * len * 1.2,
                    y - len
                );
                ctx.stroke();
            }

            // 2. ★ 柔和海星（模糊、半透明、背景装饰）
            for (let i = 0; i < 16; i++) {
                const cx = rng() * size;
                const cy = rng() * size;
                const outerR = 3 + rng() * 6;      // 3~9px
                const innerR = outerR * 0.3;
                const spikes = 5;

                // 极淡的暖色调（透明度为主）
                const hue = 20 + rng() * 20;        // 20~40 橙黄
                const sat = 30 + rng() * 20;        // 低饱和度
                const light = 55 + rng() * 20;      // 中等明度

                // 中心透明度（0.15~0.35），边缘透明度（0.02~0.06）
                const centerAlpha = 0.15 + rng() * 0.2;
                const edgeAlpha = 0.02 + rng() * 0.04;

                // ---- 用径向渐变实现从半透明到几乎全透明的渐变 ----
                const grad = ctx.createRadialGradient(
                    cx - outerR * 0.2, cy - outerR * 0.2, 0,   // 高光点（偏左上）
                    cx, cy, outerR * 0.85                      // 渐变终点（边缘）
                );
                grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light + 15}%, ${centerAlpha})`);
                grad.addColorStop(0.5, `hsla(${hue}, ${sat}%, ${light}%, ${centerAlpha * 0.7})`);
                grad.addColorStop(1, `hsla(${hue + 10}, ${sat - 10}%, ${light - 20}%, ${edgeAlpha})`);

                ctx.fillStyle = grad;
                ctx.beginPath();
                for (let j = 0; j < spikes * 2; j++) {
                    const radius = j % 2 === 0 ? outerR : innerR;
                    const angle = (j / (spikes * 2)) * Math.PI * 2 - Math.PI / 2 + (rng() - 0.5) * 0.1;
                    const px = cx + Math.cos(angle) * radius;
                    const py = cy + Math.sin(angle) * radius;
                    if (j === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();

                // ---- 极淡的投影（若有若无） ----
                ctx.shadowColor = 'rgba(0,0,0,0.03)';
                ctx.shadowBlur = 1.5;
                ctx.shadowOffsetX = 0.5;
                ctx.shadowOffsetY = 0.5;
                // 重新绘制一次（叠加阴影，但为了性能可省略，视效果而定）
                // 如果觉得投影没必要，可以完全删除投影部分
            }

            // 3. 贝壳（扇形 + 放射纹，也带一点渐变）
            for (let i = 0; i < 15; i++) {
                const cx = rng() * size;
                const cy = rng() * size;
                const r = 3 + rng() * 5;
                const startA = (rng() - 0.5) * 0.8;
                const endA = startA + 0.6 + rng() * 0.8;
                
                // 贝壳渐变：中心亮黄白 → 边缘暖棕
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                grad.addColorStop(0, `rgba(240, 220, 190, ${0.3 + rng() * 0.3})`);
                grad.addColorStop(1, `rgba(190, 150, 110, ${0.25 + rng() * 0.25})`);
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r, startA, endA);
                ctx.closePath();
                ctx.fill();
                
                // 放射纹（壳脉）
                ctx.strokeStyle = `rgba(160, 120, 80, ${0.08 + rng() * 0.12})`;
                ctx.lineWidth = 0.5;
                for (let k = 0; k < 4; k++) {
                    const a = startA + (endA - startA) * (k / 3) + (rng() - 0.5) * 0.1;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                    ctx.stroke();
                }
            }

            // 4. 小碎石 / 沙粒
            for (let i = 0; i < 30; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const w = 1 + rng() * 2;
                const h = 1 + rng() * 2;
                ctx.fillStyle = `rgba(160, 140, 120, ${0.08 + rng() * 0.12})`;
                ctx.fillRect(x, y, w, h);
            }
        },


        // ---------- 火山 ----------
        volcano: function(ctx, size, rng, palette) {
            // 绘制熔岩脉（橙色细线）
            for (let i = 0; i < 15; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const len = 5 + rng() * 20;
                const angle = rng() * Math.PI;
                ctx.strokeStyle = `rgba(255, 100, 20, ${0.2 + rng() * 0.3})`;
                ctx.lineWidth = 1 + rng() * 3;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            }
        },

        // ---------- 山岩 ----------
        mountain: function(ctx, size, rng, palette) {
            // 绘制岩缝（深色折线）
            for (let i = 0; i < 20; i++) {
                const x = rng() * size;
                const y = rng() * size;
                ctx.strokeStyle = `rgba(40, 40, 40, ${0.1 + rng() * 0.2})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let j = 0; j < 4; j++) {
                    x += rng() * 15 - 7.5;
                    y += rng() * 15 - 7.5;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
    };

    // 辅助函数（与 CanvasRenderer 共用，也可单独实现）
    function _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 0, g: 0, b: 0 };
    }

    // 对外接口：根据风格名调用对应的绘制函数
    function draw(ctx, style, size, rng, palette) {
        const fn = patterns[style] || patterns.default;
        fn(ctx, size, rng, palette);
    }

    return { draw };
})();

console.log('[TerrainPatterns] ✅ 已加载（策略模式）');
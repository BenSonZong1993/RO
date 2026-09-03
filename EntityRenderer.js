// ================================================================
//  📁 js/render/EntityRenderer.js
//  实体绘制器（玩家 / 怪物 / 队友）
//  版本：v1.0（从 CanvasRenderer 拆解）
//  职责：纯绘制函数，无状态，接收配置和坐标
// ================================================================

window.EntityRenderer = (() => {
    'use strict';

    // ============================================================
    //  辅助：颜色工具
    // ============================================================
    function _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 0, g: 0, b: 0 };
    }

    function _lighten(color, amount) {
        let r, g, b;
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } else return color;
        r = Math.min(255, r + amount * 255);
        g = Math.min(255, g + amount * 255);
        b = Math.min(255, b + amount * 255);
        return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    }

    function _darken(color, amount) {
        let r, g, b;
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } else return color;
        r = Math.max(0, r - amount * 255);
        g = Math.max(0, g - amount * 255);
        b = Math.max(0, b - amount * 255);
        return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    }

    // ============================================================
    //  性别人形模板
    // ============================================================
    function _genderTemplate(gender, config) {
        const g = (gender === 'female') ? 'female' : 'male';
        const gt = config?.GENDER || {};
        const tpl = gt[g] || null;
        const pCfg = config?.PLAYER || {};
        return {
            radius: (tpl?.radius) || pCfg.radius || 24,
            bodyGrad: (tpl?.bodyGrad) || pCfg.bodyGrad || { light: '#4B8DF1', mid: '#3B82F6', dark: '#3171EC' },
            headGrad: (tpl?.headGrad) || pCfg.headGrad || { light: '#F2FFF2', mid: '#F8F8F8', dark: '#F0F0F0' },
        };
    }

    // ============================================================
    //  人形绘制（玩家和队友共用）
    // ============================================================
    function _drawHumanoid(ctx, px, py, tpl, visualScale, weaponDir, config) {
        const dir = (weaponDir === -1) ? -1 : 1;
        const bodyRadius = tpl.radius * visualScale;
        const headRadius = bodyRadius * 0.55;
        const headOffsetY = -bodyRadius * 1.25;
        const pCfg = config?.PLAYER || {};

        // 身体
        const bodyGrad = ctx.createRadialGradient(
            px - bodyRadius * 0.3, py - bodyRadius * 0.3, 2,
            px, py, bodyRadius
        );
        bodyGrad.addColorStop(0, tpl.bodyGrad.light);
        bodyGrad.addColorStop(0.8, tpl.bodyGrad.mid);
        bodyGrad.addColorStop(1, tpl.bodyGrad.dark);
        ctx.beginPath();
        ctx.arc(px, py, bodyRadius, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // 头部
        const headGrad = ctx.createRadialGradient(
            px - headRadius * 0.3, py + headOffsetY - headRadius * 0.3, 2,
            px, py + headOffsetY, headRadius
        );
        headGrad.addColorStop(0, tpl.headGrad.light);
        headGrad.addColorStop(0.8, tpl.headGrad.mid);
        headGrad.addColorStop(1, tpl.headGrad.dark);
        ctx.beginPath();
        ctx.arc(px, py + headOffsetY, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();

        // 武器
        const angleRad = (pCfg.weaponAngleDeg || 30) * Math.PI / 180;
        const lenRatio = pCfg.weaponLengthRatio || 1.2;
        const startOffsetX = bodyRadius * 0.7 * dir;
        const startOffsetY = -bodyRadius * 0.1;
        const endX = startOffsetX + Math.cos(angleRad) * bodyRadius * lenRatio * dir;
        const endY = startOffsetY - Math.sin(angleRad) * bodyRadius * lenRatio;
        ctx.beginPath();
        ctx.moveTo(px + startOffsetX, py + startOffsetY);
        ctx.lineTo(px + endX, py + endY);
        ctx.strokeStyle = pCfg.weaponColor || '#FFFFFF';
        ctx.lineWidth = (pCfg.weaponLineWidth || 4) * visualScale;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        return bodyRadius;
    }

    // ============================================================
    //  绘制玩家
    // ============================================================
    function drawPlayer(ctx, screenX, screenY, player, config, baseRadius, visualScale) {
        const pCfg = config?.PLAYER || {};
        const tpl = _genderTemplate(player.gender, config);
        const visualRadius = tpl.radius * visualScale;

        // 阴影
        ctx.save();
        ctx.translate(screenX, screenY + visualRadius * 0.8);
        ctx.scale(1, 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, visualRadius * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${pCfg.shadowAlpha || 0.3})`;
        ctx.fill();
        ctx.restore();

        // 人形
        const weaponDir = (player.weaponDir === -1) ? -1 : 1;
        _drawHumanoid(ctx, screenX, screenY - 6, tpl, visualScale, weaponDir, config);

        // 血条
        const hpRatio = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHp || 1)));
        const barWidth = pCfg.barWidth || 56;
        const barHeight = pCfg.barHeight || 10;
        const barX = screenX - barWidth / 2;
        const barY = screenY - visualRadius - (pCfg.barYOffset || 34);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = hpRatio > 0.3 ? '#44cc44' : '#cc4444';
        ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpRatio, barHeight - 2);
    }

    // ============================================================
    //  绘制怪物
    // ============================================================
    function drawMonster(ctx, screenX, screenY, monster, config) {
        const mCfg = config?.MONSTER || {};
        const radius = mCfg.radius || 24;
        const x = screenX;
        const y = screenY;

        // 阴影
        ctx.save();
        ctx.translate(x, y + radius * 1.2);
        ctx.scale(1, 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${mCfg.shadowAlpha || 0.3})`;
        ctx.fill();
        ctx.restore();

        // 身体
        const col = monster.color || '#8B0000';
        ctx.save();
        ctx.translate(x, y);
        const grad = ctx.createRadialGradient(
            -radius * 0.2, -radius * 0.2, 2,
            0, 0, radius
        );
        grad.addColorStop(0, _lighten(col, 0.02));
        grad.addColorStop(0.7, col);
        grad.addColorStop(1, _darken(col, 0.02));
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 眼睛
        const eyeOffsetX = radius * (mCfg.eyeOffsetX || 0.35);
        const eyeOffsetY = radius * (mCfg.eyeOffsetY || -0.2);
        const eyeRadius = Math.max(1.5, radius * (mCfg.eyeRadiusRatio || 0.08));
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 血条
        const hpRatio = Math.max(0, Math.min(1, (monster.hp || 0) / (monster.maxHp || 1)));
        const barWidth = mCfg.barWidth || 64;
        const barHeight = mCfg.barHeight || 10;
        const barX = x - barWidth / 2;
        const barY = y - radius - (mCfg.barYOffset || 18) - 4;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = hpRatio > 0.3 ? '#44cc44' : '#cc4444';
        ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barWidth - 4) * hpRatio), barHeight - 4);

        // 文字信息
        const hpText = `HP ${Math.floor(monster.hp)}/${monster.maxHp}`;
        const level = monster.unit?.level || monster.level || '?';
        const nameText = `${monster.unit?.name || monster.name || '怪物'} Lv.${level}`;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.font = mCfg.hpTextFont || 'bold 12px Arial, sans-serif';
        ctx.fillStyle = mCfg.hpTextColor || '#FFFFFF';
        ctx.fillText(hpText, x, barY - 2);
        ctx.font = mCfg.nameTextFont || 'bold 11px Arial, sans-serif';
        ctx.fillStyle = mCfg.nameTextColor || '#FFD700';
        ctx.fillText(nameText, x, barY - 18);
        ctx.restore();
    }

    // ============================================================
    //  绘制队友
    // ============================================================
    function drawPartner(ctx, screenX, screenY, partner, config, visualScale) {
        const pCfg = config?.PARTNER || {};
        const tpl = _genderTemplate(partner.gender, config);
        const bodyRadius = tpl.radius * (visualScale || 1);

        // 阴影
        ctx.save();
        ctx.translate(screenX, screenY + bodyRadius * 0.8);
        ctx.scale(1, 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, bodyRadius * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.restore();

        // 人形
        _drawHumanoid(ctx, screenX, screenY - 6, tpl, visualScale || 1, partner.weaponDir, config);

        // 友方光环
        ctx.beginPath();
        ctx.arc(screenX, screenY - 6, bodyRadius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = pCfg.allyRingColor || 'rgba(120,220,150,0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 名字
        const prevAlign = ctx.textAlign;
        ctx.textAlign = 'center';
        ctx.fillStyle = pCfg.nameTagColor || '#eafff0';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillText((partner.name || '队友') + ' Lv.' + (partner.level || 1), screenX, screenY - bodyRadius - 22);

        // 血条
        const bw = pCfg.barWidth || 64;
        const bh = pCfg.barHeight || 8;
        const bx = screenX - bw / 2;
        const by = screenY - bodyRadius - 14;
        const ratio = Math.max(0, Math.min(1, (partner.hp || 0) / (partner.maxHp || 1)));
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = ratio > 0.5 ? '#4cd964' : (ratio > 0.25 ? '#f5a623' : '#e04f4f');
        ctx.fillRect(bx, by, bw * ratio, bh);
        ctx.textAlign = prevAlign;
    }

    // ============================================================
    //  导出
    // ============================================================
    return {
        drawPlayer: drawPlayer,
        drawMonster: drawMonster,
        drawPartner: drawPartner,
    };
})();

console.log('[EntityRenderer] ✅ 已加载（玩家/怪物/队友绘制）');
// ================================================================
//  📁 js/render/OverlayRenderer.js
//  覆盖层绘制器（HUD / 伤害数字 / 经验飘字 / 拾取 / 技能条）
//  版本：v2.0（技能冷却方案落地：咏唱条一体化 + GCD回退 + 左下角灰字）
//  职责：纯绘制函数，无状态，接收配置和坐标
// ================================================================

window.OverlayRenderer = (() => {
    'use strict';

    // ============================================================
    //  工具：roundRect polyfill 检查
    // ============================================================
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (r > w / 2) r = w / 2;
            if (r > h / 2) r = h / 2;
            this.moveTo(x + r, y);
            this.lineTo(x + w - r, y);
            this.quadraticCurveTo(x + w, y, x + w, y + r);
            this.lineTo(x + w, y + h - r);
            this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            this.lineTo(x + r, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - r);
            this.lineTo(x, y + r);
            this.quadraticCurveTo(x, y, x + r, y);
            return this;
        };
    }

    // ============================================================
    //  1. 伤害数字
    // ============================================================
    function drawDamageNumbers(ctx, damageNumbers, offsetX, offsetY, config) {
        if (!damageNumbers || damageNumbers.length === 0) return;
        var cfg = config?.DAMAGE || {};
        var fontSize = cfg.fontSize || 54;
        var riseSpeed = cfg.riseSpeed || 180;

        ctx.save();
        for (var i = 0; i < damageNumbers.length; i++) {
            var d = damageNumbers[i];
            if (d.alpha <= 0) continue;
            var sx = d.x - offsetX;
            var sy = d.y - offsetY - riseSpeed * (1 - d.alpha);
            var scale = d.scale || 1.0;
            var size = fontSize * scale;

            ctx.globalAlpha = Math.min(1, d.alpha * 1.2);
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = cfg.shadowBlur || 12;
            ctx.fillStyle = d.isCrit ? (cfg.critColor || '#ffaa00') : (cfg.normalColor || '#ffffff');
            ctx.strokeStyle = cfg.strokeColor || '#000000';
            ctx.lineWidth = (cfg.strokeWidth || 3) * scale;
            ctx.font = 'bold ' + size + 'px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = cfg.shadowBlur || 12;
            ctx.strokeText(d.text, sx, sy);
            ctx.fillText(d.text, sx, sy);
        }
        ctx.restore();
    }

    // ============================================================
    //  2. 经验飘字
    // ============================================================
    function drawExperienceNumbers(ctx, expNumbers, offsetX, offsetY, config, viewWidth, viewHeight) {
        if (!expNumbers || expNumbers.length === 0) return;
        var cfg = config?.EXP || {};
        var fontSize = cfg.fontSize || 36;
        var padding = cfg.padding || 8;
        var lineHeight = fontSize * (cfg.lineHeightRatio || 1.3);
        var positionX = cfg.positionX || 0.85;
        var shadowBlur = cfg.shadowBlur || 10;

        ctx.save();
        for (var i = 0; i < expNumbers.length; i++) {
            var e = expNumbers[i];
            if (e.alpha <= 0) continue;
            var alpha = Math.min(1, e.alpha * 1.2);
            ctx.globalAlpha = alpha;
            var x = viewWidth * positionX;
            var y = e.y - offsetY - (cfg.riseSpeed || 60) * (1 - e.alpha);

            var lines = ['Base/' + e.exp, 'Job/' + e.jobExp];
            ctx.font = cfg.font || 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            var maxWidth = 0;
            for (var j = 0; j < lines.length; j++) {
                var metrics = ctx.measureText(lines[j]);
                if (metrics.width > maxWidth) maxWidth = metrics.width;
            }

            var boxWidth = maxWidth + padding * 2;
            var boxHeight = lineHeight * lines.length + padding * 2;
            var boxX = x - boxWidth / 2;
            var boxY = y - boxHeight / 2;

            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = shadowBlur;
            ctx.fillStyle = 'rgba(0,0,0,' + (cfg.boxBgAlpha || 0.7) + ')';
            var radius = cfg.boxRadius || 6;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (var k = 0; k < lines.length; k++) {
                var lineY = boxY + padding + lineHeight * k + lineHeight / 2;
                ctx.fillStyle = k === 0 ? (cfg.baseColor || '#FFD700') : (cfg.jobColor || '#87CEEB');
                ctx.fillText(lines[k], x, lineY);
            }
        }
        ctx.restore();
    }

    // ============================================================
    //  3. 拾取通知
    // ============================================================
    function drawLootNotifications(ctx, lootNotifications, offsetX, offsetY, config) {
        if (!lootNotifications || lootNotifications.length === 0) return;
        var cfg = config?.LOOT || {};
        var riseSpeed = cfg.riseSpeed || 40;
        var padding = cfg.padding || 10;

        ctx.save();
        for (var i = 0; i < lootNotifications.length; i++) {
            var n = lootNotifications[i];
            if (n.alpha <= 0) continue;
            var sx = n.x - offsetX;
            var sy = n.y - offsetY - riseSpeed * (1 - n.alpha);

            ctx.globalAlpha = Math.min(1, n.alpha);
            ctx.font = cfg.font || 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            var metrics = ctx.measureText(n.text);
            var width = metrics.width + padding * 2;
            var height = cfg.height || 42;
            var bx = sx - width / 2;
            var by = sy - height / 2;

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,' + (cfg.bgAlpha || 0.5) * n.alpha + ')';
            ctx.beginPath();
            ctx.roundRect(bx, by, width, height, 8);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,215,0,' + (0.8 * n.alpha) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx, by, width, height, 8);
            ctx.stroke();

            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = cfg.shadowBlur || 8;
            ctx.fillStyle = 'rgba(255,215,0,' + n.alpha + ')';
            ctx.fillText(n.text, sx, sy);
        }
        ctx.restore();
    }

    // ============================================================
    //  4. 技能名飘字
    // ============================================================
    function drawSkillNames(ctx, skillNames, offsetX, offsetY, config) {
        if (!skillNames || skillNames.length === 0) return;
        ctx.save();
        for (var i = 0; i < skillNames.length; i++) {
            var s = skillNames[i];
            if (s.alpha <= 0) continue;
            var sx = s.x - offsetX;
            var sy = s.y - offsetY - 50;
            ctx.globalAlpha = Math.min(1, s.alpha * 1.2);
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.text, sx, sy);
        }
        ctx.restore();
    }

    // ============================================================
    //  5. 打断文本
    // ============================================================
    function drawInterruptTexts(ctx, interruptTexts, offsetX, offsetY, config) {
        if (!interruptTexts || interruptTexts.length === 0) return;
        var cfg = config?.INTERRUPT || {};
        var riseSpeed = cfg.riseSpeed || 120;

        ctx.save();
        for (var i = 0; i < interruptTexts.length; i++) {
            var it = interruptTexts[i];
            if (it.alpha <= 0) continue;
            var sx = it.x - offsetX;
            var sy = it.y - offsetY - riseSpeed * (1 - it.alpha);
            ctx.globalAlpha = Math.min(1, it.alpha * 1.2);
            ctx.shadowColor = cfg.shadowColor || 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = cfg.shadowBlur || 12;
            ctx.fillStyle = cfg.color || '#FF0000';
            ctx.font = cfg.font || 'bold 40px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(it.text, sx, sy);
        }
        ctx.restore();
    }

// ============================================================
//  6. 技能状态条（脚下咏唱 / 冷却回退）
//    ★ v2.5 修正：
//      - 冷却回退：每帧重绘快照，宽度按剩余比例递减
//      - 右侧自然留空，形成消退效果
// ============================================================
function drawSkillStatus(ctx, player, status, config, viewWidth, viewHeight) {
    if (!player || !status) return;

    var barCfg = config?.SKILL_BAR || {};
    var labels = barCfg.labels || {};
    var showLabelOnBar = barCfg.showLabelOnBar !== false;

    var px = viewWidth / 2;
    var py = viewHeight / 2;
    var visualRadius = player.visualRadius || 24;
    var barY = py + visualRadius + (barCfg.yOffset || 36) + (barCfg.extraYOffset || 5);

    var barWidth = barCfg.width || 200;
    var barHeight = barCfg.height || 28;
    var barX = px - barWidth / 2;
    var padding = barCfg.padding !== undefined ? barCfg.padding : 4;
    var cornerRadius = barCfg.cornerRadius || 8;
    var fontSize = barCfg.fontSize || 18;
    var labelFontSize = fontSize * (barCfg.labelFontSizeRatio || 0.7);

    // ---- 状态判断 ----
    var fillPercent = 0;
    var isActive = false;
    var isCasting = false;
    var totalTime = 0;
    var remainTime = 0;
    var fixedRatio = 0;

    // 咏唱状态
    if (status.isCasting && status.castTotal > 0) {
        isActive = true;
        isCasting = true;
        fillPercent = Math.min(1, (status.castProgress || 0) / status.castTotal);
        totalTime = status.castTotal;
        remainTime = totalTime - (status.castProgress || 0);
        fixedRatio = status.fixedRatio || 0;
    }
    // 冷却回退（GCD ≥ 1.0 且无咏唱）
    else if (!status.isCasting) {
        var gcdRemaining = status.gcdRemaining || 0;
        var gcdTotal = status.gcdTotal || 0;
        if (gcdTotal >= 1.0 && gcdRemaining > 0) {
            isActive = true;
            isCasting = false;
            // ★ 填充比例 = 剩余时间 / 总时间（从 1 → 0）
            fillPercent = gcdRemaining / gcdTotal;
            totalTime = gcdTotal;
            remainTime = gcdRemaining;
            fixedRatio = 0;
        }
    }

    // 没有任何活动或即将结束（< 0.5%），不绘制
    if (!isActive || fillPercent < 0.005) return;

    // ============================================================
    //  绘制玻璃管容器（每次重新绘制，作为清空）
    // ============================================================
    ctx.shadowBlur = 0;

    // 背景（透明基底）
    ctx.fillStyle = 'rgba(0,0,0,' + (barCfg.bgAlpha || 0.75) + ')';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, cornerRadius);
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, cornerRadius);
    ctx.stroke();

    // 内部填充区域
    var innerX = barX + padding;
    var innerY = barY + padding;
    var innerW = barWidth - padding * 2;
    var innerH = barHeight - padding * 2;

    // ★ 当前填充宽度 = 总宽度 × 当前比例
    var fillW = Math.max(0, innerW * fillPercent);

    if (fillW < 0.5) {
        // 太小了，跳过填充绘制
    } else {
        // ============================================================
        //  填充主体（使用 fillRect，无圆角）
        // ============================================================
        if (isCasting) {
            // ---- 咏唱阶段：变咏（橙黄）+ 固咏（金色） ----
            var variableRatio = 1 - fixedRatio;
            var variableW = innerW * variableRatio;
            var variableFilled = Math.min(1, fillPercent / (variableRatio || 0.001));

            // 变咏
            if (variableFilled > 0.01 && variableW > 1) {
                var vFillW = Math.max(0, variableW * variableFilled);
                ctx.fillStyle = barCfg.castVariableColor || '#FF8C00';
                ctx.fillRect(innerX, innerY, vFillW, innerH);
            }

            // 固咏
            var fixedFilled = Math.min(1, (fillPercent - variableRatio) / (fixedRatio || 0.001));
            if (fixedFilled > 0.01 && fixedRatio > 0) {
                var fixedStartX = innerX + variableW;
                var fixedFillW = Math.max(0, (innerW - variableW) * fixedFilled);
                if (fixedFillW > 0.5) {
                    ctx.fillStyle = barCfg.castFixedColor || '#FFD700';
                    ctx.fillRect(fixedStartX, innerY, fixedFillW, innerH);
                }
            }

            // 过渡带
            if (variableRatio > 0 && fixedRatio > 0 && variableFilled > 0.2 && fixedFilled > 0.2) {
                var gradW = 4;
                var gradX = innerX + variableW - gradW / 2;
                var grad = ctx.createLinearGradient(gradX, 0, gradX + gradW, 0);
                grad.addColorStop(0, 'rgba(255, 140, 0, 0.3)');
                grad.addColorStop(0.5, 'rgba(255, 180, 0, 0.15)');
                grad.addColorStop(1, 'rgba(255, 215, 0, 0.3)');
                ctx.fillStyle = grad;
                ctx.fillRect(gradX, innerY, gradW, innerH);
            }
        } 

// ---- ★ 冷却回退阶段：从右向左消退，先削减固咏，再削减变咏 ----
else {
    // 从快照读取变咏/固咏的原始宽度和颜色
    var snapshotVarRatio = status._snapshotVariableRatio || 0.6;
    var snapshotFixRatio = status._snapshotFixedRatio || 0.4;
    var varColor = status._snapshotColors?.variable || '#FF8C00';
    var fixColor = status._snapshotColors?.fixed || '#FFD700';

    // ★ 原始宽度（咏唱完成时的状态）
    var varFullWidth = innerW * snapshotVarRatio;
    var fixFullWidth = innerW * snapshotFixRatio;

    // ★ 当前总填充宽度 = 总宽度 × 剩余比例（从 1 → 0）
    var totalFillW = innerW * fillPercent;

    // ★ 变咏（左侧部分）优先保留
    // 当 totalFillW 大于变咏宽度时，变咏完整；小于时，变咏被裁剪
    var varW = Math.min(varFullWidth, totalFillW);
    // ★ 剩余宽度分配给固咏（右侧部分）
    var remainingW = Math.max(0, totalFillW - varW);
    var fixW = Math.min(fixFullWidth, remainingW);

    // 绘制变咏（橙黄）
    if (varW > 0.5) {
        ctx.fillStyle = varColor;
        ctx.fillRect(innerX, innerY, varW, innerH);
    }

    // 绘制固咏（金色），紧接在变咏之后
    if (fixW > 0.5) {
        ctx.fillStyle = fixColor;
        ctx.fillRect(innerX + varW, innerY, fixW, innerH);
    }

    // ★ 消退拖尾（增强速度感）
    if (totalFillW < innerW && fillPercent > 0.05) {
        var trailW = Math.min(6, innerW * 0.04);
        var trailStartX = innerX + totalFillW - trailW / 2;
        var trailGrad = ctx.createLinearGradient(trailStartX, 0, trailStartX + trailW * 2, 0);
        var alpha = Math.min(0.25, fillPercent * 0.3);
        trailGrad.addColorStop(0, 'rgba(255, 180, 0, ' + (alpha * 0.5) + ')');
        trailGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(trailStartX, innerY, trailW * 2, innerH);
    }
}

        // 顶部高光
        var hlGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
        hlGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(innerX, innerY, fillW, innerH);
    }

    // ============================================================
    //  文字信息
    // ============================================================
    var remainText = remainTime.toFixed(1);
    var totalText = totalTime.toFixed(1);

    ctx.shadowColor = barCfg.textShadow || 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = barCfg.textColor || '#FFFFFF';
    ctx.font = 'bold ' + fontSize + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(remainText + 's / ' + totalText + 's', px, barY + barHeight / 2);
    ctx.shadowBlur = 0;

    if (showLabelOnBar) {
        ctx.font = 'bold ' + labelFontSize + 'px Arial, sans-serif';
        ctx.fillStyle = isCasting ? (barCfg.castVariableColor || '#FF8C00') : '#CC8844';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(isCasting ? (labels.castVariable || '变咏') : (labels.gcd || '冷却'), barX + padding, barY - 2);
        if (isCasting) {
            ctx.fillStyle = barCfg.castFixedColor || '#FFD700';
            ctx.textAlign = 'right';
            ctx.fillText(labels.castFixed || '固咏', barX + barWidth - padding, barY - 2);
        }
    }
}


    // ============================================================
    //  7. ★ 左下角灰字：独立冷却列表
    //    位置：左下角，灰色小字，仅显示独立冷却 > GCD 的技能
    // ============================================================
    function drawCooldownList(ctx, status, config, viewWidth, viewHeight) {
        var list = status.cooldownList;
        if (!list || list.length === 0) return;

        var padding = 12;
        var x = padding + 8;
        var y = viewHeight - padding - 20;
        var lineHeight = 20;
        var maxDisplay = 5;

        ctx.save();

        // 半透明背景（极淡，几乎看不见）
        var bgHeight = Math.min(list.length, maxDisplay) * lineHeight + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.roundRect(x - 6, y - 14, 120, bgHeight, 4);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowBlur = 0;

        var displayCount = Math.min(list.length, maxDisplay);
        for (var i = 0; i < displayCount; i++) {
            var item = list[i];
            // ★ 如果独立冷却剩余 < 0.1 秒，认为已结束，不再显示
            if (item.remaining < 0.1) continue;
            var displayName = item.aegis;
            // 尝试从 SkillGateway 获取显示名
            if (window.SkillGateway && typeof window.SkillGateway.getSkillByAegis === 'function') {
                var def = window.SkillGateway.getSkillByAegis(item.aegis);
                if (def && def.DisplayName) displayName = def.DisplayName;
                else if (def && def.Name) displayName = def.Name;
            }
            // 截断过长的名字
            if (displayName.length > 8) displayName = displayName.substring(0, 8) + '…';

            var text = displayName + ' ' + item.remaining.toFixed(1) + 's';
            ctx.fillStyle = 'rgba(160, 160, 160, 0.7)'; // 灰暗，低饱和度
            ctx.font = '12px Arial, sans-serif';
            ctx.fillText(text, x, y + i * lineHeight);
        }

        ctx.restore();
    }

    // ============================================================
    //  8. HUD（左上角血条 / 信息）
    // ============================================================
    function drawHUD(ctx, player, config, viewWidth, viewHeight) {
        if (!player) return;
        var cfg = config?.HUD || {};

        var level = player.level || 1;
        var name = player.name || '冒险者';

        var padding = 15;
        var x = padding;
        var y = padding;

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = cfg.nameShadow || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = cfg.nameColor || '#FFFFFF';
        ctx.font = cfg.nameFont || '16px Arial, sans-serif';
        ctx.fillText(name + '  Lv.' + level, x, y + (cfg.yNameOffset || 0));

        var hpBarX = x;
        var hpBarY = y + (cfg.yHpBarOffset || 20);
        var hpBarWidth = cfg.hpBarWidth || 240;
        var hpBarHeight = cfg.hpBarHeight || 18;
        var hpRatio = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHp || 1)));

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,' + (cfg.barBgAlpha || 0.1) + ')';
        ctx.beginPath();
        ctx.roundRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.fillStyle = cfg.hpColor || '#33CC66';
        ctx.beginPath();
        ctx.roundRect(hpBarX, hpBarY, hpBarWidth * hpRatio, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,' + (cfg.strokeAlpha || 0.2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.stroke();

        var hpGrad = ctx.createLinearGradient(hpBarX, hpBarY, hpBarX, hpBarY + hpBarHeight);
        hpGrad.addColorStop(0, 'rgba(255,255,255,' + (cfg.highlightTopAlpha || 0.2) + ')');
        hpGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
        hpGrad.addColorStop(1, 'rgba(0,0,0,' + (cfg.highlightBottomAlpha || 0.08) + ')');
        ctx.fillStyle = hpGrad;
        ctx.beginPath();
        ctx.roundRect(hpBarX, hpBarY, hpBarWidth * hpRatio, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.shadowColor = cfg.valueShadow || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = cfg.valueColor || '#FFFFFF';
        ctx.font = cfg.valueFont || 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            Math.floor(player.hp || 0) + ' / ' + player.maxHp || 0,
            hpBarX + hpBarWidth / 2,
            hpBarY + hpBarHeight / 2
        );

        // SP 条
        var spBarY = hpBarY + hpBarHeight + (cfg.spGap || 6);
        var spRatio = player.sp !== undefined
            ? Math.max(0, Math.min(1, (player.sp || 0) / (player.maxSp || 1)))
            : 1;

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,' + (cfg.barBgAlpha || 0.1) + ')';
        ctx.beginPath();
        ctx.roundRect(hpBarX, spBarY, hpBarWidth, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.fillStyle = cfg.spColor || '#66AAFF';
        ctx.beginPath();
        ctx.roundRect(hpBarX, spBarY, hpBarWidth * spRatio, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,' + (cfg.strokeAlpha || 0.2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hpBarX, spBarY, hpBarWidth, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.stroke();

        var spGrad = ctx.createLinearGradient(hpBarX, spBarY, hpBarX, spBarY + hpBarHeight);
        spGrad.addColorStop(0, 'rgba(255,255,255,' + (cfg.highlightTopAlpha || 0.2) + ')');
        spGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
        spGrad.addColorStop(1, 'rgba(0,0,0,' + (cfg.highlightBottomAlpha || 0.08) + ')');
        ctx.fillStyle = spGrad;
        ctx.beginPath();
        ctx.roundRect(hpBarX, spBarY, hpBarWidth * spRatio, hpBarHeight, cfg.hpBarRadius || 12);
        ctx.fill();

        ctx.shadowColor = cfg.valueShadow || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = cfg.valueColor || '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var spDisplay = player.sp !== undefined
            ? Math.floor(player.sp || 0) + ' / ' + player.maxSp || 0
            : 'SP';
        ctx.fillText(spDisplay, hpBarX + hpBarWidth / 2, spBarY + hpBarHeight / 2);
        ctx.restore();
    }

    // ============================================================
    //  导出
    // ============================================================
    return {
        drawDamageNumbers: drawDamageNumbers,
        drawExperienceNumbers: drawExperienceNumbers,
        drawLootNotifications: drawLootNotifications,
        drawSkillNames: drawSkillNames,
        drawInterruptTexts: drawInterruptTexts,
        drawSkillStatus: drawSkillStatus,
        drawCooldownList: drawCooldownList,
        drawHUD: drawHUD,
    };
})();

console.log('[OverlayRenderer] ✅ v2.0 已加载（咏唱一体化 + GCD回退 + 左下角灰字）');
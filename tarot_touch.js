let isProcessingDraw = false;

window.fingerDrag = { x: 0, y: 0, dx: 0, dy: 0, active: false, timer: null };
let fdLastX = null;
let fdLastY = null;

function applyDragForce(x, y, dx, dy) {
    // 🛡️ 核心防線 1：如果你的觸控事件沒有傳遞 dx, dy，系統自己幫你精算！
    let actualDx = dx !== undefined ? dx : (fdLastX !== null ? x - fdLastX : 0);
    let actualDy = dy !== undefined ? dy : (fdLastY !== null ? y - fdLastY : 0);

    fdLastX = x;
    fdLastY = y;

    // 🛡️ 核心防線 2：絕對防禦 NaN 毒藥！只要算出來不是數字就歸零，保證牌絕對不會再消失！
    if (isNaN(actualDx)) actualDx = 0;
    if (isNaN(actualDy)) actualDy = 0;

    // 將安全的座標與向量寫入全域，供底層引擎使用
    window.fingerDrag.x = x;
    window.fingerDrag.y = y;
    window.fingerDrag.dx = actualDx;
    window.fingerDrag.dy = actualDy;
    window.fingerDrag.active = true;

    // 防呆計時器：手指停下 100ms 後自動解除攪拌，並清除上次座標
    clearTimeout(window.fingerDrag.timer);
    window.fingerDrag.timer = setTimeout(() => {
        window.fingerDrag.active = false;
        fdLastX = null;
        fdLastY = null;
    }, 100);
}

// 💡 確保在 touchend (手指離開螢幕) 時也清空座標，避免下次點擊產生瞬間移動
// ✨ 修正：改用 touchAreaEl 作為變數名稱，完美避開與頂部 container 的命名衝突！
const touchAreaEl = document.getElementById('ritual-container');
if (touchAreaEl) {
    touchAreaEl.addEventListener('touchend', () => {
        fdLastX = null;
        fdLastY = null;
        if (window.fingerDrag) window.fingerDrag.active = false;
    });
}

// 用來獨立追蹤每一根手指(或滑鼠)的軌跡，解鎖完美多點觸控
let activePointers = {};
let touchStartY = 0;
// 1. 替換 confirmDrawCard 函式
function confirmDrawCard() {
    // ✨ 1. 如果正在處理中，直接退回，不允許再次點擊
    if (isProcessingDraw) return;

    // ✨ 【優化機制】：如果已經選滿了，此時點擊「確認排盤」按鈕，才真正進入解牌室
    if (drawnCount >= spreadSlots.length) {
        const drawUi = document.getElementById('draw-ui');
        if (drawUi) drawUi.classList.add('hidden');
        hideSelectionBoundary(); // 確保殘框完全隱藏

        if (typeof BL !== 'undefined') BL.show('draw_place', '神諭已定，正在開啟解牌室...');
        setTimeout(() => {
            if (typeof finalizeSpread === 'function') finalizeSpread();
        }, 400);
        return;
    }

    if (!selectedCard || selectedCard.isDrawn) return;

    const topCard = selectedCard;
    const slot = spreadSlots[drawnCount];
    isProcessingDraw = true;

    drawnCardsStack.push({
        card: topCard,
        originalTargetPos: topCard.originalPos || { ...topCard.position },
        originalTargetAngle: topCard.targetAngle,
        slotIndex: drawnCount
    });

    topCard.isDrawn = true;
    topCard.isAnimating = false;

    topCard.targetPos = { x: -2000, y: -2000 };
    if (topCard.render) topCard.render.visible = false;

    currentRitualData.cards.push({
        slotIndex: drawnCount,
        id: topCard.tarotData.id,
        name: topCard.tarotData.name,
        isReversed: topCard.tarotData.isReversed,
        image: topCard.tarotData.image
    });

    if (slot && slot.el) {
        slot.el.style.backgroundColor = 'white';
        slot.el.style.boxShadow = '0 0 5px rgba(255,255,255,0.8)';
        slot.el.classList.remove('animate-pulse');
    }

    drawnCount++;
    selectedCard = null;
    hideSelectionBoundary(); // ✨ 核心修復：選定卡牌後，立刻強制隱藏 HTML 選取殘框

    if (currentRitualData.spread === 'single') {
        const drawUi = document.getElementById('draw-ui');
        if (drawUi) drawUi.classList.add('hidden');
        
        if (typeof BL !== 'undefined') BL.show('draw_place', '神諭已定，正在開啟解牌室...');
        setTimeout(() => {
            if (typeof finalizeSpread === 'function') finalizeSpread();
        }, 400); // 這裡保留 400ms 是為了讓卡牌浮起特效播完
        return; 
    }

    if (drawnCount < spreadSlots.length) {
        // 還有牌要抽：正常引導下一張
        const nextSlot = spreadSlots[drawnCount];
        if (nextSlot && nextSlot.el) {
            nextSlot.el.style.backgroundColor = '#fef08a';
            nextSlot.el.style.boxShadow = '0 0 15px rgba(253, 224, 71, 0.6)';
            nextSlot.el.classList.add('animate-pulse');
        }

        updateDrawButtons();
        getDrawPromptText(drawnCount).then(txt => {
            if (typeof BL !== 'undefined') BL.show('draw_place', txt);
        });
    } else {
        // ✨ 【核心進化】：剛好選滿最後一張牌！不直接隱藏 UI，而是改變按鈕狀態供玩家確認
        const btnConfirm = document.getElementById('btn-confirm-draw');
        if (btnConfirm) {
            btnConfirm.innerText = '🔮 確認排盤';
            btnConfirm.classList.remove('border-yellow-300', 'text-yellow-300');
            btnConfirm.classList.add('border-green-400', 'text-green-400', 'animate-bounce'); // 加入醒目的綠色跳動提示
        }
        if (typeof BL !== 'undefined') {
            BL.show('draw_place', '✅ 所有牌卡已選定！您可以點擊「確認排盤」或進行「撤回」調整。');
        }
        updateDrawButtons(); // 刷新按鈕狀態，讓撤回維持啟用
    }
    setTimeout(() => {
        isProcessingDraw = false;
    }, 300);
}

function undoDrawCard() {
    if (drawnCardsStack.length === 0) return;

    const btnConfirm = document.getElementById('btn-confirm-draw');
    if (btnConfirm) {
        btnConfirm.innerText = '✨ 確定選取';
        btnConfirm.classList.remove('border-green-400', 'text-green-400', 'animate-bounce');
        btnConfirm.classList.add('border-yellow-300', 'text-yellow-300');
    }

    hideSelectionBoundary();

    if (selectedCard) {
        selectedCard.targetPos = { ...selectedCard.originalPos };
        selectedCard.targetAngle = 0;
        selectedCard.zVelocity = 0;
        selectedCard.isAnimating = true;
        selectedCard.zScore = 0;
        selectedCard = null;
    }

    const lastAction = drawnCardsStack.pop();
    const card = lastAction.card;

    card.isDrawn = false;
    if (card.render) card.render.visible = true;

    selectedCard = card;

    card.targetPos = {
        x: lastAction.originalTargetPos.x + 10,
        y: lastAction.originalTargetPos.y - 15
    };
    card.targetAngle = 0.15;
    card.zScore = 2000;
    card.zVelocity = 0.2;
    card.isAnimating = true;

    Matter.Body.setPosition(card, lastAction.originalTargetPos);

    currentRitualData.cards.pop();

    // ✨ 核心安全修復：安全復原當前拋棄的雷達格樣式
    if (spreadSlots[drawnCount]) {
        const abandonedSlot = spreadSlots[drawnCount];
        if (abandonedSlot && abandonedSlot.el) {
            abandonedSlot.el.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
            abandonedSlot.el.style.boxShadow = 'none';
            abandonedSlot.el.classList.remove('animate-pulse');
        }
    }

    drawnCount--; // 退回上一步

    // ✨ 核心安全修復：安全點亮退回的上一格雷達樣式
    if (spreadSlots[drawnCount]) {
        const activeSlot = spreadSlots[drawnCount];
        if (activeSlot && activeSlot.el) {
            activeSlot.el.style.backgroundColor = '#fef08a';
            activeSlot.el.style.boxShadow = '0 0 15px rgba(253, 224, 71, 0.6)';
            activeSlot.el.classList.add('animate-pulse');
        }
    }

    updateDrawButtons();
    getDrawPromptText(drawnCount).then(txt => BL.show('draw_place', txt));
}

// 2. 替換 updateDrawButtons 函式
function updateDrawButtons() {
    const btnUndo = document.getElementById('btn-undo-draw');
    const btnConfirm = document.getElementById('btn-confirm-draw');

    if (btnUndo) {
        // 只要有抽取過牌卡，無論是否抽滿，皆允許撤回
        if (drawnCardsStack.length > 0) {
            btnUndo.removeAttribute('disabled');
            btnUndo.classList.remove('opacity-40', 'pointer-events-none');
        } else {
            btnUndo.setAttribute('disabled', 'true');
            btnUndo.classList.add('opacity-40', 'pointer-events-none');
        }
    }

    if (btnConfirm) {
        if (drawnCount >= spreadSlots.length) {
            // ✨ 選滿狀態下：按鈕已轉化為「確認排盤」，必須維持可以點擊的狀態
            btnConfirm.removeAttribute('disabled');
            btnConfirm.classList.remove('opacity-40', 'pointer-events-none');
        } else if (selectedCard) {
            // 選牌中且有鎖定牌卡
            btnConfirm.removeAttribute('disabled');
            btnConfirm.classList.remove('opacity-40', 'pointer-events-none');
        } else {
            // 選牌中但尚未選定特定牌卡
            btnConfirm.setAttribute('disabled', 'true');
            btnConfirm.classList.add('opacity-40', 'pointer-events-none');
        }
    }
}

// 手指離開螢幕時清除該點的紀錄
const handlePointerEnd = (e) => { delete activePointers[e.pointerId]; };
container.addEventListener('pointerup', handlePointerEnd);
container.addEventListener('pointercancel', handlePointerEnd);
container.addEventListener('pointerleave', handlePointerEnd);

// 解除物理引擎預設的鼠標鎖定
const mouseConstraint = MouseConstraint.create(engine, { mouse: Mouse.create(render.canvas), constraint: { render: { visible: false } } });
Events.on(mouseConstraint, 'mousedown', () => { mouseConstraint.constraint.bodyB = null; });
Composite.add(world, mouseConstraint);

// 需求 1：完美支援 10 根手指頭多點觸控
let initialPinchDistance = null;
// ✅ 新增這段：註冊每一根手指的起始點

container.addEventListener('pointerdown', (e) => {
    activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (currentState === 'SELECTING') {
        touchStartY = e.clientY;
        isPressingToDraw = true;

        const bodies = Query.point(cards, { x: e.clientX, y: e.clientY }).filter(c => !c.isDrawn);
        if (bodies.length > 0) {
            const topCard = bodies[bodies.length - 1];

            // ✨ 2. 點擊瞬間強制喚醒卡牌！解決點擊沒反應的休眠 Bug
            Matter.Sleeping.set(topCard, false);

            // ✨ 1. 優先處理「單牌神諭」模式的捷徑 (包含雙重變數安全防護)
            const isSingleMode = (typeof currentSelectedSpread !== 'undefined' && currentSelectedSpread === 'single') ||
                (typeof currentRitualData !== 'undefined' && currentRitualData.spread === 'single');

            if (isSingleMode) {
                selectedCard = topCard; // 先設定選中牌
                confirmDrawCard();      // 直接觸發確認，送進解牌室
                return;                 // 結束事件處理，不往下跑
            }

            // ✨ 2. 如果不是單牌，且還有扣打可以抽，才執行一般的「升起 / 降下」特效
            if (drawnCount < spreadSlots.length) {
                if (selectedCard !== topCard) {
                    // --- 降下舊牌 ---
                    if (selectedCard && !selectedCard.isDrawn) {
                        if (selectedCard.originalPos) {
                            selectedCard.targetPos = { ...selectedCard.originalPos };
                        }
                        selectedCard.targetAngle = selectedCard.originalAngle !== undefined ? selectedCard.originalAngle : 0;
                        selectedCard.zVelocity = 0;
                        selectedCard.isAnimating = true;
                        selectedCard.zScore = 0;
                    }

                    // --- 升起新牌 ---
                    selectedCard = topCard;
                    if (!topCard.originalPos) {
                        topCard.originalPos = topCard.targetPos ? { ...topCard.targetPos } : { x: topCard.position.x, y: topCard.position.y };
                    }
                    if (topCard.originalAngle === undefined) {
                        topCard.originalAngle = topCard.targetAngle !== undefined ? topCard.targetAngle : topCard.angle;
                    }

                    topCard.targetPos = {
                        x: (topCard.originalPos.x || topCard.position.x) + 15,
                        y: (topCard.originalPos.y || topCard.position.y) - 10
                    };

                    topCard.targetAngle = 0.15;
                    topCard.zScore = 1000;
                    topCard.zVelocity = 0.15;
                    topCard.isAnimating = true;

                    if (typeof triggerHaptic === 'function') triggerHaptic();
                    if (typeof updateDrawButtons === 'function') updateDrawButtons();

                } else {
                    // --- 再次點擊已選中的牌，把它放回去 ---
                    if (selectedCard.originalPos) {
                        selectedCard.targetPos = { ...selectedCard.originalPos };
                    }
                    selectedCard.targetAngle = selectedCard.originalAngle !== undefined ? selectedCard.originalAngle : 0;
                    selectedCard.zVelocity = 0;
                    selectedCard.isAnimating = true;
                    selectedCard.zScore = 0;

                    selectedCard = null; // 清空選取狀態

                    if (typeof triggerHaptic === 'function') triggerHaptic();
                    if (typeof updateDrawButtons === 'function') updateDrawButtons();

                    // 解開 Promise，讓呼吸燈正確顯示文字
                    getDrawPromptText(drawnCount).then(txt => {
                        if (typeof BL !== 'undefined') BL.show('draw_place', txt);
                    });
                }
            }
        }
    }
});

let isPressingToDraw = false; // 【新增】：用來鎖定選牌狀態

// 【修正版】：觸發微震動的輔助函數 (直接讀取 Cache，0 延遲)
function triggerHaptic() {
    // 拔除 localStorage
    if (SystemCache.haptic && navigator.vibrate) {
        navigator.vibrate(15);
    }
}

// tarot_touch.js -> pointermove 事件核心
container.addEventListener('pointermove', (e) => {
    if (!activePointers[e.pointerId]) return;

    // --- 狀態 A：洗牌中 (維持原有邏輯) ---
    if (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD') {
        let deltaX = e.clientX - activePointers[e.pointerId].x;
        let deltaY = e.clientY - activePointers[e.pointerId].y;
        applyDragForce(e.clientX, e.clientY, deltaX, deltaY);
        activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };

        // ... (省略中間的雙指收牌邏輯) ...
    }
    // --- 狀態 B：選牌中 (滑動預覽 + 滑動出牌) ---
    else if (currentState === 'SELECTING' && drawnCount < spreadSlots.length) {

        if (isPressingToDraw && selectedCard) {
            const selectMode = SystemCache.selectMode;
            if (selectMode === 'swipe') {
                let diffY = touchStartY - e.clientY;
                if (diffY > 60) {
                    confirmDrawCard();
                    isPressingToDraw = false;
                    return;
                }
            }
        }

        const bodies = Query.point(cards, { x: e.clientX, y: e.clientY }).filter(c => !c.isDrawn);

        if (bodies.length > 0) {
            const topCard = bodies[bodies.length - 1];
            Matter.Sleeping.set(topCard, false);

            if (selectedCard !== topCard) {
                // a. 舊牌降回原位
                if (selectedCard && !selectedCard.isDrawn) {
                    // ✨ 修正 1：確保 originalPos 存在才執行，否則不做動作，防止崩潰
                    if (selectedCard.originalPos) {
                        selectedCard.targetPos = { ...selectedCard.originalPos };
                    }
                    // ✨ 修正 2：恢復原始角度，不再強制歸零 (解決角度跑掉問題)
                    selectedCard.targetAngle = selectedCard.originalAngle !== undefined ? selectedCard.originalAngle : 0;

                    selectedCard.zScore = 0;
                    selectedCard.isAnimating = true;
                }

                // b. 新牌升起並傾斜
                selectedCard = topCard;

                // ✨ 修正 3：更穩定的初始化方式。若沒有 targetPos，就抓實體目前的 position
                if (!topCard.originalPos) {
                    topCard.originalPos = topCard.targetPos ? { ...topCard.targetPos } : { x: topCard.position.x, y: topCard.position.y };
                }
                // ✨ 修正 4：同步記錄原始角度
                if (topCard.originalAngle === undefined) {
                    topCard.originalAngle = topCard.targetAngle !== undefined ? topCard.targetAngle : topCard.angle;
                }

                // ✨ 修正 5：確保 originalPos 已經存在後才讀取 x, y，絕對防禦 Cannot read properties of undefined
                topCard.targetPos = {
                    x: (topCard.originalPos.x || topCard.position.x) + 5,
                    y: (topCard.originalPos.y || topCard.position.y) - 10
                };

                topCard.targetAngle = 0.12;
                topCard.zScore = 2000;
                topCard.zVelocity = 0.2;
                topCard.isAnimating = true;

                if (typeof triggerHaptic === 'function') triggerHaptic();
                if (typeof updateDrawButtons === 'function') updateDrawButtons();
            }
        }
    }
});

// 因為在 pointermove 已經處理了滑動出牌，pointerup 只需處理「單純點擊送出」或意外釋放
container.addEventListener('pointerup', (e) => {
    if (currentState !== 'SELECTING' || drawnCount >= spreadSlots.length) return;

    // ✨ 新增：單牌模式下，只要點擊或滑動放開，直接開牌！
    if (currentRitualData.spread === 'single' && selectedCard) {
        confirmDrawCard();
        isPressingToDraw = false;
        return;
    }

    let diffY = e.clientY - touchStartY;

    // 拔除 localStorage，直接讀取 Cache
    const selectMode = SystemCache.selectMode;

    // ✨ 終極鎖定：必須是「滑動模式」，才允許向上滑動出牌！
    if (isPressingToDraw && selectedCard && diffY < -30 && selectMode === 'swipe') {
        confirmDrawCard();
    }
    isPressingToDraw = false;
});

container.addEventListener('touchend', () => {
    initialPinchDistance = null;
    isPressingToDraw = false; // 觸控意外中斷時也確保解除防護罩
});

// ==========================================
// ✨ 行動裝置專用：雙指聚合 (Pinch In) 自動收牌手勢監聽器
// ==========================================
container.addEventListener('touchstart', (e) => {
    // 當處於洗牌狀態，且畫面上剛好有「兩根手指」觸碰時
    if (e.targetTouches.length === 2 && currentState === 'SHUFFLING'|| currentState === 'SHUFFLING_INWARD') {
        const t1 = e.targetTouches[0];
        const t2 = e.targetTouches[1];
        const pDx = t1.clientX - t2.clientX;
        const pDy = t1.clientY - t2.clientY;
        initialPinchDistance = Math.sqrt(pDx * pDx + pDy * pDy); // 記錄初始雙指距離
    }
}, { passive: true });

container.addEventListener('touchmove', (e) => {
    if (e.targetTouches.length === 2 && (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD')&& initialPinchDistance > 0) {
        const t1 = e.targetTouches[0];
        const t2 = e.targetTouches[1];
        const pDx = t1.clientX - t2.clientX;
        const pDy = t1.clientY - t2.clientY;
        const currentPinchDistance = Math.sqrt(pDx * pDx + pDy * pDy);

        // 🎯 如果兩根 fingers 之間的距離縮小超過 45 像素，代表玩家正在往內捏合
        if (initialPinchDistance - currentPinchDistance > 45) {
            initialPinchDistance = 0; // 立即歸零，嚴格防止單次手勢重複觸發

            // 契合系統設計：直接調用手動收牌按鈕的點擊事件！
            const btnGather = document.getElementById('btn-gather');
            if (btnGather && !btnGather.classList.contains('hidden')) {
                if (typeof triggerHaptic === 'function') triggerHaptic(); // 觸發輕微震動回饋
                btnGather.click(); // 自動幫玩家收牌！
            }
        }
    }
}, { passive: true });

container.addEventListener('touchend', () => {
    initialPinchDistance = 0; // 手指離開時重置
});
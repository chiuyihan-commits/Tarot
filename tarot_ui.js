// 全域狀態控制
let isRitualActive = false; // ✨ 新增：記錄儀式是否正在進行中
let isCardRevealing = false; // 專門用來鎖定「開牌動畫」的無敵狀態

// 全域函數：開啟歷史紀錄 (防狀態殘留版)
window.openHistoryScreen = async function () {
    // 1. 強制清除狀態殘留
    window.isInTrashView = false;
    try { if (typeof isInTrashView !== 'undefined') isInTrashView = false; } catch (e) { }

    // 2. 重置 UI 介面
    const btnTrash = document.getElementById('btn-trash-toggle');
    const title = document.getElementById('history-title');
    const screen = document.getElementById('screen-history');
    if (btnTrash) { btnTrash.innerText = '🗑️'; btnTrash.classList.remove('text-yellow-300'); btnTrash.classList.add('text-gray-400'); }
    if (title) title.innerText = '阿卡西紀錄';
    if (screen) screen.classList.remove('bg-stone-950/95');

    // ✨ 新增：確保每次進入時，搜尋過濾框都是完美收闔狀態
    const filterBar = document.getElementById('history-filter-bar');
    const filterBtn = document.getElementById('btn-filter-toggle');
    if (filterBar) {
        filterBar.classList.add('hidden');
        filterBar.style.opacity = '0';
    }
    if (filterBtn) filterBtn.classList.remove('opacity-50', 'scale-90');

    // 3. 強制重撈最新資料庫並觸發過濾
    if (typeof DB !== 'undefined') {
        window.allHistoryRecords = await DB.get('history', []);
    }
    if (typeof renderHistoryList === 'function') {
        await renderHistoryList();
    } else if (typeof applyHistoryFilters === 'function') {
        window.applyHistoryFilters();
    }

    navTo('screen-history');
};

// ✨ 全域：牌組專屬名稱轉換器 (動態將偉特名詞轉換為托特名詞)
window.translateCardName = function(name, deckKey) {
    if (deckKey !== 'thoth') return name;
    let newName = name;

    // 1. 宮廷牌階級轉換
    if (newName.includes('侍者')) newName = newName.replace('侍者', '騎士');
    else if (newName.includes('騎士')) newName = newName.replace('騎士', '皇后');
    else if (newName.includes('皇后')) newName = newName.replace('皇后', '王子');
    else if (newName.includes('國王')) newName = newName.replace('國王', '公主');
    
    // 2. 大阿爾克那轉換
    const majorMap = {
        '魔術師': '賢者',
        '力量': '慾望',
        '正義': '調節',
        '節制': '藝術',
        '命運之輪': '命運',
        '審判': '新紀元',
        '世界': '宇宙'
    };
    
    for (let rws in majorMap) {
        if (newName.includes(rws)) {
            newName = newName.replace(rws, majorMap[rws]);
            break;
        }
    }
    return newName;
};

// ============================================================================
// 🌟極簡還原版 (回歸手機原生行為，徹底解決閃退)
// ============================================================================
// 唯一保留的實用功能：讓使用者按下虛擬鍵盤的「Enter / 完成」時，可以正常收起鍵盤
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
    }
});

// ============================================================================
// 🔮 全域系統變數與設定 (Single Source of Truth)
// ============================================================================
// 全域狀態控制
let currentSelectedDeckSize = 78;
let currentSelectedSpread = 'single';
// ✨ 新增：洗牌與切牌的系統上限設定
const MAX_SHUFFLE_LIMIT = 10;
const MAX_CUT_LIMIT = 5;

const TAROT_SPREADS_CONFIG = [
    { id: 'single', name: '單牌 (1張)', icon: '🃏', desc: '解析直覺' },
    { id: 'triangle', name: '聖三角牌陣 (3張)', icon: '♻️', desc: '三張時序' },
    { id: 'five', name: '五連張牌陣 (5張)', icon: '⭐', desc: '五張時序' },
    { id: 'two_paths', name: '二選一牌陣 (5張)', icon: '⚖️', desc: '面臨抉擇的發展預測' }, 
    { id: 'hexagram', name: '六芒星牌陣 (7張)', icon: '✡️', desc: '全面的事件解析' },
    { id: 'horseshoe', name: '馬蹄牌陣 (7張)', icon: '🧲', desc: '深入探討問題來龍去脈' },
    { id: 'tree_of_life', name: '生命之樹 (10張)', icon: '🌳', desc: '卡巴拉靈性與物質顯化' },
    { id: 'celtic', name: '塞爾特十字 (10張)', icon: '✝️', desc: '深入剖析單一事件' },   
    { id: 'zodiac', name: '黃道十二宮 (12張)', icon: '🌌', desc: '年度總覽與全方位運勢' },
    { id: 'romany', name: '羅曼尼大牌陣 (21張)', icon: '👁️', desc: '吉普賽全景時序透視' }, // ✨ 新增
    { id: 'tableau', name: '大藍圖牌陣 (36張)', icon: '🗺️', desc: '終極全視角巨型陣法' }   // ✨ 新增
];

async function applyDefaultSettings() {
    const deckIcon = document.getElementById('setup-deck-icon');
    const deckLabel = document.getElementById('setup-deck-label');

    if (deckIcon && deckLabel) {
        if (currentSelectedDeckSize === 22) {
            deckIcon.textContent = '🎴';
            deckLabel.textContent = '22 張 (大阿爾克那)';
        } else if (currentSelectedDeckSize === 78) {
            deckIcon.textContent = '🌌';
            deckLabel.textContent = '78 張 (完整塔羅)';
        }
    }

    const spreadIcon = document.getElementById('setup-spread-icon');
    const spreadLabel = document.getElementById('setup-spread-label');

    if (spreadIcon && spreadLabel) {
        const currentSpreadData = TAROT_SPREADS_CONFIG.find(spread => spread.id === currentSelectedSpread);

        if (currentSpreadData) {
            spreadIcon.textContent = currentSpreadData.icon;
            spreadLabel.textContent = currentSpreadData.name;
        } else if (currentSelectedSpread && currentSelectedSpread.startsWith('custom_dynamic_')) {
            const count = parseInt(currentSelectedSpread.replace('custom_dynamic_', ''));
            spreadIcon.textContent = '🔢';
            spreadLabel.textContent = `自訂抽牌 (${count}張)`;
        } else if (currentSelectedSpread && currentSelectedSpread.startsWith('custom_saved_')) {
            const customSpreads = await DB.get('custom_spreads', []);
            const idx = parseInt(currentSelectedSpread.replace('custom_saved_', ''));
            if (customSpreads[idx]) {
                spreadIcon.textContent = customSpreads[idx].icon || '✨';
                spreadLabel.textContent = customSpreads[idx].name;
            }
        }
    }
}

// ==========================================
// 模組 2: 呼吸燈系統 (BL Engine-Async 升級版)
// ==========================================
const BL = {
    el: null, timer: null, currentId: null,
    savedConfig: {},
    defaults: {
        'manual_shuffle': { text: '拖曳洗牌👇', mode: 'action', time: 0 },
        'shuffle_start': { text: '搓動洗牌🙌', mode: 'action', time: 0 },
        'shuffle_idle': { text: '將牌收攏/點擊收牌🤲', mode: 'action', time: 0 },
        'cut_1': { text: '第一次切牌🫳請點擊', mode: 'action', time: 0 },
        'cut_2': { text: '第二次切牌🫳請點擊', mode: 'action', time: 0 },
        'draw_place': { text: '{n} 🫳', mode: 'action', time: 0 },

        // ✨ 修改 1：原本解牌室的提示改為 time 模式，並設定 1.5 秒 (時間單位是你原本設計的秒數)
        'read_card': { text: '點擊牌面看牌義👇', mode: 'time', time: 1.5 },

        // ✨ 修改 2：新增你想要的上下三角形專屬提示
        'scroll_hint': { text: '▲ 滾動查看更多牌意 ▼', mode: 'time', time: 1.5 }
    },

    async init() {
        this.el = document.getElementById('global-breathing-light');
        this.savedConfig = await DB.get('bl_config', {});
    },

    getConfig(id) {
        // ✨ 修改 3 (最強防呆)：如果你傳入的 id 不在上面清單裡(例如直接傳一段文字)，
        // 系統會自動把它當成「顯示 1.5 秒的臨時文字」，不會報錯當機！
        return this.savedConfig[id] || this.defaults[id] || { text: id, mode: 'time', time: 1.5 };
    },

    show(id, replaceText = null) {
        this.clear(); if (!this.el) return;
        const conf = this.getConfig(id); if (conf.mode === 'none') return;

        let txt = conf.text; if (replaceText) txt = txt.replace('{n}', replaceText);
        this.el.innerText = txt;

        this.el.classList.remove('hidden');
        this.el.classList.add('pulse-anim');

        // ✨ 核心修正：將原本的 top-1/4 改為 top-[12%]，讓畫面中央完整留給物理牌堆
        this.el.classList.add('fixed', 'top-[12%]', 'left-1/2', '-translate-x-1/2', 'z-50');

        this.currentId = id;
        if (conf.mode === 'time') this.timer = setTimeout(() => { this.clear(); }, conf.time * 1000);
    },

    clearAction(id) { if (this.currentId === id && this.getConfig(id).mode === 'action') this.clear(); },

    clear() {
        clearTimeout(this.timer);
        if (this.el) {
            this.el.classList.add('hidden');
            this.el.classList.remove('pulse-anim');
            // ✨ 清除時，順便把定位 class 拔掉，保持乾淨
            this.el.classList.remove('bl-top-left', 'fixed', 'top-1/4', 'left-1/2', '-translate-x-1/2', 'z-50');
        }
        this.currentId = null;
    }
};

let breathingLightTimer = null; // 全域宣告一個計時器指針

// 找到負責顯示呼吸燈提示的函數，修改成包含自動隱藏的邏輯：
function showGlobalHint(msg) {
    const hintEl = document.getElementById('global-breathing-light');
    if (!hintEl) return;

    hintEl.innerHTML = msg;
    hintEl.classList.remove('hidden');
    hintEl.classList.add('active'); // 或是你原本顯示的 Class

    // ⚡ 核心修復：每次有新提示進來，先清除舊的計時器，避免時間錯亂
    if (breathingLightTimer) {
        clearTimeout(breathingLightTimer);
    }

    // ⚡ 設定 1.5 秒 (1500毫秒) 之後，自動淡出並隱藏
    breathingLightTimer = setTimeout(() => {
        hintEl.classList.add('hidden');
        hintEl.classList.remove('active');
    }, 1500);
}

function toggleBlTime(key) {
    const mode = document.getElementById(`bl_mode_${key}`).value;
    const timeInput = document.getElementById(`bl_time_${key}`);
    if (mode === 'time') timeInput.classList.remove('hidden');
    else timeInput.classList.add('hidden');
}

// ============================================================================
// 🌟 系統開機總管 (Master Boot Sequence)
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
    // 1. 核心服務與設定載入
    document.getElementById('draw-ui')?.classList.add('hidden');
    await syncSystemCache();
    await BL.init();
    applyStoredSettings();

    // 2. 讀取使用者偏好 (覆寫預設值)
    currentSelectedDeckSize = await DB.get('last_deck_size', 78);
    currentSelectedSpread = await DB.get('last_spread_id', 'single');

    // 3. ✨ 畫面同步渲染 (取代你原本寫死的 innerText，這會自動去抓全域設定檔)
    if (typeof applyDefaultSettings === 'function') applyDefaultSettings();
    await updateSpreadSelectDropdown();

    // 4. 其他 UI 與預載初始化
    initSettingsUI();
    if (typeof applyThemeColor === 'function') applyThemeColor();
    if (typeof initDeckThemeSelect === 'function') initDeckThemeSelect();
    if (typeof initSetupMainDeckSelect === 'function') initSetupMainDeckSelect();
    if (typeof applyLockedPreferences === 'function') applyLockedPreferences();
    preloadDeckImages();

    // 5. 路由與畫面開場處理
    const isSoftReload = sessionStorage.getItem('is_soft_reload') === 'true';
    if (isSoftReload) {
        // 軟重載：瞬間進入首頁
        const splashScreen = document.getElementById('screen-splash');
        if (splashScreen) {
            splashScreen.classList.remove('active');
            splashScreen.classList.add('hidden');
        }
        navTo('screen-home', false);
        history.replaceState({ screen: 'screen-home' }, '', window.location.pathname);
        sessionStorage.removeItem('is_soft_reload');
    } else {
        // ✨ 冷啟動：呼叫全新的神聖幾何與布簾開場動畫
        if (typeof playSplashAnimation === 'function') {
            playSplashAnimation();
        } else {
            // 防呆機制：如果沒載入動畫函數，直接進首頁
            navTo('screen-home', false);
        }
    }

    // 6. 渲染歷史紀錄
    await renderHistoryList();

    // 7. 註冊瀏覽器重新整理攔截 (防止儀式中斷)
    window.addEventListener('beforeunload', (e) => {
        // 假設你的全域鎖叫做 isRitualActive，請確認變數名稱
        if (typeof isRitualActive !== 'undefined' && isRitualActive) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ==========================================
// 🃏 抽牌設定視窗 (支援手機實體返回鍵)
// ==========================================
window.openDeckModal = function () {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'deck', sessionId: window.appSessionId }, '', location.hash);
    const modal = document.getElementById('modal-deck');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.openSpreadModal = function () {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'spread', sessionId: window.appSessionId }, '', location.hash);
    const modal = document.getElementById('modal-spread');
    if (!modal) return;

    // 如果你有動態生成牌陣選單的函數，先等它跑完再顯示
    if (typeof updateSpreadSelectDropdown === 'function') {
        updateSpreadSelectDropdown().then(() => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    } else {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

// 給 HTML 裡的「返回」按鈕呼叫用的
window.closeSetupModal = function () {
    // 直接觸發返回鍵，交由最下方的 popstate 監聽器統一處理隱藏邏輯
    history.back();
};

// 替換這整段 selectDeckAndNext 函數
async function selectDeckAndNext(size, iconText, labelText) {
    if (typeof currentRitualData !== 'undefined') {
        currentRitualData.deckSize = size;
    }
    currentSelectedDeckSize = size;

    await DB.set('last_deck_size', size);

    // ✨ 加入安全防護：先抓取元素，確定存在才替換文字！
    const labelEl = document.getElementById('setup-deck-label');
    const iconEl = document.getElementById('setup-deck-icon');

    if (labelEl) labelEl.innerText = labelText;
    if (iconEl) iconEl.innerText = iconText;

    // ✨ 核心修復：使用 history.back() 消耗掉歷史紀錄，讓 popstate 統一處理關閉，避免堆疊錯亂
    const modal = document.getElementById('modal-deck');
    if (modal && !modal.classList.contains('hidden')) {
        history.back();
    }
}

function handleSetupNext() {
    if (currentSelectedSpread === 'custom') {
        initCustomBuilder(); navTo('screen-custom-builder');
    } else if (currentSelectedSpread === 'single') {
        openSingleCardModal(); // ✨ 攔截進入單牌專屬視窗
    } else {
        startRitual();
    }
}

// ✨ 單牌專屬流程控制器 (加入子選單與抽牌風格)
async function openSingleCardModal() {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('confirm-msg');

    // 第一層：選擇洗牌方式
    const showInitial = () => {
        msgEl.innerHTML = `
            <p class="mb-4 text-yellow-300 font-bold text-lg">🃏 單牌速占模式</p>
            <div class="flex flex-col gap-3">
                <!-- 已依需求移除使用舊牌的選項 -->
                <button id="btn-single-auto" class="magic-btn py-3 text-sm border-blue-400 text-blue-200">
                    🌀 自動洗牌
                </button>
                <button id="btn-single-manual" class="magic-btn py-3 text-sm border-green-400 text-green-200">
                    🫳 手動洗牌
                </button>
            </div>
        `;

        document.getElementById('btn-confirm-ok').classList.add('hidden');
        document.getElementById('btn-confirm-cancel').innerText = '取消返回';
        document.getElementById('btn-confirm-cancel').onclick = () => { modal.classList.add('hidden'); };

        document.getElementById('btn-single-auto').onclick = () => showStyleSelection('auto');
        document.getElementById('btn-single-manual').onclick = () => showStyleSelection('manual');
    };

    // 第二層：選擇開牌風格
    const showStyleSelection = (shuffleType) => {
        msgEl.innerHTML = `
            <p class="mb-4 text-yellow-300 font-bold text-lg">👁️ 選擇抽牌方式</p>
            <div class="flex flex-col gap-3">
                <button id="btn-style-direct" class="magic-btn py-3 text-sm border-purple-400 text-purple-200">
                    🎯 直接開最頂端的一張牌
                </button>
                <button id="btn-style-spread" class="magic-btn py-3 text-sm border-yellow-400 text-yellow-200">
                    🖐️ 78 張全攤開隨機盲抽
                </button>
            </div>
        `;

        document.getElementById('btn-confirm-cancel').innerText = '🔙 上一步';
        document.getElementById('btn-confirm-cancel').onclick = showInitial;

        document.getElementById('btn-style-direct').onclick = () => {
            window.singleDrawStyle = 'direct'; // 設定全域旗標為「直接抽」
            executeSingleDraw(shuffleType);
        };

        document.getElementById('btn-style-spread').onclick = () => {
            window.singleDrawStyle = 'spread'; // 設定全域旗標為「攤開抽」
            executeSingleDraw(shuffleType);
        };
    };

    const executeSingleDraw = async (shuffleType) => {
        modal.classList.add('hidden');
        if (shuffleType === 'auto') {
            const currentTheme = await DB.get('deck_theme', 'cards');
            const themeList = await DB.get('deck_theme_list', [{ name: '經典萊德偉特', id: 'cards' }, { name: '托特塔羅牌', id: 'thoth' }]);
            const themeObj = themeList.find(t => t.id === currentTheme) || themeList[0];

            currentRitualData = { id: Date.now().toString(), date: new Date().toLocaleString('zh-TW'), question: document.getElementById('input-question').value || '單牌速占', spread: 'single', mainDeckId: themeObj.id, mainDeckName: themeObj.name, cards: [], notes: '' };
            currentRealDeck = shuffleArray(await generateBaseDeck(currentSelectedDeckSize));
            AutoBot.execute(); 
        } else {
            startRitual();
        }
    };

    showInitial();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 供舊牌模式直接展牌使用
async function startSingleRitualDirectly() {
    isRitualActive = true; // ✨ 補上這行，確保單牌速占也能觸發返回防護罩
    currentRitualData = { id: Date.now().toString(), date: new Date().toLocaleString('zh-TW'), question: document.getElementById('input-question').value || '單牌速占', spread: 'single', cards: [], notes: '' };
    navTo('screen-ritual');
    setupWashUI();
    buildSpread('single');
    await initPhysicsDeck(currentRealDeck);

    // 直接觸發展牌
    setTimeout(() => { fanSpread(); }, 300);
}

// 核心路由導航系統 (防鬼打牆終極版)
function navTo(screenId, pushToHistory = true) {
    // 🛡️ 1. 攔截機制：如果正在占卜中，企圖回首頁，觸發確認
    if (typeof currentState !== 'undefined' && (currentState === 'SHUFFLING' || currentState === 'WASHING' || currentState === 'SELECTING' || currentState === 'FANNING' || currentState === 'GATHERED') && screenId === 'screen-home') {
        if (isGlobalConfirmShowing) return;
        isGlobalConfirmShowing = true;

        showConfirm('目前正在儀式中，確定要結束占卜回到首頁嗎？',
            () => { returnToHomeSafely(); },
            () => { isGlobalConfirmShowing = false; }
        );
        return;
    }

    // 🛡️ 2. 防鬼打牆機制：防止按上一頁硬闖已失效的儀式畫面
    if (!isRitualActive) {
        // 如果沒在占卜，卻企圖進入洗牌桌
        if (screenId === 'screen-ritual' || screenId === 'screen-manual-shuffle') {
            screenId = 'screen-home';
            pushToHistory = false; // 禁止把錯誤路徑推入歷史
        }
        // 如果沒在占卜，且【不是】在看阿卡西歷史紀錄，卻企圖進入解牌室
        if (screenId === 'screen-reading' && !currentViewingRecordId) {
            screenId = 'screen-home';
            pushToHistory = false;
        }
    }

    // 🧹 狀態重置：離開歷史紀錄或回到首頁時，清除歷史檢視 ID
    if (screenId === 'screen-home' || screenId === 'screen-history') {
        currentViewingRecordId = null;
    }

    // 3. 日常切換：隱藏所有畫面，只亮起目標畫面
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');

    // 4. 畫布圖層動態顯示/隱藏控制
    const canvasLayer = document.getElementById('canvas-layer');
    if (canvasLayer) {
        let keepCanvas = (screenId === 'screen-ritual');
        if (screenId === 'screen-reading' && typeof currentRitualData !== 'undefined' && currentRitualData.spread === 'single' && isRitualActive) {
            keepCanvas = true;
        }

        if (keepCanvas) {
            canvasLayer.style.display = 'block';
            canvasLayer.classList.add('active');
        } else {
            canvasLayer.style.display = 'none';
            canvasLayer.classList.remove('active');
        }
    }

    // 5. 呼吸燈與歷史紀錄推軌控制
    if (typeof BL !== 'undefined' && (typeof currentState === 'undefined' || currentState !== 'SELECTING')) BL.clear();

    if (pushToHistory) {
        history.pushState({ screen: screenId }, '', `#${screenId}`);
    } else {
        // 如果被攔截或禁止推送，改用 replaceState 靜默覆蓋掉當前錯誤的網址
        history.replaceState({ screen: screenId }, '', `#${screenId}`);
    }
}

// ✨ 升級版 showConfirm：支援第三個參數 onCancel，確保鎖定機制能完美釋放
function showConfirm(msg, onConfirm, onCancel) {
    const modal = document.getElementById('custom-confirm-modal');
    const modalBox = modal.querySelector('div');
    const msgEl = document.getElementById('confirm-msg');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    msgEl.innerText = msg;
    btnOk.classList.remove('hidden');
    btnCancel.classList.remove('hidden');
    btnCancel.style.display = 'block';
    btnOk.style.display = 'block';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const closeModal = () => {
        const handleScaleEnd = (e) => {
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                modalBox.removeEventListener('transitionend', handleScaleEnd);
            }
        };
        modalBox.addEventListener('transitionend', handleScaleEnd);
        modalBox.classList.replace('scale-100', 'scale-95');
    };

    btnOk.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };

    // ✨ 核心修復：取消時也能執行綁定的解鎖動作！
    btnCancel.onclick = () => {
        closeModal();
        if (onCancel) onCancel();
    };
}

// ============================================================================
// 📸 設定頁面專用：三向路由彈窗與快照引擎
// ============================================================================
let currentSubSettingsSnapshot = null;
let currentActiveSubModal = null;

// ✨ 1. 偏執狂專用翻譯字典
const SETTING_NAMES_DICT = {
    'set-stage-shuffle': '牌堆洗牌',
    'setting-min-shuffle': '最少洗牌次數',
    'mode-stage-shuffle': '洗牌自動化',
    'set-stage-wash': '桌面搓牌',
    'mode-stage-wash': '搓牌自動化',
    'set-stage-cut': '憑直覺切牌',
    'mode-stage-cut': '切牌自動化',
    'setting-draw-style': '抽牌風格',
    'setting-select-mode': '選牌操作模式',
    'theme-color-picker': '環境調色盤',
    'setting-deck-theme': '塔羅主題'
};

// 擷取當前視窗所有設定值的快照
function getModalInputValues(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return {};
    const inputs = modal.querySelectorAll('input:not([type="file"]), select, textarea');
    const vals = {};
    inputs.forEach(inp => {
        if (!inp.id) return;
        if (inp.type === 'checkbox') vals[inp.id] = inp.checked;
        else vals[inp.id] = inp.value;
    });
    return vals;
}

// 髒值檢測：比對現在的值和快照一不一樣
function isSubSettingsChanged() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return false;
    const currentVals = getModalInputValues(currentActiveSubModal);
    for (let key in currentSubSettingsSnapshot) {
        if (currentSubSettingsSnapshot[key] !== currentVals[key]) return true;
    }
    return false;
}

// 升級髒值檢測：直接回傳「變更了哪些項目」的陣列
function getChangedSettings() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return [];

    const currentVals = getModalInputValues(currentActiveSubModal);
    const changedItems = [];

    for (let key in currentSubSettingsSnapshot) {
        if (currentSubSettingsSnapshot[key] !== currentVals[key]) {
            changedItems.push(SETTING_NAMES_DICT[key] || '部分設定');
        }
    }
    return changedItems;
}

// 逆轉時空：把畫面和資料庫全數退回快照狀態
async function revertSubSettingsToSnapshot() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return;
    window.isRevertingSettings = true; // 開啟靜默模式，禁止彈出 Toast

    for (let key in currentSubSettingsSnapshot) {
        const inp = document.getElementById(key);
        if (inp) {
            if (inp.type === 'checkbox') {
                if (inp.checked !== currentSubSettingsSnapshot[key]) {
                    inp.checked = currentSubSettingsSnapshot[key];
                    inp.dispatchEvent(new Event('change')); // 觸發系統自動存回舊值
                }
            } else {
                if (inp.value !== currentSubSettingsSnapshot[key]) {
                    inp.value = currentSubSettingsSnapshot[key];
                    inp.dispatchEvent(new Event('change')); // 觸發系統自動存回舊值
                }
            }
        }
    }
    await new Promise(r => setTimeout(r, 150)); // 等待資料庫存檔完畢
    window.isRevertingSettings = false; // 解除靜默模式
}

// 三向選項彈跳視窗 (動態替換按鈕，不弄髒 HTML)
function showThreeWayConfirm(msg, onDiscard, onContinue, onSave) {
    const modal = document.getElementById('custom-confirm-modal');
    const modalBox = modal.querySelector('div');
    const msgEl = document.getElementById('confirm-msg');

    // 備份原本的雙按鈕結構
    const btnContainer = modalBox.querySelector('.flex.justify-center.gap-4');
    const originalHTML = btnContainer.innerHTML;

    msgEl.innerText = msg;

    // 植入三向按鈕
    btnContainer.innerHTML = `
        <button id="btn-3way-discard" class="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-white text-sm font-bold transition-colors">放棄</button>
        <button id="btn-3way-continue" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-bold transition-colors">繼續</button>
        <button id="btn-3way-save" class="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-purple-900 rounded text-sm font-bold transition-colors">儲存</button>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const closeModal = () => {
        const handleScaleEnd = (e) => {
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                modalBox.removeEventListener('transitionend', handleScaleEnd);
                btnContainer.innerHTML = originalHTML; // 動畫結束後，神不知鬼不覺把按鈕還原
            }
        };
        modalBox.addEventListener('transitionend', handleScaleEnd);
        modalBox.classList.replace('scale-100', 'scale-95');
    };

    document.getElementById('btn-3way-discard').onclick = () => { closeModal(); if (onDiscard) onDiscard(); };
    document.getElementById('btn-3way-continue').onclick = () => { closeModal(); if (onContinue) onContinue(); };
    document.getElementById('btn-3way-save').onclick = () => { closeModal(); if (onSave) onSave(); };
}

// ==========================================
// ✨ 輕量提示系統 (智慧堆疊景深版)
// ==========================================
window.isRevertingSettings = false;
window.lastToastMsg = "";   // 用來記錄上一則訊息
window.lastToastTime = 0;   // 用來記錄上一則訊息的時間

window.showToast = function (msg, duration = 3000) {
    if (window.isRevertingSettings) return;

    // 🛡️ 防禦機制 1：防洗頻 (Spam Filter)
    // 如果 500 毫秒內連續觸發「一模一樣」的訊息，直接擋掉，不讓畫面閃爍
    const now = Date.now();
    if (msg === window.lastToastMsg && now-window.lastToastTime < 500) return;
    window.lastToastMsg = msg;
    window.lastToastTime = now;

    let toastBox = document.getElementById('altar-toast-container');
    if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.id = 'altar-toast-container';
        // 注意：這裡改用 flex-col-reverse，讓新訊息出現在最下方，舊的被往上頂
        toastBox.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2 items-center pointer-events-none w-full max-w-sm px-4';
        document.body.appendChild(toastBox);
    }

    // 建立新的 Toast
    const toast = document.createElement('div');
    toast.className = 'bg-black/90 border border-purple-500 text-yellow-300 px-5 py-2.5 rounded-2xl shadow-[0_0_15px_rgba(168,85,247,0.4)] text-sm font-bold tracking-widest backdrop-blur-md transition-all duration-300 transform translate-y-[-20px] opacity-0 origin-bottom';
    toast.innerText = msg;

    // 塞入容器的最前面
    toastBox.insertBefore(toast, toastBox.firstChild);

    // 觸發進場動畫 (必須等下一幀)
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    // 🎨 核心視覺邏輯：計算所有當存活的 Toast，套用景深與淡化
    const allToasts = Array.from(toastBox.children);
    allToasts.forEach((t, index) => {
        if (index === 0) {
            // 最新的：最亮、最大
            t.style.opacity = '1';
            t.style.transform = 'scale(1) translateY(0)';
        } else if (index === 1) {
            // 第二個：稍微變暗、稍微縮小
            t.style.opacity = '0.7';
            t.style.transform = 'scale(0.95) translateY(-4px)';
        } else if (index === 2) {
            // 第三個：很暗、更小
            t.style.opacity = '0.4';
            t.style.transform = 'scale(0.9) translateY(-8px)';
        } else {
            // 第四個以上：無情強制消滅！
            t.style.opacity = '0';
            t.style.transform = 'scale(0.8) translateY(-15px)';
            setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
        }
    });

    // 正常的時間到自然消滅邏輯
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'scale(0.8) translateY(-15px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300); // 等待退場動畫結束後拔除 DOM
        }
    }, duration);
};

function showAlert(msg, onOk) {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('confirm-msg');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    // ✨ 1. 先把負責縮放動畫的內部元素抓出來存好
    const modalBox = modal.querySelector('div');

    msgEl.innerText = msg;
    btnCancel.classList.add('hidden'); // 隱藏取消按鈕
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // 保留這個 10ms 延遲，確保瀏覽器先渲染出畫面再觸發放大動畫
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const cleanup = () => {
        // ✨ 2. 定義動畫結束時要執行的「收尾動作」
        const handleScaleEnd = (e) => {
            // 確保觸發的是 transform (縮放) 動畫結束
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');

                // 收尾完畢，立刻拔除這個監聽器，避免下次開啟時重複觸發
                modalBox.removeEventListener('transitionend', handleScaleEnd);
            }
        };

        // ✨ 3. 把監聽器綁定到執行縮放的 modalBox 上
        modalBox.addEventListener('transitionend', handleScaleEnd);

        // ✨ 4. 觸發 CSS 縮小動畫，取代原本的 setTimeout 200
        modalBox.classList.replace('scale-100', 'scale-95');

        // 拔除按鈕的點擊監聽 (維持你原本優良的防呆設計)
        btnOk.removeEventListener('click', okHandler);
    };

    const okHandler = () => { cleanup(); if (onOk) onOk(); };
    btnOk.addEventListener('click', okHandler);
}

function rebuildManualDOM() {
    const container = document.getElementById('manual-deck-container');
    if (!container) return;
    container.innerHTML = '';

    // ✨ 核心修正：使用當前實際牌組長度，嚴禁使用固定數值
    const totalCards = currentRealDeck.length;
    const sliceSpacing = totalCards === 22 ? 6 : 4;

    for (let i = 0; i < totalCards; i++) {
        let cardSlice = document.createElement('div');
        // 22 張時讓切片厚一點，手感較好
        const thickness = totalCards === 22 ? 'h-[5px]' : 'h-[3px]';
        cardSlice.className = `w-full ${thickness} bg-purple-200 border-b border-purple-500 rounded-sm mb-[1px] absolute`;
        cardSlice.style.bottom = `${i * sliceSpacing}px`;
        cardSlice.style.zIndex = i;
        cardSlice.dataset.index = i;
        container.appendChild(cardSlice);
    }
}

// ✨ 宣告為 async
async function initSettingsUI() {
    const blContainer = document.getElementById('breathing-settings-container');
    const select = document.getElementById('meaning-card-select');

    // ✨ 從 IndexedDB 讀取設定 (替換 localStorage)
    const drawMode = await DB.get('select_mode', 'click');
    const modeSelect = document.getElementById('setting-select-mode');
    if (modeSelect) modeSelect.value = drawMode;

    if (!blContainer || !select) return;
    blContainer.innerHTML = '';

    // 【選牌微震動開關】
    const isHapticOn = await DB.get('haptic_enabled', true);
    // ⚠️ 注意：HTML 裡面的 onchange 不能直接寫 DB.set (會報錯)，我們要把它拿出來用 addEventListener 綁定
    blContainer.innerHTML += `
        <div class="flex justify-between items-center bg-black/30 p-2 rounded mb-3 border border-yellow-500/30">
            <span class="text-yellow-300 font-bold">📳 選牌微震動回饋 (支援手機)</span>
            <input type="checkbox" id="setting-haptic-toggle" ${isHapticOn ? 'checked' : ''} class="w-5 h-5 accent-yellow-400 cursor-pointer">
        </div>
    `;

    // ✨ 新增：動態綁定震動開關的事件
    setTimeout(() => {
        document.getElementById('setting-haptic-toggle')?.addEventListener('change', async function () {
            await DB.set('haptic_enabled', this.checked);
            await syncSystemCache();
        });
    }, 100);

    // 【讀取儀式三階段的設定狀態】
    const stageShuffle = await DB.get('stage_shuffle', true);
    const minShuffle = await DB.get('min_shuffle_count', 3); // ✨ 讀取最少次數
    const stageWash = await DB.get('stage_wash', true);
    const stageCut = await DB.get('stage_cut', true);
    const minCutPiles = await DB.get('cut_piles_count', 3);

    const chkShuffle = document.getElementById('set-stage-shuffle');
    const inpMinShuffle = document.getElementById('setting-min-shuffle'); // ✨ 抓取輸入框
    const labelMinShuffle = document.getElementById('label-min-shuffle');
    const chkWash = document.getElementById('set-stage-wash');
    const chkCut = document.getElementById('set-stage-cut');
    const inpCutPiles = document.getElementById('setting-cut-piles');
    const labelCutPiles = document.getElementById('label-cut-piles');

    if (chkShuffle) {
        chkShuffle.checked = (stageShuffle !== 'false' && stageShuffle !== false);
        // ✨ 開機立刻同步任天堂灰色禁用狀態
        if (typeof toggleMinShuffleState === 'function') toggleMinShuffleState(chkShuffle.checked);
    }
    if (inpCutPiles) {
        inpCutPiles.value = minCutPiles;
        inpCutPiles.max = MAX_CUT_LIMIT; // ✨ 動態鎖死輸入框最大值
    }
    if (labelCutPiles) {
        // ✨ 動態把變數塞進 HTML 文字中！
        labelCutPiles.innerText = `↳ 切牌堆數 (2~${MAX_CUT_LIMIT}疊)`;
    }

    if (chkCut) {
        chkCut.checked = (stageCut !== 'false' && stageCut !== false);
        // ✨ 開機同步灰色狀態
        if (typeof toggleCutState === 'function') toggleCutState(chkCut.checked);
    }

    if (inpMinShuffle) {
        inpMinShuffle.value = minShuffle;
        inpMinShuffle.max = MAX_SHUFFLE_LIMIT; // ✨ 動態鎖死輸入框的最大值
    }
    if (labelMinShuffle) {
        // ✨ 動態把變數塞進 HTML 文字中！
        labelMinShuffle.innerText = `↳ 最少洗牌次數 (1~${MAX_SHUFFLE_LIMIT}次)`;
    }
    if (chkWash) chkWash.checked = (stageWash !== 'false' && stageWash !== false);
    if (chkCut) chkCut.checked = (stageCut !== 'false' && stageCut !== false);

    // 【呼吸燈設定生成邏輯】
    const savedBl = await DB.get('bl_config', {});
    Object.keys(BL.defaults).forEach(key => {
        const conf = savedBl[key] || BL.defaults[key];
        const div = document.createElement('div'); div.className = "flex justify-between items-center bg-black/30 p-2 rounded mb-2";
        div.innerHTML = `<span class="truncate w-1/2 pr-2 text-purple-200">${conf.text.replace('{n}', 'N')}</span>
            <div class="flex gap-1 w-1/2 justify-end">
                <select id="bl_mode_${key}" class="bg-purple-900 text-white rounded p-1 text-xs" onchange="toggleBlTime('${key}')">
                    <option value="action" ${conf.mode === 'action' ? 'selected' : ''}>動作結束</option><option value="continuous" ${conf.mode === 'continuous' ? 'selected' : ''}>持續</option>
                    <option value="time" ${conf.mode === 'time' ? 'selected' : ''}>計時</option><option value="none" ${conf.mode === 'none' ? 'selected' : ''}>關閉</option>
                </select>
                <input type="number" id="bl_time_${key}" value="${conf.time}" min="1" max="10" class="w-10 bg-purple-900 text-center rounded text-xs ${conf.mode === 'time' ? '' : 'hidden'}">
            </div>`;
        blContainer.appendChild(div);
    });

    select.innerHTML = '';

    // ✨ 這裡必須加上 await，因為 generateBaseDeck 已經變成非同步了
    const deck = await generateBaseDeck(78);
    deck.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name.replace('\n', '-');
        select.appendChild(opt);
    });

    // 下拉選單切換時，讀取自訂牌義
    select.addEventListener('change', async (e) => {
        const customs = await DB.get('meanings_custom', {});
        document.getElementById('meaning-custom-input').value = customs[e.target.value] || '';
    });

    // 同步主題與牌組
    const savedTheme = await DB.get('deck_theme', 'cards');
    if (document.getElementById('setting-deck-theme')) {
        document.getElementById('setting-deck-theme').value = savedTheme;
    }

    //同步牌組
    await renderDeckThemeOptions();

    // 手動觸發一次事件，載入第一張牌的資料
    select.dispatchEvent(new Event('change'));
}

//設定切換按鈕
function switchSettingTab(tab) {
    document.querySelectorAll('.setting-tab-btn').forEach(b => { b.classList.remove('bg-purple-700'); b.classList.add('bg-purple-900'); });
    event.target.classList.remove('bg-purple-900'); event.target.classList.add('bg-purple-700');
    document.getElementById('setting-tab-ui').classList.add('hidden'); document.getElementById('setting-tab-logic').classList.add('hidden');
    document.getElementById(`setting-tab-${tab}`).classList.remove('hidden');
}

// ==========================================
// ✨ 設定頁面專屬：事件綁定器 (Event Listeners)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. 綁定剛剛修改的按鈕 (等待列表渲染完再跳頁)
    window.openSpreadManager = async function () {
        await renderSpreadManageList();
        navTo('screen-spread-manage');
    };

    // 2. 綁定下拉選單與開關 (寫入 IndexedDB)
    document.getElementById('setting-draw-style')?.addEventListener('change', async (e) => {
        await DB.set('draw_style', e.target.value);
        await syncSystemCache();
    });

    document.getElementById('setting-select-mode')?.addEventListener('change', async (e) => {
        await DB.set('select_mode', e.target.value);
        await syncSystemCache();
        if (typeof updateDrawButtons === 'function') updateDrawButtons();
    });

    document.getElementById('set-stage-shuffle')?.addEventListener('change', async (e) => {
        await DB.set('stage_shuffle', e.target.checked);
        await syncSystemCache();
    });

    document.getElementById('set-stage-wash')?.addEventListener('change', async (e) => {
        await DB.set('stage_wash', e.target.checked);
        await syncSystemCache();
    });

    document.getElementById('set-stage-cut')?.addEventListener('change', async (e) => {
        await DB.set('stage_cut', e.target.checked);
        await syncSystemCache();
    });

    // 監聽主題切換
    document.getElementById('setting-deck-theme')?.addEventListener('change', async (e) => {
        await DB.set('deck_theme', e.target.value);
        // 同步更新快取 (如果你有做 SystemCache 的話)
        if (typeof syncSystemCache === 'function') await syncSystemCache();
        showToast('🎨 牌組主題已切換！下一次占卜將生效。', 3500);
    });

    // 🌟 1. 洗牌次數 (即時攔截、自動全選與失焦存檔)
    const minShuffleInput = document.getElementById('setting-min-shuffle');
    if (minShuffleInput) {
        // ✨ 新增：點擊獲得焦點時，自動全選裡面的數字 (加入 10ms 延遲以完美支援手機端)
        minShuffleInput.addEventListener('focus', (e) => {
            setTimeout(() => { e.target.select(); }, 10);
        });

        // 當使用者打字時，只要超過上限，瞬間修正並提示
        minShuffleInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (val > MAX_SHUFFLE_LIMIT) {
                e.target.value = MAX_SHUFFLE_LIMIT;
                if (typeof showToast === 'function') showToast(`⚠️ 洗牌上限為 ${MAX_SHUFFLE_LIMIT} 次`);
            }
        });

        // 當輸入框失去焦點時，檢查下限並寫入資料庫
        minShuffleInput.addEventListener('blur', async (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 3;
            if (val < 1) {
                val = 1; e.target.value = 1;
                if (typeof showToast === 'function') showToast(`⚠️ 最少需洗牌 1 次`);
            }
            await DB.set('min_shuffle_count', val);
            if (typeof syncSystemCache === 'function') await syncSystemCache();
        });
    }

    // 🌟 2. 切牌次數 (即時攔截、自動全選與失焦存檔)
    const cutPilesInput = document.getElementById('setting-cut-piles');
    if (cutPilesInput) {
        // ✨ 新增：自動全選邏輯
        cutPilesInput.addEventListener('focus', (e) => {
            setTimeout(() => { e.target.select(); }, 10);
        });

        cutPilesInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (val > MAX_CUT_LIMIT) {
                e.target.value = MAX_CUT_LIMIT;
                if (typeof showToast === 'function') showToast(`⚠️ 切牌上限為 ${MAX_CUT_LIMIT} 疊`);
            }
        });

        cutPilesInput.addEventListener('blur', async (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 3;
            if (val < 2) {
                val = 2; e.target.value = 2;
                if (typeof showToast === 'function') showToast(`⚠️ 最少需切 2 疊`);
            }
            await DB.set('cut_piles_count', val);
            if (typeof syncSystemCache === 'function') await syncSystemCache();
        });
    }

    // ==========================================
    // ✨ 圖片上傳轉 Base64 寫入 IndexedDB 區塊
    // ==========================================
    const setupImageUploader = (inputId, dbKey) => {
        document.getElementById(inputId)?.addEventListener('change', async function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    await DB.set(dbKey, event.target.result);
                    showToast(`✅ 圖片上傳成功！請點擊下方「套用設定」生效。`);
                } catch (err) {
                    console.error('圖片存檔失敗:', err);
                    showToast('❌ 圖片過大或存檔失敗');
                }
            };
            reader.readAsDataURL(file);
        });
    };

    // 綁定三個單張圖片的上傳按鈕
    setupImageUploader('upload-cardback', 'cardback');
    setupImageUploader('upload-bg-img', 'bg_img');
    setupImageUploader('upload-splash-anim', 'tarot_anim_splash');
    setupImageUploader('upload-desk-img', 'desk_img');

    // (註：批次上傳 78 張牌的邏輯，你原本已經寫在 upload-deck-batch 的監聽器裡了，保持原樣即可)
});

// ==========================================
// ✨ 牌組主題動態管理系統
// ==========================================

// 1. 初始化名單 (如果 DB 是空的，給予預設值)
async function getDeckThemeList() {
    const defaultList = [
        { name: '經典萊德偉特', id: 'cards' },
        { name: '托特塔羅牌', id: 'thoth' },
    ];
    return await DB.get('deck_theme_list', defaultList);
}

// 2. 渲染下拉選單
async function renderDeckThemeOptions() {
    const select = document.getElementById('setting-deck-theme');
    if (!select) return;

    const list = await getDeckThemeList();
    const currentTheme = await DB.get('deck_theme', 'cards');

    select.innerHTML = list.map(theme =>
        `<option value="${theme.id}" ${theme.id === currentTheme ? 'selected' : ''}>${theme.name}</option>`
    ).join('');
}

// 3. 新增自訂主題
async function addNewDeckTheme() {
    const nameInput = document.getElementById('new-theme-name');
    const idInput = document.getElementById('new-theme-id');
    const name = nameInput.value.trim();
    const id = idInput.value.trim();

    if (!name || !id) {
        showToast('請輸入完整的名稱與資料夾 ID');
        return;
    }

    let list = await getDeckThemeList();

    // 檢查是否重複
    if (list.some(t => t.id === id)) {
        showToast('此資料夾 ID 已存在');
        return;
    }

    list.push({ name, id });
    await DB.set('deck_theme_list', list);

    // 清空輸入框並刷新選單
    nameInput.value = '';
    idInput.value = '';
    await renderDeckThemeOptions();
    showToast("✅ 已新增牌組：${name}！", 4000);
}

// ==========================================
// ✨ 設定頁面子視窗控制 (智慧歷史紀錄版)
// ==========================================
function openSubSettings(modalId) {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'sub-settings', sessionId: window.appSessionId }, '', location.hash);

    const overlay = document.getElementById('sub-settings-overlay');
    const allModals = document.querySelectorAll('.sub-modal');

    // 隱藏所有子視窗
    allModals.forEach(m => m.classList.add('hidden'));

    // 顯示遮罩與目標視窗
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.getElementById(modalId).classList.remove('hidden');

    // 彈出動畫
    const target = document.getElementById(modalId);
    target.style.transform = 'scale(0.8)';
    target.style.opacity = '0';
    setTimeout(() => {
        target.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        target.style.transform = 'scale(1)';
        target.style.opacity = '1';
    }, 10);

    // 📸 2. 視窗打開的瞬間，拍下所有設定的快照！
    currentActiveSubModal = modalId;
    currentSubSettingsSnapshot = getModalInputValues(modalId);
}

// ✨ 核心：設定頁面關閉邏輯 (快照比對 + 精準提示版)
window.closeSubSettings = function (fromHistory = false) {
    const overlay = document.getElementById('sub-settings-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    // 1. 強制讓輸入框失去焦點，確保最新的輸入值能正確觸發存檔
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
    }

    // 🔍 2. 進行快照比對：檢查是否有異動
    let hasChanged = false;
    if (typeof isSubSettingsChanged === 'function') {
        hasChanged = isSubSettingsChanged(); // 呼叫你原本寫好的快照判斷函數
    }

    // 3. 執行關閉
    window.forceCloseSubSettings(fromHistory);

    // ✨ 4. 根據比對結果，跳出不同的精準提示
    if (typeof showToast === 'function') {
        if (hasChanged) {
            showToast('✅ 設定已自動套用');
        } else {
            showToast('👌 設定無異動'); // 你可以改成自己喜歡的文字，如「沒有變更」
        }
    }

    // 5. 判定完畢後，安全銷毀快照
    currentSubSettingsSnapshot = null;
};

// ✨ 外殼轉接頭 (維持不變，負責掛載防彈鋼板)
window.saveAndCloseSubSettings = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    window.closeSubSettings(false);
};

// ✨ 2. 任天堂式視覺鎖定：動態禁用洗牌次數輸入框
window.toggleMinShuffleState = function (isChecked) {
    const wrapper = document.getElementById('wrapper-min-shuffle');
    const input = document.getElementById('setting-min-shuffle');
    if (!wrapper || !input) return;

    if (isChecked) {
        // 開啟：恢復色彩與互動
        wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = false;
    } else {
        // 關閉：半透明、灰階、禁止點擊
        wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = true;
    }
};

// ✨ 任天堂式視覺鎖定：切牌堆數
window.toggleCutState = function (isChecked) {
    const wrapper = document.getElementById('wrapper-cut-piles');
    const input = document.getElementById('setting-cut-piles');
    if (!wrapper || !input) return;
    if (isChecked) {
        wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = false;
    } else {
        wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = true;
    }
};

// 實際負責執行關閉動作的函數
window.forceCloseSubSettings = function (fromHistory = false) {
    const overlay = document.getElementById('sub-settings-overlay');
    if (!overlay) return;

    // 🌟 核心：先同步、無情地把視窗藏起來，斷絕 popstate 的後路
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');

    // 清空記憶體快照
    currentActiveSubModal = null;
    currentSubSettingsSnapshot = null;

    // 如果是點擊按鈕關閉的，才幫忙消耗一頁歷史紀錄；如果是手機返回鍵觸發的，就不用再 back 了
    if (!fromHistory) {
        history.back();
    }
};

// ✨ 全域強制清除選取虛線框功能
function hideSelectionBoundary() {
    const el = document.getElementById('selection-boundary');
    if (!el || el.style.display === 'none') return;

    const handleBoundaryFade = (e) => {
        if (e.propertyName === 'opacity') {
            el.style.display = 'none';
            el.removeEventListener('transitionend', handleBoundaryFade);
        }
    };

    el.addEventListener('transitionend', handleBoundaryFade);
    el.style.opacity = '0';
}

let ritualSessionToken = 0; // ✨ 儀式唯一憑證，用來秒殺殭屍機器人
// ✨ 儀式環境徹底洗淨器
function resetRitualEngineContext() {
    ritualSessionToken++; // 每次呼叫就換發新憑證，舊的非同步機器人瞬間被判定無效！
    isRitualActive = false;
    currentState = 'IDLE';
    selectedCard = null;
    drawnCount = 0;
    drawnCardsStack = [];
    hideSelectionBoundary();

    if (typeof isProcessingDraw !== 'undefined') isProcessingDraw = false;
    if (typeof isCardRevealing !== 'undefined') isCardRevealing = false;

    // 還原按鈕原廠設定
    const btnConfirm = document.getElementById('btn-confirm-draw');
    if (btnConfirm) {
        btnConfirm.innerText = '✨ 確定選取';
        btnConfirm.classList.remove('border-green-400', 'text-green-400', 'animate-bounce');
        btnConfirm.classList.add('border-yellow-300', 'text-yellow-300');
    }

    const boundaryEl = document.getElementById('selection-boundary');
    if (boundaryEl) {
        boundaryEl.style.opacity = '0';
        boundaryEl.style.display = 'none';
    }

    // ✨ 核心修復 1：物理世界清空後，強迫瀏覽器把畫布上的墨水擦得一乾二淨，徹底消滅閃爍！
    if (world && cards && cards.length > 0) {
        Composite.remove(world, cards);
    }
    if (typeof render !== 'undefined' && render.context) {
        render.context.clearRect(0, 0, render.canvas.width, render.canvas.height);
    }
    cards = [];

    // ✨✨ 補回心肺復甦 1：確保新開局時，物理引擎絕對在運轉！
    if (typeof Runner !== 'undefined' && typeof runner !== 'undefined' && typeof engine !== 'undefined') {
        try { Runner.start(runner, engine); } catch (e) { }
    }
}

// ==========================================
// ✨ 終極防禦：防重疊跳轉與全黑畫面修正
// ==========================================
let isGlobalConfirmShowing = false; // 全域防護鎖，防止重疊彈窗

// 💯 安全返回首頁的萬用函數
function returnToHomeSafely() {
    sessionStorage.setItem('is_soft_reload', 'true');
    isRitualActive = false;
    window.location.replace(window.location.pathname);
}

function discardRitual() {
    showConfirm('目前的占卜尚未儲存，確定要放棄並返回首頁嗎？', () => {
        isRitualActive = false;
        // ⚡ 核心優化：不切換畫面，直接原地重新載入，完全杜絕閃爍
        window.location.href = window.location.origin + window.location.pathname;
    });
}

// 覆寫 navTo 函數
const originalNavTo = window.navTo;
window.navTo = function (screenId, pushToHistory = true) { // ✨ 補上原本的第二個參數

    // 1. 防護盾攔截邏輯 (維持你原本優良的設計)
    if (typeof currentState !== 'undefined' && (currentState === 'SHUFFLING' || currentState === 'WASHING' || currentState === 'SELECTING' || currentState === 'FANNING' || currentState === 'GATHERED') && screenId === 'screen-home') {
        if (isGlobalConfirmShowing) return;
        isGlobalConfirmShowing = true;

        // ✨ 利用升級版的 showConfirm，完美處理確認與取消
        showConfirm('目前正在儀式中，確定要結束占卜回到首頁嗎？',
            () => { returnToHomeSafely(); }, // 點確認：安全回家 (鎖會在回家函數中解開)
            () => { isGlobalConfirmShowing = false; } // 點取消：解鎖，下次才能再跳出！
        );
        return;
    }

    // 2. ✨ 核心修復：直接呼叫原本已經寫好的強大 navTo 函數！
    // 不要自己重寫 classList 操作，否則 canvasLayer 會因為缺乏 .active 而永遠隱形！
    if (typeof originalNavTo === 'function') {
        originalNavTo(screenId, pushToHistory);
    }
};

// ==========================================
// ✨ 介面主題顏色控制 (全色系支援版)
// ==========================================

// 1. 使用者在調色盤選好顏色後觸發
async function setCustomThemeColor(colorHex) {
    await DB.set('app_theme_color', colorHex); // 存入色碼，例如 #8a2be2
    applyThemeColor(colorHex);                 // 立即套用
}

// 2. 開機或切換時套用顏色
async function applyThemeColor(colorHex = null) {
    if (!colorHex) {
        // 如果沒有傳入，從資料庫抓，預設為原本的神秘紫 #1e1b4b
        colorHex = await DB.get('app_theme_color', '#1e1b4b');
    }

    // 防呆機制：相容上一版存進去的文字 (purple, blue...)
    if (colorHex === 'purple') colorHex = '#1e1b4b';
    else if (colorHex === 'blue') colorHex = '#172554';
    else if (colorHex === 'emerald') colorHex = '#064e3b';
    else if (colorHex === 'rose') colorHex = '#4c0519';

    // 同步更新 HTML 裡的調色盤顏色，讓介面狀態保持一致
    const picker = document.getElementById('theme-color-picker');
    if (picker && colorHex.startsWith('#')) {
        picker.value = colorHex;
    }

    // ✨ 魔法漸層：左上固定深色底 #0f172a，右下過渡到你選的專屬色！
    document.body.style.background = `linear-gradient(135deg, #0f172a 0%, ${colorHex} 100%)`;
    document.body.style.backgroundAttachment = 'fixed'; // 確保滾動時背景不會破圖
}

// ==========================================
// ✨ 塔羅牌面主題控制 (動態讀取自訂牌組版)
// ==========================================
async function initDeckThemeSelect() {
    const themeSelect = document.getElementById('setting-deck-theme');
    if (!themeSelect) return;

    // 1. 動態呼叫系統渲染器，從資料庫抓取完整清單
    if (typeof renderDeckThemeOptions === 'function') {
        await renderDeckThemeOptions();
    }

    // 2. 當使用者切換選項時，立刻存入資料庫並跳出提示
    themeSelect.addEventListener('change', async (e) => {
        await DB.set('deck_theme', e.target.value);
        if (typeof showToast === 'function') {
            showToast('🃏 牌面主題已切換！下次抽牌將套用新牌面。');
        }
    });
}

// ============================================================================
// 🛡️ 系統返回鍵 (popstate) 終極攔截器 (物理靜止防禦升級版)
// ============================================================================
// 在監聽器外部宣告這兩個變數，用來記錄按下的時間與次數
let lastPopstateTime = 0;
let popstateSpamCount = 0;
window.addEventListener('popstate', (e) => {
    // 核心防禦：連續狂退偵測機制
    const now = Date.now();
    // 如果兩次按下返回鍵的時間間隔小於 400 毫秒
    if (now-lastPopstateTime < 400) {
        popstateSpamCount++;
        // 如果連續狂按達到 3 次 (代表使用者可能卡住了或在亂按)
        if (popstateSpamCount >= 3) {
            // 祭出底層原生 confirm 鎖死主執行緒
            const forceExit = window.confirm("⚠️ 系統偵測到連續返回。\n\n目前的儀式可能已經中斷，是否要強制重整並回到首頁？");
            if (forceExit) {
                // 直接原地重載，清除所有殘留的記憶體與物理引擎狀態
                window.location.href = window.location.origin + window.location.pathname;
            }
            popstateSpamCount = 0; // 重置計數
            return; // 🛑 斬斷這次的 popstate，不讓下面的邏輯執行
        }
    } else {
        // 如果時間間隔正常，代表是正常操作，重置狂按計數器
        popstateSpamCount = 0;
    }
    lastPopstateTime = now;

    // 🥇 第一優先級：絕對鎖定狀態 (開牌動畫中)
    if (typeof isCardRevealing !== 'undefined' && isCardRevealing) {
        history.pushState({ screen: 'screen-ritual' }, '', '#screen-ritual');
        if (navigator.vibrate) navigator.vibrate(20);
        return;
    }

    // 🥈 第二優先級：解牌室的「牌義解說視窗」是不是正打開著？
    const meaningModal = document.getElementById('card-meaning-modal');
    if (meaningModal && !meaningModal.classList.contains('hidden')) {
        if (typeof closeCardMeaning === 'function') {
            closeCardMeaning();
        } else {
            meaningModal.classList.add('hidden');
            meaningModal.classList.remove('flex');
        }
        return;
    }

    // ✨ 🥈.5 優先級：設定頁的子視窗是不是打開著？
    const subSettingsOverlay = document.getElementById('sub-settings-overlay');
    if (subSettingsOverlay && !subSettingsOverlay.classList.contains('hidden')) {
        if (typeof closeSubSettings === 'function') {
            closeSubSettings(true);
        }
        return;
    }

    // 🥈.7 優先級：百科全書的獨立牌義編輯視窗是不是打開著？
    const dictEditModal = document.getElementById('modal-dict-edit');
    if (dictEditModal && !dictEditModal.classList.contains('hidden')) {
        if (typeof closeDictEdit === 'function') {
            closeDictEdit(true);
        }
        return;
    }

    // 🥉 第三優先級：儀式進行中的「中斷確認」
    if (typeof isRitualActive !== 'undefined' && isRitualActive) {
        // 1. 強制將網址拉回儀式狀態，防止連續狂退
        history.pushState({ screen: 'screen-ritual' }, '', '#screen-ritual');

        // 2. 🌟 核心防禦：立即凍結 Matter.js 物理引擎，防止卡牌在背景繼續飛竄、穿模或運算耗電
        if (typeof Runner !== 'undefined' && typeof runner !== 'undefined') {
            try {
                Runner.stop(runner);
            } catch (err) {
                console.warn("暫停物理引擎時略過無害異常:", err);
            }
        }

        // 3. 彈出確認視窗，智慧分流確定/取消動作
        showConfirm('儀式正在進行中，確定要結束占卜回到首頁嗎？',
            () => {
                // 點擊【確定】：直接去原地重載大掃除（abort 裡面也有安全網）
                if (typeof abortRitualAndGoHome === 'function') abortRitualAndGoHome();
            },
            () => {
                // 點擊【取消】：恢復物理引擎運作，讓卡牌繼續暢快飛行
                if (typeof Runner !== 'undefined' && typeof runner !== 'undefined' && typeof engine !== 'undefined') {
                    try {
                        Runner.start(runner, engine);
                    } catch (err) {
                        console.error("重啟物理引擎失敗:", err);
                    }
                }
            }
        );
        return;
    }

    // ✨ 🌟 優先級 3.5：攔截首頁實體返回鍵，觸發布幕關閉退出動畫
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-home' && (!e.state || e.state.exit_trap || e.state.screen !== 'screen-home')) {
        // 把歷史推回去，阻止預設的瀏覽器退出行為
        history.pushState({ screen: 'screen-home', sessionId: window.appSessionId }, '', '#screen-home');

        if (typeof playCurtainCloseAnimationAndExit === 'function') {
            playCurtainCloseAnimationAndExit();
        }
        return; // 斷流
    }

    // 🌟 優先級 4：正常情況下的畫面切換 (防呆終極版)
    let screenId = 'screen-home';
    if (e.state && e.state.screen && document.getElementById(e.state.screen)) {
        screenId = e.state.screen;
    }

    if (typeof originalNavTo === 'function') {
        originalNavTo(screenId, false);
    } else if (typeof navTo === 'function') {
        navTo(screenId, false);
    }
});

// ============================================================================
// 🛑 強制中斷儀式，清理物理引擎與戰場
// ============================================================================
function abortRitualAndGoHome() {
    console.log('🛑 啟動強制中斷：清理物理引擎與狀態...');

    // 1. 解除全域鎖定與狀態，打斷所有正在進行的邏輯
    if (typeof isRitualActive !== 'undefined') isRitualActive = false;
    currentState = 'IDLE';
    selectedCard = null;
    drawnCount = 0;
    chaosVortexActive = false;

    // 2. 清除所有可能的計時器 (避免 setTimeout 在背景偷偷觸發)
    if (typeof shuffleIdleTimer !== 'undefined' && shuffleIdleTimer) {
        clearTimeout(shuffleIdleTimer);
    }

    // 3. ✨ 核心清理：清空物理世界 (不殺死引擎，只把東西丟掉)
    if (typeof world !== 'undefined' && typeof engine !== 'undefined') {
        // 移除所有剛體 (卡牌、牆壁)
        Matter.Composite.clear(world);
        // 清除引擎內部殘留的碰撞與受力紀錄
        Matter.Engine.clear(engine);
    }

    // ✨✨ 補回心肺復甦 2：離開戰場前，喚醒被 popstate 暫停的引擎！
    if (typeof Runner !== 'undefined' && typeof runner !== 'undefined' && typeof engine !== 'undefined') {
        try { Runner.start(runner, engine); } catch (e) { }
    }

    // 4. 清空所有的資料陣列
    cards = [];
    walls = [];
    spreadSlots = [];
    cutPiles = [];

    // 5. 隱藏與重置所有 UI 圖層
    const canvasLayer = document.getElementById('canvas-layer');
    if (canvasLayer) canvasLayer.classList.remove('active');

    const spreadLayer = document.getElementById('spread-layer');
    if (spreadLayer) {
        spreadLayer.innerHTML = '';
        spreadLayer.style.display = 'none';
        spreadLayer.style.opacity = '0';
        spreadLayer.className = ''; // 清除可能殘留的 radar-22 或 radar-78 class
    }

    const drawUi = document.getElementById('draw-ui');
    const ritualUi = document.getElementById('ritual-ui');
    if (drawUi) {
        drawUi.classList.add('hidden');
        drawUi.classList.remove('pointer-events-none');
    }
    if (ritualUi) {
        ritualUi.classList.add('hidden');
        ritualUi.classList.remove('pointer-events-none');
    }

    const cutModal = document.getElementById('cut-modal');
    if (cutModal) {
        cutModal.classList.add('hidden');
        cutModal.classList.remove('flex');
    }

    const globalBL = document.getElementById('global-breathing-light');
    if (globalBL) globalBL.classList.add('hidden');

    const overlay = document.getElementById('pre-shuffle-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    // 6. 清除系統的對話框與呼吸燈
    if (typeof BL !== 'undefined') BL.clear();

    // 7. 更新 Session Token，直接作廢正在背景跑的 AutoBot
    if (typeof ritualSessionToken !== 'undefined') {
        ritualSessionToken = Date.now().toString();
    }

    // ✨ 清除跨牌狀態
    if (typeof window.crossDrawState !== 'undefined') {
        window.crossDrawState.active = false;
    }

    // 8. 安全導航回首頁
    if (typeof navTo === 'function') navTo('screen-home');
}

// ==========================================
// ✨ 局部設定還原系統 (精準打擊版)
// ==========================================
window.restoreSubSettings = function (category) {
    let confirmMsg = '';

    if (category === 'op') confirmMsg = '確定要將「操作設定」還原為預設值嗎？';
    if (category === 'theme') confirmMsg = '確定要將「主題與背景」還原為預設值嗎？';
    if (category === 'card') confirmMsg = '確定要清除「自訂牌背與牌面」設定嗎？\n(牌陣設定不會受影響)';

    showConfirm(confirmMsg, async () => {
        if (category === 'op') {
            await DB.set('select_mode', 'click');
            await DB.set('draw_style', 'full');
            await DB.set('stage_shuffle', true);
            await DB.set('min_shuffle_count', 3);
            await DB.set('stage_wash', true);
            await DB.set('stage_cut', true);
            await DB.set('haptic_enabled', true);
        }
        else if (category === 'theme') {
            await DB.set('app_theme_color', '#1e1b4b');
            await DB.set('deck_theme', 'cards');
            await DB.set('bg_img', null);
            await DB.set('desk_img', null);
            await DB.set('tarot_anim_splash', null);
            // 立即還原畫面顏色
            if (typeof applyThemeColor === 'function') applyThemeColor('#1e1b4b');
        }
        else if (category === 'card') {
            await DB.set('cardback', null);
            // 這裡可以依據未來需求，加入更多關於牌面外觀的還原邏輯
        }

        // 重新讀取資料庫，將剛才還原的設定同步渲染回 HTML 介面上
        if (typeof initSettingsUI === 'function') await initSettingsUI();
        if (typeof syncSystemCache === 'function') await syncSystemCache();

        showToast('✅ 設定已還原預設值！');
    });
};

// ============================================================================
// ✨ 系統級防護：攔截並升級 navTo，支援手機實體返回鍵 (Session ID 斷尾求生版)
// ============================================================================
if (!window.hasHistoryApiUpgraded) {
    window.appSessionId = Date.now(); // ✨ 1. 初始化世代 ID

    // ✨ 確保載入時，底層有一個合法的首頁紀錄，並佈下「退出陷阱」
    if (!history.state || !history.state.screen) {
        history.replaceState({ exit_trap: true }, '');
        history.pushState({ screen: 'screen-home', sessionId: window.appSessionId }, '', '#screen-home');
    }

    const originalNavTo = window.navTo;

    // 覆寫 navTo
    window.navTo = function (targetId) {
        // 🌟 核心：如果目標是「回到首頁」，執行斷尾求生！
        if (targetId === 'screen-home') {
            window.isRitualActive = false; // 清除儀式狀態
            window.appSessionId = Date.now(); // ✨ 刷新世代 ID，宣告前面的紀錄全部過期！

            // ✨✨ 補回心肺復甦 3：只要安全回到首頁，確保引擎心跳恢復！
            if (typeof Runner !== 'undefined' && typeof runner !== 'undefined' && typeof engine !== 'undefined') {
                try { Runner.start(runner, engine); } catch (e) { }
            }

            if (typeof originalNavTo === 'function') {
                originalNavTo(targetId);
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            }

            // 使用 replaceState (覆寫當前指針)，而不是推入新紀錄
            history.replaceState({ screen: 'screen-home', sessionId: window.appSessionId }, '', `#${targetId}`);
            return;
        }

        // 其他畫面的正常跳轉邏輯
        if (typeof originalNavTo === 'function') {
            originalNavTo(targetId);
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        }

        // 寫入紀錄時，一併綁定當前的 Session ID
        if (history.state === null || history.state.screen !== targetId) {
            history.pushState({ screen: targetId, sessionId: window.appSessionId }, '', `#${targetId}`);
        }
    };

    window.addEventListener('popstate', (e) => {
        // 1. 攔截設定子視窗 (Priority 1)
        const overlay = document.getElementById('sub-settings-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            if (typeof closeSubSettings === 'function') closeSubSettings(true);
            return;
        }

        // 2. 攔截百科編輯與跳出視窗 (Priority 2)
        const dictEdit = document.getElementById('modal-dict-edit');
        if (dictEdit && !dictEdit.classList.contains('hidden')) {
            if (typeof closeDictEdit === 'function') closeDictEdit();
            return;
        }
        const meaningModal = document.getElementById('card-meaning-modal');
        if (meaningModal && !meaningModal.classList.contains('hidden')) {
            meaningModal.classList.add('hidden');
            meaningModal.classList.remove('flex');
            return;
        }

        // 2.5 攔截抽牌設定 Modal
        const deckModal = document.getElementById('modal-deck');
        if (deckModal && !deckModal.classList.contains('hidden')) {
            deckModal.classList.add('hidden'); deckModal.classList.remove('flex');
            return;
        }
        const spreadModal = document.getElementById('modal-spread');
        if (spreadModal && !spreadModal.classList.contains('hidden')) {
            spreadModal.classList.add('hidden'); spreadModal.classList.remove('flex');
            return;
        }

        // 🌟 3. 歷史紀錄過期攔截器 (斷尾求生核心) 🌟
        if (e.state && e.state.sessionId && e.state.sessionId !== window.appSessionId) {
            // 系統發現這是一筆「上一輪占卜」的舊紀錄
            history.back(); // 閉著眼睛繼續往後退！
            return; // 🛑 終止 UI 渲染，確保畫面停在首頁不閃爍！
        }

        // 4. 合法的正常畫面切換渲染
        if (e.state && e.state.screen) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(e.state.screen);
            if (target) target.classList.add('active');
        }
    });

    window.hasHistoryApiUpgraded = true;
}

// 🎬 華麗開場動畫劇本 (大->小聚能，小->大綻放，尺寸優化版)
window.playSplashAnimation = function () {
    const splashScreen = document.getElementById('screen-splash');
    const mandala = document.getElementById('mandala-container');
    if (!splashScreen) return;

    // ⏱️ 時間軸設定
    const DRAW_SPEED = 30;          // 每畫一個殘影的速度 (毫秒)
    const PHASE_1_FRAMES = 35;      // 階段一：往內縮聚能的數量
    const PHASE_2_FRAMES = 20;      // 階段二：往外綻放的數量
    const TOTAL_FRAMES = PHASE_1_FRAMES + PHASE_2_FRAMES;

    const CRYSTAL_VIEW_TIME = 2000; // 布簾拉開後觀賞時間

    if (mandala) {
        mandala.innerHTML = '';
        let currentFrame = 0;

        const drawInterval = setInterval(() => {
            if (currentFrame >= TOTAL_FRAMES) {
                clearInterval(drawInterval);
                setTimeout(() => {
                    mandala.style.opacity = '0';
                    splashScreen.classList.add('curtain-open');
                }, 300);
                return;
            }

            const square = document.createElement('div');
            let scale, rotate, opacity;

            // 🌀 動畫邏輯運算 (尺寸微調)
            if (currentFrame < PHASE_1_FRAMES) {
                // 【階段一：聚能】 從 1.4 倍縮小到 0.2 倍 (不會超出螢幕了)
                scale = 1.4-(currentFrame / PHASE_1_FRAMES) * 1.2;
                rotate = currentFrame * 15;
                opacity = 1;
            } else {
                // 【階段二：綻放】 從 0.2 倍放大到 2.0 倍 (剛剛好填滿螢幕)
                let exFrame = currentFrame-PHASE_1_FRAMES;
                scale = 0.2 + (exFrame / PHASE_2_FRAMES) * 1.8;
                rotate = (PHASE_1_FRAMES * 15)-(exFrame * 20);
                opacity = 1-(exFrame / PHASE_2_FRAMES);
            }

            // ✨ 設定方形初始外觀 (將原本的 w-56 h-56 縮小為 w-40 h-40)
            square.className = 'absolute w-40 h-40 border border-yellow-300/50 transition-all ease-out';
            square.style.transitionDuration = currentFrame < PHASE_1_FRAMES ? '800ms' : '400ms';
            square.style.transform = `scale(1.4) rotate(0deg)`; // 初始比例對齊聚能第一幀
            square.style.boxShadow = '0 0 15px rgba(253, 224, 71, 0.2)';
            square.style.opacity = '0';

            mandala.appendChild(square);

            requestAnimationFrame(() => {
                square.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
                square.style.opacity = opacity;
            });

            currentFrame++;
        }, DRAW_SPEED);
    } else {
        splashScreen.classList.add('curtain-open');
    }

    // 🔮 最終幕退場
    const totalTime = (TOTAL_FRAMES * DRAW_SPEED) + 300 + CRYSTAL_VIEW_TIME;
    setTimeout(() => {
        splashScreen.style.opacity = '0';
        splashScreen.style.pointerEvents = 'none';

        setTimeout(() => {
            splashScreen.classList.remove('active');
            splashScreen.classList.add('hidden');
            if (typeof navTo === 'function') navTo('screen-home', false);
        }, 1000);
    }, totalTime);
};

// 🎬 華麗謝幕：布簾關閉與退出程式
window.playCurtainCloseAnimationAndExit = function () {
    const splashScreen = document.getElementById('screen-splash');
    if (!splashScreen) {
        window.close();
        return;
    }

    // 1. 隱藏其他介面，確保畫面純淨
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    // 2. 喚醒開場動畫用的布簾容器
    splashScreen.classList.remove('hidden');
    splashScreen.style.opacity = '1';
    splashScreen.style.pointerEvents = 'auto'; // 封鎖點擊防護

    // 3. 延遲一下讓 DOM 吃到顯示狀態，再拔掉 curtain-open 來觸發 CSS 的關門動畫
    setTimeout(() => {
        splashScreen.classList.remove('curtain-open');

        // 4. 等待 1.5 秒布簾完全關上後，嘗試關閉 PWA 或網頁
        setTimeout(() => {
            try {
                window.close(); // 嘗試呼叫瀏覽器原生關閉
            } catch (e) { }

            // 若環境不允許 window.close (如 iOS Safari)，則以文字畫面優雅收尾
            document.body.innerHTML = '<div style="display:flex; height:100dvh; width:100vw; background:black; color:#d8b4fe; justify-content:center; align-items:center; font-size:1.2rem; letter-spacing:0.3em; font-family:\'Noto Serif TC\', serif; font-weight:bold;">✨ 儀式圓滿結束 ✨</div>';
        }, 1500); // 對應 CSS 裡的 duration-[1.5s]
    }, 50);
};

let manualSession = {
    time: '',
    question: '',
    spread: 'single',
    selectedCards: [], // 格式: [ { slotIndex: 0, cardId: 12, name: '吊人' }, ... ]
};

// 1. 開啟手動設定彈窗
async function openManualSetupModal() {
    const modal = document.getElementById('manual-setup-modal');
    const selectSpread = document.getElementById('manual-spread-select');
    const selectDeck = document.getElementById('manual-deck-select');
    
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(now-tzoffset)).toISOString().slice(0, 16);
    document.getElementById('manual-time').value = localISOTime;
    document.getElementById('manual-question').value = '';

    if (selectDeck) {
        const themeList = await DB.get('deck_theme_list', [
            { name: '經典萊德偉特', id: 'cards' },
            { name: '托特塔羅牌', id: 'thoth' }
        ]);
        selectDeck.innerHTML = themeList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        const currentTheme = await DB.get('deck_theme', 'cards');
        selectDeck.value = currentTheme;
    }

    selectSpread.innerHTML = '';
    
    TAROT_SPREADS_CONFIG.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = sp.id;
        const labelName = sp.label || sp.name || sp.id || '未命名牌陣';
        const iconSymbol = sp.icon || '🔮';
        if (labelName.includes('張')) opt.innerText = `${iconSymbol} ${labelName}`;
        else {
            const countNum = sp.count || sp.cardsNum || sp.cards || (sp.positions ? sp.positions.length : 0) || (sp.slots ? sp.slots.length : 1);
            opt.innerText = `${iconSymbol} ${labelName} (${countNum}張)`;
        }
        selectSpread.appendChild(opt);
    });

    const customSpreads = await DB.get('custom_spreads', []);
    customSpreads.forEach((sp, idx) => {
        const opt = document.createElement('option');
        opt.value = `custom_saved_${idx}`;
        const labelName = sp.name;
        const iconSymbol = sp.icon || '✨';
        const countNum = sp.meanings ? sp.meanings.length : sp.positions.length;
        opt.innerText = `${iconSymbol} ${labelName} (${countNum}張)`;
        selectSpread.appendChild(opt);
    });

    // ✨ 將記憶體中的自訂抽牌數生成臨時選項
    if (currentSelectedSpread && currentSelectedSpread.startsWith('custom_dynamic_')) {
        const count = parseInt(currentSelectedSpread.replace('custom_dynamic_', ''));
        const opt = document.createElement('option');
        opt.value = currentSelectedSpread;
        opt.innerText = `🔢 自訂抽取 (${count}張)`;
        selectSpread.appendChild(opt);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeManualSetupModal() {
    const modal = document.getElementById('manual-setup-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ✨ 替換：初始化手動選牌介面
function initManualDrawInterface() {
    const totalCount = manualSession.count;
    const firstSlotName = manualSession.slots[0] || '位置 1';

    // ✨ 核心修復 2：完美同步呼吸燈，精確呈現位置與張數（例如：請選擇第 1 / 7 張牌：【過去】）
    updateManualBL(`請選擇第 1 / ${totalCount} 張牌：【${firstSlotName}】`);

    // 渲染右上角迷你雷達
    const spreadConfig = TAROT_SPREADS_CONFIG.find(s => s.id === manualSession.spread) || { slots: manualSession.slots };
    // 確保 radar 能吃到正確的 slots 長度
    if (!spreadConfig.slots) {
        spreadConfig.slots = manualSession.slots;
    }
    renderManualRadar(spreadConfig);

    // 渲染文字記錄區
    renderManualTextList();

    // 渲染 78 張牌的列表
    renderManualEncyclopediaList();

    // 更新完成按鈕狀態
    document.getElementById('btn-manual-finish').disabled = true;
}

function updateManualBL(text) {
    document.getElementById('manual-bl').innerText = text;
}

// 渲染迷你雷達縮圖
function renderManualRadar(config) {
    const radar = document.getElementById('manual-radar');
    radar.innerHTML = '';

    // 在 16x16 網格內按比例簡化排列卡牌槽位
    config.slots.forEach((slot, i) => {
        const dot = document.createElement('div');
        dot.id = `radar-dot-${i}`;
        dot.className = "absolute w-2 h-2 rounded-full border border-yellow-500/50 bg-purple-950 transition-colors duration-300";
        // 抓取牌陣佈局座標（如果原有代碼有 layout，就依據 layout 換算比例百分比）
        let x = 40 + (i * 10);
        let y = 40;
        if (config.layout && config.layout[i]) {
            x = config.layout[i].x * 100;
            y = config.layout[i].y * 100;
        }
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
        radar.appendChild(dot);
    });
}

// ✨ 替換：渲染已選擇的卡牌文字列表
function renderManualTextList() {
    const container = document.getElementById('manual-selected-list');
    container.innerHTML = '';

    // 直接讀取儲存在 session 裡的位置清單
    manualSession.slots.forEach((slotName, idx) => {
        const div = document.createElement('div');
        const selected = manualSession.selectedCards.find(c => c.slotIndex === idx);

        if (selected) {
            // ✨ 核心修復：直接抓取 selected.name（並去除換行），安全、迅速且絕不報錯！
            const cardName = selected.name.replace('\n', ' ');
            div.innerHTML = `<span class="text-yellow-400 font-bold">${slotName}</span>: <span class="text-white">${cardName}</span>`;

            // 同步雷達燈號
            const dot = document.getElementById(`radar-dot-${idx}`);
            if (dot) dot.className = "absolute w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_5px_#facc15]";
        } else {
            div.innerHTML = `<span class="text-gray-500">${slotName}</span>: <span class="text-gray-600">（待選擇）</span>`;

            const dot = document.getElementById(`radar-dot-${idx}`);
            if (dot) dot.className = "absolute w-2 h-2 rounded-full border border-purple-500/50 bg-purple-950";
        }
        container.appendChild(div);
    });
}

// 宣告一個專門給手動選牌與替換功能用的快取
window.MANUAL_DECK_CACHE = [];

// ✨ 新增：智慧牌陣位置解析器
async function getSpreadMetaHelper(spreadId) {
    const defaultSlots = {
        'single': ['單牌神諭'],
        'triangle': ['過去', '現在', '未來'],
        'five': ['過去', '近過去', '現在', '近未來', '未來'],
        'hexagram': ['過去', '現在', '未來', '環境', '內心', '對策', '結果'],
        'two_paths': ['現狀', '選擇 A 的現況/過程', '選擇 A 的未來結果', '選擇 B 的現況/過程', '選擇 B 的未來結果'],
        'tree_of_life': ['王冠 (最高意志/靈性)', '智慧 (原動力/啟發)', '理解 (形式/限制)', '慈悲 (擴張/恩賜)', '嚴厲 (破壞/力量)', '美麗 (核心/和諧)', '勝利 (情感/直覺)', '榮耀 (理智/邏輯)', '基礎 (潛意識/根基)', '王國 (現實顯化/結果)'],
        'celtic': ['現狀', '阻礙與挑戰 (橫放)', '潛意識的根源', '過去的影響', '意識與目標', '未來的發展', '自我態度', '周遭環境影響', '希望與恐懼', '最終結果'],
        'horseshoe': ['過去', '現在', '隱藏的影響', '阻礙/挑戰', '周遭環境', '最佳行動/建議', '最終結果'],
        'zodiac': ['本命/自我 (牡羊)', '財富/價值 (金牛)', '溝通/學習 (雙子)', '家庭/根基 (巨蟹)', '創造/戀愛 (獅子)', '健康/工作 (處女)', '伴侶/合作 (天秤)', '偏財/蛻變 (天蠍)', '進修/遠行 (射手)', '事業/地位 (魔羯)', '人際/願景 (水瓶)', '潛意識/隱藏 (雙魚)'],
        'romany': Array.from({length: 21}, (_, i) => i < 7 ? `過去 ${i+1}` : (i < 14 ? `現在 ${i-6}` : `未來 ${i-13}`)),
        'tableau': Array.from({length: 36}, (_, i) => `第 ${i+1} 宮`),
    };

    if (defaultSlots[spreadId]) {
        return { slots: defaultSlots[spreadId], count: defaultSlots[spreadId].length };
    }

    if (spreadId && spreadId.startsWith('custom_saved_')) {
        const idx = parseInt(spreadId.replace('custom_saved_', ''));
        const spreads = await DB.get('custom_spreads', []);
        const s = spreads[idx];
        if (s) {
            const slots = s.meanings || (s.positions ? s.positions.map(p => p.meaning || '') : []);
            const finalSlots = slots.length > 0 ? slots : Array.from({ length: slots.length || 1 }, (_, i) => `位置 ${i + 1}`);
            return { slots: finalSlots, count: finalSlots.length };
        }
    }

    // ✨ 動態自訂抽牌數解析
    if (spreadId && spreadId.startsWith('custom_dynamic_')) {
        const count = parseInt(spreadId.replace('custom_dynamic_', ''));
        const dynamicSlots = Array.from({ length: count }, (_, i) => `第 ${i + 1} 張`);
        return {
            slots: dynamicSlots,
            count: count
        };
    }

    return { slots: ['位置 1'], count: 1 };
}

// ✨ 替換：確認設定並切換到手動選牌介面
async function confirmManualSetup() {
    manualSession.time = document.getElementById('manual-time').value.replace('T', ' ');
    manualSession.question = document.getElementById('manual-question').value || '手動登錄占卜';
    manualSession.spread = document.getElementById('manual-spread-select').value;
    manualSession.selectedCards = [];

    // ✨ 記錄所選的主牌組
    const deckSelect = document.getElementById('manual-deck-select');
    manualSession.mainDeckId = deckSelect.value;
    manualSession.mainDeckName = deckSelect.options[deckSelect.selectedIndex].text;

    const meta = await getSpreadMetaHelper(manualSession.spread);
    manualSession.slots = meta.slots;
    manualSession.count = meta.count;

    closeManualSetupModal();
    navTo('screen-manual-draw');
    
    // 生成對應的牌組做為手動點選清單
    window.MANUAL_DECK_CACHE = await generateBaseDeck(78);
    // 因為 generateBaseDeck 會吃 currentTheme，我們暫時切換
    const tempTheme = await DB.get('deck_theme', 'cards');
    await DB.set('deck_theme', manualSession.mainDeckId);
    window.MANUAL_DECK_CACHE = await generateBaseDeck(78);
    await DB.set('deck_theme', tempTheme); // 產完還原
    
    initManualDrawInterface();
}

// 2. 渲染 78 張牌基底 (改用 MANUAL_DECK_CACHE)
function renderManualEncyclopediaList() {
    const container = document.getElementById('manual-encyclopedia-container');
    container.innerHTML = '';

    // 建立卡牌網格 (使用 sm:grid-cols-5 讓手機版顯示更漂亮)
    const grid = document.createElement('div');
    grid.className = "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 pb-12";

    window.MANUAL_DECK_CACHE.forEach((card) => {
        const cardBox = document.createElement('div');
        cardBox.id = `manual-card-item-${card.id}`;
        cardBox.className = "relative bg-indigo-950/40 border border-purple-500/20 rounded-md p-1 flex flex-col items-center cursor-pointer transition-all hover:scale-105 active:scale-95";

        // 判斷這張牌是否已經被選中
        const isAlreadySelected = manualSession.selectedCards.some(c => c.cardId === card.id);

        cardBox.innerHTML = `
            <div class="w-full aspect-[2/3] bg-purple-900/30 rounded overflow-hidden relative">
                <img src="${card.image}" onerror="this.src='./assets/cards/cardback.jpg'" class="w-full h-full object-cover ${isAlreadySelected ? 'opacity-30 blur-[1px]' : ''}" loading="lazy">
                ${isAlreadySelected ? '<div class="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-yellow-300 font-bold">已選</div>' : ''}
            </div>
            <span class="text-[10px] mt-1 truncate text-gray-300 w-full text-center">${card.name.replace('\n', ' ')}</span>
        `;

        if (!isAlreadySelected) {
            cardBox.addEventListener('click', () => selectManualCard(card.id));
        }

        grid.appendChild(cardBox);
    });

    container.appendChild(grid);
}

// ✨ 替換：選取卡牌後的狀態推移
function selectManualCard(cardId) {
    const totalCount = manualSession.count;
    const nextSlotIdx = manualSession.selectedCards.length;

    if (nextSlotIdx >= totalCount) return;

    const el = document.getElementById(`manual-card-item-${cardId}`);
    if (el) el.classList.add('animate-bounce', 'border-yellow-400');

    const cardInfo = window.MANUAL_DECK_CACHE.find(c => c.id === cardId);

    setTimeout(() => {
        manualSession.selectedCards.push({
            slotIndex: nextSlotIdx,
            cardId: cardInfo.id,
            name: cardInfo.name,
            image: cardInfo.image
        });

        renderManualTextList();
        renderManualEncyclopediaList();

        const nextCount = manualSession.selectedCards.length;
        if (nextCount < totalCount) {
            // ✨ 核心修復 3：推進下一張時，從 slots 中精確撈出下一個位置名稱
            const nextSlotName = manualSession.slots[nextCount];
            updateManualBL(`請選擇第 ${nextCount + 1} / ${totalCount} 張牌：【${nextSlotName}】`);
        } else {
            updateManualBL('🎉 牌盤登錄完成！請確認儲存。');
            document.getElementById('btn-manual-finish').disabled = false;
        }
    }, 200);
}

// 1. 修正手動登錄完成後的儲存位置 (確保對齊 history 資料表)
async function finishManualRitual() {
    const config = TAROT_SPREADS_CONFIG.find(s => s.id === manualSession.spread);
    
    const newRecord = {
        id: 'manual_' + Date.now().toString(),
        date: manualSession.time,
        question: manualSession.question,
        spread: manualSession.spread,
        spreadLabel: config.label || config.name,
        source: 'manual', 
        mainDeckId: manualSession.mainDeckId || 'cards',         // ✨
        mainDeckName: manualSession.mainDeckName || '經典偉特', // ✨
        cards: manualSession.selectedCards.map(c => ({
            id: c.cardId,
            name: c.name,
            image: c.image, 
            isReversed: false,
            slotIndex: c.slotIndex
        })),
        modifications: [],
        notes: ''
    };

    let history = await DB.get('history', []); 
    history.unshift(newRecord);
    await DB.set('history', history);
    
    showToast('✨ 紀錄已儲存！');
    
    setTimeout(async () => {
        await renderHistoryList();
        navTo('screen-history');
        showRecordDetails(newRecord, false);
    }, 1000);
}

// 5. 快速分類篩選 (改為比對卡牌的 type 屬性)
function filterManualCards(type) {
    document.querySelectorAll('.manual-filter-btn').forEach(btn => {
        btn.classList.remove('bg-yellow-500', 'text-slate-900', 'font-bold');
        btn.classList.add('bg-purple-900/60');
    });
    event.target.classList.remove('bg-purple-900/60');
    event.target.classList.add('bg-yellow-500', 'text-slate-900', 'font-bold');

    const cardBoxes = document.querySelectorAll('[id^="manual-card-item-"]');
    cardBoxes.forEach(box => {
        const cardId = box.id.replace('manual-card-item-', '');
        const card = window.MANUAL_DECK_CACHE.find(c => c.id === cardId);

        let match = false;
        if (type === 'all') match = true;
        else if (type === card.type) match = true; // ✨ 你的卡牌物件自帶 type (major, wands...)

        box.style.display = match ? 'flex' : 'none';
    });
}

// 6. 反悔與中斷
function undoLastManualCard() {
    if (manualSession.selectedCards.length === 0) return;

    manualSession.selectedCards.pop();
    document.getElementById('btn-manual-finish').disabled = true;

    const config = TAROT_SPREADS_CONFIG.find(s => s.id === manualSession.spread);
    const nextCount = manualSession.selectedCards.length;
    updateManualBL(`請選擇第 ${nextCount + 1} / ${config.count} 張牌：【${config.slots[nextCount]}】`);

    renderManualTextList();
    renderManualEncyclopediaList();
}

function abortManualDraw() {
    showConfirm("確定要中斷手動登錄並返回主頁嗎？", () => {
        navTo('screen-home');
    });
}

let currentDetailRecord = null; // 當前瀏覽中的紀錄副本
let originalRecordBackup = null; // 原始紀錄備份（用以比對與放棄變更）
let isModifyingState = false; // 是否正在進行牌陣修改
let selectedReplacementCardId = null; // 替換視窗中被選中的卡牌 ID
let slotIndexToReplace = null; // 正在進行替换的牌陣槽位
// ✨ 全域問題修改函數
window.editRecordQuestion = async function () {
    if (window.isInTrashView || (typeof isModifyingState !== 'undefined' && isModifyingState)) return;

    const newQ = prompt('✏️ 請輸入新的問題：', currentDetailRecord.question || '');
    if (newQ !== null && newQ.trim() !== '') {
        currentDetailRecord.question = newQ.trim();

        // 立即更新解牌室畫面上的文字
        const qEl = document.getElementById('reading-question');
        if (qEl) qEl.innerHTML = `${currentDetailRecord.question} <button onclick="editRecordQuestion()" class="text-sm ml-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">✏️</button>`;

        // 存入資料庫
        let history = await DB.get('history', []);
        const idx = history.findIndex(r => r.id === currentDetailRecord.id);
        if (idx !== -1) {
            history[idx].question = currentDetailRecord.question;
            await DB.set('history', history);
            if (typeof showToast === 'function') showToast('✅ 問題已更新！');

            // ✨ 核心修復：強制刷新背景清單，確保列表同步更新
            window.allHistoryRecords = await DB.get('history', []);
            if (typeof window.applyHistoryFilters === 'function') window.applyHistoryFilters();
        }
    }
};

// A. 顯示紀錄詳情 (流暢淡入、零閃爍版)
window.showRecordDetails = function (record, isReadOnly = false) {
    currentDetailRecord = JSON.parse(JSON.stringify(record)); // 深拷貝
    originalRecordBackup = JSON.parse(JSON.stringify(record));
    if (typeof isModifyingState !== 'undefined') isModifyingState = false;
    currentViewingRecordId = record.id;

    // ✨ 流暢度優化 1：先將按鈕區塊設為「完全透明」，隱藏變身前的舊按鈕
    const readingButtons = document.getElementById('reading-buttons');
    if (readingButtons) {
        readingButtons.style.transition = 'none'; // 移除漸變，瞬間隱形
        readingButtons.style.opacity = '0';
    }

    // 1. 呼叫原始渲染函數 (它會在內部畫出舊按鈕，但目前是透明的)
    if (typeof renderReadingRoom === 'function') renderReadingRoom(currentDetailRecord, false);

    // 2. 處理手動新增的修改牌盤按鈕
    const btnModify = document.getElementById('btn-modify-manual-record');
    const btnDiscard = document.getElementById('btn-discard-modifications');
    if (btnModify && btnDiscard) {
        if (record.source === 'manual' && !isReadOnly) {
            btnModify.classList.remove('hidden');
            btnModify.onclick = () => startModifyingMode();
        } else {
            btnModify.classList.add('hidden');
        }
        btnDiscard.classList.add('hidden');
    }

    // 3. 渲染修改軌跡履歷
    if (typeof renderModificationLogs === 'function') renderModificationLogs(currentDetailRecord);

    // ✨ 流暢度優化 2：微延遲變身，變身完畢後再「淡入顯示」
    setTimeout(() => {
        // --- 處理問題小鉛筆 ---
        const qEl = document.getElementById('reading-question');
        if (qEl) {
            const safeQuestion = currentDetailRecord.question || '無設定問題';
            if (isReadOnly) {
                qEl.innerHTML = safeQuestion; // 回收桶內唯讀
            } else {
                qEl.innerHTML = `${safeQuestion} <button onclick="editRecordQuestion()" class="text-sm ml-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">✏️</button>`;
            }
        }

        // --- 處理按鈕變身術 ---
        if (readingButtons) {
            const buttons = readingButtons.querySelectorAll('button');

            buttons.forEach(btn => {
                const originalText = btn.innerText;
                const originalClick = btn.getAttribute('onclick') || '';

                // 變身：刪除按鈕
                if (originalClick.includes('delete') || originalText.includes('刪除')) {
                    if (isReadOnly) btn.innerText = '🔥 永久刪除';
                    else btn.innerText = '🗑️ 刪除';
                    btn.setAttribute('onclick', 'deleteCurrentRecord()');
                }

                // 變身：備註按鈕 -> 還原按鈕
                if (originalClick.includes('Note') || originalClick.includes('note') || originalText.includes('備註') || originalClick.includes('restoreCurrentRecord')) {
                    if (!btn.hasAttribute('data-original-onclick')) {
                        btn.setAttribute('data-original-onclick', originalClick);
                    }

                    if (isReadOnly) {
                        btn.innerText = '♻️ 還原';
                        btn.setAttribute('onclick', 'restoreCurrentRecord()');
                    } else {
                        btn.innerText = '✏️ 更新備註';
                        btn.setAttribute('onclick', btn.getAttribute('data-original-onclick'));
                    }
                }
            });

            // ✨ 變身完成，執行優雅的淡入動畫 (Fade-in)
            requestAnimationFrame(() => {
                readingButtons.style.transition = 'opacity 0.25s ease-in-out';
                readingButtons.style.opacity = '1';
            });
        }
    }, 30); // 縮短為 30 毫秒，足以避開重繪，又不會覺得有延遲感
};

// B. 啟動修改模式 (修正版)
function startModifyingMode() {
    isModifyingState = true;
    showToast('⚙️ 已進入編輯模式，點擊牌面可替換卡牌');

    // 下方按鈕切換：隱藏修改按鈕，顯示放棄按鈕
    document.getElementById('btn-modify-manual-record').classList.add('hidden');

    const btnDiscard = document.getElementById('btn-discard-modifications');
    if (btnDiscard) {
        btnDiscard.classList.remove('hidden');
        btnDiscard.onclick = () => discardModifications();
    }

    // ✨ 隱藏解牌室原本的 返回/刪除/更新 按鈕，避免畫面太擠
    const readingButtons = document.getElementById('reading-buttons');
    if (readingButtons) readingButtons.classList.add('hidden');

    // ✨ 核心修復：抓取你系統中真正的卡牌 class ('history-card')
    const cardsOnBoard = document.querySelectorAll('.history-card');
    cardsOnBoard.forEach((cardEl, idx) => {
        cardEl.classList.add('modifying-shake');

        // 覆寫點擊事件：從原本的「打開牌義」，變成「打開卡牌替換視窗」
        cardEl.onclick = (e) => {
            e.stopPropagation(); // 防止觸發其他層的點擊
            openReplacementModal(idx);
        };
    });
}

// C. 放棄變更 (修正版)
function discardModifications() {
    isModifyingState = false;
    // 還原備份
    currentDetailRecord = JSON.parse(JSON.stringify(originalRecordBackup));

    // ✨ 恢復解牌室原本的按鈕顯示
    const readingButtons = document.getElementById('reading-buttons');
    if (readingButtons) readingButtons.classList.remove('hidden');

    // 重新渲染畫面
    showRecordDetails(currentDetailRecord, false);
    showToast('已放棄變更');
}

// D. 開啟卡牌替換百科視窗
async function openReplacementModal(slotIdx) {
    slotIndexToReplace = slotIdx;
    selectedReplacementCardId = null;

    const spreadConfig = TAROT_SPREADS_CONFIG.find(s => s.id === currentDetailRecord.spread);
    const slotName = spreadConfig.slots[slotIdx];
    const currentCardOnSlot = currentDetailRecord.cards[slotIdx];

    // 設定左上資訊
    document.getElementById('replacement-meta-title').innerText = `目前位置：【${slotName}】 原始牌：[${currentCardOnSlot.name}]`;

    // 初始化右上虛線目標框
    const targetBox = document.getElementById('target-replacement-box');
    targetBox.innerHTML = '<span class="text-[8px] text-gray-500 text-center">尚未<br>選擇</span>';

    document.getElementById('btn-confirm-replace').disabled = true;

    // 渲染排除已經在陣上的其他 70+ 張牌
    const encyclopediaGrid = document.getElementById('replacement-encyclopedia-grid');
    encyclopediaGrid.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = "grid grid-cols-4 gap-2";

    // 抓取目前全陣上正在被使用的卡牌 ID 清單
    const cardsOnBoardIds = currentDetailRecord.cards.map(c => c.id);

    // ✨ 如果記憶體沒有快取，立刻生成一份
    if (!window.MANUAL_DECK_CACHE || window.MANUAL_DECK_CACHE.length === 0) {
        window.MANUAL_DECK_CACHE = await generateBaseDeck(78);
    }

    // ✨ 迭代取代原本的 TAROT_CARDS_DATA
    window.MANUAL_DECK_CACHE.forEach((card) => {
        const id = card.id;
        if (cardsOnBoardIds.includes(id) && id !== currentCardOnSlot.id) return;

        const cardItem = document.createElement('div');
        cardItem.className = "bg-purple-950/50 border border-purple-500/20 rounded p-1 flex flex-col items-center cursor-pointer transition-all hover:scale-105";

        cardItem.innerHTML = `
            <div class="w-full aspect-[2/3] rounded overflow-hidden">
                <img src="${card.image}" class="w-full h-full object-cover" loading="lazy">
            </div>
            <span class="text-[10px] mt-1 text-gray-300 truncate w-full text-center">${card.name.replace('\n', ' ')}</span>
        `;
        cardItem.onclick = () => selectCardToReplacementBox(id);
        grid.appendChild(cardItem);
    });

    encyclopediaGrid.appendChild(grid);

    const modal = document.getElementById('card-replacement-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeReplacementModal() {
    const modal = document.getElementById('card-replacement-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// E. 點擊百科的牌跳入右上角虛線框
function selectCardToReplacementBox(cardId) {
    selectedReplacementCardId = cardId;
    //const card = TAROT_CARDS_DATA[cardId];
    const card = window.MANUAL_DECK_CACHE.find(c => c.id === cardId); // ✨ 改用快取抓資料

    const targetBox = document.getElementById('target-replacement-box');
    targetBox.innerHTML = `
        <img src="./assets/cards/${card.img}" class="w-full h-full object-cover rounded">
        <div class="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-yellow-300 text-center py-0.5 truncate">${card.name}</div>
    `;

    document.getElementById('btn-confirm-replace').disabled = false;
}

// F. 執行替換與軌跡運算
async function executeCardReplacement() {
    if (selectedReplacementCardId === null || slotIndexToReplace === null) return;

    const originalCardId = originalRecordBackup.cards[slotIndexToReplace].id;
    const previousCardId = currentDetailRecord.cards[slotIndexToReplace].id;
    const newCardId = selectedReplacementCardId;

    if (previousCardId === newCardId) {
        closeReplacementModal();
        return; // 沒變
    }

    // 替換牌陣陣上的資料
    currentDetailRecord.cards[slotIndexToReplace].id = newCardId;
    currentDetailRecord.cards[slotIndexToReplace].name = TAROT_CARDS_DATA[newCardId].name;

    // 💡 替換軌跡運算邏輯 (5-6)：
    // 如果修改回「原始牌」，該條修改履歷會消除。
    const dateStr = new Date().toLocaleString('zh-TW');
    const spreadConfig = TAROT_SPREADS_CONFIG.find(s => s.id === currentDetailRecord.spread);
    const slotName = spreadConfig.slots[slotIndexToReplace];

    // 先剔除掉該槽位先前的任何修改紀錄，重新計算最新軌跡
    currentDetailRecord.modifications = currentDetailRecord.modifications.filter(m => m.slotIndex !== slotIndexToReplace);

    // 如果最新被改成的牌與原始牌不同，則塞入履歷
    if (newCardId !== originalCardId) {
        currentDetailRecord.modifications.push({
            time: dateStr,
            slotIndex: slotIndexToReplace,
            slotName: slotName,
            fromName: TAROT_CARDS_DATA[originalCardId].name,
            toName: TAROT_CARDS_DATA[newCardId].name
        });
    }

    // 儲存至資料庫
    let history = await DB.get('history_records', []);
    const idx = history.findIndex(r => r.id === currentDetailRecord.id);
    if (idx !== -1) {
        history[idx] = currentDetailRecord;
        await DB.set('history_records', history);
    }

    closeReplacementModal();
    showToast('✨ 替換成功！');

    // 重新載入，套用修改
    showRecordDetails(currentDetailRecord, false);
}

// G. 渲染修改履歷 (功能 5-6)
function renderModificationLogs(record) {
    const section = document.getElementById('modification-log-section');
    const list = document.getElementById('modification-log-list');

    if (!record.modifications || record.modifications.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';

    record.modifications.forEach(log => {
        const item = document.createElement('div');
        item.className = "flex justify-between py-1 border-b border-white/5";
        item.innerHTML = `
            <span class="text-gray-400 font-mono">${log.time}</span>
            <span class="text-yellow-100 font-bold">${log.slotName}</span>
            <span class="text-gray-300">將 <span class="text-red-400">[${log.fromName}]</span> 變更為 <span class="text-green-400">[${log.toName}]</span></span>
        `;
        list.appendChild(item);
    });
}

// ==========================================
// 🔍 搜尋過濾框收闔控制
// ==========================================
window.toggleHistoryFilter = function () {
    const filterBar = document.getElementById('history-filter-bar');
    const toggleBtn = document.getElementById('btn-filter-toggle');

    if (!filterBar) return;

    if (filterBar.classList.contains('hidden')) {
        // 展開：先移除 hidden 讓它進入畫面，再執行滑入淡入動畫
        filterBar.classList.remove('hidden');
        filterBar.style.opacity = '0';
        filterBar.style.transform = 'translateY(-15px) scaleY(0.9)';
        toggleBtn.classList.add('opacity-50', 'scale-90'); // 放大鏡按下去時變暗縮小

        requestAnimationFrame(() => {
            filterBar.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'; // Q彈的展開特效
            filterBar.style.opacity = '1';
            filterBar.style.transform = 'translateY(0) scaleY(1)';
        });
    } else {
        // 收闔：先執行滑出淡出動畫，結束後再真正 hidden
        filterBar.style.transition = 'all 0.2s ease-in-out';
        filterBar.style.opacity = '0';
        filterBar.style.transform = 'translateY(-10px) scaleY(0.95)';
        toggleBtn.classList.remove('opacity-50', 'scale-90');

        setTimeout(() => {
            filterBar.classList.add('hidden');
        }, 200); // 配合 transition 的 0.2 秒
    }
};

// ==========================================
// 📋 一鍵複製解牌結果至剪貼簿
// ==========================================
window.copyReadingResults = async function () {
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    if (!record || !record.cards) return;

    const customSpreads = await DB.get('custom_spreads', []);
    let spreadName = '單牌神諭';
    if (record.spread === 'triangle') spreadName = '聖三角';
    else if (record.spread === 'five') spreadName = '五張序';
    else if (record.spread === 'hexagram') spreadName = '六芒星';
    else if (record.spread.startsWith('custom_saved_')) {
        const idx = parseInt(record.spread.replace('custom_saved_', ''));
        spreadName = customSpreads[idx] ? customSpreads[idx].name : '自訂牌陣';
    } else if (record.spread.startsWith('custom_dynamic_')) {
        const count = parseInt(record.spread.replace('custom_dynamic_', ''));
        spreadName = `自訂抽取 (${count}張)`;
    }

    const deckName = record.mainDeckName || '預設牌組';
    let resultText = `問題：${record.question || '無'}\n主牌陣：${spreadName}\n主牌組：${deckName}\n${record.date || new Date().toLocaleString('zh-TW')}\n\n`;

    // 輸出主牌陣 (與其身上的補充神諭)
    resultText += `【主牌解讀】\n`;
    record.cards.forEach(c => {
        const slotName = record.spread === 'single' ? '' : getSpreadSlotName(record.spread, c.slotIndex, customSpreads);
        const cardName = c.name.split('\n').pop().trim();
        const deckKey = c.image.match(/assets\/([^\/]+)\//) ? c.image.match(/assets\/([^\/]+)\//)[1] : 'cards';
        const isThoth = deckKey === 'thoth';
        const orientationText = isThoth ? '' : (c.isReversed ? '(逆位)' : '(正位)');

        let line = record.spread === 'single' ? `${cardName}${orientationText}` : `${slotName}：${cardName}${orientationText}`;

        // 附加補充神諭資訊
        if (record.crossDraws) {
            const supplements = record.crossDraws.filter(d => d.type === 'single' && d.slotIndex === c.slotIndex);
            supplements.forEach(sup => {
                const supName = sup.card.name.split('\n').pop().trim();
                const supOri = sup.card.isReversed ? '逆位' : '正位';
                line += ` (補充：${sup.deckName}-${supName} ${supOri})`;
            });
        }
        resultText += line + '\n';
    });

    // 輸出全牌陣跨牌
    if (record.crossDraws) {
        const fullLayers = record.crossDraws.filter(d => d.type === 'full');
        fullLayers.forEach((layer, idx) => {
            resultText += `\n【跨牌對照 ${idx + 1}：${layer.deckName}】\n`;
            layer.cards.forEach(c => {
                const slotName = record.spread === 'single' ? '' : getSpreadSlotName(record.spread, c.slotIndex, customSpreads);
                const cardName = c.name.split('\n').pop().trim();
                const layerDeckKey = c.image.match(/assets\/([^\/]+)\//) ? c.image.match(/assets\/([^\/]+)\//)[1] : 'cards';
                const isLayerThoth = layerDeckKey === 'thoth';
                const orientationText = isLayerThoth ? '' : (c.isReversed ? '(逆位)' : '(正位)');
                
                resultText += record.spread === 'single' ? `${cardName}${orientationText}\n` : `${slotName}：${cardName}${orientationText}\n`;
            });
        });
    }

    // 執行複製
    try {
        await navigator.clipboard.writeText(resultText.trim());
        if (typeof showToast === 'function') showToast('📋 占卜與跨牌結果已複製！');
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = resultText.trim();
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast('📋 占卜結果已複製到剪貼簿！');
        } catch (err2) {
            if (typeof showToast === 'function') showToast('❌ 複製失敗，請確認瀏覽器權限');
        }
        document.body.removeChild(textArea);
    }
};

// ==========================================
// ➕ 跨牌與神諭補充系統
// ==========================================
window.currentDisplayLayer = -1; // -1 代表主牌陣，0 以上代表全牌陣跨牌層級

window.openCrossDrawModal = async function() {
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    const slotGrid = document.getElementById('cross-draw-slot-grid');
    const deckSelect = document.getElementById('cross-draw-deck');
    const modeSelect = document.getElementById('cross-draw-mode');
    const customSpreads = await DB.get('custom_spreads', []);

    // ✨ 1. 動態產生「可複選」的按鈕，點擊時會切換黃色背景
    slotGrid.innerHTML = record.cards.map(c => {
        const slotName = record.spread === 'single' ? '單牌神諭' : getSpreadSlotName(record.spread, c.slotIndex, customSpreads);
        return `<button type="button" data-val="${c.slotIndex}" 
            class="cross-slot-btn px-2.5 py-1 text-xs border border-purple-500 rounded bg-purple-900/60 text-purple-200 transition-colors" 
            onclick="this.classList.toggle('bg-yellow-500'); this.classList.toggle('text-purple-950'); this.classList.toggle('font-bold'); this.classList.toggle('bg-purple-900/60'); this.classList.toggle('text-purple-200');">
            ${slotName}
        </button>`;
    }).join('');

    // ======= 【替換為以下】 =======
    const currentTheme = await DB.get('deck_theme', 'cards');
    const themeList = await DB.get('deck_theme_list', [{ name: '經典萊德偉特', id: 'cards' }, { name: '托特塔羅牌', id: 'thoth' }]);
    
    // ✨ 修正 3：智慧迴避，自動挑選與當前主牌不同的牌組
    let defaultSelectIdx = 0;
    if (themeList.length > 1) {
        const currentIdx = themeList.findIndex(t => t.id === currentTheme);
        if (currentIdx !== -1) {
            defaultSelectIdx = (currentIdx + 1) % themeList.length; 
        }
    }

    deckSelect.innerHTML = themeList.map((t, idx) => `<option value="${t.id}" ${idx === defaultSelectIdx ? 'selected' : ''}>${t.name}</option>`).join('');
    const modeContainer = modeSelect.parentElement;
    const slotContainer = document.getElementById('cross-draw-slot-container');
    
    if (record.spread === 'single') {
        modeSelect.value = 'full';
        modeContainer.style.display = 'none';
        slotContainer.style.display = 'none';
    } else {
        modeContainer.style.display = 'block';
        modeSelect.value = 'single';
        slotContainer.style.display = 'block';
    }

    document.getElementById('cross-draw-modal').classList.replace('hidden', 'flex');
};

window.executeCrossDraw = async function() {
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    if (!record.crossDraws) record.crossDraws = [];

    const mode = document.getElementById('cross-draw-mode').value;
    const deckId = document.getElementById('cross-draw-deck').value;
    const deckName = document.getElementById('cross-draw-deck').options[document.getElementById('cross-draw-deck').selectedIndex].text;
    
    // ✨ 2. 蒐集所有被使用者點亮的按鈕 (陣列格式)
    let selectedSlots = [];
    if (mode === 'single') {
        const activeBtns = document.querySelectorAll('.cross-slot-btn.bg-yellow-500');
        activeBtns.forEach(btn => selectedSlots.push(parseInt(btn.dataset.val)));
        
        if (selectedSlots.length === 0) {
            if (typeof showToast === 'function') showToast('請至少選擇一個目標牌位！');
            return;
        }
    }

    const originalTheme = await DB.get('deck_theme', 'cards');

    window.crossDrawState = {
        active: true,
        type: mode,
        slotIndices: selectedSlots, // ✨ 記錄所選的多個位置
        deckId: deckId,
        deckName: deckName,
        originalTheme: originalTheme,
        parentRecord: JSON.parse(JSON.stringify(record)) 
    };

    document.getElementById('cross-draw-modal').classList.replace('flex', 'hidden');
    await DB.set('deck_theme', deckId);
    resetRitualEngineContext();
    isRitualActive = true; 
    
    // ✨ 3. 如果選了 1 張以上，我們給他一個專屬的動態牌陣名稱 'multi_cross'
    const dynamicSpreadType = mode === 'single' ? (selectedSlots.length === 1 ? 'single' : 'multi_cross') : record.spread;

    currentRitualData = {
        id: 'cross_' + Date.now().toString(),
        date: new Date().toLocaleString('zh-TW'),
        question: '跨牌補充神諭',
        spread: dynamicSpreadType, 
        cards: [],
        notes: ''
    };

    // ✨ 4. 抽後不放回：過濾已使用的牌 (支援多重牌位過濾)
    let baseDeck = await generateBaseDeck(78);
    let usedIds = new Set();
    const getDeckIdFromImage = (imgUrl) => {
        if (!imgUrl) return 'cards';
        const match = imgUrl.match(/assets\/([^\/]+)\//);
        return match ? match[1] : 'cards';
    };

    if (mode === 'single') {
        // 針對「每一個被選中的位置」去檢查有沒有牌被用過
        selectedSlots.forEach(slotIdx => {
            const origCard = record.cards.find(c => c.slotIndex === slotIdx);
            if (origCard && getDeckIdFromImage(origCard.image) === deckId) usedIds.add(origCard.id);
            const prevSingles = record.crossDraws.filter(d => d.type === 'single' && d.slotIndex === slotIdx && d.deckId === deckId);
            prevSingles.forEach(d => usedIds.add(d.card.id));
        });
    } else {
        record.cards.forEach(c => { if (getDeckIdFromImage(c.image) === deckId) usedIds.add(c.id); });
        const prevFulls = record.crossDraws.filter(d => d.type === 'full' && d.deckId === deckId);
        prevFulls.forEach(d => d.cards.forEach(c => usedIds.add(c.id)));
    }

    let availableDeck = baseDeck.filter(c => !usedIds.has(c.id));
    const requiredCards = mode === 'single' ? selectedSlots.length : record.cards.length;
    if (availableDeck.length < requiredCards) availableDeck = baseDeck; // 防呆
    currentRealDeck = shuffleArray(availableDeck);

    const overlay = document.getElementById('pre-shuffle-overlay');
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

    setTimeout(async () => {
        if (overlay) { overlay.classList.remove('flex'); overlay.classList.add('hidden'); }
        const val = await DB.get('stage_shuffle', true);
        if (val !== 'false' && val !== false) {
            currentState = 'SHUFFLING'; initManualShuffleScreen();
        } else proceedToNextStage();
    }, 1200);
};

// ✨ 核心翻牌動畫引擎 (切換跨牌時觸發)
window.animateCardReveal = function(slotIndex, targetCard, record) {
    const flipEl = document.getElementById(`reading-flip-${slotIndex}`);
    const textEl = document.getElementById(`reading-text-${slotIndex}`);
    if (!flipEl || !textEl) return;

    // 1. 翻回牌背
    flipEl.style.transform = 'rotateY(0deg)';
    textEl.style.opacity = '0';

    setTimeout(() => {
        // 2. 在背面時更換內容
        const imgFlipStyle = targetCard.isReversed ? 'transform: rotateY(180deg) rotateZ(180deg);' : 'transform: rotateY(180deg);';
        flipEl.children[1].style.cssText = `backface-visibility: hidden; background-image: url('${targetCard.image}'); ${imgFlipStyle}`;
        
        // ✨ 修正點 1：把這段移上來！先抓取牌組名稱 (deckKey)，才能判斷是不是托特牌
        const deckKey = targetCard.image.match(/assets\/([^\/]+)\//) ? targetCard.image.match(/assets\/([^\/]+)\//)[1] : 'cards';
        const deckNames = { 'cards': '偉特', 'thoth': '托特', 'anime': '動漫' };
        const deckNameShort = deckNames[deckKey] || '自訂';

        // ✨ 修正點 2：套用托特翻譯濾鏡 (將原本的 targetCard.name 替換為 displayCardName)
        const displayCardName = (deckKey === 'thoth' && typeof translateCardName === 'function') ? translateCardName(targetCard.name, deckKey) : targetCard.name;
        
        // ✨ 修正：判斷是否為托特牌，動畫翻轉出來時也要將 HTML 隱藏
        const cleanName = displayCardName.replace(/(大|小)阿爾克那\s*[-・]?\s*/g, '').trim();
        const isThoth = deckKey === 'thoth';
        const orientationText = targetCard.isReversed ? '(逆)' : '(正)';
        const orientationColor = targetCard.isReversed ? 'text-red-400' : 'text-green-400';

        const orientationHtmlImageMode = isThoth ? '' : `<span class="${orientationColor} ml-0.5">${orientationText}</span>`;
        const orientationHtmlTextMode = isThoth ? '' : ` <span class="${orientationColor}">${orientationText}</span>`;

        const labelEl = document.getElementById(`reading-label-${slotIndex}`);
        const meaning = labelEl ? labelEl.innerText : '';

        textEl.innerHTML = `
            <span class="text-[0.65rem] sm:text-sm font-bold text-white truncate max-w-[85px] image-mode-text whitespace-nowrap">${cleanName}${orientationHtmlImageMode}</span>
            <span class="text-xs sm:text-sm font-bold text-white whitespace-nowrap text-mode-text hidden flex-col items-center gap-0.5">
                <span class="text-yellow-300 opacity-80">${meaning}</span>
                <span class="text-[0.65rem] text-blue-300 font-bold tracking-widest">［${deckNameShort}］</span>
                <span>${cleanName}${orientationHtmlTextMode}</span>
            </span>
        `;

        // 同步圖文模式顯示狀態
        if (document.getElementById('reading-spread').classList.contains('text-only-mode')) {
            textEl.querySelectorAll('.image-mode-text').forEach(e => e.classList.add('hidden'));
            textEl.querySelectorAll('.text-mode-text').forEach(e => e.classList.remove('hidden'));
        }

        // 3. 翻出新牌
        flipEl.style.transform = 'rotateY(180deg)';
        textEl.style.opacity = '1';

        const cDiv = flipEl.closest('.history-card');
        if (cDiv) {
            cDiv.onclick = (e) => {
                e.stopPropagation(); // 防止事件冒泡
                if (typeof openCardMeaning === 'function') {
                    // ✨ 修正 4：把 meaning 變數一併傳進去
                    openCardMeaning(targetCard.id, targetCard.isReversed, targetCard.image, displayCardName.replace('\n', ' '), meaning);
                }
            };
        }
    }, 350); // duration-700 的一半，確保邊緣朝向玩家時才換圖
};

// ==========================================
// 🔄 切換器：全陣切換 (右下角 FAB)
// ==========================================
window.toggleFullSpreadLayer = function(forceIndex = null) {
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    const fullLayers = record.crossDraws.filter(d => d.type === 'full');
    if (fullLayers.length === 0) return;

    if (fullLayers.length >= 5 && forceIndex === null) {
        openLayerSelectModal('full', null, fullLayers, window.currentDisplayLayer);
        return;
    }

    if (forceIndex !== null) {
        window.currentDisplayLayer = forceIndex; 
    } else {
        window.currentDisplayLayer++; 
        if (window.currentDisplayLayer >= fullLayers.length) window.currentDisplayLayer = -1; 
    }

    const targetCards = window.currentDisplayLayer === -1 ? record.cards : fullLayers[window.currentDisplayLayer].cards;
    if (typeof showToast === 'function') showToast(window.currentDisplayLayer === -1 ? '🔮 顯示主牌陣' : `🔮 顯示跨牌：${fullLayers[window.currentDisplayLayer].deckName}`);

    const fab = document.getElementById('fab-toggle-full');
    if (fab) fab.innerText = window.currentDisplayLayer === -1 ? '🔄' : `全${window.currentDisplayLayer + 1}`;

    targetCards.forEach(c => {
        // 同步更新左上角的 Local 按鈕狀態
        const localBtn = document.getElementById(`local-full-toggle-${c.slotIndex}`);
        if (localBtn) {
            localBtn.dataset.currentIdx = window.currentDisplayLayer === -1 ? 0 : window.currentDisplayLayer + 1;
            localBtn.innerText = window.currentDisplayLayer === -1 ? '🌌' : `全${window.currentDisplayLayer + 1}`;
        }
        // 強制重置單張按鈕 (避免邏輯混亂)
        const singleBtn = document.getElementById(`local-single-toggle-${c.slotIndex}`);
        if (singleBtn && singleBtn.dataset.currentIdx !== '0') {
            singleBtn.dataset.currentIdx = '0';
            singleBtn.innerText = '➕';
        }
        animateCardReveal(c.slotIndex, c, record);
    });

    // ✨ 新增：動態修改下方的刪除按鈕 (剝離全陣神諭)
    const deleteBtn = document.querySelector('#reading-buttons button[onclick^="delete"]');
    if (deleteBtn && typeof currentViewingRecordId !== 'undefined' && currentViewingRecordId) {
        if (window.currentDisplayLayer >= 0) {
            deleteBtn.innerText = '🗑️ 刪除全陣';
            deleteBtn.setAttribute('onclick', `deleteCrossDrawLayer('full', ${window.currentDisplayLayer})`);
        } else {
            deleteBtn.innerText = '🗑️ 刪除';
            deleteBtn.setAttribute('onclick', 'deleteCurrentRecord()');
        }
    }
};

// ==========================================
// 🔄 切換器：局部全陣切換 (左上角 🌌)
// ==========================================
window.toggleLocalFullLayer = function(event, slotIndex, forceIndex = null) {
    if (event) event.stopPropagation();
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    const fullLayers = record.crossDraws.filter(d => d.type === 'full');
    if (fullLayers.length === 0) return;

    const btn = document.getElementById(`local-full-toggle-${slotIndex}`);
    if (!btn) return;
    let currentIdx = parseInt(btn.dataset.currentIdx || '0');

    if (fullLayers.length >= 5 && forceIndex === null) {
        openLayerSelectModal('local_full', slotIndex, fullLayers, currentIdx);
        return;
    }

    if (forceIndex !== null) currentIdx = forceIndex;
    else { currentIdx++; if (currentIdx > fullLayers.length) currentIdx = 0; }
    
    btn.dataset.currentIdx = currentIdx;
    btn.innerText = currentIdx === 0 ? '🌌' : `全${currentIdx}`;

    const singleBtn = document.getElementById(`local-single-toggle-${slotIndex}`);
    if (singleBtn && singleBtn.dataset.currentIdx !== '0') {
        singleBtn.dataset.currentIdx = '0';
        singleBtn.innerText = '➕';
    }

    const targetCard = currentIdx === 0 ? record.cards.find(c => c.slotIndex === slotIndex) : fullLayers[currentIdx-1].cards.find(c => c.slotIndex === slotIndex);
    if (typeof showToast === 'function') showToast(currentIdx === 0 ? '切換為主牌' : `全陣跨牌 (${fullLayers[currentIdx-1].deckName})`);

    animateCardReveal(slotIndex, targetCard, record);
};

// ==========================================
// 🔄 切換器：單張補充切換 (右上角 ➕)
// ==========================================
window.toggleSingleSlot = function(event, slotIndex, forceIndex = null) {
    if (event) event.stopPropagation(); // 阻止事件穿透
    const record = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData : currentDetailRecord;
    const supplements = record.crossDraws.filter(d => d.type === 'single' && d.slotIndex === slotIndex);
    if (supplements.length === 0) return;

    // ✨ 1. 改為抓取專屬於單張切換的按鈕 ID
    const btn = document.getElementById(`local-single-toggle-${slotIndex}`);
    if (!btn) return;
    let currentIdx = parseInt(btn.dataset.currentIdx || '0');

    // 如果單張補充神諭 >= 5，打開選單！
    if (supplements.length >= 5 && forceIndex === null) {
        openLayerSelectModal('single', slotIndex, supplements, currentIdx);
        return;
    }

    if (forceIndex !== null) {
        currentIdx = forceIndex;
    } else { 
        currentIdx++; 
        if (currentIdx > supplements.length) currentIdx = 0; 
    }
    
    btn.dataset.currentIdx = currentIdx;
    
    // ✨ 2. 變更按鈕文字為 ➕ 或是 單1、單2
    btn.innerText = currentIdx === 0 ? '➕' : `單${currentIdx}`;

    // ✨ 3. 雙按鈕防呆：如果切換了單張神諭，強制把「全牌陣(🌌)」的按鈕重置歸零
    const fullBtn = document.getElementById(`local-full-toggle-${slotIndex}`);
    if (fullBtn && fullBtn.dataset.currentIdx !== '0') {
        fullBtn.dataset.currentIdx = '0';
        fullBtn.innerText = '🌌';
    }

    const targetCard = currentIdx === 0 ? record.cards.find(c => c.slotIndex === slotIndex) : supplements[currentIdx-1].card;
    if (typeof showToast === 'function') {
        showToast(currentIdx === 0 ? '切換為主牌' : `單張神諭 (${supplements[currentIdx-1].deckName})`);
    }

    // ✨ 4. 將原本生硬替換 HTML 的邏輯，改為呼叫我們寫好的華麗翻牌動畫引擎！
    if (typeof animateCardReveal === 'function') {
        animateCardReveal(slotIndex, targetCard, record);
    }

    // ✨ 新增：動態修改下方的刪除按鈕 (剝離單張神諭)
    const deleteBtn = document.querySelector('#reading-buttons button[onclick^="delete"]');
    if (deleteBtn && typeof currentViewingRecordId !== 'undefined' && currentViewingRecordId) {
        if (currentIdx > 0) {
            deleteBtn.innerText = '🗑️ 刪除單張';
            // 傳入 slotIndex 讓系統知道要剝離哪一個位置的牌
            deleteBtn.setAttribute('onclick', `deleteCrossDrawLayer('single', ${currentIdx - 1}, ${slotIndex})`);
        } else {
            // 如果切回主牌 (0)，檢查有沒有全陣正在亮，沒的話就恢復一般刪除
            if (window.currentDisplayLayer === -1) {
                deleteBtn.innerText = '🗑️ 刪除';
                deleteBtn.setAttribute('onclick', 'deleteCurrentRecord()');
            }
        }
    }
};

// ==========================================
// 🔄 選單彈窗：動態生成圖層切換選單
// ==========================================
window.openLayerSelectModal = function(type, slotIndex, layers, currentIndex) {
    let modal = document.getElementById('layer-select-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'layer-select-modal';
        modal.className = 'fixed inset-0 z-[150] bg-black/90 backdrop-blur-md hidden flex-col p-4 justify-center items-center';
        modal.innerHTML = `
            <div class="bg-indigo-950 border border-emerald-500/50 rounded-xl max-w-xs w-full p-5 flex flex-col shadow-2xl relative">
                <button onclick="document.getElementById('layer-select-modal').classList.replace('flex', 'hidden')" class="absolute top-3 right-3 text-emerald-300 hover:text-white text-xl">&times;</button>
                <h3 class="text-lg font-bold text-emerald-300 mb-4 text-center">🔄 選擇檢視圖層</h3>
                <select id="layer-select-dropdown" class="w-full bg-purple-900 border border-emerald-500 rounded p-2 text-white mb-4"></select>
                <button id="btn-confirm-layer-switch" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition-colors">確認切換</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const dropdown = document.getElementById('layer-select-dropdown');
    let optionsHTML = `<option value="${type === 'full' ? -1 : 0}" ${currentIndex === (type === 'full' ? -1 : 0) ? 'selected' : ''}>主牌陣</option>`;
    
    layers.forEach((layer, idx) => {
        const targetVal = type === 'full' ? idx : idx + 1; 
        const isSelected = currentIndex === targetVal ? 'selected' : '';
        optionsHTML += `<option value="${targetVal}" ${isSelected}>跨牌 ${idx + 1}：${layer.deckName}</option>`;
    });
    
    dropdown.innerHTML = optionsHTML;
    document.getElementById('btn-confirm-layer-switch').onclick = () => {
        const selectedVal = parseInt(dropdown.value);
        if (type === 'full') toggleFullSpreadLayer(selectedVal);
        else if (type === 'local_full') toggleLocalFullLayer(null, slotIndex, selectedVal);
        else toggleSingleSlot(null, slotIndex, selectedVal);
        modal.classList.replace('flex', 'hidden');
    };
    modal.classList.replace('hidden', 'flex');
};

// ✨ 初始化：首頁抽牌的牌組選單
window.initSetupMainDeckSelect = async function() {
    const selectEl = document.getElementById('setup-main-deck-select');
    if (!selectEl) return;
    
    const themeList = await DB.get('deck_theme_list', [
        { name: '經典萊德偉特', id: 'cards' },
        { name: '托特塔羅牌', id: 'thoth' }
    ]);
    selectEl.innerHTML = themeList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    const currentTheme = await DB.get('deck_theme', 'cards');
    selectEl.value = currentTheme;

    selectEl.addEventListener('change', async (e) => {
        await DB.set('deck_theme', e.target.value);
        if (typeof showToast === 'function') showToast(`🔮 已切換為：${e.target.options[e.target.selectedIndex].text}`);
    });
};

// ✨ 搭配自動存檔的「更新備註並離開」邏輯
window.updateNotesAndExit = async function() {
    let history = await DB.get('history', []);
    const targetId = (typeof isRitualActive !== 'undefined' && isRitualActive) ? currentRitualData.id : currentViewingRecordId;
    const index = history.findIndex(r => r.id === targetId);
    const notesVal = document.getElementById('reading-notes-input').value;
    
    if (index !== -1) {
        history[index].notes = notesVal;
        await DB.set('history', history);
    }
    
    if (typeof showToast === 'function') showToast('📜 備註已更新儲存！');
    setTimeout(() => {
        isRitualActive = false;
        window.location.href = window.location.origin + window.location.pathname;
    }, 800);
};

// ✨ 全域：獨立放大圖片模組
window.openEnlargedImage = function(event, imgSrc, isReversed) {
    if (event) event.stopPropagation(); // 防止點擊穿透觸發關閉
    
    let viewer = document.getElementById('global-image-viewer');
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.id = 'global-image-viewer';
        // z-[200] 確保它蓋過所有東西 (解牌彈窗通常是 100 或 150)
        viewer.className = 'fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out opacity-0 transition-opacity duration-300';
        viewer.onclick = () => {
            viewer.style.opacity = '0';
            setTimeout(() => viewer.style.display = 'none', 300);
        };
        document.body.appendChild(viewer);
    }
    
    // 處理逆位旋轉
    const transformStyle = isReversed ? 'transform: rotate(180deg);' : '';
    
    viewer.innerHTML = `<img src="${imgSrc}" class="max-w-full max-h-[90vh] object-contain shadow-[0_0_30px_rgba(250,204,21,0.3)] rounded-xl border border-yellow-500/50" style="${transformStyle}">`;
    viewer.style.display = 'flex';
    
    // 強制重繪以觸發動畫
    viewer.offsetHeight;
    viewer.style.opacity = '1';
};

window.confirmCustomDrawCount = async function() {
    const inputEl = document.getElementById('custom-draw-count-input');
    let count = parseInt(inputEl.value);
    
    // 取得當前選擇的牌組最大張數 (22 或 78)
    const maxDeckSize = currentSelectedDeckSize || 78;

    if (isNaN(count) || count < 1) {
        if (typeof showToast === 'function') showToast('請輸入有效的抽牌張數！');
        return;
    }
    
    if (count > maxDeckSize) {
        if (typeof showToast === 'function') showToast(`⚠️ 超過最大牌數！目前牌組只有 ${maxDeckSize} 張`);
        inputEl.value = maxDeckSize; // 強制修正輸入框為最大值
        return;
    }

    // 建立一個動態的 ID，例如 custom_dynamic_5
    const dynamicSpreadId = `custom_dynamic_${count}`;
    
    if (typeof currentSelectedSpread !== 'undefined') {
        currentSelectedSpread = dynamicSpreadId;
    } else {
        window.currentSelectedSpread = dynamicSpreadId;
    }

    await DB.set('last_spread_id', dynamicSpreadId);

    if (typeof currentRitualData !== 'undefined') {
        currentRitualData.spread = dynamicSpreadId;
    }

    const label = document.getElementById('setup-spread-label');
    const icon = document.getElementById('setup-spread-icon');

    if (label) label.innerText = `自訂抽取 (${count}張)`;
    if (icon) icon.innerText = '🔢';

    const modal = document.getElementById('modal-spread');
    if (modal && !modal.classList.contains('hidden')) {
        history.back(); // 觸發返回機制關閉 Modal
    }
    
    if (typeof showToast === 'function') showToast(`✅ 已設定抽取 ${count} 張牌`);
};

// ✨ 修正 4：剝離式跨牌刪除法
window.deleteCrossDrawLayer = async function(type, targetIndex, slotIndex = null) {
    showConfirm(`確定要將此神諭剝離並移至回收桶嗎？\n(主牌陣將不受影響)`, async () => {
        if (!currentDetailRecord || !currentDetailRecord.crossDraws) return;

        let peeledRecord = null;

        // 1. 剝離邏輯
        if (type === 'full') {
            const fulls = currentDetailRecord.crossDraws.filter(d => d.type === 'full');
            peeledRecord = fulls[targetIndex];
            currentDetailRecord.crossDraws = currentDetailRecord.crossDraws.filter(d => d !== peeledRecord);
        } else if (type === 'single') {
            const singles = currentDetailRecord.crossDraws.filter(d => d.type === 'single' && d.slotIndex === slotIndex);
            peeledRecord = singles[targetIndex];
            currentDetailRecord.crossDraws = currentDetailRecord.crossDraws.filter(d => d !== peeledRecord);
        }

        if (!peeledRecord) return;

        // 2. 將剝離的資料包裝成一筆新的刪除紀錄
        const trashRecord = {
            id: 'peeled_' + Date.now().toString(),
            date: new Date().toLocaleString('zh-TW'),
            question: `[已剝離的神諭] ${currentDetailRecord.question}`,
            spread: type === 'full' ? currentDetailRecord.spread : 'single',
            mainDeckId: peeledRecord.deckId,
            mainDeckName: peeledRecord.deckName,
            isDeleted: true, // 直接進回收桶
            cards: type === 'full' ? peeledRecord.cards : [peeledRecord.card]
        };

        // 3. 儲存更新
        let history = await DB.get('history', []);
        
        // 更新主紀錄
        const idx = history.findIndex(r => r.id === currentDetailRecord.id);
        if (idx !== -1) history[idx] = currentDetailRecord;
        
        // 塞入垃圾桶紀錄
        history.unshift(trashRecord);
        await DB.set('history', history);

        if (typeof showToast === 'function') showToast('🗑️ 神諭已剝離並移至回收桶');

        // 4. 重置畫面，回到主牌盤
        window.currentDisplayLayer = -1;
        showRecordDetails(currentDetailRecord, false);
    });
};
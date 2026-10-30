// ==========================================
// ✨ 高頻率事件專用：記憶體快取 (RAM Cache)
// ==========================================
const SystemCache = {
    selectMode: 'click',
    haptic: true,
    customSpreads: {} // ✨ 擴充：預留自訂牌陣的記憶體空間
};

// 呼叫此函數，會從 IndexedDB 抓取最新設定放入快取中
async function syncSystemCache() {
    SystemCache.selectMode = await DB.get('select_mode', 'click');
    SystemCache.haptic = await DB.get('haptic_enabled', true);
    // ✨ 擴充：系統啟動時，自動把資料庫裡的自訂牌陣載入記憶體
    SystemCache.customSpreads = await DB.get('custom_spreads', {});
}

// ==========================================
// 初始化 IndexedDB
// ==========================================
localforage.config({
    name: 'TarotAltarDB',
    storeName: 'tarot_data', // 資料表名稱
    description: '口袋塔羅的底層記憶體'
});

// 非同步儲存庫管理器 (取代原本的 DeckStorage 與 localStorage)
const DB = {
    async get(key, defaultValue = null) {
        try {
            const val = await localforage.getItem(`tarot_${key}`);
            return val !== null ? val : defaultValue;
        } catch (err) {
            console.error(`讀取 ${key} 失敗:`, err);
            return defaultValue;
        }
    },
    async set(key, value) {
        try {
            await localforage.setItem(`tarot_${key}`, value);
        } catch (err) {
            console.error(`儲存 ${key} 失敗:`, err);
            window.alert("⚠️ 系統警告：資料寫入失敗！\n您的設備儲存空間可能已滿，或是瀏覽器阻擋了本地儲存。請檢查後再繼續操作，以免流失紀錄。");
        }
    },
    async remove(key) {
        await localforage.removeItem(`tarot_${key}`);
    },
    async clearAll() {
        await localforage.clear();
    }
};

// ==========================================
// 模組 1: 字典與預設牌義
// ==========================================
const TarotDict = {
    major: ["愚者", "魔術師", "女祭司", "皇后", "皇帝", "教皇", "戀人", "戰車", "力量", "隱者", "命運之輪", "正義", "倒吊人", "死神", "節制", "惡魔", "高塔", "星星", "月亮", "太陽", "審判", "世界"],
    wands: ["權杖王牌", "權杖二", "權杖三", "權杖四", "權杖五", "權杖六", "權杖七", "權杖八", "權杖九", "權杖十", "權杖侍者", "權杖騎士", "權杖皇后", "權杖國王"],
    cups: ["聖杯王牌", "聖杯二", "聖杯三", "聖杯四", "聖杯五", "聖杯六", "聖杯七", "聖杯八", "聖杯九", "聖杯十", "聖杯侍者", "聖杯騎士", "聖杯皇后", "聖杯國王"],
    swords: ["寶劍王牌", "寶劍二", "寶劍三", "寶劍四", "寶劍五", "寶劍六", "寶劍七", "寶劍八", "寶劍九", "寶劍十", "寶劍侍者", "寶劍騎士", "寶劍皇后", "寶劍國王"],
    pentacles: ["錢幣王牌", "錢幣二", "錢幣三", "錢幣四", "錢幣五", "錢幣六", "錢幣七", "錢幣八", "錢幣九", "錢幣十", "錢幣侍者", "錢幣騎士", "錢幣皇后", "錢幣國王"]
};

const ThothDict = {
    major: ["愚者", "魔術師", "女祭司", "皇后", "皇帝", "教皇", "戀人", "戰車", "慾望", "隱者", "命運", "調節", "倒吊人", "死神", "藝術", "惡魔", "塔", "星", "月", "太陽", "新紀元", "宇宙"],
    wands: ["權杖王牌", "權杖二", "權杖三", "權杖四", "權杖五", "權杖六", "權杖七", "權杖八", "權杖九", "權杖十", "權杖騎士", "權杖皇后", "權杖王子", "權杖公主"],
    cups: ["聖杯王牌", "聖杯二", "聖杯三", "聖杯四", "聖杯五", "聖杯六", "聖杯七", "聖杯八", "聖杯九", "聖杯十", "聖杯騎士", "聖杯皇后", "聖杯王子", "聖杯公主"],
    swords: ["寶劍王牌", "寶劍二", "寶劍三", "寶劍四", "寶劍五", "寶劍六", "寶劍七", "寶劍八", "寶劍九", "寶劍十", "寶劍騎士", "寶劍皇后", "寶劍王子", "寶劍公主"],
    pentacles: ["圓盤王牌", "圓盤二", "圓盤三", "圓盤四", "圓盤五", "圓盤六", "圓盤七", "圓盤八", "圓盤九", "圓盤十", "圓盤騎士", "圓盤皇后", "圓盤王子", "圓盤公主"]
};

// 系統預設牌義 (支援後續擴充)
// ==========================================
// 模組 1: 字典與預設牌義 (完整 78 張 正逆位版)
// ==========================================
const DefaultMeanings = {
    // 🃏 大阿爾克那 (0-21)
    "major_0": {
        upright: "【愚者-正位】代表著無限的可能性、自發性與全新的開始。這是一場信念的躍進，鼓勵你順從內心的直覺，不畏懼未知的風險。",
        reversed: "【愚者-逆位】暗示過度魯莽、盲目衝動，或是對未知感到恐懼而錯失良機。請評估風險，不要在沒有準備的情況下盲目躍入。"
    },
    "major_1": {
        upright: "【魔術師-正位】象徵創造力、意志力與顯化的能力。你擁有實現目標所需的所有工具與資源，現在是行動的時刻。",
        reversed: "【魔術師-逆位】可能意味著才能被濫用、計畫停滯不前，或者是遭遇欺騙與操縱。你需要重新集中注意力，找回自信。"
    },
    "major_2": { upright: "【女祭司-正位】代表直覺、潛意識與神秘的內在力量。請靜下心來傾聽內在的聲音，答案已經存在於你心中。", reversed: "【女祭司-逆位】暗示你忽略了直覺，或是隱藏的秘密即將曝光。請停止過度理性分析，相信你的第六感。" },
    "major_3": { upright: "【皇后-正位】豐盛、母性、培育與感官享受。這是一個充滿創造力與愛的美好時期，請享受大自然的滋養。", reversed: "【皇后-逆位】可能代表過度依賴、創意枯竭，或是在照顧他人時忽略了自己。請先把愛留給自己。" },
    "major_4": { upright: "【皇帝-正位】權威、結構、穩定與邏輯。建立秩序與規則能幫助你達成目標，展現你的領導力。", reversed: "【皇帝-逆位】象徵濫用權力、過度專制、死板，或是缺乏紀律導致混亂。需要重新建立健康的界線。" },
    "major_5": { upright: "【教皇-正位】傳統、精神指引、教育與信仰體系。尋求導師的幫助，或是遵循既有的優良傳統將帶來益處。", reversed: "【教皇-逆位】挑戰權威、打破舊有規範、盲從教條或是想要脫離傳統的束縛。適合走出自己的路。" },
    "major_6": { upright: "【戀人-正位】愛、和諧、關係與價值觀的選擇。代表一段契合的關係，或是必須做出忠於內心的重大抉擇。", reversed: "【戀人-逆位】關係出現不和諧、價值觀衝突，或是做出了錯誤的選擇。需要重新審視彼此的連結。" },
    "major_7": { upright: "【戰車-正位】意志力、勝利、決心與方向感。只要你能掌控理智與情感兩股力量，就能克服萬難勇往直前。", reversed: "【戰車-逆位】失去方向、失控、感受到強烈的阻力或挫折。請不要勉強硬闖，先重新掌握方向盤。" },
    "major_8": { upright: "【力量-正位】勇氣、耐心、同情心與溫柔的掌控。真正的力量來自於內在的平靜與包容，而非暴力的壓制。", reversed: "【力量-逆位】自我懷疑、軟弱、被恐懼支配，或是情緒失控。你需要找回內在的自信與韌性。" },
    "major_9": { upright: "【隱者-正位】反省、內省、孤獨與靈性指引。這是一個需要獨處並向內尋找智慧的時期。", reversed: "【隱者-逆位】過度孤立、逃避現實，或是因為拒絕外界幫助而感到迷惘。是時候重新與世界連結了。" },
    "major_10": { upright: "【命運之輪-正位】好運、命運的轉折、週期與無法預測的變化。順應生命的洪流，好運即將到來。", reversed: "【命運之輪-逆位】遭遇倒霉、抗拒改變、打破了舊有的壞循環。請記住，低谷之後必然會迎來上升。" },
    "major_11": { upright: "【正義-正位】公平、真相、因果報應與法律。請保持客觀與誠實，你的所作所為將會得到應有的結果。", reversed: "【正義-逆位】不公不義、偏見、逃避責任或是法律上的不利。必須誠實面對自己犯下的錯誤。" },
    "major_12": { upright: "【倒吊人-正位】暫停、臣服、放下與換個角度看世界。有時候，退一步或做出犧牲能帶來更深刻的覺醒。", reversed: "【倒吊人-逆位】無謂的犧牲、鑽牛角尖、無法放下過去，或是因為拖延而錯失良機。" },
    "major_13": { upright: "【死神-正位】結束、轉變、蛻變與除舊佈新。某些事物必須結束，才能為新的開始騰出空間。", reversed: "【死神-逆位】恐懼改變、抗拒結束、停滯不前。緊抓著不放只會帶來更多的痛苦，請學會放手。" },
    "major_14": { upright: "【節制-正位】平衡、中庸、耐心與融合。將不同的元素和諧地結合在一起，避免走極端。", reversed: "【節制-逆位】失衡、過度放縱、缺乏耐心或方向感。你需要重新調整生活中的各項比例。" },
    "major_15": { upright: "【惡魔-正位】束縛、成癮、物質主義與陰暗面。你可能被某種慾望或恐懼困住，但這些枷鎖其實是你自己加上的。", reversed: "【惡魔-逆位】掙脫束縛、克服成癮、重獲自由，或是終於意識到自己被什麼所控制而決定反抗。" },
    "major_16": { upright: "【高塔-正位】突如其來的災難、巨變、毀滅與覺醒。建立在虛假基礎上的事物將被摧毀，雖然痛苦但能帶來重生。", reversed: "【高塔-逆位】逃避無可避免的災難、害怕改變，或是災難帶來的影響比預期中輕微。變革遲早會來。" },
    "major_17": { upright: "【星星-正位】希望、靈感、寧靜與療癒。度過風暴後，宇宙將傾注滿滿的祝福與平靜給你。", reversed: "【星星-逆位】失去希望、絕望、缺乏靈感或信心。你需要花點時間重新找回對生命的信任。" },
    "major_18": { upright: "【月亮-正位】潛意識、幻覺、恐懼與不安。事情的真相被隱藏在迷霧之中，請小心欺騙並面對內心的恐懼。", reversed: "【月亮-逆位】恐懼消散、真相大白、擺脫了迷惘，或是那些困擾你的秘密終於被揭開。" },
    "major_19": { upright: "【太陽-正位】快樂、成功、活力與純真。這是一張充滿正能量的牌，象徵目標達成與生命充滿陽光。", reversed: "【太陽-逆位】短暫的悲觀、內在的快樂被壓抑，或是成功被延遲。但整體而言，這依然是一張正向的牌。" },
    "major_20": { upright: "【審判-正位】重生、內在的呼喚、寬恕與業力結算。這是一個重要的十字路口，請聆聽靈魂的召喚做出決定。", reversed: "【審判-逆位】自我懷疑、忽略內在呼喚、拒絕原諒自己或他人，或是逃避必須面對的業力。" },
    "major_21": { upright: "【世界-正位】完成、整合、成就與完美的結局。一個重要的生命週期已圓滿結束，準備迎接下一個旅程。", reversed: "【世界-逆位】未完成的感覺、缺乏封閉感、延遲的成功。你需要補齊最後一塊拼圖才能圓滿。" },

    // 🔥 權杖 (Wands) 1-14
    "wands_1": { upright: "靈感迸發、新的行動與熱情。", reversed: "靈感枯竭、計畫延遲、缺乏動力。" },
    "wands_2": { upright: "規劃未來、做決定、離開舒適圈。", reversed: "害怕未知、計畫受阻、猶豫不決。" },
    "wands_3": { upright: "遠見、拓展視野、合作帶來成功。", reversed: "眼界狹隘、合作破裂、延遲的回報。" },
    "wands_4": { upright: "慶祝、和諧、穩定的基礎與里程碑。", reversed: "家庭不和、慶祝取消、基礎不穩。" },
    "wands_5": { upright: "競爭、衝突、意見不合的混亂。", reversed: "避免衝突、達成共識、內部矛盾化解。" },
    "wands_6": { upright: "勝利、認可、自信與榮耀。", reversed: "自我懷疑、名譽受損、缺乏認可。" },
    "wands_7": { upright: "防禦、堅守立場、面臨挑戰但有優勢。", reversed: "屈服、失去優勢、被壓力擊垮。" },
    "wands_8": { upright: "迅速的行動、消息傳來、高速發展。", reversed: "進度停滯、溝通不良、倉促行事導致錯誤。" },
    "wands_9": { upright: "疲憊但堅韌、最後的考驗、堅持到底。", reversed: "放棄、過度防衛、體力透支。" },
    "wands_10": { upright: "責任過重、壓力、硬扛著往前走。", reversed: "放下重擔、崩潰、學會委託他人。" },
    "wands_11": { upright: "權杖侍者：熱情的新消息、探索、自由的靈魂。", reversed: "壞消息、三分鐘熱度、計畫延遲。" },
    "wands_12": { upright: "權杖騎士：衝動、充滿活力的行動、冒險。", reversed: "魯莽、傲慢、計畫虎頭蛇尾。" },
    "wands_13": { upright: "權杖皇后：自信、魅力、獨立與溫暖的領導者。", reversed: "妒忌、專橫、失去自信、情緒化。" },
    "wands_14": { upright: "權杖國王：願景、天生的領袖、企業家精神。", reversed: "獨裁、不寬容、衝動的決策者。" },

    // 💧 聖杯 (Cups) 1-14
    "cups_1": { upright: "情感的滿溢、新戀情、直覺的禮物。", reversed: "情感枯竭、壓抑情緒、愛的失落。" },
    "cups_2": { upright: "靈魂伴侶、和諧的結合、平等的伴侶關係。", reversed: "關係破裂、不平等、溝通不良。" },
    "cups_3": { upright: "友誼、慶祝、社群與快樂的聚會。", reversed: "過度放縱、小團體排擠、派對取消。" },
    "cups_4": { upright: "冷漠、不滿、忽視了宇宙提供的機會。", reversed: "從倦怠中醒來、接受新機會、重新燃起興趣。" },
    "cups_5": { upright: "悲傷、失落、專注於失去的事物而忽略擁有的。", reversed: "接受現實、走出悲痛、看到剩下的希望。" },
    "cups_6": { upright: "懷舊、童年回憶、純真與過去的連結。", reversed: "沉溺過去、拒絕長大、過去的創傷浮現。" },
    "cups_7": { upright: "選擇困難、幻覺、白日夢與多種可能性。", reversed: "看清現實、做出明確的選擇、不再迷惘。" },
    "cups_8": { upright: "放下、尋求更高的意義、轉身離開不滿意的現狀。", reversed: "害怕改變、困在原地、猶豫不決。" },
    "cups_9": { upright: "願望成真、情感上的滿足與驕傲。", reversed: "貪婪、願望落空、表面風光內心空虛。" },
    "cups_10": { upright: "情感的終極圓滿、家庭和樂、幸福美滿。", reversed: "家庭失和、破碎的夢想、短暫的快樂。" },
    "cups_11": { upright: "聖杯侍者：感性的消息、創意、浪漫與直覺。", reversed: "情感不成熟、逃避現實、創意的阻塞。" },
    "cups_12": { upright: "聖杯騎士：浪漫的追求者、跟隨心之所向。", reversed: "多情但不專一、情緒化、過度理想主義。" },
    "cups_13": { upright: "聖杯皇后：同理心、深度的直覺、充滿愛的照顧者。", reversed: "情感勒索、過度敏感、內心空虛。" },
    "cups_14": { upright: "聖杯國王：情緒的穩定與掌控、成熟的愛與外交手腕。", reversed: "冷酷、情緒操縱、壓抑真實感受。" },

    // ⚔️ 寶劍 (Swords) 1-14
    "swords_1": { upright: "突破性的思維、清晰的真相、全新的視角。", reversed: "思緒混亂、真相被蒙蔽、無法做出決定。" },
    "swords_2": { upright: "僵局、逃避選擇、閉上眼睛不看現實。", reversed: "僵局打破、看清真相、被迫做出決定。" },
    "swords_3": { upright: "心碎、背叛、悲痛與痛苦的真相。", reversed: "從悲傷中復原、釋放痛苦、傷口癒合。" },
    "swords_4": { upright: "休息、恢復、冥想與暫時退避。", reversed: "過勞、焦慮、拒絕休息導致崩潰。" },
    "swords_5": { upright: "衝突、不擇手段的勝利、帶來敵意的爭吵。", reversed: "和解、願意妥協、化解無謂的爭端。" },
    "swords_6": { upright: "渡過難關、平靜的轉變、遠離痛苦。", reversed: "困在過去、無法前進、轉變過程充滿阻礙。" },
    "swords_7": { upright: "欺騙、策略、偷竊或是選擇孤軍奮戰。", reversed: "真相大白、策略失敗、必須坦誠相待。" },
    "swords_8": { upright: "自我限制、無力感、被自己的想法困住。", reversed: "掙脫束縛、找回力量、看見出路。" },
    "swords_9": { upright: "焦慮、夢魘、過度擔憂與內疚。", reversed: "走出陰霾、不再鑽牛角尖、尋求心理幫助。" },
    "swords_10": { upright: "徹底的毀滅、背叛、降到谷底（但也代表結束）。", reversed: "熬過最糟的時刻、奇蹟生還、拒絕被打敗。" },
    "swords_11": { upright: "寶劍侍者：好奇心、敏銳的觀察力、直接的溝通。", reversed: "流言蜚語、尖酸刻薄、行動缺乏計畫。" },
    "swords_12": { upright: "寶劍騎士：迅速的行動、果斷、邏輯與野心。", reversed: "無情、魯莽、言語傷人。" },
    "swords_13": { upright: "寶劍皇后：客觀、獨立、敏銳的判斷力與界線。", reversed: "冷酷無情、過於嚴苛、用智慧操縱他人。" },
    "swords_14": { upright: "寶劍國王：理智、權威、清晰的溝通與公平的裁判。", reversed: "暴政、濫用智力、缺乏同理心。" },

    // 🪙 錢幣 (Pentacles) 1-14
    "pentacles_1": { upright: "新的財務機會、物質上的豐盛、穩定的基礎。", reversed: "錯失良機、財務損失、計畫缺乏實際性。" },
    "pentacles_2": { upright: "平衡、適應力、靈活處理多項任務與財務。", reversed: "失去平衡、財務混亂、承擔過多。" },
    "pentacles_3": { upright: "團隊合作、專業技能、透過合作建立基礎。", reversed: "各自為政、缺乏專業、團隊不和諧。" },
    "pentacles_4": { upright: "守成、安全感、控制慾與財務上的保守。", reversed: "過度貪婪、失去防備、學會慷慨分享。" },
    "pentacles_5": { upright: "貧窮、孤立無援、健康或財務上的困境。", reversed: "財務好轉、尋求幫助、健康復原。" },
    "pentacles_6": { upright: "慷慨、慈善、給予和接受的平衡。", reversed: "自私、不平等的關係、帶有條件的給予。" },
    "pentacles_7": { upright: "耐心等待、投資的回報、長期發展的評估。", reversed: "急躁、投資失敗、缺乏長遠眼光。" },
    "pentacles_8": { upright: "精進技能、專注於細節、辛勤工作與學習。", reversed: "缺乏專注、粗心大意、工作缺乏熱情。" },
    "pentacles_9": { upright: "財務獨立、享受努力的成果、物質的奢華與自信。", reversed: "過度消費、依賴他人、表面富足內心匱乏。" },
    "pentacles_10": { upright: "長期的豐盛、家族財富、傳承與穩固的成就。", reversed: "家族財務糾紛、投資不穩、失去傳承的價值。" },
    "pentacles_11": { upright: "錢幣侍者：實際的新計畫、求知慾、穩步向前。", reversed: "拖延、缺乏實踐力、沉迷物質。" },
    "pentacles_12": { upright: "錢幣騎士：勤奮、可靠、一步一腳印的建設者。", reversed: "固執、工作狂、枯燥乏味。" },
    "pentacles_13": { upright: "錢幣皇后：豐富的滋養、實用主義、安全感與享受生活。", reversed: "極度拜金、忽視健康、控制狂。" },
    "pentacles_14": { upright: "錢幣國王：財務上的權威、成功的企業家、穩若泰山。", reversed: "貪婪、腐敗、利用金錢控制他人。" }
};

// ==========================================
// 模組 1.5: 托特塔羅牌義資料庫 (全 78 張)
// ==========================================
const ThothMeanings = {
    // 🃏 大阿爾克那 (0-21)
    "major_0": {
        upright: "【愚者 The Fool】空氣元素。純粹的精神、潛能、超越理性的開端。代表著無限的可能性與聖靈的降臨。",
    },
    "major_1": {
        upright: "【魔術師 The Magus】水星。溝通、創造力、意志的傳遞與展現。運用智慧將意念轉化為現實的魔法師。",
    },
    "major_2": {
        upright: "【女祭司 The Priestess】月亮。純粹的直覺、潛意識、通往隱秘知識的門戶。象徵獨立與向內尋求真理。",
    },
    "major_3": {
        upright: "【皇后 The Empress】金星。愛、美麗、創造力的孕育與豐盛的自然法則。大地的母親與無條件的接納。",
    },
    "major_4": {
        upright: "【皇帝 The Emperor】牡羊座。結構、統治、權威、建立秩序的開創之火。理性的控制與穩固的基礎。",
    },
    "major_5": {
        upright: "【教皇 The Hierophant】金牛座。神聖啟示、內在導師、將精神智慧轉化為物質。宇宙奧秘的啟蒙者。",
    },
    "major_6": {
        upright: "【戀人 The Lovers】雙子座。結合、對立面的融合、靈性與直覺的抉擇。分析與整合的過程。",
    },
    "major_7": {
        upright: "【戰車 The Chariot】巨蟹座。承載靈魂的容器、勝利、靜態中的絕對動能。將對立力量化為前進的裝甲。",
    },
    "major_8": {
        upright: "【調節 Adjustment】天秤座。和諧、平衡、業力的精準評估與自然法則的修正。超越人類道德的宇宙公理。",
    },
    "major_9": {
        upright: "【隱者 The Hermit】處女座。內在的光明、播種者、從孤獨中提煉出純粹的智慧。引導靈魂深處的探索。",
    },
    "major_10": {
        upright: "【命運 Fortune】木星。宇宙的流動、無常、繁榮與週期的必然輪轉。順應生命的漩渦與機遇。",
    },
    "major_11": {
        upright: "【慾望 Lust】獅子座。狂喜、生命力、神聖的狂熱。接納並昇華內在的野獸本能，展現絕對的力量。",
    },
    "major_12": {
        upright: "【倒吊人 The Hanged Man】水元素。犧牲、臣服、打破舊有模式以獲得靈性覺醒。自願放下的救贖。",
    },
    "major_13": {
        upright: "【死神 Death】天蠍座。轉化、蛻變、死亡與重生的不可逆過程。除舊佈新的煉金術腐化階段。",
    },
    "major_14": {
        upright: "【藝術 Art】射手座。煉金術的融合、對立力量的結合、創造出全新的完美。靈魂與肉體的昇華交融。",
    },
    "major_15": {
        upright: "【惡魔 The Devil】魔羯座。物質創造的衝動、盲目的生命力、突破禁忌的狂喜。直面內在最深處的渴望。",
    },
    "major_16": {
        upright: "【塔 The Tower】火星。舊結構的毀滅、突如其來的淨化、摧毀幻象的真實之火。打破小我以迎來覺醒。",
    },
    "major_17": {
        upright: "【星 The Star】水瓶座。希望、宇宙的靈感、純粹的真理與無限的可能性。洗滌靈魂的星光之水。",
    },
    "major_18": {
        upright: "【月 The Moon】雙魚座。幻象、潛意識的深淵、穿越恐懼與未知的必經之路。迎接黎明前的最黑暗時刻。",
    },
    "major_19": {
        upright: "【太陽 The Sun】太陽。純粹的光明、重生、活力、真理的顯化與絕對的自由。生命力的極致綻放。",
    },
    "major_20": {
        upright: "【新紀元 The Aeon】火元素。時代的更迭、意識的覺醒、全新的視角與決定性的轉變。超越時間的審判。",
    },
    "major_21": {
        upright: "【宇宙 The Universe】土星。旅程的完成、物質與精神的完美結合、大秘儀的圓滿頂點。無限的整體。",
    },

    // 🔥 權杖 (Wands)-火元素
    "wands_1": { upright: "【權杖王牌】火元素的根源。純粹的創造力、爆發性的意志與原始能量的開端。" },
    "wands_2": { upright: "【權杖二-統御】火星在牡羊。勇敢的開創、絕對的自信、掌控局勢與意志的初步展現。" },
    "wands_3": { upright: "【權杖三-美德】太陽在牡羊。充滿自信的行動、內在的正直、確立根基與成功的基礎。" },
    "wands_4": { upright: "【權杖四-完成】金星在牡羊。能量的完美展現、秩序建立後的短暫圓滿、穩定與喜悅。" },
    "wands_5": { upright: "【權杖五-衝突】土星在獅子。阻礙、摩擦、能量的互相碰撞與混亂的考驗。" },
    "wands_6": { upright: "【權杖六-勝利】木星在獅子。突破重圍的成功、榮耀、能量的穩定擴張與平衡。" },
    "wands_7": { upright: "【權杖七-勇氣】火星在獅子。背水一戰、堅持立場、在極度劣勢中展現的英勇與爆發力。" },
    "wands_8": { upright: "【權杖八-迅速】水星在射手。無阻礙的能量流動、快速的發展、電光石火的溝通與行動。" },
    "wands_9": { upright: "【權杖九-力量】月亮在射手。潛意識深處的韌性、從過往經驗中汲取的堅定力量與防禦。" },
    "wands_10": { upright: "【權杖十-壓迫】土星在射手。盲目擴張帶來的沉重負擔、能量受到極度壓抑、殘酷的現實。" },
    "wands_11": { upright: "【權杖騎士】土中之火。克服恐懼的衝動、直率、熱情且具有破壞性爆發力的年輕能量。" },
    "wands_12": { upright: "【權杖皇后】風中之火。理智的擴張、果斷、充滿理想抱負的行動者，迅速且難以預測。" },
    "wands_13": { upright: "【權杖王子】水中之火。持續的熱情、魅力、適應力強且溫暖的領導者，擁有敏銳的直覺。" },
    "wands_14": { upright: "【權杖公主】火中之火。閃電般的爆發力、極度活躍但難以持久的狂熱先鋒，象徵純粹的衝力。" },

    // 💧 聖杯 (Cups)-水元素
    "cups_1": { upright: "【聖杯王牌】水元素的根源。無條件的愛、情感的滿溢、純粹的直覺與靈魂的深層滋養。" },
    "cups_2": { upright: "【聖杯二-愛】金星在巨蟹。和諧的結合、靈魂的共鳴、完美的對立互補與愉悅的交流。" },
    "cups_3": { upright: "【聖杯三-豐盛】水星在巨蟹。情感的結生、愉悅的分享、愛與信任所孕育出的甜美果實。" },
    "cups_4": { upright: "【聖杯四-奢華】月亮在巨蟹。情感的過度飽和、安逸導致的脆弱、失去動力的停滯狀態。" },
    "cups_5": { upright: "【聖杯五-失望】火星在天蠍。期望落空、情感的枯竭、失去平衡的痛苦與深刻的失落感。" },
    "cups_6": { upright: "【聖杯六-愉悅】太陽在天蠍。情感的死灰復燃、深層的性靈和諧、不費吹灰之力的快樂。" },
    "cups_7": { upright: "【聖杯七-墮落】金星在天蠍。過度沉溺、幻象、被表面事物毒害而失去純粹的內在價值。" },
    "cups_8": { upright: "【聖杯八-怠惰】土星在雙魚。情感的停滯、放棄努力、缺乏動力的泥淖與深沉的憂鬱。" },
    "cups_9": { upright: "【聖杯九-幸福】木星在雙魚。內在的完美和諧、深層的喜悅、願望的絕對實現與滿足。" },
    "cups_10": { upright: "【聖杯十-饜足】火星在雙魚。情感發展到極致後的疲乏、過度追求完美導致的無趣與溢出。" },
    "cups_11": { upright: "【聖杯騎士】土中之水。溫柔、浪漫、充滿直覺與藝術氣息的守護者，情感的具象化結晶。" },
    "cups_12": { upright: "【聖杯皇后】風中之水。隱藏的情感、神秘、帶著理智面具的深沉渴望，心思細密且難以捉摸。" },
    "cups_13": { upright: "【聖杯王子】水中之水。純粹的同理心、潛意識的反射者、深不可測的直覺力與無盡的包容。" },
    "cups_14": { upright: "【聖杯公主】火中之水。熱烈的情感表達、充滿魅力的浪漫主義者，如同海浪般強烈且善變。" },

    // ⚔️ 寶劍 (Swords)-風元素
    "swords_1": { upright: "【寶劍王牌】風元素的根源。理智的清晰、破除迷思的真理之劍，純粹而鋒利的思想力量。" },
    "swords_2": { upright: "【寶劍二-和平】月亮在天秤。矛盾的暫時妥協、緊張局勢中的微妙平衡、冷靜的克制。" },
    "swords_3": { upright: "【寶劍三-悲傷】土星在天秤。混亂、憂鬱、理智殘酷地切割情感所帶來的絕對痛苦與分離。" },
    "swords_4": { upright: "【寶劍四-休戰】木星在天秤。從混亂中退讓、妥協、藉由社交建立的暫時秩序與精神的喘息。" },
    "swords_5": { upright: "【寶劍五-失敗】金星在水瓶。思想的僵化、被削弱的意志、承認失敗以避免更大損失的妥協。" },
    "swords_6": { upright: "【寶劍六-科學】水星在水瓶。客觀的分析、邏輯的勝利、理智完美運作與精準溝通的狀態。" },
    "swords_7": { upright: "【寶劍七-無益】月亮在水瓶。徒勞無功、猶豫不決、思緒過於發散而無法落實的空轉狀態。" },
    "swords_8": { upright: "【寶劍八-干擾】木星在雙子。意外的阻礙、注意力渙散、過多瑣碎選擇導致的思想停滯。" },
    "swords_9": { upright: "【寶劍九-殘忍】火星在雙子。無情的批判、純粹的理智暴力、自我折磨與痛苦的絕望深淵。" },
    "swords_10": { upright: "【寶劍十-毀滅】太陽在雙子。理智的徹底崩潰、舊有思想體系的瓦解、絕對的終結與瘋狂。" },
    "swords_11": { upright: "【寶劍騎士】土中之風。敏銳的觀察者、叛逆、以實際行動破除舊有規範，具破壞性的智慧。" },
    "swords_12": { upright: "【寶劍皇后】風中之風。純粹的邏輯思維、極度聰明但可能缺乏情感的分析者，冷靜且抽離。" },
    "swords_13": { upright: "【寶劍王子】水中之風。敏銳的洞察力、優雅但無情的理性、看透表象的智慧與精準的判斷。" },
    "swords_14": { upright: "【寶劍公主】火中之風。思想的狂飆、極度銳利的攻擊性、迅速的邏輯判斷與雷厲風行的執行力。" },

    // 🪙 圓盤 (Disks/Pentacles)-土元素
    "pentacles_1": { upright: "【圓盤王牌】土元素的根源。物質的顯化、豐盛的開端、與大地能量及自然法則的深層連結。" },
    "pentacles_2": { upright: "【圓盤二-變化】木星在魔羯。宇宙的持續律動、物質的交替轉換、在動態中維持的和諧。" },
    "pentacles_3": { upright: "【圓盤三-工作】火星在魔羯。建設性的努力、結構的穩固建立、將能量轉化為實質且持久的成果。" },
    "pentacles_4": { upright: "【圓盤四-權力】太陽在魔羯。物質的穩固、權威、建立規則與不可撼動的界線，但也暗示死板。" },
    "pentacles_5": { upright: "【圓盤五-擔憂】水星在金牛。物質的不安、資源的匱乏、發展停滯與對失去基礎的強烈恐懼。" },
    "pentacles_6": { upright: "【圓盤六-成功】月亮在金牛。物質的豐收、和諧的回報、努力得到實質的肯定與資源的順暢流通。" },
    "pentacles_7": { upright: "【圓盤七-失敗】土星在金牛。發展停滯、枯萎、在錯誤的方向上徒勞無功，需等待下一個週期。" },
    "pentacles_8": { upright: "【圓盤八-謹慎】太陽在處女。精細的工藝、耐心的累積、小心翼翼地守護並培育現有成果。" },
    "pentacles_9": { upright: "【圓盤九-獲得】金星在處女。物質的圓滿、實用的智慧、好運與豐盛能量交織成的良性循環。" },
    "pentacles_10": { upright: "【圓盤十-財富】水星在處女。物質發展的極限、積累的完成、固化而沉重，準備進入下一個毀滅與重生的循環。" },
    "pentacles_11": { upright: "【圓盤騎士】土中之土。孕育新生命的最高潛能溫床、堅韌、將概念化為實體的純粹母性力量。" },
    "pentacles_12": { upright: "【圓盤皇后】風中之土。堅定不移、極度可靠、以穩健不拔的步伐執行物質建設與長期計畫。" },
    "pentacles_13": { upright: "【圓盤王子】水中之土。豐饒的滋養者、極致的實用主義、享受物質帶來的舒適感與絕對的安全感。" },
    "pentacles_14": { upright: "【圓盤公主】火中之土。沉穩的耕耘者、與大自然節奏完全同步、專注於物質生產與積累的領導者。" }
};

// ==========================================
// ✨ 純粹路徑串接版：直接讀取內建資料夾圖片
// ==========================================
async function generateBaseDeck(size) {
    let deck = [];
    const currentTheme = await DB.get('deck_theme', 'cards');
    const baseURL = `assets/${currentTheme}/`;

    // ✨ 智慧切換字典：如果是 thoth 主題，就套用托特字典
    const activeDict = currentTheme === 'thoth' ? ThothDict : TarotDict;

    // 1. 準備所有需要的牌 ID
    const ids = [];
    for (let i = 0; i <= 21; i++) ids.push(`major_${i}`);
    if (size === 78) {
        const suits = ['wands', 'cups', 'swords', 'pentacles'];
        for (let suit of suits) {
            for (let i = 0; i < 14; i++) ids.push(`${suit}_${i + 1}`);
        }
    }

    // 2. 批次從 DB 抓取是否已有自訂圖片 (避開 78 次 await 的效能問題)
    const customImages = await Promise.all(ids.map(id => DB.get(`custom_${id}`)));

    // 3. 組裝牌組
    ids.forEach((id, index) => {
        let type, value, name;
        if (id.startsWith('major')) {
            type = 'major'; value = parseInt(id.split('_')[1]);
            name = `大阿爾克那\n${TarotDict.major[value]}`;
        } else {
            const parts = id.split('_');
            type = parts[0]; value = parseInt(parts[1]);
            name = `小阿爾克那\n${TarotDict[type][value - 1]}`;
        }

        // ✨ 如果 DB 裡有圖片，優先使用 DB 的圖片；否則使用資料夾預設路徑
        const imgPath = customImages[index] || `${baseURL}${id}.jpg`;
        deck.push({ id, type, value, name, image: imgPath });
    });

    return deck;
}

// ============================================================================
// 📖 百科全書編輯器邏輯 (智慧快拍、狀態聯動與未儲存警告版)
// ============================================================================
let currentEditCardId = null;
// 📸 宣告全域快拍記憶體
let dictSnapshots = { builtin: { upright: '', reversed: '' }, custom: { upright: '', reversed: '' } };

function openDictEdit(card) {
    if (history.state && history.state.modal === 'dict-edit') {
        history.replaceState({ modal: 'dict-edit', cardId: card.id }, '', location.hash);
    } else {
        history.pushState({ modal: 'dict-edit', cardId: card.id }, '', location.hash);
    }

    currentEditCardId = card.id;
    document.getElementById('dict-edit-title').innerText = card.name.replace('\n', '-');
    document.getElementById('dict-edit-img').style.backgroundImage = `url(${card.image})`;

    // 1. 讀取內建牌義與個人筆記
    const builtinOverrides = JSON.parse(localStorage.getItem('tarot_meanings_builtin') || '{}');

    // ✨ 核心修復：動態判斷當前百科全書選擇的牌組，決定要抓哪一套字典
    const activeDefaultMeanings = (typeof window.dictCurrentTheme !== 'undefined' && window.dictCurrentTheme === 'thoth') ? ThothMeanings : DefaultMeanings;

    let rawMeaning = builtinOverrides[card.id] || activeDefaultMeanings[card.id] || { upright: "", reversed: "" };

    const bUpright = typeof rawMeaning === 'object' ? (rawMeaning.upright || "") : rawMeaning;
    const bReversed = typeof rawMeaning === 'object' ? (rawMeaning.reversed || "") : "";

    const customs = JSON.parse(localStorage.getItem('tarot_meanings_custom') || '{}');
    let rawCustom = customs[card.id] || { upright: "", reversed: "" };
    const cUpright = typeof rawCustom === 'object' ? (rawCustom.upright || "") : rawCustom;
    const cReversed = typeof rawCustom === 'object' ? (rawCustom.reversed || "") : "";

    // 2. 寫入輸入框
    document.getElementById('dict-edit-builtin-upright').value = bUpright;
    document.getElementById('dict-edit-builtin-reversed').value = bReversed;
    document.getElementById('dict-edit-custom-upright').value = cUpright;
    document.getElementById('dict-edit-custom-reversed').value = cReversed;

    // 📸 3. 進行初始快拍
    dictSnapshots.builtin.upright = bUpright;
    dictSnapshots.builtin.reversed = bReversed;
    dictSnapshots.custom.upright = cUpright;
    dictSnapshots.custom.reversed = cReversed;

    // 4. 初始化所有輸入框鎖定狀態，並綁定「即時打字偵測」
    ['upright', 'reversed'].forEach(type => {
        ['builtin', 'custom'].forEach(source => {
            const ta = document.getElementById(`dict-edit-${source}-${type}`);
            const btnEdit = document.getElementById(`btn-edit-${source}-${type}`);
            if (!ta || !btnEdit) return;

            // 預設鎖定
            ta.readOnly = true;
            ta.classList.add('opacity-60', 'pointer-events-none');
            btnEdit.innerText = '✏️';
            btnEdit.classList.remove('bg-green-600', 'text-white');

            // 綁定輸入監聽：只要打字，就立刻觸發快拍比對
            ta.oninput = () => checkDictChanges(source, type);

            // 手動觸發一次比對，確保剛開視窗時磁片一定是反灰的
            checkDictChanges(source, type);
        });
    });

    // 5. 摺疊面板重置
    const accordionContent = document.getElementById('dict-custom-content');
    const arrow = document.getElementById('dict-custom-arrow');
    if (accordionContent) accordionContent.classList.add('hidden');
    if (arrow) arrow.innerText = '▼';

    document.getElementById('modal-dict-edit').classList.remove('hidden');
    document.getElementById('modal-dict-edit').classList.add('flex');
}

// 🎯 核心引擎：即時比對當前文字與快拍，控制磁片亮暗
function checkDictChanges(source, type) {
    const ta = document.getElementById(`dict-edit-${source}-${type}`);
    const btnSave = document.getElementById(`btn-save-${source}-${type}`);
    if (!ta || !btnSave) return;

    if (ta.value !== dictSnapshots[source][type]) {
        // 🚨 有差異：拔除反灰，加入發亮與可點擊樣式，並掛上 active-save-btn 標記
        btnSave.classList.remove('bg-gray-800', 'text-gray-500', 'border-gray-700', 'pointer-events-none');
        btnSave.classList.add('bg-yellow-600', 'text-black', 'border-yellow-400', 'cursor-pointer', 'hover:bg-yellow-500', 'active-save-btn');
    } else {
        // 💤 無差異：拔除發亮樣式，恢復反灰
        btnSave.classList.remove('bg-yellow-600', 'text-black', 'border-yellow-400', 'cursor-pointer', 'hover:bg-yellow-500', 'active-save-btn');
        btnSave.classList.add('bg-gray-800', 'text-gray-500', 'border-gray-700', 'pointer-events-none');
    }
}

// ✨ 百科全書關閉邏輯 (發亮磁片比對 + 精準提示版)
function closeDictEdit(fromHistory = false) {
    const modal = document.getElementById('modal-dict-edit');
    if (!modal || modal.classList.contains('hidden')) return;

    // 🔍 尋找畫面上是否有任何「尚未儲存的變更」(發亮的磁片)
    const unsavedChanges = modal.querySelectorAll('.active-save-btn');

    if (unsavedChanges.length > 0) {
        // ✨ 情境 A：有異動，系統代勞自動點擊儲存
        unsavedChanges.forEach(btn => btn.click());

        if (typeof showToast === 'function') {
            setTimeout(() => {
                showToast('✅ 離開前已為您自動存檔！');
            }, 100);
        }
    } else {
        // ✨ 情境 B：沒有任何發亮的磁片，代表沒有異動
        if (typeof showToast === 'function') {
            showToast('👌 筆記無異動');
        }
    }

    // 最後執行關閉
    forceCloseDictEdit(fromHistory, modal);
}

function forceCloseDictEdit(fromHistory, modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (!fromHistory) history.back();
}

// ✨ 切換內建牌義鎖定狀態 (只負責開鎖關鎖，不負責亮磁片)
window.toggleBuiltinEdit = function (type) {
    const ta = document.getElementById(`dict-edit-builtin-${type}`);
    const btnEdit = document.getElementById(`btn-edit-builtin-${type}`);

    if (ta.readOnly) {
        ta.readOnly = false;
        ta.classList.remove('opacity-60', 'pointer-events-none');
        ta.focus();
        btnEdit.innerText = '🔒';
        btnEdit.classList.add('bg-green-600', 'text-white');
    } else {
        ta.readOnly = true;
        ta.classList.add('opacity-60', 'pointer-events-none');
        btnEdit.innerText = '✏️';
        btnEdit.classList.remove('bg-green-600', 'text-white');
    }
};

window.saveSingleBuiltin = function (type) {
    if (!currentEditCardId) return;
    const ta = document.getElementById(`dict-edit-builtin-${type}`);
    const newVal = ta.value.trim();
    ta.value = newVal; // 去除頭尾空白再塞回去

    let builtinOverrides = JSON.parse(localStorage.getItem('tarot_meanings_builtin') || '{}');
    if (typeof builtinOverrides[currentEditCardId] !== 'object') {
        let defaultData = DefaultMeanings[currentEditCardId] || { upright: "", reversed: "" };
        builtinOverrides[currentEditCardId] = {
            upright: typeof defaultData === 'object' ? defaultData.upright : defaultData,
            reversed: typeof defaultData === 'object' ? defaultData.reversed : ""
        };
    }
    builtinOverrides[currentEditCardId][type] = newVal;
    localStorage.setItem('tarot_meanings_builtin', JSON.stringify(builtinOverrides));

    // 📸 核心：儲存成功後，將新文字寫入快拍！
    dictSnapshots.builtin[type] = newVal;

    // 🔄 主動比對一次，按鈕會瞬間反灰
    checkDictChanges('builtin', type);

    // 鎖回欄位
    if (!ta.readOnly) toggleBuiltinEdit(type);
    if (typeof showToast === 'function') showToast(`✅ ${type === 'upright' ? '正位' : '逆位'}內建牌義已儲存！`);
};

window.restoreSingleBuiltin = function (type) {
    if (!currentEditCardId) return;
    const ta = document.getElementById(`dict-edit-builtin-${type}`);

    // ✨ 核心修復：還原時也要動態判斷目前的主題，才能正確還原成托特牌義
    const activeDefaultMeanings = (typeof window.dictCurrentTheme !== 'undefined' && window.dictCurrentTheme === 'thoth') ? ThothMeanings : DefaultMeanings;
    const defaultData = activeDefaultMeanings[currentEditCardId] || { upright: "", reversed: "" };
    const defaultVal = (typeof defaultData === 'object' ? defaultData[type] : (type === 'upright' ? defaultData : "")).trim();

    if (ta.value.trim() === defaultVal) {
        if (typeof showToast === 'function') showToast('💡 牌義無異動（與預設值相同）');
        return;
    }

    if (typeof showConfirm === 'function') {
        showConfirm(`確定要將【${type === 'upright' ? '正位' : '逆位'}】內建牌義還原為系統出廠預設值嗎？`, () => {
            ta.value = defaultVal;

            let builtinOverrides = JSON.parse(localStorage.getItem('tarot_meanings_builtin') || '{}');
            if (typeof builtinOverrides[currentEditCardId] === 'object') {
                builtinOverrides[currentEditCardId][type] = defaultVal;
                localStorage.setItem('tarot_meanings_builtin', JSON.stringify(builtinOverrides));
            }

            // 📸 還原後，也要將預設值寫入快拍並反灰按鈕
            dictSnapshots.builtin[type] = defaultVal;
            checkDictChanges('builtin', type);

            if (!ta.readOnly) toggleBuiltinEdit(type);
            if (typeof showToast === 'function') showToast('🔄 牌義已重置為出廠預設值');
        });
    }
};

window.toggleCustomEdit = function (type) {
    const ta = document.getElementById(`dict-edit-custom-${type}`);
    const btnEdit = document.getElementById(`btn-edit-custom-${type}`);

    if (ta.readOnly) {
        ta.readOnly = false;
        ta.classList.remove('opacity-60', 'pointer-events-none');
        ta.focus();
        btnEdit.innerText = '🔒';
        btnEdit.classList.add('bg-green-600', 'text-white');
    } else {
        ta.readOnly = true;
        ta.classList.add('opacity-60', 'pointer-events-none');
        btnEdit.innerText = '✏️';
        btnEdit.classList.remove('bg-green-600', 'text-white');
    }
};

window.saveSingleCustom = function (type) {
    if (!currentEditCardId) return;
    const ta = document.getElementById(`dict-edit-custom-${type}`);
    const newVal = ta.value.trim();
    ta.value = newVal;

    let customs = JSON.parse(localStorage.getItem('tarot_meanings_custom') || '{}');
    if (typeof customs[currentEditCardId] !== 'object') {
        customs[currentEditCardId] = { upright: "", reversed: "" };
    }
    customs[currentEditCardId][type] = newVal;
    localStorage.setItem('tarot_meanings_custom', JSON.stringify(customs));

    // 📸 核心：儲存成功後，更新個人筆記的快拍！
    dictSnapshots.custom[type] = newVal;

    // 🔄 重新比對，反灰磁片
    checkDictChanges('custom', type);

    if (!ta.readOnly) toggleCustomEdit(type);
    if (typeof showToast === 'function') showToast(`✅ ${type === 'upright' ? '正位' : '逆位'}個人筆記已存檔！`);
};

async function saveCustomMeaning() {
    const id = document.getElementById('meaning-card-select').value; const text = document.getElementById('meaning-custom-input').value;
    let customs = JSON.parse(localStorage.getItem('tarot_meanings_custom') || '{}'); customs[id] = text;
    await DB.set('custom', customs);
    showToast('擴充牌義儲存成功！');
}

// ==========================================
// ✨ 核心修復：批次上傳 78 張牌面 (轉為 IndexedDB)
// ==========================================
document.getElementById('upload-deck-batch')?.addEventListener('change', async function (e) {
    const files = e.target.files;
    const progressText = document.getElementById('batch-progress');
    if (files.length === 0) return;
    progressText.innerText = `處理中...`;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNameBase = file.name.split('.')[0]; // 例如: major_0

        await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    // 稍微提升畫質解析度到寬 300px
                    const scale = 300 / img.width;
                    canvas.width = 300;
                    canvas.height = img.height * scale;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    try {
                        // ✨ 改用 await DB.set，這樣發牌的時候才抓得到！
                        await DB.set(`custom_${fileNameBase}`, canvas.toDataURL('image/jpeg', 0.8));
                        successCount++;
                    } catch (e) { console.error(e); }
                    resolve();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
        progressText.innerText = `已處理 ${successCount} / ${files.length}`;
    }
    showToast(`✅ 成功匯入 ${successCount} 張自訂牌面！`);
});

// ✨ 改寫為 Callback 與 Async，避開系統原生的 Confirm 阻斷
function restoreDefaults() {
    showConfirm("清除所有自訂設定？", async () => {
        // 使用 localforage 原生的 keys() 來取得所有金鑰
        const keys = await localforage.keys();
        for (let k of keys) {
            // 只要是 tarot_ 開頭且不是歷史紀錄的，全刪！
            if (k.startsWith('tarot_') && k !== 'tarot_history') {
                await localforage.removeItem(k);
            }
        }
        showAlert("已還原！", () => location.reload());
    });
}

async function saveAndApplySettings() {
    let blConf = {}; Object.keys(BL.defaults).forEach(key => {
        const modeEl = document.getElementById(`bl_mode_${key}`);
        if (modeEl) {
            blConf[key] = {
                text: BL.defaults[key].text, mode: modeEl.value, time: parseInt(document.getElementById(`bl_time_${key}`).value) || 0
            };
        }
    });
    await DB.set('bl_config', blConf);
    await applyStoredSettings();
    navTo('screen-home');
}

async function applyStoredSettings() {
    const bgImg = await DB.get('bg_img');
    if (bgImg) document.body.style.backgroundImage = `url(${bgImg})`;
}

// ==========================================
// 📖 百科全書：綜合模組過濾引擎 (選單+搜尋+分類)
// ==========================================
window.dictCurrentTheme = 'cards';
window.dictSearchQuery = '';
window.dictCurrentCategory = 'all';

async function openMeaningDictionary() {
    // 1. 初始化下拉選單
    const themeList = await DB.get('deck_theme_list', [
        { name: '經典萊德偉特', id: 'cards' },
        { name: '托特塔羅牌', id: 'thoth' }
    ]);
    const selectEl = document.getElementById('dict-deck-select');
    if (selectEl) {
        selectEl.innerHTML = themeList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        const currentSysTheme = await DB.get('deck_theme', 'cards');
        if (themeList.some(t => t.id === currentSysTheme)) {
            selectEl.value = currentSysTheme;
            window.dictCurrentTheme = currentSysTheme;
        }
    }

    // 2. 清空搜尋框與重置分類
    const searchInput = document.getElementById('dict-search-input');
    if (searchInput) searchInput.value = '';
    window.dictSearchQuery = '';
    window.filterDictionary('all'); // 會自動呼叫 renderDictGrid

    navTo('screen-meaning-dict');
}

// ✨ HTML 觸發：更換選單牌組
window.onDictThemeChange = function () {
    window.dictCurrentTheme = document.getElementById('dict-deck-select').value;
    renderDictGrid();
};

// ✨ HTML 觸發：輸入關鍵字搜尋
window.onDictSearchInput = function () {
    window.dictSearchQuery = document.getElementById('dict-search-input').value.toLowerCase().trim();
    renderDictGrid();
};

// ✨ HTML 觸發：切換大阿卡納與四元素分類
window.filterDictionary = function (category) {
    window.dictCurrentCategory = category;

    // 更新上方書籤按鈕的顏色 (點擊的變亮，其他的變暗)
    const allFilters = ['all', 'major', 'wands', 'cups', 'swords', 'pentacles'];
    allFilters.forEach(f => {
        const btn = document.getElementById(`filter-btn-${f}`);
        if (!btn) return;
        if (f === category) {
            btn.classList.remove('bg-purple-900', 'text-white', 'border-purple-500');
            btn.classList.add('bg-yellow-600', 'text-black', 'border-yellow-400', 'shadow-[0_0_10px_rgba(202,138,4,0.5)]');
        } else {
            btn.classList.remove('bg-yellow-600', 'text-black', 'border-yellow-400', 'shadow-[0_0_10px_rgba(202,138,4,0.5)]');
            btn.classList.add('bg-purple-900', 'text-white', 'border-purple-500');
        }
    });

    renderDictGrid(); // 重新過濾並渲染顯示
};

// ✨ 終極核心渲染器
async function renderDictGrid() {
    const container = document.getElementById('dict-container');
    if (!container) return;
    container.innerHTML = '';

    // 動態判斷要使用的字典
    const activeDict = window.dictCurrentTheme === 'thoth' ? ThothDict : TarotDict;

    const categories = [
        { id: 'major', title: '大阿爾克那 (Major Arcana)' },
        { id: 'wands', title: '權杖 (Wands)' },
        { id: 'cups', title: '聖杯 (Cups)' },
        { id: 'swords', title: '寶劍 (Swords)' },
        { id: 'pentacles', title: '錢幣 (Pentacles)' }
    ];

    let hasAnyVisibleCard = false;

    categories.forEach(cat => {
        // 1. 分類過濾：如果選擇了特定分類，且不是當前這類，就整區跳過
        if (window.dictCurrentCategory !== 'all' && window.dictCurrentCategory !== cat.id) return;

        const section = document.createElement('div');
        section.className = 'dict-section flex flex-col mb-4';

        const title = document.createElement('h3');
        title.className = 'text-lg font-bold text-yellow-300 border-b border-purple-500/50 pb-1 mb-3 drop-shadow-md';
        title.innerText = cat.title;
        section.appendChild(title);

        const grid = document.createElement('div');
        // 維持你原本的完美響應式 Grid
        grid.className = 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3';

        let sectionHasCard = false;

        // 2. 產生該分類的所有卡牌
        let cardCount = cat.id === 'major' ? 22 : 14;
        for (let i = 0; i < cardCount; i++) {
            let cardId = cat.id === 'major' ? `major_${i}` : `${cat.id}_${i + 1}`;
            let cardName = cat.id === 'major' ? activeDict.major[i] : activeDict[cat.id][i];
            let fullTitle = cat.id === 'major' ? `大阿爾克那\n${cardName}` : `小阿爾克那\n${cardName}`;

            // 3. 搜尋過濾：比對牌名與 ID (例如搜尋 "愚者" 或 "major" 都能找到)
            if (window.dictSearchQuery !== '') {
                if (!cardName.toLowerCase().includes(window.dictSearchQuery) && !cardId.toLowerCase().includes(window.dictSearchQuery)) {
                    continue; // 不符合搜尋就跳過這張牌
                }
            }

            sectionHasCard = true;
            hasAnyVisibleCard = true;

            // 圖片路徑動態綁定選單選中的主題！
            const imgUrl = `assets/${window.dictCurrentTheme}/${cardId}.jpg`;

            const cardDiv = document.createElement('div');
            // 維持你原本的卡片樣式
            cardDiv.className = 'w-full aspect-[1/1.6] bg-cover bg-center rounded border border-purple-500 cursor-pointer hover:border-yellow-300 transition-all relative overflow-hidden shadow-md';
            cardDiv.style.backgroundImage = `url('${imgUrl}')`;

            // 建立一個仿照你資料庫結構的假物件，餵給 openDictEdit
            const fakeCardObject = { id: cardId, name: fullTitle, image: imgUrl };
            cardDiv.onclick = () => openDictEdit(fakeCardObject);

            const label = document.createElement('div');
            // ✨ 視覺升級：字體放大為 text-[0.7rem] sm:text-xs，加深背景，增加內距
            label.className = 'absolute bottom-0 w-full bg-black/90 text-[0.7rem] sm:text-xs text-center text-yellow-300 py-1.5 font-bold tracking-wider leading-tight drop-shadow-md';
            label.innerText = cardName;

            cardDiv.appendChild(label);
            grid.appendChild(cardDiv);
        }

        // 如果這個區塊底下有牌，才把整個區塊畫出來
        if (sectionHasCard) {
            section.appendChild(grid);
            container.appendChild(section);
        }
    });

    // 如果一張牌都沒找到，顯示溫馨提示
    if (!hasAnyVisibleCard) {
        container.innerHTML = '<p class="text-center text-purple-300 py-10 text-sm">🔍 找不到符合條件的牌卡...</p>';
    }
}

// 動態產生：「牌陣 | 牌義 | 提示」
async function getDrawPromptText(slotIndex) {
    const spreadId = currentRitualData.spread;
    if (spreadId === 'single') {
        return "【單牌神諭】👉 請點擊翻牌";
    }
    if (spreadId === 'multi_cross' && window.crossDrawState) {
        const targetSlot = window.crossDrawState.slotIndices[slotIndex];
        const customSpreads = await DB.get('custom_spreads', []);
        const parentSpread = window.crossDrawState.parentRecord.spread;
        const slotName = parentSpread === 'single' ? '單牌神諭' : getSpreadSlotName(parentSpread, targetSlot, customSpreads);
        return `【補充神諭】👉 請抽取：${slotName}`;
    }
    let spreadName = "自由抽牌";
    let positionMeaning = "神諭之位";

    if (spreadId === 'triangle') {
        spreadName = "聖三角"; positionMeaning = ["過去", "現在", "未來"][slotIndex] || "";
    } else if (spreadId === 'five') {
        spreadName = "五張序"; positionMeaning = ["過去", "近過去", "現在", "近未來", "未來"][slotIndex] || "";
    } else if (spreadId === 'hexagram') {
        spreadName = "六芒星"; positionMeaning = ["過去", "現在", "未來", "對策", "環境", "期望", "結果"][slotIndex] || "";
    } else if (spreadId.startsWith('custom_saved_')) {
        const index = parseInt(spreadId.replace('custom_saved_', ''));
        const spreads = await DB.get('custom_spreads', []);
        if (spreads[index]) {
            spreadName = spreads[index].name;
            positionMeaning = spreads[index].meanings[slotIndex] || `第 ${slotIndex + 1} 張`;
        }
    } else if (spreadId.startsWith('custom_dynamic_')) {
        const count = parseInt(spreadId.replace('custom_dynamic_', ''));
        spreadName = `自訂抽取 (${count}張)`;
        positionMeaning = `第 ${slotIndex + 1} 張`;
    }
    return `【${spreadName}】${positionMeaning} 👉 請選擇第 ${slotIndex + 1} 張`;
}

// ==========================================
// 模組 10: 視覺化牌義編輯器 (動態生成 UI)
// ==========================================
function openDictionaryManager() {
    let container = document.getElementById('visual-dict-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'visual-dict-container';
        container.className = 'fixed inset-0 bg-[#0f172a] z-[100] flex flex-col overflow-hidden text-white';
        document.body.appendChild(container);
    }
    container.innerHTML = '';

    // 頂部導航
    const header = document.createElement('div');
    header.className = 'p-4 border-b border-purple-500 bg-purple-900/80 flex justify-between items-center shrink-0 shadow-lg';
    header.innerHTML = `<h2 class="text-xl font-bold text-yellow-300">📚 塔羅典藏庫</h2><button onclick="document.getElementById('visual-dict-container').classList.add('hidden')" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">返回設定</button>`;
    container.appendChild(header);

    // 卡牌陣列網格
    const gridWrap = document.createElement('div');
    gridWrap.className = 'flex-1 overflow-y-auto p-4';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 pb-20';
    gridWrap.appendChild(grid);
    container.appendChild(gridWrap);

    const deck = generateBaseDeck(78);
    deck.forEach(card => {
        const item = document.createElement('div');
        item.className = 'flex flex-col items-center cursor-pointer hover:scale-105 transition-transform bg-purple-900/30 p-2 rounded-lg border border-purple-500/50 hover:border-yellow-400 shadow-md';

        const names = card.name.split('\n');
        item.innerHTML = `
            <div class="w-full aspect-[60/105] bg-cover bg-center rounded mb-2 shadow-inner" style="background-image: url('${card.image}')"></div>
            <span class="text-[0.65rem] text-center leading-tight text-purple-100 font-bold">${names[1] || names[0]}</span>
        `;
        item.onclick = () => openDictEditorModal(card);
        grid.appendChild(item);
    });

    container.classList.remove('hidden'); container.classList.add('flex');
}

async function openDictEditorModal(card) {
    let modal = document.getElementById('dict-editor-modal');
    if (!modal) { /* ... 建立 Modal DOM (保留原本邏輯) ... */ }

    // ✨ 非同步獲取預設牌義資料
    const builtinOverrides = await DB.get('meanings_builtin', {});

    // 先把原始資料抓出來 (可能是物件，也可能是字串)
    let rawMeaning = builtinOverrides[card.id] || DefaultMeanings[card.id] || "無預設解析，請自行參悟...";
    let defMeaning = "";

    // ✨ 核心修復：智慧判斷並「解壓縮」物件格式
    if (typeof rawMeaning === 'object' && rawMeaning !== null) {
        // 因為是要放進 textarea，所以使用 \n 來換行
        defMeaning = `【正位】\n${rawMeaning.upright || '無'}\n\n【逆位】\n${rawMeaning.reversed || '無'}`;
    } else {
        defMeaning = rawMeaning;
    }

    const customMeanings = await DB.get('meanings_custom', {});
    const customText = customMeanings[card.id] || "";

    // 編輯器彈窗內容 (鎖定狀態)
    modal.innerHTML = `
        <div class="bg-purple-950 border border-purple-400 rounded-xl w-full max-w-md p-5 flex flex-col gap-4 max-h-[90vh] shadow-2xl relative">
            <div class="flex justify-between items-center border-b border-purple-500/50 pb-2">
                <h3 class="font-bold text-yellow-300 text-lg">${card.name.replace('\n', '-')}</h3>
                <button onclick="document.getElementById('dict-editor-modal').classList.add('hidden')" class="text-purple-300 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            
            <div class="flex gap-4">
                <div class="w-24 h-40 shrink-0 bg-cover bg-center rounded-md border border-purple-400 shadow-md" style="background-image: url('${card.image}')"></div>
                <div class="flex-1 overflow-y-auto flex flex-col gap-1">
                    <label class="text-xs text-purple-300">📜 系統預設牌義：</label>
                    <textarea class="w-full bg-black/30 border border-purple-500/50 rounded p-2 text-xs text-purple-100 h-[8.5rem] resize-none" disabled>${defMeaning}</textarea>
                </div>
            </div>
            
            <div class="flex flex-col gap-1 mt-1">
                <label class="text-sm text-yellow-300 font-bold flex justify-between items-center">
                    <span>✍️ 祭司專屬註解</span>
                    <span id="edit-status-text" class="text-xs text-red-400 font-normal border border-red-400 px-1 rounded">鎖定中</span>
                </label>
                <textarea id="edit-cus-text" class="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-sm text-gray-300 h-32 opacity-70 pointer-events-none transition-all resize-none shadow-inner" placeholder="點擊下方解鎖後，可在此輸入專屬備註...">${customText}</textarea>
            </div>
            
            <div class="flex justify-end gap-3 mt-2 pt-2 border-t border-purple-500/50">
                <button id="btn-unlock-edit" class="px-4 py-2 bg-blue-800 border border-blue-500 text-blue-100 rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-md" onclick="unlockDictEdit()">🔓 解鎖編輯</button>
                <button id="btn-save-edit" class="px-6 py-2 bg-gray-700 text-gray-400 font-bold rounded-lg text-sm pointer-events-none transition-all" onclick="saveDictEdit('${card.id}')">💾 儲存</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function unlockDictEdit() {
    const ta = document.getElementById('edit-cus-text');
    ta.classList.remove('opacity-70', 'pointer-events-none', 'bg-black/50', 'text-gray-300', 'border-gray-600');
    ta.classList.add('bg-purple-900/50', 'text-white', 'border-yellow-400');
    ta.focus();

    document.getElementById('edit-status-text').innerText = '編輯中';
    document.getElementById('edit-status-text').className = 'text-xs text-green-400 font-normal border border-green-400 px-1 rounded';

    const btnSave = document.getElementById('btn-save-edit');
    btnSave.classList.remove('bg-gray-700', 'text-gray-400', 'pointer-events-none');
    btnSave.classList.add('bg-yellow-600', 'text-black', 'hover:bg-yellow-500', 'shadow-[0_0_10px_rgba(202,138,4,0.5)]');

    const btnUnlock = document.getElementById('btn-unlock-edit');
    btnUnlock.innerText = '✏️ 編輯中';
    btnUnlock.classList.replace('bg-blue-800', 'bg-gray-700');
    btnUnlock.classList.replace('border-blue-500', 'border-gray-600');
    btnUnlock.classList.replace('text-blue-100', 'text-gray-400');
    btnUnlock.classList.add('pointer-events-none');
}

// ==========================================
// ✨ 牌組記憶體管理 (State Manager)
// ==========================================
const DeckStorage = {
    save: async (deckData, size) => {
        const state = {
            size: size,
            deck: deckData.map(c => ({ id: c.id, isReversed: c.isReversed || false }))
        };
        await DB.set('saved_state', state); // ✨ 改用 IndexedDB
    },
    load: async () => {
        return await DB.get('saved_state'); // ✨ 改用 IndexedDB
    }
};

// ==========================================
// 模組 6: 牌陣清單管理與自訂繪圖室 (含修改功能)
// ==========================================
let editingSpreadIndex = null; // 記錄正在編輯的索引
let tempCustomSpreadData = {}; // 暫存編輯中的牌陣資料

// 1. ✨ 綁定首頁/設定頁的按鈕，渲染清單並切換畫面
async function openSpreadManager() {
    await renderSpreadManageList();
    navTo('screen-spread-manage');
}

// 2. ✨ 渲染清單，套用全新的 UI 樣式
async function renderSpreadManageList() {
    const list = document.getElementById('manage-spread-list');
    if (!list) return;
    list.innerHTML = '';

    const customSpreads = await DB.get('custom_spreads', []);

    if (customSpreads.length === 0) {
        list.innerHTML = '<p class="text-center text-purple-300 text-sm mt-10">目前沒有自訂牌陣，請點擊上方新增。</p>';
        return;
    }

    customSpreads.forEach((spread, index) => {
        const div = document.createElement('div');
        div.className = 'bg-purple-900/60 p-4 rounded-xl border border-purple-500 flex justify-between items-center mb-3';
        div.innerHTML = `
            <div>
                <h4 class="font-bold text-yellow-300 text-lg">${spread.name}</h4>
                <p class="text-xs text-purple-200 mt-1">共 ${spread.meanings ? spread.meanings.length : spread.positions.length} 張牌</p>
            </div>
            <div class="flex gap-2">
                <button onclick="editCustomSpread(${index})" class="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded text-xs font-bold transition-colors">✏️ 編輯</button>
                <button onclick="deleteCustomSpread(${index})" class="bg-red-700 hover:bg-red-600 text-white p-2 rounded text-xs font-bold transition-colors">🗑️ 刪除</button>
            </div>`;
        list.appendChild(div);
    });
}

function deleteCustomSpread(index) {
    showConfirm('確定要刪除這個自訂牌陣嗎？', async () => {
        let spreads = await DB.get('custom_spreads', []);
        spreads.splice(index, 1);
        await DB.set('custom_spreads', spreads);
        await renderSpreadManageList();
    });
}

function openCustomSpreadBuilder() {
    editingSpreadIndex = null;
    tempCustomSpreadData = {};
    document.getElementById('custom-spread-icon').value = '✨'; // ✨ 預設給個星星
    document.getElementById('custom-spread-name').value = '';
    document.getElementById('custom-spread-rows').innerHTML = '';
    addCustomSpreadRow(); addCustomSpreadRow(); addCustomSpreadRow();
    navTo('screen-custom-spread-1');
}

// 3. ✨ 核心修復：編輯既有牌陣
async function editCustomSpread(index) {
    let spreads = await DB.get('custom_spreads', []);
    let spread = spreads[index];
    if (!spread) return;

    editingSpreadIndex = index;
    tempCustomSpreadData = JSON.parse(JSON.stringify(spread));

    document.getElementById('custom-spread-name').value = spread.name;
    document.getElementById('custom-spread-icon').value = spread.icon || '✨'; // ✨ 讀取舊的 emoji
    const container = document.getElementById('custom-spread-rows');
    container.innerHTML = '';

    // 確保相容性：不管是舊資料結構還是新資料結構，都能讀出位置意義
    const meaningsArray = spread.meanings || spread.positions.map(p => p.meaning || '');
    meaningsArray.forEach(meaning => { addCustomSpreadRow(meaning); });

    navTo('screen-custom-spread-1');
}

function addCustomSpreadRow(val = '') {
    const container = document.getElementById('custom-spread-rows');
    const num = container.children.length + 1;

    const rowDiv = document.createElement('div');
    rowDiv.className = 'flex gap-2 mb-2 items-center';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'magic-input text-sm flex-1 spread-meaning-input'; // 補上辨識用的 class
    input.placeholder = `第 ${num} 張牌的涵義 (例如: 過去/現狀)`;
    input.value = val;
    rowDiv.appendChild(input);

    if (num > 3) {
        const delBtn = document.createElement('button');
        delBtn.innerText = '➖';
        delBtn.className = 'px-3 py-2 bg-red-900/60 rounded border border-red-500 hover:bg-red-800 transition-colors font-bold text-white';
        delBtn.onclick = () => {
            rowDiv.remove();
            updateCustomSpreadRowPlaceholders();
        };
        rowDiv.appendChild(delBtn);
    }
    container.appendChild(rowDiv);
}

function updateCustomSpreadRowPlaceholders() {
    const container = document.getElementById('custom-spread-rows');
    Array.from(container.children).forEach((row, idx) => {
        row.querySelector('input').placeholder = `第 ${idx + 1} 張牌的涵義 (例如: 過去/現狀)`;
    });
}

// 4. ✨ 核心修復：修正抓取輸入框內容的 Bug
function goToCustomSpreadStep2() {
    const name = document.getElementById('custom-spread-name').value.trim();
    const icon = document.getElementById('custom-spread-icon').value.trim() || '✨'; // ✨ 抓取值
    if (!name) { showToast('請輸入牌陣名稱！'); return; }

    // 修正：必須尋找 row 裡面的 input，否則會抓到 undefined
    const cardMeanings = Array.from(document.getElementById('custom-spread-rows').children).map(row => {
        const inputEl = row.querySelector('input');
        return inputEl ? (inputEl.value.trim() || '未命名位置') : '未命名位置';
    });

    if (cardMeanings.length === 0) { showToast('請至少新增一個位置！'); return; }
    tempCustomSpreadData.name = name;
    tempCustomSpreadData.icon = icon; // ✨ 存入暫存資料
    tempCustomSpreadData.meanings = cardMeanings;
    if (!tempCustomSpreadData.positions) tempCustomSpreadData.positions = [];

    initBuilderCanvas(cardMeanings.length);
    navTo('screen-custom-spread-2');
}

function initBuilderCanvas(cardCount) {
    const placedContainer = document.getElementById('builder-placed-cards');
    placedContainer.innerHTML = '';

    const canvasEl = document.getElementById('builder-canvas');
    const canvasWidth = canvasEl.clientWidth || Math.min(window.innerWidth, 448);
    const canvasHeight = canvasEl.clientHeight || (canvasWidth * 4 / 3);

    // ✨ 智慧排版引擎：將你構想的張數結構化為陣列
    let layoutConfig = [];
    if (cardCount === 3) layoutConfig = [1, 2]; // 上 1，下 2 (正三角)
    else if (cardCount === 4) layoutConfig = [2, 2]; // 2x2 四角
    else if (cardCount === 5) layoutConfig = [2, 1, 2]; // 四角加中間
    else if (cardCount === 6) layoutConfig = [3, 3];
    else if (cardCount === 7) layoutConfig = [3, 1, 3];
    else if (cardCount === 8) layoutConfig = [4, 4];
    else if (cardCount === 9) layoutConfig = [3, 3, 3];
    else if (cardCount === 10) layoutConfig = [3, 4, 3];
    else if (cardCount === 11) layoutConfig = [4, 4, 3];
    else if (cardCount === 12) layoutConfig = [4, 4, 4];
    else if (cardCount === 13) layoutConfig = [4, 4, 5];
    else {
        // 超過 13 張或少於 3 張，採用自動換行防呆邏輯
        const maxC = Math.min(cardCount, 4);
        const rows = Math.ceil(cardCount / maxC);
        for (let r = 0; r < rows; r++) {
            layoutConfig.push(r === rows - 1 ? (cardCount % maxC || maxC) : maxC);
        }
    }

    // 將結構轉換為每張牌的平鋪座標陣列
    let autoPositions = [];
    const safeWidth = canvasWidth - 60;
    const safeHeight = canvasHeight - 80;
    const spacingY = layoutConfig.length > 1 ? safeHeight / (layoutConfig.length - 1) : 0;
    const startY = layoutConfig.length > 1 ? 40 : canvasHeight / 2;

    layoutConfig.forEach((cardsInThisRow, rowIndex) => {
        const spacingX = cardsInThisRow > 1 ? safeWidth / (cardsInThisRow - 1) : 0;
        const startX = cardsInThisRow > 1 ? 30 : canvasWidth / 2;
        const currentY = startY + (rowIndex * spacingY);

        for (let col = 0; col < cardsInThisRow; col++) {
            const currentX = startX + (col * spacingX);
            autoPositions.push({ left: currentX, top: currentY });
        }
    });

    // 正式生成卡牌元素
    for (let i = 0; i < cardCount; i++) {
        const card = document.createElement('div');
        card.className = 'builder-card';

        // 若有存檔座標則套用，若無則套用智慧排版引擎算出來的座標
        if (tempCustomSpreadData.positions && tempCustomSpreadData.positions[i]) {
            card.style.left = tempCustomSpreadData.positions[i].left;
            card.style.top = tempCustomSpreadData.positions[i].top;
        } else {
            card.style.left = `${autoPositions[i].left}px`;
            card.style.top = `${autoPositions[i].top}px`;
        }

        // 八方位旋轉機制與數字標籤
        card.dataset.idx = i;
        card.dataset.angle = tempCustomSpreadData.positions && tempCustomSpreadData.positions[i] && tempCustomSpreadData.positions[i].angle ? tempCustomSpreadData.positions[i].angle : 0;

        card.style.transform = `translate(-50%, -50%) rotate(${card.dataset.angle}deg)`;

        card.innerHTML = `
            <span class="pointer-events-none">${i + 1}</span>
            <div class="absolute -top-3 -right-3 w-6 h-6 bg-blue-600 border border-blue-300 rounded-full text-white text-xs flex items-center justify-center cursor-pointer shadow-md z-[200]" 
                 onclick="event.stopPropagation(); let a = (parseInt(this.parentElement.dataset.angle) || 0) + 45; if(a >= 360) a = 0; this.parentElement.dataset.angle = a; this.parentElement.style.transform = \`translate(-50%, -50%) rotate(\${a}deg)\`;">
                ↻
            </div>
        `;

        makeDraggable(card);
        placedContainer.appendChild(card);
    }
}

function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        // ✨ 修復 3：改用 offsetLeft / offsetTop，精準抓取渲染後的絕對像素，防止座標跳動
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;

        el.style.zIndex = 1000;
        el.setPointerCapture(e.pointerId); // 鎖定游標防掉幀
    });

    document.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const canvasEl = document.getElementById('builder-canvas');
        const canvasWidth = canvasEl.clientWidth || Math.min(window.innerWidth, 448);
        const canvasHeight = canvasEl.clientHeight || (canvasWidth * 4 / 3);

        let newLeft = initialLeft + (e.clientX - startX);
        let newTop = initialTop + (e.clientY - startY);

        // 邊界鎖定防摔出
        newLeft = Math.max(25, Math.min(newLeft, canvasWidth - 25));
        newTop = Math.max(45, Math.min(newTop, canvasHeight - 45));

        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
    });

    document.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            el.style.zIndex = 10;
            el.releasePointerCapture(e.pointerId);
        }
    });
}

async function saveCustomSpread() {
    const placedCards = Array.from(document.getElementById('builder-placed-cards').children);

    // ✨ 修復 2：必須抓取 builder-canvas 實際長寬計算百分比，而不是直接抓 window
    const canvasEl = document.getElementById('builder-canvas');
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;

    tempCustomSpreadData.positions = placedCards.map(card => ({
        left: String(card.style.left).includes('%') ? card.style.left : `${(parseFloat(card.style.left) / w) * 100}%`,
        top: String(card.style.top).includes('%') ? card.style.top : `${(parseFloat(card.style.top) / h) * 100}%`,
        angle: parseInt(card.dataset.angle) || 0, // ✨ 儲存旋轉角度
        meaning: tempCustomSpreadData.meanings[card.dataset.idx]
    }));

    let spreads = await DB.get('custom_spreads', []);

    if (editingSpreadIndex !== null) {
        spreads[editingSpreadIndex] = tempCustomSpreadData;
    } else {
        spreads.push(tempCustomSpreadData);
    }

    await DB.set('custom_spreads', spreads);
    if (typeof showToast === 'function') showToast('✅ 牌陣儲存成功！');
    await renderSpreadManageList();

    // ✨ 修復 3：「斷尾求生路由法」。刷新世代 Token 讓舊步驟全部失效，直接取代當下網址
    window.appSessionId = Date.now();
    history.replaceState({ screen: 'screen-spread-manage', sessionId: window.appSessionId }, '', '#screen-spread-manage');
    navTo('screen-spread-manage', false);
}

// ✨ 修復 3 補充：放棄編輯時，同樣使用斷尾求生法跳出
window.abortCustomSpread = function () {
    window.appSessionId = Date.now();
    history.replaceState({ screen: 'screen-spread-manage', sessionId: window.appSessionId }, '', '#screen-spread-manage');
    navTo('screen-spread-manage', false);
};

// ==========================================
// ✨ 核心修復：動態生成牌陣選擇 Modal 的內容
// ==========================================
async function updateSpreadSelectDropdown() {
    const grid = document.getElementById('spread-grid');
    if (!grid) return;

    grid.innerHTML = ''; // 清空舊內容

    // 1. 系統內建牌陣 (保留你原本精心修改的文案)
    const defaultSpreads = TAROT_SPREADS_CONFIG;
    // 2. 抓取你辛苦建立的「自訂牌陣」
    const customSpreads = await DB.get('custom_spreads', []);

    const allSpreads = [...defaultSpreads, ...customSpreads.map((s, idx) => ({
        id: `custom_saved_${idx}`,
        name: s.name,
        icon: s.icon || '✨',
        desc: `自訂牌陣 (${s.meanings ? s.meanings.length : s.positions.length} 張)`
    }))];

    // ✨ 魔法 1：從資料庫讀取「目前被鎖定的牌陣 ID 是誰」
    const lockedSpreadId = await DB.get('locked_spread_id', null);

    // 3. 把所有牌陣變成漂亮的大按鈕塞進 Modal 裡
    allSpreads.forEach(spread => {
        const btn = document.createElement('button');

        // 判斷這個按鈕是不是被鎖定的那個
        const isThisLocked = lockedSpreadId === spread.id;

        // ✨ 視覺升級：拔除錯誤的 hover 發光，沒鎖定的按鈕維持紫線就好！
        const borderClass = isThisLocked
            ? 'border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
            : 'border-purple-500 hover:border-purple-400';

        // 將 borderClass 動態塞入 className
        btn.className = `magic-btn py-3 px-2 flex flex-col items-center justify-center gap-1 w-[46%] bg-purple-900/60 transition-colors relative ${borderClass}`;

        const lockIcon = isThisLocked ? '🔒' : '🔓';
        // ✨ 鎖頭亮度與灰階設定
        const lockClass = isThisLocked
            ? "absolute top-1 right-1 text-sm opacity-100 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] scale-110 cursor-pointer p-1 z-20 brightness-125"
            : "absolute top-1 right-1 text-sm opacity-30 select-none cursor-pointer p-1 transition-all z-20 hover:opacity-80 grayscale";

        // ✨ 魔法 3：把鎖頭標籤 <span> 塞進 HTML 結構的最前面 (注意這裡用 window.toggleSpreadLock 避免找不到函數)
        btn.innerHTML = `
            <span class="${lockClass}" onclick="window.toggleSpreadLock(event, '${spread.id}', '${spread.icon}', '${spread.name}')">${lockIcon}</span>
            <span class="text-3xl mb-1">${spread.icon}</span>
            <span class="font-bold text-sm text-yellow-300 truncate w-full text-center">${spread.name}</span>
            <span class="text-[0.6rem] text-purple-200 text-center leading-tight">${spread.desc}</span>
        `;

        // 點擊後：設定全域變數、更改首頁顯示文字，並關閉 Modal (完全保留你原本的邏輯)
        btn.onclick = async () => {
            if (typeof currentSelectedSpread !== 'undefined') {
                currentSelectedSpread = spread.id;
            } else {
                window.currentSelectedSpread = spread.id;
            }

            // 你原先加上的歷史記憶
            await DB.set('last_spread_id', spread.id);

            if (typeof currentRitualData !== 'undefined') {
                currentRitualData.spread = spread.id;
            }

            const label = document.getElementById('setup-spread-label');
            const icon = document.getElementById('setup-spread-icon');

            if (label) label.innerText = spread.name;
            if (icon) icon.innerText = spread.icon;

            // ✨ 核心修復：交給 popstate 處理關閉
            const modal = document.getElementById('modal-spread');
            if (modal && !modal.classList.contains('hidden')) {
                history.back();
            }
        };
        grid.appendChild(btn);
    });
}

// ==========================================
// 模組 7: 解牌室與彈窗 (排版更新與依序翻牌)
// ==========================================
let readingScrollPos = 0; // 新增全域變數記錄滾動高度
let currentRitualData = {}; let currentViewingRecordId = null;

// ✨ 支援「動態自訂牌陣」的擴充版字典 (徹底修復快取延遲問題)
function getSpreadSlotName(spreadType, index, customSpreads = []) {
    const defaultSlotNames = {
        'single': ['單牌神諭'],
        'triangle': ['過去', '現在', '未來'],
        'five': ['過去', '近過去', '現在', '近未來', '未來'],
        'hexagram': ['過去', '現在', '未來', '環境', '內心', '對策', '結果'],
        'two_paths': ['現狀', '選擇 A 的現況/過程', '選擇 A 的未來結果', '選擇 B 的現況/過程', '選擇 B 的未來結果'],
        'tree_of_life': ['王冠 (最高意志/靈性)', '智慧 (原動力/啟發)', '理解 (形式/限制)', '慈悲 (擴張/恩賜)', '嚴厲 (破壞/力量)', '美麗 (核心/和諧)', '勝利 (情感/直覺)', '榮耀 (理智/邏輯)', '基礎 (潛意識/根基)', '王國 (現實顯化/結果)'],
        'celtic': ['現狀', '阻礙與挑戰 (橫放)', '潛意識的根源', '過去的影響', '意識與目標', '未來的發展', '自我態度', '周遭環境影響', '希望與恐懼', '最終結果'],
        'horseshoe': ['過去', '現在', '隱藏的影響', '阻礙/挑戰', '周遭環境', '最佳行動/建議', '最終結果'],
        'zodiac': ['本命/自我 (牡羊)', '財富/價值 (金牛)', '溝通/學習 (雙子)', '家庭/根基 (巨蟹)', '創造/戀愛 (獅子)', '健康/工作 (處女)', '伴侶/合作 (天秤)', '偏財/蛻變 (天蠍)', '進修/遠行 (射手)', '事業/地位 (魔羯)', '人際/願景 (水瓶)', '潛意識/隱藏 (雙魚)'],
        'romany': Array.from({ length: 21 }, (_, i) => i < 7 ? `過去 ${i + 1}` : (i < 14 ? `現在 ${i - 6}` : `未來 ${i - 13}`)),
        'tableau': Array.from({ length: 36 }, (_, i) => `第 ${i + 1} 宮`),
    };

    if (defaultSlotNames[spreadType] && defaultSlotNames[spreadType][index]) {
        return defaultSlotNames[spreadType][index];
    }

    if (spreadType.startsWith('custom_saved_')) {
        const customIndex = parseInt(spreadType.replace('custom_saved_', ''));
        if (customSpreads && customSpreads[customIndex]) {
            const spreadData = customSpreads[customIndex];
            if (spreadData.meanings && spreadData.meanings[index]) {
                return spreadData.meanings[index];
            } else if (spreadData.positions && spreadData.positions[index] && spreadData.positions[index].meaning) {
                return spreadData.positions[index].meaning;
            }
        }
    }

    // ✨ 動態自訂抽牌，直接返回編號
    if (spreadType.startsWith('custom_dynamic_')) {
        return `第 ${index + 1} 張`;
    }

    return `第 ${index + 1} 張`;
}

async function renderReadingRoom(recordData, isNewRitual) {
    window.isReadingImageMode = recordData.cards.length < 6;
    const isSingle = recordData.spread === 'single';

    // ✨ 終極防護：只要是新抽的牌，一進來就立刻上鎖！沒收使用者的返回鍵！
    if (isNewRitual) {
        if (typeof isCardRevealing !== 'undefined') isCardRevealing = true;
    }

    // ✨ 微調 1：不要隱藏標題，而是動態切換標題文字，保持版面平衡
    const titleEl = document.getElementById('reading-title');
    if (titleEl) {
        titleEl.classList.remove('hidden');
        titleEl.innerText = isNewRitual ? '🔮 塔羅占卜結果' : recordData.date;
    }

    document.getElementById('reading-question').innerText = '';

    // ✨ 在問題下方動態加入「主牌組名稱」的標籤
    let deckLabel = document.getElementById('reading-deck-label');
    if (!deckLabel) {
        deckLabel = document.createElement('div');
        deckLabel.id = 'reading-deck-label';
        deckLabel.className = 'text-center text-blue-300 text-xs -mt-5 mb-3 font-bold tracking-widest shrink-0 bg-blue-900/30 py-1 px-3 rounded-full border border-blue-500/50 w-max mx-auto shadow-md';
        const qEl = document.getElementById('reading-question');
        if (qEl) qEl.after(deckLabel);
    }
    deckLabel.innerText = recordData.mainDeckName ? `🔮 主牌組：${recordData.mainDeckName}` : '🔮 主牌組：預設牌組';

    const readingScreen = document.getElementById('screen-reading');
    readingScreen.classList.add('bg-black/85', 'backdrop-blur-lg');
    readingScreen.classList.remove('bg-transparent', 'reading-room-fade');

    const spreadContainer = document.getElementById('reading-spread');
    spreadContainer.innerHTML = '';

    const positions = await getSpreadPositionsPercentages(recordData.spread);
    const bgImg = await DB.get('cardback', 'assets/cards/cardback.jpg');
    const customSpreads = await DB.get('custom_spreads', []);

    // 預設的基礎樣式 (強制套用 aspect-[3/4] 讓解牌室的比例與編輯器一模一樣)
    spreadContainer.className = "history-spread-container bg-transparent relative mx-auto w-full aspect-[3/4] max-w-md origin-top transition-transform duration-500";

    recordData.cards.forEach((c, index) => {
        const cDiv = document.createElement('div');
        cDiv.className = 'history-card cursor-pointer';

        // 取得該牌的預定座標
        const pos = isSingle ? { left: '50%', top: '43%' } : (positions[c.slotIndex] || { left: '50%', top: '50%' });

        if (isSingle) {
            cDiv.style.cssText = "position: absolute !important; left: 50% !important; top: 43% !important; width: 140px !important; height: 245px !important; transform: translate(-50%, -50%) !important; display: flex !important; opacity: 1 !important;";
        } else {
            cDiv.style.left = pos.left;
            cDiv.style.top = pos.top;
            const angle = pos.angle || 0;
            cDiv.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        }

        // 深度排序 (Y-Sorting)
        const topVal = parseFloat(pos.top) || 50;
        const baseZIndex = isSingle ? 9999 : Math.floor(500 - topVal);
        cDiv.style.zIndex = baseZIndex;
        cDiv.dataset.baseZ = baseZIndex;

        // 手機觸控支援
        cDiv.onmouseenter = () => cDiv.style.zIndex = '9999';
        cDiv.onmouseleave = () => cDiv.style.zIndex = baseZIndex;
        cDiv.ontouchstart = () => {
            document.querySelectorAll('.history-card').forEach(el => {
                el.style.zIndex = el.dataset.baseZ || '5';
            });
            cDiv.style.zIndex = '9999';
        };

        // --- 核心變數準備區 ---
        const deckKey = c.image.match(/assets\/([^\/]+)\//) ? c.image.match(/assets\/([^\/]+)\//)[1] : 'cards';
        const displayCardName = (deckKey === 'thoth' && typeof translateCardName === 'function') ? translateCardName(c.name, deckKey) : c.name;
        
        // ✨ 計算位置名稱
        const meaning = isSingle ? '' : getSpreadSlotName(recordData.spread, c.slotIndex, customSpreads);
        
        // 綁定點擊彈窗事件
        cDiv.onclick = () => {
            if (typeof openCardMeaning === 'function') {
                openCardMeaning(c.id, c.isReversed, c.image, displayCardName.replace('\n', ' '), meaning);
            }
        };

        const isFlipped = !isNewRitual;
        const flipStyle = isFlipped ? 'transform: rotateY(180deg);' : '';
        const imgFlipStyle = c.isReversed ? 'transform: rotateY(180deg) rotateZ(180deg);' : 'transform: rotateY(180deg);';

        // ✨ 確保 cleanName 存在
        const cleanName = displayCardName.replace(/(大|小)阿爾克那\s*[-・]?\s*/g, '').trim();

        // 正逆位與同列顯示邏輯
        const isThoth = deckKey === 'thoth';
        const orientationText = c.isReversed ? '(逆)' : '(正)';
        const orientationColor = c.isReversed ? 'text-red-400' : 'text-green-400';
        
        const orientationHtmlImageMode = isThoth ? '' : `<span class="${orientationColor} ml-0.5">${orientationText}</span>`;
        const orientationHtmlTextMode = isThoth ? '' : ` <span class="${orientationColor}">${orientationText}</span>`;

        const singleSupplements = (recordData.crossDraws || []).filter(d => d.type === 'single' && d.slotIndex === c.slotIndex);
        const fullLayers = (recordData.crossDraws || []).filter(d => d.type === 'full');

        // 雙按鈕防呆設計
        const localSingleBtn = singleSupplements.length > 0 ? `<button id="local-single-toggle-${c.slotIndex}" data-current-idx="0" onclick="toggleSingleSlot(event, ${c.slotIndex})" class="absolute -top-3 -right-3 w-7 h-7 bg-emerald-600 border border-emerald-300 text-white rounded-full text-[10px] z-50 shadow-md font-bold transition-all">➕</button>` : '';
        const localFullBtn = fullLayers.length > 0 ? `<button id="local-full-toggle-${c.slotIndex}" data-current-idx="0" onclick="toggleLocalFullLayer(event, ${c.slotIndex})" class="absolute -top-3 -left-3 w-7 h-7 bg-purple-600 border border-purple-300 text-white rounded-full text-[10px] z-50 shadow-md font-bold transition-all">🌌</button>` : '';

        // 抓取牌組名稱縮寫
        const deckNames = { 'cards': '偉特', 'thoth': '托特', 'anime': '動漫' };
        const deckNameShort = deckNames[deckKey] || '自訂';

        // 組合卡牌內部 HTML
        cDiv.innerHTML = `
    <div class="flex flex-col items-center w-full h-full relative">
        ${localFullBtn}
        ${localSingleBtn}
        <div class="text-xs sm:text-sm text-yellow-300 font-bold mb-1 opacity-80 transition-opacity duration-1000 ${isNewRitual && isSingle ? 'opacity-0' : ''}" id="reading-label-${c.slotIndex}">${meaning}</div>
        
        <div id="reading-flip-${c.slotIndex}" class="relative w-full aspect-[60/105] shadow-lg rounded-md transition-transform duration-700" style="transform-style: preserve-3d; ${flipStyle}">
            <div class="absolute inset-0 bg-cover bg-center rounded-md border border-purple-400" style="backface-visibility: hidden; background-image: url('${bgImg}')"></div>
            <div class="absolute inset-0 bg-cover bg-center rounded-md border-2 border-yellow-400" style="backface-visibility: hidden; background-image: url('${c.image}'); ${imgFlipStyle}"></div>
        </div>
        
        <div class="mt-1 flex flex-col items-center transition-opacity duration-1000 bg-black/70 px-2 py-1 rounded-md backdrop-blur-sm border border-purple-500/30 shadow-md ${isNewRitual && isSingle ? 'opacity-0' : ''}" id="reading-text-${c.slotIndex}">
            <span class="text-[0.65rem] sm:text-sm font-bold text-white truncate max-w-[85px] image-mode-text whitespace-nowrap">${cleanName}${orientationHtmlImageMode}</span>
            <span class="text-xs sm:text-sm font-bold text-white whitespace-nowrap text-mode-text hidden flex-col items-center gap-0.5">
                <span class="text-yellow-300 opacity-80">${meaning}</span>
                <span class="text-[0.65rem] text-blue-300 font-bold tracking-widest">［${deckNameShort}］</span>
                <span>${cleanName}${orientationHtmlTextMode}</span>
            </span>
        </div>
    </div>`;
        spreadContainer.appendChild(cDiv);

        if (isNewRitual) {
            if (isSingle) {
                setTimeout(() => {
                    const flipEl = document.getElementById(`reading-flip-${c.slotIndex}`);
                    if (flipEl) flipEl.style.transform = 'rotateY(180deg)';
                    document.getElementById(`reading-label-${c.slotIndex}`)?.classList.remove('opacity-0');
                    document.getElementById(`reading-text-${c.slotIndex}`)?.classList.remove('opacity-0');
                    setTimeout(() => {
                        openCardMeaning(c.id, c.isReversed, c.image, displayCardName.replace('\n', ' '), meaning);
                        if (typeof isCardRevealing !== 'undefined') isCardRevealing = false;
                    }, 700);
                }, 100);
            } else {
                setTimeout(() => {
                    const flipEl = document.getElementById(`reading-flip-${c.slotIndex}`);
                    if (flipEl) flipEl.style.transform = 'rotateY(180deg)';
                    if (index === recordData.cards.length - 1) {
                        setTimeout(() => {
                            if (typeof isCardRevealing !== 'undefined') isCardRevealing = false;
                        }, 700);
                    }
                }, 800 + index * 600);
            }
        }
    });

    spreadContainer.className = "history-spread-container bg-transparent relative mx-auto w-full aspect-[3/4] max-w-md origin-center scale-95 sm:scale-100";

    const scrollArea = document.getElementById('reading-scroll-area');
    scrollArea.innerHTML = '';
    const spreadWrapper = document.createElement('div');
    spreadWrapper.className = 'w-full flex justify-center items-center pt-2 pb-10';
    spreadWrapper.appendChild(spreadContainer);
    scrollArea.appendChild(spreadWrapper);

    const footerNotes = document.getElementById('reading-footer-notes');
    if (footerNotes) {
        footerNotes.innerHTML = `
            <div id="notes-accordion-container" class="bg-purple-900/85 backdrop-blur-md rounded-xl border border-purple-400 shadow-[0_-10px_30px_rgba(0,0,0,0.4)] transition-all overflow-hidden">
                <div class="p-3 flex justify-between items-center cursor-pointer hover:bg-purple-800/80" onclick="toggleNotesAccordion()">
                    <span class="text-yellow-300 font-bold text-xs sm:text-sm tracking-wide">📝 檢視問題與備註</span>
                    <span id="accordion-icon" class="text-purple-300 font-bold text-xs transition-transform">▼</span>
                </div>
                <div id="notes-accordion-content" class="hidden p-3 border-t border-purple-500/50 flex-col gap-3 bg-black/30">
                    <div>
                        <p class="text-yellow-300 font-bold text-xs mb-1">📌 你的問題</p>
                        <p class="text-purple-100 text-xs sm:text-sm leading-relaxed">${recordData.question}</p>
                    </div>
                    <div>
                        <label class="block text-yellow-300 font-bold text-xs mb-1">📝 解讀備註</label>
                        <!-- ✨ 微調 2：補上 recordData.notes，這樣瀏覽舊紀錄時備註才不會消失！ -->
                        <textarea id="reading-notes-input" class="magic-input h-20 text-xs sm:text-sm p-2">${recordData.notes || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    const oldFab = document.getElementById('floating-cross-draw-container');
    if (oldFab) oldFab.remove();

    const fabContainer = document.createElement('div');
    fabContainer.id = 'floating-cross-draw-container';
    fabContainer.className = 'fixed bottom-24 right-4 flex flex-col items-center gap-3 z-[100]';

    const hasFullCrossDraw = recordData.crossDraws && recordData.crossDraws.some(d => d.type === 'full');
    let fabHTML = '';
    if (hasFullCrossDraw) {
        fabHTML += `<button id="fab-toggle-full" onclick="toggleFullSpreadLayer()" class="w-10 h-10 bg-emerald-600 border-2 border-emerald-300 text-white rounded-full shadow-[0_0_15px_rgba(5,150,105,0.8)] flex items-center justify-center text-lg hover:scale-110 transition-transform active:scale-95 font-bold" title="切換全陣">🔄</button>`;
    }
    fabHTML += `<button onclick="toggleCardViewMode()" class="w-10 h-10 bg-blue-600 border-2 border-blue-300 text-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.8)] flex items-center justify-center text-lg hover:scale-110 transition-transform active:scale-95 font-bold" title="切換圖文">👁️</button>`;
    fabHTML += `<button onclick="openCrossDrawModal()" class="w-14 h-14 bg-purple-600 border-2 border-purple-300 text-white rounded-full shadow-[0_0_15px_rgba(147,51,234,0.8)] flex items-center justify-center text-2xl hover:scale-110 transition-transform active:scale-95" title="跨牌 / 補充神諭">➕</button>`;

    fabContainer.innerHTML = fabHTML;
    document.getElementById('screen-reading').appendChild(fabContainer);

    const btnContainer = document.getElementById('reading-buttons');
    if (isNewRitual) {
        setTimeout(async () => {
            let history = await DB.get('history', []);
            if (!history.find(r => r.id === recordData.id)) {
                history.unshift(recordData);
                await DB.set('history', history);
                if (typeof showToast === 'function') showToast('💾 占卜結果已自動存檔！');
            }
        }, 1000);

        btnContainer.innerHTML = `
            <button onclick="discardRitual()" class="magic-btn py-2 px-4 text-xs bg-red-800 border-red-400 shrink-0">離開</button>
            <button onclick="copyReadingResults()" class="magic-btn py-2 px-4 text-xs bg-blue-700 border-blue-400 text-white shrink-0">📋 複製</button>
            <button onclick="updateNotesAndExit()" class="magic-btn py-2 px-2 text-xs text-yellow-300 border-yellow-300 flex-1 whitespace-nowrap">💾 儲存&結束</button>
        `;
        if (typeof BL !== 'undefined') BL.show('read_card');
    } else {
        btnContainer.innerHTML = `
            <button onclick="navTo('screen-history')" class="magic-btn py-2 px-4 text-xs bg-gray-700 shrink-0">返回</button>
            <button onclick="copyReadingResults()" class="magic-btn py-2 px-4 text-xs bg-blue-700 border-blue-400 text-white shrink-0">📋 複製</button>
            <button onclick="deleteCurrentRecord()" class="magic-btn py-2 px-4 text-xs bg-red-800 border-red-500 shrink-0">🗑️ 刪除</button>
            <button onclick="saveCurrentNotesFromInput()" class="magic-btn py-2 px-2 text-xs text-yellow-300 border-yellow-300 flex-1 whitespace-nowrap">💾 更新備註</button>
        `;
    }

    const finalContainer = document.getElementById('reading-spread');
    if (finalContainer) {
        if (!window.isReadingImageMode) finalContainer.classList.add('text-only-mode');
        else finalContainer.classList.remove('text-only-mode');
    }
    navTo('screen-reading');
}

// ✨ 圖文模式切換器
window.toggleCardViewMode = function () {
    window.isReadingImageMode = !window.isReadingImageMode;
    const container = document.getElementById('reading-spread');
    if (container) {
        if (window.isReadingImageMode) {
            container.classList.remove('text-only-mode');
            if (typeof showToast === 'function') showToast('🖼️ 已切換為：牌面模式');
        } else {
            container.classList.add('text-only-mode');
            if (typeof showToast === 'function') showToast('📝 已切換為：文字模式');
        }
    }
};

// ✨ 修正版：自然吸底展開，無需複雜滾動計算
function toggleNotesAccordion() {
    const content = document.getElementById('notes-accordion-content');
    const icon = document.getElementById('accordion-icon');
    const scrollArea = document.getElementById('reading-scroll-area');

    if (content.classList.contains('hidden')) {
        // 展開
        content.classList.remove('hidden');
        content.classList.add('flex');
        icon.innerText = '▲';
        // 展開後稍微滾到底部，確保備註輸入框不會被手機鍵盤擋住
        setTimeout(() => {
            scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
        }, 50);
    } else {
        // 縮起
        content.classList.add('hidden');
        content.classList.remove('flex');
        icon.innerText = '▼';
    }
}

// 搭配新架構的儲存函數
async function saveRitualToHistoryFromInput() {
    let history = await DB.get('history', []);
    currentRitualData.notes = document.getElementById('reading-notes-input').value;
    history.unshift(currentRitualData);
    await DB.set('history', history);

    if (typeof showAlert === 'function') {
        showAlert('📜 占卜紀錄已儲存！');
    }

    // 延遲 0.8 秒讓使用者看清提示，接著直接刷新，絕不執行 navTo 回首頁
    setTimeout(() => {
        isRitualActive = false;
        window.location.href = window.location.origin + window.location.pathname;
    }, 800);
}

async function saveCurrentNotesFromInput() {
    let history = await DB.get('history', []);
    const index = history.findIndex(r => r.id === currentViewingRecordId);
    if (index !== -1) {
        history[index].notes = document.getElementById('reading-notes-input').value;
        await DB.set('history', history);
        showAlert('備註已儲存！');
    }
}

async function openCardMeaning(id, isRev, imgUrl, fullTitle, positionName = '') {
    history.pushState({ modal: 'meaning' }, '', location.hash);

    // 1. 清除呼吸燈提示並獲取 Modal 實體
    if (typeof BL !== 'undefined') {
        BL.clearAction('read_card');
        BL.clear();
    }
    const modal = document.getElementById('card-meaning-modal');
    if (!modal) return;

    // 2. 處理標題與圖片 (✨ 融合位置標籤邏輯)
    const baseTitle = fullTitle.replace(/\n/g, ' ');
    const titleEl = document.getElementById('meaning-card-title');
    titleEl.innerText = baseTitle; // 標題恢復乾淨的牌名，不混雜位置資訊

    const cardImgEl = document.getElementById('meaning-card-img');
    if (cardImgEl) {
        cardImgEl.style.backgroundImage = `url(${imgUrl})`;
        cardImgEl.style.transform = isRev ? 'rotate(180deg)' : 'rotate(0deg)';

        const imgContainer = cardImgEl.parentElement;
        
        // ✨ 修改 1：將圖片的父容器改為垂直排列 (flex-col) 且水平置中
        imgContainer.classList.add('flex-col', 'items-center');

        let posLabel = document.getElementById('meaning-dynamic-position');
        
        if (positionName) {
            if (!posLabel) {
                posLabel = document.createElement('div');
                posLabel.id = 'meaning-dynamic-position';
                // ✨ 修改 2：拔除 absolute，改為自然排版，並加上 mb-3 與圖片保持完美間距
                posLabel.className = 'text-sm text-yellow-300 tracking-widest font-bold bg-black/80 px-4 py-1.5 rounded-full border border-yellow-500/50 shadow-md whitespace-nowrap mb-3 z-10';
                
                // ✨ 修改 3：將這個標籤「插入」到卡牌圖片的上方
                imgContainer.insertBefore(posLabel, cardImgEl);
            }
            posLabel.innerText = `【${positionName}】`;
        } else {
            if (posLabel) posLabel.remove(); // 如果是單牌神諭沒有位置，則安全移除
        }

        // 新增：為卡牌圖片加上點擊放大的游標與事件
        cardImgEl.style.cursor = 'zoom-in';
        cardImgEl.onclick = (e) => {
            if (typeof window.openEnlargedImage === 'function') {
                window.openEnlargedImage(e, imgUrl, isRev);
            }
        };
    }

    // 3. 設定正逆位標籤樣式：透過圖片路徑判斷是否為托特牌，托特牌則徹底隱藏正逆位標籤
    const deckKey = imgUrl.match(/assets\/([^\/]+)\//) ? imgUrl.match(/assets\/([^\/]+)\//)[1] : 'cards';
    const orientationEl = document.getElementById('meaning-card-orientation');
    if (orientationEl) {
        if (deckKey === 'thoth') {
            orientationEl.style.display = 'none'; // 隱藏標籤
        } else {
            orientationEl.style.display = 'inline-block'; // 恢復顯示 (避免被前一張牌影響)
            orientationEl.innerText = isRev ? "【逆位解析】" : "【正位解析】";
            orientationEl.className = `text-sm px-3 py-1 rounded bg-black/60 mt-2 font-bold tracking-widest ${isRev ? 'text-red-400' : 'text-green-400'}`;
        }
    }

    // 4. 動態讀取對應主題的系統牌義
    const currentTheme = await DB.get('deck_theme', 'cards');
    const activeDefaultMeanings = currentTheme === 'thoth' ? ThothMeanings : DefaultMeanings;

    const dbBuiltin = await DB.get('meanings_builtin', {});
    const lsBuiltin = JSON.parse(localStorage.getItem('tarot_meanings_builtin') || '{}');
    const dictEntry = dbBuiltin[id] || lsBuiltin[id] || activeDefaultMeanings[id];

    let defMeaning = "目前尚無此牌組的內建解析。";
    if (dictEntry) {
        if (typeof dictEntry === 'string') {
            defMeaning = dictEntry;
        } else {
            defMeaning = isRev ? (dictEntry.reversed || "（暫無逆位解析）") : (dictEntry.upright || "（暫無正位解析）");
        }
    }
    document.getElementById('meaning-default-text').innerText = defMeaning;

    // 5. 讀取個人自訂備註
    const dbCustom = await DB.get('meanings_custom', {});
    const lsCustom = JSON.parse(localStorage.getItem('tarot_meanings_custom') || '{}');
    const customText = dbCustom[id] || lsCustom[id] || "";

    const customDisplayEl = document.getElementById('meaning-custom-text');
    if (customDisplayEl) {
        customDisplayEl.innerText = customText || "（尚未新增個人註解）";
    }

    // 🎯 A. 處理擴充牌義區塊的自動隱藏
    const extendedSection = document.getElementById('meaning-custom-section');
    if (extendedSection) {
        if (!customText.trim()) {
            extendedSection.classList.add('hidden');
        } else {
            extendedSection.classList.remove('hidden');
        }
    }

    // 🎯 B. 建立上下滾動的閃爍示意箭頭
    const modalEl = document.getElementById('card-meaning-modal');
    const scrollContainer = modalEl.querySelector('.overflow-y-auto') || modalEl;

    if (scrollContainer) {
        let arrowUp = document.getElementById('modal-scroll-arrow-up');
        if (!arrowUp) {
            arrowUp = document.createElement('div');
            arrowUp.id = 'modal-scroll-arrow-up';
            arrowUp.className = 'fixed bottom-20 right-3 text-yellow-400 font-bold text-2xl animate-pulse cursor-pointer z-[2500] hidden drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] bg-black/50 w-10 h-10 flex items-center justify-center rounded-full border border-yellow-500/30';
            arrowUp.innerText = '▲';
            modalEl.appendChild(arrowUp);
        }
        arrowUp.onclick = (e) => {
            e.stopPropagation();
            scrollContainer.scrollBy({ top: -250, behavior: 'smooth' });
        };

        let arrowDown = document.getElementById('modal-scroll-arrow-down');
        if (!arrowDown) {
            arrowDown = document.createElement('div');
            arrowDown.id = 'modal-scroll-arrow-down';
            arrowDown.className = 'fixed bottom-6 right-3 text-yellow-400 font-bold text-2xl animate-pulse cursor-pointer z-[2500] hidden drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] bg-black/50 w-10 h-10 flex items-center justify-center rounded-full border border-yellow-500/30';
            arrowDown.innerText = '▼';
            modalEl.appendChild(arrowDown);
        }
        arrowDown.onclick = (e) => {
            e.stopPropagation();
            scrollContainer.scrollBy({ top: 250, behavior: 'smooth' });
        };

        const checkModalScrollStatus = () => {
            const scrollTop = scrollContainer.scrollTop;
            const scrollHeight = scrollContainer.scrollHeight;
            const clientHeight = scrollContainer.clientHeight;

            if (scrollTop > 15) {
                arrowUp.classList.remove('hidden');
            } else {
                arrowUp.classList.add('hidden');
            }

            if (scrollHeight - scrollTop > clientHeight + 10) {
                arrowDown.classList.remove('hidden');
            } else {
                arrowDown.classList.add('hidden');
            }
        };

        scrollContainer.onscroll = checkModalScrollStatus;
        setTimeout(checkModalScrollStatus, 150);
    }

    if (extendedSection) {
        if (!customText || customText.trim() === "") {
            extendedSection.style.display = 'none';
        } else {
            extendedSection.style.display = 'block';
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeCardMeaning() {
    const modal = document.getElementById('card-meaning-modal');
    if (!modal) return;

    const handleFadeEnd = (e) => {
        // 確保監聽的是外層 modal 的 opacity 漸隱動畫
        if (e.propertyName === 'opacity') {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            modal.removeEventListener('transitionend', handleFadeEnd);
        }
    };

    modal.addEventListener('transitionend', handleFadeEnd);
    modal.classList.remove('active'); // 讓 CSS 開始跑不透明度降到 0 的動畫

    // ✨ 防呆機制：如果瀏覽器卡頓沒觸發事件，350ms 後強制關閉，絕不卡死
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }, 350);
}

async function getSpreadPositionsPercentages(type, context = 'reading') {
    // ✨ 專門給「多重單張補充神諭」使用的動態座標 (自動排成置中網格)
    if (type === 'multi_cross') {
        const count = window.crossDrawState ? window.crossDrawState.slotIndices.length : 1;
        const pos = [];
        const maxCols = Math.min(count, 3);
        const rows = Math.ceil(count / maxCols);

        for (let i = 0; i < count; i++) {
            const r = Math.floor(i / maxCols);
            const c = i % maxCols;
            const itemsInRow = (r === rows - 1 && count % maxCols !== 0) ? count % maxCols : maxCols;
            const startX = 50 - ((itemsInRow - 1) * 15); // 15% 橫向間距
            pos.push({
                left: `${startX + c * 30}%`,
                top: `${40 + r * 25}%` // 25% 直向間距
            });
        }
        return pos;
    }
    // ✨ 動態自訂張數的智慧網格引擎
    if (type.startsWith('custom_dynamic_')) {
        const count = parseInt(type.replace('custom_dynamic_', ''));
        const pos = [];
        
        // 智慧網格排版邏輯，確保不會超出畫面邊界
        const maxCols = Math.ceil(Math.sqrt(count * 0.75)); 
        const cols = Math.min(count, maxCols < 3 ? 3 : (maxCols > 8 ? 8 : maxCols)); 
        const rows = Math.ceil(count / cols);

        for (let i = 0; i < count; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const itemsInRow = (r === rows - 1 && count % cols !== 0) ? count % cols : cols;
            
            // 決定計算的可用邊界範圍
            const safeWidth = context === 'radar' ? 90 : 85;
            const safeHeight = context === 'radar' ? 80 : 75;

            const effectiveSpacingX = Math.min(25, safeWidth / cols);
            const effectiveSpacingY = Math.min(30, safeHeight / rows);
            
            const startX = 50 - ((itemsInRow - 1) * effectiveSpacingX / 2); 
            const startY = (context === 'radar' ? 50 : 45) - ((rows - 1) * effectiveSpacingY / 2);
            
            pos.push({
                left: `${startX + c * effectiveSpacingX}%`,
                top: `${startY + r * effectiveSpacingY}%`
            });
        }
        return pos;
    }
    if (type.startsWith('custom_saved_')) {
        const index = parseInt(type.replace('custom_saved_', ''));
        const spreads = await DB.get('custom_spreads', []); // ✨
        if (spreads[index]) return spreads[index].positions;
    }
    if (type === 'single') return [
        { left: '50%', top: '40%' }
    ];
    if (type === 'triangle') return [
        { left: '50%', top: '10%' },
        { left: '30%', top: '40%' },
        { left: '70%', top: '40%' }
    ];
    if (type === 'five') return [
        { left: '10%', top: '30%' },
        { left: '30%', top: '30%' },
        { left: '50%', top: '30%' },
        { left: '70%', top: '30%' },
        { left: '90%', top: '30%' }
    ];
    // 2. 修改歷史紀錄介面的百分比 (在 function getSpreadPositionsPercentages 裡面)
    if (type === 'hexagram') {
        if (context === 'radar') {
            // 🎯 給「選牌雷達」用的：緊湊、對稱、不超過 100% 邊界
            return [
                { left: '50%', top: '22%' }, // 第 1 張：上
                { left: '22%', top: '64%' }, // 第 2 張：左下
                { left: '78%', top: '64%' }, // 第 3 張：右下
                { left: '50%', top: '78%' }, // 第 4 張：下
                { left: '22%', top: '36%' }, // 第 5 張：右上
                { left: '78%', top: '36%' }, // 第 6 張：右上
                { left: '50%', top: '50%' }  // 第 7 張：中心
            ];
        } else {
            // 📖 給「解牌室」用的：你原本調整好的完美擴張版
            return [
                { left: '50%', top: '12%' },  // 第 1 張：上
                { left: '30%', top: '65%' },  // 第 2 張：左下
                { left: '70%', top: '65%' },  // 第 3 張：右下
                { left: '50%', top: '79%' },  // 第 4 張：下
                { left: '30%', top: '30%' },  // 第 5 張：左上
                { left: '70%', top: '30%' },  // 第 6 張：右上
                { left: '50%', top: '46%' }   // 第 7 張：中
            ];
        }
    }

    if (type === 'two_paths') return [
        { left: '50%', top: '80%' },  // 第 1 張：現狀 (最下方中央)
        { left: '25%', top: '50%' },  // 第 2 張：A 過程 (左中)
        { left: '15%', top: '20%' },  // 第 3 張：A 結果 (左上)
        { left: '75%', top: '50%' },  // 第 4 張：B 過程 (右中)
        { left: '85%', top: '20%' }   // 第 5 張：B 結果 (右上)
    ];
    if (type === 'tree_of_life') return [
        { left: '50%', top: '5%' },   // 1. Kether (頂端中心)
        { left: '75%', top: '18%' },  // 2. Chokhmah (右上)
        { left: '25%', top: '18%' },  // 3. Binah (左上)
        { left: '75%', top: '40%' },  // 4. Chesed (右中)
        { left: '25%', top: '40%' },  // 5. Geburah (左中)
        { left: '50%', top: '50%' },  // 6. Tiphereth (正中心)
        { left: '75%', top: '72%' },  // 7. Netzach (右下)
        { left: '25%', top: '72%' },  // 8. Hod (左下)
        { left: '50%', top: '85%' },  // 9. Yesod (中軸偏下)
        { left: '50%', top: '105%' }  // 10. Malkuth (最底端物質界)
    ];
    if (type === 'celtic') return [
        { left: '35%', top: '50%' },             // 1: 現狀 (十字中心)
        { left: '35%', top: '50%', angle: 90 },  // 2: 阻礙 (橫壓在第 1 張上面，angle: 90)
        { left: '35%', top: '85%' },             // 3: 潛意識 (十字下方)
        { left: '10%', top: '50%' },             // 4: 過去 (十字左方)
        { left: '35%', top: '15%' },             // 5: 意識 (十字上方)
        { left: '60%', top: '50%' },             // 6: 未來 (十字右方)
        { left: '85%', top: '85%' },             // 7: 自我 (右側柱子最底)
        { left: '85%', top: '62%' },             // 8: 環境 (右側柱子下中)
        { left: '85%', top: '38%' },             // 9: 希望/恐懼 (右側柱子上中)
        { left: '85%', top: '15%' }              // 10: 結果 (右側柱子頂端)
    ];
    if (type === 'horseshoe') return [
        { left: '15%', top: '25%' },  // 1: 過去 (左上)
        { left: '15%', top: '60%' },  // 2: 現在 (左下)
        { left: '35%', top: '85%' },  // 3: 隱藏影響 (中左底)
        { left: '50%', top: '95%' },  // 4: 阻礙 (正中央底部)
        { left: '65%', top: '85%' },  // 5: 周遭環境 (中右底)
        { left: '85%', top: '60%' },  // 6: 最佳行動 (右下)
        { left: '85%', top: '25%' }   // 7: 最終結果 (右上)
    ];

    if (type === 'zodiac') {
        if (context === 'radar') {
            // 雷達用：略為縮小的圓形
            return [
                { left: '15%', top: '50%' }, { left: '22%', top: '70%' }, { left: '35%', top: '85%' }, { left: '50%', top: '90%' },
                { left: '65%', top: '85%' }, { left: '78%', top: '70%' }, { left: '85%', top: '50%' }, { left: '78%', top: '30%' },
                { left: '65%', top: '15%' }, { left: '50%', top: '10%' }, { left: '35%', top: '15%' }, { left: '22%', top: '30%' }
            ];
        } else {
            // 解牌室用：完美的大圓形 (類似時鐘，從 9 點鐘方向逆時針排列，符合占星命盤傳統)
            return [
                { left: '12%', top: '50%' },  // 1宮 (9點鐘)
                { left: '18%', top: '80%' },  // 2宮 (8點鐘)
                { left: '32%', top: '105%' }, // 3宮 (7點鐘)
                { left: '50%', top: '115%' }, // 4宮 (6點鐘)
                { left: '68%', top: '105%' }, // 5宮 (5點鐘)
                { left: '82%', top: '80%' },  // 6宮 (4點鐘)
                { left: '88%', top: '50%' },  // 7宮 (3點鐘)
                { left: '82%', top: '20%' },  // 8宮 (2點鐘)
                { left: '68%', top: '-5%' },  // 9宮 (1點鐘)
                { left: '50%', top: '-15%' }, // 10宮 (12點鐘)
                { left: '32%', top: '-5%' },  // 11宮 (11點鐘)
                { left: '18%', top: '20%' }   // 12宮 (10點鐘)
            ];
        }
    }
    if (type === 'romany') {
        const pos = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 7; col++) {
                pos.push({ left: `${8 + col * 14}%`, top: `${20 + row * 30}%` });
            }
        }
        return pos;
    }

    if (type === 'tableau') {
        const pos = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 9; col++) {
                // 9 欄 4 列的超密集排版
                pos.push({ left: `${5 + col * 11.25}%`, top: `${15 + row * 25}%` });
            }
        }
        return pos;
    }
    return [];
}

function endRitualAndCleanUp() {
    isRitualActive = false; // ✨ 標記儀式結束，解除防護罩！

    if (typeof BL !== 'undefined') {
        BL.clear();
    }

    // ✨ 完整清除雷達圖層的殘留樣式與外框
    const spreadLayer = document.getElementById('spread-layer');
    if (spreadLayer) {
        spreadLayer.innerHTML = '';
        spreadLayer.className = ''; // 徹底拔除雷達的 class (邊框)
        spreadLayer.style.display = 'none';
        spreadLayer.style.opacity = '0';
    }

    Matter.Composite.clear(world);

    if (typeof BL !== 'undefined' && (typeof currentState === 'undefined' || currentState !== 'SELECTING')) {
        BL.clear();
        const boundaryEl = document.getElementById('selection-boundary');
        if (boundaryEl) {
            boundaryEl.style.opacity = '0';
            boundaryEl.style.display = 'none';
        }

        // ✨ 確保下方的選牌按鈕也被藏起來
        const drawUi = document.getElementById('draw-ui');
        if (drawUi) drawUi.classList.add('hidden');
    }

    // ✨ 確保下方的選牌按鈕也被藏起來
    const drawUi = document.getElementById('draw-ui');
    if (drawUi) drawUi.classList.add('hidden');
}

// ==========================================
// 📜 阿卡西紀錄：即時搜尋與過濾系統
// ==========================================
let allHistoryRecords = []; // 在記憶體快取所有紀錄，避免每次打字都要去查 IndexedDB
let historyFilterTimer = null; // 防抖計時器
// ✨ 垃圾桶控制機制
let isInTrashView = false;

// 切換垃圾桶與歷史紀錄畫面
window.toggleTrashMode = function () {
    // ✨ 雙重保險同步切換
    window.isInTrashView = !window.isInTrashView;
    try { if (typeof isInTrashView !== 'undefined') isInTrashView = window.isInTrashView; } catch (e) { }

    const btn = document.getElementById('btn-trash-toggle');
    const title = document.getElementById('history-title');
    const screen = document.getElementById('screen-history');

    if (window.isInTrashView) {
        if (btn) { btn.innerText = '📜'; btn.classList.remove('text-gray-400'); btn.classList.add('text-yellow-300'); }
        if (title) title.innerText = '回收桶 (純瀏覽)';
        if (screen) screen.classList.add('bg-stone-950/95');
    } else {
        if (btn) { btn.innerText = '🗑️'; btn.classList.remove('text-yellow-300'); btn.classList.add('text-gray-400'); }
        if (title) title.innerText = '阿卡西紀錄';
        if (screen) screen.classList.remove('bg-stone-950/95');
    }

    if (typeof window.applyHistoryFilters === 'function') {
        window.applyHistoryFilters();
    }
};

// ✨ 在回收桶列表中點擊「還原」按鈕時觸發的函數
async function restoreRecordFromTrash(recordId, event) {
    if (event) event.stopPropagation(); // 防止觸發外層跳頁

    let history = await DB.get('history', []);
    const idx = history.findIndex(r => r.id === recordId);

    if (idx !== -1) {
        history[idx].isDeleted = false; // 取消刪除標籤
        await DB.set('history', history);
        showToast('♻️ 紀錄已成功還原！');

        await renderHistoryList();
    }
}

// 渲染紀錄列表（含 3. 線上/手動 Highlight 標示）
async function renderHistoryList() {
    try {
        allHistoryRecords = await DB.get('history', []);
        await populateHistorySpreadFilter();
        applyHistoryFilters();
    } catch (err) {
        console.error('讀取歷史紀錄失敗:', err);
    }
}

// 還原紀錄
async function restoreRecord(recordId, event) {
    event.stopPropagation();
    let history = await DB.get('history_records', []);
    const idx = history.findIndex(r => r.id === recordId);
    if (idx !== -1) {
        history[idx].isDeleted = false;
        await DB.set('history_records', history);
        showToast('紀錄已還原');
        await renderHistoryList();
    }
}

// ✨ 2. 動態生成「牌陣下拉選單」的選項
async function populateHistorySpreadFilter() {
    const select = document.getElementById('filter-spread');
    if (!select) return;

    const customSpreads = await DB.get('custom_spreads', []);
    let optionsHTML = '<option value="all">🔯 所有牌陣</option>';

    TAROT_SPREADS_CONFIG.forEach(s => {
        optionsHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    customSpreads.forEach((s, idx) => {
        optionsHTML += `<option value="custom_saved_${idx}">${s.name} (自訂)</option>`;
    });

    select.innerHTML = optionsHTML;
}

// ✨ 3. 輸入框專用的防抖函數 (避免打字時畫面卡頓)
function triggerDebouncedFilter() {
    clearTimeout(historyFilterTimer);
    // 等使用者停止打字 300 毫秒後，才觸發搜尋
    historyFilterTimer = setTimeout(() => {
        applyHistoryFilters();
    }, 300);
}

// ✨ 4. 核心過濾引擎
function applyHistoryFilters() {
    try {
        const dateStart = document.getElementById('filter-date-start')?.value || '';
        const dateEnd = document.getElementById('filter-date-end')?.value || '';
        const keyword = document.getElementById('filter-keyword')?.value.trim().toLowerCase() || '';
        const cardKeyword = document.getElementById('filter-card')?.value.trim().toLowerCase() || '';
        const spreadId = document.getElementById('filter-spread')?.value || 'all';

        const filteredRecords = allHistoryRecords.filter(item => {
            // ✨ 防彈機制 1：如果這是一筆壞掉的空紀錄，直接踢掉，絕不讓它導致當機
            if (!item || typeof item !== 'object') return false;

            // 垃圾桶過濾邏輯
            const isDeleted = item.isDeleted === true;
            if (typeof isInTrashView !== 'undefined' && isInTrashView) {
                if (!isDeleted) return false;
            } else {
                if (isDeleted) return false;
            }

            // 日期過濾
            if (dateStart || dateEnd) {
                const safeDate = String(item.date || ''); // 強制轉字串
                const itemDateStr = safeDate.split(' ')[0].replace(/\//g, '-');
                if (dateStart && itemDateStr < dateStart) return false;
                if (dateEnd && itemDateStr > dateEnd) return false;
            }

            // 牌陣過濾
            if (spreadId !== 'all' && item.spread !== spreadId) return false;

            // 關鍵字過濾
            if (keyword) {
                const q = String(item.question || '').toLowerCase();
                const n = String(item.notes || '').toLowerCase();
                if (!q.includes(keyword) && !n.includes(keyword)) return false;
            }

            // 卡牌跟蹤過濾
            if (cardKeyword) {
                const cards = Array.isArray(item.cards) ? item.cards : [];
                const hasCard = cards.some(c => String(c.name || '').toLowerCase().includes(cardKeyword));
                if (!hasCard) return false;
            }

            return true;
        });

        renderFilteredHistoryItems(filteredRecords);
    } catch (err) {
        console.error('過濾歷史紀錄發生錯誤:', err);
        // 如果過濾器意外崩潰，退回直接顯示全部紀錄
        renderFilteredHistoryItems(allHistoryRecords);
    }
}

// 2. 將垃圾桶檢視與手動/線上 Highlight 標記，完美融入你原本強大的「阿卡西過濾渲染引擎」
function renderFilteredHistoryItems(records) {
    const list = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty-state');
    if (!list) return;

    list.innerHTML = '';

    // ✨ 防彈機制 2：檢查傳入的資料是否為正常的陣列
    if (!Array.isArray(records) || records.length === 0) {
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerText = (typeof isInTrashView !== 'undefined' && isInTrashView) ? '回收桶空空如也' : '找不到符合條件的占卜紀錄...';
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    records.forEach(item => {
        if (!item) return; // 二次防彈

        const div = document.createElement('div');
        const isTrash = typeof isInTrashView !== 'undefined' && isInTrashView;

        div.className = `p-2.5 rounded-lg border cursor-pointer shrink-0 shadow-md mb-0.5 transition-all ${isTrash
            ? 'bg-gray-800/40 border-gray-700 text-gray-400 opacity-60 hover:bg-gray-800/60'
            : 'bg-purple-900/60 border-purple-500 hover:bg-purple-800 text-white'
            }`;

        // ✨ 防彈機制 3：完美處理遺失的 cards 陣列與字串擷取
        const cards = Array.isArray(item.cards) ? item.cards : [];
        const cardPreview = cards.map(c => {
            const n = String(c.name || '');
            const parts = n.split('\n');
            return parts[1] || parts[0] || '未知牌卡';
        }).slice(0, 3).join('、') + (cards.length > 3 ? '...' : '');

        const isManual = item.source === 'manual';
        const badgeHTML = isManual
            ? `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-600 text-blue-100 shadow-[0_0_5px_rgba(37,99,235,0.4)] mr-1">手動登錄</span>`
            : `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-600 text-emerald-100 shadow-[0_0_5px_rgba(5,150,105,0.4)] mr-1">線上抽牌</span>`;
        const actionButtonsHTML = '';
        //const actionButtonsHTML = isTrash 
        //    ? `<button onclick="restoreRecordFromTrash('${item.id}', event)" class="px-2 py-0.5 bg-green-700 hover:bg-green-600 rounded text-[9px] text-white shrink-0 font-bold ml-2">還原</button>`
        //    : '';

        const spreadDisplay = item.spread === 'single' ? '單牌' : cards.length + '張';
        const safeDate = item.date || '未知時間';
        const safeQuestion = item.question || '無設定問題';

        div.innerHTML = `
            <div class="flex justify-between items-center mb-0.5 whitespace-nowrap truncate w-full">
                <div class="flex items-center gap-1.5 truncate">
                    ${badgeHTML}
                    <p class="text-[10px] sm:text-xs text-yellow-300 truncate">${safeDate}</p>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] sm:text-[10px] bg-purple-950 px-1.5 py-0.5 rounded border border-purple-500/50 text-purple-200 shrink-0">${spreadDisplay}</span>
                    ${actionButtonsHTML}
                </div>
            </div>
            <p class="text-sm sm:text-base font-bold truncate text-white mb-0.5 whitespace-nowrap w-full">${safeQuestion}</p>
            <p class="text-[11px] sm:text-xs text-purple-300 truncate whitespace-nowrap w-full">🃏 抽到了：${cardPreview}</p>
        `;

        div.onclick = () => {
            currentViewingRecordId = item.id;
            showRecordDetails(item, isTrash);
        };
        list.appendChild(div);
    });
}

// ✨ 6. 一鍵重置過濾器
function resetHistoryFilters() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-card').value = '';
    document.getElementById('filter-spread').value = 'all';

    // 清空後強制重新過濾渲染
    applyHistoryFilters();
}

// ==========================================
// 🗑️ 刪除與還原整合邏輯 (智慧判斷版)
// ==========================================

// 智慧刪除按鈕 (自動判斷要「移至回收桶」還是「永久刪除」)
window.deleteCurrentRecord = async function (optionalId = null) {
    const targetId = optionalId || currentViewingRecordId;

    if (window.isInTrashView) {
        // 💀 回收桶模式：永久刪除
        showConfirm('⚠️ 確定要「永久刪除」這筆紀錄嗎？此操作無法復原。', async () => {
            let history = await DB.get('history', []);
            await DB.set('history', history.filter(r => r.id !== targetId));
            if (typeof showToast === 'function') showToast('🔥 紀錄已永久刪除');
            await renderHistoryList();
            navTo('screen-history');
        });
    } else {
        // 🗑️ 正常模式：移至回收桶 (軟刪除)
        showConfirm('確定要將這筆紀錄移至回收桶嗎？', async () => {
            let history = await DB.get('history', []);
            const idx = history.findIndex(r => r.id === targetId);
            if (idx !== -1) {
                history[idx].isDeleted = true;
                await DB.set('history', history);
                if (typeof showToast === 'function') showToast('🗑️ 已移至回收桶');
                await renderHistoryList();
                navTo('screen-history');
            }
        });
    }
};

// 獨立的還原函數 (專門供解牌室內的「還原按鈕」點擊使用)
window.restoreCurrentRecord = async function () {
    let history = await DB.get('history', []);
    const idx = history.findIndex(r => r.id === currentViewingRecordId);
    if (idx !== -1) {
        history[idx].isDeleted = false; // 取消刪除標籤
        await DB.set('history', history);
        if (typeof showToast === 'function') showToast('♻️ 紀錄已成功還原！');

        await renderHistoryList();
        navTo('screen-history'); // 還原後自動退回歷史清單
    }
};

// 劫持所有可能的舊按鈕呼叫，統一由智慧按鈕接管
window.deleteRecord = window.deleteCurrentRecord;
window.deleteHistory = window.deleteCurrentRecord;
window.deleteHistoryRecord = window.deleteCurrentRecord;
// 獨立的還原函數 (專門供解牌室內的「還原按鈕」點擊使用)
window.restoreCurrentRecord = async function () {
    let history = await DB.get('history', []);
    const idx = history.findIndex(r => r.id === currentViewingRecordId);
    if (idx !== -1) {
        history[idx].isDeleted = false; // 取消刪除標籤
        await DB.set('history', history);
        if (typeof showToast === 'function') showToast('♻️ 紀錄已成功還原！');

        await renderHistoryList();
        navTo('screen-history'); // 還原後自動退回歷史清單
    }
};

// ✨ 背景靜默預載圖片
async function preloadDeckImages() {
    // 預先取得 78 張牌的路徑
    const deck = await generateBaseDeck(78);
    deck.forEach(card => {
        const img = new Image();
        img.src = card.image; // 給予 src，瀏覽器就會在背景默默下載並放入快取
    });
}

// ==========================================
// ✨ 偏好設定：連動金線外框與鎖頭控制
// ==========================================
// 1. 牌組個別鎖頭控制
window.toggleDeckLock = async function (e, size, icon, label) {
    e.stopPropagation();

    const currentLockedSize = await DB.get('locked_deck_size', null);

    // 初始化清空：把鎖頭變回 🔓 (灰階)，並把所有按鈕的金線與 Hover 殘留拔掉
    ['22', '78'].forEach(s => {
        const lockSpan = document.getElementById(`lock-deck-${s}`);
        const btn = document.getElementById(`btn-deck-${s}`);
        if (lockSpan) {
            lockSpan.innerText = '🔓';
            // ✨ 未鎖定時加上 grayscale 灰階效果
            lockSpan.className = "absolute top-2 right-2 text-base opacity-30 select-none cursor-pointer p-1 transition-all z-20 hover:opacity-80 grayscale";
        }
        if (btn) {
            btn.classList.remove('border-yellow-300', 'shadow-[0_0_15px_rgba(250,204,21,0.4)]', 'hover:border-yellow-300');
            btn.classList.add('border-purple-500', 'hover:border-purple-400');
        }
    });

    if (currentLockedSize === size) {
        // 解鎖
        await DB.set('locked_deck_size', null);
        await DB.set('deck_locked_val', null);
        if (typeof showToast === 'function') showToast('🔓 已解除牌組預設鎖定');
    } else {
        // 鎖定
        await DB.set('locked_deck_size', size);
        await DB.set('deck_locked_val', { size, icon, label });

        // ✨ 讓鎖頭發亮 (brightness-125)，並為按鈕加上金線外框！
        const lockSpan = document.getElementById(`lock-deck-${size}`);
        const btn = document.getElementById(`btn-deck-${size}`);
        if (lockSpan) {
            lockSpan.innerText = '🔒';
            lockSpan.className = "absolute top-2 right-2 text-base opacity-100 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] scale-110 cursor-pointer p-1 z-20 brightness-125";
        }
        if (btn) {
            btn.classList.remove('border-purple-500', 'hover:border-purple-400');
            btn.classList.add('border-yellow-300', 'shadow-[0_0_15px_rgba(250,204,21,0.4)]');
        }

        if (typeof showToast === 'function') showToast(`🔒 已鎖定預設：${label}`);
    }
};

// 2. 牌陣個別鎖頭控制 (只需呼叫更新，因為 updateSpreadSelectDropdown 已包含金線邏輯)
window.toggleSpreadLock = async function (e, id, icon, name) {
    e.stopPropagation();

    const currentLockedId = await DB.get('locked_spread_id', null);

    if (currentLockedId === id) {
        await DB.set('locked_spread_id', null);
        await DB.set('spread_locked_val', null);
        if (typeof showToast === 'function') showToast('🔓 已解除牌陣預設鎖定');
    } else {
        await DB.set('locked_spread_id', id);
        await DB.set('spread_locked_val', { id, icon, label: name });
        if (typeof showToast === 'function') showToast(`🔒 已鎖定預設：${name}`);
    }

    // 重新渲染牌陣清單，金線會自動套用到新的鎖定項目上
    if (typeof updateSpreadSelectDropdown === 'function') {
        updateSpreadSelectDropdown();
    }
};

// 3. 開機時檢查是否有鎖定，有就自動套用金線
window.applyLockedPreferences = async function () {
    // A. 檢查牌組
    const lockedDeck = await DB.get('deck_locked_val', null);
    if (lockedDeck) {
        const iconEl = document.getElementById('setup-deck-icon');
        const labelEl = document.getElementById('setup-deck-label');
        if (iconEl) iconEl.innerText = lockedDeck.icon;
        if (labelEl) labelEl.innerText = lockedDeck.label;
        if (typeof currentRitualData !== 'undefined') currentRitualData.deckSize = lockedDeck.size;

        // 渲染內部鎖頭亮起與金線狀態
        const lockSpan = document.getElementById(`lock-deck-${lockedDeck.size}`);
        const btn = document.getElementById(`btn-deck-${lockedDeck.size}`);
        if (lockSpan) {
            lockSpan.innerText = '🔒';
            lockSpan.className = "absolute top-2 right-2 text-base opacity-100 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] scale-110 cursor-pointer p-1 z-20";
        }
        if (btn) {
            btn.classList.remove('border-purple-500');
            btn.classList.add('border-yellow-300', 'shadow-[0_0_15px_rgba(250,204,21,0.4)]');
        }
    }

    // B. 檢查牌陣
    const lockedSpread = await DB.get('spread_locked_val', null);
    if (lockedSpread) {
        const iconEl = document.getElementById('setup-spread-icon');
        const labelEl = document.getElementById('setup-spread-label');
        if (iconEl) iconEl.innerText = lockedSpread.icon;
        if (labelEl) labelEl.innerText = lockedSpread.label;
        if (typeof currentSelectedSpread !== 'undefined') currentSelectedSpread = lockedSpread.id;
        if (typeof currentRitualData !== 'undefined') currentRitualData.spread = lockedSpread.id;
    }
};

// ==========================================
// ✨ 系統開機初始化 (終極整合大總管)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {

    // 1. 🎨 套用祭壇環境主題與背景顏色
    if (typeof applyThemeColor === 'function') {
        applyThemeColor();
    }

    // 2. 🎴 初始化塔羅牌面 (資料夾路徑) 選擇下拉選單
    if (typeof initDeckThemeSelect === 'function') {
        initDeckThemeSelect();
    }

    // 3. 🔒 套用偏好設定 (自動帶入牌組、牌陣的鎖定與金線發光狀態)
    if (typeof applyLockedPreferences === 'function') {
        applyLockedPreferences();
    }

});
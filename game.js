/* =========================================
   設定・データ定義
   ========================================= */
const CONFIG = {
    tileSize: 32,
    rows: 15,
    cols: 15
};

const ASSETS = {
    // 画像があればここにパスを指定
    player: null,
    enemy: null
};

// マップデータ (0:草, 1:壁, 2:水, 3:宿屋(町), 4:魔王城)
const mapData = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,3,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,1,1,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,2,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,2,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,1,1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,4,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// 敵データ
const enemyTypes = [
    { id: 'slime', name: 'スライム', hp: 10, maxHp:10, attack: 5, xp: 3, gold: 5, color: '#32CD32' },
    { id: 'bat',   name: 'ドラキー', hp: 18, maxHp:18, attack: 9, xp: 8, gold: 12, color: '#4B0082' },
    { id: 'golem', name: 'ゴーレム', hp: 50, maxHp:50, attack: 18, xp: 25, gold: 50, color: '#A52A2A' }
];
const BOSS_DATA = { id: 'boss', name: 'りゅうおう', hp: 200, maxHp:200, attack: 30, xp: 0, gold: 0, color: '#800080' };

/* =========================================
   グローバル変数 & 初期化
   ========================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('message-box');

// ゲームステート管理
// TITLE, PLAYING, MENU, BATTLE, SHOP, ENDING
let gameState = 'TITLE'; 

// プレイヤー初期値
const initialPlayer = {
    x: 2, y: 2, direction: 'down',
    level: 1, hp: 30, maxHp: 30, mp: 10, maxMp: 10, attack: 10,
    exp: 0, nextExp: 15, gold: 0,
    items: { 'yakusou': 3 }, // 初期アイテム: やくそう3個
    spells: [
        { name: "ホイミ", cost: 3, type: "heal", value: 20 },
        { name: "メラ",   cost: 2, type: "dmg",  value: 15 }
    ]
};
let player = JSON.parse(JSON.stringify(initialPlayer));

// 戦闘用変数
let battleEnemy = null;
let battleCursor = 0; // 0:たたかう, 1:じゅもん, 2:どうぐ, 3:にげる
let battleMenuState = 'MAIN'; // MAIN, SPELL, ITEM

// メニュー用変数
let menuCursor = 0; // 0:じゅもん, 1:どうぐ, 2:セーブ

// 画像ロード（プレースホルダー）
const images = {}; 

/* =========================================
   メインループ & 入力分岐
   ========================================= */

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

// キー入力ハンドリング
document.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    let key = e.key;
    if (key === ' ') key = 'Space';
    
    handleInput(key);
});

// スマホ対応
const btns = document.querySelectorAll('.d-btn, .btn-a');
btns.forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        handleInput(btn.getAttribute('data-key'));
    };
    btn.addEventListener('touchstart', handler, {passive:false});
    btn.addEventListener('mousedown', handler);
});

function handleInput(key) {
    if (messageBox.style.display === 'block' && gameState !== 'TITLE') return; // メッセージ中は操作禁止

    switch (gameState) {
        case 'TITLE':
            if (key === 'Space' || key === 'Enter') {
                loadGame(); // セーブがあればロード、なければ初期化
                gameState = 'PLAYING';
            }
            break;
        case 'PLAYING':
            handlePlayingInput(key);
            break;
        case 'MENU':
            handleMenuInput(key);
            break;
        case 'BATTLE':
            handleBattleInput(key);
            break;
        case 'ENDING':
            if (key === 'Space' || key === 'Enter') location.reload();
            break;
    }
}

/* =========================================
   各シーンのロジック
   ========================================= */

// --- PLAYING (マップ移動) ---
function handlePlayingInput(key) {
    if (key === 'Space' || key === 'Enter') {
        // メニューを開く
        gameState = 'MENU';
        menuCursor = 0;
        return;
    }

    let nextX = player.x;
    let nextY = player.y;

    if (key === 'ArrowUp')    { nextY--; player.direction = 'up'; }
    if (key === 'ArrowDown')  { nextY++; player.direction = 'down'; }
    if (key === 'ArrowLeft')  { nextX--; player.direction = 'left'; }
    if (key === 'ArrowRight') { nextX++; player.direction = 'right'; }

    // 移動処理
    if (isWalkable(nextX, nextY)) {
        player.x = nextX;
        player.y = nextY;
        
        // イベントチェック
        checkTileEvent(nextX, nextY);
    }
}

function isWalkable(x, y) {
    if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return false;
    // 0:草, 3:宿屋, 4:魔王 は歩ける。 1:壁, 2:水 は歩けない
    const t = mapData[y][x];
    return (t === 0 || t === 3 || t === 4);
}

function checkTileEvent(x, y) {
    const tile = mapData[y][x];

    // 宿屋 (Tile 3)
    if (tile === 3) {
        showMessage("宿屋だ。10Gで HP/MPを 回復します。", false);
        setTimeout(() => {
            if (player.gold >= 10) {
                player.gold -= 10;
                player.hp = player.maxHp;
                player.mp = player.maxMp;
                showMessage("ゆうべは おたのしみでしたね。\n(HP/MPが かいふくした！)", false);
            } else {
                showMessage("お金が 足りないようだ...", false);
            }
            setTimeout(closeMessage, 2000);
        }, 1500);
        return;
    }

    // 魔王 (Tile 4)
    if (tile === 4) {
        showMessage("よくきたな...。\nわしを倒して 世界を救ってみせよ！", false);
        setTimeout(() => {
            closeMessage();
            startBattle(true); // ボス戦
        }, 2000);
        return;
    }

    // ランダムエンカウント (草地のみ)
    if (tile === 0 && Math.random() < 0.1) {
        startBattle(false);
    }
}

// --- MENU (フィールドメニュー) ---
function handleMenuInput(key) {
    if (key === 'ArrowUp')   menuCursor = (menuCursor + 2) % 3;
    if (key === 'ArrowDown') menuCursor = (menuCursor + 1) % 3;
    if (key === 'ArrowLeft') { gameState = 'PLAYING'; return; } // キャンセル

    if (key === 'Space' || key === 'Enter') {
        if (menuCursor === 0) { // じゅもん（簡易回復）
            if (player.mp >= 3) {
                player.mp -= 3;
                player.hp = Math.min(player.maxHp, player.hp + 20);
                showMessage("ホイミをとなえた！ HP回復！", false);
                setTimeout(closeMessage, 1000);
            } else {
                showMessage("MPが足りない！", false);
                setTimeout(closeMessage, 1000);
            }
        }
        if (menuCursor === 1) { // どうぐ（やくそう）
            if (player.items['yakusou'] > 0) {
                player.items['yakusou']--;
                player.hp = Math.min(player.maxHp, player.hp + 30);
                showMessage("やくそうを使った！ HP回復！", false);
                setTimeout(closeMessage, 1000);
            } else {
                showMessage("やくそうを持っていない！", false);
                setTimeout(closeMessage, 1000);
            }
        }
        if (menuCursor === 2) { // セーブ
            saveGame();
            showMessage("冒険の書に 記録しました。", false);
            setTimeout(() => { closeMessage(); gameState = 'PLAYING'; }, 1500);
        }
    }
}

// --- BATTLE (戦闘) ---
function startBattle(isBoss) {
    gameState = 'BATTLE';
    battleMenuState = 'MAIN';
    battleCursor = 0;

    if (isBoss) {
        battleEnemy = { ...BOSS_DATA };
    } else {
        const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        battleEnemy = { ...type };
    }
    battleEnemy.maxHp = battleEnemy.hp; // コピー時にmaxHp確保

    showMessage(`${battleEnemy.name} が あらわれた！`, true);
    setTimeout(() => { closeMessage(); }, 1500);
}

function handleBattleInput(key) {
    if (battleMenuState === 'MAIN') {
        if (key === 'ArrowUp')   battleCursor = (battleCursor + 3) % 4;
        if (key === 'ArrowDown') battleCursor = (battleCursor + 1) % 4;
        
        if (key === 'Space' || key === 'Enter') {
            if (battleCursor === 0) executeAttack();
            if (battleCursor === 1) { battleMenuState = 'SPELL'; battleCursor = 0; } // 呪文選択へ（カーソル再利用）
            if (battleCursor === 2) useItemInBattle();
            if (battleCursor === 3) executeRun();
        }
    } else if (battleMenuState === 'SPELL') {
        // 簡易実装: ホイミかメラか選ぶ
        if (key === 'ArrowUp' || key === 'ArrowDown') battleCursor = (battleCursor === 0) ? 1 : 0;
        if (key === 'ArrowLeft') { battleMenuState = 'MAIN'; battleCursor = 1; } // 戻る

        if (key === 'Space' || key === 'Enter') {
            const spell = player.spells[battleCursor];
            executeSpell(spell);
        }
    }
}

function executeAttack() {
    const dmg = Math.max(1, player.attack - Math.floor(Math.random() * 3));
    battleEnemy.hp -= dmg;
    showMessage(`あなたの こうげき！\n${battleEnemy.name} に ${dmg} のダメージ！`, true);
    checkWinOrEnemyTurn();
}

function executeSpell(spell) {
    if (player.mp < spell.cost) {
        showMessage("MPが足りない！", true);
        setTimeout(() => { closeMessage(); battleMenuState = 'MAIN'; }, 1000);
        return;
    }
    player.mp -= spell.cost;
    
    if (spell.type === 'heal') {
        player.hp = Math.min(player.maxHp, player.hp + spell.value);
        showMessage(`${spell.name}！ HPが ${spell.value} かいふく！`, true);
        setTimeout(enemyTurn, 1000);
    } else {
        battleEnemy.hp -= spell.value;
        showMessage(`${spell.name}！ ${battleEnemy.name} に ${spell.value} のダメージ！`, true);
        checkWinOrEnemyTurn();
    }
}

function useItemInBattle() {
    if (player.items['yakusou'] > 0) {
        player.items['yakusou']--;
        player.hp = Math.min(player.maxHp, player.hp + 30);
        showMessage("やくそうを使った！ HPが 30 かいふく！", true);
        setTimeout(enemyTurn, 1000);
    } else {
        showMessage("どうぐ が ない！", true);
        setTimeout(() => { closeMessage(); }, 1000);
    }
}

function executeRun() {
    if (battleEnemy.id === 'boss') {
        showMessage("魔王からは 逃げられない！", true);
        setTimeout(() => { closeMessage(); enemyTurn(); }, 1000);
        return;
    }
    showMessage("あなたは にげだした！", true);
    setTimeout(() => { gameState = 'PLAYING'; closeMessage(); }, 1000);
}

function enemyTurn() {
    const dmg = Math.max(1, battleEnemy.attack - Math.floor(Math.random() * 3));
    player.hp -= dmg;
    showMessage(`${battleEnemy.name} の こうげき！\n${dmg} のダメージをうけた！`, true);
    
    setTimeout(() => {
        if (player.hp <= 0) {
            showMessage("あなたは しんでしまった...", true);
            player.gold = Math.floor(player.gold / 2); // デスペナルティ
            saveGame(); // お金半減でセーブ
            setTimeout(() => location.reload(), 2000);
        } else {
            closeMessage();
            battleMenuState = 'MAIN';
            battleCursor = 0;
        }
    }, 1500);
}

function checkWinOrEnemyTurn() {
    setTimeout(() => {
        if (battleEnemy.hp <= 0) {
            processWin();
        } else {
            enemyTurn();
        }
    }, 1000);
}

function processWin() {
    // 勝利処理
    if (battleEnemy.id === 'boss') {
        gameState = 'ENDING';
        return;
    }

    const xp = battleEnemy.xp;
    const gold = battleEnemy.gold;
    player.exp += xp;
    player.gold += gold;
    
    // ドロップアイテム（20%でやくそう）
    let dropMsg = "";
    if (Math.random() < 0.2) {
        player.items['yakusou']++;
        dropMsg = "\nさらに やくそうを 手に入れた！";
    }

    let msg = `${battleEnemy.name}を倒した！\n経験値${xp} ゴールド${gold} を得た。${dropMsg}`;

    // レベルアップ
    if (player.exp >= player.nextExp) {
        player.level++;
        player.nextExp = Math.floor(player.nextExp * 1.5);
        player.maxHp += 8; player.maxMp += 4; player.attack += 3;
        player.hp = player.maxHp; player.mp = player.maxMp;
        msg += `\nレベルが ${player.level} にあがった！`;
    }

    showMessage(msg, true);
    setTimeout(() => {
        gameState = 'PLAYING';
        closeMessage();
    }, 2500);
}


/* =========================================
   共通関数 (セーブ・ロード・描画)
   ========================================= */

function showMessage(text, isBattle) {
    messageBox.innerText = text;
    messageBox.style.display = 'block';
}
function closeMessage() {
    messageBox.style.display = 'none';
}

// セーブ機能 (LocalStorage)
function saveGame() {
    localStorage.setItem('js_rpg_save', JSON.stringify(player));
}
function loadGame() {
    const save = localStorage.getItem('js_rpg_save');
    if (save) {
        player = JSON.parse(save);
    }
}

// 描画メイン
function draw() {
    // 背景クリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'TITLE') drawTitle();
    else if (gameState === 'ENDING') drawEnding();
    else if (gameState === 'BATTLE') drawBattle();
    else drawMap(); // PLAYING, MENU, SHOP
}

function drawTitle() {
    ctx.fillStyle = '#fff';
    ctx.font = '40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("J A V A  Q U E S T", canvas.width/2, 150);
    
    ctx.font = '20px monospace';
    ctx.fillText("PRESS SPACE TO START", canvas.width/2, 300);
    
    // セーブデータがあるか確認
    if (localStorage.getItem('js_rpg_save')) {
        ctx.fillStyle = '#FFFF00';
        ctx.fillText("※ つづきから あそべます", canvas.width/2, 350);
    }
}

function drawEnding() {
    ctx.fillStyle = '#fff';
    ctx.font = '30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("CONGRATULATIONS!", canvas.width/2, 150);
    ctx.font = '16px monospace';
    ctx.fillText("あなたは 魔王をたおし 世界をすくった！", canvas.width/2, 200);
    ctx.fillText("Thank you for playing.", canvas.width/2, 300);
}

function drawMap() {
    // マップ描画
    for (let y = 0; y < CONFIG.rows; y++) {
        for (let x = 0; x < CONFIG.cols; x++) {
            const t = mapData[y][x];
            let c = '#228B22'; // 草
            if (t === 1) c = '#808080'; // 壁
            if (t === 2) c = '#1E90FF'; // 水
            if (t === 3) c = '#FFA500'; // 宿屋(橙)
            if (t === 4) c = '#800080'; // 魔王(紫)
            
            ctx.fillStyle = c;
            ctx.fillRect(x*CONFIG.tileSize, y*CONFIG.tileSize, CONFIG.tileSize, CONFIG.tileSize);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.strokeRect(x*CONFIG.tileSize, y*CONFIG.tileSize, CONFIG.tileSize, CONFIG.tileSize);
        }
    }
    // プレイヤー
    ctx.fillStyle = player.color || '#FFD700';
    ctx.fillRect(player.x*CONFIG.tileSize+4, player.y*CONFIG.tileSize+4, 24, 24);

    // ステータス表示 (上部)
    drawStatusWindow();

    // メニュー表示
    if (gameState === 'MENU') drawMenuWindow();
}

function drawBattle() {
    // 背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0, canvas.width, canvas.height);

    // 敵
    const size = 100;
    const ex = (canvas.width - size)/2;
    const ey = 80;
    ctx.fillStyle = battleEnemy.color || '#F00';
    ctx.fillRect(ex, ey, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(battleEnemy.name, canvas.width/2, ey - 20);

    // ステータス (上部)
    drawStatusWindow();

    // コマンド (下部)
    if (messageBox.style.display === 'none') {
        const cx = 20, cy = 300, cw = 200, ch = 150;
        drawWindow(cx, cy, cw, ch);
        
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        const menus = ["たたかう", "じゅもん", "どうぐ", "にげる"];
        if (battleMenuState === 'MAIN') {
            menus.forEach((m, i) => {
                ctx.fillText(m, cx+40, cy+40+(i*30));
                if (battleCursor === i) ctx.fillText("▶", cx+10, cy+40+(i*30));
            });
        } else if (battleMenuState === 'SPELL') {
            const spells = player.spells;
            spells.forEach((s, i) => {
                ctx.fillText(`${s.name}(${s.cost})`, cx+40, cy+40+(i*30));
                if (battleCursor === i) ctx.fillText("▶", cx+10, cy+40+(i*30));
            });
        }
    }
}

// ★修正した関数★
function drawStatusWindow() {
    const w = canvas.width;
    const h = 80;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0,0,w,h);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    
    // 左側カラム: Lv, Gold, HP, MP
    ctx.fillText(`Lv:${player.level}  ${player.gold}G`, 10, 30);
    ctx.fillText(`HP:${player.hp}/${player.maxHp}  MP:${player.mp}/${player.maxMp}`, 10, 60);
    
    // 右側カラム: Exp, Item (開始位置を200から260へ移動し、重なりを防止)
    ctx.fillText(`Exp:${player.exp}/${player.nextExp}`, 260, 30);
    ctx.fillText(`やくそう:${player.items['yakusou']}`, 260, 60);
}

function drawMenuWindow() {
    const x = 50, y = 50, w = 150, h = 120;
    drawWindow(x, y, w, h);
    
    ctx.fillStyle = '#fff';
    const items = ["じゅもん(回復)", "やくそう", "セーブ"];
    items.forEach((it, i) => {
        ctx.fillText(it, x+30, y+35+(i*30));
        if (menuCursor === i) ctx.fillText("▶", x+10, y+35+(i*30));
    });
}

function drawWindow(x, y, w, h) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
}

// 起動
gameLoop();

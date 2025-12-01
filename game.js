/* =========================================
   設定・データ管理エリア (ここを編集して画像を差し替える)
   ========================================= */
const ASSETS = {
    // 画像ファイルがある場合はパスを指定 (例: 'img/hero.png')
    // 画像がない場合は null にすると色の四角で表示されます
    player: null, 
    slime: null,
    golem: null,
    mapTile: null
};

// ゲーム設定
const CONFIG = {
    tileSize: 32,
    rows: 15,
    cols: 15
};

// マップデータ (0:草, 1:壁, 2:水)
const mapData = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,0,1,1,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,2,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,2,1,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,1,1,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

/* =========================================
   ゲームロジック
   ========================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageBox = document.getElementById('message-box');

// ゲーム状態: PLAYING, DIALOGUE, BATTLE
let gameState = 'PLAYING'; 

// 画像プリロード処理（簡易版）
const images = {};
for (const key in ASSETS) {
    if (ASSETS[key]) {
        const img = new Image();
        img.src = ASSETS[key];
        images[key] = img;
    }
}

// --- プレイヤーデータ (レベル・魔法対応) ---
const player = {
    x: 2, y: 2, direction: 'down', color: '#FFD700',
    // ステータス
    level: 1,
    hp: 30, maxHp: 30,
    mp: 10, maxMp: 10,
    attack: 8,
    exp: 0, nextExp: 10, // 次のレベルまで10
    spells: [
        { name: "ホイミ", cost: 3, type: "heal", value: 15 },
        { name: "メラ",   cost: 2, type: "dmg",  value: 12 }
    ]
};

// --- NPC ---
const npcs = [
    { x: 7, y: 5, color: '#FF69B4', message: "レベルをあげれば\nじゅもん が つかえるようになるわ。", name: "村人A" },
    { x: 10, y: 10, color: '#00FFFF', message: "じゅもんを使うには\nMP（マジックポイント）が必要だ。", name: "兵士" }
];

// --- 敵データ ---
const enemyTypes = [
    { id: 'slime', name: 'スライム', hp: 15, attack: 5, xp: 4, color: '#32CD32' },
    { id: 'golem', name: 'ゴーレム', hp: 40, attack: 12, xp: 10, color: '#A52A2A' }
];

// --- 戦闘用変数 ---
let battleEnemy = null;
let battleCursor = 0;   // 0:たたかう, 1:じゅもん, 2:にげる
let battleMenuState = 'MAIN'; // MAIN, SPELL
let spellCursor = 0;

// =========================================
// 入力・進行管理
// =========================================

function handleInput(key) {
    if (gameState === 'PLAYING') {
        if (key.startsWith('Arrow')) movePlayer(key);
        if (key === 'Space' || key === 'Enter') checkInteraction();

    } else if (gameState === 'DIALOGUE') {
        if (key === 'Space' || key === 'Enter') {
            gameState = 'PLAYING';
            messageBox.style.display = 'none';
        }

    } else if (gameState === 'BATTLE') {
        handleBattleInput(key);
    }
}

// --- マップ移動 ---
function movePlayer(key) {
    let nextX = player.x;
    let nextY = player.y;

    if (key === 'ArrowUp')    { nextY--; player.direction = 'up'; }
    if (key === 'ArrowDown')  { nextY++; player.direction = 'down'; }
    if (key === 'ArrowLeft')  { nextX--; player.direction = 'left'; }
    if (key === 'ArrowRight') { nextX++; player.direction = 'right'; }

    if (isWalkable(nextX, nextY)) {
        player.x = nextX;
        player.y = nextY;
        
        // エンカウント判定 (歩ける場所なら)
        if (mapData[nextY][nextX] === 0 && Math.random() < 0.1) {
            startBattle();
        }
    }
    draw();
}

function isWalkable(x, y) {
    if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return false;
    if (mapData[y][x] !== 0) return false;
    for (const npc of npcs) if (npc.x === x && npc.y === y) return false;
    return true;
}

function checkInteraction() {
    let tx = player.x, ty = player.y;
    if (player.direction === 'up') ty--;
    if (player.direction === 'down') ty++;
    if (player.direction === 'left') tx--;
    if (player.direction === 'right') tx++;

    const npc = npcs.find(n => n.x === tx && n.y === ty);
    if (npc) showMessage(`${npc.name}:\n${npc.message}`);
}

function showMessage(text, isBattle = false) {
    if (!isBattle) gameState = 'DIALOGUE';
    messageBox.innerText = text;
    messageBox.style.display = 'block';
}

// =========================================
// 戦闘システム (大幅強化)
// =========================================

function startBattle() {
    gameState = 'BATTLE';
    battleMenuState = 'MAIN';
    battleCursor = 0;
    
    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    battleEnemy = { ...type, maxHp: type.hp }; // コピー作成

    showMessage(`${battleEnemy.name} が あらわれた！`, true);
    draw();
}

function handleBattleInput(key) {
    // 敵ターン中などは操作無効
    if (messageBox.style.display === 'block' && gameState === 'BATTLE') {
        // メッセージ送り待ち状態があればここで処理するが、
        // 今回はsetTimeoutで自動送りするので何もしない
        return; 
    }

    if (battleMenuState === 'MAIN') {
        // メインメニュー操作
        if (key === 'ArrowUp')   battleCursor = (battleCursor + 2) % 3; // 循環
        if (key === 'ArrowDown') battleCursor = (battleCursor + 1) % 3;
        
        if (key === 'Space' || key === 'Enter') {
            if (battleCursor === 0) executeAttack();
            if (battleCursor === 1) { battleMenuState = 'SPELL'; spellCursor = 0; }
            if (battleCursor === 2) executeRun();
        }

    } else if (battleMenuState === 'SPELL') {
        // 呪文メニュー操作
        if (key === 'ArrowUp')   spellCursor = Math.max(0, spellCursor - 1);
        if (key === 'ArrowDown') spellCursor = Math.min(player.spells.length - 1, spellCursor + 1);
        if (key === 'ArrowLeft') battleMenuState = 'MAIN'; // キャンセル

        if (key === 'Space' || key === 'Enter') {
            executeSpell(player.spells[spellCursor]);
        }
    }
    draw();
}

// 行動: たたかう
function executeAttack() {
    const dmg = Math.max(1, player.attack - Math.floor(Math.random() * 2));
    battleEnemy.hp -= dmg;
    
    showMessage(`あなたの こうげき！\n${battleEnemy.name} に ${dmg} のダメージ！`, true);
    checkWinOrEnemyTurn();
}

// 行動: じゅもん
function executeSpell(spell) {
    if (player.mp < spell.cost) {
        showMessage(`MPが 足りない！`, true);
        setTimeout(() => { showMessage(""); draw(); }, 1000);
        return;
    }

    player.mp -= spell.cost;

    if (spell.type === 'heal') {
        // 回復
        player.hp = Math.min(player.maxHp, player.hp + spell.value);
        showMessage(`${spell.name} を となえた！\nHPが ${spell.value} かいふくした！`, true);
        setTimeout(() => enemyTurn(), 1000); // 回復は即敵ターンへ

    } else if (spell.type === 'dmg') {
        // 攻撃魔法
        battleEnemy.hp -= spell.value;
        showMessage(`${spell.name} を となえた！\n${battleEnemy.name} に ${spell.value} のダメージ！`, true);
        checkWinOrEnemyTurn();
    }
}

// 行動: にげる
function executeRun() {
    showMessage("あなたは にげだした！", true);
    setTimeout(() => {
        endBattle();
    }, 1000);
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

// 敵のターン
function enemyTurn() {
    const dmg = Math.max(1, battleEnemy.attack - Math.floor(Math.random() * 3));
    player.hp -= dmg;

    showMessage(`${battleEnemy.name} の こうげき！\nあなたは ${dmg} のダメージをうけた！`, true);
    
    setTimeout(() => {
        if (player.hp <= 0) {
            showMessage("あなたは しんでしまった...", true);
            setTimeout(() => location.reload(), 2000);
        } else {
            // メッセージを消してコマンド入力へ
            showMessage("", true); 
            messageBox.style.display = 'none';
            battleMenuState = 'MAIN';
            draw();
        }
    }, 1500);
}

// 勝利処理（レベルアップ含む）
function processWin() {
    const xp = battleEnemy.xp;
    player.exp += xp;
    
    let msg = `${battleEnemy.name} を たおした！\nけいけんち ${xp} をてにいれた。`;
    
    // レベルアップ判定
    if (player.exp >= player.nextExp) {
        player.level++;
        player.exp -= player.nextExp; // 余剰分持ち越し
        player.nextExp = Math.floor(player.nextExp * 1.5); // 必要経験値増加
        
        // ステータス上昇
        player.maxHp += 5;
        player.maxMp += 3;
        player.hp = player.maxHp; // 全回復ボーナス
        player.mp = player.maxMp;
        player.attack += 2;

        msg += `\nレベルが ${player.level} に あがった！`;
    }

    showMessage(msg, true);
    setTimeout(() => endBattle(), 2000);
}

function endBattle() {
    gameState = 'PLAYING';
    messageBox.style.display = 'none';
    draw();
}

// =========================================
// 描画処理
// =========================================

function draw() {
    // 画面クリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'BATTLE') {
        drawBattleScene();
    } else {
        drawMapScene();
    }
}

function drawMapScene() {
    // マップ
    for (let y = 0; y < CONFIG.rows; y++) {
        for (let x = 0; x < CONFIG.cols; x++) {
            const tile = mapData[y][x];
            let color = '#228B22'; // 草
            if (tile === 1) color = '#808080'; // 壁
            if (tile === 2) color = '#1E90FF'; // 水
            
            // 画像があれば画像を使う（例: images.mapTile）
            // ここでは簡易的に色塗り
            ctx.fillStyle = color;
            ctx.fillRect(x * CONFIG.tileSize, y * CONFIG.tileSize, CONFIG.tileSize, CONFIG.tileSize);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.strokeRect(x * CONFIG.tileSize, y * CONFIG.tileSize, CONFIG.tileSize, CONFIG.tileSize);
        }
    }
    // NPC
    for (const npc of npcs) {
        ctx.fillStyle = npc.color;
        ctx.fillRect(npc.x * CONFIG.tileSize +4, npc.y * CONFIG.tileSize +4, 24, 24);
    }
    // プレイヤー（画像対応）
    if (images.player && images.player.complete) {
        ctx.drawImage(images.player, player.x * CONFIG.tileSize, player.y * CONFIG.tileSize, 32, 32);
    } else {
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x * CONFIG.tileSize +4, player.y * CONFIG.tileSize +4, 24, 24);
    }
}

function drawBattleScene() {
    // 背景
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 敵の描画
    const enemySize = 120;
    const ex = (canvas.width - enemySize) / 2;
    const ey = 80;
    
    // 画像があれば描画、なければ四角
    const enemyImg = images[battleEnemy.id];
    if (enemyImg && enemyImg.complete) {
        ctx.drawImage(enemyImg, ex, ey, enemySize, enemySize);
    } else {
        ctx.fillStyle = battleEnemy.color;
        ctx.fillRect(ex, ey, enemySize, enemySize);
    }

    // ステータス表示
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv.${player.level}`, 20, 30);
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 20, 55);
    ctx.fillText(`MP: ${player.mp}/${player.maxMp}`, 20, 80);

    // コマンドウィンドウ（下部固定ではなく、相対位置で表示）
    // スマホではみ出るのを防ぐため、Canvasの高さ基準で描画
    if (battleMenuState !== 'NONE' && messageBox.style.display === 'none') {
        drawBattleMenu();
    }
}

function drawBattleMenu() {
    const w = 160;
    const h = 130;
    const x = 20;
    const y = canvas.height - h - 20; // 下から20px浮かす

    // 枠
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';

    if (battleMenuState === 'MAIN') {
        const menus = ["たたかう", "じゅもん", "にげる"];
        menus.forEach((text, i) => {
            ctx.fillText(text, x + 40, y + 40 + (i * 35));
            if (battleCursor === i) ctx.fillText("▶", x + 15, y + 40 + (i * 35));
        });
    } else if (battleMenuState === 'SPELL') {
        player.spells.forEach((spell, i) => {
            ctx.fillText(spell.name, x + 40, y + 40 + (i * 35));
            // MPコスト表示
            ctx.font = '14px monospace';
            ctx.fillText(`(${spell.cost})`, x + 110, y + 40 + (i * 35));
            ctx.font = '18px monospace';
            
            if (spellCursor === i) ctx.fillText("▶", x + 15, y + 40 + (i * 35));
        });
    }
}


// =========================================
// イベントリスナー
// =========================================

// キーボード
document.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    let key = e.key;
    if (key === ' ') key = 'Space';
    handleInput(key);
});

// スマホコントローラー
const btns = document.querySelectorAll('.d-btn, .btn-a');
btns.forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        handleInput(btn.getAttribute('data-key'));
    };
    btn.addEventListener('touchstart', handler, {passive:false});
    btn.addEventListener('mousedown', handler); // PCデバッグ用
});

// 初期描画
draw();
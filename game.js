// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player; 
let obstacles = [];
let coins = []; 
let powerUps = []; 
let score = 0;
let totalGold = 0; 
let skateboardStock = 0; 
let lastSpeedMilestone = 0; 
let lastPowerUpMilestone = 0; 
let gameActive = false; 

// Zor Mod, Bot ve Video Modu Değişkenleri
let isHardMode = false;
let isBotMode = false;
let isVideoMode = false; // Video Modu Kontrolü
let coolMoveTimer = 0;  // Havalı bot hareketleri için zamanlayıcı
let goldMultiplier = 1;
let obstacleIntervalId = null;

// Hız Ayarları
let speed = 0.40; 
let maxSpeed = 2.2; 

// Kaykay Sistem Değişkenleri
let hasSkateboard = false;
let skateboardMesh = null;
let skateboardTimer = 15; 
let skateboardInterval = null;
let lastTapTime = 0; 

// ÖZELLİK (POWER-UP) AKTİF DURUMLARI
let isMagnetActive = false;
let magnetTimer = 0;
let magnetInterval = null;

let isDoubleScoreActive = false;
let doubleScoreTimer = 0;
let doubleScoreInterval = null;

// Animasyon Değişkenleri
let mixer; 
let clock = new THREE.Clock();
let runningAction, jumpingAction, idleAction;

// Şeritler
const lanes = [-3, 0, 3];
let currentLane = 1; 
let targetX = lanes[currentLane];

// Zıplama ve Fizik Ayarları
let isJumping = false;
let jumpVelocity = 0;
const gravity = 0.015;
const initialJumpForce = 0.35;
let baseFloorY = 0.9; 

// Mobil Kontroller
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// --- VERİ KAYIT SİSTEMİ ---
function saveGame() {
    const data = {
        gold: totalGold,
        boards: skateboardStock
    };
    localStorage.setItem('osWaySaveData', JSON.stringify(data));
}

function loadGame() {
    const savedData = localStorage.getItem('osWaySaveData');
    if (savedData) {
        const data = JSON.parse(savedData);
        totalGold = data.gold || 0;
        skateboardStock = data.boards || 0;
    }
}

// --- BAŞLANGIÇ ---
function init() {
    loadGame(); 
    
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); 
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10); 
    camera.lookAt(0, 2, -10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    createSubwayTracks();
    loadOnline3DCharacter();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, false);
    window.addEventListener('touchend', handleTouchEnd, false);
    window.addEventListener('resize', onWindowResize);

    setInterval(spawnCoin, 800); 

    updateMenuUI();
    renderer.render(scene, camera);
}

// --- MENÜ KONTROLLERİ ---
function toggleHardModeMenu() {
    const menu = document.getElementById('hard-mode-select');
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function openMarket() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('market-screen').style.display = 'block';
    updateMarketUI();
}

function closeMarket() {
    document.getElementById('market-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    updateMenuUI();
}

function buyOneBoard() {
    if (totalGold >= 5) {
        totalGold -= 5;
        skateboardStock += 1;
        saveGame(); 
        updateMarketUI();
    } else {
        alert("Yeterli altının yok! 1 Kaykay = 5 Altın.");
    }
}

function buyBoardsWithAllGold() {
    if (totalGold >= 5) {
        let boardsToBuy = Math.floor(totalGold / 5); 
        totalGold = totalGold % 5; 
        skateboardStock += boardsToBuy;
        saveGame(); 
        updateMarketUI();
    } else {
        alert("Yeterli altının yok! Bir kaykay 5 Altın.");
    }
}

function updateMenuUI() {
    document.getElementById('menu-gold').innerText = `Altının: 🌟 ${totalGold}`;
    document.getElementById('menu-boards').innerText = `Kaykayın: 🛹 ${skateboardStock} adet`;
}

function updateMarketUI() {
    document.getElementById('market-gold').innerText = `Altının: 🌟 ${totalGold}`;
    document.getElementById('market-boards').innerText = `Kaykayın: 🛹 ${skateboardStock} adet`;
}

// --- OYUNU BAŞLATMA ---
function startGame(hardMode = false, botMode = false, videoMode = false) {
    isHardMode = hardMode;
    isBotMode = botMode || videoMode;
    isVideoMode = videoMode;

    if (isVideoMode) {
        speed = 2.0; // 5 Kat Hız
        maxSpeed = 5.0;
        goldMultiplier = 1;
    } else if (isHardMode) {
        speed = 1.8; 
        maxSpeed = 4.5;
        goldMultiplier = 5; 
    } else {
        speed = 0.40;
        maxSpeed = 2.2;
        goldMultiplier = 1;
    }

    const modeUI = document.getElementById('mode-ui');
    const goldUI = document.getElementById('gold-ui');
    const boardUI = document.getElementById('board-ui');
    const scoreUI = document.getElementById('score-ui');

    if (isVideoMode) {
        document.getElementById('ui').style.display = 'none';
        goldUI.style.display = 'none';
        boardUI.style.display = 'none';
        modeUI.style.display = 'none';
        scoreUI.style.display = 'none';
    } else {
        document.getElementById('ui').style.display = 'block';
        goldUI.style.display = 'block';
        boardUI.style.display = 'block';
        scoreUI.style.display = 'block';
        modeUI.style.display = 'block';

        if (isBotMode) {
            modeUI.innerText = "🤖 BOT MODU (Ödül Yok)";
        } else if (isHardMode) {
            modeUI.innerText = "🔥 ÇOK ZOR MOD (3x Engel & 5x Altın)";
        } else {
            modeUI.innerText = "";
        }
    }

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('market-screen').style.display = 'none';
    
    document.getElementById('gold-val').innerText = totalGold;
    document.getElementById('board-val').innerText = skateboardStock;

    clearInterval(obstacleIntervalId);
    let obsTime = isVideoMode ? 400 : (isHardMode ? 370 : 800);
    obstacleIntervalId = setInterval(spawnObstacle, obsTime);

    gameActive = true;
    if (idleAction) idleAction.stop();
    if (runningAction) runningAction.play();
    
    clock.getDelta(); 
    animate();
}

// --- İNTERNETTEN ANIMASYONLU 3D MODEL YÜKLEME ---
function loadOnline3DCharacter() {
    const loader = new THREE.GLTFLoader();
    const placeholderGeo = new THREE.BoxGeometry(1.2, 1.8, 1.2);
    const placeholderMat = new THREE.MeshBasicMaterial({ visible: false }); 
    player = new THREE.Mesh(placeholderGeo, placeholderMat);
    player.position.set(0, baseFloorY, 0); 
    scene.add(player);

    const modelUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

    loader.load(modelUrl, function (gltf) {
        const model = gltf.scene;
        model.scale.set(0.4, 0.4, 0.4); 
        model.position.set(0, -0.9, 0); 
        model.rotation.y = Math.PI; 
        
        model.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        player.add(model);

        mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const runningClip = THREE.AnimationClip.findByName(clips, 'Running');
        const jumpClip = THREE.AnimationClip.findByName(clips, 'Jump');
        const idleClip = THREE.AnimationClip.findByName(clips, 'Idle');

        if (runningClip) runningAction = mixer.clipAction(runningClip);
        if (jumpClip) jumpingAction = mixer.clipAction(jumpClip);
        if (idleClip) idleAction = mixer.clipAction(idleClip);

        if (idleAction) idleAction.play();
        renderer.render(scene, camera); 
    }, undefined, function (error) {
        console.error("Model yüklenemedi:", error);
        player.material.visible = true;
        player.material.color.setHex(0x2ed573);
    });
}

// --- DETAYLI METRO RAYLARI ---
function createSubwayTracks() {
    const roadGeo = new THREE.PlaneGeometry(12, 1000);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -450;
    road.receiveShadow = true;
    scene.add(road);

    const wallGeo = new THREE.BoxGeometry(0.5, 15, 1000);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7 });
    
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-6.5, 7.5, -450);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(6.5, 7.5, -450);
    scene.add(rightWall);

    for (let i = 0; i < lanes.length; i++) {
        const trackGeo = new THREE.BoxGeometry(0.3, 0.1, 1000);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.8 });
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(lanes[i], 0.05, -450);
        scene.add(track);
    }
}

// --- DETAYLI VE KALİTELİ 3D ENGELLER ---
function spawnObstacle() {
    if (!gameActive) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const obstacleType = Math.random() > 0.45 ? 'train' : 'barrier';
    const obstacleGroup = new THREE.Group();

    if (obstacleType === 'train') {
        const bodyGeo = new THREE.BoxGeometry(1.9, 2.7, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3c6382, metalness: 0.6, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.35;
        body.castShadow = true;
        obstacleGroup.add(body);

        const windowGeo = new THREE.BoxGeometry(1.7, 1.2, 0.1);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.1 });
        const frontWindow = new THREE.Mesh(windowGeo, windowMat);
        frontWindow.position.set(0, 1.8, 6.01);
        obstacleGroup.add(frontWindow);

        const headlightGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16);
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff200 });
        
        const leftLight = new THREE.Mesh(headlightGeo, headlightMat);
        leftLight.rotation.x = Math.PI / 2;
        leftLight.position.set(-0.6, 0.6, 6.01);
        obstacleGroup.add(leftLight);

        const rightLight = new THREE.Mesh(headlightGeo, headlightMat);
        rightLight.rotation.x = Math.PI / 2;
        rightLight.position.set(0.6, 0.6, 6.01);
        obstacleGroup.add(rightLight);

        obstacleGroup.userData = { type: 'train', heightLimit: 2.7 };
    } else {
        const barGeo = new THREE.BoxGeometry(2.2, 0.25, 0.25);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xf5cd79 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = 0.95;
        obstacleGroup.add(bar);

        const stripeGeo = new THREE.BoxGeometry(0.3, 0.27, 0.27);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1e272e });
        for (let i = -0.8; i <= 0.8; i += 0.4) {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(i, 0.95, 0);
            obstacleGroup.add(stripe);
        }

        const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x57606f, metalness: 0.7 });
        
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-1.0, 0.5, 0);
        obstacleGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(1.0, 0.5, 0);
        obstacleGroup.add(rightLeg);

        obstacleGroup.userData = { type: 'barrier', heightLimit: 1.1 };
    }

    obstacleGroup.position.set(lanes[laneIndex], 0, -60);
    scene.add(obstacleGroup);
    obstacles.push(obstacleGroup);
}

// --- 3D ALTIN (COIN) SİSTEMİ ---
function spawnCoin() {
    if (!gameActive) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const isHigh = Math.random() > 0.7;
    const height = isHigh ? 4.0 : 1.2;

    const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    const coinMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 0.9, 
        roughness: 0.1,
        emissive: 0xffb300,
        emissiveIntensity: 0.3
    });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.rotation.x = Math.PI / 2; 
    coin.castShadow = true;
    
    coin.position.set(lanes[laneIndex], height, -60);

    scene.add(coin);
    coins.push(coin);
}

// --- HER 200 PUANDA BİR ÖZELLİK (POWER-UP) SPAWN ETME ---
function spawnPowerUp() {
    if (!gameActive) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const isHigh = Math.random() > 0.5; 
    const height = isHigh ? 4.0 : 1.2;

    const types = ['magnet', 'doubleScore'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    const pGroup = new THREE.Group();

    if (selectedType === 'magnet') {
        const magMat = new THREE.MeshStandardMaterial({ color: 0xff4757, metalness: 0.5 });
        const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), magMat);
        leftBar.position.x = -0.3;
        const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), magMat);
        rightBar.position.x = 0.3;
        const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.2), magMat);
        bottomBar.position.y = -0.3;

        pGroup.add(leftBar, rightBar, bottomBar);
    } else {
        const starMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.6 });
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.2), starMat);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.2), starMat);
        b2.rotation.z = Math.PI / 4;

        pGroup.add(b1, b2);
    }

    pGroup.position.set(lanes[laneIndex], height, -60);
    pGroup.userData = { type: selectedType };
    
    scene.add(pGroup);
    powerUps.push(pGroup);
}

// --- MIKNATIS (MAGNET) TETİKLEME ---
function activateMagnet() {
    isMagnetActive = true;
    magnetTimer = 10;
    if (!isVideoMode) {
        document.getElementById('magnet-timer').innerText = `🧲 Mıknatıs: ${magnetTimer}s`;
        document.getElementById('magnet-timer').style.display = 'block';
    }

    clearInterval(magnetInterval);
    magnetInterval = setInterval(() => {
        magnetTimer--;
        if (magnetTimer <= 0) {
            clearInterval(magnetInterval);
            isMagnetActive = false;
            document.getElementById('magnet-timer').style.display = 'none';
        } else if (!isVideoMode) {
            document.getElementById('magnet-timer').innerText = `🧲 Mıknatıs: ${magnetTimer}s`;
        }
    }, 1000);
}

// --- 2 KAT PUAN TETİKLEME ---
function activateDoubleScore() {
    isDoubleScoreActive = true;
    doubleScoreTimer = 10;
    if (!isVideoMode) {
        document.getElementById('double-timer').innerText = `🌟 2X Puan: ${doubleScoreTimer}s`;
        document.getElementById('double-timer').style.display = 'block';
    }

    clearInterval(doubleScoreInterval);
    doubleScoreInterval = setInterval(() => {
        doubleScoreTimer--;
        if (doubleScoreTimer <= 0) {
            clearInterval(doubleScoreInterval);
            isDoubleScoreActive = false;
            document.getElementById('double-timer').style.display = 'none';
        } else if (!isVideoMode) {
            document.getElementById('double-timer').innerText = `🌟 2X Puan: ${doubleScoreTimer}s`;
        }
    }, 1000);
}

// --- KAYKAY KULLANIMI ---
function deploySkateboard() {
    if (hasSkateboard || !gameActive || !player) return;

    hasSkateboard = true;
    skateboardTimer = 15; 
    
    if (!isVideoMode) {
        document.getElementById('board-timer').innerText = `🛹 Kaykay: ${skateboardTimer}s`;
        document.getElementById('board-timer').style.display = 'block';
    }

    const skateboardGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xcd853f });
    const gripTapeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    const boardBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.2), woodMat);
    skateboardGroup.add(boardBase);

    const gripTape = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 2.16), gripTapeMat);
    gripTape.position.y = 0.05; 
    skateboardGroup.add(gripTape);

    skateboardMesh = skateboardGroup;
    skateboardMesh.position.set(0, -0.82, 0); 
    player.add(skateboardMesh);

    if (runningAction) runningAction.stop(); 

    clearInterval(skateboardInterval);
    skateboardInterval = setInterval(() => {
        if (!gameActive) {
            clearInterval(skateboardInterval);
            return;
        }
        skateboardTimer--;
        if (!isVideoMode) {
            document.getElementById('board-timer').innerText = `🛹 Kaykay: ${skateboardTimer}s`;
        }
        
        if (skateboardTimer <= 0) {
            destroySkateboard();
        }
    }, 1000);
}

function destroySkateboard() {
    if (!hasSkateboard) return;
    clearInterval(skateboardInterval);
    document.getElementById('board-timer').style.display = 'none';

    if (skateboardMesh && player) {
        player.remove(skateboardMesh);
        skateboardMesh = null;
    }
    hasSkateboard = false;
    if (runningAction && gameActive) runningAction.play();

    jumpVelocity = 0.15;
    isJumping = true;
}

// --- GELİŞMİŞ ŞERİT VE TREN TARAMA GELİŞMİŞ AI ---
function isLaneSafe(laneIdx) {
    let lanePos = lanes[laneIdx];
    for (let obs of obstacles) {
        if (obs.position.x === lanePos) {
            let distZ = player.position.z - obs.position.z;
            // Trenlerin boyu 12 birim olduğu için z hizasında geniş bir emniyet payı bırakıyoruz
            let safeDistanceAhead = obs.userData.type === 'train' ? 18 : 10;
            let safeDistanceBehind = obs.userData.type === 'train' ? -8 : -3;

            if (distZ < safeDistanceAhead && distZ > safeDistanceBehind) {
                return false; // Bu şeritte tehlikeli engel/tren var!
            }
        }
    }
    return true; // Şerit tamamen güvenli
}

function updateBotAI() {
    if (!isBotMode || !gameActive || !player) return;

    let safeLanes = [
        isLaneSafe(0),
        isLaneSafe(1),
        isLaneSafe(2)
    ];

    // Şuan bulunulan şerit güvenli değilse anında güvenli bir yere geç
    if (!safeLanes[currentLane]) {
        // Önümüzdeki engeli tespit et
        let frontObstacle = null;
        let minObsDistance = 999;
        for (let obs of obstacles) {
            if (obs.position.x === lanes[currentLane]) {
                let dist = player.position.z - obs.position.z;
                if (dist > 0 && dist < minObsDistance) {
                    minObsDistance = dist;
                    frontObstacle = obs;
                }
            }
        }

        // Eğer bariyerse üstünden atla
        if (frontObstacle && frontObstacle.userData.type === 'barrier' && !isJumping) {
            jump();
            return;
        }

        // Tren ise kesinlikle YAN GÜVENLİ ŞERİDE geç
        if (currentLane === 1) {
            if (safeLanes[0]) moveLeft();
            else if (safeLanes[2]) moveRight();
        } else if (currentLane === 0) {
            if (safeLanes[1]) moveRight();
            else if (safeLanes[2]) { moveRight(); moveRight(); }
        } else if (currentLane === 2) {
            if (safeLanes[1]) moveLeft();
            else if (safeLanes[0]) { moveLeft(); moveLeft(); }
        }
    } else if (isVideoMode) {
        // HER YER GÜVENLİYSE ŞOV YAP (Sadece yan şeritler de %100 boşsa)
        coolMoveTimer++;
        if (coolMoveTimer >= 3) {
            coolMoveTimer = 0;
            if (currentLane === 1) {
                if (safeLanes[0] && Math.random() > 0.5) moveLeft();
                else if (safeLanes[2]) moveRight();
            } else {
                if (safeLanes[1]) { currentLane = 1; targetX = lanes[1]; }
            }
        }
    }
}

// --- KONTROLLER ---
function handleKeyDown(e) {
    if (!gameActive || isBotMode) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') jump();
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duck();
    if (e.key === ' ' || e.code === 'Space') deploySkateboard();
}

function handleTouchStart(e) {
    if (isBotMode) return;
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 300 && tapLength > 0) {
        deploySkateboard();
        e.preventDefault();
    }
    lastTapTime = currentTime;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
    if (isBotMode) return;
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
}

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 50) moveRight();
        else if (diffX < -50) moveLeft();
    } else {
        if (diffY < -50) jump(); 
        else if (diffY > 50) duck(); 
    }
}

function moveLeft() {
    if (currentLane > 0) { currentLane--; targetX = lanes[currentLane]; }
}
function moveRight() {
    if (currentLane < 2) { currentLane++; targetX = lanes[currentLane]; }
}
function jump() {
    if (!isJumping) {
        isJumping = true; jumpVelocity = initialJumpForce;
        if (!hasSkateboard && runningAction && jumpingAction) {
            runningAction.stop(); jumpingAction.reset().play();
        }
    }
}
function duck() {
    if (isJumping) { jumpVelocity = -0.25; }
    else if (baseFloorY === 0.9 && player) { 
        player.scale.y = 0.5;
        if (skateboardMesh) skateboardMesh.scale.y = 2.0; 
        setTimeout(() => { 
            if (player) player.scale.y = 1.0; 
            if (skateboardMesh) skateboardMesh.scale.y = 1.0;
        }, 500);
    }
}

// --- ANA OYUN DÖNGÜSÜ ---
function animate() {
    if (gameActive) {
        requestAnimationFrame(animate);
    }

    const delta = clock.getDelta();
    const timeScale = Math.min(delta / 0.01667, 4.0); 

    if (isBotMode) updateBotAI();

    if (mixer && !hasSkateboard) mixer.update(delta);

    if (player) {
        // Yumuşak ve seri şerit geçiş hızı (0.35)
        let moveSpeed = isVideoMode ? 0.35 : 0.22;
        player.position.x += (targetX - player.position.x) * moveSpeed * timeScale;
        player.position.y += jumpVelocity * timeScale;
        
        if (player.position.y > baseFloorY || isJumping) {
            jumpVelocity -= gravity * timeScale;
        }

        if (player.position.y <= baseFloorY && !isJumping) {
            player.position.y = baseFloorY; 
            jumpVelocity = 0;
        } else if (player.position.y <= baseFloorY && isJumping) {
            player.position.y = baseFloorY; 
            isJumping = false; 
            jumpVelocity = 0;
            if (!hasSkateboard && jumpingAction && runningAction) {
                jumpingAction.stop(); 
                runningAction.reset().play();
            }
        }
    }

    let onATrain = false;

    // --- ENGELLER VE ÇARPIŞMA KONTROLÜ ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed * timeScale;

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const oBox = new THREE.Box3().setFromObject(obs);

            if (pBox.intersectsBox(oBox)) {
                if (obs.userData.type === 'train' && (player.position.y - 0.9) >= 2.0) {
                    baseFloorY = 3.6; onATrain = true;
                } else {
                    if (hasSkateboard) {
                        destroySkateboard(); scene.remove(obs); obstacles.splice(i, 1); continue;
                    } else { 
                        gameOver(); 
                    }
                }
            }
        }

        if (obs.position.z > 15) {
            scene.remove(obs); obstacles.splice(i, 1);
            
            score += isDoubleScoreActive ? 20 : 10;
            if (!isVideoMode) {
                document.getElementById('score-val').innerText = score;
            }

            if (score > 0 && Math.floor(score / 200) > Math.floor(lastPowerUpMilestone / 200)) {
                lastPowerUpMilestone = score;
                spawnPowerUp();
            }

            if (score > 0 && score % 100 === 0 && score !== lastSpeedMilestone) {
                lastSpeedMilestone = score; 
                if (speed < maxSpeed) speed = speed * 1.10; 
            }
        }
    }

    // --- ÖZELLİKLER (POWER-UPS) AKTİF DÖNGÜSÜ ---
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pUp = powerUps[i];
        pUp.position.z += speed * timeScale;
        pUp.rotation.y += 0.04 * timeScale;

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const puBox = new THREE.Box3().setFromObject(pUp);

            if (pBox.intersectsBox(puBox)) {
                if (pUp.userData.type === 'magnet') activateMagnet();
                else if (pUp.userData.type === 'doubleScore') activateDoubleScore();

                scene.remove(pUp);
                powerUps.splice(i, 1);
                continue;
            }
        }

        if (pUp.position.z > 15) {
            scene.remove(pUp);
            powerUps.splice(i, 1);
        }
    }

    // --- ALTINLAR DÖNGÜSÜ ---
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        
        if (isMagnetActive && player && coin.position.z < 10) {
            coin.position.x += (player.position.x - coin.position.x) * 0.18 * timeScale;
            coin.position.y += (player.position.y - coin.position.y) * 0.18 * timeScale;
            coin.position.z += (player.position.z - coin.position.z) * 0.18 * timeScale;
        } else {
            coin.position.z += speed * timeScale; 
        }
        
        coin.rotation.z += 0.05 * timeScale; 

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const cBox = new THREE.Box3().setFromObject(coin);

            if (pBox.intersectsBox(cBox)) {
                if (!isBotMode) {
                    totalGold += (1 * goldMultiplier);
                    saveGame(); 
                }
                if (!isVideoMode) {
                    document.getElementById('gold-val').innerText = totalGold;
                }
                scene.remove(coin);
                coins.splice(i, 1);
                continue;
            }
        }

        if (coin.position.z > 15) {
            scene.remove(coin);
            coins.splice(i, 1);
        }
    }

    if (!onATrain && baseFloorY !== 0.9) {
        baseFloorY = 0.9;
        if (player.position.y > 0.9 && !isJumping) { isJumping = true; jumpVelocity = 0; }
    }

    renderer.render(scene, camera);
}

// --- OYUN BİTTİ ---
function gameOver() {
    gameActive = false;
    saveGame(); 
    clearInterval(obstacleIntervalId);
    clearInterval(skateboardInterval);
    clearInterval(magnetInterval);
    clearInterval(doubleScoreInterval);
    
    document.getElementById('board-timer').style.display = 'none';
    document.getElementById('magnet-timer').style.display = 'none';
    document.getElementById('double-timer').style.display = 'none';

    isMagnetActive = false;
    isDoubleScoreActive = false;

    if (runningAction) runningAction.stop();
    if (jumpingAction) jumpingAction.stop();
    if (idleAction) idleAction.play(); 
    
    if (hasSkateboard && skateboardMesh && player) player.remove(skateboardMesh);

    document.getElementById('final-score').innerText = score;
    document.getElementById('final-gold').innerText = isBotMode ? "0 (Bot Modu)" : totalGold;
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- YENİDEN BAŞLAT VE SIFIRLA ---
function resetGame() {
    obstacles.forEach(obs => scene.remove(obs)); obstacles = [];
    coins.forEach(coin => scene.remove(coin)); coins = [];
    powerUps.forEach(pUp => scene.remove(pUp)); powerUps = [];

    currentLane = 1; targetX = lanes[currentLane]; baseFloorY = 0.9;
    if (player) { player.position.set(0, baseFloorY, 0); player.scale.y = 1.0; }
    
    isJumping = false; jumpVelocity = 0; score = 0;
    lastSpeedMilestone = 0; lastPowerUpMilestone = 0;
    hasSkateboard = false;
    isVideoMode = false;
    
    isMagnetActive = false; isDoubleScoreActive = false;

    document.getElementById('score-val').innerText = score;
    document.getElementById('game-over-screen').style.display = 'none';

    updateMenuUI();
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('ui').style.display = 'none';

    if (idleAction) idleAction.play();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;

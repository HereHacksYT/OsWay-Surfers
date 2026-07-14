// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player; 
let obstacles = [];
let coins = []; // Altın dizisi
let score = 0;
let totalGold = 0; // Toplam altın miktarı
let skateboardStock = 0; // Satın alınan kaykay sayısı
let lastSpeedMilestone = 0; 
let gameActive = false; 

// Hız Ayarları (%50 yavaşlatıldı)
let speed = 0.25; 
const maxSpeed = 1.8; 

// Kaykay Sistem Değişkenleri
let hasSkateboard = false;
let skateboardMesh = null;
let skateboardTimer = 15; // 15 saniye ömür
let skateboardInterval = null;
let lastTapTime = 0; 

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

// Mobil / Dokunmatik Kontrol Koordinatları (Swipe)
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// --- BAŞLANGIÇ ---
function init() {
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

    // Engelleri ve Altınları Üretme Döngüleri
    setInterval(spawnObstacle, 1100); 
    setInterval(spawnCoin, 800); 

    updateMenuUI();
    renderer.render(scene, camera);
}

// --- MARKET SİSTEMİ ---
function buyBoardsWithAllGold() {
    if (totalGold >= 5) {
        let boardsToBuy = Math.floor(totalGold / 5); 
        totalGold = totalGold % 5; 
        skateboardStock += boardsToBuy;
        console.log(`${boardsToBuy} adet kaykay alındı. Kalan altın: ${totalGold}`);
        updateMenuUI();
    } else {
        alert("Yeterli altının yok! Bir kaykay 5 Altın.");
    }
}

function updateMenuUI() {
    document.getElementById('menu-gold').innerText = `Altının: 🌟 ${totalGold}`;
    document.getElementById('menu-boards').innerText = `Kaykayın: 🛹 ${skateboardStock} adet`;
}

// --- OYUNU BAŞLATMA ---
function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    
    document.getElementById('gold-val').innerText = totalGold;
    document.getElementById('board-val').innerText = skateboardStock;

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
        // 1. Ana Tren Kasası
        const bodyGeo = new THREE.BoxGeometry(1.9, 2.7, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3c6382, metalness: 0.6, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.35;
        body.castShadow = true;
        obstacleGroup.add(body);

        // 2. Ön Cam Detayı
        const windowGeo = new THREE.BoxGeometry(1.7, 1.2, 0.1);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.1 });
        const frontWindow = new THREE.Mesh(windowGeo, windowMat);
        frontWindow.position.set(0, 1.8, 6.01);
        obstacleGroup.add(frontWindow);

        // 3. Ön Parlak Farlar
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
        // 1. Üst Geçit Çizgili Barı
        const barGeo = new THREE.BoxGeometry(2.2, 0.25, 0.25);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xf5cd79 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = 0.95;
        obstacleGroup.add(bar);

        // Şerit Süsleri (Çizgili bariyer görüntüsü için)
        const stripeGeo = new THREE.BoxGeometry(0.3, 0.27, 0.27);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1e272e });
        for (let i = -0.8; i <= 0.8; i += 0.4) {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(i, 0.95, 0);
            obstacleGroup.add(stripe);
        }

        // 2. Yan Metal Destek Ayakları
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

    obstacleGroup.position.set(lanes[laneIndex], 0, -120);
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
    coin.position.set(lanes[laneIndex], height, -120);

    scene.add(coin);
    coins.push(coin);
}

// --- PARILDAYAN ULTRA NEON KAYKAY TASARIMI ---
function deploySkateboard() {
    if (hasSkateboard || !gameActive || !player) return;
    if (skateboardStock <= 0) {
        console.log("Kullanacak kaykayın kalmadı! Marketten satın al.");
        return;
    }

    skateboardStock--;
    document.getElementById('board-val').innerText = skateboardStock;

    hasSkateboard = true;
    skateboardTimer = 15; 
    document.getElementById('board-timer').innerText = `Süre: ${skateboardTimer}`;
    document.getElementById('board-timer').style.display = 'block';

    // Kaliteli Neon Jet Kaykay Grubu
    const skateboardGroup = new THREE.Group();

    // 1. Parlayan Neon Malzeme (MeshPhong kullanarak ışık patlaması efekti veriyoruz)
    const neonMat = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff, 
        emissive: 0x00ffff, // Turkuaz neon parlaması
        emissiveIntensity: 1.5,
        shininess: 100
    });

    // 2. Kaykay Gövdesi (Aerodinamik, Uçları Havada)
    const boardGeo = new THREE.BoxGeometry(0.9, 0.12, 2.2);
    const boardMain = new THREE.Mesh(boardGeo, neonMat);
    skateboardGroup.add(boardMain);

    // Kıvrık Burun
    const noseGeo = new THREE.BoxGeometry(0.9, 0.25, 0.3);
    const nose = new THREE.Mesh(noseGeo, neonMat);
    nose.position.set(0, 0.12, 1.1);
    skateboardGroup.add(nose);

    // Kıvrık Kuyruk
    const tail = new THREE.Mesh(noseGeo, neonMat);
    tail.position.set(0, 0.12, -1.1);
    skateboardGroup.add(tail);

    // 3. Egzos Detayı (Kırmızı Neon Alev Çıkışı)
    const exhaustGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const exhaustMat = new THREE.MeshPhongMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 2.0 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, -0.12, -0.9);
    skateboardGroup.add(exhaust);

    skateboardMesh = skateboardGroup;
    skateboardMesh.position.set(0, -0.85, 0); 
    player.add(skateboardMesh);

    // --- KOŞMA ANİMASYONUNU KİLİTLE ---
    if (runningAction) {
        runningAction.stop(); 
    }

    skateboardInterval = setInterval(() => {
        if (!gameActive) {
            clearInterval(skateboardInterval);
            return;
        }
        skateboardTimer--;
        document.getElementById('board-timer').innerText = `Süre: ${skateboardTimer}`;
        
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
    
    if (runningAction && gameActive) {
        runningAction.play();
    }

    jumpVelocity = 0.15;
    isJumping = true;
}

// --- KONTROLLER ---
function handleKeyDown(e) {
    if (!gameActive) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') jump();
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duck();
    
    if (e.key === ' ' || e.code === 'Space') {
        deploySkateboard();
    }
}

function handleTouchStart(e) {
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
    if (currentLane > 0) {
        currentLane--;
        targetX = lanes[currentLane];
    }
}

function moveRight() {
    if (currentLane < 2) {
        currentLane++;
        targetX = lanes[currentLane];
    }
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        jumpVelocity = initialJumpForce;
        
        if (!hasSkateboard && runningAction && jumpingAction) {
            runningAction.stop();
            jumpingAction.reset().play();
        }
    }
}

function duck() {
    if (isJumping) {
        jumpVelocity = -0.25; 
    } else if (baseFloorY === 0.9) { 
        if (player) {
            player.scale.y = 0.5;
            if (skateboardMesh) skateboardMesh.scale.y = 2.0; 
            setTimeout(() => { 
                if (player) player.scale.y = 1.0; 
                if (skateboardMesh) skateboardMesh.scale.y = 1.0;
            }, 500);
        }
    }
}

// --- ANA OYUN DÖNGÜSÜ ---
function animate() {
    if (gameActive) {
        requestAnimationFrame(animate);
    }

    const delta = clock.getDelta();
    if (mixer && !hasSkateboard) {
        mixer.update(delta);
    }

    if (player) {
        player.position.x += (targetX - player.position.x) * 0.22;
        player.position.y += jumpVelocity;
        
        if (player.position.y > baseFloorY || isJumping) {
            jumpVelocity -= gravity;
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

    // 1. Engellerin Hareketi ve Çarpışma Testi
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed; 

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const oBox = new THREE.Box3().setFromObject(obs);

            if (pBox.intersectsBox(oBox)) {
                if (obs.userData.type === 'train' && (player.position.y - 0.9) >= 2.0) {
                    baseFloorY = 3.6; 
                    onATrain = true;
                } else {
                    if (hasSkateboard) {
                        destroySkateboard(); 
                        scene.remove(obs);   
                        obstacles.splice(i, 1);
                        continue;
                    } else {
                        gameOver(); 
                    }
                }
            }
        }

        if (obs.position.z > 15) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            score += 10;
            document.getElementById('score-val').innerText = score;

            if (score > 0 && score % 100 === 0 && score !== lastSpeedMilestone) {
                lastSpeedMilestone = score; 
                if (speed < maxSpeed) {
                    speed = speed * 1.10; 
                    console.log("Hız %10 Artarak Güncellendi! Yeni Hız:", speed);
                }
            }
        }
    }

    // 2. Altınların Hareketi, Dönüşü ve Toplanması
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.position.z += speed; 
        coin.rotation.z += 0.05; 

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const cBox = new THREE.Box3().setFromObject(coin);

            if (pBox.intersectsBox(cBox)) {
                totalGold += 1; 
                document.getElementById('gold-val').innerText = totalGold;
                
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
        if (player.position.y > 0.9 && !isJumping) {
            isJumping = true; 
            jumpVelocity = 0;
        }
    }

    renderer.render(scene, camera);
}

// --- OYUN BİTTİ ---
function gameOver() {
    gameActive = false;
    clearInterval(skateboardInterval);
    document.getElementById('board-timer').style.display = 'none';

    if (runningAction) runningAction.stop();
    if (jumpingAction) jumpingAction.stop();
    if (idleAction) idleAction.play(); 
    
    if (hasSkateboard && skateboardMesh && player) {
        player.remove(skateboardMesh);
    }

    document.getElementById('final-score').innerText = score;
    document.getElementById('final-gold').innerText = totalGold;
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- YENİDEN BAŞLAT VE SIFIRLA ---
function resetGame() {
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    
    coins.forEach(coin => scene.remove(coin));
    coins = [];

    currentLane = 1;
    targetX = lanes[currentLane];
    baseFloorY = 0.9;
    if (player) {
        player.position.set(0, baseFloorY, 0);
        player.scale.y = 1.0;
    }
    isJumping = false;
    jumpVelocity = 0;
    score = 0;
    lastSpeedMilestone = 0;
    speed = 0.25; 
    hasSkateboard = false;

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

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
let skateboardTimer = 15; // 15 saniye ömrü var
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
    setInterval(spawnCoin, 800); // Sık sık altın gelsin

    updateMenuUI();
    renderer.render(scene, camera);
}

// --- MARKET SİSTEMİ (TÜM PARAYLA KAYKAY ALMA) ---
function buyBoardsWithAllGold() {
    if (totalGold >= 5) {
        let boardsToBuy = Math.floor(totalGold / 5); // Ne kadar yetiyorsa o kadar al
        totalGold = totalGold % 5; // Kalan altını bırak
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

// --- METRO RAYLARI ---
function createSubwayTracks() {
    const roadGeo = new THREE.PlaneGeometry(12, 1000);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -450;
    road.receiveShadow = true;
    scene.add(road);

    for (let i = 0; i < lanes.length; i++) {
        const trackGeo = new THREE.BoxGeometry(0.3, 0.1, 1000);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.8 });
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(lanes[i], 0.05, -450);
        scene.add(track);
    }
}

// --- ENGELLERİ ÜRET ---
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

        obstacleGroup.userData = { type: 'train', heightLimit: 2.7 };
    } else {
        const barGeo = new THREE.BoxGeometry(2.2, 0.25, 0.25);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xf5cd79 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = 0.95;
        obstacleGroup.add(bar);

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

    // Engel olmayan boş alanlara ya da tren üstlerine altın koymak için rastgele bir şerit seç
    const laneIndex = Math.floor(Math.random() * 3);
    
    // Altınların duracağı yükseklik: %30 ihtimalle tren üstü hizasında, %70 havada/yerde
    const isHigh = Math.random() > 0.7;
    const height = isHigh ? 4.0 : 1.2;

    // Havalı parıldayan dönen altın silindiri (bozuk para görünümü)
    const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    const coinMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd700, 
        metalness: 0.9, 
        roughness: 0.1,
        emissive: 0xffb300,
        emissiveIntensity: 0.3
    });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.rotation.x = Math.PI / 2; // Dik dursun
    coin.castShadow = true;
    coin.position.set(lanes[laneIndex], height, -120);

    scene.add(coin);
    coins.push(coin);
}

// --- KALİTELİ KAYKAY (HOVERBOARD) MEKANİĞİ ---
function deploySkateboard() {
    if (hasSkateboard || !gameActive || !player) return;
    if (skateboardStock <= 0) {
        console.log("Kullanacak kaykayın kalmadı! Marketten satın al.");
        return;
    }

    // Stok düşür ve güncelle
    skateboardStock--;
    document.getElementById('board-val').innerText = skateboardStock;

    hasSkateboard = true;
    skateboardTimer = 15; // 15 saniye ömür
    document.getElementById('board-timer').innerText = `Süre: ${skateboardTimer}`;
    document.getElementById('board-timer').style.display = 'block';

    // Kaliteli Kıvrımlı Jet Kaykay Tasarımı
    const skateboardGroup = new THREE.Group();

    // 1. Kaykay Gövdesi (Ana Tahta)
    const boardGeo = new THREE.BoxGeometry(1.0, 0.15, 2.2);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x00d2d3, roughness: 0.2 });
    const boardMain = new THREE.Mesh(boardGeo, boardMat);
    skateboardGroup.add(boardMain);

    // 2. Ön ve Arka Kıvrım Detayları
    const noseGeo = new THREE.BoxGeometry(1.0, 0.3, 0.3);
    const nose = new THREE.Mesh(noseGeo, boardMat);
    nose.position.set(0, 0.15, 1.1);
    skateboardGroup.add(nose);

    const tail = new THREE.Mesh(noseGeo, boardMat);
    tail.position.set(0, 0.15, -1.1);
    skateboardGroup.add(tail);

    // 3. Altındaki Parlayan Neon Jet Motoru (Egzos)
    const jetGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const jetMat = new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 1.5 });
    const jet = new THREE.Mesh(jetGeo, jetMat);
    jet.rotation.x = Math.PI / 2;
    jet.position.set(0, -0.15, -0.8);
    skateboardGroup.add(jet);

    skateboardMesh = skateboardGroup;
    skateboardMesh.position.set(0, -0.85, 0); 
    player.add(skateboardMesh);

    // --- ANIMASYONUNU DURDUR ---
    if (runningAction) {
        runningAction.stop(); // Kaykaydayken koşma animasyonunu kilitliyoruz
    }

    // 15 Saniyelik Geri Sayım Sayacı
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
    
    // Koşma animasyonunu tekrar başlat
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
        
        // Sadece kaykay yoksa zıplama animasyonunu oynat
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
    // Kaykay yoksa animasyonu normal sürdür, varsa robotun animasyon motorunu güncelleme
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

            // --- 100 PUANDA BİR %10 HIZLANMA FORMÜLÜ ---
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
        coin.rotation.z += 0.05; // Kendi etrafında dönme efekti

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const cBox = new THREE.Box3().setFromObject(coin);

            // Oyuncu altına çarparsa (toplarsa)
            if (pBox.intersectsBox(cBox)) {
                totalGold += 1; // Altını artır
                document.getElementById('gold-val').innerText = totalGold;
                
                scene.remove(coin);
                coins.splice(i, 1);
                continue;
            }
        }

        // Ekrandan çıkan altını sil
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
    speed = 0.25; // %50 düşürülmüş başlangıç hızı
    hasSkateboard = false;

    // Skor göstergelerini sıfırla ama toplam altını ve kaykay stokunu koru!
    document.getElementById('score-val').innerText = score;
    document.getElementById('game-over-screen').style.display = 'none';

    // Menüye geri dönüp marketi göster
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

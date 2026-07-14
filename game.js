// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player; 
let obstacles = [];
let score = 0;
let lastSpeedMilestone = 0; 
let gameActive = false; 

// Hız Ayarları (%50 yavaşlatıldı: 0.5 yerine 0.25 ile başlıyoruz)
let speed = 0.25; 
const maxSpeed = 1.8; 

// Kaykay (Hoverboard) Sistem Değişkenleri
let hasSkateboard = false;
let skateboardMesh = null;
let lastTapTime = 0; // Çift dokunmayı algılamak için

// Animasyon Değişkenleri
let mixer; 
let clock = new THREE.Clock();
let runningAction, jumpingAction, idleAction;

// Şeritler: Sol (-3), Orta (0), Sağ (3)
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

// --- BAŞLANGIÇ (INITIALIZATION) ---
function init() {
    const container = document.getElementById('canvas-container');
    
    // 1. Sahne ve Kamera Kurulumu
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // Gece metrosu havası için koyu mavi/mor gökyüzü
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10); 
    camera.lookAt(0, 2, -10);

    // 2. Renderer (Görselleştirici)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Işıklandırma (Neon ve Gölgeler İçin Güçlendirildi)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 4. Yol Tasarımı (Metro Rayları)
    createSubwayTracks();

    // 5. İnternetten Animasyonlu 3D Karakter Yükleme
    loadOnline3DCharacter();

    // 6. Kontrol Dinleyicileri (Klavye + Mobil Dokunmatik + Çift Tıklama)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, false);
    window.addEventListener('touchend', handleTouchEnd, false);
    window.addEventListener('resize', onWindowResize);

    // 7. Engelleri Sürekli Üretme Döngüsü
    setInterval(spawnObstacle, 1100); 

    // İlk kareyi çiz
    renderer.render(scene, camera);
}

// --- OYUNU BAŞLATMA ---
function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
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

// --- DETAYLI VE KALİTELİ METRO TASARIMI ---
function createSubwayTracks() {
    // Ana Yol
    const roadGeo = new THREE.PlaneGeometry(12, 1000);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -450;
    road.receiveShadow = true;
    scene.add(road);

    // Yan Duvarlar (Metro Tüneli Hissiyatı)
    const wallGeo = new THREE.BoxGeometry(0.5, 15, 1000);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7 });
    
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-6.5, 7.5, -450);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(6.5, 7.5, -450);
    scene.add(rightWall);

    // Şeritleri ayıran parlak raylar
    for (let i = 0; i < lanes.length; i++) {
        const trackGeo = new THREE.BoxGeometry(0.3, 0.1, 1000);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.8 });
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(lanes[i], 0.05, -450);
        scene.add(track);
    }
}

// --- KALİTELİ 3D ENGELLER VE TREN MODELLERİ (GRUP TASARIMI) ---
function spawnObstacle() {
    if (!gameActive) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const obstacleType = Math.random() > 0.45 ? 'train' : 'barrier';

    const obstacleGroup = new THREE.Group();

    if (obstacleType === 'train') {
        // --- DETAYLI TREN TASARIMI ---
        // 1. Ana Vagon Gövdesi
        const bodyGeo = new THREE.BoxGeometry(1.9, 2.7, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3c6382, metalness: 0.6, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.35;
        body.castShadow = true;
        obstacleGroup.add(body);

        // 2. Ön Cam (Siyah Parlak Kesim)
        const windowGeo = new THREE.BoxGeometry(1.7, 1.2, 0.1);
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.1 });
        const frontWindow = new THREE.Mesh(windowGeo, windowMat);
        frontWindow.position.set(0, 1.8, 6.01); // Ön yüze yapıştır
        obstacleGroup.add(frontWindow);

        // 3. Ön Farlar (Sarı Parlak Silindirler)
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
        // --- DETAYLI METRO BARİYERİ ---
        // 1. Üst Geçit Barı (Çizgili Sarı/Siyah Tasarım)
        const barGeo = new THREE.BoxGeometry(2.2, 0.25, 0.25);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xf5cd79 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.y = 0.95;
        obstacleGroup.add(bar);

        // Şerit Süsleri
        const stripeGeo = new THREE.BoxGeometry(0.3, 0.27, 0.27);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1e272e });
        for (let i = -0.8; i <= 0.8; i += 0.4) {
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(i, 0.95, 0);
            obstacleGroup.add(stripe);
        }

        // 2. Yan Ayaklar (Metal Direkler)
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

// --- KAYKAY (HOVERBOARD) MEKANİĞİ ---
function deploySkateboard() {
    if (hasSkateboard || !gameActive || !player) return;

    hasSkateboard = true;
    console.log("Kaykay Aktif Edildi! Çarpma Koruması Devrede.");

    // Havalı parlayan mavi bir hoverboard oluşturuyoruz
    const boardGeo = new THREE.BoxGeometry(1.0, 0.15, 2.0);
    const boardMat = new THREE.MeshStandardMaterial({ 
        color: 0x00d2d3, 
        emissive: 0x00d2d3, // Kendi kendine parlama (Neon efekti)
        emissiveIntensity: 0.8,
        roughness: 0.2 
    });
    skateboardMesh = new THREE.Mesh(boardGeo, boardMat);
    skateboardMesh.position.set(0, -0.85, 0); // Karakterin hemen ayağının altına bağla
    player.add(skateboardMesh);
}

function destroySkateboard() {
    if (!hasSkateboard) return;
    
    // Kaykayı kır/yok et (Neon efekti silinir)
    if (skateboardMesh && player) {
        player.remove(skateboardMesh);
        skateboardMesh = null;
    }
    hasSkateboard = false;
    console.log("Kaykay Kırıldı! Koruma Kalkanı Düştü.");
    
    // Kısa süreliğine karakteri hafif havaya zıplatıp kurtulmasını sağla
    jumpVelocity = 0.15;
    isJumping = true;
}

// --- KONTROLLER VE ÇİFT DOKUNMA ALGILAYICI ---
function handleKeyDown(e) {
    if (!gameActive) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') jump();
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duck();
    
    // Boşluk Tuşu ile Kaykay Çağırma
    if (e.key === ' ' || e.code === 'Space') {
        deploySkateboard();
    }
}

function handleTouchStart(e) {
    // Çift Dokunma Kontrolü (Kaykay çağırmak için)
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 300 && tapLength > 0) {
        deploySkateboard();
        e.preventDefault(); // Varsayılan tarayıcı zoom'unu engelle
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
        
        if (runningAction && jumpingAction) {
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
            if (skateboardMesh) skateboardMesh.scale.y = 2.0; // Kaykayın boyutu korunur
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
    if (mixer) mixer.update(delta);

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
            if (jumpingAction && runningAction) {
                jumpingAction.stop();
                runningAction.reset().play();
            }
        }
    }

    let onATrain = false;

    // Engellerin Hareketi ve Çarpışma Testleri
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed; 

        if (player) {
            const pBox = new THREE.Box3().setFromObject(player);
            const oBox = new THREE.Box3().setFromObject(obs);

            if (pBox.intersectsBox(oBox)) {
                // Tren Üzerinde Durma Hesabı
                if (obs.userData.type === 'train' && (player.position.y - 0.9) >= 2.0) {
                    baseFloorY = 3.6; // Tren tepesi yüksekliği
                    onATrain = true;
                } else {
                    // --- ÇARPIŞMA ANINDA KAYKAY KORUMASI ---
                    if (hasSkateboard) {
                        destroySkateboard(); // Kaykay kırılır, oyuncu kurtulur
                        scene.remove(obs);   // Çarpılan engeli patlatarak temizle
                        obstacles.splice(i, 1);
                        continue;
                    } else {
                        gameOver(); // Kaykay yoksa oyun biter
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
                    speed = speed * 1.10; // %10 artış yapıldı
                    console.log("Hız %10 Artarak Güncellendi! Yeni Hız:", speed);
                }
            }
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
    if (runningAction) runningAction.stop();
    if (jumpingAction) jumpingAction.stop();
    if (idleAction) idleAction.play(); 
    
    // Kaykayı temizle
    if (hasSkateboard) destroySkateboard();

    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- YENİDEN BAŞLAT ---
function resetGame() {
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    
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
    
    // Başlangıç hızını %50 azaltılmış haliyle sıfırla (0.25)
    speed = 0.25; 
    hasSkateboard = false;

    document.getElementById('score-val').innerText = score;
    document.getElementById('game-over-screen').style.display = 'none';

    if (idleAction) idleAction.stop();
    if (runningAction) runningAction.reset().play();

    gameActive = true;
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;

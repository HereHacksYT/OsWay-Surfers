// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player; 
let obstacles = [];
let score = 0;
let gameActive = true;
let speed = 0.5; 
const maxSpeed = 1.5; 

// Animasyon Değişkenleri
let mixer; // Karakterin animasyonlarını oynatacak motor
let clock = new THREE.Clock();
let runningAction, jumpingAction, idleAction;

// Şeritler: Sol (-3), Orta (0), Sağ (3)
const lanes = [-3, 0, 3];
let currentLane = 1; 
let targetX = lanes[currentLane];

// Zıplama ve Eğilme (Aşağı İnme) Fiziği
let isJumping = false;
let jumpVelocity = 0;
const gravity = 0.015;
const initialJumpForce = 0.35;

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
    scene.background = new THREE.Color(0xa0a0a0); 
    scene.fog = new THREE.FogExp2(0xa0a0a0, 0.015); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10); 
    camera.lookAt(0, 2, -10);

    // 2. Renderer (Görselleştirici)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Işıklandırma
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 4. Yol Tasarımı (Metro Rayları)
    createSubwayTracks();

    // 5. İnternetten Animasyonlu 3D Karakter Yükleme
    loadOnline3DCharacter();

    // 6. Kontrol Dinleyicileri (Klavye + Mobil Dokunmatik)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, false);
    window.addEventListener('touchend', handleTouchEnd, false);
    window.addEventListener('resize', onWindowResize);

    // 7. Engelleri Sürekli Üretme Döngüsü
    setInterval(spawnObstacle, 900); 

    // Döngüyü Başlat
    animate();
}

// --- İNTERNETTEN ANIMASYONLU 3D MODEL ÇEKEN FONKSİYON ---
function loadOnline3DCharacter() {
    const loader = new THREE.GLTFLoader();
    
    // Karakter yüklenene kadar sahnede duracak görünmez çarpışma kutusu
    const placeholderGeo = new THREE.BoxGeometry(1.2, 1.8, 1.2);
    const placeholderMat = new THREE.MeshBasicMaterial({ visible: false }); 
    player = new THREE.Mesh(placeholderGeo, placeholderMat);
    player.position.set(0, 0.9, 0);
    scene.add(player);

    const modelUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

    loader.load(modelUrl, function (gltf) {
        const model = gltf.scene;
        
        model.scale.set(0.4, 0.4, 0.4); 
        model.position.set(0, -0.9, 0); 
        model.rotation.y = Math.PI; // İleri doğru baksın
        
        model.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Modeli ana oyuncu nesnesine ekle
        player.add(model);

        // --- ANIMASYON MOTORUNU AKTIF ETME ---
        mixer = new THREE.AnimationMixer(model);
        
        // Modelin içindeki hazır animasyonları isimlerine göre buluyoruz
        const clips = gltf.animations;
        const runningClip = THREE.AnimationClip.findByName(clips, 'Running');
        const jumpClip = THREE.AnimationClip.findByName(clips, 'Jump');
        const idleClip = THREE.AnimationClip.findByName(clips, 'Idle');

        if (runningClip) runningAction = mixer.clipAction(runningClip);
        if (jumpClip) jumpingAction = mixer.clipAction(jumpClip);
        if (idleClip) idleAction = mixer.clipAction(idleClip);

        // Oyuna koşarak başlasın
        if (runningAction) runningAction.play();

        console.log("Animasyonlu 3D Karakter Başarıyla Bağlandı!");
    }, undefined, function (error) {
        console.error("Model yüklenemedi, küp moduna dönülüyor:", error);
        player.material.visible = true;
        player.material.color.setHex(0x2ed573);
    });
}

// --- METRO RAYLARI VE YOL TASARIMI ---
function createSubwayTracks() {
    const roadGeo = new THREE.PlaneGeometry(12, 1000);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -450;
    road.receiveShadow = true;
    scene.add(road);

    for (let i = 0; i < lanes.length; i++) {
        const trackGeo = new THREE.BoxGeometry(0.2, 0.05, 1000);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0xfff200 }); 
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(lanes[i], 0.02, -450);
        scene.add(track);
    }
}

// --- ENGEL ÜRETİCİ ---
function spawnObstacle() {
    if (!gameActive) return;

    const laneIndex = Math.floor(Math.random() * 3);
    const obstacleType = Math.random() > 0.4 ? 'train' : 'barrier';

    let geo, mat, height;
    
    if (obstacleType === 'train') {
        geo = new THREE.BoxGeometry(1.8, 3, 8);
        mat = new THREE.MeshStandardMaterial({ color: 0xff4757, metalness: 0.4, roughness: 0.2 });
        height = 1.5;
    } else {
        geo = new THREE.BoxGeometry(2, 1, 0.5);
        mat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.5 });
        height = 0.5;
    }

    const obs = new THREE.Mesh(geo, mat);
    obs.position.set(lanes[laneIndex], height, -120); 
    obs.castShadow = true;

    scene.add(obs);
    obstacles.push(obs);
}

// --- KLAVYE KONTROLLERİ ---
function handleKeyDown(e) {
    if (!gameActive) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveLeft();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveRight();
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        jump();
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        duck(); // Aşağı basınca eğilme tetiklensin
    }
}

// --- MOBİL DOKUNMATİK (SWIPE) KONTROLLERİ ---
function handleTouchStart(e) {
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
        if (diffX > 50) {
            moveRight();
        } else if (diffX < -50) {
            moveLeft();
        }
    } else {
        if (diffY < -50) {
            jump(); // Yukarı kaydırınca zıpla
        } else if (diffY > 50) {
            duck(); // Aşağı kaydırınca eğil/hızlıca yere in
        }
    }
}

// --- HAREKET VE MEKANİK FONKSİYONLARI ---
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
        
        // Zıplama animasyonuna geçiş yap
        if (runningAction && jumpingAction) {
            runningAction.stop();
            jumpingAction.reset().play();
        }
    }
}

// Aşağı Kaydırma / Eğilme Mekaniği
function duck() {
    if (isJumping) {
        // Eğer havadaysak, hızla yere çakılmasını sağla (Subway mekaniği)
        jumpVelocity = -0.2;
    } else {
        // Yerdeysek, karakterin boyunu geçici olarak kısaltıp eğilme efekti veriyoruz
        if (player) {
            player.scale.y = 0.5; // Karakteri yassılaştır
            setTimeout(() => {
                if (player) player.scale.y = 1.0; // 0.5 saniye sonra eski haline döndür
            }, 500);
        }
    }
}

// --- ANA OYUN DÖNGÜSÜ ---
function animate() {
    if (gameActive) {
        requestAnimationFrame(animate);
    }

    // Delta zamanını alarak animasyonları güncelle
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    if (player) {
        // Yumuşak Şerit Geçişi (Lerp)
        player.position.x += (targetX - player.position.x) * 0.22;

        // Zıplama ve Yerçekimi Fiziği
        if (isJumping) {
            player.position.y += jumpVelocity;
            jumpVelocity -= gravity;

            if (player.position.y <= 0.9) {
                player.position.y = 0.9;
                isJumping = false;
                jumpVelocity = 0;
                
                // Yere basınca tekrar koşma animasyonuna dön
                if (jumpingAction && runningAction) {
                    jumpingAction.stop();
                    runningAction.reset().play();
                }
            }
        }
    }

    // Engellerin Hareketi ve Çarpışma Testi
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed; 

        if (player && checkCollision(player, obs)) {
            gameOver();
        }

        if (obs.position.z > 15) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            score += 10;
            document.getElementById('score-val').innerText = score;

            if (speed < maxSpeed) {
                speed += 0.008;
            }
        }
    }

    renderer.render(scene, camera);
}

// --- ÇARPIŞMA SİSTEMİ ---
function checkCollision(obj1, obj2) {
    const box1 = new THREE.Box3().setFromObject(obj1);
    const box2 = new THREE.Box3().setFromObject(obj2);
    return box1.intersectsBox(box2);
}

// --- OYUN BİTTİ EKRANI ---
function gameOver() {
    gameActive = false;
    if (runningAction) runningAction.stop();
    if (jumpingAction) jumpingAction.stop();
    if (idleAction) idleAction.play(); // Yanınca üzgün/sabit dursun
    
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- OYUNU SIFIRLA ---
function resetGame() {
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    
    currentLane = 1;
    targetX = lanes[currentLane];
    if (player) {
        player.position.set(0, 0.9, 0);
        player.scale.y = 1.0;
    }
    isJumping = false;
    jumpVelocity = 0;
    score = 0;
    speed = 0.5;

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

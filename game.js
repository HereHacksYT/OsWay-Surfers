// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player; 
let obstacles = [];
let score = 0;
let lastSpeedMilestone = 0; // Hızlanmayı 100 puanda bir tetiklemek için
let gameActive = false; // Oyun başta BAŞLA tuşuna basılana kadar duracak
let speed = 0.5; // Başlangıç hızı
const maxSpeed = 2.0; 

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
let baseFloorY = 0.9; // Normalde yer yüksekliği 0.9

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

    // İlk kareyi çiz ama gameActive false olduğu için döngü BAŞLA'ya basana kadar bekleyecek
    renderer.render(scene, camera);
}

// --- OYUNU BAŞLATMA TUŞU FONKSİYONU ---
function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    gameActive = true;
    
    if (idleAction) idleAction.stop();
    if (runningAction) runningAction.play();
    
    clock.getDelta(); // Zaman sayacını sıfırla
    animate();
}

// --- İNTERNETTEN ANIMASYONLU 3D MODEL ÇEKEN FONKSİYON ---
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

        // Başlangıçta menüde sabit dursun
        if (idleAction) idleAction.play();

        renderer.render(scene, camera); // Karakter gelince sahneyi bir kez yenile
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
        geo = new THREE.BoxGeometry(1.8, 3, 12); // Tren boyunu azıcık uzattık üstünde koşmak kolay olsun
        mat = new THREE.MeshStandardMaterial({ color: 0xff4757, metalness: 0.4, roughness: 0.2 });
        height = 1.5; // Trenin merkez yüksekliği
    } else {
        geo = new THREE.BoxGeometry(2, 1, 0.5);
        mat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.5 });
        height = 0.5;
    }

    const obs = new THREE.Mesh(geo, mat);
    obs.position.set(lanes[laneIndex], height, -120); 
    obs.castShadow = true;
    
    // Çarpışma hesaplarında türünü bilmek için etiketliyoruz
    obs.userData = { type: obstacleType };

    scene.add(obs);
    obstacles.push(obs);
}

// --- KONTROLLER ---
function handleKeyDown(e) {
    if (!gameActive) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') jump();
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duck();
}

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
        jumpVelocity = -0.25; // Havadaysak hızlıca aşağı çakıl
    } else if (baseFloorY === 0.9) { // Eğer tren üstünde değilsek normal eğil
        if (player) {
            player.scale.y = 0.5;
            setTimeout(() => { if (player) player.scale.y = 1.0; }, 500);
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

        // Yerçekimi ve Zıplama Fiziği (Dinamik Taban Yüksekliği ile)
        player.position.y += jumpVelocity;
        
        if (player.position.y > baseFloorY || isJumping) {
            jumpVelocity -= gravity;
        }

        // Karakter taban yüksekliğinin altına düşerse zemine sabitle
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

    // Varsayılan olarak zemini yer (0.9) kabul et, tren üstündeysek değişecek
    let onATrain = false;

    // Engellerin Hareketi ve Gelişmiş Çarpışma Testi
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed; 

        if (player) {
            // Oyuncu ve engelin kutu koordinatlarını al
            const pBox = new THREE.Box3().setFromObject(player);
            const oBox = new THREE.Box3().setFromObject(obs);

            if (pBox.intersectsBox(oBox)) {
                // Eğer çarptığımız şey TREN ise ve oyuncunun alt hizası trenin üstündeyse: üstüne bas!
                if (obs.userData.type === 'train' && (player.position.y - 0.9) >= 2.5) {
                    baseFloorY = 3.9; // Trenin üst yüzey yüksekliği (Merkez 1.5 + BoyY/2(1.5) + OyuncuMerkez(0.9) = ~3.9)
                    onATrain = true;
                } else {
                    // Trenin ön yüzüne çarptıysak veya bariyerse GAME OVER
                    gameOver();
                }
            }
        }

        // Ekranın arkasına geçen engelleri temizle ve skor ekle
        if (obs.position.z > 15) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            score += 10;
            document.getElementById('score-val').innerText = score;

            // --- 100 PUANDA BİR 0.1 HIZLANMA MEKANİĞİ ---
            if (score > 0 && score % 100 === 0 && score !== lastSpeedMilestone) {
                lastSpeedMilestone = score; // Aynı yüzde birden fazla tetiklenmeyi önle
                if (speed < maxSpeed) {
                    speed += 0.1;
                    console.log("Hız arttı! Yeni Hız:", speed);
                }
            }
        }
    }

    // Eğer hiçbir trenin üstünde değilsek ve havada değilsek yumuşakça yere geri düşmesini sağla
    if (!onATrain && baseFloorY !== 0.9) {
        baseFloorY = 0.9;
        if (player.position.y > 0.9 && !isJumping) {
            isJumping = true; // Yerçekiminin devreye girmesi için zıplama modunu tetikle
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

// --- OYUN AYARLARI ---
let scene, camera, renderer;
let player;
let obstacles = [];
let score = 0;
let gameActive = true;
let speed = 0.5; // Başlangıç hızı
const maxSpeed = 1.5; // Maksimum limit hız

// Şeritler: Sol (-3), Orta (0), Sağ (3)
const lanes = [-3, 0, 3];
let currentLane = 1; // Başlangıçta orta şerit
let targetX = lanes[currentLane];

// Zıplama Fiziği
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
    scene.background = new THREE.Color(0xa0a0a0); // Gri gökyüzü havası
    scene.fog = new THREE.FogExp2(0xa0a0a0, 0.015); // İlerideki sis efekti (Subway havası)

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10); // Karakterin arkasından ve yukarısından bakış
    camera.lookAt(0, 2, -10);

    // 2. Renderer (Görselleştirici)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Işıklandırma
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 4. Yol Tasarımı (Metro Rayları)
    createSubwayTracks();

    // 5. Oyuncu Karakteri (Yeşil Küp - OsWay Kahramanı)
    const playerGeo = new THREE.BoxGeometry(1.2, 1.8, 1.2);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x2ed573, roughness: 0.3 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 0.9, 0);
    player.castShadow = true;
    scene.add(player);

    // 6. Kontrol Dinleyicileri (Klavye + Mobil Dokunmatik)
    window.addEventListener('keydown', handleKeyDown);
    
    // Mobil Swipe (Kaydırma) Algılayıcıları
    window.addEventListener('touchstart', handleTouchStart, false);
    window.addEventListener('touchend', handleTouchEnd, false);
    
    window.addEventListener('resize', onWindowResize);

    // 7. Engelleri Sürekli Üretme Döngüsü
    setInterval(spawnObstacle, 900); // Her 0.9 saniyede bir yeni engel gelir

    // Döngüyü Başlat
    animate();
}

// --- METRO RAYLARI VE YOL TASARIMI ---
function createSubwayTracks() {
    // Ana Yol Plakası
    const roadGeo = new THREE.PlaneGeometry(12, 1000);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -450;
    road.receiveShadow = true;
    scene.add(road);

    // Üç Şerit İçin Ray Çizgileri
    for (let i = 0; i < lanes.length; i++) {
        const trackGeo = new THREE.BoxGeometry(0.2, 0.05, 1000);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0xfff200 }); // Sarı ray çizgileri
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(lanes[i], 0.02, -450);
        scene.add(track);
    }
}

// --- ENGEL ÜRETİCİ (TRENLER VE BARİYERLER) ---
function spawnObstacle() {
    if (!gameActive) return;

    // Rastgele bir şerit seç (Sol, Orta, Sağ)
    const laneIndex = Math.floor(Math.random() * 3);
    
    // %60 ihtimalle tren, %40 ihtimalle alçak bariyer
    const obstacleType = Math.random() > 0.4 ? 'train' : 'barrier';

    let geo, mat, height;
    
    if (obstacleType === 'train') {
        // Tren: Uzun ve yüksek kırmızı bir vagon
        geo = new THREE.BoxGeometry(1.8, 3, 8);
        mat = new THREE.MeshStandardMaterial({ color: 0xff4757, metalness: 0.4, roughness: 0.2 });
        height = 1.5;
    } else {
        // Bariyer: Üstünden atlanabilen alçak sarı engel
        geo = new THREE.BoxGeometry(2, 1, 0.5);
        mat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.5 });
        height = 0.5;
    }

    const obs = new THREE.Mesh(geo, mat);
    obs.position.set(lanes[laneIndex], height, -120); // İleride üretilip bize doğru gelecek
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
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')) {
        jump();
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

    // Yatayda mı dikeyde mi daha çok kaydırılmış?
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Yatay kaydırma
        if (diffX > 50) {
            moveRight();
        } else if (diffX < -50) {
            moveLeft();
        }
    } else {
        // Dikey kaydırma
        if (diffY < -50) {
            jump(); // Yukarı kaydırınca zıpla
        }
    }
}

// --- HAREKET FONKSİYONLARI ---
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
    }
}

// --- ANA OYUN DÖNGÜSÜ ---
function animate() {
    if (gameActive) {
        requestAnimationFrame(animate);
    }

    // 1. Yumuşak Şerit Geçişi (Lerp mekaniği)
    player.position.x += (targetX - player.position.x) * 0.22;

    // 2. Zıplama ve Yerçekimi Fiziği
    if (isJumping) {
        player.position.y += jumpVelocity;
        jumpVelocity -= gravity;

        // Yere inme kontrolü
        if (player.position.y <= 0.9) {
            player.position.y = 0.9;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    // 3. Engellerin Hareketi ve Çarpışma Testi
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed; // Engelleri oyuncuya doğru yaklaştır

        // Çarpışma Kontrolü (Bounding Box)
        if (checkCollision(player, obs)) {
            gameOver();
        }

        // Ekranı geçen engelleri temizle ve skor ekle
        if (obs.position.z > 15) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            score += 10;
            document.getElementById('score-val').innerText = score;

            // Oyun ilerledikçe hızı artır
            if (speed < maxSpeed) {
                speed += 0.008;
            }
        }
    }

    renderer.render(scene, camera);
}

// --- BASİT 3D KUTU ÇARPIŞMA SİSTEMİ (AABB) ---
function checkCollision(obj1, obj2) {
    const box1 = new THREE.Box3().setFromObject(obj1);
    const box2 = new THREE.Box3().setFromObject(obj2);
    return box1.intersectsBox(box2);
}

// --- OYUN BİTTİ EKRANI ---
function gameOver() {
    gameActive = false;
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- OYUNU SIFIRLA / YENİDEN BAŞLA ---
function resetGame() {
    // Sahnedeki tüm eski engelleri sil
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    
    // Değişkenleri ilk değerine döndür
    currentLane = 1;
    targetX = lanes[currentLane];
    player.position.set(0, 0.9, 0);
    isJumping = false;
    jumpVelocity = 0;
    score = 0;
    speed = 0.5;

    document.getElementById('score-val').innerText = score;
    document.getElementById('game-over-screen').style.display = 'none';

    // Oyunu tekrar başlat
    gameActive = true;
    animate();
}

// Ekran boyutu değiştiğinde 3D sahneyi yeniden boyutlandır
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Sayfa yüklendiğinde motoru çalıştır
window.onload = init;

let targetDate = null;
let isAuthenticated = false;
let failedAttempts = 0;
let mouseX = 0, mouseY = 0;
let stars = [];
let lastMouseUpdate = 0;

// Variables para Three.js
let scene, camera, renderer, particles;
let mouseXThree = 0, mouseYThree = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

const CREDENTIALS = {
    username: 'AndreSM',
    password: 'andre1589'
};

const MONGODB_CONFIG = {
    connectionString: "mongodb+srv://fabian1234andre:GWOLQUQqWRu2MPZ9@cluster0.ttvffqo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    get apiUrl() {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:3000/api' : 'https://monn-studios-backend.onrender.com/api';
    },
    get enabled() {
        return this.connectionString && this.connectionString.trim() !== "";
    },
    get isAdmin() {
        return isAuthenticated;
    }
};

// =====================================================
// FUNCIONES THREE.JS PARA FONDO DE PARTÍCULAS
// =====================================================

function initThreeJS() {
    console.log('🌌 Inicializando fondo de partículas Three.js...');
    
    // Crear escena
    scene = new THREE.Scene();

    // Crear cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 300;

    // Crear renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#three-canvas'),
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Crear sistema de partículas
    const particleCount = 10000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Colores para gradiente (blanco a gris)
    const colorStart = new THREE.Color(0xffffff); // Blanco
    const colorEnd = new THREE.Color(0x444444);   // Gris oscuro

    for (let i = 0; i < positions.length; i += 3) {
        // Posiciones aleatorias
        const x = Math.random() * 800 - 400;
        const y = Math.random() * 800 - 400;
        const z = Math.random() * 800 - 400;

        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;

        // Colores basados en la distancia del centro
        const distance = Math.sqrt(x * x + y * y + z * z);
        const color = new THREE.Color().lerpColors(colorStart, colorEnd, distance / 400);

        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }

    // Crear geometría y material
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Event listeners para Three.js
    document.addEventListener('mousemove', onDocumentMouseMoveThree);
    window.addEventListener('resize', onWindowResizeThree, false);

    // Iniciar animación
    animateThree();
    
    console.log('✅ Fondo de partículas Three.js inicializado');
}

function onDocumentMouseMoveThree(event) {
    // Reducir la sensibilidad del mouse significativamente
    mouseXThree = (event.clientX - windowHalfX) * 0.1; // Reducido de 1 a 0.1
    mouseYThree = (event.clientY - windowHalfY) * 0.1; // Reducido de 1 a 0.1
}

function animateThree() {
    requestAnimationFrame(animateThree);

    const time = Date.now() * 0.0001;

    // Movimiento de cámara MUY suave y limitado
    camera.position.x += (mouseXThree - camera.position.x) * 0.005; // Reducido de 0.01 a 0.005
    camera.position.y += (-mouseYThree - camera.position.y) * 0.005; // Reducido de 0.01 a 0.005
    
    // Limitar el movimiento de la cámara para que no se aleje demasiado
    camera.position.x = Math.max(-50, Math.min(50, camera.position.x));
    camera.position.y = Math.max(-50, Math.min(50, camera.position.y));
    camera.position.z = 300; // Mantener la distancia Z fija
    
    camera.lookAt(scene.position);

    // Rotación más lenta de partículas
    particles.rotation.y = time * 0.2; // Reducido de 0.5 a 0.2
    particles.rotation.x = time * 0.1; // Reducido de 0.25 a 0.1

    renderer.render(scene, camera);
}

function onWindowResizeThree() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// =====================================================
// FUNCIONES MONGODB Y CONFIGURACIÓN
// =====================================================

async function mongoSaveConfig(targetDate) {
    try {
        console.log('☁️ GUARDANDO CONFIGURACIÓN GLOBAL...');

        const configDoc = {
            _id: "global_countdown_config",
            targetDate: targetDate.toISOString(),
            configuredBy: 'AndreSM',
            configuredAt: new Date().toISOString(),
            lastUpdate: Date.now(),
            isGlobal: true,
            adminOnly: true
        };

        const response = await fetch(`${MONGODB_CONFIG.apiUrl}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(configDoc)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log('✅ ¡CONFIGURACIÓN GLOBAL GUARDADA!');
            console.log('🌍 TODOS los visitantes verán esta fecha ahora');
            saveLocalConfig(targetDate);
            return { success: true, source: 'mongodb', global: true };
        } else {
            throw new Error(result.error || 'Error desconocido');
        }

    } catch (error) {
        console.log('⚠️ MongoDB no disponible:', error.message);
        console.log('📝 Guardando localmente como fallback');
        return saveLocalConfig(targetDate);
    }
}

async function mongoLoadConfig() {
    try {
        console.log('🌍 Cargando configuración GLOBAL desde la nube...');

        const response = await fetch(`${MONGODB_CONFIG.apiUrl}/config`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
            targetDate = new Date(result.data.targetDate);

            console.log('✅ ¡CONFIGURACIÓN GLOBAL CARGADA!');
            console.log(`🎯 Fecha configurada por el admin: ${targetDate.toLocaleString()}`);
            console.log('👥 Esta fecha es para TODOS los visitantes');

            saveLocalConfig(targetDate);
            return { success: true, source: 'mongodb', global: true, data: result.data };
        } else {
            throw new Error('No hay configuración global');
        }

    } catch (error) {
        console.log('⚠️ No hay configuración global disponible:', error.message);
        console.log('📝 Usando configuración local');
        return loadLocalConfig();
    }
}

async function autoLoadConfig() {
    if (MONGODB_CONFIG.enabled) {
        console.log('🚀 MODO AUTOMÁTICO: Intentando cargar configuración global...');
        const result = await mongoLoadConfig();

        if (result.success && result.source === 'mongodb') {
            console.log('🌍 ¡Configuración global activa! Configurada por el administrador');
            return result;
        } else {
            console.log('📝 No hay configuración global, usando local');
            return await loadLocalConfig();
        }
    } else {
        console.log('💻 MongoDB no configurado - modo local');
        return await loadLocalConfig();
    }
}

async function autoSaveConfig(targetDate) {
    if (MONGODB_CONFIG.enabled && MONGODB_CONFIG.isAdmin) {
        console.log('🔐 ADMINISTRADOR DETECTADO - Guardando GLOBALMENTE...');
        const result = await mongoSaveConfig(targetDate);

        if (result.success && result.source === 'mongodb') {
            console.log('✅ ¡Configuración guardada para TODOS los usuarios!');
            return result;
        } else {
            console.log('📝 Fallback: Guardado localmente');
            return saveLocalConfig(targetDate);
        }
    } else if (MONGODB_CONFIG.enabled && !MONGODB_CONFIG.isAdmin) {
        console.log('👀 Visitante: No puede modificar configuración global');
        return { success: false, reason: 'visitor' };
    } else {
        console.log('💻 Modo local - guardando en localStorage');
        return saveLocalConfig(targetDate);
    }
}

function saveLocalConfig(date) {
    try {
        const config = {
            targetDate: date.toISOString(),
            configuredBy: 'AndreSM',
            configuredAt: new Date().toISOString(),
            source: 'localStorage'
        };

        localStorage.setItem('moon_studios_config', JSON.stringify(config));
        targetDate = date;

        console.log('💾 Configuración guardada en localStorage');
        return { success: true, source: 'localStorage' };
    } catch (e) {
        console.error('❌ Error guardando en localStorage:', e);
        targetDate = date;
        return { success: false, error: e.message };
    }
}

function loadLocalConfig() {
    try {
        const savedConfig = localStorage.getItem('moon_studios_config');

        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            targetDate = new Date(config.targetDate);

            console.log('📥 Configuración cargada desde localStorage');
            console.log(`🎯 Fecha objetivo: ${targetDate.toLocaleString()}`);

            return { success: true, data: config, source: 'localStorage' };
        } else {
            return { success: false, error: 'No config found' };
        }
    } catch (e) {
        console.error('❌ Error cargando desde localStorage:', e);
        return { success: false, error: e.message };
    }
}

// =====================================================
// FUNCIONES DE INTERFAZ Y CONFIGURACIÓN
// =====================================================

function openConfigSystem() {
    console.log('🔧 BOTÓN CLICKEADO!');

    if (isAuthenticated) {
        console.log('✅ Ya autenticado, mostrando panel');
        showConfigPanel();
        return;
    }

    console.log('🔐 No autenticado, mostrando login');
    showLoginDialog();
}

function showLoginDialog() {
    console.log('📋 Mostrando dialog de login...');

    const loginOverlay = document.getElementById('loginOverlay');
    if (!loginOverlay) {
        console.error('❌ Login overlay no encontrado');
        return;
    }

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const errorMsg = document.getElementById('errorMessage');
    const blockedMsg = document.getElementById('blockedMessage');

    if (username) username.value = '';
    if (password) password.value = '';
    if (errorMsg) errorMsg.textContent = '';
    if (blockedMsg) blockedMsg.textContent = '';

    loginOverlay.style.display = 'flex';
    console.log('✅ Login mostrado exitosamente');

    setTimeout(() => {
        if (username) username.focus();
    }, 100);
}

function showConfigPanel() {
    console.log('⚙️ Mostrando panel de configuración...');

    const configPanel = document.getElementById('configPanel');
    if (!configPanel) {
        console.error('❌ Panel de configuración no encontrado');
        return;
    }

    configPanel.classList.add('show');
    configPanel.classList.remove('collapsed');
    console.log('✅ Panel mostrado exitosamente');

    setTimeout(() => {
        configPanel.classList.add('collapsed');
    }, 3000);
}

function attemptLogin() {
    console.log('🔑 Procesando login...');

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const errorMsg = document.getElementById('errorMessage');

    if (!username || !password) {
        console.error('❌ Campos no encontrados');
        return;
    }

    const user = username.value.trim();
    const pass = password.value.trim();

    console.log('👤 Usuario:', user);
    console.log('🔐 Password length:', pass.length);

    if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
        console.log('✅ ¡LOGIN EXITOSO!');

        isAuthenticated = true;

        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) {
            loginOverlay.style.display = 'none';
            console.log('🚪 Login cerrado');
        }

        showConfigPanel();
        loadConfiguration();

    } else {
        console.log('❌ Credenciales incorrectas');
        if (errorMsg) {
            errorMsg.textContent = '❌ Usuario o contraseña incorrectos';
        }

        username.value = '';
        password.value = '';
    }
}

function logout() {
    console.log('🚪 Cerrando sesión...');

    isAuthenticated = false;

    const loginOverlay = document.getElementById('loginOverlay');
    const configPanel = document.getElementById('configPanel');

    if (loginOverlay) loginOverlay.style.display = 'none';
    if (configPanel) configPanel.classList.remove('show');

    console.log('✅ Sesión cerrada');
}

function toggleConfig() {
    console.log('🔄 Toggle config');

    if (!isAuthenticated) {
        showLoginDialog();
        return;
    }

    const panel = document.getElementById('configPanel');
    if (panel) {
        panel.classList.toggle('collapsed');
        console.log('Panel collapsed:', panel.classList.contains('collapsed'));
    }
}

function setQuickDate(amount, unit) {
    console.log(`⏰ Configurando fecha rápida: ${amount} ${unit}`);

    const now = new Date();
    const target = new Date(now);

    if (unit === 'days') {
        target.setDate(target.getDate() + amount);
    } else if (unit === 'months') {
        target.setMonth(target.getMonth() + amount);
    }

    saveGlobalConfiguration(target);

    const dateTimeString = target.toISOString().slice(0, 16);
    const dateTimeInput = document.getElementById('targetDateTime');
    if (dateTimeInput) {
        dateTimeInput.value = dateTimeString;
    }

    console.log(`✅ Fecha configurada globalmente: ${target.toLocaleString()}`);
}

function resetToDefault() {
    console.log('🔄 Restableciendo a valores por defecto...');

    const now = new Date();
    const defaultTarget = new Date(now.getTime() + (29 * 24 * 60 * 60 * 1000) + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (44 * 1000));

    saveGlobalConfiguration(defaultTarget);

    const dateTimeString = defaultTarget.toISOString().slice(0, 16);
    const dateTimeInput = document.getElementById('targetDateTime');
    if (dateTimeInput) {
        dateTimeInput.value = dateTimeString;
    }

    console.log(`✅ Fecha restablecida globalmente: ${defaultTarget.toLocaleString()}`);
}

function updateCountdown() {
    console.log('📅 Actualizando countdown con nueva fecha...');

    const dateTimeInput = document.getElementById('targetDateTime');
    if (dateTimeInput && dateTimeInput.value) {
        const newTarget = new Date(dateTimeInput.value);

        saveGlobalConfiguration(newTarget);

        console.log(`✅ Nueva fecha guardada globalmente: ${newTarget.toLocaleString()}`);
        updateCountdownDisplay();
    }
}

function saveGlobalConfiguration(date) {
    console.log('🔄 Iniciando guardado automático...');

    autoSaveConfig(date).then(result => {
        if (result.success) {
            if (result.source === 'mongodb') {
                console.log('🌍 ¡CONFIGURACIÓN GLOBAL GUARDADA!');
                alert('✅ ¡Configuración guardada globalmente!\n🌍 TODOS los visitantes verán esta nueva fecha.');
            } else {
                console.log('💻 Configuración guardada localmente');
                alert('💻 Configuración guardada localmente.');
            }
        } else if (result.reason === 'visitor') {
            console.log('👀 Los visitantes no pueden modificar la configuración');
        } else {
            console.log('📝 Guardado en localStorage como fallback');
            alert('📝 Configuración guardada como respaldo local.');
        }
        updateCountdownDisplay();
    }).catch(error => {
        console.log('❌ Error en guardado automático:', error);
        saveLocalConfig(date);
        updateCountdownDisplay();
        alert('⚠️ Configuración guardada localmente (error de conexión).');
    });
}

async function loadGlobalConfiguration() {
    console.log('🚀 Carga automática iniciada...');

    const result = await autoLoadConfig();

    if (result.success) {
        if (result.source === 'mongodb') {
            console.log('🌍 ¡Configuración GLOBAL cargada!');
            console.log('👤 Configurada por el administrador para todos');
        } else {
            console.log('💻 Configuración local cargada');
        }

        if (isAuthenticated) {
            const dateTimeInput = document.getElementById('targetDateTime');
            if (dateTimeInput && targetDate) {
                dateTimeInput.value = targetDate.toISOString().slice(0, 16);
            }
        }
        return true;
    } else {
        console.log('📭 No hay configuración disponible');
        return false;
    }
}

async function loadConfiguration() {
    const hasConfig = await loadGlobalConfiguration();

    if (!hasConfig) {
        console.log('🏗️ Creando configuración por defecto...');
        const now = new Date();
        const defaultTarget = new Date(now.getTime() + (29 * 24 * 60 * 60 * 1000) + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (44 * 1000));

        if (isAuthenticated) {
            console.log('👤 Administrador - guardando configuración por defecto globalmente');
            saveGlobalConfiguration(defaultTarget);
        } else {
            console.log('👀 Visitante - usando configuración temporal');
            targetDate = defaultTarget;
        }
    }
}

// =====================================================
// FUNCIONES DE COUNTDOWN Y ANIMACIONES
// =====================================================

function updateCountdownDisplay() {
    if (!targetDate) return;

    const now = new Date();
    const difference = targetDate - now;

    if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        animateNumberChange('days', String(days).padStart(2, '0'));
        animateNumberChange('hours', String(hours).padStart(2, '0'));
        animateNumberChange('minutes', String(minutes).padStart(2, '0'));
        animateNumberChange('seconds', String(seconds).padStart(2, '0'));
    } else {
        ['days', 'hours', 'minutes', 'seconds'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '00';
        });

        if (!window.celebrationShown) {
            showCelebration();
            window.celebrationShown = true;
        }
    }
}

function animateNumberChange(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (element && element.textContent !== newValue) {
        element.classList.add('changing');
        setTimeout(() => {
            element.textContent = newValue;
            element.classList.remove('changing');
        }, 300);
    }
}

function showCelebration() {
    document.querySelector('.main-title').textContent = '¡LUNA NET YA DISPONIBLE!';
    document.querySelector('.subtitle').textContent = '🎉 ¡Se terminó el tiempo de espera! 🎉';
    
    for (let i = 0; i < 100; i++) {
        createConfetti();
    }
    
    setTimeout(() => {
        alert('🎉 ¡FELICIDADES! 🎉\n\n¡Se terminó el tiempo de espera!\nLuna Net ya está disponible.');
    }, 1000);
}

function createConfetti() {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'][Math.floor(Math.random() * 5)]};
        left: ${Math.random() * 100}vw;
        top: -10px;
        z-index: 1000;
        border-radius: 50%;
        pointer-events: none;
        animation: confetti-fall 3s linear forwards;
    `;
    
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
}

// =====================================================
// FUNCIONES DE ESTRELLAS CSS (LEGACY)
// =====================================================

function createStarField() {
    const starsContainer = document.getElementById('stars');
    if (!starsContainer) return;

    const starCount = 60;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');

        const starTypes = ['star', 'star medium', 'star dim', 'star bright'];
        star.className = starTypes[Math.floor(Math.random() * starTypes.length)];

        const size = Math.random() * 2 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';

        star.dataset.speed = Math.random() * 5 + 2;

        starsContainer.appendChild(star);
        stars.push(star);
    }

    setInterval(createShootingStar, 12000);
}

function createShootingStar() {
    const star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left = Math.random() * 30 + '%';
    star.style.top = Math.random() * 40 + 10 + '%';

    const starsContainer = document.getElementById('stars');
    if (starsContainer) {
        starsContainer.appendChild(star);

        setTimeout(() => {
            if (star.parentNode) {
                star.parentNode.removeChild(star);
            }
        }, 4000);
    }
}

function animateStarsWithMouse() {
    if (Math.random() > 0.1) {
        requestAnimationFrame(animateStarsWithMouse);
        return;
    }

    stars.forEach((star, index) => {
        if (index % 8 !== 0) return;

        const speed = parseFloat(star.dataset.speed) * 0.2;
        const offsetX = mouseX * speed;
        const offsetY = mouseY * speed;

        star.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    requestAnimationFrame(animateStarsWithMouse);
}

// =====================================================
// FUNCIONES DE EFECTOS VISUALES
// =====================================================

function createRipple(element, e) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    element.appendChild(ripple);

    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 800);
}

// =====================================================
// EVENT LISTENERS Y INICIALIZACIÓN
// =====================================================

document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastMouseUpdate > 32) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        lastMouseUpdate = now;
    }
});

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Iniciando Moon Studios - Luna Net...');

    try {
        // Inicializar Three.js primero
        if (typeof THREE !== 'undefined') {
            initThreeJS();
            console.log('✅ Fondo Three.js inicializado');
        } else {
            console.log('⚠️ Three.js no disponible, usando fondo CSS');
            createStarField();
            console.log('✨ Estrellas CSS creadas');
        }

        const configBtn = document.getElementById('configBtn');
        if (configBtn) {
            console.log('🔧 Configurando botón de configuración...');

            configBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 ¡BOTÓN CLICKEADO!');
                openConfigSystem();
            });

            console.log('✅ Botón de configuración listo');
        } else {
            console.error('❌ Botón de configuración NO encontrado');
        }

        const loginOverlay = document.getElementById('loginOverlay');
        const configPanel = document.getElementById('configPanel');

        console.log('🔍 Verificando elementos:');
        console.log('- Login overlay:', !!loginOverlay);
        console.log('- Config panel:', !!configPanel);

        console.log('📥 Iniciando carga de configuración global...');
        await loadConfiguration();

        updateCountdownDisplay();
        setInterval(updateCountdownDisplay, 1000);
        console.log('⏰ Contador iniciado con configuración global');

        if (navigator.hardwareConcurrency >= 2 && stars.length > 0) {
            animateStarsWithMouse();
            console.log('🎨 Animaciones CSS activadas');
        }

        document.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const loginOverlay = document.getElementById('loginOverlay');
                if (loginOverlay && loginOverlay.style.display === 'flex') {
                    e.preventDefault();
                    attemptLogin();
                }
            }

            if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                createShootingStar();
            }
        });

        document.addEventListener('click', function (e) {
            const loginOverlay = document.getElementById('loginOverlay');
            const loginBox = document.querySelector('.login-box');

            if (loginOverlay && loginOverlay.style.display === 'flex' &&
                loginBox && !loginBox.contains(e.target)) {
                loginOverlay.style.display = 'none';
            }
        });

        const interactiveElements = document.querySelectorAll('.time-unit, #configBtn, .logo');
        interactiveElements.forEach(element => {
            element.addEventListener('click', function (e) {
                createRipple(this, e);
            });
        });

        const dateTimeInput = document.getElementById('targetDateTime');
        if (dateTimeInput) {
            dateTimeInput.addEventListener('change', updateCountdown);
        }

        console.log('✅ SISTEMA COMPLETAMENTE FUNCIONAL!');
        console.log('🎯 Haz clic en ⚙️ para probar');

        setTimeout(() => {
            console.log('🧪 TESTING FINAL - Verificando sistema...');
            console.log('='.repeat(50));

            if (typeof openConfigSystem === 'function') {
                console.log('✅ Función openConfigSystem disponible');
            } else {
                console.error('❌ Función openConfigSystem NO disponible');
            }

            if (targetDate) {
                console.log('✅ SISTEMA AUTOMÁTICO FUNCIONANDO:');
                console.log(`🎯 Fecha objetivo: ${targetDate.toLocaleString()}`);
                console.log(`📊 Días restantes: ${Math.floor((targetDate - new Date()) / (1000 * 60 * 60 * 24))}`);

                if (MONGODB_CONFIG.enabled) {
                    console.log('🌍 MODO GLOBAL AUTOMÁTICO ACTIVO');
                    console.log('👤 Administrador: Puede configurar para TODOS');
                    console.log('👥 Visitantes: Ven automáticamente la configuración del admin');
                    console.log('🚀 MongoDB se activa automáticamente cuando el admin configura');
                } else {
                    console.log('💻 MODO LOCAL');
                    console.log('📝 Configuración solo en este navegador');
                    console.log('💡 Para modo global: pega tu connection string de MongoDB');
                }

                if (isAuthenticated) {
                    console.log('🔐 ADMINISTRADOR AUTENTICADO');
                    console.log('⚙️ Puedes configurar la fecha para todos los visitantes');
                } else {
                    console.log('👀 VISITANTE');
                    console.log('📺 Viendo la configuración del administrador');
                }
            } else {
                console.error('❌ NO hay targetDate configurado');
            }

            console.log('='.repeat(50));
            console.log('🎯 Botón listo - HAZ CLIC EN ⚙️ PARA CONFIGURAR');
        }, 2000);

    } catch (error) {
        console.error('❌ Error durante inicialización:', error);
    }
});

// =====================================================
// EXPORTS GLOBALES
// =====================================================

window.openConfigSystem = openConfigSystem;
window.attemptLogin = attemptLogin;
window.toggleConfig = toggleConfig;
window.logout = logout;
window.setQuickDate = setQuickDate;
window.resetToDefault = resetToDefault;
window.updateCountdown = updateCountdown;

console.log('🌍 Moon Studios - Sistema completamente funcional!');

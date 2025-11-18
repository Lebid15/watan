// ===== THREE.JS 3D BACKGROUND SCENE =====
// Removed 3D floating shapes for clean background

// Scene Setup (kept minimal for future use)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Camera Position
camera.position.z = 50;

// ===== LIGHTING =====
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// ===== MOUSE INTERACTION =====
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ===== ANIMATION LOOP =====
function animate() {
    requestAnimationFrame(animate);
    
    // Camera follows mouse (subtle)
    camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
    camera.position.y += (mouseY * 2 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);
    
    // Render
    renderer.render(scene, camera);
}

animate();

// ===== WINDOW RESIZE =====
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== CARD 3D TILT EFFECT =====
const cards = document.querySelectorAll('.card-3d');

cards.forEach(card => {
    const cardInner = card.querySelector('.card-inner');
    
    card.addEventListener('mouseenter', () => {
        cardInner.style.transition = 'all 0.1s ease';
    });
    
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transform = `
            perspective(1000px) 
            rotateX(${-rotateX}deg) 
            rotateY(${rotateY}deg)
            translateZ(10px)
        `;
    });
    
    card.addEventListener('mouseleave', () => {
        cardInner.style.transition = 'all 0.5s ease';
        card.style.transform = '';
    });
});

// ===== BUTTON RIPPLE EFFECT =====
const buttons = document.querySelectorAll('.btn, .card-btn');

buttons.forEach(button => {
    button.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: translate(-50%, -50%);
            animation: rippleEffect 0.6s ease-out;
            pointer-events: none;
        `;
        
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    });
});

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes rippleEffect {
        to {
            width: 300px;
            height: 300px;
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ===== SCROLL ANIMATIONS =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature items
document.querySelectorAll('.feature-item').forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(30px)';
    item.style.transition = 'all 0.6s ease';
    observer.observe(item);
});

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
let isDarkTheme = false;

themeToggle.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('dark-theme');
    
    // Change icon
    themeIcon.textContent = isDarkTheme ? '☀️' : '🌙';
});

console.log('🎨 Clean Background Design Loaded - تصميم خلفية نظيفة');
console.log('✨ Subtle Pattern with Dark Gradient');
console.log('🚀 Performance: Optimized');


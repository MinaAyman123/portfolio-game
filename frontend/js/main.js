// ============================================
// PARTICLES BACKGROUND
// ============================================
(function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w, h, particles = [];

  // ===== ألوان النقط =====
  const COLORS = ["#8B5CF6", "#3B82F6", "#06B6D4"];

  // ===== إعدادات =====
  const PARTICLE_COUNT = 70;      // عدد النقط
  const MAX_DISTANCE   = 130;     // أقصى مسافة للخطوط
  const SPEED          = 0.4;     // سرعة الحركة

  // ===== ضبط حجم الـcanvas =====
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  // ===== إنشاء النقط =====
  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.8 + 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  // ===== الرسم كل frame =====
  function draw() {
    ctx.clearRect(0, 0, w, h);

    // ===== خطوط بين النقط القريبة =====
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MAX_DISTANCE) {
          const alpha = (1 - dist / MAX_DISTANCE) * 0.15;
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // ===== النقط نفسها =====
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  // ===== تشغيل =====
  resize();
  createParticles();
  draw();

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
})();

// ============================================
// ENTER → WORLD
// ============================================
const landing  = document.querySelector(".landing");
const enterBtn = document.getElementById("enterBtn");

enterBtn.addEventListener("click", () => {
  // 1) اخفي الـLanding بحركة ناعمة
  landing.classList.add("hide");

  // 2) بعد 600ms (مدة الحركة) → انتقل للعالم
  setTimeout(() => {
    window.location.href = "world/index.html";
  }, 600);
});

console.log("✨ Portfolio loaded — ready to enter the world");
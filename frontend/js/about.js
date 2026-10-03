// ============================================
// CONFIG
// ============================================
const API_URL = "https://portfolio-game-production-f231.up.railway.app";

// ============================================
// PARTICLES BACKGROUND
// ============================================
(function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w, h, particles = [];
  const COLORS = ["#8B5CF6", "#3B82F6", "#06B6D4"];
  const COUNT = 60;
  const MAX_DIST = 130;
  const SPEED = 0.35;

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function create() {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.6 + 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          const alpha = (1 - d / MAX_DIST) * 0.12;
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
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

  resize();
  create();
  draw();
  window.addEventListener("resize", () => { resize(); create(); });
})();

// ============================================
// LOAD SKILLS FROM API
// ============================================
async function loadSkills() {
  const grid = document.getElementById("skillsGrid");
  try {
    const res = await fetch(`${API_URL}/api/skills`);
    if (!res.ok) throw new Error("Failed to fetch skills");
    const skills = await res.json();

    if (!skills.length) {
      grid.innerHTML = '<div class="loading-state">No skills yet.</div>';
      return;
    }

    grid.innerHTML = skills.map(skill => `
      <div class="skill-card">
        <div class="skill-header">
          <span class="skill-category">${skill.category}</span>
          <span class="skill-level">${skill.level}%</span>
        </div>
        <div class="skill-name">${skill.name}</div>
        <div class="skill-bar">
          <div class="skill-bar-fill" style="width: 0%" data-level="${skill.level}"></div>
        </div>
      </div>
    `).join("");

    // أنيميشن للـprogress bars
    setTimeout(() => {
      document.querySelectorAll(".skill-bar-fill").forEach(bar => {
        bar.style.width = bar.dataset.level + "%";
      });
    }, 100);
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="loading-state">⚠️ Failed to load skills. Try refreshing.</div>';
  }
}

// ============================================
// LOAD PROJECTS FROM API
// ============================================
async function loadProjects() {
  const grid = document.getElementById("projectsGrid");
  try {
    const res = await fetch(`${API_URL}/api/projects`);
    if (!res.ok) throw new Error("Failed to fetch projects");
    const projects = await res.json();

    if (!projects.length) {
      grid.innerHTML = '<div class="loading-state">No projects yet.</div>';
      return;
    }

    grid.innerHTML = projects.map(p => `
      <div class="project-card">
        <div class="project-name">${p.name}</div>
        <div class="project-desc">${p.description || ""}</div>

        ${p.tech && p.tech.length ? `
          <div class="project-tech">
            ${p.tech.map(t => `<span class="tech-tag">${t}</span>`).join("")}
          </div>
        ` : ""}

        ${p.metrics ? `
          <div class="project-metrics">
            ${Object.entries(p.metrics).map(([key, value]) => `
              <div class="metric">
                <span class="metric-label">${key}</span>
                <span class="metric-value">${typeof value === "number" ? (value < 1 ? (value * 100).toFixed(0) + "%" : value) : value}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}

        ${p.github ? `
          <a href="${p.github}" target="_blank" rel="noopener" class="project-link">
            View on GitHub →
          </a>
        ` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="loading-state">⚠️ Failed to load projects. Try refreshing.</div>';
  }
}

// ============================================
// CONTACT FORM
// ============================================
const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = form.querySelector(".submit-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";
  status.textContent = "";
  status.className = "form-status";

  const data = {
    name: form.name.value,
    email: form.email.value,
    message: form.message.value,
  };

  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Failed");

    status.textContent = "✅ Message sent! Thanks for reaching out.";
    status.classList.add("success");
    form.reset();
  } catch (err) {
    console.error(err);
    status.textContent = "❌ Something went wrong. Please try again.";
    status.classList.add("error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send Message";
  }
});

// ============================================
// SMOOTH SCROLL FOR NAV LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// ============================================
// INIT
// ============================================
loadSkills();
loadProjects();
console.log("✨ About page loaded");
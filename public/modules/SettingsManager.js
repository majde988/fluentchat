export class SettingsManager {
  constructor() {
    this.defaults = {
      performanceMode: "normal",
      theme: "light",
      accent: "blue",
      fontSize: 15,
      messageDensity: "comfortable",
      enableNotifications: true,
      enableSounds: true,
      enableBluetooth: false,
      cinemaQuality: "720p",
      language: "ar",
      autoDownloadMedia: true,
      maxUploadSize: 50,
      chatWallpaper: "default"
    };

    this.modes = {
      lightweight: {
        label: "Super Lightweight",
        icon: "fa-feather",
        description: "للأجهزة الضعيفة - Toshiba i3",
        css: {
          "--blur": "0px",
          "--shadow": "none",
          "--transition-speed": "0s",
          "--border-radius": "8px",
          "--glass-bg": "var(--panel)",
          "--glass-border": "1px solid var(--border)"
        },
        features: {
          animations: false,
          blur: false,
          shadows: false,
          glassmorphism: false,
          particles: false,
          smoothScroll: false,
          imageQuality: "low",
          videoPreview: false,
          virtualScrollBuffer: 5,
          maxVisibleMessages: 30,
          lazyLoadImages: true,
          reducedMotion: true,
          disableTransitions: true,
          simplifiedUI: true
        }
      },
      normal: {
        label: "Normal",
        icon: "fa-laptop",
        description: "التوازن المثالي - i5/i7",
        css: {
          "--blur": "10px",
          "--shadow": "0 4px 20px rgba(0,0,0,.1)",
          "--transition-speed": "0.25s",
          "--border-radius": "16px",
          "--glass-bg": "rgba(255,255,255,.85)",
          "--glass-border": "1px solid rgba(255,255,255,.3)"
        },
        features: {
          animations: true,
          blur: true,
          shadows: true,
          glassmorphism: false,
          particles: false,
          smoothScroll: true,
          imageQuality: "medium",
          videoPreview: true,
          virtualScrollBuffer: 10,
          maxVisibleMessages: 50,
          lazyLoadImages: true,
          reducedMotion: false,
          disableTransitions: false,
          simplifiedUI: false
        }
      },
      ultra: {
        label: "Ultra",
        icon: "fa-rocket",
        description: "RTX / أجهزة قوية - تأثيرات 3D",
        css: {
          "--blur": "20px",
          "--shadow": "0 8px 32px rgba(0,0,0,.15), 0 0 60px rgba(10,132,255,.1)",
          "--transition-speed": "0.35s",
          "--border-radius": "24px",
          "--glass-bg": "rgba(255,255,255,.45)",
          "--glass-border": "1px solid rgba(255,255,255,.5)"
        },
        features: {
          animations: true,
          blur: true,
          shadows: true,
          glassmorphism: true,
          particles: true,
          smoothScroll: true,
          imageQuality: "high",
          videoPreview: true,
          virtualScrollBuffer: 20,
          maxVisibleMessages: 100,
          lazyLoadImages: false,
          reducedMotion: false,
          disableTransitions: false,
          simplifiedUI: false,
          enable3D: true,
          enableRayTracing: true,
          hdrColors: true,
          particleCount: 50
        }
      }
    };

    this.settings = {};
    this.listeners = new Map();
    this.performanceBenchmark = null;

    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem("fc-settings-v2");
      this.settings = saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults };
    } catch (e) {
      console.warn("Settings load failed, using defaults", e);
      this.settings = { ...this.defaults };
    }
  }

  save() {
    try {
      localStorage.setItem("fc-settings-v2", JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Settings save failed", e);
    }
  }

  get(key) {
    return this.settings[key] ?? this.defaults[key];
  }

  set(key, value) {
    const old = this.settings[key];
    this.settings[key] = value;
    this.save();
    this.emit(key, value, old);
    return this;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, newVal, oldVal) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(newVal, oldVal); } catch (e) { console.error("Listener error", e); }
    });
    const allCbs = this.listeners.get("*") || [];
    allCbs.forEach(cb => {
      try { cb(event, newVal, oldVal); } catch (e) { console.error("Listener error", e); }
    });
  }

  getCurrentMode() {
    return this.modes[this.settings.performanceMode] || this.modes.normal;
  }

  getFeature(featureName) {
    const mode = this.getCurrentMode();
    return mode.features[featureName];
  }

  setPerformanceMode(mode) {
    if (!this.modes[mode]) {
      console.warn("Unknown mode:", mode);
      return this;
    }

    this.set("performanceMode", mode);
    this.applyPerformanceMode(mode);
    console.log("[Settings] Performance mode:", mode);
    return this;
  }

  applyPerformanceMode(mode) {
    const config = this.modes[mode];
    if (!config) return;

    const root = document.documentElement;

    Object.entries(config.css).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });

    const body = document.body;
    body.classList.remove("mode-lightweight", "mode-normal", "mode-ultra");
    body.classList.add("mode-" + mode);

    if (config.features.reducedMotion) {
      body.classList.add("reduced-motion");
    } else {
      body.classList.remove("reduced-motion");
    }

    if (config.features.glassmorphism) {
      body.classList.add("glassmorphism");
    } else {
      body.classList.remove("glassmorphism");
    }

    if (config.features.particles) {
      this.startParticles(config.features.particleCount || 20);
    } else {
      this.stopParticles();
    }

    if (config.features.enable3D) {
      this.enable3DEffects();
    } else {
      this.disable3DEffects();
    }

    this.emit("modeChanged", mode);
  }

  async autoBenchmark() {
    console.log("[Benchmark] Starting...");
    const start = performance.now();
    let frames = 0;

    const results = await new Promise(resolve => {
      const count = () => {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(count);
        } else {
          resolve({ fps: frames, time: performance.now() - start });
        }
      };
      requestAnimationFrame(count);
    });

    const memory = performance.memory
      ? Math.round(performance.memory.usedJSHeapSize / 1048576)
      : null;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const gpu = gl
      ? gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL || 0)
      : "Unknown";

    this.performanceBenchmark = {
      fps: results.fps,
      memory: memory,
      gpu: gpu,
      cores: navigator.hardwareConcurrency || 1,
      timestamp: Date.now()
    };

    let recommended;
    if (results.fps < 30 || (memory && memory > 500) || navigator.hardwareConcurrency <= 2) {
      recommended = "lightweight";
    } else if (results.fps >= 55 && navigator.hardwareConcurrency >= 6) {
      recommended = "ultra";
    } else {
      recommended = "normal";
    }

    this.performanceBenchmark.recommended = recommended;
    console.log("[Benchmark] Results:", this.performanceBenchmark);
    console.log("[Benchmark] Recommended:", recommended);

    return this.performanceBenchmark;
  }

  startParticles(count = 20) {
    this.stopParticles();

    let container = document.getElementById("particles-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "particles-container";
      container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden";
      document.body.appendChild(container);
    }

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      const size = Math.random() * 4 + 2;
      const x = Math.random() * 100;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 10;
      p.className = "particle";
      p.style.cssText = `
        position:absolute;
        width:${size}px;height:${size}px;
        background:var(--accent);opacity:.15;
        border-radius:50%;
        left:${x}%;bottom:-10px;
        animation:particleFloat ${duration}s ${delay}s infinite linear;
      `;
      container.appendChild(p);
    }

    if (!document.getElementById("particle-style")) {
      const style = document.createElement("style");
      style.id = "particle-style";
      style.textContent = `
        @keyframes particleFloat {
          0% { transform:translateY(0) rotate(0deg); opacity:.15; }
          50% { opacity:.3; }
          100% { transform:translateY(-100vh) rotate(720deg); opacity:0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  stopParticles() {
    const container = document.getElementById("particles-container");
    if (container) container.innerHTML = "";
  }

  enable3DEffects() {
    if (!document.getElementById("effects-3d-style")) {
      const style = document.createElement("style");
      style.id = "effects-3d-style";
      style.textContent = `
        .mode-ultra .card:hover,
        .mode-ultra .chat-item:hover,
        .mode-ultra .platform-card:hover {
          transform: perspective(800px) rotateY(-2deg) rotateX(1deg) translateY(-8px);
          box-shadow: var(--shadow), 0 0 40px rgba(10,132,255,.15);
        }
        .mode-ultra .bubble {
          transform: perspective(600px) rotateY(0deg);
          transition: transform .3s ease;
        }
        .mode-ultra .message:hover .bubble {
          transform: perspective(600px) rotateY(-1deg) scale(1.01);
        }
        .mode-ultra .avatar {
          box-shadow: 0 0 20px rgba(10,132,255,.2);
          transition: box-shadow .3s, transform .3s;
        }
        .mode-ultra .avatar:hover {
          box-shadow: 0 0 30px rgba(10,132,255,.4);
          transform: scale(1.08);
        }
        .mode-ultra .send-btn {
          box-shadow: 0 4px 20px rgba(10,132,255,.4);
        }
        .mode-ultra .welcome-logo {
          animation: float3d 4s ease-in-out infinite;
        }
        @keyframes float3d {
          0%,100% { transform: perspective(600px) rotateY(0deg) translateY(0); }
          25% { transform: perspective(600px) rotateY(5deg) translateY(-8px); }
          75% { transform: perspective(600px) rotateY(-5deg) translateY(-4px); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  disable3DEffects() {
    const style = document.getElementById("effects-3d-style");
    if (style) style.remove();
  }

  applyTheme(theme) {
    this.set("theme", theme);
    document.body.dataset.theme = theme;
  }

  applyAccent(accent) {
    this.set("accent", accent);
    document.body.dataset.accent = accent;
  }

  getAll() {
    return { ...this.settings };
  }

  reset() {
    this.settings = { ...this.defaults };
    this.save();
    this.applyPerformanceMode(this.defaults.performanceMode);
    this.applyTheme(this.defaults.theme);
    this.applyAccent(this.defaults.accent);
    this.emit("reset", this.settings);
  }

  init() {
    this.applyPerformanceMode(this.settings.performanceMode);
    this.applyTheme(this.settings.theme);
    this.applyAccent(this.settings.accent);
    console.log("[SettingsManager] Initialized", this.settings.performanceMode);
    return this;
  }
}

export default SettingsManager;

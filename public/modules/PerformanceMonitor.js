export class PerformanceMonitor {
  constructor(settings) {
    this.settings = settings;
    this.fps = 0;
    this.memory = 0;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.isRunning = false;
    this.widget = null;
    this.autoAdjust = true;
    this.history = { fps: [], memory: [] };
    this.maxHistory = 60;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
    console.log("[PerfMon] Started");
  }

  stop() {
    this.isRunning = false;
    console.log("[PerfMon] Stopped");
  }

  tick() {
    if (!this.isRunning) return;

    this.frameCount++;
    const now = performance.now();

    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;

      if (performance.memory) {
        this.memory = Math.round(performance.memory.usedJSHeapSize / 1048576);
      }

      this.history.fps.push(this.fps);
      this.history.memory.push(this.memory);
      if (this.history.fps.length > this.maxHistory) this.history.fps.shift();
      if (this.history.memory.length > this.maxHistory) this.history.memory.shift();

      this.updateWidget();

      if (this.autoAdjust) this.checkPerformance();
    }

    requestAnimationFrame(() => this.tick());
  }

  checkPerformance() {
    if (!this.settings) return;

    const currentMode = this.settings.get("performanceMode");
    const avgFPS = this.getAverageFPS();

    if (avgFPS < 20 && currentMode !== "lightweight") {
      console.warn("[PerfMon] Low FPS, switching to lightweight");
      this.settings.setPerformanceMode("lightweight");
    } else if (avgFPS > 55 && this.memory < 100 && currentMode === "lightweight") {
      console.log("[PerfMon] Good performance, switching to normal");
      this.settings.setPerformanceMode("normal");
    }
  }

  getAverageFPS() {
    if (this.history.fps.length === 0) return 60;
    const last10 = this.history.fps.slice(-10);
    return Math.round(last10.reduce((a, b) => a + b, 0) / last10.length);
  }

  createWidget() {
    if (this.widget) return;

    this.widget = document.createElement("div");
    this.widget.id = "perf-widget";
    this.widget.style.cssText = `
      position:fixed;bottom:80px;left:12px;z-index:9999;
      background:rgba(0,0,0,.85);color:#0f0;
      padding:8px 12px;border-radius:10px;
      font-family:monospace;font-size:12px;
      line-height:1.6;min-width:140px;
      backdrop-filter:blur(10px);
      border:1px solid rgba(255,255,255,.1);
      cursor:move;user-select:none;
    `;
    document.body.appendChild(this.widget);
    this.updateWidget();
  }

  updateWidget() {
    if (!this.widget) return;
    const fpsColor = this.fps > 50 ? "#0f0" : this.fps > 25 ? "#ff0" : "#f00";
    const memColor = this.memory > 150 ? "#f00" : this.memory > 80 ? "#ff0" : "#0f0";

    this.widget.innerHTML = `
      <div style="color:${fpsColor}">FPS: ${this.fps}</div>
      <div style="color:${memColor}">RAM: ${this.memory}MB</div>
      <div style="color:#aaa">Mode: ${this.settings?.get("performanceMode") || "?"}</div>
    `;
  }

  removeWidget() {
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
    }
  }

  getReport() {
    return {
      currentFPS: this.fps,
      averageFPS: this.getAverageFPS(),
      memory: this.memory,
      mode: this.settings?.get("performanceMode"),
      uptime: Math.round((performance.now()) / 1000),
      domNodes: document.querySelectorAll("*").length
    };
  }
}

export default PerformanceMonitor;

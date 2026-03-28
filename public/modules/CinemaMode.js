export class CinemaMode {
  constructor(settings) {
    this.settings = settings;
    this.isActive = false;
    this.currentMedia = null;
    this.player = null;
    this.overlay = null;
    this.listeners = new Map();
    this.watchParty = { active: false, viewers: [], hostId: null };
    this.supportedPlatforms = {
      youtube: {
        regex: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        name: "YouTube",
        icon: "fa-youtube",
        color: "#FF0000"
      },
      twitch: {
        regex: /(?:twitch\.tv\/)([a-zA-Z0-9_]+)/,
        name: "Twitch",
        icon: "fa-twitch",
        color: "#9146FF"
      }
    };
  }

  detectPlatform(url) {
    for (const [platform, config] of Object.entries(this.supportedPlatforms)) {
      const match = url.match(config.regex);
      if (match) {
        return { platform, id: match[1], config };
      }
    }
    return null;
  }

  open(mediaSource) {
    if (this.isActive) this.close();

    this.createOverlay();

    if (typeof mediaSource === "string") {
      const detected = this.detectPlatform(mediaSource);
      if (detected) {
        this.loadEmbed(detected);
      } else if (mediaSource.match(/\.(mp4|webm|ogg|mkv)$/i)) {
        this.loadLocalVideo(mediaSource);
      } else {
        this.loadLocalVideo(mediaSource);
      }
    } else if (mediaSource instanceof File) {
      this.loadFileVideo(mediaSource);
    }

    this.isActive = true;
    this.emit("opened", this.currentMedia);
  }

  createOverlay() {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement("div");
    this.overlay.id = "cinema-overlay";
    this.overlay.innerHTML = `
      <div class="cinema-container">
        <div class="cinema-header">
          <div class="cinema-title">
            <i class="fa-solid fa-film"></i>
            <span id="cinema-title-text">Cinema Mode</span>
          </div>
          <div class="cinema-controls-top">
            <button class="cinema-btn" id="cinema-pip" title="صورة في صورة">
              <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
            </button>
            <button class="cinema-btn" id="cinema-party" title="مشاهدة جماعية">
              <i class="fa-solid fa-users"></i>
            </button>
            <button class="cinema-btn cinema-close" id="cinema-close" title="إغلاق">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="cinema-player" id="cinema-player">
          <div class="cinema-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>جاري التحميل...</p>
          </div>
        </div>
        <div class="cinema-toolbar">
          <div class="cinema-url-bar">
            <i class="fa-solid fa-link"></i>
            <input type="text" id="cinema-url" placeholder="الصق رابط YouTube أو Twitch..." />
            <button class="cinema-play-btn" id="cinema-play-url">
              <i class="fa-solid fa-play"></i> تشغيل
            </button>
          </div>
          <div class="cinema-or">أو</div>
          <div class="cinema-file-bar">
            <button class="cinema-file-btn" id="cinema-file-btn">
              <i class="fa-solid fa-folder-open"></i> اختر ملف فيديو
            </button>
            <input type="file" id="cinema-file-input" accept="video/*" style="display:none" />
          </div>
        </div>
        <div class="cinema-chat" id="cinema-chat">
          <div class="cinema-chat-header">
            <i class="fa-solid fa-comment-dots"></i>
            <span>الدردشة أثناء المشاهدة</span>
          </div>
          <div class="cinema-chat-messages" id="cinema-messages"></div>
          <div class="cinema-chat-input">
            <input type="text" id="cinema-msg-input" placeholder="علّق هنا..." />
            <button id="cinema-msg-send"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    `;

    this.addCinemaStyles();
    document.body.appendChild(this.overlay);
    this.attachCinemaEvents();
  }

  addCinemaStyles() {
    if (document.getElementById("cinema-styles")) return;

    const style = document.createElement("style");
    style.id = "cinema-styles";
    style.textContent = `
      #cinema-overlay {
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,.95);
        display:flex;animation:cinemaIn .3s ease;
      }
      @keyframes cinemaIn {
        from{opacity:0} to{opacity:1}
      }
      .cinema-container {
        display:grid;
        grid-template-columns:1fr 300px;
        grid-template-rows:auto 1fr auto;
        width:100%;height:100%;
        gap:0;
      }
      .cinema-header {
        grid-column:1/-1;
        display:flex;justify-content:space-between;align-items:center;
        padding:12px 20px;
        background:rgba(255,255,255,.05);
        border-bottom:1px solid rgba(255,255,255,.1);
      }
      .cinema-title {
        display:flex;align-items:center;gap:10px;
        color:#fff;font-size:16px;font-weight:600;
      }
      .cinema-controls-top {display:flex;gap:6px}
      .cinema-btn {
        width:36px;height:36px;border:none;border-radius:10px;
        background:rgba(255,255,255,.1);color:#fff;cursor:pointer;
        display:grid;place-items:center;transition:.2s;font-size:14px;
      }
      .cinema-btn:hover{background:rgba(255,255,255,.2)}
      .cinema-close:hover{background:#ef4444}
      .cinema-player {
        display:grid;place-items:center;
        background:#000;min-height:400px;overflow:hidden;
      }
      .cinema-player iframe,.cinema-player video {
        width:100%;height:100%;border:none;
      }
      .cinema-loading {
        color:#fff;text-align:center;
      }
      .cinema-loading i {font-size:32px;margin-bottom:12px;color:var(--accent,#0a84ff)}
      .cinema-toolbar {
        padding:16px 20px;
        background:rgba(255,255,255,.03);
        border-top:1px solid rgba(255,255,255,.1);
        display:flex;align-items:center;gap:12px;
        flex-wrap:wrap;
      }
      .cinema-url-bar {
        display:flex;align-items:center;gap:8px;flex:1;
        background:rgba(255,255,255,.08);border-radius:12px;
        padding:4px 12px;
      }
      .cinema-url-bar i{color:#888;font-size:14px}
      .cinema-url-bar input {
        flex:1;border:none;background:transparent;color:#fff;
        font-family:'Tajawal',sans-serif;font-size:14px;
        padding:10px 8px;outline:none;
      }
      .cinema-url-bar input::placeholder{color:#555}
      .cinema-play-btn {
        padding:8px 16px;background:var(--accent,#0a84ff);color:#fff;
        border:none;border-radius:10px;cursor:pointer;
        font-family:'Tajawal';font-weight:600;font-size:13px;
        display:flex;align-items:center;gap:6px;
      }
      .cinema-or{color:#555;font-size:13px}
      .cinema-file-btn {
        padding:10px 16px;background:rgba(255,255,255,.08);color:#ccc;
        border:1px solid rgba(255,255,255,.15);border-radius:10px;
        cursor:pointer;font-family:'Tajawal';font-size:13px;
        display:flex;align-items:center;gap:6px;
      }
      .cinema-chat {
        grid-row:2/4;display:flex;flex-direction:column;
        border-right:1px solid rgba(255,255,255,.1);
        background:rgba(255,255,255,.03);
      }
      .cinema-chat-header {
        padding:12px 16px;color:#fff;font-size:14px;
        display:flex;align-items:center;gap:8px;
        border-bottom:1px solid rgba(255,255,255,.1);
      }
      .cinema-chat-messages {
        flex:1;overflow-y:auto;padding:12px;
        display:flex;flex-direction:column;gap:8px;
      }
      .cinema-chat-input {
        display:flex;gap:8px;padding:12px;
        border-top:1px solid rgba(255,255,255,.1);
      }
      .cinema-chat-input input {
        flex:1;padding:10px 12px;border-radius:10px;
        border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.08);color:#fff;
        font-family:'Tajawal';outline:none;font-size:14px;
      }
      .cinema-chat-input button {
        width:40px;height:40px;border-radius:10px;
        background:var(--accent,#0a84ff);color:#fff;
        border:none;cursor:pointer;display:grid;place-items:center;
      }
      .cinema-comment {
        padding:8px 12px;border-radius:10px;
        background:rgba(255,255,255,.06);
        color:#ddd;font-size:13px;line-height:1.5;
      }
      .cinema-comment .name{color:var(--accent,#0a84ff);font-weight:600;font-size:12px}
      @media(max-width:768px) {
        .cinema-container{grid-template-columns:1fr}
        .cinema-chat{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  attachCinemaEvents() {
    const close = document.getElementById("cinema-close");
    const playUrl = document.getElementById("cinema-play-url");
    const urlInput = document.getElementById("cinema-url");
    const fileBtn = document.getElementById("cinema-file-btn");
    const fileInput = document.getElementById("cinema-file-input");
    const pipBtn = document.getElementById("cinema-pip");
    const msgInput = document.getElementById("cinema-msg-input");
    const msgSend = document.getElementById("cinema-msg-send");

    if (close) close.onclick = () => this.close();

    if (playUrl) playUrl.onclick = () => {
      const url = urlInput.value.trim();
      if (url) this.playUrl(url);
    };

    if (urlInput) urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const url = urlInput.value.trim();
        if (url) this.playUrl(url);
      }
    });

    if (fileBtn) fileBtn.onclick = () => fileInput.click();
    if (fileInput) fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) this.loadFileVideo(file);
    };

    if (pipBtn) pipBtn.onclick = () => this.togglePiP();

    if (msgSend) msgSend.onclick = () => this.sendCinemaMessage();
    if (msgInput) msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.sendCinemaMessage();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isActive) this.close();
    });
  }

  playUrl(url) {
    const detected = this.detectPlatform(url);
    if (detected) {
      this.loadEmbed(detected);
    } else {
      this.loadLocalVideo(url);
    }
  }

  loadEmbed(detected) {
    const player = document.getElementById("cinema-player");
    const titleText = document.getElementById("cinema-title-text");
    if (!player) return;

    let embedUrl = "";

    if (detected.platform === "youtube") {
      embedUrl = "https://www.youtube.com/embed/" + detected.id + "?autoplay=1&rel=0";
    } else if (detected.platform === "twitch") {
      embedUrl = "https://player.twitch.tv/?channel=" + detected.id + "&parent=" + location.hostname;
    }

    player.innerHTML = `<iframe src="${embedUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`;
    if (titleText) titleText.textContent = detected.config.name + " - " + detected.id;

    this.currentMedia = { type: "embed", platform: detected.platform, id: detected.id };
    this.emit("mediaLoaded", this.currentMedia);
  }

  loadLocalVideo(src) {
    const player = document.getElementById("cinema-player");
    const titleText = document.getElementById("cinema-title-text");
    if (!player) return;

    player.innerHTML = `<video controls autoplay><source src="${src}"></video>`;
    if (titleText) titleText.textContent = "فيديو محلي";

    this.currentMedia = { type: "local", src };
    this.emit("mediaLoaded", this.currentMedia);
  }

  loadFileVideo(file) {
    const url = URL.createObjectURL(file);
    const player = document.getElementById("cinema-player");
    const titleText = document.getElementById("cinema-title-text");
    if (!player) return;

    player.innerHTML = `<video controls autoplay><source src="${url}"></video>`;
    if (titleText) titleText.textContent = file.name;

    this.currentMedia = { type: "file", name: file.name, url };
    this.emit("mediaLoaded", this.currentMedia);
  }

  async togglePiP() {
    const video = document.querySelector("#cinema-player video");
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.error("[Cinema] PiP error:", e);
    }
  }

  sendCinemaMessage() {
    const input = document.getElementById("cinema-msg-input");
    const messages = document.getElementById("cinema-messages");
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text) return;

    const msg = document.createElement("div");
    msg.className = "cinema-comment";
    msg.innerHTML = `<div class="name">أنت</div>${text}`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    input.value = "";

    this.emit("cinemaMessage", { text, timestamp: Date.now() });
  }

  close() {
    if (this.overlay) {
      this.overlay.style.animation = "cinemaIn .2s ease reverse";
      setTimeout(() => {
        this.overlay.remove();
        this.overlay = null;
      }, 200);
    }

    if (this.currentMedia?.url) {
      URL.revokeObjectURL(this.currentMedia.url);
    }

    this.isActive = false;
    this.currentMedia = null;
    this.emit("closed");
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, data) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error("[Cinema] Error:", e); }
    });
  }

  init() {
    console.log("[CinemaMode] Initialized");
    return this;
  }
}

export default CinemaMode;

export class NotificationManager {
  constructor() {
    this.isSupported = "Notification" in window;
    this.permission = this.isSupported ? Notification.permission : "denied";
    this.listeners = new Map();
    this.soundEnabled = true;
    this.notifSound = null;
    this.unreadCount = 0;
    this.originalTitle = document.title;
  }

  async requestPermission() {
    if (!this.isSupported) {
      console.warn("[Notif] Not supported");
      return "denied";
    }
    try {
      this.permission = await Notification.requestPermission();
      console.log("[Notif] Permission:", this.permission);
      this.emit("permissionChange", this.permission);
      return this.permission;
    } catch(e) {
      console.error("[Notif] Permission error:", e);
      return "denied";
    }
  }

  async show(title, options = {}) {
    if (this.permission !== "granted") {
      await this.requestPermission();
    }
    if (this.permission !== "granted") return null;
    if (document.hasFocus()) return null;

    try {
      var notif = new Notification(title, {
        body: options.body || "",
        icon: options.icon || "https://via.placeholder.com/96x96/0a84ff/ffffff?text=FC",
        badge: "https://via.placeholder.com/48x48/0a84ff/ffffff?text=FC",
        tag: options.tag || "fc-" + Date.now(),
        data: options.data || {},
        silent: !this.soundEnabled,
        requireInteraction: false
      });

      notif.onclick = function() {
        window.focus();
        notif.close();
        if (options.onClick) options.onClick(notif.data);
      };

      notif.onclose = function() {
        if (options.onClose) options.onClose();
      };

      if (this.soundEnabled) this.playSound();
      this.updateBadge(1);

      setTimeout(function() { notif.close(); }, 5000);
      return notif;
    } catch(e) {
      console.error("[Notif] Show error:", e);
      return null;
    }
  }

  showMessageNotification(senderName, messageText, chatId) {
    var shortMsg = messageText.length > 50 ? messageText.substring(0, 50) + "..." : messageText;
    return this.show("💬 " + senderName, {
      body: shortMsg,
      tag: "chat-" + chatId,
      data: { chatId: chatId, type: "message" },
      onClick: function(data) {
        console.log("[Notif] Clicked, chatId:", data.chatId);
      }
    });
  }

  playSound() {
    try {
      if (!this.notifSound) {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var oscillator = audioCtx.createOscillator();
        var gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch(e) {
      console.warn("[Notif] Sound failed");
    }
  }

  updateBadge(add) {
    this.unreadCount += add;
    if (this.unreadCount > 0) {
      document.title = "(" + this.unreadCount + ") " + this.originalTitle;
    } else {
      document.title = this.originalTitle;
    }
    if (navigator.setAppBadge) {
      navigator.setAppBadge(this.unreadCount).catch(function(){});
    }
  }

  clearBadge() {
    this.unreadCount = 0;
    document.title = this.originalTitle;
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(function(){});
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, data) {
    var cbs = this.listeners.get(event) || [];
    cbs.forEach(function(cb) {
      try { cb(data); } catch(e) { console.error("[Notif] Event error:", e); }
    });
  }

  async init() {
    if (this.isSupported && this.permission === "default") {
      console.log("[Notif] Will request permission on first message");
    }
    window.addEventListener("focus", function() {
      this.clearBadge();
    }.bind(this));
    console.log("[NotificationManager] Initialized, permission:", this.permission);
    return this;
  }

  getStatus() {
    return {
      supported: this.isSupported,
      permission: this.permission,
      soundEnabled: this.soundEnabled,
      unreadCount: this.unreadCount
    };
  }
}

export default NotificationManager;

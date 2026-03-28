export class BluetoothSync {
  constructor(settings) {
    this.settings = settings;
    this.isSupported = "bluetooth" in navigator;
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.listeners = new Map();
    this.messageQueue = [];
    this.retryCount = 0;
    this.maxRetries = 3;

    this.SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
    this.CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1";

    this.connectionState = "disconnected";
    this.discoveredDevices = [];
    this.transferStats = { sent: 0, received: 0, failed: 0 };
  }

  checkSupport() {
    const support = {
      bluetooth: "bluetooth" in navigator,
      ble: "bluetooth" in navigator,
      webrtc: "RTCPeerConnection" in window,
      wifi: "connection" in navigator,
      online: navigator.onLine
    };

    console.log("[BT] Support check:", support);
    return support;
  }

  async requestDevice() {
    if (!this.isSupported) {
      console.warn("[BT] Bluetooth not supported");
      this.emit("error", { code: "NOT_SUPPORTED", message: "البلوتوث غير مدعوم في هذا المتصفح" });
      return null;
    }

    try {
      this.setConnectionState("scanning");
      this.emit("scanning", true);

      console.log("[BT] Requesting device...");

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.SERVICE_UUID] }],
        optionalServices: [this.SERVICE_UUID]
      });

      console.log("[BT] Device found:", this.device.name);
      this.emit("deviceFound", {
        name: this.device.name || "جهاز غير معروف",
        id: this.device.id
      });

      this.device.addEventListener("gattserverdisconnected", () => {
        console.log("[BT] Device disconnected");
        this.handleDisconnection();
      });

      return this.device;
    } catch (error) {
      console.error("[BT] Device request failed:", error);
      this.setConnectionState("disconnected");
      this.emit("error", {
        code: error.code || "REQUEST_FAILED",
        message: this.getErrorMessage(error)
      });
      return null;
    }
  }

  async connect() {
    if (!this.device) {
      console.warn("[BT] No device selected");
      return false;
    }

    try {
      this.setConnectionState("connecting");
      console.log("[BT] Connecting to GATT server...");

      this.server = await this.device.gatt.connect();
      console.log("[BT] Connected to GATT server");

      const service = await this.server.getPrimaryService(this.SERVICE_UUID);
      console.log("[BT] Service found");

      this.characteristic = await service.getCharacteristic(this.CHAR_UUID);
      console.log("[BT] Characteristic found");

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener("characteristicvaluechanged", (event) => {
        this.handleIncomingData(event);
      });

      this.isConnected = true;
      this.retryCount = 0;
      this.setConnectionState("connected");

      console.log("[BT] Fully connected and listening");

      this.processQueue();

      return true;
    } catch (error) {
      console.error("[BT] Connection failed:", error);
      this.setConnectionState("error");
      this.emit("error", {
        code: "CONNECTION_FAILED",
        message: this.getErrorMessage(error)
      });

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log("[BT] Retrying... (" + this.retryCount + "/" + this.maxRetries + ")");
        await this.delay(2000 * this.retryCount);
        return this.connect();
      }

      return false;
    }
  }

  async sendMessage(message) {
    const packet = {
      type: "message",
      id: this.generateId(),
      data: message,
      timestamp: Date.now(),
      sender: "self"
    };

    if (!this.isConnected || !this.characteristic) {
      console.log("[BT] Offline, queuing message");
      this.messageQueue.push(packet);
      this.emit("queued", { queueSize: this.messageQueue.length });
      this.saveQueueToStorage();
      return { success: false, queued: true, id: packet.id };
    }

    try {
      const encoded = this.encodePacket(packet);
      const chunks = this.splitIntoChunks(encoded, 512);

      for (let i = 0; i < chunks.length; i++) {
        await this.characteristic.writeValue(chunks[i]);
        this.emit("sendProgress", {
          current: i + 1,
          total: chunks.length,
          messageId: packet.id
        });
      }

      this.transferStats.sent++;
      this.emit("messageSent", packet);
      console.log("[BT] Message sent:", packet.id);

      return { success: true, queued: false, id: packet.id };
    } catch (error) {
      console.error("[BT] Send failed:", error);
      this.transferStats.failed++;
      this.messageQueue.push(packet);
      this.saveQueueToStorage();

      this.emit("error", {
        code: "SEND_FAILED",
        message: "فشل الإرسال، تم حفظ الرسالة في الطابور"
      });

      return { success: false, queued: true, id: packet.id };
    }
  }

  handleIncomingData(event) {
    try {
      const value = event.target.value;
      const decoded = this.decodePacket(value);

      if (decoded.type === "message") {
        this.transferStats.received++;
        this.emit("messageReceived", decoded);
        console.log("[BT] Message received:", decoded.id);
      } else if (decoded.type === "ack") {
        this.emit("ack", decoded);
      } else if (decoded.type === "ping") {
        this.sendPong();
      }
    } catch (error) {
      console.error("[BT] Parse incoming data failed:", error);
    }
  }

  async processQueue() {
    if (this.messageQueue.length === 0) return;

    console.log("[BT] Processing queue:", this.messageQueue.length, "messages");
    this.emit("queueProcessing", { total: this.messageQueue.length });

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const packet of queue) {
      try {
        const encoded = this.encodePacket(packet);
        const chunks = this.splitIntoChunks(encoded, 512);
        for (const chunk of chunks) {
          await this.characteristic.writeValue(chunk);
        }
        this.transferStats.sent++;
        this.emit("messageSent", packet);
      } catch (error) {
        this.messageQueue.push(packet);
        console.error("[BT] Queue item failed:", error);
        break;
      }
    }

    this.saveQueueToStorage();
    this.emit("queueProcessed", {
      remaining: this.messageQueue.length,
      sent: queue.length - this.messageQueue.length
    });
  }

  handleDisconnection() {
    this.isConnected = false;
    this.setConnectionState("disconnected");
    this.emit("disconnected", {
      device: this.device?.name || "unknown",
      queueSize: this.messageQueue.length
    });

    if (this.settings?.get("enableBluetooth")) {
      console.log("[BT] Auto-reconnect in 5s...");
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  async reconnect() {
    if (this.isConnected) return;
    if (!this.device) return;

    console.log("[BT] Attempting reconnect...");
    this.retryCount = 0;
    await this.connect();
  }

  async disconnect() {
    try {
      if (this.characteristic) {
        await this.characteristic.stopNotifications();
      }
      if (this.server && this.server.connected) {
        this.server.disconnect();
      }
      this.isConnected = false;
      this.setConnectionState("disconnected");
      console.log("[BT] Disconnected gracefully");
    } catch (error) {
      console.error("[BT] Disconnect error:", error);
    }
  }

  encodePacket(packet) {
    const json = JSON.stringify(packet);
    return new TextEncoder().encode(json);
  }

  decodePacket(buffer) {
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text);
  }

  splitIntoChunks(data, chunkSize) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  saveQueueToStorage() {
    try {
      localStorage.setItem("fc-bt-queue", JSON.stringify(this.messageQueue));
    } catch (e) {
      console.warn("[BT] Queue save failed");
    }
  }

  loadQueueFromStorage() {
    try {
      const saved = localStorage.getItem("fc-bt-queue");
      if (saved) {
        this.messageQueue = JSON.parse(saved);
        console.log("[BT] Queue loaded:", this.messageQueue.length, "messages");
      }
    } catch (e) {
      console.warn("[BT] Queue load failed");
    }
  }

  setConnectionState(state) {
    const old = this.connectionState;
    this.connectionState = state;
    this.emit("stateChanged", { current: state, previous: old });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  off(event, callback) {
    const cbs = this.listeners.get(event) || [];
    this.listeners.set(event, cbs.filter(cb => cb !== callback));
  }

  emit(event, data) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error("[BT] Listener error:", e); }
    });
  }

  async sendPong() {
    if (!this.characteristic) return;
    const pong = this.encodePacket({ type: "pong", timestamp: Date.now() });
    await this.characteristic.writeValue(pong);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getErrorMessage(error) {
    const messages = {
      NotFoundError: "لم يتم العثور على جهاز",
      SecurityError: "تم رفض الإذن",
      NetworkError: "خطأ في الشبكة",
      NotSupportedError: "العملية غير مدعومة",
      AbortError: "تم إلغاء العملية"
    };
    return messages[error.name] || error.message || "خطأ غير معروف";
  }

  getStatus() {
    return {
      supported: this.isSupported,
      connected: this.isConnected,
      state: this.connectionState,
      device: this.device ? {
        name: this.device.name,
        id: this.device.id,
        connected: this.device.gatt?.connected
      } : null,
      queue: this.messageQueue.length,
      stats: { ...this.transferStats }
    };
  }

  init() {
    this.loadQueueFromStorage();

    window.addEventListener("online", () => {
      console.log("[BT] Network online");
      this.emit("networkChange", { online: true });
    });

    window.addEventListener("offline", () => {
      console.log("[BT] Network offline - BT mode available");
      this.emit("networkChange", { online: false });
    });

    console.log("[BluetoothSync] Initialized. Supported:", this.isSupported);
    return this;
  }
}

export default BluetoothSync;

export class E2EEncryption {
  constructor() {
    this.keyPair = null;
    this.peerKeys = new Map();
    this.algorithm = { name: "RSA-OAEP", hash: "SHA-256" };
    this.aesAlgorithm = { name: "AES-GCM", length: 256 };
    this.isSupported = typeof window.crypto !== "undefined" && typeof window.crypto.subtle !== "undefined";
  }

  async generateKeyPair() {
    if (!this.isSupported) {
      console.warn("[E2E] WebCrypto not supported");
      return null;
    }
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" },
        true, ["encrypt", "decrypt"]
      );
      console.log("[E2E] Key pair generated");
      return this.keyPair;
    } catch(e) {
      console.error("[E2E] Key generation failed:", e);
      return null;
    }
  }

  async exportPublicKey() {
    if (!this.keyPair) await this.generateKeyPair();
    if (!this.keyPair) return null;
    try {
      var exported = await window.crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
      return JSON.stringify(exported);
    } catch(e) {
      console.error("[E2E] Export failed:", e);
      return null;
    }
  }

  async importPeerPublicKey(peerId, jwkString) {
    try {
      var jwk = JSON.parse(jwkString);
      var key = await window.crypto.subtle.importKey(
        "jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
      );
      this.peerKeys.set(peerId, key);
      console.log("[E2E] Peer key imported:", peerId);
      return key;
    } catch(e) {
      console.error("[E2E] Import peer key failed:", e);
      return null;
    }
  }

  async generateAESKey() {
    return await window.crypto.subtle.generateKey(this.aesAlgorithm, true, ["encrypt", "decrypt"]);
  }

  async encryptMessage(text, peerId) {
    if (!this.isSupported) return { encrypted: false, text: text };
    var peerKey = this.peerKeys.get(peerId);
    if (!peerKey) return { encrypted: false, text: text };
    try {
      var aesKey = await this.generateAESKey();
      var iv = window.crypto.getRandomValues(new Uint8Array(12));
      var encoded = new TextEncoder().encode(text);
      var encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, aesKey, encoded
      );
      var exportedAES = await window.crypto.subtle.exportKey("raw", aesKey);
      var encryptedAESKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" }, peerKey, exportedAES
      );
      return {
        encrypted: true,
        data: this.bufferToBase64(encryptedData),
        iv: this.bufferToBase64(iv),
        key: this.bufferToBase64(encryptedAESKey),
        version: "1.0"
      };
    } catch(e) {
      console.error("[E2E] Encrypt failed:", e);
      return { encrypted: false, text: text };
    }
  }

  async decryptMessage(encryptedMsg) {
    if (!this.isSupported || !this.keyPair) return encryptedMsg.text || "[فشل فك التشفير]";
    if (!encryptedMsg.encrypted) return encryptedMsg.text;
    try {
      var encryptedAESKey = this.base64ToBuffer(encryptedMsg.key);
      var aesKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" }, this.keyPair.privateKey, encryptedAESKey
      );
      var aesKey = await window.crypto.subtle.importKey(
        "raw", aesKeyRaw, this.aesAlgorithm, false, ["decrypt"]
      );
      var iv = this.base64ToBuffer(encryptedMsg.iv);
      var encryptedData = this.base64ToBuffer(encryptedMsg.data);
      var decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv }, aesKey, encryptedData
      );
      return new TextDecoder().decode(decrypted);
    } catch(e) {
      console.error("[E2E] Decrypt failed:", e);
      return "[رسالة مشفرة - فشل فك التشفير]";
    }
  }

  bufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  base64ToBuffer(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async saveKeysToStorage() {
    if (!this.keyPair) return;
    try {
      var pub = await window.crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
      var priv = await window.crypto.subtle.exportKey("jwk", this.keyPair.privateKey);
      localStorage.setItem("fc-e2e-pub", JSON.stringify(pub));
      localStorage.setItem("fc-e2e-priv", JSON.stringify(priv));
      console.log("[E2E] Keys saved to storage");
    } catch(e) { console.warn("[E2E] Save keys failed"); }
  }

  async loadKeysFromStorage() {
    try {
      var pubStr = localStorage.getItem("fc-e2e-pub");
      var privStr = localStorage.getItem("fc-e2e-priv");
      if (!pubStr || !privStr) return false;
      var pub = await window.crypto.subtle.importKey(
        "jwk", JSON.parse(pubStr), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
      );
      var priv = await window.crypto.subtle.importKey(
        "jwk", JSON.parse(privStr), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]
      );
      this.keyPair = { publicKey: pub, privateKey: priv };
      console.log("[E2E] Keys loaded from storage");
      return true;
    } catch(e) {
      console.warn("[E2E] Load keys failed, generating new");
      return false;
    }
  }

  async init() {
    if (!this.isSupported) {
      console.warn("[E2E] Not supported in this browser");
      return this;
    }
    var loaded = await this.loadKeysFromStorage();
    if (!loaded) {
      await this.generateKeyPair();
      await this.saveKeysToStorage();
    }
    console.log("[E2E] Initialized, supported:", this.isSupported);
    return this;
  }

  getStatus() {
    return {
      supported: this.isSupported,
      hasKeyPair: this.keyPair !== null,
      peerCount: this.peerKeys.size
    };
  }
}

export default E2EEncryption;

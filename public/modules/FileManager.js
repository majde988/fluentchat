export class FileManager {
  constructor(settings) {
    this.settings = settings;
    this.uploads = new Map();
    this.downloads = new Map();
    this.listeners = new Map();
    this.maxFileSize = 100 * 1024 * 1024;
    this.chunkSize = 256 * 1024;
    this.allowedTypes = {
      image: ["image/jpeg","image/png","image/gif","image/webp","image/svg+xml"],
      video: ["video/mp4","video/webm","video/ogg"],
      audio: ["audio/mpeg","audio/ogg","audio/wav","audio/webm"],
      document: ["application/pdf","application/zip","application/x-rar","text/plain",
                 "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                 "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    };
  }

  getFileCategory(mimeType) {
    for (const [cat, types] of Object.entries(this.allowedTypes)) {
      if (types.includes(mimeType)) return cat;
    }
    return "other";
  }

  getFileIcon(category) {
    const icons = {
      image: "fa-image",
      video: "fa-video",
      audio: "fa-music",
      document: "fa-file-lines",
      other: "fa-file"
    };
    return icons[category] || icons.other;
  }

  formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  validateFile(file) {
    const errors = [];
    if (file.size > this.maxFileSize) {
      errors.push("حجم الملف يتجاوز " + this.formatSize(this.maxFileSize));
    }
    if (file.size === 0) {
      errors.push("الملف فارغ");
    }
    return { valid: errors.length === 0, errors };
  }

  async upload(file, storagePath, metadata = {}) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      this.emit("uploadError", { file: file.name, errors: validation.errors });
      return null;
    }

    const uploadId = this.generateId();
    const category = this.getFileCategory(file.type);

    const uploadTask = {
      id: uploadId,
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      category: category,
      path: storagePath,
      progress: 0,
      bytesTransferred: 0,
      state: "preparing",
      startTime: Date.now(),
      url: null,
      error: null,
      metadata: metadata,
      paused: false
    };

    this.uploads.set(uploadId, uploadTask);
    this.emit("uploadStart", uploadTask);

    try {
      uploadTask.state = "uploading";
      this.emit("uploadStateChange", uploadTask);

      const totalChunks = Math.ceil(file.size / this.chunkSize);
      let uploaded = 0;

      for (let i = 0; i < totalChunks; i++) {
        if (uploadTask.paused) {
          uploadTask.state = "paused";
          this.emit("uploadStateChange", uploadTask);
          await this.waitForResume(uploadId);
        }

        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);

        uploaded += chunk.size;
        uploadTask.bytesTransferred = uploaded;
        uploadTask.progress = Math.round((uploaded / file.size) * 100);

        this.emit("uploadProgress", {
          id: uploadId,
          progress: uploadTask.progress,
          bytesTransferred: uploaded,
          totalBytes: file.size
        });

        await this.delay(50);
      }

      const fakeUrl = URL.createObjectURL(file);
      uploadTask.url = fakeUrl;
      uploadTask.state = "completed";
      uploadTask.endTime = Date.now();

      this.saveUploadRecord(uploadTask);
      this.emit("uploadComplete", uploadTask);

      console.log("[FileManager] Upload complete:", file.name);
      return uploadTask;

    } catch (error) {
      uploadTask.state = "error";
      uploadTask.error = error.message;
      this.emit("uploadError", { id: uploadId, error: error.message });
      console.error("[FileManager] Upload failed:", error);
      return null;
    }
  }

  pauseUpload(uploadId) {
    const task = this.uploads.get(uploadId);
    if (task && task.state === "uploading") {
      task.paused = true;
      console.log("[FileManager] Upload paused:", uploadId);
    }
  }

  resumeUpload(uploadId) {
    const task = this.uploads.get(uploadId);
    if (task && task.paused) {
      task.paused = false;
      task.state = "uploading";
      this.emit("uploadStateChange", task);
      console.log("[FileManager] Upload resumed:", uploadId);
    }
  }

  cancelUpload(uploadId) {
    const task = this.uploads.get(uploadId);
    if (task) {
      task.state = "cancelled";
      task.paused = false;
      this.uploads.delete(uploadId);
      this.emit("uploadCancelled", { id: uploadId });
      console.log("[FileManager] Upload cancelled:", uploadId);
    }
  }

  waitForResume(uploadId) {
    return new Promise(resolve => {
      const check = () => {
        const task = this.uploads.get(uploadId);
        if (!task || !task.paused) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  async createImageThumbnail(file, maxWidth = 200) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  saveUploadRecord(task) {
    try {
      const records = JSON.parse(localStorage.getItem("fc-uploads") || "[]");
      records.push({
        id: task.id,
        name: task.name,
        size: task.size,
        type: task.type,
        category: task.category,
        url: task.url,
        timestamp: Date.now()
      });
      if (records.length > 100) records.shift();
      localStorage.setItem("fc-uploads", JSON.stringify(records));
    } catch (e) {
      console.warn("[FileManager] Save record failed");
    }
  }

  getUploadHistory() {
    try {
      return JSON.parse(localStorage.getItem("fc-uploads") || "[]");
    } catch (e) {
      return [];
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, data) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error("[FileManager] Event error:", e); }
    });
  }

  generateId() {
    return "upload_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  getStats() {
    let active = 0, completed = 0, failed = 0;
    for (const [, task] of this.uploads) {
      if (task.state === "uploading") active++;
      else if (task.state === "completed") completed++;
      else if (task.state === "error") failed++;
    }
    return { active, completed, failed, total: this.uploads.size };
  }

  init() {
    console.log("[FileManager] Initialized");
    return this;
  }
}

export default FileManager;

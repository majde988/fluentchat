const { app, BrowserWindow, Tray, Menu, nativeImage, Notification } = require("electron");
const path = require("path");

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: "FluentChat",
    icon: path.join(__dirname, "icon.png"),
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false,
    backgroundColor: "#0a84ff"
  });

  mainWindow.loadURL("https://my-f-bc9c8.web.app");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "FluentChat",
          body: "التطبيق يعمل في الخلفية",
          icon: path.join(__dirname, "icon.png")
        }).show();
      }
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: "FluentChat",
      submenu: [
        { label: "حول FluentChat", role: "about" },
        { type: "separator" },
        { label: "إعادة تحميل", accelerator: "CmdOrCtrl+R", click: () => mainWindow.reload() },
        { label: "أدوات المطور", accelerator: "F12", click: () => mainWindow.webContents.toggleDevTools() },
        { type: "separator" },
        { label: "خروج", accelerator: "CmdOrCtrl+Q", click: () => { app.isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: "تعديل",
      submenu: [
        { label: "تراجع", role: "undo" },
        { label: "إعادة", role: "redo" },
        { type: "separator" },
        { label: "قص", role: "cut" },
        { label: "نسخ", role: "copy" },
        { label: "لصق", role: "paste" },
        { label: "تحديد الكل", role: "selectAll" }
      ]
    },
    {
      label: "عرض",
      submenu: [
        { label: "تكبير", role: "zoomIn" },
        { label: "تصغير", role: "zoomOut" },
        { label: "حجم طبيعي", role: "resetZoom" },
        { type: "separator" },
        { label: "ملء الشاشة", role: "togglefullscreen" }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

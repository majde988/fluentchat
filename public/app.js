import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { SettingsManager } from "./modules/SettingsManager.js";
import { BluetoothSync } from "./modules/BluetoothSync.js";
import { VirtualScroller } from "./modules/VirtualScroller.js";
import { FileManager } from "./modules/FileManager.js";
import { CinemaMode } from "./modules/CinemaMode.js";
import { E2EEncryption } from "./modules/E2EEncryption.js";
import { NotificationManager } from "./modules/NotificationManager.js";
import { PerformanceMonitor } from "./modules/PerformanceMonitor.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJpL404JeoowfqxaM-40l_cOTh8UVQHa4",
  authDomain: "my-f-bc9c8.firebaseapp.com",
  databaseURL: "https://my-f-bc9c8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "my-f-bc9c8",
  storageBucket: "my-f-bc9c8.firebasestorage.app",
  messagingSenderId: "429037800855",
  appId: "1:429037800855:web:48a70e5cbee7506d7408d2",
  measurementId: "G-34R14D1C3T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const settingsManager = new SettingsManager();
const bluetoothSync = new BluetoothSync(settingsManager);
const fileManager = new FileManager(settingsManager);
const cinemaMode = new CinemaMode(settingsManager);
const perfMonitor = new PerformanceMonitor(settingsManager);
const e2e = new E2EEncryption();
const notifManager = new NotificationManager();
const e2e = new E2EEncryption();
const notifManager = new NotificationManager();

let currentUser = null;
let currentChatId = null;
let currentOtherUser = null;
let unsubMessages = null;
let unsubChats = null;

const $ = id => document.getElementById(id);

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function openModal(m) { m.classList.remove("hidden"); }
function closeModal(m) { m.classList.add("hidden"); }
function randomColor(s) {
  const c = ["#0a84ff","#8b5cf6","#10b981","#ef4444","#f97316","#ec4899","#06b6d4"];
  let h = 0;
  for (let x of (s||"x")) h = x.charCodeAt(0)+((h<<5)-h);
  return c[Math.abs(h)%c.length];
}
function setAvatar(el, user) {
  if (!el) return;
  if (user.photoURL) {
    el.innerHTML = '<img src="'+user.photoURL+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>';
    el.style.background = "transparent";
  } else {
    el.innerHTML = (user.displayName||user.email||"?")[0].toUpperCase();
    el.style.background = randomColor(user.uid||user.email);
  }
}
function formatTime(ts) {
  if (!ts) return "";
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"});
}
function formatDate(ts) {
  if (!ts) return "الآن";
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  var now = new Date();
  if (d.toDateString()===now.toDateString()) return "اليوم";
  var y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString()===y.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA");
}
function escapeHTML(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function getBestName(u) {
  if (!u) return "زائر";
  if (u.displayName && u.displayName.trim()) return u.displayName.trim();
  if (u.email) return u.email.split("@")[0];
  return "مستخدم";
}

// =================== Auth ===================
onAuthStateChanged(auth, async user => {
  setTimeout(() => {
    $("loadingScreen").style.opacity = "0";
    $("loadingScreen").style.pointerEvents = "none";
  }, 1500);
  setTimeout(() => $("loadingScreen").style.display = "none", 2000);

  if (user) {
    currentUser = user;
    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    await saveUserProfile(user);
    loadUI(user);
    listenToMyChats();
    settingsManager.init();
    bluetoothSync.init();
    fileManager.init();
    perfMonitor.start();
    await e2e.init();
    await notifManager.init();
    if (notifManager.permission === "default") notifManager.requestPermission();
  } else {
    currentUser = null;
    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    if (unsubChats) unsubChats();
    if (unsubMessages) unsubMessages();
    perfMonitor.stop();
  }
});

async function saveUserProfile(user) {
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      displayName: getBestName(user),
      email: user.email || "",
      photoURL: user.photoURL || "",
      online: true,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch(e) { console.error("Save profile:", e); }
}

function loadUI(user) {
  var name = getBestName(user);
  if ($("cuName")) $("cuName").textContent = name;
  if ($("cuAvatar")) setAvatar($("cuAvatar"), user);
  if ($("welcomeName")) $("welcomeName").textContent = "مرحباً، " + name.split(" ")[0] + "! 👋";
}

$("googleLoginBtn").onclick = async () => {
  var btn = $("googleLoginBtn");
  try {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري...';
    btn.disabled = true;
    var provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (e) {
    showToast("فشل الدخول: " + e.code);
    btn.innerHTML = '<img src="https://www.google.com/favicon.ico" width="20" height="20"/> تسجيل الدخول بـ Google';
    btn.disabled = false;
  }
};

$("logoutBtn").onclick = async () => {
  if (!confirm("تسجيل الخروج؟")) return;
  try {
    if (currentUser) await setDoc(doc(db,"users",currentUser.uid),{online:false},{merge:true});
    await signOut(auth);
    $("chatList").innerHTML = "";
    $("messages").innerHTML = "";
    currentChatId = null;
    $("welcomeScreen").classList.remove("hidden");
    $("chatScreen").classList.add("hidden");
    showToast("تم الخروج 👋");
  } catch(e) { showToast("خطأ: "+e.message); }
};

// =================== Chats ===================
function listenToMyChats() {
  if (unsubChats) unsubChats();
  var q = query(collection(db,"chats"), where("members","array-contains",currentUser.uid));
  unsubChats = onSnapshot(q, async snap => {
    await renderMyChats(snap.docs);
  }, err => { console.error("Chats err:", err); });
}

async function renderMyChats(docs) {
  var cl = $("chatList");
  cl.innerHTML = "";
  if (docs.length === 0) {
    cl.innerHTML = '<div class="empty-chats"><i class="fa-regular fa-comment-dots"></i><p>لا توجد محادثات</p></div>';
    return;
  }
  var sorted = [...docs].sort((a,b) => (b.data().lastMessageTime?.seconds||0)-(a.data().lastMessageTime?.seconds||0));
  for (var d of sorted) {
    var chat = d.data();
    var otherId = chat.members.find(id => id !== currentUser.uid);
    if (!otherId) continue;
    var other;
    try {
      var od = await getDoc(doc(db,"users",otherId));
      if (!od.exists()) continue;
      other = od.data();
    } catch(e) { continue; }
    var item = document.createElement("div");
    item.className = "chat-item" + (currentChatId===d.id?" active":"");
    item.dataset.chatId = d.id;
    var oName = getBestName(other);
    var avC = other.photoURL
      ? '<img src="'+other.photoURL+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>'
      : oName[0].toUpperCase();
    var avS = other.photoURL ? "" : "background:"+randomColor(other.uid);
    item.innerHTML = '<div class="avatar" style="'+avS+'">'+avC+'</div>'
      +'<div class="chat-meta"><div class="chat-meta-top"><h4>'+escapeHTML(oName)+'</h4>'
      +'<span class="time">'+(chat.lastMessageTime?formatTime(chat.lastMessageTime):"")+'</span></div>'
      +'<p>'+escapeHTML(chat.lastMessage||"ابدأ المحادثة...")+'</p></div>'
      +(other.online?'<span class="badge" style="background:#10b981;font-size:8px">●</span>':"");
    item.onclick = () => openChat(d.id, other);
    cl.appendChild(item);
  }
}

function openChat(chatId, otherUser) {
  currentChatId = chatId;
  currentOtherUser = otherUser;
  $("welcomeScreen").classList.add("hidden");
  $("chatScreen").classList.remove("hidden");
  var n = getBestName(otherUser);
  $("chatName").textContent = n;
  $("chatStatus").textContent = otherUser.online ? "● متصل" : "غير متصل";
  $("chatStatus").style.color = otherUser.online ? "#10b981" : "var(--muted)";
  setAvatar($("chatAvatar"), otherUser);
  setAvatar($("profileAvatar"), otherUser);
  if ($("profileName")) $("profileName").textContent = n;
  if ($("profileEmail")) $("profileEmail").textContent = otherUser.email || "";
  document.querySelectorAll(".chat-item").forEach(el => {
    el.classList.toggle("active", el.dataset.chatId === chatId);
  });
  listenToMessages(chatId);
  if (window.innerWidth <= 768) $("sidebar").classList.add("mobile-hidden");
}

function listenToMessages(chatId) {
  if (unsubMessages) unsubMessages();
  var msgs = $("messages");
  msgs.innerHTML = '<div class="msgs-loading"><i class="fa-solid fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
  var q = query(collection(db,"chats",chatId,"messages"), orderBy("createdAt","asc"));
  unsubMessages = onSnapshot(q, snap => {
    msgs.innerHTML = "";
    var lastDate = "";
    snap.docs.forEach(d => {
      var msg = d.data();
      var mDate = msg.createdAt ? formatDate(msg.createdAt) : "الآن";
      if (mDate !== lastDate) {
        lastDate = mDate;
        var div = document.createElement("div");
        div.className = "date-divider";
        div.textContent = mDate;
        msgs.appendChild(div);
      }
      var isSent = msg.senderId === currentUser.uid;
      var div = document.createElement("div");
      div.className = "message " + (isSent ? "sent" : "received");
      if (msg.fileUrl) {
        div.innerHTML = '<div class="file-bubble"><div class="file-icon"><i class="fa-solid fa-file"></i></div>'
          +'<div class="file-info"><h5>'+escapeHTML(msg.fileName||"ملف")+'</h5>'
          +'<span>'+escapeHTML(msg.fileSize||"")+'</span></div></div>'
          +'<div class="msg-meta"><span>'+formatTime(msg.createdAt)+'</span></div>';
      } else if (msg.imageUrl) {
        div.innerHTML = '<div class="img-bubble"><img src="'+msg.imageUrl+'" alt="صورة"/></div>'
          +'<div class="msg-meta"><span>'+formatTime(msg.createdAt)+'</span></div>';
      } else {
        div.innerHTML = '<div class="bubble">'+escapeHTML(msg.text)+'</div>'
          +'<div class="msg-meta"><span>'+formatTime(msg.createdAt)+'</span>'
          +(isSent?'<i class="fa-solid fa-check-double"></i>':"")+'</div>';
      }
      msgs.appendChild(div);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }, err => {
    msgs.innerHTML = '<div class="msgs-loading"><i class="fa-solid fa-triangle-exclamation"></i><p>خطأ</p></div>';
  });
}

async function sendMessage() {
  var text = $("messageInput").value.trim();
  if (!text || !currentChatId || !currentUser) return;
  $("messageInput").value = "";
  $("messageInput").style.height = "48px";
  try {
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      text: text,
      senderId: currentUser.uid,
      senderName: getBestName(currentUser),
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db,"chats",currentChatId), {
      lastMessage: text,
      lastMessageTime: serverTimestamp()
    }, { merge: true });
  } catch(e) { showToast("فشل الإرسال"); console.error(e); }
}

async function getOrCreateChat(otherUserId) {
  var q = query(collection(db,"chats"), where("members","array-contains",currentUser.uid));
  var snap = await getDocs(q);
  for (var d of snap.docs) {
    if (d.data().members.includes(otherUserId)) return d.id;
  }
  var nc = await addDoc(collection(db,"chats"), {
    members: [currentUser.uid, otherUserId],
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageTime: serverTimestamp()
  });
  return nc.id;
}

// =================== Search Users ===================
var searchTimeout;
$("userSearchInput").addEventListener("input", function(e) {
  clearTimeout(searchTimeout);
  var q = e.target.value.trim();
  if (!q) {
    $("searchResults").innerHTML = '<div class="search-hint"><i class="fa-solid fa-magnifying-glass"></i><p>اكتب للبحث</p></div>';
    return;
  }
  searchTimeout = setTimeout(function() { searchUsers(q); }, 400);
});

async function searchUsers(term) {
  $("searchResults").innerHTML = '<div class="search-hint"><i class="fa-solid fa-spinner fa-spin"></i><p>جاري البحث...</p></div>';
  try {
    var snap = await getDocs(collection(db, "users"));
    var results = snap.docs.map(function(d){return d.data()})
      .filter(function(u){return u.uid !== currentUser.uid})
      .filter(function(u){
        return (u.displayName||"").toLowerCase().includes(term.toLowerCase()) ||
               (u.email||"").toLowerCase().includes(term.toLowerCase());
      });
    if (results.length === 0) {
      $("searchResults").innerHTML = '<div class="search-hint"><i class="fa-regular fa-face-sad-tear"></i><p>لا نتائج</p></div>';
      return;
    }
    $("searchResults").innerHTML = "";
    results.forEach(function(user) {
      var item = document.createElement("div");
      item.className = "chat-item";
      var uName = getBestName(user);
      var avC = user.photoURL
        ? '<img src="'+user.photoURL+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>'
        : uName[0].toUpperCase();
      var avS = user.photoURL ? "" : "background:"+randomColor(user.uid);
      item.innerHTML = '<div class="avatar" style="'+avS+'">'+avC+'</div>'
        +'<div class="chat-meta"><div class="chat-meta-top"><h4>'+escapeHTML(uName)+'</h4>'
        +(user.online?'<span style="color:#10b981;font-size:12px">● متصل</span>':"")
        +'</div><p>'+escapeHTML(user.email||"")+'</p></div>';
      item.onclick = async function() {
        closeModal($("newChatModal"));
        showToast("جاري الفتح...");
        var chatId = await getOrCreateChat(user.uid);
        openChat(chatId, user);
      };
      $("searchResults").appendChild(item);
    });
  } catch(e) {
    $("searchResults").innerHTML = '<div class="search-hint"><i class="fa-solid fa-triangle-exclamation"></i><p>خطأ</p></div>';
  }
}

// =================== File Upload ===================
function handleFileUpload(files) {
  if (!files || !files.length || !currentChatId) return;
  var file = files[0];
  var validation = fileManager.validateFile(file);
  if (!validation.valid) {
    showToast(validation.errors[0]);
    return;
  }
  $("uploadOverlay").classList.remove("hidden");
  $("uploadFileName").textContent = file.name;
  $("uploadProgressFill").style.width = "0%";
  $("uploadProgressText").textContent = "0%";

  fileManager.on("uploadProgress", function(data) {
    $("uploadProgressFill").style.width = data.progress + "%";
    $("uploadProgressText").textContent = data.progress + "% - " + fileManager.formatSize(data.bytesTransferred);
  });

  fileManager.on("uploadComplete", async function(task) {
    $("uploadOverlay").classList.add("hidden");
    showToast("تم رفع " + task.name + " ✅");
    var category = fileManager.getFileCategory(task.type);
    var msgData = {
      senderId: currentUser.uid,
      senderName: getBestName(currentUser),
      createdAt: serverTimestamp(),
      text: "📎 " + task.name
    };
    if (category === "image") {
      msgData.imageUrl = task.url;
    } else {
      msgData.fileUrl = task.url;
      msgData.fileName = task.name;
      msgData.fileSize = fileManager.formatSize(task.size);
    }
    await addDoc(collection(db,"chats",currentChatId,"messages"), msgData);
    await setDoc(doc(db,"chats",currentChatId), {
      lastMessage: "📎 " + task.name,
      lastMessageTime: serverTimestamp()
    }, { merge: true });
  });

  fileManager.upload(file, "chats/"+currentChatId+"/"+Date.now()+"_"+file.name);
}

// =================== Performance Settings ===================
document.querySelectorAll(".perf-btn").forEach(function(btn) {
  btn.onclick = function() {
    var mode = btn.dataset.mode;
    settingsManager.setPerformanceMode(mode);
    document.querySelectorAll(".perf-btn").forEach(function(b){b.classList.remove("active")});
    btn.classList.add("active");
    showToast("وضع الأداء: " + settingsManager.getCurrentMode().label + " ✨");
  };
});

if ($("autoBenchmarkBtn")) {
  $("autoBenchmarkBtn").onclick = async function() {
    $("autoBenchmarkBtn").innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الفحص...';
    var result = await settingsManager.autoBenchmark();
    $("autoBenchmarkBtn").innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> كشف تلقائي';
    var br = $("benchmarkResult");
    br.classList.remove("hidden");
    br.innerHTML = '<b>نتائج الفحص:</b><br>'
      +'FPS: '+result.fps+'<br>'
      +'المعالج: '+result.cores+' أنوية<br>'
      +(result.memory?'RAM: '+result.memory+'MB<br>':'')
      +'<div class="rec"><i class="fa-solid fa-star"></i> الموصى به: '+settingsManager.modes[result.recommended].label+'</div>';
    settingsManager.setPerformanceMode(result.recommended);
    document.querySelectorAll(".perf-btn").forEach(function(b){
      b.classList.toggle("active", b.dataset.mode === result.recommended);
    });
  };
}

// =================== Bluetooth ===================
var btEnabled = false;
if ($("btToggle")) {
  $("btToggle").onclick = function() {
    btEnabled = !btEnabled;
    $("btToggle").classList.toggle("active", btEnabled);
    settingsManager.set("enableBluetooth", btEnabled);
    $("btStatusText").textContent = btEnabled ? "البلوتوث مفعل" : "البلوتوث غير مفعل";
    $("btStatus").classList.toggle("connected", btEnabled);
    showToast(btEnabled ? "تم تفعيل البلوتوث 📡" : "تم إيقاف البلوتوث");
  };
}

if ($("btScanBtn")) {
  $("btScanBtn").onclick = async function() {
    if (!bluetoothSync.isSupported) {
      showToast("البلوتوث غير مدعوم في هذا المتصفح ❌");
      return;
    }
    $("btScanBtn").innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...';
    var device = await bluetoothSync.requestDevice();
    if (device) {
      $("btDevices").innerHTML = '<div class="bt-device"><i class="fa-solid fa-bluetooth-b"></i><span>'+device.name+'</span></div>';
      showToast("تم العثور على: " + device.name);
      await bluetoothSync.connect();
    }
    $("btScanBtn").innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> بحث عن أجهزة';
  };
}

// =================== Performance Monitor Toggle ===================
var perfWidgetVisible = false;
if ($("perfToggle")) {
  $("perfToggle").onclick = function() {
    perfWidgetVisible = !perfWidgetVisible;
    $("perfToggle").classList.toggle("active", perfWidgetVisible);
    if (perfWidgetVisible) {
      perfMonitor.createWidget();
    } else {
      perfMonitor.removeWidget();
    }
  };
}

// =================== Cinema Mode ===================
if ($("cinemaBtn")) $("cinemaBtn").onclick = function() { cinemaMode.open(""); };
if ($("cinemaChatBtn")) $("cinemaChatBtn").onclick = function() { cinemaMode.open(""); };
if ($("welcomeCinema")) $("welcomeCinema").onclick = function() { cinemaMode.open(""); };

// =================== Events ===================
$("sendBtn").onclick = sendMessage;
$("settingsBtn").onclick = function() { openModal($("settingsModal")); };
$("newChatBtn").onclick = function() { openModal($("newChatModal")); $("userSearchInput").focus(); };
$("welcomeNewChat").onclick = function() { openModal($("newChatModal")); $("userSearchInput").focus(); };
$("welcomeSettings").onclick = function() { openModal($("settingsModal")); };
$("closeSettingsBtn").onclick = function() { closeModal($("settingsModal")); };
$("closeNewChatBtn").onclick = function() { closeModal($("newChatModal")); };
$("profileBtn").onclick = function() { $("profilePanel").classList.toggle("hidden"); };
$("closeProfileBtn").onclick = function() { $("profilePanel").classList.add("hidden"); };
$("backBtn").onclick = function() { $("sidebar").classList.remove("mobile-hidden"); };

$("messageInput").addEventListener("input", function() {
  this.style.height = "48px";
  this.style.height = Math.min(this.scrollHeight, 130) + "px";
});
$("messageInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// File attachments
if ($("attachBtn")) $("attachBtn").onclick = function() { $("fileInput").click(); };
if ($("attachBtn2")) $("attachBtn2").onclick = function() { $("fileInput").click(); };
$("fileInput").addEventListener("change", function(e) { handleFileUpload(e.target.files); });

if ($("uploadPauseBtn")) $("uploadPauseBtn").onclick = function() { showToast("تم الإيقاف المؤقت"); };
if ($("uploadCancelBtn")) $("uploadCancelBtn").onclick = function() { $("uploadOverlay").classList.add("hidden"); showToast("تم الإلغاء"); };

// Emoji
$("emojiBtn").onclick = function() { $("emojiPicker").classList.toggle("hidden"); };
var emojis = ["😀","😂","😍","🔥","👍","👏","🎉","💙","💜","✨","🚀","��","🙏","❤️","😊","🤝","😅","🥳","💬","🎯","💡","⭐","💪","🎨","📎"];
emojis.forEach(function(e) {
  var b = document.createElement("button");
  b.className = "emoji";
  b.textContent = e;
  b.onclick = function() { $("messageInput").value += e; $("messageInput").focus(); };
  $("emojiPicker").appendChild(b);
});

// Theme
document.querySelectorAll(".theme-btn").forEach(function(btn) {
  btn.onclick = function() {
    document.body.dataset.theme = btn.dataset.theme;
    localStorage.setItem("fc-theme", btn.dataset.theme);
    settingsManager.applyTheme(btn.dataset.theme);
    document.querySelectorAll(".theme-btn").forEach(function(b){b.classList.remove("active")});
    btn.classList.add("active");
    showToast(btn.dataset.theme==="dark"?"الوضع الداكن 🌙":"الوضع الفاتح ☀️");
  };
});

// Accent
document.querySelectorAll(".accent").forEach(function(btn) {
  btn.onclick = function() {
    document.body.dataset.accent = btn.dataset.accent;
    localStorage.setItem("fc-accent", btn.dataset.accent);
    settingsManager.applyAccent(btn.dataset.accent);
    document.querySelectorAll(".accent").forEach(function(b){b.classList.remove("active")});
    btn.classList.add("active");
    showToast("تم تغيير اللون 🎨");
  };
});

// Close modals on backdrop
window.addEventListener("click", function(e) {
  if (e.target === $("settingsModal")) closeModal($("settingsModal"));
  if (e.target === $("newChatModal")) closeModal($("newChatModal"));
  if (!$("emojiPicker").contains(e.target) && !e.target.closest("#emojiBtn")) {
    $("emojiPicker").classList.add("hidden");
  }
});

// =================== Load Settings ===================
(function loadSettings() {
  var theme = localStorage.getItem("fc-theme") || "light";
  var accent = localStorage.getItem("fc-accent") || "blue";
  document.body.dataset.theme = theme;
  document.body.dataset.accent = accent;
  document.querySelectorAll(".theme-btn").forEach(function(b){
    b.classList.toggle("active", b.dataset.theme === theme);
  });
  document.querySelectorAll(".accent").forEach(function(b){
    b.classList.toggle("active", b.dataset.accent === accent);
  });
  var savedMode = settingsManager.get("performanceMode");
  document.querySelectorAll(".perf-btn").forEach(function(b){
    b.classList.toggle("active", b.dataset.mode === savedMode);
  });
})();

console.log("FluentChat v2.0 loaded - Modules:", {
  settings: "✅",
  bluetooth: bluetoothSync.isSupported ? "✅" : "❌",
  fileManager: "✅",
  cinema: "✅",
  perfMonitor: "✅",
  virtualScroller: "✅"
});

// =================== Notification on new message ===================
window.addEventListener("focus", function() {
  if (notifManager) notifManager.clearBadge();
});

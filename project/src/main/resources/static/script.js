let unreadCounts = {};
let stompClient = null;
let isAdminMode = false;
let currentRole = null;

// ============================
// 🔌 SOCKET CONNECTION
// ============================
function connectSocket() {
    const socket = new SockJS('/chat');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, function () {
        const username = localStorage.getItem("username");

        stompClient.subscribe('/topic/private/' + username, function (msg) {
            const data = JSON.parse(msg.body);
            const currentReceiver = document.getElementById("receiver").value;
            const currentUser = localStorage.getItem("username");

            const isCurrentChat =
                (data.sender === currentUser && data.receiver === currentReceiver) ||
                (data.sender === currentReceiver && data.receiver === currentUser);

            if (!isAdminMode) {
                if (data.sender !== currentUser) {

                    const currentReceiver = document.getElementById("receiver").value;

                    // 🔥 if no chat open OR different chat
                    if (!currentReceiver || data.sender !== currentReceiver) {
                        unreadCounts[data.sender] = (unreadCounts[data.sender] || 0) + 1;
                    }

                    loadUsers(); // always refresh
                }

                if (isCurrentChat) {
                    appendMessage(data, false); // ✅ FIX: false = not history, show ✓ not ✓✓
                }
            }
        });

        // ✓✓ SEEN ACK
        stompClient.subscribe('/topic/seen/' + username, function (msg) {
            markMessagesAsSeen(msg.body);
        });

        // 🟢 ONLINE
        stompClient.subscribe('/topic/online', function (msg) {
            const bar = document.getElementById("onlineBar");
            if (bar) bar.innerText = "🟢 " + msg.body + " online";
            updateOnlineDot(msg.body);
        });

        // ✍️ TYPING
        stompClient.subscribe('/topic/typing/' + username, function (msg) {
            showTyping(msg.body);
        });

        // 📢 BROADCAST — subscribe to /topic/broadcast
        stompClient.subscribe('/topic/broadcast', function (msg) {
            const data = JSON.parse(msg.body);
            const currentReceiver = document.getElementById("receiver").value;

            // Show broadcast in current chat only if it's relevant
            // Always append if we are in any chat
            if (!isAdminMode && document.getElementById("chatArea").style.display !== "none") {
                appendMessage(data, false);
            }
        });

        stompClient.send("/app/online", {}, username);

    }, function (err) {
        console.error("Socket error:", err);
        setTimeout(connectSocket, 3000);
    });
}

// ============================
// 👁 SEEN
// ============================
function sendSeen(senderUsername) {
    if (!stompClient || !stompClient.connected) return;
    stompClient.send("/app/seen", {}, JSON.stringify({
        sender: localStorage.getItem("username"),
        receiver: senderUsername,
        content: ""
    }));
}

function markMessagesAsSeen(readerUsername) {

    const currentReceiver = document.getElementById("receiver").value;
    if (readerUsername !== currentReceiver) return;

    // 🔥 ONLY messages sent to THIS user
    document.querySelectorAll("li.sent").forEach(li => {

        // check this message belongs to current chat
        if (li.dataset.sender !== localStorage.getItem("username")) return;

        const status = li.querySelector(".msg-status");

        if (status && !status.classList.contains("seen")) {
            status.innerHTML = "✓✓";
            status.classList.add("seen");
        }
    });
}

// ============================
// 🟢 ONLINE DOT
// ============================
function updateOnlineDot(username) {
    document.querySelectorAll(".chat-user").forEach(el => {
        if (el.dataset.username === username) {
            const dot = el.querySelector(".status-dot");
            if (dot) dot.classList.add("online");
        }
    });
}

// ============================
// ✍️ TYPING
// ============================
let typingTimeout = null;

function showTyping(senderName) {
    const indicator = document.getElementById("typingIndicator");
    if (!indicator) return;
    indicator.innerText = senderName + " is typing...";
    indicator.style.display = "block";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => indicator.style.display = "none", 2000);
}

function onTyping() {
    const receiver = document.getElementById("receiver").value;
    const sender = localStorage.getItem("username");
    if (!receiver || !stompClient || isAdminMode) return;
    stompClient.send("/app/typing", {}, JSON.stringify({ sender, receiver, content: "" }));
}

// ============================
// 📊 ADMIN STATS
// ============================
async function loadStats() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("/api/auth/stats", {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) return;
        const data = await res.json();
        const usersEl   = document.getElementById("statUsers");
        const msgsEl    = document.getElementById("statMsgs");
        const blockedEl = document.getElementById("statBlocked");
        if (usersEl)   usersEl.innerText   = data.totalUsers   ?? "0";
        if (msgsEl)    msgsEl.innerText    = data.totalMessages ?? "0";
        if (blockedEl) blockedEl.innerText = data.blockedUsers  ?? "0";
    } catch (err) {
        console.error("Stats error:", err);
    }
}

// ============================
// 👥 LOAD USERS
// ============================
async function loadUsers() {
    const token = localStorage.getItem("token");
    const currentUser = localStorage.getItem("username");
    const isAdmin = currentRole === "ADMIN";

    try {
        let users = [];

        if (isAdmin) {
            const res = await fetch("/api/auth/allUsers", {
                headers: { "Authorization": "Bearer " + token }
            });
            if (!res.ok) {
                document.getElementById("chatList").innerHTML =
                    `<div class="no-chats">Error loading users (${res.status})</div>`;
                return;
            }
            const data = await res.json();
            users = Array.isArray(data) ? data : [];
        } else {
            const res = await fetch("/api/message/chats", {
                headers: { "Authorization": "Bearer " + token }
            });
            if (!res.ok) return;
            const data = await res.json();
            users = Array.isArray(data)
                ? data.map(u => ({ username: u, blocked: false }))
                : [];
        }

        renderUserList(users, currentUser, isAdmin);

    } catch (err) {
        console.error("loadUsers error:", err);
    }
}

function renderUserList(users, currentUser, isAdmin) {
    const list = document.getElementById("chatList");
    const currentReceiver = document.getElementById("receiver").value;
    list.innerHTML = "";

    const filtered = users.filter(u => (u.username || u) !== currentUser);

    if (filtered.length === 0) {
        list.innerHTML = `<div class="no-chats">${isAdmin ? "No users registered yet" : "No conversations yet"}</div>`;
        return;
    }

    filtered.forEach(userObj => {
        const uname   = userObj.username || userObj;
        const blocked = userObj.blocked  || false;
        const count   = unreadCounts[uname] || 0; // 🔴 unread count

        const div = document.createElement("div");
        div.className = "chat-user" + (uname === currentReceiver && !isAdminMode ? " active" : "");
        if (blocked) div.classList.add("user-blocked");
        div.dataset.username = uname;

        div.innerHTML = `
            <div class="avatar-sm ${blocked ? 'avatar-blocked' : ''}">${uname.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <span class="user-name">${uname}</span>
                ${blocked
                    ? '<span class="blocked-tag">Blocked</span>'
                    : (isAdmin ? '<span class="admin-tag">view</span>' : '')}
            </div>
            <span class="status-dot"></span>
            ${count > 0 ? `<span class="unread-badge">${count}</span>` : ""}
        `;

        div.onclick = () => openChat(uname, div);
        list.appendChild(div);
    });
}

// ============================
// 💬 OPEN CHAT
// ============================
async function openChat(user, clickedEl) {
    isAdminMode = false;

    document.getElementById("receiver").value = user;

    // 🔥 MARK AS READ (DB)
    fetch(`/api/message/read/${user}`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    document.getElementById("chatWith").innerText = user;

    const role = localStorage.getItem("role")?.toUpperCase();
    const blockBtn = document.getElementById("blockBtn");

    if (blockBtn) {
        blockBtn.style.display = (role === "ADMIN") ? "inline-block" : "none";
    }

    document.getElementById("messages").innerHTML = "";

    // ✅ reset unread
    unreadCounts[user] = 0;
    loadUsers();

    document.getElementById("chatArea").style.display   = "flex";
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("emptyState").style.display = "none";

    const currentUser = localStorage.getItem("username")?.toLowerCase();
    const inputArea   = document.querySelector(".input-area");

    // ⚠️ TEMP show (block check below override pannum)
    if (inputArea) inputArea.style.display = "flex";

    document.querySelectorAll(".chat-user").forEach(el => el.classList.remove("active"));
    if (clickedEl) clickedEl.classList.add("active");

    loadUsers();

    const avatar = document.getElementById("receiverAvatar");
    if (avatar) avatar.innerText = user.charAt(0).toUpperCase();

    // 🔥 BLOCK STATUS FETCH (IMPORTANT FIX)
    try {
        const res = await fetch(`/api/auth/status/${user}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });

        const isBlocked = await res.json();

        const btn    = document.getElementById("blockBtn");
        const status = document.getElementById("userStatus");
        const badge  = document.getElementById("blockedBadge");

        // ✅ BUTTON UPDATE
        if (btn) {
            btn.className = "block-btn " + (isBlocked ? "unblock" : "block");
            btn.innerText = isBlocked ? "✅ Unblock User" : "🚫 Block User";
        }

        // ✅ STATUS TEXT
        if (status) {
            status.className = "user-status-label " + (isBlocked ? "status-blocked" : "status-active");
            status.innerText = isBlocked ? "🚫 Blocked" : "✅ Active";
        }

        // ✅ BADGE
        if (badge) {
            badge.style.display = isBlocked ? "block" : "none";
        }

        // ✅ INPUT CONTROL (FINAL LOGIC)
        if (inputArea) {
            if (isBlocked || (currentUser !== "admin" && user.toLowerCase() === "admin")) {
                inputArea.style.display = "none";
            } else {
                inputArea.style.display = "flex";
            }
        }

    } catch (err) {
        console.error("Block status error:", err);
    }

    loadConversation(user);

    // 🔥 SEEN
    sendSeen(user);
}

// ============================
// 🔑 ADMIN: User click
// ============================
async function openAdminUserChat(user, clickedEl) {
    isAdminMode = true;

    document.querySelectorAll(".chat-user").forEach(el => el.classList.remove("active"));
    if (clickedEl) clickedEl.classList.add("active");

    document.getElementById("chatArea").style.display   = "none";
    document.getElementById("emptyState").style.display = "none";

    const adminPanel = document.getElementById("adminPanel");
    adminPanel.style.display = "flex";
    adminPanel.innerHTML = `<div class="loading-text">Loading <b>${user}</b>...</div>`;

    const token = localStorage.getItem("token");

    try {
        const [msgRes, statusRes] = await Promise.all([
            fetch("/api/message/admin/all",    { headers: { "Authorization": "Bearer " + token } }),
            fetch(`/api/auth/status/${user}`,  { headers: { "Authorization": "Bearer " + token } })
        ]);

        const data      = await msgRes.json();
        const isBlocked = await statusRes.json();

        const filtered = Array.isArray(data)
            ? data.filter(msg => msg.sender === user || msg.receiver === user)
            : [];

        const grouped = {};
        filtered.forEach(msg => {
            const partner = msg.sender === user ? msg.receiver : msg.sender;
            if (!grouped[partner]) grouped[partner] = [];
            grouped[partner].push(msg);
        });

        let convoHTML = "";
        if (filtered.length === 0) {
            convoHTML = `<div class="no-chats" style="padding:30px 0;text-align:center;">No messages yet for <b>${user}</b></div>`;
        } else {
            Object.entries(grouped).forEach(([partner, msgs]) => {
                convoHTML += `
                    <div class="admin-convo-block">
                        <div class="admin-convo-title">${user} ↔ ${partner}</div>
                        <ul class="admin-msg-list">
                            ${msgs.map(m => {
                                const time = m.timestamp
                                    ? new Date(m.timestamp).toLocaleString([], {
                                        month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    }) : "";
                                return `<li><b>${m.sender}</b>: ${escapeHtml(m.content)}<span class="admin-time">${time}</span></li>`;
                            }).join("")}
                        </ul>
                    </div>`;
            });
        }

        adminPanel.innerHTML = `
            <div class="admin-header">
                <div class="admin-header-row">
                    <div class="admin-user-info">
                        <div class="avatar-md ${isBlocked ? 'avatar-blocked' : ''}">${user.charAt(0).toUpperCase()}</div>
                        <div>
                            <h3>${user}</h3>
                            <span class="user-status-label ${isBlocked ? 'status-blocked' : 'status-active'}">
                                ${isBlocked ? '🚫 Blocked' : '✅ Active'}
                            </span>
                        </div>
                    </div>
                    <button id="blockBtn-${user}"
                        class="block-btn ${isBlocked ? 'unblock' : 'block'}"
                        onclick="toggleBlock('${user}')">
                        ${isBlocked ? '✅ Unblock User' : '🚫 Block User'}
                    </button>
                </div>
            </div>
            <div class="admin-conversations">${convoHTML}</div>
        `;

    } catch (err) {
        adminPanel.innerHTML = `<div class="loading-text">Error loading ❌</div>`;
    }
}

// ============================
// 🚫 TOGGLE BLOCK
// ============================
async function toggleBlock(username) {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById(`blockBtn-${username}`);
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const res    = await fetch(`/api/auth/block/${username}`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });
        const result     = await res.text();
        const nowBlocked = result.includes("Blocked") && !result.includes("Unblocked");

        btn.disabled  = false;
        btn.className = "block-btn " + (nowBlocked ? "unblock" : "block");
        btn.innerText = nowBlocked ? "✅ Unblock User" : "🚫 Block User";

        const statusLabel = btn.closest(".admin-header")?.querySelector(".user-status-label");
        if (statusLabel) {
            statusLabel.className = "user-status-label " + (nowBlocked ? "status-blocked" : "status-active");
            statusLabel.innerText = nowBlocked ? "🚫 Blocked" : "✅ Active";
        }

        const avatar = btn.closest(".admin-header")?.querySelector(".avatar-md");
        if (avatar) {
            nowBlocked ? avatar.classList.add("avatar-blocked") : avatar.classList.remove("avatar-blocked");
        }

        showToast(result);
        loadStats();
        loadUsers();

    } catch (err) {
        btn.disabled = false;
        showToast("Error toggling block ❌");
    }
}

// ============================
// 🔑 ADMIN: All conversations
// ============================
async function loadAllMessages() {
    isAdminMode = true;

    document.getElementById("chatArea").style.display   = "none";
    document.getElementById("emptyState").style.display = "none";
    document.querySelectorAll(".chat-user").forEach(el => el.classList.remove("active"));

    const adminPanel = document.getElementById("adminPanel");
    adminPanel.style.display = "flex";
    adminPanel.innerHTML = `<div class="loading-text">Loading all conversations...</div>`;

    const token = localStorage.getItem("token");

    try {
        const res  = await fetch("/api/message/admin/all", {
            headers: { "Authorization": "Bearer " + token }
        });
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            adminPanel.innerHTML = `<div class="loading-text">No messages in system yet.</div>`;
            return;
        }

        const grouped = {};
        data.forEach(msg => {
            const key = [msg.sender, msg.receiver].sort().join(" ↔ ");
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(msg);
        });

        let html = `
            <div class="admin-header"><h3>🔑 All Conversations</h3></div>
            <div class="admin-conversations">
        `;

        Object.entries(grouped).forEach(([pair, msgs]) => {
            html += `
                <div class="admin-convo-block">
                    <div class="admin-convo-title">${pair}</div>
                    <ul class="admin-msg-list">
                        ${msgs.map(m => {
                            const time = m.timestamp
                                ? new Date(m.timestamp).toLocaleString([], {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) : "";
                            return `<li><b>${m.sender}</b>: ${escapeHtml(m.content)}<span class="admin-time">${time}</span></li>`;
                        }).join("")}
                    </ul>
                </div>`;
        });

        html += `</div>`;
        adminPanel.innerHTML = html;

    } catch (err) {
        adminPanel.innerHTML = `<div class="loading-text">Error loading ❌</div>`;
    }
}

// ============================
// 📜 LOAD CONVERSATION
// ============================
async function loadConversation(user) {
    const token       = localStorage.getItem("token");
    const currentUser = localStorage.getItem("username");

    try {
        const res  = await fetch("/api/message/history", {
            headers: { "Authorization": "Bearer " + token }
        });
        const data = await res.json();
        const list = document.getElementById("messages");
        list.innerHTML = "";

        const filtered = data.filter(msg =>
            (msg.sender === currentUser && msg.receiver === user) ||
            (msg.sender === user && msg.receiver === currentUser)
        );

        if (filtered.length === 0) {
            list.innerHTML = `<li class="empty-chat">No messages yet. Say hi! 👋</li>`;
            return;
        }

        // ✅ History messages — only last message shows ✓✓, rest ✓✓ since they're old
        filtered.forEach(msg => appendMessage(msg));
        list.scrollTop = list.scrollHeight;

        const lastReceived = [...filtered].reverse().find(m => m.sender === user);
        if (lastReceived) sendSeen(user);

    } catch (err) {
        console.error("loadConversation error:", err);
    }
}

// ============================
// 💬 APPEND MESSAGE
// ============================
function appendMessage(msg, isHistory = false) {
    const list        = document.getElementById("messages");
    const currentUser = localStorage.getItem("username");
    const isSent      = msg.sender === currentUser;

    const li = document.createElement("li");
    li.className      = isSent ? "sent" : "received";
    li.dataset.sender = msg.sender;

    const time = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "";

    // ✅ FIX: history → ✓✓ (already delivered+seen), realtime sent → ✓ only
    const isSeen = msg.isRead === true;

    const statusHTML = isSent
        ? `<span class="msg-status ${isSeen ? 'seen' : ''}">
             ${isSeen ? '✓✓' : '✓'}
           </span>`
        : "";

    li.innerHTML = `
        <div class="bubble">
            <span class="msg-text">${escapeHtml(msg.content)}</span>
            <div class="msg-meta">
                <span class="msg-time">${time}</span>
                ${statusHTML}
            </div>
        </div>
    `;

    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ============================
// 📩 SEND MESSAGE
// ============================
async function sendMessage() {

    const content  = document.getElementById("content").value.trim();
    const receiver = document.getElementById("receiver").value;
    const sender   = localStorage.getItem("username");

    if (!receiver) { showToast("Select a user first ❗"); return; }
    if (!content) return;
    if (!stompClient || !stompClient.connected) {
        showToast("Reconnecting... ⚡");
        return;
    }

    // 🔥 ONLY SOCKET (REMOVE fetch)
    stompClient.send("/app/send", {}, JSON.stringify({
        sender,
        receiver,
        content
    }));

    document.getElementById("content").value = "";
}

// ============================
// 📢 BROADCAST (Admin → All users)
// ============================
async function sendBroadcast() {
    const content = document.getElementById("content").value.trim();
    const sender  = localStorage.getItem("username");
    const token   = localStorage.getItem("token");

    if (!content) return;

    if (sender.toLowerCase() !== "admin") {
        showToast("Only admin can broadcast ❌");
        return;
    }

    // ✅ Get all users then send to each
    try {
        const res  = await fetch("/api/auth/allUsers", {
            headers: { "Authorization": "Bearer " + token }
        });
        const users = await res.json();

        if (!Array.isArray(users) || users.length === 0) {
            showToast("No users to broadcast ❌");
            return;
        }

        // Send to each user individually via WebSocket + DB
        for (const userObj of users) {
            const receiver = userObj.username || userObj;
            if (receiver === sender) continue;

            // Real-time
            stompClient.send("/app/send", {}, JSON.stringify({ sender, receiver, content }));
        }

        document.getElementById("content").value = "";
        showToast("📢 Broadcast sent to all users ✅");

        // Show in current chat if someone is selected
        const currentReceiver = document.getElementById("receiver").value;
        if (currentReceiver) {
            appendMessage({
                sender,
                receiver: currentReceiver,
                content,
                timestamp: new Date().toISOString()
            }, false);
        }

    } catch (err) {
        showToast("Broadcast failed ❌");
    }
}

function handleEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ============================
// 🔐 LOGIN
// ============================
async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) { showToast("Fill all fields ❗"); return; }

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerText = "Logging in...";

    try {
        const res      = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const response = await res.text();

        if (response === "BLOCKED") {
            showBlockedWarning();
            btn.disabled = false;
            btn.innerText = "Login";
            return;
        }

        if (response === "Invalid Credentials") {
            showToast("Wrong username or password ❌");
            btn.disabled = false;
            btn.innerText = "Login";
            return;
        }

        const parts = response.split(":");
        localStorage.setItem("role",     parts[0]);
        localStorage.setItem("token",    parts[1]);
        localStorage.setItem("username", username);
        window.location.href = "dashboard.html";

    } catch (err) {
        showToast("Server error, try again");
        btn.disabled = false;
        btn.innerText = "Login";
    }
}

function showBlockedWarning() {
    let warning = document.getElementById("blockedWarning");
    if (!warning) {
        warning = document.createElement("div");
        warning.id = "blockedWarning";
        warning.className = "blocked-warning";
        warning.innerHTML = `
            <div class="blocked-warning-icon">🚫</div>
            <div>
                <div class="blocked-warning-title">Account Blocked</div>
                <div class="blocked-warning-sub">Your account has been suspended by the administrator. Contact support for help.</div>
            </div>
        `;
        const card = document.querySelector(".glass");
        if (card) card.insertBefore(warning, card.querySelector("button"));
    }
    warning.style.display = "flex";
    warning.classList.add("shake");
    setTimeout(() => warning.classList.remove("shake"), 600);
}

// ============================
// 📝 REGISTER
// ============================
async function register() {
    const username        = document.getElementById("username").value.trim();
    const password        = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const fullname        = document.getElementById("fullname")?.value.trim() || "";
    const email           = document.getElementById("email")?.value.trim()    || "";

    if (!username || !password)       { showToast("Fill all fields ❗"); return; }
    if (password !== confirmPassword) { showToast("Passwords don't match ❗"); return; }

    const btn = document.getElementById("registerBtn");
    if (btn) { btn.disabled = true; btn.innerText = "Registering..."; }

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, fullname, email })
        });

        const text = await res.text();

        if (text.includes("exists") || text.includes("already")) {
            showToast("Username already exists ❌");
            if (btn) { btn.disabled = false; btn.innerText = "Register"; }
            return;
        }

        if (res.ok) {
            showToast("Registered! Redirecting... ✅");
            setTimeout(() => window.location.href = "login.html", 1500);
        } else {
            showToast(text || "Registration failed ❌");
            if (btn) { btn.disabled = false; btn.innerText = "Register"; }
        }
    } catch (err) {
        showToast("Server error ❌");
        if (btn) { btn.disabled = false; btn.innerText = "Register"; }
    }
}

// ============================
// 🚪 LOGOUT
// ============================
function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

// ============================
// 🔔 TOAST
// ============================
function showToast(msg) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ============================
// 🚀 PAGE LOAD
// ============================
window.onload = function () {
    const path = window.location.pathname;
    if (!path.includes("dashboard.html")) return;

    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    const role  = localStorage.getItem("role");
    currentRole = role ? role.toUpperCase() : "USER";

    // ✅ DEFINE HERE (IMPORTANT)
    const isAdmin = currentRole === "ADMIN";

    const adminBtn  = document.getElementById("adminBtn");
    const statsBar  = document.getElementById("statsBar");
    const listLabel = document.getElementById("listLabel");

    // 🔥 HIDE BROADCAST BUTTON
    const broadcastBtn = document.getElementById("broadcastBtn");
    if (!isAdmin) {
        if (broadcastBtn) broadcastBtn.style.display = "none";
    }

    if (isAdmin) {
        if (adminBtn)  adminBtn.style.display  = "inline-flex";
        if (statsBar)  statsBar.style.display  = "flex";
        if (listLabel) listLabel.innerText     = "All Users";
        loadStats();
    } else {
        if (adminBtn)  adminBtn.style.display = "none";
        if (statsBar)  statsBar.style.display = "none";
        if (listLabel) listLabel.innerText    = "Messages";
    }

    const username   = localStorage.getItem("username");
    const userLabel  = document.getElementById("currentUser");
    const selfAvatar = document.getElementById("selfAvatar");
    if (userLabel)  userLabel.innerText  = username;
    if (selfAvatar) selfAvatar.innerText = username.charAt(0).toUpperCase();

    connectSocket();
    loadUsers();
    loadUnreadCounts();
};

async function toggleBlockCurrentUser() {

    const username = document.getElementById("receiver").value;
    const token = localStorage.getItem("token");

    if (!username) return;

    const btn = document.getElementById("blockBtn");
    const badge = document.getElementById("blockedBadge");
    const status = document.getElementById("userStatus");

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const res = await fetch(`/api/auth/block/${username}`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const result = await res.text();

        const nowBlocked = result.includes("Blocked") && !result.includes("Unblocked");

        // ✅ BUTTON
        btn.disabled = false;
        btn.className = "block-btn " + (nowBlocked ? "unblock" : "block");
        btn.innerText = nowBlocked ? "✅ Unblock User" : "🚫 Block User";

        // ✅ STATUS TEXT
        if (status) {
            status.className = "user-status-label " + (nowBlocked ? "status-blocked" : "status-active");
            status.innerText = nowBlocked ? "🚫 Blocked" : "✅ Active";
        }

        // ✅ BADGE
        if (badge) {
            badge.style.display = nowBlocked ? "block" : "none";
        }

        // ✅ INPUT HIDE
        const inputArea = document.querySelector(".input-area");
        if (inputArea) {
            inputArea.style.display = nowBlocked ? "none" : "flex";
        }

        showToast(result);
        loadUsers();

    } catch (err) {
        btn.disabled = false;
        showToast("Error ❌");
    }
}

async function loadUnreadCounts() {

    const token = localStorage.getItem("token");

    try {
        const res = await fetch("/api/message/unread", {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (!res.ok) return;

        const data = await res.json();

        console.log("UNREAD FROM DB:", data); // 🔥 debug

        unreadCounts = data;

        loadUsers(); // 🔥 refresh UI

    } catch (err) {
        console.error("Unread error:", err);
    }
}
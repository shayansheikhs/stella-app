// Shared inbox — admin aur user dono yahan se baat karte hain
(function () {
  const INBOX_KEY = 'ai_connect_inbox_v1';
  let firestore = null;
  let pollTimer = null;

  function cfg() { return window.APP_CONFIG || {}; }

  function useCloud() {
    return typeof AuthService !== 'undefined' && AuthService.isFirebaseReady();
  }

  function getFirestore() {
    if (!useCloud() || typeof firebase === 'undefined') return null;
    try {
      return firebase.app().firestore();
    } catch {
      return null;
    }
  }

  function convoId(user) {
    return (user.email || user.uid || 'unknown').toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  }

  function readLocalInbox() {
    try {
      return JSON.parse(localStorage.getItem(INBOX_KEY) || '{"conversations":{}}');
    } catch {
      return { conversations: {} };
    }
  }

  function writeLocalInbox(data) {
    localStorage.setItem(INBOX_KEY, JSON.stringify(data));
  }

  function ensureLocalConvo(user) {
    const inbox = readLocalInbox();
    const id = convoId(user);
    if (!inbox.conversations[id]) {
      inbox.conversations[id] = {
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        adminLive: false,
        messages: [],
        unreadAdmin: 0,
        unreadUser: 0,
        lastUpdate: Date.now()
      };
      writeLocalInbox(inbox);
    }
    return inbox.conversations[id];
  }

  async function getConvo(user) {
    const fs = getFirestore();
    const id = convoId(user);
    if (fs) {
      const doc = await fs.collection('conversations').doc(id).get();
      if (doc.exists) return { id, ...doc.data() };
      const data = {
        userId: user.uid,
        userName: user.name,
        userEmail: user.email,
        adminLive: false,
        messages: [],
        unreadAdmin: 0,
        unreadUser: 0,
        lastUpdate: Date.now()
      };
      await fs.collection('conversations').doc(id).set(data);
      return { id, ...data };
    }
    ensureLocalConvo(user);
    return { id, ...readLocalInbox().conversations[id] };
  }

  async function saveConvo(id, data) {
    const fs = getFirestore();
    data.lastUpdate = Date.now();
    if (fs) {
      await fs.collection('conversations').doc(id).set(data, { merge: true });
      return;
    }
    const inbox = readLocalInbox();
    inbox.conversations[id] = data;
    writeLocalInbox(inbox);
  }

  async function addMessage(user, from, text) {
    const id = convoId(user);
    const convo = await getConvo(user);
    const msg = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      from,
      text,
      ts: Date.now()
    };
    convo.messages = convo.messages || [];
    convo.messages.push(msg);
    if (from === 'user') convo.unreadAdmin = (convo.unreadAdmin || 0) + 1;
    if (from === 'admin') convo.unreadUser = (convo.unreadUser || 0) + 1;
    convo.userName = user.name;
    convo.userEmail = user.email;
    await saveConvo(id, convo);
    return msg;
  }

  async function setAdminLive(user, live) {
    const id = convoId(user);
    const convo = await getConvo(user);
    convo.adminLive = !!live;
    await saveConvo(id, convo);
    return convo;
  }

  async function clearUnreadForAdmin(user) {
    const id = convoId(user);
    const convo = await getConvo(user);
    convo.unreadAdmin = 0;
    await saveConvo(id, convo);
  }

  async function clearUnreadForUser(user) {
    const id = convoId(user);
    const convo = await getConvo(user);
    convo.unreadUser = 0;
    await saveConvo(id, convo);
  }

  async function listConversations() {
    const fs = getFirestore();
    if (fs) {
      const snap = await fs.collection('conversations').orderBy('lastUpdate', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const inbox = readLocalInbox();
    return Object.entries(inbox.conversations).map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0));
  }

  /** Admin ke liye — registered + jo message bhej chuke */
  async function listUsersForAdmin() {
    const registered = typeof AuthService !== 'undefined'
      ? await AuthService.listAllUsers()
      : [];
    const convos = await listConversations();
    const map = new Map();

    registered
      .filter(u => (u.role || 'user') !== 'admin')
      .forEach(u => {
        map.set((u.email || '').toLowerCase(), {
          uid: u.uid,
          name: u.name,
          email: u.email,
          role: u.role || 'user',
          messageCount: u.messageCount || 0,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt
        });
      });

    convos.forEach(c => {
      const email = (c.userEmail || '').toLowerCase();
      if (!email || email.includes('admin@')) return;
      const existing = map.get(email) || {};
      map.set(email, {
        uid: c.userId || existing.uid || email,
        name: c.userName || existing.name || 'User',
        email: c.userEmail || email,
        role: 'user',
        messageCount: Math.max(existing.messageCount || 0, (c.messages || []).filter(m => m.from === 'user').length),
        lastLogin: c.lastUpdate || existing.lastLogin,
        createdAt: existing.createdAt || c.lastUpdate,
        unreadAdmin: c.unreadAdmin || 0,
        lastMessage: (c.messages || []).slice(-1)[0]
      });
    });

    return Array.from(map.values()).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
  }

  function startPolling(user, onUpdate, intervalMs = 2000) {
    stopPolling();
    let lastCount = -1;
    let lastLive = null;

    async function tick() {
      try {
        const convo = await getConvo(user);
        const count = (convo.messages || []).length;
        const live = !!convo.adminLive;
        if (count !== lastCount || live !== lastLive) {
          lastCount = count;
          lastLive = live;
          onUpdate(convo);
        }
      } catch (_) {}
    }

    tick();
    pollTimer = setInterval(tick, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  window.ChatService = {
    convoId,
    getConvo,
    addMessage,
    setAdminLive,
    clearUnreadForAdmin,
    clearUnreadForUser,
    listConversations,
    listUsersForAdmin,
    startPolling,
    stopPolling,
    useCloud
  };
})();

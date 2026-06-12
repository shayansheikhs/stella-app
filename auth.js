// Shared auth — Firebase (live) ya localStorage (testing)
(function () {
  const USERS_KEY = 'ai_connect_users';
  const SESSION_KEY = 'ai_connect_session';
  const cfg = () => window.APP_CONFIG || {};

  let firebaseApp = null;
  let firebaseAuth = null;
  let firestore = null;

  async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function isFirebaseReady() {
    const f = cfg().firebase || {};
    return f.enabled && f.apiKey && f.projectId && typeof firebase !== 'undefined';
  }

  function useSupabase() {
    return typeof SupabaseSync !== 'undefined' && SupabaseSync.isReady();
  }

  async function initSupabase() {
    if (typeof SupabaseSync === 'undefined') return false;
    return SupabaseSync.init();
  }

  async function initFirebase() {
    const f = cfg().firebase;
    if (!f?.enabled || !f.apiKey) return false;
    if (firebaseApp) return true;

    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK load nahi hui');
      return false;
    }

    try {
      if (firebase.apps && firebase.apps.length) {
        firebaseApp = firebase.app();
      } else {
        firebaseApp = firebase.initializeApp(f);
      }
    } catch (e) {
      if (e?.code === 'app/duplicate-app') {
        firebaseApp = firebase.app();
      } else {
        console.warn('Firebase init error:', e);
        return false;
      }
    }
    firebaseAuth = firebase.auth();
    firestore = firebase.firestore();
    return true;
  }

  function getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocalUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async function ensureDefaultAdmin() {
    const email = (cfg().defaultAdminEmail || 'admin@aiconnect.com').toLowerCase();
    const password = cfg().defaultAdminPassword || cfg().localAdminPassword || 'StellaAdmin2026';
    const users = getLocalUsers();
    const passwordHash = await hashPassword(password);

    if (!users.some(u => u.email === email)) {
      users.push({
        uid: 'admin_default',
        name: 'Admin',
        email,
        passwordHash,
        role: 'admin',
        createdAt: Date.now(),
        lastLogin: Date.now(),
        messageCount: 0
      });
      saveLocalUsers(users);
    }

    if (useSupabase()) {
      await SupabaseSync.upsertUser({
        uid: 'admin_default',
        name: 'Admin',
        email,
        passwordHash,
        role: 'admin',
        createdAt: Date.now(),
        lastLogin: Date.now(),
        messageCount: 0
      });
    }
  }

  async function initApp() {
    await initSupabase();
    await ensureDefaultAdmin();
    return initFirebase();
  }

  function getLocalSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveLocalSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearLocalSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getFirestore() {
    return firestore;
  }

  function isAdminEmail(email) {
    const list = (cfg().adminEmails || []).map(e => e.toLowerCase());
    return list.includes((email || '').toLowerCase());
  }

  async function upsertFirestoreUser(user, extra = {}) {
    if (!firestore || !user?.uid) return;
    await firestore.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: user.name || user.displayName || 'User',
      email: (user.email || '').toLowerCase(),
      role: isAdminEmail(user.email) ? 'admin' : 'user',
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra
    }, { merge: true });
  }

  async function localSignUp(name, email, password) {
    const normalized = email.trim().toLowerCase();
    const users = getLocalUsers();
    if (users.some(u => u.email === normalized)) {
      throw new Error('Yeh email pehle se registered hai. Login karein.');
    }
    const passwordHash = await hashPassword(password);
    const user = {
      uid: 'local_' + Date.now(),
      name: name.trim(),
      email: normalized,
      passwordHash,
      role: isAdminEmail(normalized) ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
      messageCount: 0
    };
    users.push(user);
    saveLocalUsers(users);
    saveLocalSession({ uid: user.uid, name: user.name, email: user.email, role: user.role });
    return { uid: user.uid, name: user.name, email: user.email, role: user.role };
  }

  async function createGuest(name) {
    const guestName = (name || cfg().defaultGuestName || 'Guest').trim() || 'Guest';
    const uid = 'guest_' + Date.now();
    const email = uid + '@local.guest';
    const user = {
      uid,
      name: guestName,
      email,
      passwordHash: '',
      role: 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
      messageCount: 0,
      isGuest: true
    };
    const users = getLocalUsers();
    users.push(user);
    saveLocalUsers(users);
    const session = { uid, name: guestName, email, role: 'user', isGuest: true };
    saveLocalSession(session);

    syncGuestToFirestore(session).catch(() => {});

    return session;
  }

  async function syncGuestToFirestore(session) {
    if (!(await initFirebase()) || !firestore) return;
    await Promise.race([
      firestore.collection('users').doc(session.uid).set({
        uid: session.uid,
        name: session.name,
        email: session.email,
        role: 'user',
        messageCount: 0,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        isGuest: true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ]);
  }

  async function localSignIn(email, password) {
    const normalized = email.trim().toLowerCase();
    const users = getLocalUsers();
    const user = users.find(u => u.email === normalized);
    if (!user) throw new Error('Account nahi mila. Pehle naya account banayein.');
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) throw new Error('Galat password.');

    user.lastLogin = Date.now();
    saveLocalUsers(users);
    const session = { uid: user.uid, name: user.name, email: user.email, role: user.role || 'user' };
    saveLocalSession(session);
    return session;
  }

  async function cloudSignUp(name, email, password) {
    const normalized = email.trim().toLowerCase();
    const existing = await SupabaseSync.findUserByEmail(normalized);
    if (existing) throw new Error('Yeh email pehle se registered hai. Login karein.');

    const passwordHash = await hashPassword(password);
    const user = {
      uid: 'sb_' + Date.now(),
      name: name.trim(),
      email: normalized,
      passwordHash,
      role: isAdminEmail(normalized) ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
      messageCount: 0
    };
    await SupabaseSync.upsertUser(user);
    saveLocalSession({ uid: user.uid, name: user.name, email: user.email, role: user.role });
    return { uid: user.uid, name: user.name, email: user.email, role: user.role };
  }

  async function cloudSignIn(email, password) {
    const normalized = email.trim().toLowerCase();
    const found = await SupabaseSync.findUserByEmail(normalized);
    if (!found) throw new Error('Account nahi mila. Pehle naya account banayein.');
    const passwordHash = await hashPassword(password);
    if (passwordHash !== found.password_hash) throw new Error('Galat password.');

    const session = {
      uid: found.id,
      name: found.name,
      email: found.email,
      role: found.role || 'user'
    };
    await SupabaseSync.upsertUser({
      ...session,
      passwordHash: found.password_hash,
      lastLogin: Date.now(),
      messageCount: found.message_count || 0,
      createdAt: found.created_at
    });
    saveLocalSession(session);
    return session;
  }

  async function signUp(name, email, password) {
    if (password.length < 6) throw new Error('Password kam az kam 6 letters ka ho.');

    if (await initSupabase() && useSupabase()) {
      return cloudSignUp(name, email, password);
    }

    if (await initFirebase() && isFirebaseReady()) {
      const cred = await firebaseAuth.createUserWithEmailAndPassword(email.trim(), password);
      await cred.user.updateProfile({ displayName: name.trim() });
      await upsertFirestoreUser(cred.user, {
        name: name.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        messageCount: 0
      });
      return {
        uid: cred.user.uid,
        name: name.trim(),
        email: cred.user.email.toLowerCase(),
        role: isAdminEmail(cred.user.email) ? 'admin' : 'user'
      };
    }

    return localSignUp(name, email, password);
  }

  async function signIn(email, password) {
    if (await initSupabase() && useSupabase()) {
      return cloudSignIn(email, password);
    }

    if (await initFirebase() && isFirebaseReady()) {
      const cred = await firebaseAuth.signInWithEmailAndPassword(email.trim(), password);
      await upsertFirestoreUser(cred.user, { name: cred.user.displayName || 'User' });
      return {
        uid: cred.user.uid,
        name: cred.user.displayName || 'User',
        email: cred.user.email.toLowerCase(),
        role: isAdminEmail(cred.user.email) ? 'admin' : 'user'
      };
    }
    return localSignIn(email, password);
  }

  async function signOut() {
    if (firebaseAuth) {
      try { await firebaseAuth.signOut(); } catch (_) {}
    }
    clearLocalSession();
  }

  async function getCurrentUser() {
    if (await initFirebase() && isFirebaseReady() && firebaseAuth.currentUser) {
      const u = firebaseAuth.currentUser;
      return {
        uid: u.uid,
        name: u.displayName || 'User',
        email: u.email.toLowerCase(),
        role: isAdminEmail(u.email) ? 'admin' : 'user'
      };
    }
    return getLocalSession();
  }

  async function waitForAuth() {
    if (!(await initFirebase()) || !isFirebaseReady()) {
      return getLocalSession();
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      const unsub = firebaseAuth.onAuthStateChanged((user) => {
        unsub();
        if (!user) return done(null);
        done({
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email.toLowerCase(),
          role: isAdminEmail(user.email) ? 'admin' : 'user'
        });
      });
      setTimeout(() => {
        try { unsub(); } catch (_) {}
        done(getLocalSession());
      }, 4000);
    });
  }

  async function adminLocalLogin(email, password) {
    const normalized = email.trim().toLowerCase();
    const defaultEmail = (cfg().defaultAdminEmail || 'admin@aiconnect.com').toLowerCase();
    const defaultPass = cfg().defaultAdminPassword || cfg().localAdminPassword || 'StellaAdmin2026';

    if (normalized === defaultEmail && password === defaultPass) {
      await ensureDefaultAdmin();
    }

    const session = await localSignIn(email, password);
    if (session.role !== 'admin' && !isAdminEmail(session.email)) {
      await signOut();
      throw new Error('Admin access nahi hai.');
    }
    return session;
  }

  async function adminPasswordLogin(password) {
    if (password !== (cfg().localAdminPassword || '')) {
      throw new Error('Galat admin password.');
    }
    const session = { uid: 'admin_local', name: 'Admin', email: 'admin@local', role: 'admin' };
    saveLocalSession(session);
    return session;
  }

  async function listAllUsers() {
    if (useSupabase()) {
      return SupabaseSync.listUsers().map(u => ({
        id: u.uid,
        uid: u.uid,
        name: u.name,
        email: u.email,
        role: u.role || 'user',
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        messageCount: u.messageCount || 0
      }));
    }
    if (firestore && isFirebaseReady()) {
      try {
        const snap = await firestore.collection('users').orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
      } catch (_) {
        const snap = await firestore.collection('users').get();
        return snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
      }
    }
    return getLocalUsers().map(u => ({
      id: u.uid,
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      messageCount: u.messageCount || 0
    }));
  }

  async function incrementMessageCount(user) {
    if (!user?.uid) return;
    if (useSupabase() && user.email) {
      await SupabaseSync.incrementUserMessages(user.email);
      return;
    }
    if (firestore && isFirebaseReady() && !user.uid.startsWith('local_')) {
      await firestore.collection('users').doc(user.uid).set({
        messageCount: firebase.firestore.FieldValue.increment(1),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }
    const users = getLocalUsers();
    const found = users.find(u => u.uid === user.uid || u.email === user.email);
    if (found) {
      found.messageCount = (found.messageCount || 0) + 1;
      found.lastLogin = Date.now();
      saveLocalUsers(users);
    }
  }

  function historyKey(user) {
    return 'ai_connect_history_' + (user.email || user.uid);
  }

  function usesCloud() {
    return useSupabase() || isFirebaseReady();
  }

  window.AuthService = {
    initFirebase,
    initApp,
    isFirebaseReady,
    getFirestore,
    signUp,
    signIn,
    createGuest,
    signOut,
    getCurrentUser,
    waitForAuth,
    adminLocalLogin,
    adminPasswordLogin,
    listAllUsers,
    incrementMessageCount,
    historyKey,
    usesCloud,
    isAdminEmail
  };
})();

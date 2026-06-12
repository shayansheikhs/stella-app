// Firebase Firestore — chat + conversations sync
(function () {
  const TIMEOUT_MS = 5000;

  function db() {
    return typeof AuthService !== 'undefined' ? AuthService.getFirestore() : null;
  }

  function isReady() {
    return typeof AuthService !== 'undefined' && AuthService.isFirebaseReady() && !!db();
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  function fromDoc(id, data) {
    if (!data) return null;
    return {
      id,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      adminLive: !!data.adminLive,
      messages: data.messages || [],
      unreadAdmin: data.unreadAdmin || 0,
      unreadUser: data.unreadUser || 0,
      lastUpdate: data.lastUpdate || 0
    };
  }

  async function getConvo(id) {
    if (!isReady()) return null;
    try {
      const snap = await withTimeout(db().collection('conversations').doc(id).get(), TIMEOUT_MS);
      if (!snap.exists) return null;
      return fromDoc(id, snap.data());
    } catch (_) {
      return null;
    }
  }

  async function saveConvo(id, convo) {
    if (!isReady()) return;
    try {
      await withTimeout(db().collection('conversations').doc(id).set({
        userId: convo.userId,
        userName: convo.userName,
        userEmail: convo.userEmail,
        adminLive: !!convo.adminLive,
        messages: convo.messages || [],
        unreadAdmin: convo.unreadAdmin || 0,
        unreadUser: convo.unreadUser || 0,
        lastUpdate: Date.now()
      }, { merge: true }), TIMEOUT_MS);
    } catch (_) {}
  }

  async function listConvos() {
    if (!isReady()) return [];
    try {
      const snap = await withTimeout(
        db().collection('conversations').orderBy('lastUpdate', 'desc').limit(100).get(),
        TIMEOUT_MS
      );
      return snap.docs.map(d => fromDoc(d.id, d.data()));
    } catch (_) {
      try {
        const snap = await withTimeout(db().collection('conversations').limit(100).get(), TIMEOUT_MS);
        return snap.docs.map(d => fromDoc(d.id, d.data()));
      } catch (_) {
        return [];
      }
    }
  }

  function subscribeConvo(id, onUpdate) {
    if (!isReady()) return () => {};
    return db().collection('conversations').doc(id).onSnapshot((doc) => {
      if (doc.exists) onUpdate(fromDoc(id, doc.data()));
    });
  }

  window.FirebaseSync = {
    isReady,
    getConvo,
    saveConvo,
    listConvos,
    subscribeConvo
  };
})();

// Firebase Firestore — chat + conversations sync
(function () {
  function db() {
    return typeof AuthService !== 'undefined' ? AuthService.getFirestore() : null;
  }

  function isReady() {
    return typeof AuthService !== 'undefined' && AuthService.isFirebaseReady() && !!db();
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
    const snap = await db().collection('conversations').doc(id).get();
    if (!snap.exists) return null;
    return fromDoc(id, snap.data());
  }

  async function saveConvo(id, convo) {
    if (!isReady()) return;
    await db().collection('conversations').doc(id).set({
      userId: convo.userId,
      userName: convo.userName,
      userEmail: convo.userEmail,
      adminLive: !!convo.adminLive,
      messages: convo.messages || [],
      unreadAdmin: convo.unreadAdmin || 0,
      unreadUser: convo.unreadUser || 0,
      lastUpdate: Date.now()
    }, { merge: true });
  }

  async function listConvos() {
    if (!isReady()) return [];
    try {
      const snap = await db().collection('conversations')
        .orderBy('lastUpdate', 'desc')
        .limit(100)
        .get();
      return snap.docs.map(d => fromDoc(d.id, d.data()));
    } catch (_) {
      const snap = await db().collection('conversations').limit(100).get();
      return snap.docs.map(d => fromDoc(d.id, d.data()));
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

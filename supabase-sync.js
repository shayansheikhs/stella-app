// Supabase cloud sync — Firebase ki jagah (free)
(function () {
  let client = null;

  function cfg() {
    return window.APP_CONFIG?.supabase || {};
  }

  function isReady() {
    const c = cfg();
    return !!(c.enabled && c.url && c.anonKey && client);
  }

  async function init() {
    const c = cfg();
    if (!c.enabled || !c.url || !c.anonKey) return false;
    if (client) return true;
    if (typeof supabase === 'undefined') {
      console.warn('Supabase SDK load nahi hui');
      return false;
    }
    client = supabase.createClient(c.url, c.anonKey);
    return true;
  }

  async function upsertUser(user) {
    if (!isReady()) return;
    await client.from('app_users').upsert({
      id: user.uid || user.email,
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash || user.password_hash || '',
      role: user.role || 'user',
      message_count: user.messageCount || user.message_count || 0,
      last_login: user.lastLogin || Date.now(),
      created_at: user.createdAt || Date.now()
    });
  }

  async function findUserByEmail(email) {
    if (!isReady()) return null;
    const { data } = await client.from('app_users').select('*').eq('email', email.toLowerCase()).maybeSingle();
    return data;
  }

  async function listUsers() {
    if (!isReady()) return [];
    const { data } = await client.from('app_users').select('*').order('created_at', { ascending: false });
    return (data || []).map(u => ({
      uid: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      messageCount: u.message_count,
      lastLogin: u.last_login,
      createdAt: u.created_at,
      passwordHash: u.password_hash
    }));
  }

  async function incrementUserMessages(email) {
    if (!isReady()) return;
    const u = await findUserByEmail(email);
    if (!u) return;
    await client.from('app_users').update({
      message_count: (u.message_count || 0) + 1,
      last_login: Date.now()
    }).eq('email', email.toLowerCase());
  }

  async function getConvo(id) {
    if (!isReady()) return null;
    const { data } = await client.from('conversations').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      userName: data.user_name,
      userEmail: data.user_email,
      adminLive: data.admin_live,
      messages: data.messages || [],
      unreadAdmin: data.unread_admin,
      unreadUser: data.unread_user,
      lastUpdate: data.last_update
    };
  }

  async function saveConvo(id, convo) {
    if (!isReady()) return;
    await client.from('conversations').upsert({
      id,
      user_id: convo.userId,
      user_name: convo.userName,
      user_email: convo.userEmail,
      admin_live: !!convo.adminLive,
      messages: convo.messages || [],
      unread_admin: convo.unreadAdmin || 0,
      unread_user: convo.unreadUser || 0,
      last_update: Date.now()
    });
  }

  async function listConvos() {
    if (!isReady()) return [];
    const { data } = await client.from('conversations').select('*').order('last_update', { ascending: false });
    return (data || []).map(d => ({
      id: d.id,
      userId: d.user_id,
      userName: d.user_name,
      userEmail: d.user_email,
      adminLive: d.admin_live,
      messages: d.messages || [],
      unreadAdmin: d.unread_admin,
      unreadUser: d.unread_user,
      lastUpdate: d.last_update
    }));
  }

  function subscribeConvo(id, onUpdate) {
    if (!isReady()) return () => {};
    const channel = client
      .channel('convo-' + id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: 'id=eq.' + id
      }, async () => {
        const c = await getConvo(id);
        if (c) onUpdate(c);
      })
      .subscribe();
    return () => client.removeChannel(channel);
  }

  window.SupabaseSync = {
    init,
    isReady,
    upsertUser,
    findUserByEmail,
    listUsers,
    incrementUserMessages,
    getConvo,
    saveConvo,
    listConvos,
    subscribeConvo
  };
})();

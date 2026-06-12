// ── AI Connect Settings ──
// Firebase on karne ke liye enabled: true karein aur neeche keys bharein
window.APP_CONFIG = {
  brandName: 'AI Connect',
  ownerName: 'Shayan',
  tagline: 'Apna naam likhein, chat shuru karein',

  // Seedha chat — bina account ke (Firebase par save hoga)
  guestMode: true,
  autoGuest: false,
  defaultGuestName: 'Guest',

  // Deploy par auto-lagti hai (GitHub secret se)
  groqApiKey: '__GROQ_API_KEY__',

  // Admin emails — in logins se admin dashboard khulega
  adminEmails: [
    'admin@aiconnect.com',
    'shayan@aiconnect.com'
  ],

  // Default admin login (pehle se banaya hua)
  defaultAdminEmail: 'admin@aiconnect.com',
  defaultAdminPassword: 'StellaAdmin2026',

  // Jab Firebase off ho — local admin password (sirf password se bhi login)
  localAdminPassword: 'StellaAdmin2026',

  firebase: {
    enabled: true,
    apiKey: 'AIzaSyDakoUDw3uHevvGbWM6tTHAI3Y4BFl8fsk',
    authDomain: 'stella-chat-6e272.firebaseapp.com',
    databaseURL: 'https://stella-chat-6e272-default-rtdb.firebaseio.com',
    projectId: 'stella-chat-6e272',
    storageBucket: 'stella-chat-6e272.firebasestorage.app',
    messagingSenderId: '968394329918',
    appId: '1:968394329918:web:20afb422a62c96d736a66f'
  },

  // ☁️ LIVE SYNC — user phone + admin laptop (Firebase ki jagah)
  supabase: {
    enabled: false,
    url: '',        // https://xxxxx.supabase.co
    anonKey: ''     // anon public key
  }
};

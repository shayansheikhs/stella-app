// ── AI Connect Settings ──
// Firebase on karne ke liye enabled: true karein aur neeche keys bharein
window.APP_CONFIG = {
  brandName: 'AI Connect',
  ownerName: 'Shayan',
  tagline: 'Login karein, seedhi baat shuru karein',

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
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};

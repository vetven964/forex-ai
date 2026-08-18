// V-TRADE AI — startup logic hotfix
// Runs before server-launcher so the production source receives deterministic
// data-integrity and account-registration fixes without changing the broker/MT5 contract.
const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.resolve(__dirname, 'server.js');
const LOGIN_FILE = path.resolve(__dirname, 'login.html');
const REGISTER_FILE = path.resolve(__dirname, 'register.html');

function normalizeTimestampMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  // MT5 payloads may arrive as Unix seconds or Unix milliseconds.
  return n < 1e12 ? n * 1000 : n;
}

function patchServer(source) {
  const old = "const candleAgeSec=m5.length?Math.max(0,(Date.now()-m5[m5.length-1].t)/1000):Infinity,candlesFresh=candleAgeSec<=15*60;";
  const replacement = `const closedCandleMaxAgeSec=Math.max(60,Number(process.env.CLOSED_CANDLE_MAX_AGE_SEC||900));
  const latestClosedM5Ms=m5.length?normalizeTimestampMs(m5[m5.length-1]?.t):NaN;
  const latestClosedM15Ms=m15.length?normalizeTimestampMs(m15[m15.length-1]?.t):NaN;
  const latestClosedH1Ms=h1.length?normalizeTimestampMs(h1[h1.length-1]?.t):NaN;
  const latestClosedH4Ms=h4.length?normalizeTimestampMs(h4[h4.length-1]?.t):NaN;
  const candleAgeSec=Number.isFinite(latestClosedM5Ms)?Math.max(0,(Date.now()-latestClosedM5Ms)/1000):Infinity;
  const closedAgeByTf={
    M5:Number.isFinite(latestClosedM5Ms)?Math.max(0,(Date.now()-latestClosedM5Ms)/1000):Infinity,
    M15:Number.isFinite(latestClosedM15Ms)?Math.max(0,(Date.now()-latestClosedM15Ms)/1000):Infinity,
    H1:Number.isFinite(latestClosedH1Ms)?Math.max(0,(Date.now()-latestClosedH1Ms)/1000):Infinity,
    H4:Number.isFinite(latestClosedH4Ms)?Math.max(0,(Date.now()-latestClosedH4Ms)/1000):Infinity
  };
  const candlesFresh=closedAgeByTf.M5<=Math.min(closedCandleMaxAgeSec,600)
    &&closedAgeByTf.M15<=Math.min(closedCandleMaxAgeSec*2,1800)
    &&closedAgeByTf.H1<=Math.min(closedCandleMaxAgeSec*8,7200)
    &&closedAgeByTf.H4<=Math.min(closedCandleMaxAgeSec*32,28800);`;

  if (source.includes(old)) {
    source = source.replace(old, replacement);
  } else if (!source.includes('closedAgeByTf')) {
    console.warn('[V-TRADE HOTFIX] closed-candle expression not found; no freshness patch applied');
  }

  if (!source.includes('function normalizeTimestampMs')) {
    const marker = "const HOST = '0.0.0.0';";
    const helper = `${marker}\n\nfunction normalizeTimestampMs(value) {\n  const n=Number(value);\n  if(!Number.isFinite(n)||n<=0)return NaN;\n  return n<1e12?n*1000:n;\n}`;
    source = source.replace(marker, helper);
  }

  // Never let a neutral timeframe carry an extreme directional score.
  source = source.replace(
    /const directionBand=directionScore>=80\?'BULLISH':directionScore>=60\?'BULLISH_BIAS':directionScore>=40\?'NEUTRAL':directionScore>=20\?'BEARISH_BIAS':'BEARISH';/g,
    "if(side==='NEUTRAL') directionScore=50;\n  const directionBand=directionScore>=80?'BULLISH':directionScore>=60?'BULLISH_BIAS':directionScore>=40?'NEUTRAL':directionScore>=20?'BEARISH_BIAS':'BEARISH';"
  );

  // Persistent member accounts. Registration is never allowed to claim success
  // until the account credential and account event are both stored.
  if (!source.includes('const REGISTERED_USER_IDS = new Set();')) {
    const marker = 'const USER_ACCOUNTS = loadUserAccounts();';
    const inject = `const USER_ACCOUNTS = loadUserAccounts();
const REGISTERED_USER_IDS = new Set();
async function restoreRegisteredUsers() {
  try {
    const events = await storage.getHistory({type:'user_account', limit:5000});
    const latest = new Map();
    for (const row of events || []) {
      const p = row?.payload || {};
      if (p.id && p.email) latest.set(String(p.id), p);
    }
    for (const p of latest.values()) {
      if (String(p.status || 'ACTIVE') === 'DISABLED') continue;
      if (USER_ACCOUNTS.some(u => String(u.id) === String(p.id))) continue;
      USER_ACCOUNTS.push({
        id:String(p.id), email:String(p.email).toLowerCase(), name:String(p.name || p.email).slice(0,80),
        role:String(p.role || 'user') === 'admin' ? 'admin' : 'user', plan:String(p.plan || 'trial').slice(0,40),
        passwordHash:'', enabled:p.enabled !== false
      });
      REGISTERED_USER_IDS.add(String(p.id));
    }
    console.log(\`[AUTH] Restored \${REGISTERED_USER_IDS.size} registered member(s)\`);
  } catch (e) { console.error('[AUTH] Registered member restore failed:', e.message); }
}
`;
    if (source.includes(marker)) source = source.replace(marker, inject, 1);
  }

  if (!source.includes("app.get('/api/public/pricing'")) {
    const marker = "app.get('/api/pricing', requireAuth, (req,res) => {";
    const route = `app.get('/api/public/pricing', (_req,res) => {
  res.set('Cache-Control','no-store');
  res.json({success:true,plans:pricingPlans.map(p=>({id:p.id,name:p.name,price:p.price,period:p.period,enabled:p.enabled!==false,features:p.features||[]}))});
});

`;
    if (source.includes(marker)) source = source.replace(marker, route + marker, 1);
  }

  if (!source.includes("app.post('/api/auth/register'")) {
    const marker = "app.post('/api/auth/login', rateLimit({";
    const route = `app.post('/api/auth/register', rateLimit({windowMs:15*60_000,max:8,standardHeaders:true,legacyHeaders:false}), async (req,res) => {
  try {
    const name=String(req.body?.name||'').trim().slice(0,80);
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=String(req.body?.password||'');
    const requestedPlan=String(req.body?.plan||'trial').trim().toLowerCase();
    if(!name || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !password) return res.status(400).json({success:false,error:'Name, valid email and password are required'});
    if(!passwordPolicy(password)) return res.status(400).json({success:false,error:'Password must be at least 12 characters and include uppercase, lowercase, number and symbol'});
    if(ADMIN_EMAIL && email===ADMIN_EMAIL) return res.status(409).json({success:false,error:'This email is reserved for the administrator'});
    if(USER_ACCOUNTS.some(u=>u.enabled!==false && String(u.email).toLowerCase()===email)) return res.status(409).json({success:false,error:'An account with this email already exists'});
    const dbStatus=await storage.getStatus();
    if(process.env.RENDER && (!dbStatus.databaseConfigured || dbStatus.mode!=='postgres' || !dbStatus.connected)) return res.status(503).json({success:false,error:'Member registration requires the persistent PostgreSQL database on Render. Configure DATABASE_URL first.'});
    const plan=pricingPlans.find(p=>String(p.id).toLowerCase()===requestedPlan && p.enabled!==false) || pricingPlans.find(p=>String(p.id).toLowerCase()==='trial') || pricingPlans[0];
    if(!plan) return res.status(503).json({success:false,error:'No active pricing plan is available'});
    const id='user-'+crypto.randomBytes(12).toString('hex');
    const passwordHash=hashPassword(password);
    const user={id,email,name,role:'user',plan:String(plan.id),permissions:['terminal','pricing','telegram:own','profile:own'],twoFactorEnabled:false};
    await storage.saveAuthCredential(id,passwordHash);
    const saved=await storage.saveEvent('user_account',null,{id,email,name,role:'user',plan:String(plan.id),enabled:true,status:'ACTIVE',createdAt:new Date().toISOString()});
    if(!saved) throw new Error('Account record could not be persisted');
    USER_ACCOUNTS.push({...user,passwordHash,enabled:true});
    REGISTERED_USER_IDS.add(id);
    try {
      if(bot && TELEGRAM_CHAT_ID) await bot.sendMessage(TELEGRAM_CHAT_ID,\`🆕 V TRADE AI — NEW MEMBER\\n\\n👤 Name: \${name}\\n📧 Email: \${email}\\n💎 Plan: \${plan.name}\\n🟢 Status: ACTIVE\\n🕒 Created: \${new Date().toISOString()}\`);
    } catch (_) {}
    const token=createAuthSession(user); setAuthCookie(res,token); res.set('Cache-Control','no-store');
    res.status(201).json({success:true,created:true,user,token,expiresAt:Date.now()+AUTH_SESSION_TTL_MS,message:'Account created successfully'});
  } catch(e) { console.error('[AUTH] Registration failed:',e.message); res.status(500).json({success:false,error:'Account registration failed'}); }
});

`;
    if (source.includes(marker)) source = source.replace(marker, route + marker, 1);
  }

  if (!source.includes('await restoreRegisteredUsers();')) {
    const marker = "await storage.initStorage();\n  try {\n    const storedAuth = await storage.loadAuthCredentials();";
    const replacement = "await storage.initStorage();\n  await restoreRegisteredUsers();\n  try {\n    const storedAuth = await storage.loadAuthCredentials();";
    if (source.includes(marker)) source = source.replace(marker, replacement, 1);
  }

  // MTF execution logic: M5 is the micro execution timeframe; M1 is not used
  // as an entry gate because it is too noisy for the confirmed setup pipeline.
  source = source.replace("const order = ['H4', 'H1', 'M15', 'M5', 'M1'];", "const order = ['M5', 'M15', 'H1'];");
  source = source.replace("microTimeframe:'M1'", "microTimeframe:'M5'");
  source = source.replace("order: ['H4','H1','M15','M5','M1'],", "order: ['H4','H1','M15','M5'],", 1);
  source = source.replace("M1: 'entry trigger'", "M5: 'entry execution trigger'", 1);

  return source;
}

function patchLogin(source) {
  const needle = '<a class="link" href="reset-password.html">Forgot password?</a>';
  if (source.includes('href="register.html"')) return source;
  if (!source.includes(needle)) return source;
  return source.replace(needle, needle + '<br><a class="link" href="register.html">🆕 Register new member</a>', 1);
}

try {
  let source = fs.readFileSync(SERVER_FILE, 'utf8');
  const patched = patchServer(source);
  if (patched !== source) {
    fs.writeFileSync(SERVER_FILE, patched, 'utf8');
    console.log('[V-TRADE HOTFIX] production server integrity/auth/MTF patch applied');
  } else {
    console.log('[V-TRADE HOTFIX] no server source changes required');
  }

  if (fs.existsSync(LOGIN_FILE)) {
    const login = fs.readFileSync(LOGIN_FILE, 'utf8');
    const patchedLogin = patchLogin(login);
    if (patchedLogin !== login) {
      fs.writeFileSync(LOGIN_FILE, patchedLogin, 'utf8');
      console.log('[V-TRADE HOTFIX] register link added to login page');
    }
  }
} catch (err) {
  console.error('[V-TRADE HOTFIX] startup patch failed:', err.message);
  process.exitCode = 1;
}

require('./server-launcher.js');

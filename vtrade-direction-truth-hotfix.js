// V-TRADE AI — Direction Truth + Score Guard
// Patches the Telegram presentation layer so MTF direction cannot be overridden
// by an inflated legacy directionScore. No trade authorization is added here.
const fs=require('fs');
const path=require('path');
const DIAG=path.resolve(__dirname,'ai-telegram-diagnostic-hotfix.js');
const MARK='// V-TRADE DIRECTION TRUTH HOTFIX INSTALLED';

function patch(){
  let s=fs.readFileSync(DIAG,'utf8');
  if(s.includes(MARK)) return false;
  const anchor='function premiumSignalText(a) {';
  if(!s.includes(anchor)) throw new Error('premiumSignalText anchor not found');
  const helper=MARK+`\nfunction vtradeCoreMtf(a){
  const src=a?.timeframes||a?.mtf?.timeframes||a?.mtf||a?.multiTimeframe||{};
  const get=(tf)=>src?.[tf]??src?.[tf.toLowerCase()]??a?.[tf]??a?.[tf.toLowerCase()]??{};
  const vote=(x)=>{
    const b=String(x?.bias||x?.direction||'').toUpperCase();
    if(b.includes('BULL'))return 1;
    if(b.includes('BEAR'))return -1;
    const bp=Number(x?.buyPct??x?.buyStrengthPct),sp=Number(x?.sellPct??x?.sellStrengthPct);
    if(Number.isFinite(bp)&&Number.isFinite(sp)&&Math.abs(bp-sp)>=5)return bp>sp?1:-1;
    return 0;
  };
  const parts=[['H4',4],['H1',3],['M15',2]].map(([tf,w])=>({tf,w,v:vote(get(tf))}));
  const weighted=parts.reduce((n,x)=>n+x.v*x.w,0);
  const bull=parts.filter(x=>x.v>0).length;
  const bear=parts.filter(x=>x.v<0).length;
  const decisive=weighted>0?'BULLISH':weighted<0?'BEARISH':'NEUTRAL';
  const majority=Math.max(bull,bear);
  const agreement=majority>=2?(majority+'/3'):'0/3';
  const agreementStrength=majority>=2?Math.round(50+Math.min(35,Math.abs(weighted)*7)):50;
  const conflict=parts.some(x=>x.v!==0&&x.v!==Math.sign(weighted));
  const score=conflict?Math.min(68,agreementStrength):agreementStrength;
  return {bias:decisive,score,agreement,conflict,frames:parts};
}\n`;
  s=s.replace(anchor,helper+'\n'+anchor);
  const biasOld="const bias = String(a?.bias || a?.directionBand || (side === 'BUY' ? 'BULLISH' : side === 'SELL' ? 'BEARISH' : 'NEUTRAL')).toUpperCase();";
  const scoreOld="const score = firstFinite(a?.directionScore, a?.score?.directionScore, a?.score, a?.aiScore) ?? 0;";
  if(!s.includes(biasOld)||!s.includes(scoreOld)) throw new Error('legacy score lines not found');
  s=s.replace(biasOld,"const core = vtradeCoreMtf(a);\n  const bias = core.bias;" );
  s=s.replace(scoreOld,"const score = core.score;" );
  const councilOld="const councilCount = council?.bullishCount ?? council?.bearishCount ?? council?.count ?? '—';";
  if(s.includes(councilOld)) s=s.replace(councilOld,"const councilCount = core.agreement || council?.bullishCount || council?.bearishCount || council?.count || '—';");
  fs.writeFileSync(DIAG,s,'utf8');
  console.log('[V-TRADE DIRECTION] MTF truth guard patched: H4 > H1 > M15; score capped on conflict');
  return true;
}
try{patch();}catch(e){console.error('[V-TRADE DIRECTION] patch failed:',e.message);process.exitCode=1;}

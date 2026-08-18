// V-TRADE AI — Pre-AI Market Force Hotfix
// Deterministic MTF/ICT processing runs first. AI is confirmation only.
const fs = require('fs');
const path = require('path');
const SERVER_FILE = path.resolve(__dirname, 'server.js');
const previousReadFileSync = fs.readFileSync.bind(fs);

function patchPreAiStrength(source) {
  if (!source || source.includes('VTRADE_PRE_AI_MARKET_FORCE_V1')) return source;
  const marker = 'const app = express();';
  if (!source.includes(marker)) return source;

  const injected = String.raw`
/* VTRADE_PRE_AI_MARKET_FORCE_V1 */
// Pre-AI deterministic market-force engine. This is evidence strength, NOT win probability.
(function installPreAiMarketForce(app){
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const side=v=>{const s=String(v||'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};
  const pick=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!=='');
  const weights={M5:1,M15:2,H1:3,H4:4,D1:5};
  const frames=['M5','M15','H1','H4','D1'];
  const frameRow=(a,tf)=>{const t=a?.timeframes||a?.mtf||a?.multiTimeframe||{};return t[tf]||t[tf.toLowerCase()]||a?.[tf]||a?.[tf.toLowerCase()]||null;};
  const frameScore=(r)=>{
    const raw=n(pick(r?.directionScore,r?.score,r?.setupScore,r?.confidence));
    if(raw!=null)return clamp(raw);
    const rr=n(r?.rsi); if(rr!=null)return clamp(50+(rr-50)*1.5);
    return 50;
  };
  function calc(raw,tf){
    const a=raw?.analysis||raw?.data||raw||{};
    const rows={}; let totalW=0, bull=0, bear=0, available=0;
    for(const f of frames){
      const r=frameRow(a,f); if(!r)continue;
      const structure=side(pick(r?.structure?.bias,r?.resolvedBias,r?.trend,r?.bias,r?.direction));
      const momentum=side(pick(r?.macd?.bias,r?.momentumBias));
      const rs=n(r?.rsi);
      let s=frameScore(r);
      let dir=structure!=='NEUTRAL'?structure:(momentum!=='NEUTRAL'?momentum:(rs==null?'NEUTRAL':rs>50?'BULLISH':rs<50?'BEARISH':'NEUTRAL'));
      if(dir==='BULLISH'){bull+=s*weights[f];bear+=(100-s)*weights[f];}
      else if(dir==='BEARISH'){bear+=s*weights[f];bull+=(100-s)*weights[f];}
      else {bull+=50*weights[f];bear+=50*weights[f];}
      totalW+=100*weights[f]; available++;
      rows[f]={direction:dir,score:Math.round(s),weight:weights[f],structure,momentum,rsi:rs};
    }
    const mtfBuy=totalW?bull/totalW*100:50;
    const mtfSell=totalW?bear/totalW*100:50;
    const ict=a?.ict||{};
    const gates={
      liquiditySweep:pick(ict?.liquiditySweep?.bias,ict?.liquiditySweep?.confirmed,ict?.sweep?.bias,ict?.sweep?.confirmed),
      mss:pick(ict?.mss,ict?.marketStructureShift),
      bos:pick(ict?.bos,ict?.breakOfStructure),
      fvg:pick(ict?.fvg?.type,ict?.fvg?.bias,ict?.fairValueGap?.type),
      orderBlock:pick(ict?.orderBlock?.type,ict?.orderBlock?.bias,ict?.ob?.type)
    };
    const ictVotes=Object.values(gates).map(side).filter(x=>x!=='NEUTRAL');
    const ictBull=ictVotes.filter(x=>x==='BULLISH').length;
    const ictBear=ictVotes.filter(x=>x==='BEARISH').length;
    const ictNet=ictVotes.length?((ictBull-ictBear)/ictVotes.length):0;
    const ictBuy=clamp(50+ictNet*50), ictSell=100-ictBuy;
    const ictWeight=ictVotes.length?0.30:0;
    const mtfWeight=1-ictWeight;
    let buy=mtfBuy*mtfWeight+ictBuy*ictWeight;
    let sell=mtfSell*mtfWeight+ictSell*ictWeight;
    const sum=buy+sell;
    if(sum>0){buy=buy/sum*100;sell=sell/sum*100;}else{buy=sell=50;}
    buy=Math.round(clamp(buy)*10)/10; sell=Math.round((100-buy)*10)/10;
    const bias=buy>sell?'BULLISH':sell>buy?'BEARISH':'NEUTRAL';
    const gap=Math.abs(buy-sell);
    const dataQuality=n(a?.dataQuality?.score);
    const feedReady=a?.feedReady!==false&&a?.mt5?.ready!==false;
    const qualityFactor=dataQuality==null?1:clamp(dataQuality)/100;
    const confidence=Math.round(clamp(Math.min(100,(50+gap)*qualityFactor)));
    const setupScore=Math.round(clamp(Math.max(buy,sell)));
    const confirmedIct=ictVotes.length>=2 && Math.max(ictBull,ictBear)>=2;
    const price=n(pick(a?.price,a?.livePrice,a?.mt5?.price,a?.quote?.price,a?.mt5Quote?.price));
    const gatePass={
      liquiditySweep:pick(ict?.liquiditySweep?.confirmed,ict?.sweep?.confirmed)===true,
      mss:['BULLISH','BEARISH'].includes(side(ict?.mss)),
      bos:['BULLISH','BEARISH'].includes(side(ict?.bos)),
      fvg:['BULLISH','BEARISH'].includes(side(pick(ict?.fvg?.type,ict?.fvg?.bias,ict?.fairValueGap?.type))),
      orderBlock:['BULLISH','BEARISH'].includes(side(pick(ict?.orderBlock?.type,ict?.orderBlock?.bias,ict?.ob?.type)))
    };
    return {
      symbol:'XAUUSD',timeframe:tf,price,buyScore:buy,sellScore:sell,setupScore,buyStrengthPct:buy,sellStrengthPct:sell,buyPressure:buy,sellPressure:sell,
      bias,marketForceScore:setupScore,preAiConfidence:confidence,confidenceMeaning:'Evidence strength from verified MTF/ICT inputs; not probability of profit or win rate.',
      mtf:{available,weights,rows,buyPct:Math.round(mtfBuy*10)/10,sellPct:Math.round(mtfSell*10)/10},
      gates:gatePass,ict:{votes:ictVotes.length,bullish:ictBull,bearish:ictBear,confirmed:confirmedIct,gates},
      data:{feedReady,dataQuality},workflow:{stage:'PRE_AI_PROCESSING',aiRole:'CONFIRMATION_ONLY',entryAuthorization:false},
      calculatedAt:new Date().toISOString()
    };
  }
  app.get('/api/pre-market/xauusd',async(req,res)=>{
    try{
      const tf=String(req.query.tf||'M15').toUpperCase();
      if(!frames.includes(tf))return res.status(400).json({success:false,error:'Invalid timeframe'});
      const token=String(req.get('x-vtrade-auth')||'');
      const port=Number(process.env.PORT||10000);
      const r=await fetch('http://127.0.0.1:'+port+'/api/analysis/xauusd',{headers:token?{'x-vtrade-auth':token}:{},signal:AbortSignal.timeout(12000)});
      const raw=await r.json().catch(()=>({success:false,error:'Invalid analysis response'}));
      if(!r.ok||raw?.success===false)return res.status(r.status||502).json({success:false,error:raw?.error||'MTF analysis unavailable'});
      return res.json({success:true,...calc(raw,tf)});
    }catch(e){return res.status(502).json({success:false,error:String(e?.message||e)});}
  });
  console.log('[V-TRADE PRE-AI] MTF/ICT market-force % engine active — AI confirmation only');
})(app);
`;
  return source.replace(marker, marker + '\n' + injected);
}

fs.readFileSync = function(file,...args){
  const source = previousReadFileSync(file,...args);
  if(path.resolve(String(file))!==SERVER_FILE || typeof source!=='string') return source;
  return patchPreAiStrength(source);
};

require('./server-timeout-hotfix.js');

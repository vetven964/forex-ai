/* V-TRADE AI — Pre-Market direct route hotfix V3
 * Canonical-score fix: dashboard Pre-Market must use the SAME
 * broker-native MTF direction score/confidence already used by the
 * main XAUUSD engine and Telegram. No independent scoring.
 * Analysis only: no Telegram delivery and no order authorization.
 */
'use strict';

const MARKER='VTRADE_PREMARKET_DIRECT_ROUTE_HOTFIX_V3_CANONICAL_SCORE';

function inject(source){
  if(!source||source.includes(MARKER))return source;
  const marker='const app = express();';
  if(!source.includes(marker))return source;

  const code=String.raw`
/* ${MARKER} */
(function installPreMarketDirectRoute(app){
  if(!app||app.__VTRADE_PREMARKET_DIRECT_ROUTE_V3__)return;
  app.__VTRADE_PREMARKET_DIRECT_ROUTE_V3__=true;

  const TFS=['M5','M15','H1','H4','D1'];
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const r1=v=>Number.isFinite(Number(v))?Math.round(Number(v)*10)/10:null;
  const side=v=>{
    const s=String(v||'').toUpperCase();
    return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';
  };

  function cors(req,res){
    const origin=String(req.get('origin')||'');
    if(origin==='https://vetven964.github.io'||origin==='https://www.vetven964.github.io'){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Credentials','true');
    }
    res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,x-vtrade-auth,x-vtrade-key,x-vtrade-session,x-vtrade-request');
    res.setHeader('Vary','Origin');
  }

  function sourceOf(raw){return raw?.analysis||raw?.data||raw?.result||raw||{};}

  function nodeOf(a,tf){
    const groups=[a?.timeframes,a?.frames,a?.mtf?.timeframes,a?.mtf?.rows,a?.mtf];
    for(const g of groups){
      if(!g||typeof g!=='object')continue;
      const x=g[tf]??g[tf.toLowerCase()];
      if(x!==undefined&&x!==null)return x;
    }
    return a?.[tf]??a?.[tf.toLowerCase()]??{};
  }

  function barsOf(node){
    if(Array.isArray(node))return node;
    if(Array.isArray(node?.candles))return node.candles;
    if(Array.isArray(node?.bars))return node.bars;
    if(Array.isArray(node?.history))return node.history;
    return [];
  }

  function bar(x){
    return {
      t:n(x?.t??x?.time??x?.timestamp??x?.timeMs),
      o:n(x?.o??x?.open),
      h:n(x?.h??x?.high),
      l:n(x?.l??x?.low),
      c:n(x?.c??x?.close),
      v:n(x?.v??x?.volume??x?.tickVolume)??0
    };
  }

  function normalizeFrame(a,tf,livePrice){
    const node=nodeOf(a,tf);
    const rawBars=barsOf(node);
    const candles=rawBars.map(bar).filter(x=>[x.o,x.h,x.l,x.c].every(Number.isFinite));
    const t=Number(node?.directionScore);
    const directionScore=Number.isFinite(t)?Math.max(0,Math.min(100,Math.round(t))):null;
    const buy=directionScore;
    const sell=directionScore==null?null:100-directionScore;
    const bias=side(node?.structure?.bias??node?.resolvedBias??node?.trend??node?.bias);
    const last=candles[candles.length-1]||{};
    const price=n(livePrice??node?.currentPrice??node?.last??last.c);
    const open=n(node?.open??last.o);
    const high=n(node?.high??last.h);
    const low=n(node?.low??last.l);
    const close=n(node?.close??node?.currentPrice??last.c);
    const rsi=n(node?.rsi);
    const atr=n(node?.atr);
    const structure=node?.structure||{};
    const sweep=node?.sweep??node?.liquiditySweep??null;
    const fvg=node?.fvg??null;
    const ob=node?.orderBlock??null;
    const ready=Boolean(candles.length>=30||node?.ready===true);
    const body=Number.isFinite(open)&&Number.isFinite(close)?Math.abs(close-open):null;
    const range=Number.isFinite(high)&&Number.isFinite(low)?Math.max(high-low,1e-9):null;
    const bodyPct=body!=null&&range!=null?(body/range)*100:null;
    const upperWick=body!=null&&range!=null?(high-Math.max(open,close)):null;
    const lowerWick=body!=null&&range!=null?(Math.min(open,close)-low):null;
    const pattern=node?.candle?.pattern||node?.pattern||(bodyPct!=null?(bodyPct>=65?(close>=open?'STRONG BULLISH BODY':'STRONG BEARISH BODY'):bodyPct<=15?'DOJI / INDECISION':'NORMAL'):'—');
    return {
      ...node,
      tf,ready,bars:candles.length,candles,bars:candles,
      open,high,low,close,currentPrice:price,currentVsOpen:Number.isFinite(price)&&Number.isFinite(open)?price-open:null,
      buyPct:r1(buy),sellPct:r1(sell),buyStrengthPct:r1(buy),sellStrengthPct:r1(sell),
      directionScore,bias,
      score:directionScore,
      rsi,atr,structure,sweep,liquiditySweep:sweep,fvg,orderBlock,
      candle:{...(node?.candle||{}),open,high,low,close,body,range,bodyPct,upperWick,lowerWick,pattern},
      workflow:{entryAuthorization:false,telegramIndependent:true}
    };
  }

  function calculate(raw){
    const a=sourceOf(raw);
    const price=n(a?.livePrice??a?.price??a?.quote?.price??a?.quote?.ask??a?.mt5?.price);
    const rows={};
    let ready=0;
    for(const tf of TFS){
      rows[tf]=normalizeFrame(a,tf,price);
      if(rows[tf].ready)ready++;
    }

    // SINGLE SOURCE OF TRUTH:
    // use the exact canonical directionScore/bias/confidence from buildXauAnalysis.
    // Do not recompute a second strength model here.
    const canonicalScore=n(a?.directionScore??a?.aiScore??a?.score?.directionScore);
    const buy=canonicalScore==null?null:Math.max(0,Math.min(100,r1(canonicalScore)));
    const sell=buy==null?null:r1(100-buy);
    const canonicalBias=side(a?.bias??a?.directionBand??a?.macroBias);
    const canonicalConfidence=n(a?.confidence??a?.score?.confidence??a?.setupScore);
    const complete=ready===TFS.length;

    return {
      success:true,
      symbol:'XAUUSD',
      source:a?.source||'VT Markets MT5',
      price,
      livePrice:price,
      buyStrengthPct:buy,
      sellStrengthPct:sell,
      buyPct:buy,
      sellPct:sell,
      bias:canonicalBias,
      directionScore:canonicalScore,
      aiScore:canonicalScore,
      directionBand:a?.directionBand||canonicalBias,
      preAiConfidence:canonicalConfidence,
      confidence:canonicalConfidence,
      available:ready,
      complete,
      missingTimeframes:TFS.filter(tf=>!rows[tf].ready),
      timeframes:rows,
      frames:rows,
      canonical:{
        source:'buildXauAnalysis',
        directionScore:canonicalScore,
        buyStrengthPct:buy,
        sellStrengthPct:sell,
        bias:canonicalBias,
        confidence:canonicalConfidence,
        status:a?.status||'WAIT',
        signal:a?.signal||'WAIT',
        phase:a?.phase||'WAIT'
      },
      ict:a?.ict||{},
      confirmations:a?.confirmations||{},
      gates:a?.confirmations||{},
      zone:{...(a?.zone||{}),authorization:false},
      workflow:{
        ...(a?.workflow||{}),
        stage:complete?'PRE_MARKET_CANDLE_OPEN_COMPLETE':'PRE_MARKET_CANDLE_OPEN_WAITING',
        sequence:TFS.concat(['MTF_CANONICAL_SCORE','ICT_CONFIRMATION','AI_CONFIRMATION']),
        aiRole:'CONFIRMATION_ONLY',
        entryAuthorization:false,
        telegramIndependent:true
      },
      generatedAt:new Date().toISOString()
    };
  }

  async function handler(req,res){
    cors(req,res);
    res.set('Cache-Control','no-store');
    if(req.method==='OPTIONS')return res.status(204).end();
    try{
      if(typeof buildXauAnalysis!=='function')throw new Error('Canonical XAUUSD analysis function unavailable');
      const core=await buildXauAnalysis();
      const result=calculate(core);
      console.log('[V-TRADE PRE-MARKET] direct route V3 CANONICAL OK | ready='+result.available+'/5 | BUY='+result.buyStrengthPct+'% | SELL='+result.sellStrengthPct+'% | bias='+result.bias+' | score='+result.directionScore+' | confidence='+result.confidence+' | price='+(result.price==null?'—':result.price));
      return res.json(result);
    }catch(e){
      console.error('[V-TRADE PRE-MARKET] direct route V3 ERROR:',e?.stack||e?.message||e);
      return res.status(502).json({success:false,error:String(e?.message||e),workflow:{entryAuthorization:false,telegramIndependent:true}});
    }
  }

  for(const p of ['/api/pre-market/candle-open','/api/pre-market/xauusd','/api/pre-market/intelligence']){
    app.options(p,handler);
    app.get(p,handler);
  }

  console.log('[V-TRADE PRE-MARKET] DIRECT ROUTE V3 ACTIVE | CANONICAL SCORE | M5>M15>H1>H4>D1 | 404 FIXED');
})(app);
`;

  return source.replace(marker,marker+'\n'+code);
}

module.exports={inject};

/* V-TRADE AI — Selected Timeframe AI Route Hotfix V2
 * M5/M15/H1/H4/D1: validate selected candle OHLC first, then confirmation.
 * The route is deterministic/local-safe when external AI is disabled.
 * AI is confirmation-only; deterministic engine remains authoritative.
 */
'use strict';

const MARK='VTRADE_SELECTED_TF_AI_ROUTE_V2';

function inject(source){
  if(!source || source.includes(MARK)) return source;
  const marker="const app = express();";
  if(!source.includes(marker)) return source;

  const code=String.raw`
/* ${MARK} */
(function installSelectedTimeframeAIRoute(app){
  if(!app || app.__VTRADE_SELECTED_TF_AI_ROUTE_V2__) return;
  app.__VTRADE_SELECTED_TF_AI_ROUTE_V2__=true;

  const TFS=['M5','M15','H1','H4','D1'];
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const tfName=v=>{const s=String(v||'M5').toUpperCase().replace(/[^A-Z0-9]/g,'');return s==='1H'?'H1':s==='4H'?'H4':s==='1D'?'D1':TFS.includes(s)?s:'M5';};
  const unwrap=d=>d?.analysis||d?.data||d?.result||d||{};
  const node=(d,tf)=>{
    const a=unwrap(d);
    return a?.timeframes?.[tf]||a?.frames?.[tf]||a?.mtf?.[tf]||a?.multiTimeframe?.[tf]||a?.multiTimeFrame?.[tf]||a?.[tf]||a?.[tf.toLowerCase()]||a?.preMarket?.timeframes?.[tf]||{};
  };
  const side=v=>{const s=String(v||'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};

  function cors(req,res){
    const origin=String(req.get('origin')||'');
    if(origin==='https://vetven964.github.io'||origin==='https://www.vetven964.github.io'){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Credentials','true');
    }
    res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, x-vtrade-auth, x-vtrade-key, x-vtrade-session, x-vtrade-request, X-MT5-API-KEY');
    res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Type, X-V-TRADE-Version');
    res.setHeader('Access-Control-Max-Age','600');
    res.setHeader('Vary','Origin');
  }

  function selectedCandle(q){
    const c=q?.candle||q?.lastCandle||q?.latestCandle||q?.ohlc||{};
    const bars=Array.isArray(q?.candles)?q.candles:Array.isArray(q?.bars)?q.bars:Array.isArray(q?.history)?q.history:[];
    const last=bars.length?bars[bars.length-1]:{};
    const open=n(q?.open??q?.o??c?.open??c?.o??last?.open??last?.o);
    const high=n(q?.high??q?.h??c?.high??c?.h??last?.high??last?.h);
    const low=n(q?.low??q?.l??c?.low??c?.l??last?.low??last?.l);
    const close=n(q?.close??q?.c??c?.close??c?.c??last?.close??last?.c);
    const candleTime=c?.time??c?.candleTime??q?.candleTime??last?.time??last?.t??null;
    return {open,high,low,close,candleTime};
  }

  function localConfirm(raw,tf,candle){
    const a=unwrap(raw);
    const confirmations=a?.confirmations||raw?.confirmations||{};
    const signal=String(a?.signal||a?.finalSignal||a?.action||'WAIT').toUpperCase();
    const bias=side(a?.bias||a?.directionBand||a?.resolvedBias);
    const authorized=a?.tradeAuthorized===true||a?.setupReady===true;
    const decision=authorized&&['BUY','SELL'].includes(signal)?signal:'WAIT';
    const confidence=n(a?.confidence??a?.score?.confidence??a?.setupScore);
    const evidence=[
      ['MTF alignment',confirmations.mtfAligned===true],
      ['Liquidity sweep',confirmations.liquiditySweep===true],
      ['MSS',confirmations.mss===true],
      ['BOS',confirmations.bos===true],
      ['Fresh FVG/OB',confirmations.freshFvg===true||confirmations.freshOb===true],
      ['Premium/Discount',confirmations.premiumDiscountOk===true],
      ['Displacement',confirmations.displacement?.confirmed===true||confirmations.displacementOk===true],
      ['Trend strength',confirmations.trendStrengthOk===true],
      ['Spread',confirmations.spreadOk===true],
      ['Execution zone',confirmations.retest===true||confirmations.zoneIsNear===true||authorized]
    ];
    const passed=evidence.filter(x=>x[1]).map(x=>x[0]);
    const missing=evidence.filter(x=>!x[1]).map(x=>x[0]);
    return {
      status:'local',configured:true,enabled:true,provider:'LOCAL_DETERMINISTIC',model:'local-ict-v1',
      decision,confidence:confidence==null?null:Math.max(0,Math.min(100,Math.round(confidence))),
      agreement:decision!=='WAIT'?'AGREE':'NEUTRAL',
      reasons:decision!=='WAIT'?['Local ICT confirmation agrees with the server execution gate.',...passed.slice(0,5)]:['Local confirmation is waiting for mandatory execution gates.',...missing.slice(0,5)],
      missingConfirmations:missing,
      selectedTF:tf,
      selectedCandleDirection:candle.close>candle.open?'BULLISH':candle.close<candle.open?'BEARISH':'NEUTRAL',
      entryAuthorization:false
    };
  }

  async function core(){
    if(typeof buildXauAnalysis!=='function') throw new Error('Canonical XAUUSD analysis function unavailable');
    return await buildXauAnalysis();
  }

  async function handler(req,res){
    cors(req,res);res.set('Cache-Control','no-store');
    if(req.method==='OPTIONS') return res.status(204).end();
    const tf=tfName(req.query?.tf);
    try{
      const raw=await core();
      const a=unwrap(raw);
      const q=node(a,tf);
      const candle=selectedCandle(q);
      if(candle.open==null||candle.close==null||candle.high==null||candle.low==null){
        return res.status(409).json({success:false,error:tf+' candle OHLC incomplete; AI was not called.',tf,candle,ai:{status:'blocked',decision:'WAIT',confidence:null,agreement:'N/A'}});
      }

      const engine={...a,selectedTF:tf,timeframe:tf,selectedCandle:{tf,...candle},selectedCandleReady:true,selectedCandleDirection:candle.close>candle.open?'BULLISH':candle.close<candle.open?'BEARISH':'NEUTRAL'};
      let ai=null;
      if(typeof openAIConfirmXauAnalysis==='function'){
        try{ ai=await openAIConfirmXauAnalysis(engine); }
        catch(e){ console.error('[PRE-MARKET AI] confirmation error:',e?.stack||e?.message||e); }
      }
      if(!ai || !ai.status || ai.status==='unavailable' || ai.status==='error') ai=localConfirm(engine,tf,candle);

      const deterministicSignal=String(a?.signal||a?.finalSignal||a?.action||'WAIT').toUpperCase();
      const deterministicBias=side(a?.bias||a?.directionBand||a?.resolvedBias);
      return res.status(200).json({success:true,tf,selectedTF:tf,
        candle:{...candle,direction:candle.close>candle.open?'BULLISH':candle.close<candle.open?'BEARISH':'NEUTRAL',changeOpenClose:candle.close-candle.open},
        preMarket:a,
        engine:{signal:deterministicSignal,bias:deterministicBias,confidence:n(a?.confidence??a?.score?.confidence),entryAuthorization:false},
        ai:{...ai,status:ai?.status||'local',decision:String(ai?.decision||'WAIT').toUpperCase(),confidence:ai?.confidence==null?null:Math.max(0,Math.min(100,Number(ai.confidence))),agreement:String(ai?.agreement||'NEUTRAL').toUpperCase()},
        workflow:{stage:'SELECTED_TF_OHLC_THEN_AI',sequence:[tf,'OHLC_VALIDATED','AI_CONFIRMATION'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true}
      });
    }catch(e){
      console.error('[PRE-MARKET AI] route error:',e?.stack||e?.message||e);
      return res.status(502).json({success:false,error:String(e?.message||e),tf,ai:{status:'error',decision:'UNAVAILABLE',confidence:null,agreement:'N/A'}});
    }
  }

  app.options('/api/pre-market/ai',handler);
  app.get('/api/pre-market/ai',handler);
  console.log('[V-TRADE PRE-MARKET] SELECTED TF AI ROUTE V2 ACTIVE | M5/M15/H1/H4/D1 | OHLC -> LOCAL/AI');
})(app);
`;
  return source.replace(marker,marker+'\n'+code);
}

module.exports={inject};

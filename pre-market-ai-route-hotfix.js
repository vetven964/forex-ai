/* V-TRADE AI — Selected Timeframe AI Route Hotfix V1
 * M5/M15/H1/H4/D1: validate selected candle OHLC first, then AI confirmation.
 * AI is confirmation-only; deterministic engine remains authoritative.
 */
'use strict';

const MARK='VTRADE_SELECTED_TF_AI_ROUTE_V1';

function inject(source){
  if(!source || source.includes(MARK)) return source;
  const marker="const app = express();";
  if(!source.includes(marker)) return source;

  const code=String.raw`
/* ${MARK} */
(function installSelectedTimeframeAIRoute(app){
  if(!app || app.__VTRADE_SELECTED_TF_AI_ROUTE_V1__) return;
  app.__VTRADE_SELECTED_TF_AI_ROUTE_V1__=true;

  const TFS=['M5','M15','H1','H4','D1'];
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const tfName=v=>{const s=String(v||'M5').toUpperCase().replace(/[^A-Z0-9]/g,'');return s==='1H'?'H1':s==='4H'?'H4':s==='1D'?'D1':TFS.includes(s)?s:'M5';};
  const node=(d,tf)=>d?.timeframes?.[tf]||d?.frames?.[tf]||d?.mtf?.[tf]||d?.[tf]||d?.data?.[tf]||{};
  const side=v=>{const s=String(v||'').toUpperCase();return /BULL|BUY|LONG/.test(s)?'BULLISH':/BEAR|SELL|SHORT/.test(s)?'BEARISH':'NEUTRAL';};

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
      const a=raw?.analysis||raw?.data||raw||{};
      const q=node(a,tf);
      const c=q?.candle||q?.lastCandle||q?.latestCandle||{};
      const open=n(q?.open??c?.open??c?.o);
      const high=n(q?.high??c?.high??c?.h);
      const low=n(q?.low??c?.low??c?.l);
      const close=n(q?.close??c?.close??c?.c);
      const candleTime=c?.time??c?.candleTime??q?.candleTime??null;
      if(open==null||close==null||high==null||low==null){
        return res.status(409).json({success:false,error:tf+' candle OHLC incomplete; AI was not called.',tf,candle:{open,high,low,close,candleTime},ai:{status:'blocked',decision:'WAIT',confidence:null,agreement:'N/A'}});
      }

      const engine={...raw,selectedTF:tf,timeframe:tf,selectedCandle:{tf,open,high,low,close,candleTime},
        selectedCandleReady:true,
        selectedCandleDirection:close>open?'BULLISH':close<open?'BEARISH':'NEUTRAL'};

      let ai=null;
      if(typeof openAIConfirmXauAnalysis==='function'){
        try{
          ai=await openAIConfirmXauAnalysis(engine);
        }catch(e){
          console.error('[PRE-MARKET AI] confirmation error:',e?.stack||e?.message||e);
          ai={status:'unavailable',decision:'UNAVAILABLE',confidence:null,agreement:'N/A',configured:true,enabled:true,error:'AI confirmation unavailable; deterministic engine remains authoritative.'};
        }
      }else{
        ai={status:'unavailable',decision:'UNAVAILABLE',confidence:null,agreement:'N/A',configured:false,enabled:false,error:'AI confirmation runtime unavailable.'};
      }

      const deterministicSignal=String(raw?.signal||raw?.finalSignal||raw?.action||'WAIT').toUpperCase();
      const deterministicBias=side(raw?.bias||raw?.directionBand||raw?.resolvedBias);
      return res.json({success:true,tf,selectedTF:tf,
        candle:{open,high,low,close,candleTime,direction:close>open?'BULLISH':close<open?'BEARISH':'NEUTRAL',changeOpenClose:close-open},
        preMarket:raw,
        engine:{signal:deterministicSignal,bias:deterministicBias,confidence:n(raw?.confidence??raw?.score?.confidence),entryAuthorization:false},
        ai:{...ai,status:ai?.status||'ok',decision:String(ai?.decision||'WAIT').toUpperCase(),confidence:ai?.confidence==null?null:Math.max(0,Math.min(100,Number(ai.confidence))),agreement:String(ai?.agreement||'NEUTRAL').toUpperCase()},
        workflow:{stage:'SELECTED_TF_OHLC_THEN_AI',sequence:[tf,'OHLC_VALIDATED','AI_CONFIRMATION'],aiRole:'CONFIRMATION_ONLY',entryAuthorization:false,telegramIndependent:true}
      });
    }catch(e){
      console.error('[PRE-MARKET AI] route error:',e?.stack||e?.message||e);
      return res.status(502).json({success:false,error:String(e?.message||e),tf,ai:{status:'error',decision:'UNAVAILABLE',confidence:null,agreement:'N/A'}});
    }
  }

  app.options('/api/pre-market/ai',handler);
  app.get('/api/pre-market/ai',handler);
  console.log('[V-TRADE PRE-MARKET] SELECTED TF AI ROUTE ACTIVE | M5/M15/H1/H4/D1 | OHLC -> AI');
})(app);
`;
  return source.replace(marker,marker+'\n'+code);
}

module.exports={inject};

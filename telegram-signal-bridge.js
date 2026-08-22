/* V-TRADE AI — Telegram Signal Bridge V1
 * CORE owns MT5/MTF/ICT/AI analysis.
 * This module exposes a read-only final-signal contract for the separate Telegram process.
 * It never calculates ICT, never authorizes orders, and never sends Telegram messages.
 */
'use strict';

const MARKER='VTRADE_TELEGRAM_SIGNAL_BRIDGE_V1';
const API_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();

function install(app){
  if(!app||app.__VTRADE_TELEGRAM_SIGNAL_BRIDGE_V1__)return;
  app.__VTRADE_TELEGRAM_SIGNAL_BRIDGE_V1__=true;

  app.get('/api/telegram/final-signal',(req,res)=>{
    res.set('Cache-Control','no-store');
    if(API_KEY && String(req.get('X-VTRADE-TELEGRAM-KEY')||'')!==API_KEY){
      return res.status(401).json({success:false,error:'Telegram bridge unauthorized'});
    }
    try{
      if(typeof buildXauAnalysis!=='function'){
        return res.status(503).json({success:false,error:'Core analysis engine unavailable',source:'CORE'});
      }
      Promise.resolve(buildXauAnalysis()).then(a=>{
        const signal=String(a?.signal||a?.side||'WAIT').toUpperCase();
        const authorized=a?.tradeAuthorized===true || a?.setupReady===true;
        const finalSignal=authorized && (signal==='BUY'||signal==='SELL') ? signal : 'WAIT';
        return res.json({
          success:true,source:'CORE_AUTHORITATIVE',contract:'VTRADE_FINAL_SIGNAL_V1',
          symbol:String(a?.symbol||'XAUUSD'),finalSignal,tradeAuthorized:authorized,
          price:a?.livePrice??a?.price??a?.bid??null,
          timeframe:a?.timeframe??a?.executionTimeframe??a?.executionTF??null,
          confidence:a?.confidence??a?.score?.confidence??null,
          directionScore:a?.directionScore??null,bias:a?.bias??null,
          entry:a?.entry??a?.entryPrice??null,stopLoss:a?.stopLoss??a?.sl??null,
          takeProfit:Array.isArray(a?.takeProfit)?a.takeProfit:[],
          confirmations:a?.confirmations||{},reason:a?.reason||a?.status||null,
          generatedAt:new Date().toISOString()
        });
      }).catch(e=>res.status(502).json({success:false,error:String(e?.message||e),source:'CORE'}));
    }catch(e){
      return res.status(502).json({success:false,error:String(e?.message||e),source:'CORE'});
    }
  });
  console.log('[V-TRADE TELEGRAM BRIDGE] CORE read-only final-signal endpoint ACTIVE');
}

module.exports={MARKER,install};

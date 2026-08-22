/* V-TRADE AI — Telegram Signal Bridge V2
 * CORE owns MT5/MTF/ICT/AI analysis.
 * Telegram receives a read-only snapshot from the authoritative Pre-Market route.
 * This bridge never calculates ICT and never authorizes an order.
 */
'use strict';
const MARKER='VTRADE_TELEGRAM_SIGNAL_BRIDGE_V2';
const API_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();
const PORT=Number(process.env.PORT||10000);
function install(app){
  if(!app||app.__VTRADE_TELEGRAM_SIGNAL_BRIDGE_V2__)return;
  app.__VTRADE_TELEGRAM_SIGNAL_BRIDGE_V2__=true;
  app.get('/api/telegram/final-signal',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(API_KEY&&String(req.get('X-VTRADE-TELEGRAM-KEY')||'')!==API_KEY)return res.status(401).json({success:false,error:'Telegram bridge unauthorized'});
    try{
      const h={};
      if(API_KEY)h['X-VTRADE-TELEGRAM-KEY']=API_KEY;
      const r=await fetch(`http://127.0.0.1:${PORT}/api/pre-market/mt5-authoritative`,{headers:h,cache:'no-store'});
      const a=await r.json().catch(()=>({}));
      if(!r.ok||a?.success===false)throw new Error(a?.error||`Authority HTTP ${r.status}`);
      const ex=a?.execution||{},wf=a?.workflow||{};
      const signal=String(a?.signal||a?.side||a?.direction||'WAIT').toUpperCase();
      const authorized=ex.authorization===true||ex.tradeAuthorized===true||wf.entryAuthorization===true||wf.orderAuthorization===true;
      const finalSignal=authorized&&(signal==='BUY'||signal==='SELL')?signal:'WAIT';
      return res.json({success:true,source:'CORE_PREMARKET_AUTHORITY',contract:'VTRADE_FINAL_SIGNAL_V2',symbol:String(a?.symbol||'XAUUSD'),finalSignal,tradeAuthorized:authorized,price:a?.livePrice??a?.price??null,timeframe:a?.executionTimeframe??a?.timeframe??'M15',confidence:a?.confidence??a?.score?.confidence??null,directionScore:a?.directionScore??null,bias:a?.bias??null,entry:ex.entry??a?.entry??null,stopLoss:ex.stopLoss??a?.stopLoss??a?.sl??null,takeProfit:Array.isArray(ex.takeProfit)?ex.takeProfit:(Array.isArray(a?.takeProfit)?a.takeProfit:[]),executionStatus:ex.status??'WAIT',reason:ex.reason??a?.reason??'Waiting for authoritative execution gates',gates:a?.gates??{},generatedAt:new Date().toISOString()});
    }catch(e){return res.status(502).json({success:false,error:String(e?.message||e),source:'CORE_PREMARKET_AUTHORITY'});}
  });
  console.log('[V-TRADE TELEGRAM BRIDGE] V2 ACTIVE | read-only CORE Pre-Market authority');
}
module.exports={MARKER,install};

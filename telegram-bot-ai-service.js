/* V-TRADE AI — Telegram Bot AI Service V1
 * INDEPENDENT PROCESS.
 * Reads only the CORE final-signal contract.
 * Does not load server.js, Pre-Market engines, ICT calculators, or execution logic.
 */
'use strict';

require('dotenv').config();
const TelegramBot=require('node-telegram-bot-api');

const TOKEN=String(process.env.TELEGRAM_TOKEN||process.env.TELEGRAM_AUTO_TOKEN||'').trim();
const CHAT_ID=String(process.env.TELEGRAM_CHAT_ID||process.env.TELEGRAM_AUTO_CHAT_ID||'').trim();
const CORE_URL=String(process.env.VTRADE_CORE_URL||process.env.APP_BASE_URL||'http://127.0.0.1:10000').replace(/\/$/,'');
const BRIDGE_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();
const POLL_MS=Math.max(2000,Number(process.env.TELEGRAM_AI_POLL_MS||5000));

if(!TOKEN||!CHAT_ID){
  console.warn('[V-TRADE TELEGRAM AI] disabled: TELEGRAM_TOKEN/TELEGRAM_CHAT_ID not configured');
  process.exit(0);
}

const bot=new TelegramBot(TOKEN,{polling:false});
let lastKey='';
let busy=false;

async function readFinalSignal(){
  const headers={};
  if(BRIDGE_KEY)headers['X-VTRADE-TELEGRAM-KEY']=BRIDGE_KEY;
  const r=await fetch(CORE_URL+'/api/telegram/final-signal',{headers,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.success!==true)throw new Error(d?.error||('HTTP '+r.status));
  return d;
}

function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(2):'WAIT';}

function signalKey(a){
  return [a.finalSignal,a.timeframe,a.entry,a.stopLoss,(a.takeProfit||[]).join(','),a.generatedAt?.slice(0,15)].join('|');
}

async function scan(){
  if(busy)return;
  busy=true;
  try{
    const a=await readFinalSignal();
    if(a.finalSignal!=='BUY'&&a.finalSignal!=='SELL')return;
    if(a.tradeAuthorized!==true)return;
    const key=signalKey(a);
    if(key===lastKey)return;

    const tp=Array.isArray(a.takeProfit)?a.takeProfit:[];
    const lines=[
      '🤖 *V TRADE AI — TELEGRAM BOT AI*','',
      a.finalSignal==='BUY'?'🟢 *BUY — ENTRY CONFIRMED*':'🔴 *SELL — ENTRY CONFIRMED*',
      '📊 Asset: *XAUUSD*',
      '⏱ TF: *'+String(a.timeframe||'—')+'*',
      '💰 Price: *'+fmt(a.price)+'*',
      '🎯 Entry: *'+fmt(a.entry)+'*',
      '🛑 SL: *'+fmt(a.stopLoss)+'*',
      '🎯 TP1: *'+fmt(tp[0])+'*',
      '🎯 TP2: *'+fmt(tp[1])+'*',
      '🎯 TP3: *'+fmt(tp[2])+'*',
      '📈 Bias: *'+String(a.bias||'NEUTRAL')+'*',
      '🧠 Confidence: *'+fmt(a.confidence)+'/100*',
      '🔐 *CORE AUTHORIZATION PASSED*'
    ];
    await bot.sendMessage(CHAT_ID,lines.join('\n'),{parse_mode:'Markdown'});
    lastKey=key;
    console.log('[V-TRADE TELEGRAM AI] ENTRY SENT | '+a.finalSignal+' | '+String(a.timeframe||'—'));
  }catch(e){
    console.warn('[V-TRADE TELEGRAM AI] CORE read failed:',e.message);
  }finally{busy=false;}
}

console.log('[V-TRADE TELEGRAM AI] INDEPENDENT SERVICE ACTIVE | CORE='+CORE_URL+' | PreMarket=NOT_LOADED | ICT=NOT_LOADED | execution=NOT_LOADED');
scan();
setInterval(scan,POLL_MS);

process.on('SIGTERM',()=>process.exit(0));
process.on('SIGINT',()=>process.exit(0));

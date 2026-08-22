/* V-TRADE AI — Telegram Bot AI Service V2
 * INDEPENDENT PROCESS.
 * Reads CORE final-signal contract + market-news radar.
 * Does not load server.js, Pre-Market engines, ICT calculators, or execution logic.
 */
'use strict';

require('dotenv').config();
const TelegramBot=require('node-telegram-bot-api');
const {getNews,formatNews}=require('./market-news-service.js');

const TOKEN=String(process.env.TELEGRAM_TOKEN||process.env.TELEGRAM_AUTO_TOKEN||'').trim();
const CHAT_ID=String(process.env.TELEGRAM_CHAT_ID||process.env.TELEGRAM_AUTO_CHAT_ID||'').trim();
const CORE_URL=String(process.env.VTRADE_CORE_URL||process.env.APP_BASE_URL||'http://127.0.0.1:10000').replace(/\/$/,'');
const BRIDGE_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();
const POLL_MS=Math.max(2000,Number(process.env.TELEGRAM_AI_POLL_MS||5000));
const NEWS_POLL_MS=Math.max(60000,Number(process.env.TELEGRAM_NEWS_POLL_MS||300000));

if(!TOKEN||!CHAT_ID){
  console.warn('[V-TRADE TELEGRAM AI] disabled: TELEGRAM_TOKEN/TELEGRAM_CHAT_ID not configured');
  process.exit(0);
}

const bot=new TelegramBot(TOKEN,{polling:true});
let lastKey='';
let busy=false;
let newsBusy=false;
const seenNews=new Set();

async function readFinalSignal(){
  const headers={};
  if(BRIDGE_KEY)headers['X-VTRADE-TELEGRAM-KEY']=BRIDGE_KEY;
  const r=await fetch(CORE_URL+'/api/telegram/final-signal',{headers,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.success!==true)throw new Error(d?.error||('HTTP '+r.status));
  return d;
}
function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(2):'WAIT';}
function signalKey(a){return [a.finalSignal,a.timeframe,a.entry,a.stopLoss,(a.takeProfit||[]).join(','),a.generatedAt?.slice(0,15)].join('|');}

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
      '🤖 *V TRADE AI — XAUUSD*','',
      a.finalSignal==='BUY'?'🟢 *BUY — CONFIRMED*':'🔴 *SELL — CONFIRMED*',
      '⏱ TF: *'+String(a.timeframe||'—')+'*',
      '💰 Price: *'+fmt(a.price)+'*',
      '🎯 Entry: *'+fmt(a.entry)+'*',
      '🛑 SL: *'+fmt(a.stopLoss)+'*',
      '🎯 TP1: *'+fmt(tp[0])+'* | TP2: *'+fmt(tp[1])+'* | TP3: *'+fmt(tp[2])+'*',
      '📈 Bias: *'+String(a.bias||'NEUTRAL')+'* | 🧠 Confidence: *'+fmt(a.confidence)+'/100*',
      '🔐 *ICT/CORE AUTHORIZED*'
    ];
    await bot.sendMessage(CHAT_ID,lines.join('\n'),{parse_mode:'Markdown'});
    lastKey=key;
    console.log('[V-TRADE TELEGRAM AI] ENTRY SENT | '+a.finalSignal+' | '+String(a.timeframe||'—'));
  }catch(e){console.warn('[V-TRADE TELEGRAM AI] CORE read failed:',e.message);}
  finally{busy=false;}
}

async function sendNews(chatId,auto=false){
  if(newsBusy)return;
  newsBusy=true;
  try{
    const items=await getNews(8);
    if(auto){
      const high=items.filter(x=>x.impact==='HIGH');
      const fresh=high.filter(x=>!seenNews.has(x.link||x.title));
      if(!fresh.length)return;
      fresh.forEach(x=>seenNews.add(x.link||x.title));
      await bot.sendMessage(chatId,formatNews(fresh.slice(0,3)),{parse_mode:'Markdown'});
    }else{
      await bot.sendMessage(chatId,formatNews(items),{parse_mode:'Markdown',disable_web_page_preview:true});
    }
  }catch(e){console.warn('[V-TRADE NEWS] scan failed:',e.message);}
  finally{newsBusy=false;}
}

bot.onText(/^\/(news|macro|fed)(?:@\w+)?$/i,async msg=>{
  if(String(msg.chat.id)!==CHAT_ID)return;
  await sendNews(msg.chat.id,false);
});
bot.onText(/^\/help(?:@\w+)?$/i,async msg=>{
  if(String(msg.chat.id)!==CHAT_ID)return;
  await bot.sendMessage(msg.chat.id,'🤖 *V TRADE AI*\\n\\n/signal — current XAUUSD signal\\n/news — latest macro/Fed news\\n/macro — macro radar\\n/fed — Fed-focused news\\n/price — live price', {parse_mode:'Markdown'});
});
bot.onText(/^\/price(?:@\w+)?$/i,async msg=>{
  if(String(msg.chat.id)!==CHAT_ID)return;
  try{
    const r=await fetch(CORE_URL+'/api/telegram/final-signal',{headers:BRIDGE_KEY?{'X-VTRADE-TELEGRAM-KEY':BRIDGE_KEY}:{},cache:'no-store'});
    const a=await r.json();
    await bot.sendMessage(msg.chat.id,'💰 *XAUUSD:* '+fmt(a.price)+'\\n📈 Bias: *'+String(a.bias||'NEUTRAL')+'*');
  }catch(e){await bot.sendMessage(msg.chat.id,'⚠️ Price unavailable');}
});

console.log('[V-TRADE TELEGRAM AI] INDEPENDENT SERVICE ACTIVE | CORE='+CORE_URL+' | NEWS=ACTIVE | PreMarket=NOT_LOADED | ICT=NOT_LOADED | execution=NOT_LOADED');
scan();
setInterval(scan,POLL_MS);
sendNews(CHAT_ID,true);
setInterval(()=>sendNews(CHAT_ID,true),NEWS_POLL_MS);

process.on('SIGTERM',()=>process.exit(0));
process.on('SIGINT',()=>process.exit(0));

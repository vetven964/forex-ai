/* V-TRADE AI — Telegram Bot AI Service V3
 * FULLY INDEPENDENT TELEGRAM PROCESS.
 * Reads ONLY broker-native MT5 market data from /api/telegram/market-snapshot.
 * It does NOT load or consume Pre-Market analysis, ICT results, execution zones,
 * AI confirmation, or the CORE final-signal contract.
 */
'use strict';

require('dotenv').config();
const TelegramBot=require('node-telegram-bot-api');
const {getNews,formatNews}=require('./market-news-service.js');

const TOKEN=String(process.env.TELEGRAM_TOKEN||process.env.TELEGRAM_AUTO_TOKEN||'').trim();
const CHAT_ID=String(process.env.TELEGRAM_CHAT_ID||process.env.TELEGRAM_AUTO_CHAT_ID||'').trim();
const CORE_URL=String(process.env.VTRADE_CORE_URL||process.env.APP_BASE_URL||'http://127.0.0.1:10000').replace(/\/$/,'');
const BRIDGE_KEY=String(process.env.TELEGRAM_BRIDGE_API_KEY||process.env.MT5_BRIDGE_API_KEY||'').trim();
const POLL_MS=Math.max(5000,Number(process.env.TELEGRAM_AI_POLL_MS||60000));
const NEWS_POLL_MS=Math.max(60000,Number(process.env.TELEGRAM_NEWS_POLL_MS||300000));
const MAX_SPREAD=Math.max(0.01,Number(process.env.TELEGRAM_MAX_SPREAD||5));

if(!TOKEN||!CHAT_ID){
  console.warn('[V-TRADE TELEGRAM AI] disabled: TELEGRAM_TOKEN/TELEGRAM_CHAT_ID not configured');
  process.exit(0);
}

const bot=new TelegramBot(TOKEN,{polling:true});
let lastKey='';
let busy=false;
let newsBusy=false;
let lastAnalysis=null;
const seenNews=new Set();

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function bars(s,tf){return Array.isArray(s?.timeframes?.[tf]?.bars)?s.timeframes[tf].bars:[];}
function sma(xs,n){if(xs.length<n)return null;return xs.slice(-n).reduce((a,b)=>a+b,0)/n;}
function range(b){return Math.max(0,Number(b.h)-Number(b.l));}
function body(b){return Math.abs(Number(b.c)-Number(b.o));}
function directionFromRows(rows){
  const scores=rows.map(x=>x.score).filter(Number.isFinite);
  const score=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):50;
  return {score,bias:score>=55?'BULLISH':score<=45?'BEARISH':'NEUTRAL'};
}

function tfScore(raw){
  if(raw.length<20)return null;
  const closes=raw.map(x=>num(x.c)).filter(Number.isFinite);
  const last=closes.at(-1),m20=sma(closes,20),m5=sma(closes,5);
  if(last==null||m20==null||m5==null)return null;
  let score=50;
  if(last>m20)score+=8; else if(last<m20)score-=8;
  if(m5>m20)score+=5; else if(m5<m20)score-=5;
  const prev=closes.at(-6);
  if(prev!=null){if(last>prev)score+=4;else if(last<prev)score-=4;}
  return clamp(Math.round(score),0,100);
}

function liquiditySweep(raw){
  if(raw.length<12)return {bullish:false,bearish:false,level:null};
  const last=raw.at(-1),prior=raw.slice(-11,-1);
  const priorLow=Math.min(...prior.map(x=>Number(x.l))),priorHigh=Math.max(...prior.map(x=>Number(x.h)));
  return {
    bullish:Number(last.l)<priorLow&&Number(last.c)>priorLow,
    bearish:Number(last.h)>priorHigh&&Number(last.c)<priorHigh,
    level:Number(last.l)<priorLow?priorLow:Number(last.h)>priorHigh?priorHigh:null
  };
}

function structure(raw){
  if(raw.length<12)return {bullish:false,bearish:false};
  const last=raw.at(-1),prior=raw.slice(-7,-1);
  const hi=Math.max(...prior.map(x=>Number(x.h))),lo=Math.min(...prior.map(x=>Number(x.l)));
  return {bullish:Number(last.c)>hi,bearish:Number(last.c)<lo};
}

function displacement(raw){
  if(raw.length<22)return {bullish:false,bearish:false};
  const last=raw.at(-1),avg=raw.slice(-21,-1).reduce((a,b)=>a+range(b),0)/20,r=range(last),ratio=r>0?body(last)/r:0;
  const strong=r>=avg*1.2&&ratio>=0.6;
  return {bullish:strong&&Number(last.c)>Number(last.o),bearish:strong&&Number(last.c)<Number(last.o)};
}

function fvg(raw){
  if(raw.length<3)return {bullish:false,bearish:false,low:null,high:null};
  const a=raw.at(-3),c=raw.at(-1);
  return {
    bullish:Number(c.l)>Number(a.h),bearish:Number(c.h)<Number(a.l),
    low:Number(c.l)>Number(a.h)?Number(a.h):Number(c.h)<Number(a.l)?Number(c.h):null,
    high:Number(c.l)>Number(a.h)?Number(c.l):Number(c.h)<Number(a.l)?Number(a.l):null
  };
}

function orderBlock(raw,side){
  if(raw.length<5)return {found:false,low:null,high:null};
  const d=displacement(raw),candidate=raw.at(-2);
  const opposite=side==='BULLISH'?Number(candidate.c)<Number(candidate.o):Number(candidate.c)>Number(candidate.o);
  const found=opposite&&(side==='BULLISH'?d.bullish:d.bearish);
  return {found,low:found?Number(candidate.l):null,high:found?Number(candidate.h):null};
}

function analyze(s){
  const tfs=['M5','M15','H1','H4'];
  const rows=tfs.map(tf=>({tf,score:tfScore(bars(s,tf))})).filter(x=>Number.isFinite(x.score));
  const mtf=directionFromRows(rows);
  const raw=bars(s,'M15');
  const last=raw.at(-1)||{};
  const price=num(s.price??last.c);
  const sweep=liquiditySweep(raw),st=structure(raw),disp=displacement(raw),gap=fvg(raw);
  const side=mtf.bias;
  const ob=side==='NEUTRAL'?{found:false}:orderBlock(raw,side);
  const recent=raw.slice(-20);
  const hi=recent.length?Math.max(...recent.map(x=>Number(x.h))):null;
  const lo=recent.length?Math.min(...recent.map(x=>Number(x.l))):null;
  const mid=hi!=null&&lo!=null?(hi+lo)/2:null;
  const pd=side==='BULLISH'?(price!=null&&mid!=null&&price<mid):(side==='BEARISH'?(price!=null&&mid!=null&&price>mid):false);
  const closes=raw.map(x=>num(x.c)).filter(Number.isFinite);
  const momentum=side==='BULLISH'?(sma(closes,5)>sma(closes,20)):(side==='BEARISH'?(sma(closes,5)<sma(closes,20)):false);
  const spread=num(s.spread);
  const spreadPass=spread==null?true:spread<=MAX_SPREAD;
  const sweepPass=side==='BULLISH'?sweep.bullish:side==='BEARISH'?sweep.bearish:false;
  const mssPass=side==='BULLISH'?st.bullish:side==='BEARISH'?st.bearish:false;
  const bosPass=mssPass;
  const dispPass=side==='BULLISH'?disp.bullish:side==='BEARISH'?disp.bearish:false;
  const fvgPass=side==='BULLISH'?gap.bullish:side==='BEARISH'?gap.bearish:false;
  const obPass=ob.found;
  const structurePass=mssPass||bosPass;
  const zonePass=pd&&(fvgPass||obPass);
  const gates={liquiditySweep:sweepPass,mss:mssPass,bos:bosPass,displacement:dispPass,fvg:fvgPass,orderBlock:obPass,premiumDiscount:pd,executionZone:zonePass,momentum,spread:spreadPass};
  const passed=Object.values(gates).filter(Boolean).length;
  const confidence=clamp(Math.round(mtf.score*0.7+passed/9*30),0,100);
  const authorized=side!=='NEUTRAL'&&s.connected===true&&rows.length===4&&sweepPass&&structurePass&&dispPass&&(fvgPass||obPass)&&pd&&momentum&&spreadPass&&confidence>=75;
  let entry=null,sl=null,tp=[];
  if(authorized&&price!=null){
    entry=price;
    if(side==='BULLISH'){
      sl=Math.min(...raw.slice(-8).map(x=>Number(x.l)));
      const risk=Math.max(entry-sl,0.5);tp=[entry+risk*1.5,entry+risk*2.5,entry+risk*3.5];
    }else{
      sl=Math.max(...raw.slice(-8).map(x=>Number(x.h)));
      const risk=Math.max(sl-entry,0.5);tp=[entry-risk*1.5,entry-risk*2.5,entry-risk*3.5];
    }
  }
  const signal=authorized?(side==='BULLISH'?'BUY':'SELL'):'WAIT';
  const reasons=[];
  if(!s.connected)reasons.push('MT5 not ready');
  if(rows.length<4)reasons.push('MTF history incomplete');
  if(!sweepPass)reasons.push('liquidity sweep WAIT');
  if(!structurePass)reasons.push('MSS/BOS WAIT');
  if(!dispPass)reasons.push('displacement WAIT');
  if(!(fvgPass||obPass))reasons.push('FVG/OB WAIT');
  if(!pd)reasons.push('premium/discount WAIT');
  if(!momentum)reasons.push('momentum WAIT');
  if(!spreadPass)reasons.push('spread WAIT');
  if(confidence<75)reasons.push('confidence below authorization threshold');
  return {
    source:'TELEGRAM_INDEPENDENT_AI',symbol:'XAUUSD',price,bias:mtf.bias,directionScore:mtf.score,confidence,signal,tradeAuthorized:authorized,
    timeframe:'M15',entry,stopLoss:sl,takeProfit:tp,gates,gateCount:`${passed}/${Object.keys(gates).length}`,reason:reasons.length?reasons.join('; '):'All independent Telegram AI gates passed',
    mtf:rows,spread,generatedAt:new Date().toISOString()
  };
}

async function readMarket(){
  const headers={};if(BRIDGE_KEY)headers['X-VTRADE-TELEGRAM-KEY']=BRIDGE_KEY;
  const r=await fetch(CORE_URL+'/api/telegram/market-snapshot',{headers,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.success!==true)throw new Error(d?.error||('HTTP '+r.status));
  return d;
}

function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(2):'WAIT';}
function signalKey(a){return [a.signal,a.timeframe,a.entry,a.stopLoss,(a.takeProfit||[]).join(','),a.generatedAt?.slice(0,15)].join('|');}

function formatSignal(a){
  const side=a.signal==='BUY'?'🟢 BUY':a.signal==='SELL'?'🔴 SELL':'🟡 WAIT';
  const tp=a.takeProfit||[];
  return [
    '🤖 *V TRADE AI — TELEGRAM INDEPENDENT ICT*','',
    '📊 Asset: *XAU/USD (Gold)*',
    '💰 Price: *'+fmt(a.price)+'*',
    '⚡ Action: *'+side+'*',
    '📈 Bias: *'+String(a.bias)+'*',
    '📊 Direction Score: *'+a.directionScore+'/100*',
    '🧠 Confidence: *'+a.confidence+'/100*','',
    '🔎 ICT Gates: *'+a.gateCount+'*',
    '💧 Liquidity Sweep: *'+(a.gates.liquiditySweep?'PASS':'WAIT')+'* | MSS: *'+(a.gates.mss?'PASS':'WAIT')+'* | BOS: *'+(a.gates.bos?'PASS':'WAIT')+'*',
    '⚡ Displacement: *'+(a.gates.displacement?'PASS':'WAIT')+'* | FVG: *'+(a.gates.fvg?'PASS':'WAIT')+'* | OB: *'+(a.gates.orderBlock?'PASS':'WAIT')+'*',
    '📍 Premium/Discount: *'+(a.gates.premiumDiscount?'PASS':'WAIT')+'* | Momentum: *'+(a.gates.momentum?'PASS':'WAIT')+'* | Spread: *'+(a.gates.spread?'PASS':'WAIT')+'*','',
    '🎯 Entry: *'+fmt(a.entry)+'*',
    '🛑 SL: *'+fmt(a.stopLoss)+'*',
    '🎯 TP1: *'+fmt(tp[0])+'* | TP2: *'+fmt(tp[1])+'* | TP3: *'+fmt(tp[2])+'*','',
    a.tradeAuthorized?'🔐 *TELEGRAM AI — TRADE AUTHORIZED*':'⏳ *TELEGRAM AI — WAIT / NO ORDER AUTHORIZED*',
    '🧠 '+String(a.reason)
  ].join('\n');
}

async function scan(sendWait=false){
  if(busy)return;
  busy=true;
  try{
    const market=await readMarket();
    const a=analyze(market);lastAnalysis=a;
    console.log(`[TELEGRAM AUTO] Scan OK | signal=${a.signal} | bias=${a.bias} | score=${a.directionScore} | confidence=${a.confidence} | status=${a.tradeAuthorized?'AUTHORIZED':'WAIT — NO ENTRY'} | gates=${a.gateCount}`);
    if(!a.tradeAuthorized&&!sendWait)return;
    const key=signalKey(a);
    if(key===lastKey)return;
    await bot.sendMessage(CHAT_ID,formatSignal(a),{parse_mode:'Markdown'});
    lastKey=key;
    console.log(`[V-TRADE TELEGRAM AI] ${a.tradeAuthorized?'ENTRY SENT':'WAIT UPDATE SENT'} | independent=true | signal=${a.signal}`);
  }catch(e){console.warn('[V-TRADE TELEGRAM AI] MT5 market read failed:',e.message);}
  finally{busy=false;}
}

async function sendNews(chatId,auto=false){
  if(newsBusy)return;newsBusy=true;
  try{
    const items=await getNews(8);
    if(auto){
      const high=items.filter(x=>x.impact==='HIGH');
      const fresh=high.filter(x=>!seenNews.has(x.link||x.title));
      if(!fresh.length)return;
      fresh.forEach(x=>seenNews.add(x.link||x.title));
      await bot.sendMessage(chatId,formatNews(fresh.slice(0,3)),{parse_mode:'Markdown'});
    }else await bot.sendMessage(chatId,formatNews(items),{parse_mode:'Markdown',disable_web_page_preview:true});
  }catch(e){console.warn('[V-TRADE NEWS] scan failed:',e.message);}
  finally{newsBusy=false;}
}

bot.onText(/^\/(news|macro|fed)(?:@\w+)?$/i,async msg=>{if(String(msg.chat.id)!==CHAT_ID)return;await sendNews(msg.chat.id,false);});
bot.onText(/^\/signal(?:@\w+)?$/i,async msg=>{if(String(msg.chat.id)!==CHAT_ID)return;await scan(true);if(lastAnalysis)await bot.sendMessage(msg.chat.id,formatSignal(lastAnalysis),{parse_mode:'Markdown'});});
bot.onText(/^\/price(?:@\w+)?$/i,async msg=>{if(String(msg.chat.id)!==CHAT_ID)return;try{const m=await readMarket();await bot.sendMessage(msg.chat.id,'💰 *XAUUSD:* '+fmt(m.price)+'\n📡 MT5: *'+(m.connected?'READY':'WAIT')+'*\n📊 MTF: *'+['M5','M15','H1','H4'].map(tf=>tf+':'+(m.timeframes?.[tf]?.count||0)).join(' | ')+'*',{parse_mode:'Markdown'});}catch(e){await bot.sendMessage(msg.chat.id,'⚠️ MT5 price unavailable');}});
bot.onText(/^\/help(?:@\w+)?$/i,async msg=>{if(String(msg.chat.id)!==CHAT_ID)return;await bot.sendMessage(msg.chat.id,'🤖 *V TRADE AI — Telegram Independent*\n\n/signal — independent XAUUSD ICT scan\n/price — broker-native MT5 price\n/news — latest macro/Fed news\n/macro — macro radar\n/fed — Fed-focused news',{parse_mode:'Markdown'});});

console.log('[V-TRADE TELEGRAM AI] INDEPENDENT V3 ACTIVE | SOURCE=RAW_MT5_ONLY | PreMarket=NOT_LOADED | CORE_FINAL_SIGNAL=NOT_USED | ICT_ENGINE=LOCAL_TELEGRAM | execution=LOCAL_GATE_ONLY');
scan(false);
setInterval(()=>scan(false),POLL_MS);
sendNews(CHAT_ID,true);
setInterval(()=>sendNews(CHAT_ID,true),NEWS_POLL_MS);
process.on('SIGTERM',()=>process.exit(0));
process.on('SIGINT',()=>process.exit(0));

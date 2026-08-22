/* V-TRADE AI — Market News / Macro Radar V2
 * Read-only macro/news intelligence for Telegram.
 * HIGH impact can create BUY/SELL BIAS only.
 * MEDIUM = WAIT. LOW = IGNORE.
 * Does NOT authorize trades or alter CORE ICT execution gates.
 */
'use strict';

const FEEDS=[
  {name:'Federal Reserve',url:'https://www.federalreserve.gov/feeds/press_all.xml',official:true},
  {name:'Fed Monetary Policy',url:'https://www.federalreserve.gov/feeds/press_monetary.xml',official:true},
  {name:'Market Macro News',url:'https://news.google.com/rss/search?q=(Federal+Reserve+OR+FOMC+OR+Powell+OR+interest+rates+OR+CPI+OR+NFP+OR+gold)+when:2d&hl=en-US&gl=US&ceid=US:en',official:false}
];

const HAWKISH=[
  /rate\s+hike/i,/higher\s+rates/i,/rates?\s+remain\s+(high|elevated)/i,/higher\s+for\s+longer/i,
  /persistent\s+inflation/i,/sticky\s+inflation/i,/inflation\s+remains/i,/restrictive\s+policy/i,/tightening/i,
  /no\s+cut/i,/fewer\s+cuts?/i,/delay\s+cuts?/i
];
const DOVISH=[
  /rate\s+cut/i,/lower\s+rates/i,/easing/i,/dovish/i,/disinflation/i,/cooling\s+inflation/i,
  /weaker\s+labor/i,/softening\s+labor/i,/economic\s+slowdown/i,/recession\s+risk/i,/accommodative/i,
  /more\s+cuts?/i
];
const GOLD_BULL=[/gold\s+(rises|gains|surges|climbs)/i,/safe[- ]haven/i,/weaker\s+dollar/i,/lower\s+(treasury\s+)?yields?/i];
const GOLD_BEAR=[/gold\s+(falls|drops|slips)/i,/stronger\s+dollar/i,/higher\s+(treasury\s+)?yields?/i];
const HIGH_IMPACT=[/federal\s+reserve/i,/\bfed\b/i,/fomc/i,/interest\s+rate/i,/inflation/i,/cpi/i,/nonfarm/i,/payroll/i,/nfp/i,/powell/i,/treasury\s+yields?/i];
const EVENT_HIGH=/fomc|rate\s+(decision|hike|cut)|cpi|nfp|nonfarm|payroll/i;

function strip(s){
  return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
function firstTag(xml,tag){
  const m=String(xml).match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return m?strip(m[1]):'';
}
function parseFeed(xml,source){
  const out=[];
  const blocks=String(xml).match(/<item[\\s\\S]*?<\\/item>/gi)||String(xml).match(/<entry[\\s\\S]*?<\\/entry>/gi)||[];
  for(const b of blocks.slice(0,20)){
    const title=firstTag(b,'title');
    const description=firstTag(b,'description')||firstTag(b,'summary')||'';
    const pubDate=firstTag(b,'pubDate')||firstTag(b,'published')||firstTag(b,'updated');
    let link=firstTag(b,'link');
    const href=b.match(/<link[^>]+href=["']([^"']+)["']/i); if(!link&&href)link=href[1];
    if(title)out.push({title,description,pubDate,link:strip(link),source});
  }
  return out;
}
function scoreNews(item){
  const text=(item.title||'')+' '+(item.description||'');
  let score=0;
  for(const r of HAWKISH)if(r.test(text))score-=2;
  for(const r of DOVISH)if(r.test(text))score+=2;
  for(const r of GOLD_BULL)if(r.test(text))score+=1;
  for(const r of GOLD_BEAR)if(r.test(text))score-=1;

  const relevant=HIGH_IMPACT.some(r=>r.test(text));
  const bias=score>=2?'BULLISH':score<=-2?'BEARISH':'NEUTRAL';
  const confidence=Math.min(95,35+Math.abs(score)*12+(relevant?10:0));
  const impact=EVENT_HIGH.test(text)||Math.abs(score)>=3?'HIGH':relevant?'MEDIUM':'LOW';

  let reason='Mixed/unclear macro signal';
  if(score>0)reason='Dovish/risk-off tone can support gold';
  if(score<0)reason='Hawkish/rising-yield tone can pressure gold';

  // News is a pre-market bias layer, never an order authorization layer.
  let decision='IGNORE';
  let tradeBias='NEUTRAL';
  let entryBlocked=true;
  if(impact==='HIGH'&&bias==='BULLISH'){
    decision='BUY_BIAS_WAIT_ICT';
    tradeBias='BULLISH';
  }else if(impact==='HIGH'&&bias==='BEARISH'){
    decision='SELL_BIAS_WAIT_ICT';
    tradeBias='BEARISH';
  }else if(impact==='HIGH'){
    decision='WAIT_NO_TRADE';
  }else if(impact==='MEDIUM'){
    decision='WAIT_NO_ENTRY';
  }

  return {
    ...item,
    relevant,
    bias,
    tradeBias,
    confidence,
    impact,
    decision,
    entryBlocked,
    reason
  };
}

async function fetchFeed(feed){
  const r=await fetch(feed.url,{headers:{'user-agent':'V-TRADE-AI-Macro-Radar/2.0'},cache:'no-store'});
  if(!r.ok)throw new Error(feed.name+' HTTP '+r.status);
  const xml=await r.text();
  return parseFeed(xml,feed.name).map(x=>({...x,official:feed.official}));
}
async function getNews(limit=8){
  const all=[];
  for(const feed of FEEDS){
    try{all.push(...await fetchFeed(feed));}
    catch(e){console.warn('[V-TRADE NEWS] '+e.message);}
  }
  const seen=new Set();
  const fresh=all.filter(x=>{
    const k=(x.link||x.title).toLowerCase();
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
  fresh.sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0));
  // Keep all impact levels so Telegram can explicitly show HIGH/MEDIUM/LOW behavior.
  return fresh.map(scoreNews).slice(0,limit);
}

function impactIcon(impact){return impact==='HIGH'?'🔴':impact==='MEDIUM'?'🟠':'🟢';}
function decisionText(n){
  if(n.decision==='BUY_BIAS_WAIT_ICT')return 'BUY BIAS — WAIT ICT CONFIRMATION';
  if(n.decision==='SELL_BIAS_WAIT_ICT')return 'SELL BIAS — WAIT ICT CONFIRMATION';
  if(n.decision==='WAIT_NO_TRADE')return 'WAIT — NO TRADE';
  if(n.decision==='WAIT_NO_ENTRY')return 'WAIT — NO ENTRY';
  return 'IGNORE — NO TRADE SIGNAL';
}

function formatNews(items){
  if(!items.length)return '📰 *V TRADE AI — MACRO RADAR*\\n\\nNo macro news found.';
  const lines=['📰 *V TRADE AI — PRE-MARKET MACRO RADAR*',''];
  for(const n of items.slice(0,5)){
    lines.push(impactIcon(n.impact)+' *'+n.impact+'* '+n.title);
    lines.push('📊 Gold Bias: *'+n.bias+'* | Confidence: *'+n.confidence+'/100*');
    lines.push('🎯 AI Decision: *'+decisionText(n)+'*');
    lines.push('🔒 Entry Authorization: *BLOCKED*');
    lines.push('💡 '+n.reason);
    lines.push('');
  }
  lines.push('⚠️ News only sets pre-market bias. ICT/CORE gates control entries.');
  return lines.join('\\n');
}

module.exports={FEEDS,getNews,formatNews,scoreNews,decisionText};

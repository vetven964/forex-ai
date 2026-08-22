/* V-TRADE AI — Market News / Macro Radar V1
 * Read-only macro/news intelligence for Telegram.
 * Sources: official Federal Reserve RSS + market-news RSS aggregation.
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
    const pubDate=firstTag(b,'pubDate')||firstTag(b,'published')||firstTag(b,'updated');
    let link=firstTag(b,'link');
    const href=b.match(/<link[^>]+href=["']([^"']+)["']/i); if(!link&&href)link=href[1];
    if(title)out.push({title,pubDate,link:strip(link),source});
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
  const impact=Math.abs(score)>=3||/fomc|rate\s+(decision|hike|cut)|cpi|nfp|nonfarm/i.test(text)?'HIGH':relevant?'MEDIUM':'LOW';
  let reason='Mixed/unclear macro signal';
  if(score>0)reason='Dovish/risk-off tone can support gold';
  if(score<0)reason='Hawkish/rising-yield tone can pressure gold';
  return {...item,relevant,bias,confidence,impact,reason};
}

async function fetchFeed(feed){
  const r=await fetch(feed.url,{headers:{'user-agent':'V-TRADE-AI-Macro-Radar/1.0'},cache:'no-store'});
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
  const fresh=all.filter(x=>{const k=(x.link||x.title).toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  fresh.sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0));
  return fresh.map(scoreNews).filter(x=>x.relevant||x.impact==='HIGH').slice(0,limit);
}

function formatNews(items){
  if(!items.length)return '📰 *V TRADE AI — MACRO RADAR*\\n\\nNo high-impact macro news found.';
  const lines=['📰 *V TRADE AI — MACRO RADAR*',''];
  for(const n of items.slice(0,5)){
    lines.push((n.impact==='HIGH'?'🔴':n.impact==='MEDIUM'?'🟠':'🟢')+' *'+n.impact+'* '+n.title);
    lines.push('📊 Gold Bias: *'+n.bias+'* | Confidence: *'+n.confidence+'/100*');
    lines.push('💡 '+n.reason);
    lines.push('');
  }
  lines.push('⚠️ News is context only — ICT/CORE gates still control entries.');
  return lines.join('\\n');
}

module.exports={FEEDS,getNews,formatNews,scoreNews};

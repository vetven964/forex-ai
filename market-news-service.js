/* V-TRADE AI — Market News / Macro Radar V3
 * Read-only macro/news intelligence for Telegram.
 * HIGH impact can create BUY/SELL BIAS only.
 * MEDIUM = WAIT. LOW = IGNORE.
 * Telegram presentation is Khmer-first.
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

  let reason='សញ្ញាព័ត៌មានមិនទាន់ច្បាស់លាស់';
  if(score>0)reason='ព័ត៌មានបែប Dovish / Risk-off អាចជួយគាំទ្រតម្លៃមាស';
  if(score<0)reason='ព័ត៌មានបែប Hawkish / អត្រាការប្រាក់ឬ Yield ខ្ពស់ អាចដាក់សម្ពាធលើមាស';

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

  return {...item,relevant,bias,tradeBias,confidence,impact,decision,entryBlocked,reason};
}

async function fetchFeed(feed){
  const r=await fetch(feed.url,{headers:{'user-agent':'V-TRADE-AI-Macro-Radar/3.0'},cache:'no-store'});
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
  return fresh.map(scoreNews).slice(0,limit);
}

function impactLabel(impact){
  if(impact==='HIGH')return '🔴 *ខ្ពស់ (HIGH)*';
  if(impact==='MEDIUM')return '🟠 *មធ្យម (MEDIUM)*';
  return '🟢 *ទាប (LOW)*';
}
function decisionText(n){
  if(n.decision==='BUY_BIAS_WAIT_ICT')return '🟢 ទិស BUY — រង់ចាំ ICT បញ្ជាក់';
  if(n.decision==='SELL_BIAS_WAIT_ICT')return '🔴 ទិស SELL — រង់ចាំ ICT បញ្ជាក់';
  if(n.decision==='WAIT_NO_TRADE')return '🟡 រង់ចាំ — មិនចូលផ្សារ';
  if(n.decision==='WAIT_NO_ENTRY')return '🟡 រង់ចាំ — មិនទាន់ចូល Entry';
  return '⚪ មិនយកជាសញ្ញា — មិនចូលផ្សារ';
}
function biasText(bias){
  if(bias==='BULLISH')return 'BULLISH — ទិសឡើង';
  if(bias==='BEARISH')return 'BEARISH — ទិសចុះ';
  return 'NEUTRAL — មិនទាន់មានទិស';
}

function formatNews(items){
  if(!items.length)return '📰 *V TRADE AI — ព័ត៌មានសេដ្ឋកិច្ច\\n\\nមិនមានព័ត៌មានសំខាន់ថ្មីទេ។';
  const lines=['📰 *V TRADE AI — ព័ត៌មានសេដ្ឋកិច្ចមុនផ្សារ*',''];
  for(const n of items.slice(0,5)){
    lines.push(impactLabel(n.impact));
    lines.push('📰 '+n.title);
    lines.push('📊 ទិសមាស: *'+biasText(n.bias)+'*');
    lines.push('🧠 កម្រិតជឿជាក់: *'+n.confidence+'/100*');
    lines.push('🎯 ការសម្រេចរបស់ AI: *'+decisionText(n)+'*');
    lines.push('🔒 អនុញ្ញាតចូលផ្សារ: *មិនទាន់អនុញ្ញាត*');
    lines.push('💡 '+n.reason);
    lines.push('');
  }
  lines.push('⚠️ ព័ត៌មានប្រើសម្រាប់កំណត់ទិសមុនផ្សារ។ ICT/CORE gates ជាអ្នកសម្រេច Entry ចុងក្រោយ។');
  return lines.join('\\n');
}

module.exports={FEEDS,getNews,formatNews,scoreNews,decisionText,impactLabel,biasText};

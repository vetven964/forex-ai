// V-TRADE AI — Logic V4 execution target builder
'use strict';
function n(v){return Number.isFinite(Number(v))?Number(v):null;}
function applyExecution(a){
  if(!a||a.tradeAuthorized!==true||a.entryMode!=='RANGE_EDGE_EARLY') return a;
  const r=a.marketRegime||{}; const price=n(a.price??a.livePrice);
  const hist=a.historicalPatternScan||{}; const side=String(a.signal||'').toUpperCase();
  if(!Number.isFinite(price)||!Number.isFinite(r.rangeHigh)||!Number.isFinite(r.rangeLow)) return a;
  const width=r.rangeHigh-r.rangeLow; const atr=Number(r.atr)||width*.15; const buffer=Math.max(atr*.35,width*.08);
  let entry=price,sl,tp1,tp2,tp3;
  if(side==='BUY'){
    sl=r.rangeLow-buffer;
    tp1=Math.min(r.rangeHigh,Math.max(price+width*.35,price+(Number(hist.expectedMove)||width*.25)*.5));
    tp2=r.rangeHigh;
    tp3=r.rangeHigh+Math.max(atr,width*.10);
  }else if(side==='SELL'){
    sl=r.rangeHigh+buffer;
    tp1=Math.max(r.rangeLow,Math.min(price-width*.35,price-(Number(hist.expectedMove)||width*.25)*.5));
    tp2=r.rangeLow;
    tp3=r.rangeLow-Math.max(atr,width*.10);
  }else return a;
  const risk=Math.abs(entry-sl), reward=Math.abs(tp1-entry), rr=risk>0?reward/risk:0;
  if(!Number.isFinite(rr)||rr<1.3){a.tradeAuthorized=false;a.confirmations={...(a.confirmations||{}),allGatesPassed:false};a.status='WAIT — RANGE EDGE RISK TOO LOW';return a;}
  return {...a,entry:Number(entry.toFixed(2)),stopLoss:Number(sl.toFixed(2)),takeProfit:[Number(tp1.toFixed(2)),Number(tp2.toFixed(2)),Number(tp3.toFixed(2))],riskReward:Number(rr.toFixed(2)),bestOpportunity:{...(a.bestOpportunity||{}),riskReward:Number(rr.toFixed(2)),entry:Number(entry.toFixed(2)),stopLoss:Number(sl.toFixed(2)),takeProfit:[Number(tp1.toFixed(2)),Number(tp2.toFixed(2)),Number(tp3.toFixed(2))]},workflow:{...(a.workflow||{}),entryAuthorization:true,riskReward:Number(rr.toFixed(2)),targetsReady:true}};
}
module.exports={applyExecution};

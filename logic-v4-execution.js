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

  const risk=Math.abs(entry-sl);
  const reward=Math.abs(tp1-entry);
  const rr=risk>0?reward/risk:0;
  const minTp1=side==='BUY'?entry+risk:entry-risk;
  const minTp2=side==='BUY'?entry+risk*1.5:entry-risk*1.5;
  const minTp3=side==='BUY'?entry+risk*2:entry-risk*2;
  const ordered=side==='BUY'
    ? sl<entry && entry<tp1 && tp1<tp2 && tp2<tp3
    : sl>entry && entry>tp1 && tp1>tp2 && tp2>tp3;
  const targetSpacing=side==='BUY'
    ? tp1>=minTp1 && tp2>=minTp2 && tp3>=minTp3
    : tp1<=minTp1 && tp2<=minTp2 && tp3<=minTp3;

  if(!Number.isFinite(rr)||rr<1.3||!ordered||!targetSpacing){
    a.tradeAuthorized=false;
    a.confirmations={...(a.confirmations||{}),allGatesPassed:false};
    a.status='WAIT — INVALID TARGET GEOMETRY / R:R';
    a.executionGuard={valid:false,reason:'TARGET_SPACING_OR_RR',risk:Number(risk.toFixed(2)),rr:Number(rr.toFixed(2))};
    return a;
  }
  return {...a,entry:Number(entry.toFixed(2)),stopLoss:Number(sl.toFixed(2)),takeProfit:[Number(tp1.toFixed(2)),Number(tp2.toFixed(2)),Number(tp3.toFixed(2))],riskReward:Number(rr.toFixed(2)),bestOpportunity:{...(a.bestOpportunity||{}),riskReward:Number(rr.toFixed(2)),entry:Number(entry.toFixed(2)),stopLoss:Number(sl.toFixed(2)),takeProfit:[Number(tp1.toFixed(2)),Number(tp2.toFixed(2)),Number(tp3.toFixed(2))]},workflow:{...(a.workflow||{}),entryAuthorization:true,riskReward:Number(rr.toFixed(2)),targetsReady:true},executionGuard:{valid:true,risk:Number(risk.toFixed(2)),minRR:1.3,minTargetR:[1,1.5,2]}};
}
module.exports={applyExecution};

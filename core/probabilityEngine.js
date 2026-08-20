const { scanHistorical } = require('./historicalProbabilityEngine');

function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,Number(n)||0)); }

function analyzeProbability({ candlesByTf={}, current={} }={}) {
  const tfWeights={M5:0.40,M15:0.30,H1:0.20,H4:0.10};
  let histUp=0,histDown=0,histRange=0,totalWeight=0;
  const historical={};
  for(const [tf,w] of Object.entries(tfWeights)) {
    const r=scanHistorical(candlesByTf[tf],{limit:200,horizons:[1,3,6,12]});
    historical[tf]=r;
    if(!r.available) continue;
    histUp += r.probability.up*w;
    histDown += r.probability.down*w;
    histRange += r.probability.range*w;
    totalWeight += w;
  }
  if(totalWeight>0){histUp/=totalWeight;histDown/=totalWeight;histRange/=totalWeight;}

  const currentUp=clamp(current.up,0,100);
  const currentDown=clamp(current.down,0,100);
  const currentRange=clamp(current.range,0,100);
  const currentWeight=0.65;
  const historicalWeight=totalWeight>0?0.35:0;
  const denom=historicalWeight+currentWeight;
  const up=(histUp*historicalWeight+currentUp*currentWeight)/denom;
  const down=(histDown*historicalWeight+currentDown*currentWeight)/denom;
  const range=(histRange*historicalWeight+currentRange*currentWeight)/denom;
  const direction=up>down && up>range ? 'BULLISH' : down>up && down>range ? 'BEARISH' : 'RANGE';
  const confidence=Math.round(Math.max(up,down,range));
  return {
    up:Math.round(up),down:Math.round(down),range:Math.round(range),direction,confidence,
    historicalWeight,currentWeight,historical
  };
}

module.exports={ analyzeProbability };

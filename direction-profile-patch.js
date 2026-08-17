// V-TRADE AI direction profile patch
// H1 + M15 define direction; M5 is the entry trigger.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverPath = path.resolve(__dirname, 'server.js');

fs.readFileSync = function(file, options) {
  const resolved = path.resolve(String(file));
  let source = originalReadFileSync.apply(this, arguments);
  if (resolved !== serverPath) return source;
  const encoding = typeof options === 'string' ? options : options?.encoding;
  if (!encoding || encoding === 'buffer') return source;
  source = String(source);

  source = source.replace("const CORE_MTF_TFS = ['H4','H1','M15'];", "const CORE_MTF_TFS = ['H1','M15','M5'];");

  const oldBiasBlock = `const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.structure?.bias || 'UNAVAILABLE');\n  const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));\n  const coreBull = coreBiases.filter(x=>x==='BULLISH').length;\n  const coreBear = coreBiases.filter(x=>x==='BEARISH').length;`;
  const newBiasBlock = `const coreBiases = CORE_MTF_TFS.map(tf => tfs[tf]?.structure?.bias || 'UNAVAILABLE');\n  const fullBiases = FULL_MTF_TFS.map(tf => ({tf, bias:tfs[tf]?.structure?.bias || 'UNAVAILABLE'}));\n  // Direction profile: H1 defines direction, M15 confirms it, M5 triggers entry.\n  const h1Bias = tfs.H1?.structure?.bias || 'UNAVAILABLE';\n  const m15Bias = tfs.M15?.structure?.bias || 'UNAVAILABLE';\n  const m5Bias = tfs.M5?.structure?.bias || 'UNAVAILABLE';\n  const directionAligned = (h1Bias === 'BULLISH' && m15Bias === 'BULLISH') || (h1Bias === 'BEARISH' && m15Bias === 'BEARISH');\n  const directionBias = directionAligned ? h1Bias : 'NEUTRAL';\n  const coreBull = [h1Bias,m15Bias].filter(x=>x==='BULLISH').length;\n  const coreBear = [h1Bias,m15Bias].filter(x=>x==='BEARISH').length;`;
  source = source.replace(oldBiasBlock, newBiasBlock);
  source = source.replace("const macroBias=coreBull>coreBear?'BULLISH':coreBear>coreBull?'BEARISH':'NEUTRAL';", "const macroBias=directionBias;");
  source = source.replace("const biasOk=(side==='BULLISH'&&coreBull>=MIN_MTF_ALIGNMENT)||(side==='BEARISH'&&coreBear>=MIN_MTF_ALIGNMENT),", "const biasOk=(side==='BULLISH'&&h1Bias==='BULLISH'&&m15Bias==='BULLISH')||(side==='BEARISH'&&h1Bias==='BEARISH'&&m15Bias==='BEARISH'),");
  source = source.replace("else if(side==='BULLISH'&&coreBull>=MIN_MTF_ALIGNMENT) status='WAIT — BULLISH BIAS, NO ENTRY'; else if(side==='BEARISH'&&coreBear>=MIN_MTF_ALIGNMENT) status='WAIT — BEARISH BIAS, NO ENTRY';", "else if(side==='BULLISH'&&h1Bias==='BULLISH'&&m15Bias==='BULLISH') status='WAIT — BULLISH BIAS, WAIT FOR M5 MSS/BOS'; else if(side==='BEARISH'&&h1Bias==='BEARISH'&&m15Bias==='BEARISH') status='WAIT — BEARISH BIAS, WAIT FOR M5 MSS/BOS';");
  source = source.replace("need 2/3 H1/M15/M5 agreement", "need H1 + M15 agreement; M5 is the entry trigger");
  source = source.replace("need 2/3 H4/H1/M15 agreement", "need H1 + M15 agreement; M5 is the entry trigger");
  source = source.replace("const mtfCount=Math.max(coreBull,coreBear);", "const mtfCount=directionAligned ? 2 : Math.max(coreBull,coreBear);");
  source = source.replace("const availableHtf=CORE_MTF_TFS.filter(tf=>Array.isArray({M5:m5,M15:m15,H1:h1,H4:h4}[tf]) && {M5:m5,M15:m15,H1:h1,H4:h4}[tf].length>=30).length;", "const availableHtf=CORE_MTF_TFS.filter(tf=>Array.isArray({M5:m5,M15:m15,H1:h1,H4:h4}[tf]) && {M5:m5,M15:m15,H1:h1,H4:h4}[tf].length>=30).length;");
  return Buffer.isBuffer(source) ? Buffer.from(source) : source;
};

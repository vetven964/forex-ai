/* V-TRADE AI — Pre-Market authoritative UI bridge V1
 * Must load before terminal-pre-market.js.
 * Redirects only the Pre-Market Candle-Open request to the immutable MT5 route.
 */
(function(){
  'use strict';
  if(window.__VTRADE_PREMARKET_AUTH_UI_V1__)return;
  window.__VTRADE_PREMARKET_AUTH_UI_V1__=true;
  function install(){
    const c=window.VTRADE_CONNECTION;
    if(!c||typeof c.fetch!=='function'||typeof c.api!=='function')return false;
    if(c.__vtradePreMarketAuthorityWrapped)return true;
    const originalFetch=c.fetch.bind(c), originalApi=c.api.bind(c);
    c.fetch=function(url,options){
      const u=String(url||'');
      if(u.includes('/api/pre-market/candle-open')){
        const target=originalApi('/api/pre-market/mt5-authoritative');
        console.info('[V-TRADE PRE-MARKET AUTH UI] candle-open redirected to MT5 authoritative route');
        return originalFetch(target,options);
      }
      return originalFetch(url,options);
    };
    c.__vtradePreMarketAuthorityWrapped=true;
    return true;
  }
  if(!install()){
    let tries=0;const timer=setInterval(()=>{if(install()||++tries>=40)clearInterval(timer);},250);
  }
})();

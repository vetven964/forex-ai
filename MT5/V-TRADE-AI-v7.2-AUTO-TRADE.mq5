//+------------------------------------------------------------------+
//| V-TRADE AI v7.2 XAUUSD AUTO-TRADE                               |
//| Server analysis + local MT5 execution                            |
//| IMPORTANT: test on Cent/Demo first. No profit guarantee.         |
//+------------------------------------------------------------------+
#property strict
#property version   "7.2"
#property description "V-TRADE AI server signal -> MT5 execution with profit-lock trailing."

#include <Trade/Trade.mqh>
CTrade trade;

input string InpServerBaseUrl = "https://YOUR-RENDER-SERVICE.onrender.com";
input string InpBridgeKey     = "CHANGE_ME";
input string InpSymbol        = "XAUUSD";
input bool   InpAutoTrade     = false;
input double InpLot           = 0.01;
input double InpMaxLot        = 0.02;
input int    InpMagic         = 572007;
input int    InpPollSeconds   = 3;
input double InpTrailTrigger  = 2.00;
input double InpLockProfit    = 0.50;
input int    InpTrailPoints   = 100;
input bool   InpUseTP1        = true;

datetime g_lastPoll = 0;
string   g_lastCommandId = "";
bool     g_serverEnabled = false;

string HeaderKey(){ return "x-vtrade-key: " + InpBridgeKey + "\r\n"; }

bool ExtractString(const string json,const string key,string &out){
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' '||StringGetCharacter(json,p)=='\t'))p++;
   if(p>=StringLen(json)||StringGetCharacter(json,p)!='\"')return false; p++;
   int e=StringFind(json,"\"",p); if(e<0)return false; out=StringSubstr(json,p,e-p); return true;
}

bool ExtractNumber(const string json,const string key,double &out){
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json) && StringGetCharacter(json,p)==' ')p++;
   int e=p; while(e<StringLen(json)){ ushort c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9')||c=='-'||c=='+'||c=='.'||c=='e'||c=='E')e++; else break; }
   string v=StringSubstr(json,p,e-p); out=StringToDouble(v); return v!="" && MathIsValidNumber(out);
}

bool ExtractBool(const string json,const string key,bool &out){
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json)&&StringGetCharacter(json,p)==' ')p++;
   string v=StringSubstr(json,p,5); out=(StringFind(v,"true")==0); return true;
}

string ExtractFirstTP(const string json){
   int p=StringFind(json,"\"takeProfit\""); if(p<0)return ""; p=StringFind(json,"[",p); if(p<0)return ""; p++;
   while(p<StringLen(json)&&(StringGetCharacter(json,p)==' '||StringGetCharacter(json,p)=='\t'))p++;
   int e=p; while(e<StringLen(json)){ushort c=StringGetCharacter(json,e); if((c>='0'&&c<='9')||c=='-'||c=='+'||c=='.'||c=='e'||c=='E')e++;else break;}
   return StringSubstr(json,p,e-p);
}

bool HttpGet(const string url,string &body){
   char data[],result[]; string headers=""; ResetLastError();
   int code=WebRequest("GET",url,"",7000,data,0,result,headers);
   if(code!=200){Print("V-TRADE WebRequest failed HTTP=",code," err=",GetLastError());return false;}
   body=CharArrayToString(result,0,-1,CP_UTF8); return true;
}

bool HttpPost(const string url,const string payload){
   char data[],result[]; string headers=""; StringToCharArray(payload,data,0,WHOLE_ARRAY,CP_UTF8); ResetLastError();
   int code=WebRequest("POST",url,"Content-Type: application/json\r\n"+HeaderKey(),7000,data,ArraySize(data)-1,result,headers);
   if(code<200||code>=300){Print("V-TRADE status POST failed HTTP=",code," err=",GetLastError());return false;} return true;
}

int CountOurPositions(){
   int count=0; for(int i=PositionsTotal()-1;i>=0;i--){ulong ticket=PositionGetTicket(i); if(ticket==0||!PositionSelectByTicket(ticket))continue;
      if(PositionGetString(POSITION_SYMBOL)==InpSymbol && PositionGetInteger(POSITION_MAGIC)==InpMagic)count++;} return count;
}

double NormalizeVolume(double volume){
   double minv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN), maxv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX), step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
   double v=MathMax(minv,MathMin(maxv,MathMin(volume,InpMaxLot))); if(step>0)v=MathFloor(v/step+1e-9)*step; return NormalizeDouble(v,2);
}

void TrailOurPositions(){
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT); int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS); if(point<=0)return;
   for(int i=PositionsTotal()-1;i>=0;i--){
      ulong ticket=PositionGetTicket(i); if(ticket==0||!PositionSelectByTicket(ticket))continue;
      if(PositionGetString(POSITION_SYMBOL)!=InpSymbol||PositionGetInteger(POSITION_MAGIC)!=InpMagic)continue;
      double profit=PositionGetDouble(POSITION_PROFIT); if(profit<InpTrailTrigger)continue;
      long type=PositionGetInteger(POSITION_TYPE); double open=PositionGetDouble(POSITION_PRICE_OPEN), sl=PositionGetDouble(POSITION_SL), tp=PositionGetDouble(POSITION_TP);
      double bid=SymbolInfoDouble(InpSymbol,SYMBOL_BID), ask=SymbolInfoDouble(InpSymbol,SYMBOL_ASK), desired=0;
      double tickSize=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE), tickValue=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_VALUE), vol=PositionGetDouble(POSITION_VOLUME);
      double lockOffset=(tickSize>0&&tickValue>0&&vol>0)?(InpLockProfit/(tickValue*vol))*tickSize:0;
      if(type==POSITION_TYPE_BUY){ desired=MathMax(bid-InpTrailPoints*point,open+lockOffset); desired=NormalizeDouble(desired,digits); if(sl==0||desired>sl+point)trade.PositionModify(ticket,desired,tp); }
      else if(type==POSITION_TYPE_SELL){ desired=MathMin(ask+InpTrailPoints*point,open-lockOffset); desired=NormalizeDouble(desired,digits); if(sl==0||desired<sl-point)trade.PositionModify(ticket,desired,tp); }
   }
}

void PollSignal(){
   if(!InpAutoTrade)return; string body=""; if(!HttpGet(InpServerBaseUrl+"/api/v7/mt5/auto-signal",body))return;
   bool enabled=false; ExtractBool(body,"enabled",enabled); g_serverEnabled=enabled; if(!enabled)return;
   string action="",side="",id=""; ExtractString(body,"action",action); if(action!="OPEN")return; ExtractString(body,"side",side); ExtractString(body,"id",id);
   if(id==""||id==g_lastCommandId||CountOurPositions()>=1)return;
   double sl=0,lot=0,tp1=0; ExtractNumber(body,"stopLoss",sl); ExtractNumber(body,"lot",lot); string t=ExtractFirstTP(body); if(t!="")tp1=StringToDouble(t);
   if((side!="BUY"&&side!="SELL")||sl<=0)return;
   double volume=MathMin(NormalizeVolume(lot),NormalizeVolume(InpMaxLot)); if(volume<=0)return;
   trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(50); bool ok=false;
   if(side=="BUY")ok=trade.Buy(volume,InpSymbol,0.0,sl,(InpUseTP1?tp1:0.0),"V-TRADE AI "+id); else ok=trade.Sell(volume,InpSymbol,0.0,sl,(InpUseTP1?tp1:0.0),"V-TRADE AI "+id);
   if(ok){g_lastCommandId=id;Print("V-TRADE AUTO TRADE OPENED ",side," lot=",DoubleToString(volume,2));}
}

void SendStatus(){
   static datetime last=0; if(TimeCurrent()-last<10)return; last=TimeCurrent();
   string payload=StringFormat("{\"openPositions\":%d,\"lastExecution\":\"%s\"}",CountOurPositions(),g_lastCommandId); HttpPost(InpServerBaseUrl+"/api/v7/mt5/auto-status",payload);
}

int OnInit(){ SymbolSelect(InpSymbol,true); EventSetTimer(MathMax(1,InpPollSeconds)); Print("V-TRADE AI v7.2 Auto-Trade EA initialized. AutoTrade=",InpAutoTrade); return(INIT_SUCCEEDED); }
void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){TrailOurPositions();PollSignal();SendStatus();}

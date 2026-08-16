//+------------------------------------------------------------------+
//| V-TRADE AI v7.3 XAUUSD MANUAL SIGNAL + SMART TRAILING                               |
//| Server analysis + Telegram signal + optional local execution                            |
//| IMPORTANT: test on Cent/Demo first. No profit guarantee.         |
//+------------------------------------------------------------------+
#property strict
#property version   "7.3.0"
#property description "V-TRADE AI server signal -> MT5 execution with profit-lock trailing."

#include <Trade/Trade.mqh>
CTrade trade;

input string InpServerBaseUrl = "https://YOUR-RENDER-SERVICE.onrender.com";
input string InpBridgeKey     = "CHANGE_ME";
input string InpSymbol        = "XAUUSD";
input bool   InpAutoTrade     = false; // KEEP FALSE for manual-entry mode
input double InpLot           = 0.01;
input double InpMaxLot        = 0.10;
input bool   InpManageManualPositions = true; // manage manually opened XAUUSD positions (magic=0)
input int    InpMagic         = 572007;
input int    InpPollSeconds   = 3;
input double InpTrailTrigger  = 2.00; // +2.00 in MT5 account currency (USC on cent accounts)
input double InpLockProfit    = 0.00; // retained for compatibility; step trailing locks previous step
input int    InpTrailPoints   = 100; // fallback distance; step mode is profit-based
input bool   InpUseTP1        = true;

string g_lastCommandId = "";
bool   g_serverEnabled = false;

string HeaderKey(){ return "x-vtrade-key: " + InpBridgeKey + "\r\n"; }

bool ExtractString(const string json,const string key,string &out)
{
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' '||StringGetCharacter(json,p)=='\t'))p++;
   if(p>=StringLen(json)||StringGetCharacter(json,p)!='\"')return false; p++;
   int e=StringFind(json,"\"",p); if(e<0)return false; out=StringSubstr(json,p,e-p); return true;
}

bool ExtractNumber(const string json,const string key,double &out)
{
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' '||StringGetCharacter(json,p)=='\t'))p++;
   int e=p;
   while(e<StringLen(json))
   {
      ushort c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9')||c=='-'||c=='+'||c=='.'||c=='e'||c=='E')e++; else break;
   }
   string v=StringSubstr(json,p,e-p); out=StringToDouble(v); return v!="" && MathIsValidNumber(out);
}

bool ExtractBool(const string json,const string key,bool &out)
{
   string needle="\""+key+"\""; int p=StringFind(json,needle); if(p<0)return false;
   p=StringFind(json,":",p); if(p<0)return false; p++;
   while(p<StringLen(json)&&StringGetCharacter(json,p)==' ')p++;
   string v=StringSubstr(json,p,5); out=(StringFind(v,"true")==0); return true;
}

string ExtractFirstTP(const string json)
{
   int p=StringFind(json,"\"takeProfit\""); if(p<0)return "";
   p=StringFind(json,"[",p); if(p<0)return ""; p++;
   while(p<StringLen(json)&&(StringGetCharacter(json,p)==' '||StringGetCharacter(json,p)=='\t'))p++;
   int e=p;
   while(e<StringLen(json))
   {
      ushort c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9')||c=='-'||c=='+'||c=='.'||c=='e'||c=='E')e++; else break;
   }
   return StringSubstr(json,p,e-p);
}

// MQL5 WebRequest overload used here has 7 parameters:
// method, url, headers, timeout, data[], result[], result_headers.
bool HttpGet(const string url,string &body)
{
   char data[],result[]; string result_headers=""; string headers=HeaderKey();
   ResetLastError();
   int code=WebRequest("GET",url,headers,7000,data,result,result_headers);
   if(code!=200)
   {
      Print("V-TRADE WebRequest GET failed HTTP=",code," err=",GetLastError());
      return false;
   }
   body=CharArrayToString(result,0,-1,CP_UTF8); return true;
}

bool HttpPost(const string url,const string payload)
{
   char data[],result[]; string result_headers="";
   string headers="Content-Type: application/json\r\n"+HeaderKey();
   StringToCharArray(payload,data,0,WHOLE_ARRAY,CP_UTF8);
   // Remove the terminating zero byte from the HTTP body.
   int data_size=ArraySize(data);
   if(data_size>0 && data[data_size-1]==0) data_size--;
   ResetLastError();
   int code=WebRequest("POST",url,headers,7000,data,result,result_headers);
   if(code<200||code>=300)
   {
      Print("V-TRADE WebRequest POST failed HTTP=",code," err=",GetLastError());
      return false;
   }
   return true;
}

int CountOurPositions()
{
   int count=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i); if(ticket==0||!PositionSelectByTicket(ticket))continue;
      if(PositionGetString(POSITION_SYMBOL)==InpSymbol && PositionGetInteger(POSITION_MAGIC)==InpMagic)count++;
   }
   return count;
}

double NormalizeVolume(double volume)
{
   double minv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN);
   double maxv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
   double v=MathMax(minv,MathMin(maxv,MathMin(volume,InpMaxLot)));
   if(step>0)v=MathFloor(v/step+1e-9)*step;
   return NormalizeDouble(v,2);
}

double MoneyToPriceDistance(double money,double volume)
{
   double tickSize=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_VALUE);
   if(tickSize<=0 || tickValue<=0 || volume<=0) return 0;
   return (money/(tickValue*volume))*tickSize;
}

// Step trailing:
// +2.00 -> protect 0.00
// +4.00 -> protect +2.00
// +6.00 -> protect +4.00 ...
// BUY moves SL upward; SELL moves SL downward.
// The SL never moves backwards.
void TrailOurPositions()
{
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
   int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   double step=MathMax(0.01,InpTrailTrigger);
   if(point<=0)return;

   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || !PositionSelectByTicket(ticket)) continue;

      if(PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;

      long magic=PositionGetInteger(POSITION_MAGIC);
      bool isOurPosition=(magic==InpMagic);
      bool isManualPosition=(InpManageManualPositions && magic==0);

      if(!isOurPosition && !isManualPosition) continue;

      double profit=PositionGetDouble(POSITION_PROFIT);
      if(profit < step) continue;

      long type=PositionGetInteger(POSITION_TYPE);
      double sl=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      double bid=SymbolInfoDouble(InpSymbol,SYMBOL_BID);
      double ask=SymbolInfoDouble(InpSymbol,SYMBOL_ASK);
      double vol=PositionGetDouble(POSITION_VOLUME);
      double open=PositionGetDouble(POSITION_PRICE_OPEN);

      // Lock the previous +2.00 step.
      double protectedProfit=MathMax(0.0,MathFloor((profit/step)+1e-9)-1.0)*step;
      double lockDistance=MoneyToPriceDistance(protectedProfit,vol);
      if(lockDistance<0) continue;

      double desired=0;
      if(type==POSITION_TYPE_BUY)
      {
         desired=NormalizeDouble(open+lockDistance,digits);
         // Never place a BUY SL above current Bid or below broker stop distance.
         double stopLevel=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
         desired=MathMin(desired,bid-stopLevel);
         desired=NormalizeDouble(desired,digits);
         if(desired>0 && (sl==0 || desired>sl+point))
         {
            if(trade.PositionModify(ticket,desired,tp))
               Print("V-TRADE STEP TRAIL BUY ticket=",ticket,
                     " profit=",DoubleToString(profit,2),
                     " protected=",DoubleToString(protectedProfit,2),
                     " SL=",DoubleToString(desired,digits));
         }
      }
      else if(type==POSITION_TYPE_SELL)
      {
         desired=NormalizeDouble(open-lockDistance,digits);
         // Never place a SELL SL below current Ask or inside broker stop distance.
         double stopLevel=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
         desired=MathMax(desired,ask+stopLevel);
         desired=NormalizeDouble(desired,digits);
         if(desired>0 && (sl==0 || desired<sl-point))
         {
            if(trade.PositionModify(ticket,desired,tp))
               Print("V-TRADE STEP TRAIL SELL ticket=",ticket,
                     " profit=",DoubleToString(profit,2),
                     " protected=",DoubleToString(protectedProfit,2),
                     " SL=",DoubleToString(desired,digits));
         }
      }
   }
}

void PollSignal()
{
   if(!InpAutoTrade)return;

   string body="";
   if(!HttpGet(InpServerBaseUrl+"/api/v7/mt5/auto-signal",body))return;

   bool enabled=false;
   ExtractBool(body,"enabled",enabled); g_serverEnabled=enabled; if(!enabled)return;

   string action="",side="",id="";
   ExtractString(body,"action",action);
   if(action!="OPEN")return;
   ExtractString(body,"side",side);
   ExtractString(body,"id",id);
   if(id==""||id==g_lastCommandId||CountOurPositions()>=1)return;

   double sl=0,lot=0,tp1=0;
   ExtractNumber(body,"stopLoss",sl);
   ExtractNumber(body,"lot",lot);
   string t=ExtractFirstTP(body); if(t!="")tp1=StringToDouble(t);
   if((side!="BUY"&&side!="SELL")||sl<=0)return;

   double volume=MathMin(NormalizeVolume(lot),NormalizeVolume(InpMaxLot));
   if(volume<=0)return;

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(50);
   bool ok=false;
   if(side=="BUY")ok=trade.Buy(volume,InpSymbol,0.0,sl,(InpUseTP1?tp1:0.0),"V-TRADE AI "+id);
   else ok=trade.Sell(volume,InpSymbol,0.0,sl,(InpUseTP1?tp1:0.0),"V-TRADE AI "+id);

   if(ok)
   {
      g_lastCommandId=id;
      Print("V-TRADE AUTO TRADE OPENED ",side," lot=",DoubleToString(volume,2));
   }
}

void SendStatus()
{
   static datetime last=0;
   if(TimeCurrent()-last<10)return;
   last=TimeCurrent();
   string payload=StringFormat("{\"openPositions\":%d,\"lastExecution\":\"%s\"}",CountOurPositions(),g_lastCommandId);
   HttpPost(InpServerBaseUrl+"/api/v7/mt5/auto-status",payload);
}

int OnInit()
{
   if(!SymbolSelect(InpSymbol,true))Print("V-TRADE: unable to select symbol ",InpSymbol);
   EventSetTimer(MathMax(1,InpPollSeconds));
   Print("V-TRADE AI v7.2.1 Auto-Trade EA initialized. AutoTrade=",InpAutoTrade);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){TrailOurPositions();PollSignal();SendStatus();}

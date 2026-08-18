//+------------------------------------------------------------------+
//| V-TRADE AI v7.4 XAUUSD EXECUTION + SMART R TRAILING              |
//| Server analysis + optional local MT5 execution                   |
//| IMPORTANT: demo-test first. No profit/win-rate guarantee.       |
//+------------------------------------------------------------------+
#property strict
#property version   "7.400"
#property description "V-TRADE AI server signal -> MT5 execution with 1R BE + R-based trailing."

#include <Trade/Trade.mqh>
CTrade trade;

input string InpServerBaseUrl = "https://forexai-6xw6.onrender.com";
input string InpBridgeKey     = "CHANGE_ME";
input string InpSymbol        = "XAUUSD-STDc";
input bool   InpAutoTrade     = false; // KEEP FALSE until demo-tested
input double InpLot           = 0.01;
input double InpMaxLot        = 0.02;
input bool   InpManageManualPositions = true; // manage manual XAUUSD positions when an SL exists
input int    InpMagic         = 572007;
input int    InpPollSeconds   = 3;

// Risk-based protection:
// +1.0R -> move SL to Break Even
// +1.5R -> start trailing
// trailing distance = 1.0R behind current price
input double InpBreakEvenR    = 1.00;
input double InpTrailStartR   = 1.50;
input double InpTrailDistanceR = 1.00;
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
   int data_size=ArraySize(data);
   if(data_size>0 && data[data_size-1]==0) ArrayResize(data,data_size-1);
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

string RiskKey(const ulong ticket){ return "VTRADE_RISK_"+(string)ticket; }

bool GetInitialSLAndRisk(const ulong ticket,const long type,const double open,const double currentSL,double &initialSL,double &risk)
{
   string key=RiskKey(ticket);
   if(GlobalVariableCheck(key))
   {
      initialSL=GlobalVariableGet(key);
   }
   else
   {
      // A position must have a real initial SL before R-based protection is allowed.
      // This prevents the EA from inventing a risk value.
      if(currentSL<=0) return false;
      initialSL=currentSL;
      GlobalVariableSet(key,initialSL);
   }

   risk=MathAbs(open-initialSL);
   if(!MathIsValidNumber(risk) || risk<=0) return false;
   return true;
}

void TrailOurPositions()
{
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
   int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   if(point<=0)return;

   double beR=MathMax(0.25,InpBreakEvenR);
   double trailStart=MathMax(beR,InpTrailStartR);
   double trailDist=MathMax(0.25,InpTrailDistanceR);

   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL)!=InpSymbol) continue;

      long magic=PositionGetInteger(POSITION_MAGIC);
      bool isOurPosition=(magic==InpMagic);
      bool isManualPosition=(InpManageManualPositions && magic==0);
      if(!isOurPosition && !isManualPosition) continue;

      long type=PositionGetInteger(POSITION_TYPE);
      double sl=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      double open=PositionGetDouble(POSITION_PRICE_OPEN);
      double bid=SymbolInfoDouble(InpSymbol,SYMBOL_BID);
      double ask=SymbolInfoDouble(InpSymbol,SYMBOL_ASK);

      double initialSL=0,risk=0;
      if(!GetInitialSLAndRisk(ticket,type,open,sl,initialSL,risk)) continue;

      double favorable=0;
      if(type==POSITION_TYPE_BUY) favorable=bid-open;
      else if(type==POSITION_TYPE_SELL) favorable=open-ask;
      else continue;

      double rMultiple=favorable/risk;
      if(rMultiple < beR) continue;

      double desired=0;
      if(type==POSITION_TYPE_BUY)
      {
         if(rMultiple < trailStart)
         {
            desired=open; // Break-even at +1R
         }
         else
         {
            desired=bid-(risk*trailDist); // dynamic R-based trailing
            if(desired<open) desired=open; // never give back below BE
         }

         double stopLevel=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
         desired=MathMin(desired,bid-stopLevel);
         desired=NormalizeDouble(desired,digits);
         if(desired>0 && (sl==0 || desired>sl+point))
         {
            if(trade.PositionModify(ticket,desired,tp))
               Print("[TRAIL] BUY ticket=",ticket,
                     " R=",DoubleToString(rMultiple,2),
                     " initialSL=",DoubleToString(initialSL,digits),
                     " newSL=",DoubleToString(desired,digits));
         }
      }
      else if(type==POSITION_TYPE_SELL)
      {
         if(rMultiple < trailStart)
         {
            desired=open; // Break-even at +1R
         }
         else
         {
            desired=ask+(risk*trailDist); // dynamic R-based trailing
            if(desired>open) desired=open; // never give back above BE
         }

         double stopLevel=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
         desired=MathMax(desired,ask+stopLevel);
         desired=NormalizeDouble(desired,digits);
         if(desired>0 && (sl==0 || desired<sl-point))
         {
            if(trade.PositionModify(ticket,desired,tp))
               Print("[TRAIL] SELL ticket=",ticket,
                     " R=",DoubleToString(rMultiple,2),
                     " initialSL=",DoubleToString(initialSL,digits),
                     " newSL=",DoubleToString(desired,digits));
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
      Print("[EXECUTION] OPENED ",side," lot=",DoubleToString(volume,2)," SL=",DoubleToString(sl,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS)));
   }
}

void SendStatus()
{
   static datetime last=0;
   if(TimeCurrent()-last<10)return;
   last=TimeCurrent();
   string payload=StringFormat("{\"openPositions\":%d,\"lastExecution\":\"%s\",\"trailing\":\"R_BASED_BE_1R_START_1_5R\"}",CountOurPositions(),g_lastCommandId);
   HttpPost(InpServerBaseUrl+"/api/v7/mt5/auto-status",payload);
}

int OnInit()
{
   if(!SymbolSelect(InpSymbol,true))Print("V-TRADE: unable to select symbol ",InpSymbol);
   EventSetTimer(MathMax(1,InpPollSeconds));
   Print("V-TRADE AI v7.4 SMART TRAILING initialized | AutoTrade=",InpAutoTrade,
         " | BE=",DoubleToString(InpBreakEvenR,2),"R",
         " | TrailStart=",DoubleToString(InpTrailStartR,2),"R",
         " | TrailDistance=",DoubleToString(InpTrailDistanceR,2),"R");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){TrailOurPositions();PollSignal();SendStatus();}

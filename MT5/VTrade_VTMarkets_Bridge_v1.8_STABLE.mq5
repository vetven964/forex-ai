//+------------------------------------------------------------------+
//| VTrade VT Markets Bridge - MT5                                  |
//| Sends broker-native XAUUSD quotes + MTF candles to V-TRADE AI.  |
//+------------------------------------------------------------------+
#property strict
#property version   "1.801"
#property description "VT Markets MT5 -> V-TRADE AI bridge"

input string InpServerURL = "https://forexai-6xw6.onrender.com";
input string InpApiKey = ""; // MUST equal Render MT5_BRIDGE_API_KEY
input string InpSymbol = "XAUUSD-STDc"; // blank = use current chart symbol
input int    InpTimerSeconds = 5; // stable heartbeat; keep comfortably below server stale limit
input int    InpBarsM5 = 300;
input int    InpBarsM15 = 300;
input int    InpBarsH1 = 300;
input int    InpBarsH4 = 300;
input int    InpHttpTimeoutMs = 5000;

ulong g_sequence = 0;
uint g_last_ok_ms = 0;
int g_fail_count = 0;
string g_seq_gv = "";

string TrimSlash(string s){
   while(StringLen(s)>0 && StringGetCharacter(s,StringLen(s)-1)=='/') s=StringSubstr(s,0,StringLen(s)-1);
   return s;
}

string JsonEscape(string s){
   StringReplace(s,"\\","\\\\");
   StringReplace(s,"\"","\\\"");
   return s;
}

string TfName(ENUM_TIMEFRAMES tf){
   if(tf==PERIOD_M5) return "M5";
   if(tf==PERIOD_M15) return "M15";
   if(tf==PERIOD_H1) return "H1";
   if(tf==PERIOD_H4) return "H4";
   return "UNKNOWN";
}

string BridgeSymbol(){
   if(StringLen(InpSymbol)>0) return InpSymbol;
   return _Symbol;
}

string SequenceKey(){
   return "VTRADE_BRIDGE_SEQ_"+BridgeSymbol();
}

void LoadSequence(){
   g_seq_gv=SequenceKey();
   if(GlobalVariableCheck(g_seq_gv)){
      double v=GlobalVariableGet(g_seq_gv);
      if(v>=0) g_sequence=(ulong)v;
   }
}

void SaveSequence(){
   if(StringLen(g_seq_gv)==0) g_seq_gv=SequenceKey();
   GlobalVariableSet(g_seq_gv,(double)g_sequence);
}

string BuildBars(ENUM_TIMEFRAMES tf,int count){
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   int copied=CopyRates(BridgeSymbol(),tf,0,count,rates);
   if(copied<=0) return "[]";
   int symbol_digits=(int)SymbolInfoInteger(BridgeSymbol(),SYMBOL_DIGITS);
   string out="[";
   int start=copied-1;
   for(int i=start;i>=1;i--){
      if(i<start) out+=",";
      out+="{\"t\":"+(string)((long)rates[i].time*1000)+
           ",\"o\":"+DoubleToString(rates[i].open,symbol_digits)+
           ",\"h\":"+DoubleToString(rates[i].high,symbol_digits)+
           ",\"l\":"+DoubleToString(rates[i].low,symbol_digits)+
           ",\"c\":"+DoubleToString(rates[i].close,symbol_digits)+
           ",\"v\":"+(string)((long)rates[i].tick_volume)+"}";
   }
   out+="]";
   return out;
}

string BuildPayload(){
   MqlTick tick;
   if(!SymbolInfoTick(BridgeSymbol(),tick)) return "";
   int digits=(int)SymbolInfoInteger(BridgeSymbol(),SYMBOL_DIGITS);
   double point=SymbolInfoDouble(BridgeSymbol(),SYMBOL_POINT);
   double spread=(tick.ask-tick.bid);

   g_sequence++;

   long tick_ms=(long)tick.time_msc;
   if(tick_ms<=0) tick_ms=(long)TimeCurrent()*1000;

   string payload="{";
   payload+="\"symbol\":\"XAUUSD\",";
   payload+="\"brokerSymbol\":\""+JsonEscape(BridgeSymbol())+"\",";
   payload+="\"bid\":"+DoubleToString(tick.bid,digits)+",";
   payload+="\"ask\":"+DoubleToString(tick.ask,digits)+",";
   payload+="\"last\":"+DoubleToString(tick.last,digits)+",";
   payload+="\"spread\":"+DoubleToString(spread,digits)+",";
   payload+="\"digits\":"+(string)digits+",";
   payload+="\"point\":"+DoubleToString(point,digits)+",";
   payload+="\"tickTimeMs\":"+(string)tick_ms+",";
   payload+="\"bridgeTimeMs\":"+(string)((long)TimeLocal()*1000)+",";
   payload+="\"sequence\":"+(string)g_sequence+",";
   payload+="\"timeframes\":{";
   payload+="\"M5\":"+BuildBars(PERIOD_M5,InpBarsM5)+",";
   payload+="\"M15\":"+BuildBars(PERIOD_M15,InpBarsM15)+",";
   payload+="\"H1\":"+BuildBars(PERIOD_H1,InpBarsH1)+",";
   payload+="\"H4\":"+BuildBars(PERIOD_H4,InpBarsH4);
   payload+="}}";
   return payload;
}

void SendSnapshot(){
   string url=TrimSlash(InpServerURL)+"/api/v5/mt5/quote";
   if(StringLen(InpApiKey)==0){
      Print("V-TRADE Bridge v1.8 ERROR: InpApiKey is EMPTY. Set it to Render MT5_BRIDGE_API_KEY.");
      g_fail_count++;
      return;
   }

   string body=BuildPayload();
   if(body==""){
      Print("V-TRADE Bridge v1.8: snapshot build failed.");
      g_fail_count++;
      return;
   }

   char data[];
   StringToCharArray(body,data,0,StringLen(body),CP_UTF8);
   const int max_attempts=3;

   for(int attempt=1; attempt<=max_attempts; attempt++){
      char result[];
      string headers="Content-Type: application/json\r\nx-vtrade-key: "+InpApiKey+"\r\n";
      string result_headers;

      ResetLastError();
      ulong started=GetTickCount64();
      int code=WebRequest("POST",url,headers,InpHttpTimeoutMs,data,result,result_headers);
      ulong elapsed=GetTickCount64()-started;

      if(code>=200 && code<300){
         g_fail_count=0;
         g_last_ok_ms=(uint)GetTickCount64();
         SaveSequence();
         Print("V-TRADE Bridge v1.8 OK HTTP ",code,
               " | seq=",g_sequence,
               " | attempt=",attempt,
               " | ms=",elapsed,
               " | broker=",BridgeSymbol(),
               " | serverSymbol=XAUUSD",
               " | MTF=READY");
         return;
      }

      int err=GetLastError();
      bool retryable=(code==1003 || code<0);
      if(attempt<max_attempts && retryable){
         Print("V-TRADE Bridge v1.8 RETRY | HTTP=",code,
               " | attempt=",attempt,"/",max_attempts,
               " | error=",err," | ms=",elapsed);
         Sleep(250);
         continue;
      }

      g_fail_count++;
      if(code<0)
         Print("V-TRADE Bridge v1.8 FAILED | WebRequest error=",err,
               " | failCount=",g_fail_count," | ms=",elapsed," | URL=",url);
      else
         Print("V-TRADE Bridge v1.8 HTTP ",code,
               " | failCount=",g_fail_count,
               " | attempt=",attempt,
               " | ms=",elapsed,
               " | response=",CharArrayToString(result));
      return;
   }
}

int OnInit(){
   LoadSequence();
   int timer_seconds = MathMax(2, InpTimerSeconds);
   ResetLastError();
   if(!EventSetTimer(timer_seconds)){
      int err=GetLastError();
      Print("V-TRADE Bridge v1.8: EventSetTimer FAILED. Error=",err);
      return(INIT_FAILED);
   }

   Print("V-TRADE Bridge v1.8 STABLE STARTED | Timer=",timer_seconds,"s | HTTP timeout=",InpHttpTimeoutMs,"ms | Chart=",_Symbol,
         " | BridgeSymbol=",BridgeSymbol(),
         " | Server=",TrimSlash(InpServerURL)," | Sequence=",g_sequence);
   Print("V-TRADE Bridge v1.8 STABLE: heartbeat uses tickTimeMs + bridgeTimeMs + sequence.");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason){
   SaveSequence();
   EventKillTimer();
   Print("V-TRADE Bridge v1.8 STABLE STOPPED. reason=",reason," | lastSequence=",g_sequence," | failCount=",g_fail_count);
}

void OnTimer(){
   string sym=BridgeSymbol();
   if(!SymbolInfoInteger(sym,SYMBOL_SELECT))
      SymbolSelect(sym,true);

   MqlTick tick;
   if(!SymbolInfoTick(sym,tick)){
      Print("V-TRADE Bridge v1.8: waiting for tick | symbol=",sym,
            " | error=",GetLastError());
      return;
   }

   SendSnapshot();
}

void OnTick(){ }

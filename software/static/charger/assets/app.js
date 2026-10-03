
/* ---------------- shared data ---------------- */
const G=PCB.grid, BW=PCB.w*G, BH=PCB.h*G;
const NETNAME={'BATP':'BAT+','BATN':'BAT−','VSENSE':'A0 (VSENSE)','ISENSE':'A1 (ISENSE)','TSENSE':'A2 (TSENSE)','RLY':'D7 (RLY)','BTN1':'D2 (START)','BTN2':'D3 (MODE)','LEDR':'D5 (LED แดง)','LEDG':'D6 (LED เขียว)','BUZ':'D8 (BUZ)','SDA':'A4 (SDA)','SCL':'A5 (SCL)'};
const nn=n=>NETNAME[n]||n;
const netPads={};
PCB.pads.forEach(p=>{if(p.net)(netPads[p.net]=netPads[p.net]||[]).push(p)});
const compBy={};PCB.comps.forEach(c=>compBy[c.ref]=c);
function rot(dx,dy,r){for(let i=0;i<r/90;i++){[dx,dy]=[-dy,dx]}return[dx,dy]}
function bodyBox(c){
  const b=c.body; let pts;
  if(b[0]==='circ'){const[cx,cy]=rot(b[1],b[2],c.rot);return{circ:true,cx:(c.x+cx)*G,cy:(c.y+cy)*G,r:b[3]*G}}
  let x0=b[1],y0=b[2],x1=b[3],y1=b[4];
  if(c.flip){[x0,x1]=[-x1,-x0]}
  pts=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>rot(x,y,c.rot));
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return{x:(c.x+Math.min(...xs))*G,y:(c.y+Math.min(...ys))*G,w:(Math.max(...xs)-Math.min(...xs))*G,h:(Math.max(...ys)-Math.min(...ys))*G};
}
function silkLabel(c,b){
  if(c.kind==='tb2')return{x:c.flip?b.x+b.w-1.5:b.x+1.5,y:b.y+b.h/2,rot:-90};
  if(b.circ){const big=b.r>4;return big?{x:b.cx,y:b.cy+0.6,rot:0}:{x:b.cx,y:b.cy+b.r+2.1,rot:0}}
  if(b.w*b.h>110)return{x:b.x+b.w/2,y:b.y+b.h/2+0.6,rot:0};
  if(b.w>=b.h)return{x:b.x+b.w/2,y:b.y-0.7,rot:0};
  return{x:b.x+b.w/2,y:b.y+b.h/2,rot:-90};
}
function hsBox(c){if(!c.heatsink)return null;const h=c.heatsink;const pts=[[h[1],h[2]],[h[3],h[4]]].map(([x,y])=>rot(x,y,c.rot));
  return{x:(c.x+Math.min(pts[0][0],pts[1][0]))*G,y:(c.y+Math.min(pts[0][1],pts[1][1]))*G,w:Math.abs(pts[1][0]-pts[0][0])*G,h:Math.abs(pts[1][1]-pts[0][1])*G}}

/* ---------------- schematic ---------------- */
document.getElementById('schsvg')&&(function(){
  let s='';const add=t=>s+=t;
  const W=(...p)=>add(`<polyline class="w" points="${p.map(q=>q.join(',')).join(' ')}"/>`);
  const dot=(x,y)=>add(`<circle class="dot" cx="${x}" cy="${y}" r="3.2"/>`);
  const T=(x,y,t,cls='lbl',anchor='start')=>add(`<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`);
  function lab(x,y,ref,val,anchor='start'){T(x,y,ref,'ref',anchor);if(val)T(x,y+14,val,'val',anchor)}
  function R(x,y,dir,ref,val,opt={}){ // 60 long
    const z=[];const n=6,L=36,a=6;
    for(let i=0;i<=n;i++){const t=12+i*L/n;const o=i===0||i===n?0:(i%2?a:-a);z.push(dir==='h'?[x+t,y+o]:[x+o,y+t])}
    if(dir==='h'){W([x,y],[x+12,y]);W(...z);W([x+48,y],[x+60,y]);lab(x+30,y-12,ref,null,'middle');T(x+30,y+20,val,'val','middle')}
    else{W([x,y],[x,y+12]);W(...z);W([x,y+48],[x,y+60]);if(opt.left)lab(x-12,y+26,ref,val,'end');else lab(x+12,y+26,ref,val)}
    if(opt.var){const[x0,y0,x1,y1]=dir==='h'?[x+16,y+12,x+44,y-12]:[x-12,y+44,x+12,y+16];add(`<line class="s" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" marker-end="url(#arr)"/>`)}
    if(opt.ntc){add(`<polyline class="s" points="${x-13},${y+46} ${x-7},${y+46} ${x+12},${y+14}"/>`);T(x-16,y+50,'t°','val','end')}
  }
  function C(x,y,ref,val,polar,opt={}){ // vertical 60
    W([x,y],[x,y+26]);W([x,y+34],[x,y+60]);
    add(`<line class="s" x1="${x-13}" y1="${y+26}" x2="${x+13}" y2="${y+26}"/>`);
    if(polar){add(`<path class="s" d="M${x-13},${y+37} Q${x},${y+31} ${x+13},${y+37}"/>`);T(x-16,y+22,'+','val','middle')}
    else add(`<line class="s" x1="${x-13}" y1="${y+34}" x2="${x+13}" y2="${y+34}"/>`);
    if(opt.left)lab(x-16,y+22,ref,val,'end');else lab(x+17,y+22,ref,val);
  }
  function Dio(x1,y1,x2,y2,ref,val,opt={}){ // anode (x1,y1) -> cathode (x2,y2), length 60
    const h=y1===y2, sgn=h?Math.sign(x2-x1):Math.sign(y2-y1);
    const mid=h?[(x1+x2)/2,y1]:[x1,(y1+y2)/2];
    const P=(a,b)=>h?[mid[0]+a*sgn,mid[1]+b]:[mid[0]+b,mid[1]+a*sgn];
    W([x1,y1],P(-10,0));W(P(10,0),[x2,y2]);
    const t=[P(-10,-10),P(-10,10),P(8,0)];add(`<polygon class="sf" points="${t.map(q=>q.join(',')).join(' ')}"/>`);
    const k1=P(10,-10),k2=P(10,10);add(`<line class="s" x1="${k1[0]}" y1="${k1[1]}" x2="${k2[0]}" y2="${k2[1]}"/>`);
    if(opt.led){for(const o of[-2,6]){const a=P(o,-12),b=P(o+8,-22);add(`<line class="s" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" marker-end="url(#arr2)"/>`)}}
    if(h)lab(mid[0],mid[1]-16,ref,null,'middle'),T(mid[0],mid[1]+24,val,'val','middle');
    else if(opt.left)lab(mid[0]-16,mid[1]-2,ref,val,'end');else lab(mid[0]+16,mid[1]-2,ref,val);
  }
  function GND(x,y){W([x,y],[x,y+10]);add(`<line class="s" x1="${x-11}" y1="${y+10}" x2="${x+11}" y2="${y+10}"/><line class="s" x1="${x-7}" y1="${y+15}" x2="${x+7}" y2="${y+15}"/><line class="s" x1="${x-3}" y1="${y+20}" x2="${x+3}" y2="${y+20}"/>`)}
  function PWR(x,y,t){W([x,y],[x,y-16]);add(`<polyline class="s" points="${x-8},${y-10} ${x},${y-18} ${x+8},${y-10}"/>`);T(x,y-24,t,'pwr','middle')}
  function NL(x,y,t,dir){ // dir: l = flag to the left of point, r = right, u = above
    const w=t.length*7.6+16,h=18;
    let pts;
    if(dir==='l')pts=[[x,y],[x-8,y-h/2],[x-w,y-h/2],[x-w,y+h/2],[x-8,y+h/2]];
    else if(dir==='r')pts=[[x,y],[x+8,y-h/2],[x+w,y-h/2],[x+w,y+h/2],[x+8,y+h/2]];
    else pts=[[x,y],[x+h/2,y-8],[x+h/2,y-8-w+8],[x-h/2,y-8-w+8],[x-h/2,y-8]];
    add(`<polygon class="nl" points="${pts.map(q=>q.join(',')).join(' ')}"/>`);
    if(dir==='u')add(`<text class="nlt" x="${x}" y="${y-12}" transform="rotate(-90 ${x} ${y-12})" text-anchor="start" dy="4">${t}</text>`);
    else T(dir==='l'?x-w/2-4:x+w/2+4,y+4.5,t,'nlt','middle');
  }
  function BOX(x,y,w,h,title,sub){add(`<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}"/>`);T(x+w/2,y-8,title,'ref','middle');if(sub)T(x+w/2,y+h+16,sub,'val','middle')}
  function frame(x,y,w,h,t){add(`<rect class="frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`);T(x+12,y+20,t,'ftitle')}

  frame(20,20,680,320,'1 · ภาคจ่ายไฟ');frame(20,360,680,300,'3 · รีเลย์ตัดต่อการชาร์จ');frame(20,680,680,290,'5 · Arduino Nano');
  add('<g transform="translate(90,0)">');frame(630,20,590,320,'2 · ตั้งแรงดันชาร์จ');frame(630,360,590,300,'4 · วัดแรงดัน กระแส อุณหภูมิ');frame(630,680,590,290,'6 · จอ ปุ่ม ไฟแสดงผล');add('</g>');

  // --- 1 power
  add(`<rect class="box" x="44" y="104" width="36" height="92"/>`);T(62,96,'J1','ref','middle');T(62,214,'DC IN','val','middle');T(62,228,'18–19V','val','middle');
  add(`<circle class="pinc" cx="80" cy="120" r="4"/><circle class="pinc" cx="80" cy="180" r="4"/>`);T(66,124,'+','lbl','middle');T(66,184,'−','lbl','middle');
  W([84,120],[110,120]);
  add(`<rect class="s" x="122" y="112" width="36" height="16" fill="none"/>`);W([110,120],[170,120]);T(140,100,'F1','ref','middle');T(140,146,'2A','val','middle');
  W([170,120],[190,120]);Dio(190,120,250,120,'D1','1N5408');W([250,120],[470,120]);
  T(262,112,'VIN','wl');
  dot(290,120);C(290,120,'C1','1000µF 35V',true);GND(290,180);
  dot(390,120);C(390,120,'C2','0.33µF',false);GND(390,180);
  BOX(470,100,70,50,'U1  LM7805');T(476,124,'IN','pinl');T(534,124,'OUT','pinl','end');T(505,145,'GND','pinl','middle');
  W([505,150],[505,180]);GND(505,180);
  W([540,120],[680,120]);PWR(680,120,'+5V');
  dot(570,120);C(570,120,'C3','0.1µF',false);GND(570,180);
  dot(635,120);C(635,120,'C4','100µF',true);GND(635,180);
  W([84,180],[110,180],[110,190]);GND(110,190);

  // --- 2 LM317
  add('<g transform="translate(90,0)">');
  NL(680,120,'VIN','l');W([680,120],[780,120]);
  dot(706,120);C(706,120,'C5','0.1µF',false);GND(706,180);
  BOX(780,100,76,50,'U2  LM317T');T(786,124,'IN','pinl');T(850,124,'OUT','pinl','end');T(818,145,'ADJ','pinl','middle');
  W([856,120],[1150,120]);NL(1150,120,'VREG','r');
  dot(900,120);W([900,120],[900,140]);R(900,140,'v','R3','240Ω');
  W([900,200],[900,220]);dot(900,220);W([818,150],[818,220],[900,220]);
  W([900,220],[920,220]);R(920,220,'h','R4','2.2k');W([980,220],[1010,220],[1010,230]);
  R(1010,230,'v','RV1','1k trim',{var:true});GND(1010,290);
  dot(1100,120);C(1100,120,'C6','100µF 25V',true);GND(1100,180);
  T(650,286,'VREG = 1.25 × (1 + (R4 + RV1) ÷ R3)','eq');T(650,306,'ช่วงปรับ 12.7–17.9 V · ตั้ง 15.1 V','eq');T(650,324,'(แบตได้ ≈14.4 V หลังผ่าน D3)','eq');
  add('</g>');

  // --- 3 relay
  PWR(200,412,'+5V');W([200,412],[200,420]);dot(200,420);
  add(`<rect class="box" x="188" y="428" width="24" height="44"/>`);W([200,420],[200,428]);W([200,472],[200,480]);
  T(222,440,'RL1','ref');T(222,470,'คอยล์ 5V','val');
  W([200,420],[150,420]);Dio(150,480,150,420,'D2','1N4007',{left:true});W([150,480],[200,480]);dot(200,480);
  W([200,480],[200,522]);
  // npn
  add(`<circle class="s" cx="190" cy="550" r="21" fill="none"/>`);
  add(`<line class="s" x1="178" y1="536" x2="178" y2="564"/>`);W([160,550],[178,550]);
  W([178,544],[200,530],[200,522]);
  add(`<line class="s" x1="178" y1="556" x2="200" y2="570" marker-end="url(#arr)"/>`);W([200,570],[200,590]);GND(200,590);
  T(218,546,'Q1','ref');T(218,560,'BC547','val');
  R(90,550,'h','R5','1k');W([150,550],[160,550]);NL(90,550,'D7','l');
  // contacts
  add(`<line class="dash" x1="212" y1="450" x2="352" y2="450"/>`);
  add(`<circle class="pinc" cx="330" cy="470" r="3.5"/><circle class="pinc" cx="400" cy="440" r="3.5"/><circle class="pinc" cx="400" cy="490" r="3.5"/>`);
  add(`<line class="s" x1="330" y1="470" x2="396" y2="444"/>`);
  T(326,488,'COM','pinl','end');T(406,436,'NO','pinl');T(406,500,'NC','pinl');
  W([330,474],[330,520],[300,520]);NL(300,520,'VREG','l');
  W([404,440],[420,440]);Dio(420,440,480,440,'D3','1N5408');W([480,440],[560,440],[560,466]);
  dot(520,440);W([520,440],[520,410]);NL(520,410,'BAT+','r');
  add(`<line class="s" x1="542" y1="466" x2="578" y2="466"/><line class="s" x1="550" y1="474" x2="570" y2="474"/><line class="s" x1="542" y1="482" x2="578" y2="482"/><line class="s" x1="550" y1="490" x2="570" y2="490"/>`);
  T(584,470,'+','lbl');T(536,500,'J2','ref','end');T(536,514,'แบต 12V','val','end');
  W([560,490],[560,540]);dot(560,540);W([560,540],[500,540]);NL(500,540,'BAT−','l');
  W([560,540],[560,560]);R(560,560,'v','R10','0.22Ω 2W',{left:true});GND(560,620);

  // --- 4 sense
  add('<g transform="translate(90,0)">');
  NL(680,400,'BAT+','l');W([680,400],[700,400],[700,410]);R(700,410,'v','R1','10k',{left:true});
  W([700,470],[700,500]);dot(700,500);W([700,500],[700,510]);R(700,510,'v','R2','3.3k',{left:true});GND(700,570);
  W([700,500],[770,500]);dot(770,500);W([770,500],[770,510]);C(770,510,'C7','0.1µF',false);GND(770,570);
  W([770,500],[810,500]);NL(810,500,'A0','r');
  NL(880,400,'BAT−','l');W([880,400],[900,400],[900,410]);R(900,410,'v','R6','1k',{left:true});
  W([900,470],[900,500],[960,500]);dot(960,500);W([960,500],[960,510]);C(960,510,'C8','0.1µF',false);GND(960,570);
  W([960,500],[1000,500]);NL(1000,500,'A1','r');
  PWR(1100,402,'+5V');W([1100,402],[1100,410]);R(1100,410,'v','R9','10k',{left:true});
  W([1100,470],[1100,510]);dot(1100,490);R(1100,510,'v','J3 NTC','10k B3950',{ntc:true});GND(1100,570);
  W([1100,490],[1150,490]);NL(1150,490,'A2','r');
  T(650,628,'A0: 15 V × 3.3/(10+3.3) = 3.72 V  ·  A1: 1 A × 0.22 Ω = 0.22 V','eq');
  add('</g>');

  // --- 5 nano
  BOX(230,720,160,215,'A1  Arduino Nano V3');
  const L=[['5V','+5V'],['GND','GND'],['A0','A0'],['A1','A1'],['A2','A2'],['A4','SDA'],['A5','SCL']];
  const Rr=[['D2','D2'],['D3','D3'],['D5','D5'],['D6','D6'],['D7','D7'],['D8','D8'],['GND','GND']];
  L.forEach(([p,n],i)=>{const y=745+i*28;W([230,y],[190,y]);T(238,y+4,p,'pinl');NL(190,y,n,'l')});
  Rr.forEach(([p,n],i)=>{const y=745+i*28;W([390,y],[430,y]);T(382,y+4,p,'pinl','end');NL(430,y,n,'r')});
  T(310,956,'USB อยู่ด้านขอบขวาของบอร์ด','val','middle');

  // --- 6 UI
  add('<g transform="translate(90,0)">');
  BOX(650,730,96,120,'J4  LCD 16×2 I2C');
  [['GND','GND'],['VCC','+5V'],['SDA','SDA'],['SCL','SCL']].forEach(([p,n],i)=>{const y=752+i*26;W([746,y],[772,y]);T(740,y+4,p,'pinl','end');NL(772,y,n,'r')});
  function SW(x,y,ref,val){W([x,y],[x,y+18]);W([x,y+42],[x,y+60]);add(`<circle class="pinc" cx="${x}" cy="${y+20}" r="3"/><circle class="pinc" cx="${x}" cy="${y+40}" r="3"/><line class="s" x1="${x-12}" y1="${y+16}" x2="${x-12}" y2="${y+44}"/><line class="s" x1="${x-12}" y1="${y+30}" x2="${x-22}" y2="${y+30}"/>`);lab(x+10,y+28,ref,val)}
  const cols=[[892,'D2','SW1','START'],[960,'D3','SW2','MODE']];
  cols.forEach(([x,n,r,v])=>{NL(x,742,n,'u');W([x,742],[x,770]);SW(x,770,r,v);GND(x,830)});
  NL(1030,742,'D5','u');W([1030,742],[1030,750]);R(1030,750,'v','R7','1k');Dio(1030,810,1030,870,'LED1','แดง',{led:true});GND(1030,870);
  NL(1110,742,'D6','u');W([1110,742],[1110,750]);R(1110,750,'v','R8','1k');Dio(1110,810,1110,870,'LED2','เขียว',{led:true});GND(1110,870);
  NL(1180,742,'D8','u');W([1180,742],[1180,790]);add(`<rect class="box" x="1168" y="790" width="24" height="34"/>`);T(1180,812,'+','lbl','middle');T(1162,804,'BZ1','ref','end');T(1162,818,'5V','val','end');W([1180,824],[1180,850]);GND(1180,850);
  add('</g>');

  document.getElementById('schsvg').innerHTML=`<svg viewBox="0 0 1330 990" role="img" aria-label="ผังวงจรเครื่องชาร์จแบต">
  <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sym)"/></marker>
  <marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sym)"/></marker>
  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".9" fill="var(--line)"/></pattern></defs>
  <style>
   .w{fill:none;stroke:var(--wire);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
   .s{fill:none;stroke:var(--sym);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
   .sf{fill:var(--sym);stroke:var(--sym);stroke-width:1.5}
   .dot{fill:var(--wire)}
   .box{fill:var(--surface);stroke:var(--sym);stroke-width:2}
   .pinc{fill:var(--paper);stroke:var(--sym);stroke-width:1.6}
   .frame{fill:none;stroke:var(--line);stroke-width:1.5}
   .dash{stroke:var(--sym);stroke-width:1.5;stroke-dasharray:5 4}
   .nl{fill:var(--chip);stroke:var(--accent);stroke-width:1.4}
   text{font-family:var(--f-mono);fill:var(--ink)}
   .ref{font-size:12.5px;font-weight:500}
   .val{font-size:11.5px;fill:var(--muted)}
   .lbl{font-size:13px}
   .pinl{font-size:11px;fill:var(--muted)}
   .pwr{font-size:12.5px;font-weight:500;fill:var(--warn)}
   .nlt{font-size:11.5px;font-weight:500;fill:var(--accent)}
   .wl{font-size:11.5px;fill:var(--wire)}
   .eq{font-size:12px;fill:var(--muted)}
   .ftitle{font-family:var(--f-display);font-size:15px;font-weight:600;fill:var(--ink)}
  </style>
  <rect width="1330" height="990" fill="url(#dots)"/>${s}</svg>`;
})();

/* ---------------- PCB 2D ---------------- */
const pcbSvg=document.getElementById('pcbsvg');
pcbSvg&&(function(){
  const M=3;let s='';
  const r2=v=>Math.round(v*100)/100;
  s+=`<g id="pcbRoot">`;
  s+=`<rect x="0" y="0" width="${BW}" height="${BH}" rx="1.5" fill="#1b5a3a" stroke="#d9cf9e" stroke-width=".25"/>`;
  // bottom traces first, then top
  const tr=L=>PCB.traces.filter(t=>t.layer===L).map(t=>`<polyline class="tr" data-net="${t.net}" points="${t.pts.map(p=>r2(p[0]*G)+','+r2(p[1]*G)).join(' ')}" stroke-width="${t.w}"/>`).join('');
  s+=`<g id="gBot" stroke="#4f8fe0" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85">${tr(1)}</g>`;
  s+=`<g id="gTop" stroke="#d08a3c" fill="none" stroke-linecap="round" stroke-linejoin="round">${tr(0)}</g>`;
  // silk
  let silk='';
  PCB.comps.forEach(c=>{
    const hb=hsBox(c);if(hb)silk+=`<rect x="${r2(hb.x)}" y="${r2(hb.y)}" width="${r2(hb.w)}" height="${r2(hb.h)}" stroke-dasharray=".8 .6"/>`;
    const b=bodyBox(c);
    if(b.circ)silk+=`<circle cx="${r2(b.cx)}" cy="${r2(b.cy)}" r="${r2(b.r)}"/>`;
    else silk+=`<rect x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}" rx=".3"/>`;
    const L=silkLabel(c,b);
    silk+=L.rot?`<text x="${r2(L.x)}" y="${r2(L.y)}" dy=".62" text-anchor="middle" transform="rotate(-90 ${r2(L.x)} ${r2(L.y)})" class="${c.kind==='tb2'?'':'sm'}">${c.ref}</text>`:`<text x="${r2(L.x)}" y="${r2(L.y)}" text-anchor="middle">${c.ref}</text>`;
    if(c.kind==='nano')silk+=`<text x="${r2(b.x+b.w/2)}" y="${r2(b.y+b.h/2+3)}" text-anchor="middle" class="sm">USB →</text>`;
    if(c.kind==='to92'){const[px,py]=[c.x*G,c.y*G];silk+=`<line x1="${r2(px-0.6)}" y1="${r2(py+2.1)}" x2="${r2(px+5.7)}" y2="${r2(py+2.1)}"/>`}
    if(c.kind==='diode'||c.kind==='diode_big'){
      const kp=PCB.pads.find(p=>p.ref===c.ref&&p.name==='K');const ap=PCB.pads.find(p=>p.ref===c.ref&&p.name==='A');
      const t=c.kind==='diode'?0.72:0.66;const bx=ap.x+(kp.x-ap.x)*t,by=ap.y+(kp.y-ap.y)*t;
      const hz=ap.y===kp.y;const half=c.kind==='diode'?1.4:2.6;
      silk+=hz?`<line x1="${r2(bx*G)}" y1="${r2(by*G-half)}" x2="${r2(bx*G)}" y2="${r2(by*G+half)}" stroke-width=".55"/>`:`<line x1="${r2(bx*G-half)}" y1="${r2(by*G)}" x2="${r2(bx*G+half)}" y2="${r2(by*G)}" stroke-width=".55"/>`;
    }
  });
  PCB.pads.forEach(p=>{
    if(['ecap','buzzer'].includes(compBy[p.ref].kind)&&p.name==='+')silk+=`<text x="${r2(p.x*G-2.2)}" y="${r2(p.y*G-1.6)}" class="sm">+</text>`;
  });
  // pin labels for headers / terminals
  const pl={J4:['GND','VCC','SDA','SCL'],J1:['+','−'],J2:['+','−']};
  PCB.pads.forEach(p=>{
    if(p.ref==='J4')silk+=`<text x="${r2(p.x*G)}" y="${r2(p.y*G+3.2)}" text-anchor="middle" class="xs">${pl.J4[['GND','VCC','SDA','SCL'].indexOf(p.name)]}</text>`;
    if(p.ref==='J1'||p.ref==='J2')silk+=`<text x="${r2(p.x*G+(p.ref==='J1'?2.6:-2.6))}" y="${r2(p.y*G+0.9)}" text-anchor="middle" class="sm">${p.name==='1'?'+':'−'}</text>`;
  });
  s+=`<g id="gSilk" fill="none" stroke="#e8e2c8" stroke-width=".22" font-family="IBM Plex Mono,monospace" font-size="1.9">${silk}</g>`;
  // holes
  PCB.holes.forEach(([x,y])=>s+=`<circle cx="${x*G}" cy="${y*G}" r="1.6" fill="#0c1410" stroke="#c9a85a" stroke-width=".5"/>`);
  // pads
  let pd='';
  PCB.pads.forEach((p,i)=>{
    const x=r2(p.x*G),y=r2(p.y*G),h=p.size/2;
    const hole=p.size>=2.4?0.65:0.45;
    const shape=p.shape==='sq'?`<rect x="${r2(x-h)}" y="${r2(y-h)}" width="${p.size}" height="${p.size}"/>`:`<circle cx="${x}" cy="${y}" r="${h}"/>`;
    pd+=`<g class="pad" data-i="${i}" data-net="${p.net||''}">${shape}<circle class="hole" cx="${x}" cy="${y}" r="${hole}"/></g>`;
  });
  PCB.vias.forEach(v=>pd+=`<g class="pad via" data-net="${v.net}"><circle cx="${v.x*G}" cy="${v.y*G}" r=".6"/><circle class="hole" cx="${v.x*G}" cy="${v.y*G}" r=".3"/></g>`);
  s+=`<g id="gPads">${pd}</g></g>`;
  pcbSvg.setAttribute('viewBox',`${-M} ${-M} ${BW+2*M} ${BH+2*M}`);
  pcbSvg.innerHTML=`<style>
    #pcbsvg .pad>rect,#pcbsvg .pad>circle:first-child{fill:#d9b65c}
    #pcbsvg .hole{fill:#0c1410}
    #pcbsvg .via>circle:first-child{fill:#9fb5c9}
    #pcbsvg text{fill:#e8e2c8;stroke:none}
    #pcbsvg .sm{font-size:1.6px}#pcbsvg .xs{font-size:1.15px}
    #pcbsvg.hl .tr{opacity:.18}#pcbsvg.hl .pad{opacity:.35}
    #pcbsvg.hl .on{opacity:1!important}
    #pcbsvg.hl .tr.on{stroke:#fff36b}#pcbsvg.hl .pad.on>rect,#pcbsvg.hl .pad.on>circle:first-child{fill:#fff36b}
    #pcbsvg .pad{cursor:pointer}
  </style>`+s;

  const hover=document.getElementById('hover');
  function highlight(net,info){
    pcbSvg.querySelectorAll('.on').forEach(e=>e.classList.remove('on'));
    if(!net){pcbSvg.classList.remove('hl');hover.innerHTML='ชี้ที่ขาอุปกรณ์เพื่อดูการเชื่อมต่อ';return}
    pcbSvg.classList.add('hl');
    pcbSvg.querySelectorAll(`[data-net="${CSS.escape(net)}"]`).forEach(e=>e.classList.add('on'));
    const list=(netPads[net]||[]).map(p=>`${p.ref}.${p.name}`).join(', ');
    hover.innerHTML=(info?`<b>${info}</b> · `:'')+`net <b>${nn(net)}</b> → ${list}`;
  }
  pcbSvg.addEventListener('pointerover',e=>{
    const g=e.target.closest('.pad,.tr');if(!g)return;
    const net=g.dataset.net;let info='';
    if(g.dataset.i){const p=PCB.pads[+g.dataset.i];info=`${p.ref} ขา ${p.name}`+(compBy[p.ref]?` (${compBy[p.ref].value})`:'');
      if(!net){pcbSvg.classList.remove('hl');hover.innerHTML=`<b>${info}</b> · ไม่ได้ต่อใช้งาน`;return}}
    highlight(net,info);
  });
  pcbSvg.addEventListener('pointerleave',()=>{const v=document.getElementById('netSel').value;highlight(v||null)});
  const sel=document.getElementById('netSel');
  Object.keys(netPads).sort().forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=nn(n);sel.appendChild(o)});
  sel.addEventListener('change',()=>highlight(sel.value||null));
  const tg=(id,g)=>document.getElementById(id).addEventListener('change',e=>document.getElementById(g).style.display=e.target.checked?'':'none');
  tg('lyTop','gTop');tg('lyBot','gBot');tg('lySilk','gSilk');
  document.getElementById('lyMirror').addEventListener('change',e=>{
    document.getElementById('pcbRoot').setAttribute('transform',e.target.checked?`translate(${BW},0) scale(-1,1)`:'');
    document.getElementById('gSilk').style.display=e.target.checked?'none':(document.getElementById('lySilk').checked?'':'none');
    document.getElementById('gTop').setAttribute('opacity',e.target.checked?'.35':'1');
  });

  // placement table
  const angle={0:'0°',90:'90°',180:'180°',270:'270°'};
  let t='<tr><th>Ref</th><th>ค่า</th><th>X ขา1 (มม.)</th><th>Y ขา1 (มม.)</th><th>หมุน</th></tr>';
  [...PCB.comps].sort((a,b)=>a.ref.localeCompare(b.ref,undefined,{numeric:true})).forEach(c=>{
    const p1=PCB.pads.find(p=>p.ref===c.ref);
    t+=`<tr><td class="mono">${c.ref}</td><td>${c.value}</td><td class="mono">${(p1.x*G).toFixed(2)}</td><td class="mono">${(p1.y*G).toFixed(2)}</td><td class="mono">${angle[c.rot]}${c.flip?' (กลับด้าน)':''}</td></tr>`});
  document.getElementById('placeTbl').innerHTML=t;
})();

/* ---------------- solder / net tables ---------------- */
const POL={
  D1:'แถบสีเงินที่ตัว (K) ลงรูสี่เหลี่ยม',D3:'แถบสีเงินที่ตัว (K) ลงรูสี่เหลี่ยม',D2:'แถบสีเทาที่ตัว (K) ลงรูสี่เหลี่ยม',
  C1:'ขายาว (+) ลงรูสี่เหลี่ยม แถบขาว (−) ลงรูกลม',C4:'ขายาว (+) ลงรูสี่เหลี่ยม',C6:'ขายาว (+) ลงรูสี่เหลี่ยม',
  LED1:'ขายาว (A) ลงรูกลม ด้านแบน (K) ลงรูสี่เหลี่ยม',LED2:'ขายาว (A) ลงรูกลม ด้านแบน (K) ลงรูสี่เหลี่ยม',
  Q1:'หันด้านแบนตามเส้นบนลายพิมพ์ ขาเรียง C-B-E',U1:'หันด้านตัวหนังสือออก ฮีตซิงก์อยู่ด้านหลัง ขาเรียง IN-GND-OUT',
  U2:'หันด้านตัวหนังสือออก ขาเรียง ADJ-OUT-IN ระวังแผ่นหลังมีไฟ',BZ1:'ขา + (ขายาว) ลงรูสี่เหลี่ยม',
  RV1:'ขา 1 ลงรูสี่เหลี่ยม',A1:'พอร์ต USB หันออกขอบขวา',J1:'ช่องเสียบสายหันออกขอบซ้าย',J2:'ช่องเสียบสายหันออกขอบขวา',
  RL1:'ใส่ได้ทางเดียวตามรูขา',J4:'เรียง GND-VCC-SDA-SCL ให้ตรงกับบอร์ดจอ',R10:'ยกสูงจากแผ่น 3–5 มม.',
  SW1:'ขา 4 ขา ใส่ได้ทางเดียว',SW2:'ขา 4 ขา ใส่ได้ทางเดียว'};
document.getElementById('solderTbl')&&(function(){
  const order=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
  let t='<tr><th>อุปกรณ์</th><th>ขา</th><th>Net</th><th>ต่อไปที่</th><th>ทิศทาง</th></tr>';
  [...PCB.comps].sort((a,b)=>order(a.ref,b.ref)).forEach(c=>{
    const ps=PCB.pads.filter(p=>p.ref===c.ref&&(p.net||c.kind!=='nano')&&!['A2','B2'].includes(p.name));
    ps.forEach((p,i)=>{
      const others=p.net?(netPads[p.net]||[]).filter(q=>q.ref!==p.ref).map(q=>`<span class="pin">${q.ref}.${q.name}</span>`).join(''):'<span style="color:var(--muted)">ไม่ได้ต่อ</span>';
      t+=`<tr>${i===0?`<td rowspan="${ps.length}"><b class="mono">${c.ref}</b><br>${c.value}</td>`:''}<td class="mono">${p.name}</td><td class="net">${p.net?nn(p.net):'–'}</td><td>${others}</td>${i===0?`<td rowspan="${ps.length}" class="pol">${POL[c.ref]||''}</td>`:''}</tr>`;
    });
  });
  document.getElementById('solderTbl').innerHTML=t;
  let n='<tr><th>Net</th><th>ขาที่ต้องต่อถึงกัน</th></tr>';
  Object.keys(netPads).sort((a,b)=>(a==='GND')-(b==='GND')||order(a,b)).forEach(k=>n+=`<tr><td class="net">${nn(k)}</td><td>${netPads[k].map(p=>`<span class="pin">${p.ref}.${p.name}</span>`).join('')}</td></tr>`);
  document.getElementById('netTbl').innerHTML=n;
})();

/* ---------------- BOM ---------------- */
document.getElementById('bomTbl')&&(function(){
  const B=[
   ['grp','สารกึ่งตัวนำ'],
   ['A1',1,'Arduino Nano V3 (ATmega328P, CH340)','โมดูล','ARDUINO NANO / CONN-SIL15 ×2','เสียบบนก้างปลาตัวเมีย'],
   ['U1',1,'LM7805 เรกูเลเตอร์ 5V 1A','TO-220','7805','+ ฮีตซิงก์ TO-220'],
   ['U2',1,'LM317T เรกูเลเตอร์ปรับค่าได้ 1.5A','TO-220','LM317T','+ ฮีตซิงก์ใหญ่ (≥ 25×25 มม.)'],
   ['Q1',1,'BC547 (ใช้ 2N2222 แทนได้ แต่ขาเรียงต่างกัน)','TO-92','BC547',''],
   ['D1, D3',2,'1N5408 ไดโอด 3A 1000V','DO-201','1N5408',''],
   ['D2',1,'1N4007 ไดโอด 1A','DO-41','1N4007','ไดโอดกันไฟย้อนจากคอยล์รีเลย์'],
   ['LED1',1,'LED 5 มม. สีแดง','5 มม.','LED-RED','กำลังชาร์จ'],
   ['LED2',1,'LED 5 มม. สีเขียว','5 มม.','LED-GREEN','ชาร์จเต็ม'],
   ['grp','ตัวต้านทาน (1/4W 1% ยกเว้นระบุ)'],
   ['R1, R9',2,'10 kΩ','Axial 0.4"','RES',''],
   ['R2',1,'3.3 kΩ','Axial 0.4"','RES',''],
   ['R3',1,'240 Ω','Axial 0.4"','RES',''],
   ['R4',1,'2.2 kΩ','Axial 0.4"','RES',''],
   ['R5, R6, R7, R8',4,'1 kΩ','Axial 0.4"','RES',''],
   ['R10',1,'0.22 Ω 2W (ใช้แบบกระเบื้อง 5W แทนได้)','Axial 0.6"','RES','ตัววัดกระแส'],
   ['RV1',1,'1 kΩ ทริมพอตแบบหลายรอบ 3296W','3296W','POT-HG','ใช้ตั้งแรงดันชาร์จ'],
   ['grp','ตัวเก็บประจุ'],
   ['C1',1,'1000 µF 35V อิเล็กโทรไลต์','Ø12.5 มม. ขาห่าง 5 มม.','CAP-ELEC',''],
   ['C2',1,'0.33 µF (334) เซรามิก','ขาห่าง 5 มม.','CAP',''],
   ['C3, C5, C7, C8',4,'0.1 µF (104) เซรามิก','ขาห่าง 5 มม.','CAP',''],
   ['C4',1,'100 µF 16V อิเล็กโทรไลต์','Ø6.3 มม. ขาห่าง 2.5 มม.','CAP-ELEC',''],
   ['C6',1,'100 µF 25V อิเล็กโทรไลต์','Ø6.3 มม. ขาห่าง 2.5 มม.','CAP-ELEC',''],
   ['grp','อุปกรณ์กลไกและขั้วต่อ'],
   ['RL1',1,'รีเลย์ SRD-05VDC-SL-C 5V 10A','Songle SRD','RELAY','ตรวจระยะขาตัวจริงก่อนสั่งทำ PCB'],
   ['F1',1,'กระบอกฟิวส์ลงปริ้น 5×20 มม. + ฟิวส์ 2A (ซื้อสำรอง)','5×20 มม.','FUSE',''],
   ['J1, J2',2,'เทอร์มินัลบล็อก 2 ขา ระยะ 5.08 มม.','5.08 มม.','TBLOCK-M2','J1 ไฟเข้า, J2 แบต'],
   ['J3',1,'ก้างปลาตัวผู้ 2 ขา + หัววัด NTC 10k B3950','2.54 มม.','CONN-SIL2 (+ NTC ในผังวงจร)',''],
   ['J4',1,'ก้างปลาตัวผู้ 4 ขา','2.54 มม.','CONN-SIL4 (จำลองใช้ JHD-2X16-I2C)','ต่อจอ LCD'],
   ['–',2,'ก้างปลาตัวเมีย 1×15 ขา','2.54 มม.','–','สำหรับเสียบ Nano'],
   ['SW1, SW2',2,'สวิตช์กดติดปล่อยดับ 6×6 มม. (สูง 9–13 มม.)','6×6 มม.','BUTTON','START, MODE'],
   ['BZ1',1,'บัซเซอร์ Active 5V Ø12 มม.','ขาห่าง 7.6 มม.','BUZZER',''],
   ['grp','จอและอื่นๆ'],
   ['LCD',1,'จอ LCD 16×2 พร้อมบอร์ด I2C (PCF8574)','โมดูล','LM016L + PCF8574 หรือ JHD-2X16-I2C','address 0x27 หรือ 0x3F'],
   ['PCB',1,'แผ่น PCB 2 ชั้น 101.6 × 81.3 มม. หนา 1.6 มม.','–','–','สั่งโรงงานจากไฟล์ Gerber หรือใช้ perfboard 10×15 ซม. แทน'],
  ];
  let t='<tr><th>Ref</th><th>จำนวน</th><th>อุปกรณ์</th><th>แพ็กเกจ</th><th>ชื่อใน Proteus</th><th>หมายเหตุ</th></tr>';
  B.forEach(r=>{if(r[0]==='grp')t+=`<tr class="grp"><td colspan="6">${r[1]}</td></tr>`;else t+=`<tr><td class="mono">${r[0]}</td><td class="mono">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td class="mono">${r[4]}</td><td>${r[5]}</td></tr>`});
  document.getElementById('bomTbl').innerHTML=t;
})();

/* ---------------- code ---------------- */
if(document.getElementById('codeBox')){
document.getElementById('codeBox').textContent=CODE;
document.getElementById('copyCode').addEventListener('click',()=>{
  const msg=document.getElementById('copyMsg');
  navigator.clipboard.writeText(CODE).then(()=>msg.textContent='คัดลอกแล้ว').catch(()=>{
    const r=document.createRange();r.selectNodeContents(document.getElementById('codeBox'));const s=getSelection();s.removeAllRanges();s.addRange(r);msg.textContent='เลือกข้อความแล้ว กด Ctrl+C เพื่อคัดลอก'});
});
}

/* ---------------- 3D ---------------- */
function init3D(host,opts={}){
  if(!window.THREE){host.insertAdjacentHTML('beforeend','<p style="color:#ddd;padding:20px">โหลดไลบรารี 3D ไม่สำเร็จ ลองรีเฟรชหน้า</p>');return}
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setClearColor(0x000000,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputEncoding=THREE.sRGBEncoding;
  host.prepend(renderer.domElement);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(35,1,1,2000);
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x22302a,0.75));
  const sun=new THREE.DirectionalLight(0xffffff,0.85);sun.position.set(-60,140,90);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xffffff,0.3);fill.position.set(80,60,-90);scene.add(fill);
  const under=new THREE.DirectionalLight(0xffffff,0.7);under.position.set(30,-150,40);scene.add(under);

  const T=1.6; // board thickness
  const X=x=>x*G-BW/2, Z=y=>y*G-BH/2;
  const mat=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.55,metalness:0},o));
  const metal=c=>mat(c,{metalness:.85,roughness:.3});
  const M={black:mat(0x1a1a1c,{roughness:.6}),blue:mat(0x2463c4),nano:mat(0x1f4fa8),gold:metal(0xd8b25a),silver:metal(0xc9ccd1),alu:mat(0x2b2e33,{metalness:.5,roughness:.45}),
    tbgreen:mat(0x2f8a52),beige:mat(0xd9c49b),ceramic:mat(0xd99430),ecap:mat(0x1c2a4a),ecap2:mat(0x101418),grey:mat(0x8a8f96),brass:metal(0xc4a14a),white:mat(0xeeeeee),
    ledR:mat(0xff3b30,{transparent:true,opacity:.8,emissive:0x550000}),ledG:mat(0x34d058,{transparent:true,opacity:.8,emissive:0x003300}),capBtn:mat(0x2b2b2b)};

  // board textures from canvas
  function boardTex(bottom){
    const S=20,cv=document.createElement('canvas');cv.width=Math.round(BW*S);cv.height=Math.round(BH*S);
    const g=cv.getContext('2d');g.fillStyle='#1d5c3c';g.fillRect(0,0,cv.width,cv.height);
    const fx=x=>x*S;
    g.lineCap='round';g.lineJoin='round';
    PCB.traces.filter(t=>t.layer===(bottom?1:0)).forEach(t=>{g.strokeStyle='#2c7a4f';g.lineWidth=t.w*S;g.beginPath();t.pts.forEach((p,i)=>i?g.lineTo(fx(p[0]*G),p[1]*G*S):g.moveTo(fx(p[0]*G),p[1]*G*S));g.stroke()});
    PCB.vias.forEach(v=>{g.fillStyle='#c9a85a';g.beginPath();g.arc(fx(v.x*G),v.y*G*S,.6*S,0,7);g.fill();g.fillStyle='#0b0f0d';g.beginPath();g.arc(fx(v.x*G),v.y*G*S,.3*S,0,7);g.fill()});
    PCB.pads.forEach(p=>{const x=fx(p.x*G),y=p.y*G*S,h=p.size/2*S;g.fillStyle='#d9b65c';
      if(p.shape==='sq')g.fillRect(x-h,y-h,2*h,2*h);else{g.beginPath();g.arc(x,y,h,0,7);g.fill()}
      g.fillStyle='#0b0f0d';g.beginPath();g.arc(x,y,(p.size>=2.4?.65:.45)*S,0,7);g.fill()});
    PCB.holes.forEach(([x,y])=>{g.fillStyle='#c9a85a';g.beginPath();g.arc(fx(x*G),y*G*S,2.6*S,0,7);g.fill();g.fillStyle='#0b0f0d';g.beginPath();g.arc(fx(x*G),y*G*S,1.6*S,0,7);g.fill()});
    if(!bottom){
      g.strokeStyle='#ecebe0';g.fillStyle='#ecebe0';g.lineWidth=.22*S;g.font=`${1.9*S}px IBM Plex Mono, monospace`;g.textAlign='center';
      PCB.comps.forEach(c=>{const b=bodyBox(c);g.beginPath();if(b.circ)g.arc(b.cx*S,b.cy*S,b.r*S,0,7);else g.rect(b.x*S,b.y*S,b.w*S,b.h*S);g.stroke();
        const L=silkLabel(c,b);g.save();g.translate(L.x*S,L.y*S);if(L.rot){g.rotate(-Math.PI/2);g.textBaseline='middle';g.font=`${(c.kind==='tb2'?1.9:1.6)*S}px IBM Plex Mono, monospace`}else{g.textBaseline='alphabetic';g.font=`${1.9*S}px IBM Plex Mono, monospace`}
        g.fillText(c.ref,0,0);g.restore()});
      g.font=`600 ${3*S}px Chakra Petch, sans-serif`;g.textAlign='left';g.fillText('SMART CHARGER v1.0',6*S,66*S);
    }else{g.save();g.translate((BW-6)*S,66*S);g.scale(-1,1);g.fillStyle='#ecebe0';g.font=`600 ${3*S}px Chakra Petch, sans-serif`;g.fillText('BOTTOM · 12V SLA CHARGER',0,0);g.restore()}
    const tx=new THREE.CanvasTexture(cv);tx.encoding=THREE.sRGBEncoding;tx.anisotropy=8;return tx;
  }
  const edge=mat(0x1a4a31);
  const board=new THREE.Mesh(new THREE.BoxGeometry(BW,T,BH),edge);
  [[false,T/2+.02,THREE.FrontSide],[true,-T/2-.02,THREE.BackSide]].forEach(([bot,y,side])=>{
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(BW,BH),mat(0xffffff,{map:boardTex(bot),roughness:.5,side}));
    pl.rotation.x=-Math.PI/2;pl.position.y=y;board.add(pl)});
  scene.add(board);
  const parts=new THREE.Group();scene.add(parts);

  const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o};
  const cyl=(r,h,m,x,y,z,seg=24)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m);o.position.set(x,y,z);return o};
  const top=T/2;
  function labelTex(text,bg,fg,w=256,h=64,size=26){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.font=`600 ${size}px IBM Plex Mono, monospace`;g.textAlign='center';g.textBaseline='middle';
    text.split('\n').forEach((l,i,a)=>g.fillText(l,w/2,h/2+(i-(a.length-1)/2)*size*1.15));const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;return t}
  function lead(a,b,y){ // bent axial lead from pad a to body height
    const g=new THREE.Group();g.add(cyl(.3,y,M.silver,a.x,top+y/2,a.z,8));return g}

  PCB.comps.forEach(c=>{
    const g=new THREE.Group();g.userData={ref:c.ref,value:c.value};
    const ps=PCB.pads.filter(p=>p.ref===c.ref);
    const P=ps.map(p=>({x:X(p.x),z:Z(p.y),name:p.name}));
    const p1=P[0],p2=P[1]||P[0];
    const mx=(p1.x+p2.x)/2,mz=(p1.z+p2.z)/2;
    const ang=Math.atan2(p2.z-p1.z,p2.x-p1.x);
    const len=Math.hypot(p2.x-p1.x,p2.z-p1.z);
    function axial(r,l,y,m,band,bandAtEnd){
      const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,24),m);body.rotation.z=Math.PI/2;
      const holder=new THREE.Group();holder.add(body);
      if(band){const b=new THREE.Mesh(new THREE.CylinderGeometry(r+.02,r+.02,l*.14,24),band);b.rotation.z=Math.PI/2;b.position.x=bandAtEnd*l*.36;holder.add(b)}
      if(m===M.beige){[-.28,-.14,0].forEach((o,i)=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(r+.02,r+.02,l*.08,24),mat([0x8b4513,0x111111,0xff8c00][i]));b.rotation.z=Math.PI/2;b.position.x=o*l;holder.add(b)})}
      holder.position.set(mx,top+y,mz);holder.rotation.y=-ang;g.add(holder);
      [p1,p2].forEach(p=>g.add(cyl(.3,y,M.silver,p.x,top+y/2,p.z,8)));
      const wire=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,len,8),M.silver);wire.rotation.z=Math.PI/2;
      const wh=new THREE.Group();wh.add(wire);wh.position.set(mx,top+y,mz);wh.rotation.y=-ang;g.add(wh);
    }
    const b=bodyBox(c);
    const bc=b.circ?{x:b.cx-BW/2,z:b.cy-BH/2}:{x:b.x+b.w/2-BW/2,z:b.y+b.h/2-BH/2};
    switch(c.kind){
      case 'res': axial(1.15,6.2,1.3,M.beige);break;
      case 'res2w': axial(2.1,10,4,mat(0xc8c3b4));break;
      case 'diode_big': {const kFirst=P[1].name==='K'?1:-1;axial(2.6,7.6,2.8,M.black,M.silver,kFirst);break}
      case 'diode': axial(1.35,5,1.5,M.black,M.grey,1);break;
      case 'cap': {const d=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,1.6,28),c.value.includes('0.33')?mat(0x2f6fb8):M.ceramic);d.rotation.x=Math.PI/2;
        const h=new THREE.Group();h.add(d);h.position.set(mx,top+4.2,mz);h.rotation.y=-ang;g.add(h);
        [p1,p2].forEach(p=>g.add(cyl(.28,2.4,M.silver,p.x,top+1.2,p.z,8)));break}
      case 'ecap': {const r=b.r*.98,h=c.ref==='C1'?25:11;g.add(cyl(r,h,c.ref==='C1'?M.ecap:M.ecap2,bc.x,top+h/2+.3,bc.z,40));
        g.add(cyl(r*.9,.2,M.silver,bc.x,top+h+.35,bc.z,40));
        const st=box(r*.5,h*.92,.3,M.grey,0,0,0);const sg=new THREE.Group();st.position.set(0,0,r-.1);sg.add(st);sg.position.set(bc.x,top+h/2+.3,bc.z);sg.rotation.y=-ang-Math.PI/2;g.add(sg);break}
      case 'to220': {const hs=hsBox(c);const yb=3;
        const fr=new THREE.Group();
        fr.add(box(10,9,4.5,M.black,0,yb+4.5,0));
        fr.add(box(10,6.5,1.3,M.silver,0,yb+9+3.2,-1.6));
        fr.position.set(P[1].x,top,P[1].z+.4);g.add(fr);
        const lt=labelTex(c.value,'#1a1a1c','#bbbbbb',256,96,30);const lp=new THREE.Mesh(new THREE.PlaneGeometry(8,3),new THREE.MeshBasicMaterial({map:lt}));lp.position.set(P[1].x,top+yb+5,P[1].z+.4+2.26);g.add(lp);
        P.forEach(p=>g.add(box(.8,yb,.5,M.silver,p.x,top+yb/2,p.z)));
        const hx=hs.x+hs.w/2-BW/2,hz=hs.y+hs.h/2-BH/2,hh=c.ref==='U2'?24:18;
        g.add(box(hs.w,hh,1.6,M.alu,hx,top+2+hh/2,P[1].z-1.6));
        for(let i=0;i<6;i++){g.add(box(1,hh,hs.h-1.2,M.alu,hx-hs.w/2+.5+i*(hs.w-1)/5,top+2+hh/2,hz-.6))}
        break}
      case 'to92': {const m=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.4,5,24,1,false,0,Math.PI),M.black);m.position.set(P[1].x,top+5.5,P[1].z+.4);m.rotation.y=Math.PI/2;g.add(m);
        g.add(box(4.8,5,.1,M.black,P[1].x,top+5.5,P[1].z+.4));P.forEach(p=>g.add(box(.45,3,.45,M.silver,p.x,top+1.5,p.z)));break}
      case 'relay': {g.add(box(b.w,15.5,b.h,M.blue,bc.x,top+15.5/2+.2,bc.z));
        const lp=new THREE.Mesh(new THREE.PlaneGeometry(b.w*.85,b.h*.6),new THREE.MeshBasicMaterial({map:labelTex('SONGLE\nSRD-05VDC-SL-C\n10A 250VAC','#2463c4','#ffffff',512,256,44)}));lp.rotation.x=-Math.PI/2;lp.position.set(bc.x,top+15.8,bc.z);g.add(lp);break}
      case 'nano': {const hy=8.5;
        [0,12].forEach(r=>g.add(box(28*G+2.54,hy,2.54,M.black,X(c.x+14),top+hy/2,Z(c.y+r))));
        const by=top+hy+2.5;
        g.add(box(b.w,1.6,b.h,M.nano,bc.x,by,bc.z));
        ps.forEach(p=>g.add(box(.64,2.5,.64,M.gold,X(p.x),by+1.2,Z(p.y))));
        const chip=box(7,1.1,7,M.black,bc.x-2,by+1.35,bc.z);chip.rotation.y=Math.PI/4;g.add(chip);
        g.add(box(4,1.2,3,M.black,bc.x-12,by+1.4,bc.z));
        g.add(box(9,4,7.6,M.silver,X(c.x+31)-1,by+2.8,bc.z));
        g.add(box(2.4,1.2,1.6,M.white,bc.x+8,by+1.4,bc.z+4));
        const lp=new THREE.Mesh(new THREE.PlaneGeometry(14,3.5),new THREE.MeshBasicMaterial({map:labelTex('ARDUINO NANO','#1f4fa8','#ffffff',512,128,52)}));lp.rotation.x=-Math.PI/2;lp.position.set(bc.x+8,by+.82,bc.z-3.6);g.add(lp);
        break}
      case 'hdr': g.add(box(b.w,2.5,2.5,M.black,bc.x,top+1.25,bc.z));P.forEach(p=>g.add(box(.64,9,.64,M.gold,p.x,top+4,p.z)));break;
      case 'tact': g.add(box(6,3.5,6,M.black,bc.x,top+1.75,bc.z));g.add(cyl(1.8,6,c.ref==='SW1'?mat(0x2aa15a):mat(0xd9d9d9),bc.x,top+5,bc.z));g.add(box(5,.4,5,M.silver,bc.x,top+3.6,bc.z));break;
      case 'led': {const m=c.ref==='LED1'?M.ledR:M.ledG;g.add(cyl(2.5,6,m,bc.x,top+3+1,bc.z));const s=new THREE.Mesh(new THREE.SphereGeometry(2.5,24,12,0,Math.PI*2,0,Math.PI/2),m);s.position.set(bc.x,top+7,bc.z);g.add(s);g.add(cyl(2.9,1,m,bc.x,top+1.5,bc.z));
        P.forEach(p=>g.add(cyl(.25,1.2,M.silver,p.x,top+.6,p.z,6)));break}
      case 'buzzer': g.add(cyl(6,9.5,M.black,bc.x,top+4.75,bc.z,40));g.add(cyl(1.1,.2,mat(0x050505),bc.x,top+9.55,bc.z));break;
      case 'trim': g.add(box(b.w,10,b.h,M.blue,bc.x,top+5,bc.z));g.add(cyl(1.1,1.2,M.brass,b.x-BW/2+1.6,top+10.5,bc.z));break;
      case 'tb2': {const fl=c.flip?-1:1;g.add(box(b.w,10,b.h,M.tbgreen,bc.x,top+5,bc.z));
        P.forEach(p=>{g.add(cyl(1.5,.6,M.silver,p.x,top+10.2,p.z));const o=box(.6,3.5,3.6,mat(0x0a0a0a),bc.x-fl*b.w/2,top+3,p.z);g.add(o)});break}
      case 'fuse': {P.forEach(p=>g.add(box(4,7,6,M.silver,p.x+(p===P[0]?1:-1),top+3.5,p.z)));
        const gl=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,15,20),new THREE.MeshPhysicalMaterial({color:0xddeeff,transparent:true,opacity:.35,roughness:.05}));gl.rotation.z=Math.PI/2;gl.position.set(mx,top+6,mz);g.add(gl);
        [-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.7,4.5,20),M.silver);e.rotation.z=Math.PI/2;e.position.set(mx+s*9.3,top+6,mz);g.add(e)});
        const w=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,15,6),M.grey);w.rotation.z=Math.PI/2;w.position.set(mx,top+6,mz);g.add(w);break}
    }
    // solder joints on bottom
    P.forEach(p=>{const j=new THREE.Mesh(new THREE.ConeGeometry(.9,1,12),M.silver);j.rotation.x=Math.PI;j.position.set(p.x,-T/2-.45,p.z);g.add(j)});
    g.traverse(o=>{o.userData.ref=c.ref;o.userData.value=c.value});
    parts.add(g);
  });

  // camera controls
  let theta=-0.6,phi=0.95,dist=210;const target=new THREE.Vector3(0,4,0);
  function place(){cam.position.set(target.x+dist*Math.sin(phi)*Math.sin(theta),target.y+dist*Math.cos(phi),target.z+dist*Math.sin(phi)*Math.cos(theta));cam.lookAt(target)}
  const presets={iso:[-0.6,0.95,210],top:[0,0.001,190],bottom:[Math.PI,Math.PI-0.001,190],front:[0,1.32,175]};
  if(opts.dist)dist=+opts.dist;
  document.querySelectorAll('[data-cam]').forEach(b=>b.addEventListener('click',()=>{[theta,phi,dist]=presets[b.dataset.cam];place();}));
  document.getElementById('show3dParts')?.addEventListener('change',e=>parts.visible=e.target.checked);
  const cv=renderer.domElement;const ptrs=new Map();let pinch=0;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});cv.style.cursor='grabbing'});
  cv.addEventListener('pointerup',e=>{ptrs.delete(e.pointerId);pinch=0;cv.style.cursor='grab'});
  cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);pinch=0});
  const tip=host.querySelector('.tip3d')||document.createElement('div'),ray=new THREE.Raycaster(),mv=new THREE.Vector2();
  cv.addEventListener('pointermove',e=>{
    if(ptrs.has(e.pointerId)){
      const p=ptrs.get(e.pointerId);
      if(ptrs.size===2){const a=[...ptrs.values()];p.x=e.clientX;p.y=e.clientY;const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch)dist=Math.min(600,Math.max(50,dist*pinch/d));pinch=d;place();return}
      theta-=(e.clientX-p.x)*0.008;phi=Math.min(Math.PI-0.001,Math.max(0.001,phi-(e.clientY-p.y)*0.008));p.x=e.clientX;p.y=e.clientY;place();tip.hidden=true;return}
    const r=cv.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mv,cam);
    const hit=parts.visible?ray.intersectObjects(parts.children,true)[0]:null;
    if(hit){tip.hidden=false;tip.textContent=`${hit.object.userData.ref} · ${hit.object.userData.value}`;tip.style.left=(e.clientX-r.left)+'px';tip.style.top=(e.clientY-r.top)+'px'}else tip.hidden=true;
  });
  cv.addEventListener('pointerleave',()=>tip.hidden=true);
  if(opts.wheel!=='off')cv.addEventListener('wheel',e=>{e.preventDefault();dist=Math.min(600,Math.max(50,dist*(1+Math.sign(e.deltaY)*0.08)));place()},{passive:false});
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(host);resize();place();
  const spinEl=document.getElementById('spin3d');const spinOn=()=>spinEl?spinEl.checked:opts.spin==='on';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop(){requestAnimationFrame(loop);if(spinOn()&&!reduce){theta+=0.004;place()}renderer.render(scene,cam)})();
}
document.querySelectorAll('.view3d').forEach(v=>init3D(v,v.dataset));
const here=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('nav.site a').forEach(a=>{if(a.getAttribute('href')===here||(here==='index.html'&&a.getAttribute('href')==='./'))a.setAttribute('aria-current','page')});

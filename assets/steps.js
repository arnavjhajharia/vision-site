// Illustration reveals. Each img.ill plays one entrance effect, chosen by data-reveal, once it is ~30% visible,
// then stays finished (scrolling back does not replay). Ink dots are sampled from the image itself; at the end the
// canvas crossfades to the crisp <img>. No JS / reduced motion / any error: the plain image just shows.
// Effects (all draw in place, nothing flies in): scan, bleed, tiles, stroke (brush), ink, develop.
// Ported from terraformlabs.ai/assets/tfl.js (Tacit 'how it works'); particle effects left out.
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var imgs=[].slice.call(document.querySelectorAll('img.ill[data-reveal]'));
  if(RM||!imgs.length||!window.IntersectionObserver||!window.requestAnimationFrame)return;
  var phone=Math.min(screen.width,screen.height)<700;
  var INK=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()||'#16150f';   // the page ink, light or dark
  var TAU=Math.PI*2;
  function clamp(x){return x<0?0:x>1?1:x}
  function oc(x){x=clamp(x);return 1-Math.pow(1-x,3)}
  function ioc(x){x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}

  var FX={};
  var MASK={scan:2100,bleed:2500,tiles:2200,stroke:2800,ink:2800,develop:2600};

  var items=[];
  function setup(img){
    var fig=img.parentNode,eff=img.getAttribute('data-reveal');
    if(!FX[eff]&&!MASK[eff])return;
    if(getComputedStyle(fig).position==='static')fig.style.position='relative';
    var it={img:img,fig:fig,eff:eff,state:0};
    img.classList.add('rv-hide');                         // hidden only once JS is running; restored on any failure
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      it.vis=e.isIntersecting;
      if(it.state===0&&e.intersectionRatio>=.3){it.state=1;ready(img,function(){start(it)})}
    })},{threshold:[0,.3]});
    io.observe(img);it.io=io;
  }
  function ready(img,cb){if(img.complete&&img.naturalWidth)cb();else{img.addEventListener('load',cb,{once:true});img.addEventListener('error',function(){show(img)},{once:true})}}
  function show(img){img.classList.remove('rv-hide');img.style.opacity=''}

  function start(it){
    try{build(it)}catch(e){show(it.img);it.state=3;return}
    it.t0=performance.now();items.push(it);kick();
  }
  function build(it){
    var img=it.img,w=img.offsetWidth,h=img.offsetHeight,d=Math.min(window.devicePixelRatio||1,2);
    var r=img.getBoundingClientRect(),vw=document.documentElement.clientWidth;
    var part=!!FX[it.eff];
    var px=part?Math.max(0,Math.min(w*.12,r.left,vw-r.right)):0,py=part?Math.round(h*.25):0;
    it.w=w;it.h=h;it.px=px;it.py=py;it.d=d;
    var cv=document.createElement('canvas');cv.className='rv-cv';cv.setAttribute('aria-hidden','true');
    var fg=it.fig;if(getComputedStyle(fg).position==='static')fg.style.position='relative';var fr=fg.getBoundingClientRect();var s=cv.style;s.left=(r.left-fr.left-fg.clientLeft-px)+'px';s.top=(r.top-fr.top-fg.clientTop-py)+'px';s.width=(w+2*px)+'px';s.height=(h+2*py)+'px';
    cv.width=Math.round((w+2*px)*d);cv.height=Math.round((h+2*py)*d);
    it.cv=cv;it.ctx=cv.getContext('2d');
    // tinted copy of the art at display size (matches the CSS invert)
    var tc=document.createElement('canvas');tc.width=Math.max(1,Math.round(w*d));tc.height=Math.max(1,Math.round(h*d));
    var tx=tc.getContext('2d');tx.drawImage(img,0,0,tc.width,tc.height);tx.globalCompositeOperation='source-in';tx.fillStyle=INK;tx.fillRect(0,0,tc.width,tc.height);
    it.tint=tc;
    // sample ink dots
    var sw=Math.min(img.naturalWidth,phone?360:520),sh=Math.max(1,Math.round(img.naturalHeight*sw/img.naturalWidth));
    var sc=document.createElement('canvas');sc.width=sw;sc.height=sh;var sx=sc.getContext('2d');sx.drawImage(img,0,0,sw,sh);
    var px4=sx.getImageData(0,0,sw,sh).data,ink=[];
    for(var i=3,j=0;i<px4.length;i+=4,j++)if(px4[i]>110)ink.push(j);
    var N=Math.min(ink.length,part?(phone?2600:6500):(phone?900:1800));
    for(i=0;i<N;i++){var k=i+Math.floor(Math.random()*(ink.length-i)),tmp=ink[i];ink[i]=ink[k];ink[k]=tmp}
    var P=new Float32Array(N*6);
    for(i=0;i<N;i++){var q=ink[i];P[i*6]=((q%sw)+Math.random())/sw*w;P[i*6+1]=(Math.floor(q/sw)+Math.random())/sh*h}
    it.P=P;it.n=N;it.dot=phone?1.5:1.35;
    if(part){FX[it.eff].init(it);it.dur=FX[it.eff].dur}
    else{it.dur=MASK[it.eff];
      it.layer=document.createElement('canvas');it.layer.width=cv.width;it.layer.height=cv.height;
      if(it.eff==='tiles'){var cols=phone?9:16,rows=Math.max(3,Math.round(cols*h/w));it.cols=cols;it.rows=rows;it.td=[];
        for(var y=0;y<rows;y++)for(var x=0;x<cols;x++)it.td.push(((x/cols)*.55+(y/rows)*.25)+Math.random()*.12)}
      if(it.eff==='stroke'){it.lines=phone?6:9}
      if(it.eff==='develop'){for(var z=0;z<N;z++)P[z*6+4]=Math.random()}   // each dot's own moment to appear
      if(it.eff==='ink'){var spec=(img.getAttribute('data-ink')||'.5,.5,0').split(';');it.src=[];   // ink drops: "x,y,delay;x,y,delay" (fractions)
        spec.forEach(function(t){var v=t.split(',').map(parseFloat),sx2=v[0]*w,sy2=v[1]*h;
          it.src.push([sx2,sy2,v[2]||0,Math.max(Math.hypot(sx2,sy2),Math.hypot(w-sx2,sy2),Math.hypot(sx2,h-sy2),Math.hypot(w-sx2,h-sy2))*1.05,Math.random()*TAU])})}
    }
    it.fig.appendChild(cv);
  }

  var out=[0,0];
  function render(it,now){
    var T=(now-it.t0)/it.dur,ctx=it.ctx,d=it.d,w=it.w,h=it.h;
    var fade=clamp((T-.78)/.22);                          // last stretch: crossfade to the real image
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,it.cv.width,it.cv.height);
    if(T>=1){finish(it);return false}
    ctx.setTransform(d,0,0,d,it.px*d,it.py*d);
    var a=1-fade;ctx.globalAlpha=a;ctx.fillStyle=INK;
    if(FX[it.eff]){
      var f=FX[it.eff],P=it.P,n=it.n,s=it.dot,ctxo={cx:w/2,cy:h/2};
      ctx.beginPath();
      for(var i=0;i<n;i++){var o=i*6,q=(T/.82-P[o+4])/(1-P[o+4]*.9);
        if(q<=0&&it.eff!=='rise'&&it.eff!=='spiral')q=0;
        f.pos.call(ctxo,P,o,clamp(q),out);ctx.rect(out[0],out[1],s,s)}
      ctx.fill();
      // bring the engraving's fine hatching in under the dots as they settle
      var g=clamp((T-.55)/.3);if(g>0){ctx.globalAlpha=g*a+0*fade;ctx.drawImage(it.tint,0,0,w,h)}
    }else masked(it,T,ctx,w,h,a);
    it.img.style.opacity=fade;
    return true;
  }
  function masked(it,T,ctx,w,h,a){
    var L=it.layer,lc=L.getContext('2d'),d=it.d,P=it.P,n=it.n,s=it.dot,i,o,p;
    lc.setTransform(1,0,0,1,0,0);lc.globalCompositeOperation='source-over';lc.clearRect(0,0,L.width,L.height);lc.setTransform(d,0,0,d,0,0);
    lc.fillStyle='#fff';
    var dots=[];
    if(it.eff==='scan'){                                   // vertical sweep line left->right, dithered edge
      p=ioc(T/.8);var band=w*.14,x=-band+p*(w+band*1.4);
      var gr=lc.createLinearGradient(x-band,0,x,0);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');
      lc.fillRect(0,0,Math.max(0,x-band),h);lc.fillStyle=gr;lc.fillRect(x-band,0,band,h);
      for(i=0;i<n;i++){o=i*6;var u=(P[o]-(x-band))/band;if(u>0&&u<1.15&&Math.random()>u*.6)dots.push(P[o],P[o+1])}
      ctx.save();ctx.globalAlpha=a*.35;ctx.fillRect(Math.min(x,w-1),0,1,h);ctx.restore();
    }else if(it.eff==='bleed'){                            // ink bleeds out from the centre
      p=ioc(T/.82);var cx=w/2,cy=h/2,R=Math.hypot(cx,cy)*1.05,r=p*R,fe=R*.16;
      var rg=lc.createRadialGradient(cx,cy,Math.max(0,r-fe),cx,cy,r);rg.addColorStop(0,'#fff');rg.addColorStop(1,'rgba(255,255,255,0)');
      lc.fillStyle=rg;lc.fillRect(0,0,w,h);
      for(i=0;i<n;i++){o=i*6;var dd=Math.hypot(P[o]-cx,P[o+1]-cy),u2=(dd-(r-fe))/(fe*1.6);
        if(u2>0&&u2<1&&Math.random()>u2*.7){var k2=1+u2*.12;dots.push(cx+(P[o]-cx)*k2,cy+(P[o+1]-cy)*k2)}}
    }else if(it.eff==='ink'){                              // several ink drops land in turn and soak outwards until they merge
      var S=it.src,rs=[];
      for(var j=0;j<S.length;j++){var sj=S[j],pj=ioc((T/.84-sj[2])/(1-sj[2])),rj=pj*sj[3],fj=sj[3]*.17;rs.push(rj,fj);
        if(rj<=0)continue;var g2=lc.createRadialGradient(sj[0],sj[1],Math.max(0,rj-fj),sj[0],sj[1],rj);
        g2.addColorStop(0,'#fff');g2.addColorStop(1,'rgba(255,255,255,0)');lc.fillStyle=g2;lc.fillRect(0,0,w,h)}
      for(i=0;i<n;i++){o=i*6;var best=9,bj=-1;
        for(j=0;j<S.length;j++){if(rs[j*2]<=0)continue;var sj2=S[j],dj=Math.hypot(P[o]-sj2[0],P[o+1]-sj2[1]),
          wob=1+.06*Math.sin(Math.atan2(P[o+1]-sj2[1],P[o]-sj2[0])*5+sj2[4]),uj=(dj-(rs[j*2]*wob-rs[j*2+1]))/(rs[j*2+1]*1.6);
          if(uj<=0){best=-1;break}if(uj<best){best=uj;bj=j}}
        if(best>0&&best<1&&Math.random()>best*.7){var sb=S[bj],kb=1+best*.12;dots.push(sb[0]+(P[o]-sb[0])*kb,sb[1]+(P[o+1]-sb[1])*kb)}}
    }else if(it.eff==='develop'){                          // develops in place like a photo: dots appear where they belong, then the art fills in
      p=T/.84;var fl=clamp((p-.35)/.55);lc.globalAlpha=ioc(fl);lc.fillRect(0,0,w,h);lc.globalAlpha=1;
      for(i=0;i<n;i++){o=i*6;if(P[o+4]<p*1.5&&fl<1)dots.push(P[o],P[o+1])}
    }else if(it.eff==='tiles'){                            // pixel-grid tiles flip in, diagonal wave
      var cw=w/it.cols,ch=h/it.rows,tw=T/.82;
      for(var y=0;y<it.rows;y++)for(var x2=0;x2<it.cols;x2++){var q=clamp((tw-it.td[y*it.cols+x2])/.3);
        if(q<=0){dots.push(x2*cw+cw/2-1,y*ch+ch/2-1);continue}
        var e=ioc(q),sy=Math.abs(Math.cos((1-e)*Math.PI/2*1)),fy=e;lc.globalAlpha=Math.min(1,.25+e);
        lc.fillRect(x2*cw,y*ch+ch*(1-fy)/2,cw+.6,ch*fy+.6)}
      lc.globalAlpha=1;
    }else if(it.eff==='stroke'){                           // broad brush strokes wipe the art in, row by row
      var nL=it.lines,lh=h/nL;lc.strokeStyle='#fff';lc.lineCap='round';lc.lineWidth=lh*1.45;
      for(i=0;i<nL;i++){var q3=clamp((T/.8-i/nL*.7)/.3);if(q3<=0)continue;var e3=ioc(q3),yy=lh*(i+.5),rev=i%2,
        x0=rev?w+lh:-lh,x1=x0+(rev?-1:1)*(w+2*lh)*e3;
        lc.beginPath();lc.moveTo(x0,yy+(rev?lh*.15:-lh*.15));lc.lineTo(x1,yy+(rev?-lh*.15:lh*.15));lc.stroke();
        for(var m=0;m<14;m++){var bx=x1+(rev?1:-1)*Math.random()*lh*.8;dots.push(bx+(Math.random()-.5)*lh*.4,yy+(Math.random()-.5)*lh*1.3)}}
    }
    lc.globalCompositeOperation='source-in';lc.setTransform(1,0,0,1,0,0);lc.drawImage(it.tint,0,0);
    ctx.globalAlpha=a;ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(L,0,0);ctx.setTransform(d,0,0,d,it.px*d,it.py*d);
    if(dots.length){ctx.beginPath();for(i=0;i<dots.length;i+=2)ctx.rect(dots[i],dots[i+1],s,s);ctx.fill()}
  }
  function finish(it){it.state=2;show(it.img);if(it.cv.parentNode)it.cv.parentNode.removeChild(it.cv);it.io.disconnect();it.P=it.tint=it.layer=null}
  var ticking=false;
  function frame(now){ticking=false;var again=false;
    for(var i=items.length-1;i>=0;i--){var it=items[i];
      if(!it.vis&&now-it.t0<it.dur){continue}          // off-screen mid-play: let time run, skip drawing
      if(!render(it,now))items.splice(i,1)}
    for(i=0;i<items.length;i++){if(!items[i].vis&&now-items[i].t0>=items[i].dur){finish(items[i]);items.splice(i,1);i--}}
    if(items.length)again=true;if(again)kick()}
  function kick(){if(!ticking){ticking=true;requestAnimationFrame(frame)}}
  imgs.forEach(function(img){try{setup(img)}catch(e){show(img)}});
})();

(function(){
  var root=document.documentElement;
  // Événements Google Analytics (aucune donnée personnelle) ; gtag est défini par consent.js
  function track(name,params){try{if(typeof window.gtag==='function')window.gtag('event',name,params||{})}catch(e){}}
  // Onglets
  var tabs=[].slice.call(document.querySelectorAll('[role="tab"]'));
  var byHash={'#etude':'t-etude','#fiduciaire':'t-fid','#registre':'t-reg'};
  var hashOf={};Object.keys(byHash).forEach(function(k){hashOf[byHash[k]]=k});
  var langLinks=[].slice.call(document.querySelectorAll('.lang-menu a'));
  function select(t,user){
    tabs.forEach(function(b){
      var on=b===t;
      b.setAttribute('aria-selected',on);
      b.tabIndex=on?0:-1;
      document.getElementById(b.getAttribute('aria-controls')).hidden=!on;
    });
    var n=document.querySelector('.notions');if(n)n.hidden=(t.id==='t-reg');
    try{localStorage.setItem('lba-onglet',t.id)}catch(e){}
    // Les liens de langue gardent l'onglet ouvert
    langLinks.forEach(function(a){a.hash=hashOf[t.id]||''});
    if(user){
      track('lba_tab_select',{tree:(hashOf[t.id]||'').slice(1)});
      try{history.replaceState(null,'',hashOf[t.id]||location.pathname)}catch(e){}
      var tb=document.querySelector('.tabbar');
      if(tb&&tb.getBoundingClientRect().top<=1)window.scrollTo({top:tb.offsetTop,behavior:'auto'});
    }
  }
  tabs.forEach(function(b,i){
    b.addEventListener('click',function(){select(b,true)});
    b.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
        var n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
        select(n,true);n.focus();
      }
    });
  });
  var initial=byHash[location.hash];
  if(!initial&&!location.hash){try{initial=localStorage.getItem('lba-onglet')}catch(e){}}
  var t=initial&&document.getElementById(initial);if(t)select(t,false);
  // Un lien vers une notion (#n-…) masquée par l'onglet « registre » rouvre le premier onglet
  window.addEventListener('hashchange',function(){
    var id=byHash[location.hash];
    if(id){select(document.getElementById(id),false);return}
    var el=location.hash&&document.getElementById(location.hash.slice(1));
    if(el&&el.closest('[hidden]')&&tabs[0]){select(tabs[0],false);el.scrollIntoView()}
  });

  // Fin d'un arbre : le verdict final est affiché à l'écran (une fois par arbre et par page vue)
  if('IntersectionObserver' in window){
    var seenTree={};
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting)return;
        var panel=e.target.closest('[role="tabpanel"]'),tab=panel&&document.querySelector('[aria-controls="'+panel.id+'"]');
        var tree=tab&&(hashOf[tab.id]||'').slice(1);
        if(!tree||seenTree[tree]||panel.hidden)return;
        seenTree[tree]=true;io.unobserve(e.target);
        track('lba_tree_complete',{tree:tree,outcome:e.target.classList.contains('due')?'deadline':'adviser'});
      });
    },{threshold:0.4});
    [].forEach.call(document.querySelectorAll('[role="tabpanel"] .verdict'),function(v){io.observe(v)});
  }

  // Menus (<details>) : un seul ouvert, fermeture au clic extérieur et avec Échap
  var menus=[].slice.call(document.querySelectorAll('details.menu'));
  menus.forEach(function(m){m.addEventListener('toggle',function(){if(m.open)menus.forEach(function(o){if(o!==m)o.open=false})})});
  document.addEventListener('click',function(e){menus.forEach(function(m){if(m.open&&!m.contains(e.target))m.open=false})});
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    menus.forEach(function(m){if(m.open){m.open=false;m.querySelector('summary').focus()}});
  });

  // Thème : clair / sombre / système
  var theme=document.querySelector('details.theme');
  if(theme){
    var items=[].slice.call(theme.querySelectorAll('[data-theme-value]'));
    var get=function(){try{var v=localStorage.getItem('lba-theme');return v==='light'||v==='dark'?v:'system'}catch(e){return 'system'}};
    var apply=function(v){
      if(v==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',v);
      items.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.themeValue===v)});
    };
    apply(get());
    theme.hidden=false;
    items.forEach(function(b){b.addEventListener('click',function(){
      var v=b.dataset.themeValue;
      try{if(v==='system')localStorage.removeItem('lba-theme');else localStorage.setItem('lba-theme',v)}catch(e){}
      apply(v);theme.open=false;theme.querySelector('summary').focus();
    })});
  }

  // Bandeau cookies (mêmes valeurs que ark-fid.ch : accepted / minimal), puis l'avertissement :
  // un seul bandeau à la fois.
  var KEY='cookieConsent';
  var cookies=document.querySelector('.cookies');
  var notice=document.querySelector('.disclaimer-notice');
  // Même règle que ark-fid.ch : le cookie partagé .ark-fid.ch (ark_consent) d'abord, puis le cookie
  // de ce domaine ; le localStorage seulement si les cookies sont bloqués.
  function ok(v){return v==='accepted'||v==='minimal'||v==='declined'}
  function sharedCookie(value){
    var h=location.hostname,d=(h==='ark-fid.ch'||/\.ark-fid\.ch$/.test(h))?'; Domain=.ark-fid.ch':'';
    return 'ark_consent='+value+'; Path=/; Max-Age=31536000; SameSite=Lax'+d+(location.protocol==='https:'?'; Secure':'');
  }
  function stored(){
    var c=null,k=null,l=null,ce=true;
    try{var n=document.cookie.match(/(?:^|; )ark_consent=([^;]*)/);if(n)k=n[1];var m=document.cookie.match(/(?:^|; )cookieConsent=([^;]*)/);if(m)c=m[1]}catch(e){}
    try{l=localStorage.getItem(KEY)}catch(e){}
    try{ce=navigator.cookieEnabled!==false}catch(e){}
    if(ok(k))return k;
    if(ok(c)){try{document.cookie=sharedCookie(c)}catch(e){}return c}
    return !ce&&ok(l)?l:null;
  }
  function showNotice(){
    if(!notice)return;
    var seen=false;try{seen=localStorage.getItem('lba-avis')==='1'}catch(e){}
    notice.hidden=seen||!!(cookies&&!cookies.hidden);
  }
  function update(value){
    var v=value==='accepted'?'granted':'denied';
    try{if(typeof window.gtag==='function')window.gtag('consent','update',{ad_storage:v,analytics_storage:v,ad_user_data:v,ad_personalization:v})}catch(e){}
  }
  function choose(value){
    try{document.cookie=sharedCookie(value)}catch(e){}
    try{document.cookie=KEY+'='+value+'; Path=/; Max-Age=31536000; SameSite=Lax'}catch(e){}
    try{localStorage.setItem(KEY,value)}catch(e){}
    update(value);
    cookies.hidden=true;showNotice();
    // Le bouton cliqué disparaît : le focus passe au bandeau suivant s'il s'affiche
    var next=notice&&!notice.hidden?notice.querySelector('.notice-ok'):document.querySelector('.cookie-manage');
    if(next)next.focus({preventScroll:true});
  }
  if(cookies){
    cookies.querySelector('.cookie-accept').addEventListener('click',function(){choose('accepted')});
    cookies.querySelector('.cookie-refuse').addEventListener('click',function(){choose('minimal')});
    if(!stored())cookies.hidden=false;
    // Choix fait dans un autre onglet : même mise à jour ici
    window.addEventListener('storage',function(e){
      if(e.key!==KEY||!(e.newValue==='accepted'||e.newValue==='minimal'||e.newValue==='declined'))return;
      update(e.newValue);cookies.hidden=true;showNotice();
    });
    var manage=document.querySelector('.cookie-manage');
    if(manage)manage.addEventListener('click',function(){
      if(notice)notice.hidden=true;
      cookies.hidden=false;cookies.querySelector('.cookie-accept').focus();
    });
  }
  if(notice){
    notice.querySelector('.notice-ok').addEventListener('click',function(){
      notice.hidden=true;try{localStorage.setItem('lba-avis','1')}catch(e){}
    });
    showNotice();
  }
})();

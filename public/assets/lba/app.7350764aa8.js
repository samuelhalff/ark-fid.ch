(function(){
  var root=document.documentElement;
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

  // Avertissement : affiché jusqu'à ce qu'il soit fermé
  var notice=document.querySelector('.notice');
  if(notice){
    var seen=false;try{seen=localStorage.getItem('lba-avis')==='1'}catch(e){}
    if(!seen){
      notice.hidden=false;
      notice.querySelector('.notice-ok').addEventListener('click',function(){
        notice.hidden=true;try{localStorage.setItem('lba-avis','1')}catch(e){}
      });
    }
  }
})();

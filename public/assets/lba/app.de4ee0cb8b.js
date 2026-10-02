(function(){
  var root=document.documentElement;
  // Onglets
  var tabs=[].slice.call(document.querySelectorAll('[role="tab"]'));
  var byHash={'#etude':'t-etude','#fiduciaire':'t-fid','#registre':'t-reg'};
  var hashOf={};Object.keys(byHash).forEach(function(k){hashOf[byHash[k]]=k});
  var langLinks=[].slice.call(document.querySelectorAll('.langs a'));
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

  // Thème : système → clair → sombre
  var btn=document.querySelector('.theme');
  if(btn){
    var order=['system','light','dark'];
    var label=btn.querySelector('.sr');
    var get=function(){try{var v=localStorage.getItem('lba-theme');return order.indexOf(v)>0?v:'system'}catch(e){return 'system'}};
    var apply=function(v){
      if(v==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',v);
      btn.dataset.mode=v;
      var text=btn.dataset.label+' : '+btn.dataset[v];
      btn.title=text;if(label)label.textContent=text;
    };
    apply(get());
    btn.hidden=false;
    btn.addEventListener('click',function(){
      var v=order[(order.indexOf(get())+1)%order.length];
      try{if(v==='system')localStorage.removeItem('lba-theme');else localStorage.setItem('lba-theme',v)}catch(e){}
      apply(v);
    });
  }
})();

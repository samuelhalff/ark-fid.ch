(function(){
  var tabs=[].slice.call(document.querySelectorAll('[role="tab"]'));
  function select(t){
    tabs.forEach(function(b){
      var on=b===t;
      b.setAttribute('aria-selected',on);
      b.tabIndex=on?0:-1;
      document.getElementById(b.getAttribute('aria-controls')).hidden=!on;
    });
    try{localStorage.setItem('lba-onglet',t.id)}catch(e){}
  }
  tabs.forEach(function(b,i){
    b.addEventListener('click',function(){select(b)});
    b.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
        var n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
        select(n);n.focus();
      }
    });
  });
  try{var s=localStorage.getItem('lba-onglet');var t=s&&document.getElementById(s);if(t)select(t);}catch(e){}
  var hs={'#fiduciaire':'t-fid','#etude':'t-etude'}[location.hash];if(hs)select(document.getElementById(hs));
})();

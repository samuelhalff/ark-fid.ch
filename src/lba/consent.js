// Google Analytics with Consent Mode v2, same rules as ark-fid.ch (src/lib/consent-mode.ts).
// Loaded first in <head>, before any gtag 'js'/'config' or event. The build fills in the
// measurement id and the EEA + UK region list from src/lib/consent-mode.ts.
(function(){
  var ID='__GA_ID__',EEA_UK=__EEA_UK__,KEY='cookieConsent';
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments)}
  window.gtag=gtag;
  function state(v){return {ad_storage:v,analytics_storage:v,ad_user_data:v,ad_personalization:v}}
  var denied=state('denied'),granted=state('granted'),ch=state('denied');ch.analytics_storage='granted';
  // Most specific region wins; no region = rest of the world.
  var eea=state('denied');eea.region=EEA_UK;gtag('consent','default',eea);
  ch.region=['CH'];gtag('consent','default',ch);
  gtag('consent','default',granted);
  gtag('set','ads_data_redaction',true);
  // A saved choice overrides the regional default. Same rule as the main site (pickStoredConsent):
  // the cookie shared by all ark-fid.ch hosts (ark_consent) wins, then this host's cookie; the
  // localStorage mirror only counts where cookies cannot be stored.
  function ok(v){return v==='accepted'||v==='minimal'||v==='declined'}
  var c=null,k=null,l=null,ce=true;
  try{var n=document.cookie.match(/(?:^|; )ark_consent=([^;]*)/);if(n)k=n[1];var m=document.cookie.match(/(?:^|; )cookieConsent=([^;]*)/);if(m)c=m[1]}catch(e){}
  try{l=localStorage.getItem(KEY)}catch(e){}
  try{ce=navigator.cookieEnabled!==false}catch(e){}
  if(ok(k))c=k;else if(!ok(c))c=(!ce&&ok(l))?l:null;
  if(c==='accepted')gtag('consent','update',granted);
  else if(c==='minimal'||c==='declined')gtag('consent','update',denied);
  gtag('js',new Date());
  // cookie_domain auto: the _ga cookie is set on ark-fid.ch, shared with the main site.
  gtag('config',ID,{cookie_domain:'auto'});
  var s=document.createElement('script');s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ID);
  (document.head||document.documentElement).appendChild(s);
})();

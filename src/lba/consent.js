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
  // A saved choice (same key and values as the main site banner) overrides the regional default.
  var c=null;
  try{c=localStorage.getItem(KEY)}catch(e){}
  if(!c){try{var m=document.cookie.match(/(?:^|; )cookieConsent=([^;]*)/);if(m)c=m[1]}catch(e){}}
  if(c==='accepted')gtag('consent','update',granted);
  else if(c==='minimal'||c==='declined')gtag('consent','update',denied);
  gtag('js',new Date());
  // cookie_domain auto: the _ga cookie is set on ark-fid.ch, shared with the main site.
  gtag('config',ID,{cookie_domain:'auto'});
  var s=document.createElement('script');s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ID);
  (document.head||document.documentElement).appendChild(s);
})();

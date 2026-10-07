(function(){
  var root=document.querySelector('.chat');
  var launcher=document.querySelector('.chat-open');
  if(!root||!launcher||!window.fetch)return;
  var API='/api/lba/chat/';
  var cfg=JSON.parse(root.getAttribute('data-chat'));
  var locale=document.documentElement.lang.slice(0,2);
  var log=root.querySelector('.chat-log');
  var form=root.querySelector('.chat-form');
  var input=form.querySelector('textarea');
  var sendBtn=form.querySelector('.chat-send');
  var tsBox=root.querySelector('.chat-turnstile');
  var KEY='lba-chat-v1';
  var state={messages:[],session:'',email:''};
  try{var saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.messages))state=saved}catch(e){}
  var busy=false,siteKey=null,widgetId=null,tsLoading=null,lastQuestion='';

  function save(){try{sessionStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}

  // Rendu minimal et sûr : texte uniquement, **gras**, listes « - », liens https vers des hôtes connus.
  var LINK_HOSTS=/^https:\/\/([a-z0-9-]+\.)*(admin\.ch|parlament\.ch|ark-fid\.ch)(\/|$)/i;
  function inline(parent,text){
    var re=/(\*\*([^*\n]+)\*\*)|(\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\))|(https:\/\/[^\s<>()]+[^\s<>().,;:!?])/g,last=0,m;
    while((m=re.exec(text))){
      if(m.index>last)parent.appendChild(document.createTextNode(text.slice(last,m.index)));
      if(m[1])parent.appendChild(el('strong',null,m[2]));
      else{
        var url=m[5]||m[6],label=m[4]||m[6];
        if(LINK_HOSTS.test(url)){var a=el('a',null,label);a.href=url;a.rel='noopener';a.target='_blank';parent.appendChild(a)}
        else parent.appendChild(document.createTextNode(label));
      }
      last=re.lastIndex;
    }
    if(last<text.length)parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function render(container,text,disclaimer){
    var body=text,tail='';
    if(disclaimer&&text.slice(-disclaimer.length)===disclaimer){body=text.slice(0,-disclaimer.length).trim();tail=disclaimer}
    // Ligne par ligne : les lignes « - … » consécutives forment une liste, le reste des paragraphes.
    var bullet=/^\s*([-•*]|\d+[.)])\s+/,ul=null,p=null;
    body.split('\n').forEach(function(line){
      if(!line.trim()){ul=null;p=null;return}
      if(bullet.test(line)){
        p=null;if(!ul){ul=el('ul');container.appendChild(ul)}
        var li=el('li');inline(li,line.replace(bullet,''));ul.appendChild(li);
      }else{
        ul=null;
        if(!p){p=el('p');container.appendChild(p)}else p.appendChild(el('br'));
        inline(p,line.replace(/^#+\s*/,''));
      }
    });
    if(tail)container.appendChild(el('p','chat-disclaimer',tail));
  }

  function bubble(role,text,disclaimer){
    var item=el('div','chat-msg chat-'+role);
    item.appendChild(el('span','chat-who',role==='user'?cfg.you:cfg.assistant));
    var body=el('div','chat-body');
    if(role==='user')body.textContent=text;else render(body,text,disclaimer);
    item.appendChild(body);log.appendChild(item);
    return item;
  }
  // Première question : l'e-mail est demandé (une seule fois par session)
  var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function emailField(){
    var box=el('div','chat-email');
    var label=el('label',null,cfg.emailLabel);label.htmlFor='chat-email';
    var field=el('input');field.type='email';field.id='chat-email';field.name='email';field.required=true;
    field.autocomplete='email';field.inputMode='email';field.placeholder=cfg.emailPlaceholder;field.maxLength=200;
    field.value=state.email||'';
    field.setAttribute('aria-describedby','chat-email-help');
    field.addEventListener('input',function(){state.email=field.value.trim();save();field.removeAttribute('aria-invalid');var e=box.querySelector('.chat-email-error');if(e)e.remove()});
    var help=el('p','chat-email-help',cfg.emailHelp+' ');help.id='chat-email-help';
    var link=el('a',null,cfg.privacyLink);link.href=cfg.privacyUrl;link.target='_blank';link.rel='noopener';help.appendChild(link);
    box.appendChild(label);box.appendChild(field);box.appendChild(help);
    return box;
  }
  function emailOk(){
    if(state.session)return true;
    var email=(state.email||'').trim();
    if(EMAIL_RE.test(email))return true;
    emailError();return false;
  }
  function emailError(){
    if(!log.querySelector('.chat-email')){
      // La conversation a déjà commencé (session expirée) : on redemande l'e-mail en bas du fil.
      log.appendChild(emailField());
    }
    var box=log.querySelector('.chat-email'),field=box.querySelector('input');
    if(!box.querySelector('.chat-email-error')){var e=el('p','chat-email-error',cfg.errorEmail);e.setAttribute('role','alert');box.appendChild(e)}
    field.setAttribute('aria-invalid','true');log.scrollTop=Math.max(0,box.offsetTop-log.offsetTop-10);field.focus({preventScroll:true});
  }
  function scrollDown(){log.scrollTop=log.scrollHeight}
  function draw(){
    log.textContent='';
    if(!state.messages.length){
      var intro=el('div','chat-intro');
      intro.appendChild(el('p',null,cfg.intro));
      if(!state.session)intro.appendChild(emailField());
      var list=el('div','chat-suggestions');
      cfg.suggestions.forEach(function(q){
        var b=el('button',null,q);b.type='button';
        b.addEventListener('click',function(){ask(q)});
        list.appendChild(b);
      });
      intro.appendChild(list);log.appendChild(intro);
    }
    state.messages.forEach(function(m){bubble(m.role,m.content,m.disclaimer)});
    scrollDown();
  }
  function status(text,kind,retry){
    var old=log.querySelector('.chat-status');if(old)old.remove();
    if(!text)return;
    var s=el('div','chat-status'+(kind?' chat-'+kind:''));
    s.setAttribute('role',kind==='error'?'alert':'status');
    s.appendChild(el('span',null,text));
    if(retry){var b=el('button',null,cfg.retry);b.type='button';b.addEventListener('click',retry);s.appendChild(b)}
    log.appendChild(s);scrollDown();
  }
  function setBusy(v){busy=v;sendBtn.disabled=v;input.readOnly=v;root.classList.toggle('is-busy',v)}

  // Turnstile : chargé à la première question seulement
  function loadConfig(){
    if(siteKey!==null)return Promise.resolve();
    return fetch(API,{headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(c){siteKey=c.turnstileSiteKey||''});
  }
  function loadTurnstile(){
    if(window.turnstile)return Promise.resolve();
    if(!tsLoading)tsLoading=new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async=true;s.onload=resolve;s.onerror=function(){tsLoading=null;reject(new Error('turnstile_load'))};
      document.head.appendChild(s);
    });
    return tsLoading;
  }
  function humanToken(){
    return loadConfig().then(function(){
      if(!siteKey)return '';
      return loadTurnstile().then(function(){
        return new Promise(function(resolve,reject){
          var done=false,timer=setTimeout(function(){if(!done){done=true;reject(new Error('turnstile_timeout'))}},60000);
          var finish=function(fn,v){if(done)return;done=true;clearTimeout(timer);fn(v)};
          var options={sitekey:siteKey,size:'flexible',theme:'auto',language:locale,
            callback:function(t){finish(resolve,t)},
            'error-callback':function(){finish(reject,new Error('turnstile_error'))},
            'expired-callback':function(){finish(reject,new Error('turnstile_expired'))}};
          tsBox.hidden=false;
          if(widgetId===null)widgetId=window.turnstile.render(tsBox,options);
          else window.turnstile.reset(widgetId);
          // Après un reset, le rappel d'origine ne sert plus : on interroge le widget.
          if(widgetId!==null){var poll=setInterval(function(){
            if(done){clearInterval(poll);return}
            var t=window.turnstile.getResponse(widgetId);if(t){clearInterval(poll);finish(resolve,t)}
          },400)}
        });
      });
    });
  }

  function post(payload){
    var controller=new AbortController();
    var timer=setTimeout(function(){controller.abort()},90000);
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(d){return {status:r.status,data:d}})})
      .finally(function(){clearTimeout(timer)});
  }
  function send(retriedVerify){
    var history=state.messages.slice(-12).map(function(m){var c=m.role==='assistant'&&m.disclaimer?m.content.slice(0,-m.disclaimer.length).trim():m.content;return {role:m.role,content:c.slice(0,5800)}});
    while(history.length&&history[0].role!=='user')history.shift();
    var payload={locale:locale,messages:history};
    var ready=state.session?Promise.resolve(''):humanToken();
    return ready.then(function(token){
      if(state.session)payload.session=state.session;else{payload.turnstileToken=token;payload.email=(state.email||'').trim()}
      return post(payload);
    }).then(function(res){
      tsBox.hidden=true;
      var d=res.data||{};
      if(d.session){state.session=d.session;save()}
      if(res.status===200&&d.reply){
        state.messages.push({role:'assistant',content:d.reply,disclaimer:d.disclaimer||''});save();
        status('');bubble('assistant',d.reply,d.disclaimer||'');scrollDown();return;
      }
      if((d.error==='turnstile_required'||d.error==='email_required')&&!retriedVerify){state.session='';save();if(!emailOk()){var ee=new Error('email');ee.code='invalid_email';throw ee}return send(true)}
      var e=new Error(d.error||'agent_error');e.code=d.error;throw e;
    });
  }
  function run(){
    setBusy(true);status(cfg.thinking,'thinking');
    send(false).catch(function(err){
      var code=err&&err.code,msg=cfg.errorGeneric;
      if(code==='rate_limited'||code==='session_limit')msg=cfg.errorRate;
      else if(code==='turnstile_failed'||/^turnstile_/.test(err&&err.message||''))msg=cfg.errorVerify;
      else if(code==='payload_too_large')msg=cfg.errorLong;
      else if(code==='invalid_email'){tsBox.hidden=true;status('');var popped=state.messages.pop();save();draw();var q=(popped&&popped.role==='user'&&popped.content)||lastQuestion;input.value=q||'';grow();emailError();return}
      tsBox.hidden=true;
      status(msg,'error',run);
    }).then(function(){setBusy(false);if(root.classList.contains('is-open'))input.focus()});
  }
  function ask(text){
    text=(text||'').trim();
    if(!text||busy)return;
    if(text.length>1500){status(cfg.errorLong,'error');return}
    if(!emailOk()){input.value=text;grow();return}
    lastQuestion=text;
    var intro=log.querySelector('.chat-intro');if(intro)intro.remove();
    var leftover=log.querySelector('.chat-email');if(leftover)leftover.remove();
    state.messages.push({role:'user',content:text});save();
    bubble('user',text);input.value='';grow();
    run();
  }
  function grow(){
    // scrollHeight ignores the border: add it back, or the box is 2px short and shows a scrollbar.
    input.style.height='auto';
    var border=input.offsetHeight-input.clientHeight,wanted=input.scrollHeight+border;
    input.style.height=Math.min(wanted,140)+'px';
    input.style.overflowY=wanted>140?'auto':'hidden';
  }

  form.addEventListener('submit',function(e){e.preventDefault();ask(input.value)});
  input.addEventListener('input',grow);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask(input.value)}});
  root.querySelector('.chat-reset').addEventListener('click',function(){
    if(busy)return;
    state.messages=[];save();draw();input.focus();
  });

  function open(v,restored){
    root.classList.toggle('is-open',v);root.hidden=!v;
    launcher.setAttribute('aria-expanded',v);
    document.documentElement.classList.toggle('chat-on',v);
    try{sessionStorage.setItem(KEY+'-open',v?'1':'')}catch(e){}
    if(v){draw();
      // Une question restée sans réponse (rechargement en cours d'envoi) peut être relancée.
      var last=state.messages[state.messages.length-1];
      if(last&&last.role==='user'&&!busy)status(cfg.errorGeneric,'error',run);
      if(!restored)input.focus();
    }else launcher.focus();
  }
  launcher.addEventListener('click',function(){open(root.hidden)});
  root.querySelector('.chat-close').addEventListener('click',function(){open(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!root.hidden&&root.contains(document.activeElement))open(false)});
  launcher.hidden=false;
  try{if(sessionStorage.getItem(KEY+'-open')==='1')open(true,true)}catch(e){}
})();

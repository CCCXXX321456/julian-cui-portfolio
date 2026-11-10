/* GSAP 3.15.0. Portfolio content: Cui Xuan. */
(() => {
  'use strict';
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const G=window.gsap,ST=window.ScrollTrigger;
  if(G&&ST)G.registerPlugin(ST);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 820px)');
  const frame=$('.home'),band=$('.project-window'),stage=$('.project-track');
  const panel=$('#panel'),scroll=$('.panel-scroll'),content=$('.panel-content');
  const lightbox=$('#lightbox'),motionButton=$('.motion-control'),softwareTrack=$('.software-track');
  // Negative offset velocity feeds the film from the top towards the bottom.
  const state={offset:0,velocity:0,pace:-18};
  let data,sourceData=null,projects=[],cards=[],paused=false,drag=null;
  let suppressClickUntil=0,activeProject=-1,caseContext=null,panelMode='',panelClosing=false;
  let needsDraw=true,lastFallback=0,refreshTimer=0,toastTimer=0,entrancePlayed=false,aboutCleanup=null;
  let cycle=1,step=1,homeScale=1,filmReady=false,softwareCycle=1,softwareOffset=0,hovering=false,focused=false,softwareHover=false;
  let language='en';try{language=localStorage.getItem('cui-xuan-language')==='zh'?'zh':'en';}catch{}
  const mod=(n,span)=>(n%span+span)%span;
  const filmSlot=index=>projects.length-1-index;
  const duration=seconds=>reduced.matches?0:seconds;
  const uiEnglish={
    '作品仅供在线浏览，请勿下载或转载。':'For online viewing only. Please do not download or redistribute.',
    '全部作品':'All work','关闭':'Close','关闭详情':'Close details','关闭大图':'Close image','作品图片大图':'Project image',
    '从研究到落地，':'Across products,','也从工业走向日常。':'systems and stories.',
    '8 个设计项目与 2 个 AIGC 工作流案例，记录工业造型、数字孪生、适老产品、数字交互与角色视觉的探索过程。':'Eight design projects and two generative-AI case studies, spanning industrial products, digital twins, assisted living, interaction design and character visuals.',
    '你好，':'Hello,','我是崔轩。':'I’m Cui Xuan.','把想法落到可感知的细节。':'Making ideas tangible through thoughtful details.',
    '工业设计 / 数字孪生 / 交互体验':'Industrial design / Digital twins / Interaction design',
    '技术美术 / 游戏引擎开发 / AIGC / UI 设计':'Technical art / Game engine development / AIGC / UI design',
    '往下看看我的经历':'Explore my experience','学习经历':'Education','实习经历':'Internships','设计与项目经历':'Design & project experience',
    '技能与工具':'Skills & tools','论文与出版':'Research & publications','专利成果':'Patents','获奖记录':'Recognition','学习与校园经历':'Learning & campus life','工作之外':'Beyond work',
    '崔轩的个人照片':'Photos of Cui Xuan','照片轮播':'Photo carousel','个人照片，可拖动或使用左右方向键切换':'Personal photos. Drag or use the left and right arrow keys to explore.',
    '上一张照片':'Previous photo','下一张照片':'Next photo','选择照片':'Choose a photo','暂停照片轮播':'Pause photo slideshow','播放照片轮播':'Play photo slideshow',
    '暂停':'Pause','播放':'Play','静态':'Static','已开启减弱动画，照片仅手动切换':'Reduced motion enabled. Change photos manually.',
    '拖动切换 · 也可以慢慢看':'Drag to browse, at your own pace','查看原图 ↗':'Enlarge photo ↗',
    '有一个想法？':'Have an idea?','我们聊聊。':'Let’s talk.',
    '关于工业造型、数字孪生、交互体验，':'About industrial design, digital twins, interactions,','或是一个还在酝酿中的设计问题。':'or a design question still taking shape.',
    '复制邮箱地址':'Copy email address','邮箱地址已复制':'Email address copied','崔轩 / CUI XUAN':'CUI XUAN',
    '← 上一个项目':'← Previous project','下一个项目 →':'Next project →',
    '请使用支持 HTML5 视频的浏览器观看。':'Please use a browser that supports HTML5 video.',
    '内容暂时无法加载':'Content is temporarily unavailable','作品暂时无法加载，请刷新页面重试。':'Projects could not load. Please refresh and try again.',
    '暂停动效':'Pause motion','继续动效':'Resume motion','查看项目':'View project'
  };
  function t(text){
    text=String(text??'');if(language==='zh')return text;
    const englishName=value=>value.replace(/\bCui Xuan\b/g,'Julian Cui').replace(/\bCUI XUAN\b/g,'JULIAN CUI');
    const direct=sourceData?.translations?.en?.[text]??uiEnglish[text];if(direct!==undefined)return englishName(direct);
    if(text.startsWith('放大：'))return 'Enlarge: '+t(text.slice(3));
    if(text.startsWith('查看'))return 'View '+t(text.slice(2));
    const photo=text.match(/^第\s*(\d+)\s*张[：:](.*)$/);if(photo)return `Photo ${photo[1]}: ${t(photo[2])}`;
    return englishName(text);
  }
  function localize(value){
    if(Array.isArray(value))return value.map(localize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='translations').map(([key,v])=>[key,localize(v)]));
    return typeof value==='string'?t(value):value;
  }
  function localizeDOM(root){
    if(language==='zh')return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){if(node.parentElement?.closest('[data-language]'))continue;const trimmed=node.nodeValue.trim();if(trimmed){const translated=t(trimmed);if(translated!==trimmed)node.nodeValue=node.nodeValue.replace(trimmed,translated);}}
    $$('*',root).forEach(el=>{if(el.matches('[data-language]'))return;for(const attr of ['aria-label','alt','title','aria-roledescription']){if(el.hasAttribute(attr))el.setAttribute(attr,t(el.getAttribute(attr)));}});
  }
  function applyStaticCopy(){
    const zh=language==='zh';document.documentElement.lang=zh?'zh-CN':'en';
    document.title=zh?'崔轩 · 技术美术与设计':'Julian Cui — Technical Artist & Designer';
    $('meta[name="description"]').content=zh?'崔轩的技术美术、游戏引擎开发、AIGC、UI 与工业设计作品集。':'Julian Cui — technical art, game engine development, AIGC, UI and industrial design.';
    $('.profile-name').textContent=zh?'崔轩':'Julian Cui';
    $('.profile-role').textContent=zh?'技术美术 · 设计师':'Technical artist & designer';
    $('.profile-button').setAttribute('aria-label',zh?'关于崔轩':'About Julian Cui');
    $('.profile-button img').alt=zh?'崔轩':'Julian Cui';
    $('.project-machine').setAttribute('aria-label',zh?'精选项目':'Selected projects');
    $('.hero-heading').innerHTML=zh?'<span>为实体产品设计，</span><span>也为数字体验设计。</span>':'<span>Designing products</span><span>& digital experiences.</span>';
    $('.hero-disciplines').textContent=zh?'游戏引擎开发 / AIGC 设计 / UI 设计':'Game engine development / AIGC / UI design';
    $('.hero-lead').innerHTML=zh?'以技术美术与设计为纽带，连接工业产品和数字体验。<br>从游戏引擎开发、数字孪生到 AIGC 与 UI 设计，<br>把想法转化为可感知、可交互的作品。':'I connect design and technical art across products<br>and digital experiences—from game engine development<br>and digital twins to AIGC and UI design.';
    $('.hero-email').href='mailto:'+(data?.email||'Juliantrae@163.com');
    $('.hero-email').textContent=data?.email||'Juliantrae@163.com';
    $('.explore-projects').textContent=zh?'查看精选项目':'View selected work';
    $('.about-link').textContent=zh?'关于我与我的经历':'About & experience';
    $('.software-title').textContent=zh?'常用软件与工具':'Tools I work with';
    $('.software-description').textContent=zh?'设计、建模、开发、原型与视觉探索。':'Design, build, prototype & explore.';
    $('.software-block').setAttribute('aria-label',zh?'软件与工具':'Software and tools');
    $('.machine-instruction').textContent=zh?'滚动浏览项目':'SCROLL TO EXPLORE';
    band.setAttribute('aria-label',zh?'精选项目。滚动、拖动或用上下方向键浏览，点击查看详情。':'Selected projects. Scroll, drag or use the up and down arrow keys to explore.');
    $('.copyright').textContent=zh?'© 2026 崔轩。保留所有权利。':'© 2026 Julian Cui. All rights reserved.';
    $('.back-to-work').innerHTML=t('全部作品')+' <span aria-hidden="true">↗</span>';
    $('.close-panel').innerHTML=t('关闭')+' <span aria-hidden="true">×</span>';$('.close-panel').setAttribute('aria-label',t('关闭详情'));
    $('.lightbox-close').textContent=t('关闭')+' ×';$('.lightbox-close').setAttribute('aria-label',t('关闭大图'));lightbox.setAttribute('aria-label',t('作品图片大图'));
    $$('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===language)));
    updatePause();
  }
  function setLanguage(next){
    if(!['en','zh'].includes(next)||next===language||panelClosing)return;
    const ratio=scroll.scrollHeight>scroll.clientHeight?scroll.scrollTop/(scroll.scrollHeight-scroll.clientHeight):0;
    const mode=panel.open?panelMode:'';const id=activeProject>=0?projects[activeProject]?.id:null;
    language=next;try{localStorage.setItem('cui-xuan-language',language);}catch{}
    if(!sourceData){applyStaticCopy();return;}
    cleanCase();data=localize(sourceData);projects=data.projects;applyStaticCopy();createCards();
    if(mode==='project')openProject(Math.max(0,projects.findIndex(p=>p.id===id)));else if(mode==='collection')openCollection();else if(mode==='about')openAbout();else if(mode==='contact')openContact();
    if(mode)requestAnimationFrame(()=>{scroll.scrollTop=ratio*(scroll.scrollHeight-scroll.clientHeight);});
  }
  const imageHTML=(image,{eager=false,extraClass='',fit='',position=''}={})=>`<img draggable="false" class="${extraClass}" src="${escape(image.src)}" width="${image.width}" height="${image.height}" alt="${escape(image.caption||'')}" loading="${eager?'eager':'lazy'}" decoding="async" ${eager?'fetchpriority="high"':''} ${(fit||position)?`style="${fit?`object-fit:${escape(fit)};`:''}${position?`object-position:${escape(position)};`:''}"`:''}>`;
  const mediaTarget=target=>target instanceof Element&&target.closest('img,video,.image-button,.project-card,.case-video');
  document.addEventListener('contextmenu',event=>{if(mediaTarget(event.target)){event.preventDefault();toast('作品仅供在线浏览，请勿下载或转载。');}},{capture:true});
  document.addEventListener('dragstart',event=>{if(mediaTarget(event.target))event.preventDefault();},{capture:true});
  function resize(){
    homeScale=innerWidth>=1600&&innerHeight>=900?Math.min(innerWidth/1600,innerHeight/900):1;
    frame.style.setProperty('--home-scale',String(homeScale));
    const previousStep=step;
    step=(stage.firstElementChild?.getBoundingClientRect().height||0)/homeScale||band.clientWidth*.75||1;
    cycle=Math.max(1,step*projects.length);
    if(projects.length){
      if(!filmReady){state.offset=Math.max(0,projects.length-2)*step;filmReady=true;}
      else if(previousStep!==step)state.offset=state.offset/previousStep*step;
    }
    const count=data?.home?.software?.length||0;softwareCycle=softwareTrack.children[count]?.offsetLeft||1;
    needsDraw=true;draw();
  }
  function draw(){if(!needsDraw||!projects.length)return;needsDraw=false;stage.style.transform=`translate3d(0,${-mod(state.offset,cycle)}px,0)`;}
  function tick(delta){
    if(document.hidden||panel.open)return;
    const dt=Math.min(delta/1000,.045);
    if(!paused&&!reduced.matches){
      if(!drag){state.offset+=((hovering||focused?0:state.pace)+state.velocity)*dt;state.velocity*=Math.exp(-Math.log(20)*dt);needsDraw=true;}
      if(!softwareHover){softwareOffset=mod(softwareOffset+26*dt,softwareCycle);softwareTrack.style.transform=`translate3d(${-softwareOffset}px,0,0)`;}
    }
    draw();
  }
  function updatePause(){motionButton.textContent=t(paused?'继续动效':'暂停动效');motionButton.setAttribute('aria-label',motionButton.textContent);motionButton.setAttribute('aria-pressed',String(paused));}
  motionButton.addEventListener('click',()=>{paused=!paused;state.velocity=0;updatePause();});
  band.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')hovering=true;});
  band.addEventListener('pointerleave',()=>{hovering=false;});
  band.addEventListener('focusin',e=>{focused=true;const button=e.target.closest('.project-card');if(button&&!drag){state.offset=filmSlot(Number(button.dataset.project))*step;state.velocity=0;needsDraw=true;draw();}});
  band.addEventListener('focusout',e=>{if(!band.contains(e.relatedTarget))focused=false;});
  $('.software-window').addEventListener('pointerenter',()=>{softwareHover=true;});
  $('.software-window').addEventListener('pointerleave',()=>{softwareHover=false;});
  band.addEventListener('wheel',e=>{e.preventDefault();if(G)G.killTweensOf(state,'offset');state.offset+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?band.clientHeight:1/homeScale);state.velocity=0;needsDraw=true;draw();},{passive:false});
  band.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(G)G.killTweensOf(state,'offset');drag={id:e.pointerId,y:e.clientY,startY:e.clientY,time:e.timeStamp,moved:false,capture:e.target.closest('.project-card')||band};state.velocity=0;});
  band.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dy=(e.clientY-drag.y)/homeScale,dt=(e.timeStamp-drag.time)/1000;state.offset-=dy;if(dt>0)state.velocity=.3*state.velocity+.7*(-dy/dt);drag.moved||=Math.abs(e.clientY-drag.startY)>5;if(drag.moved){if(!drag.capture.hasPointerCapture(e.pointerId))drag.capture.setPointerCapture(e.pointerId);band.classList.add('is-dragging');}drag.y=e.clientY;drag.time=e.timeStamp;needsDraw=true;draw();});
  const releaseFilm=e=>{if(!drag||drag.id!==e.pointerId)return;const previous=drag;drag=null;if(previous.moved)suppressClickUntil=performance.now()+400;if(previous.capture.hasPointerCapture(e.pointerId))previous.capture.releasePointerCapture(e.pointerId);band.classList.remove('is-dragging');};
  band.addEventListener('pointerup',releaseFilm);band.addEventListener('pointercancel',releaseFilm);band.addEventListener('lostpointercapture',releaseFilm);
  band.addEventListener('keydown',e=>{let next;if(e.key==='ArrowDown')next=state.offset+step;else if(e.key==='ArrowUp')next=state.offset-step;else if(e.key==='PageDown')next=state.offset+band.clientHeight;else if(e.key==='PageUp')next=state.offset-band.clientHeight;else if(e.key==='Home')next=filmSlot(0)*step;else if(e.key==='End')next=filmSlot(projects.length-1)*step;else if(e.key===' '&&e.target===band){e.preventDefault();motionButton.click();return;}else return;e.preventDefault();state.velocity=0;if(G&&!reduced.matches)G.to(state,{offset:next,duration:.55,ease:'power3.out',overwrite:'auto',onUpdate:()=>{needsDraw=true;draw();}});else{state.offset=next;needsDraw=true;draw();}});
  function createCards(){
    // Only the physical strip is reversed: 02 is above 01, 03 above 02.
    // Project indices still refer to the original ascending collection/details.
    const strip=projects.map((p,i)=>({p,i})).reverse();
    stage.innerHTML=[0,1].map(copy=>strip.map(({p,i})=>`<button class="project-card" type="button" data-project="${i}" ${copy?'tabindex="-1" aria-hidden="true"':''} aria-label="${escape(t('查看项目'))} ${String(i+1).padStart(2,'0')}: ${escape(p.title)}">${imageHTML(p.cover,{eager:i<3,fit:'cover',position:p.position})}<span class="film-label"><span class="film-index">${String(i+1).padStart(2,'0')}</span><span class="film-title">${escape(p.title)}<small>${escape(p.category)}</small></span></span></button>`).join('')).join('');
    cards=$$('.project-card',stage);
    softwareTrack.innerHTML=[0,1].map(copy=>(data.home?.software||[]).map(tool=>`<span class="software-item ${tool.icon?'':'word-only'}" ${copy?'aria-hidden="true"':''}>${tool.icon?`<img src="${escape(tool.icon)}" width="23" height="23" alt="" draggable="false">`:''}${escape(tool.name)}</span>`).join('')).join('');
    if(data.home?.avatar)$('.profile-button img').src=data.home.avatar.src;
    resize();
  }
  function singlePortraitHTML(photo){
    const name=language==='zh'?'崔轩':'Julian Cui';
    return `<figure class="about-single-photo"><button class="image-button" data-full="${escape(photo.src)}" data-caption="" aria-label="${escape(t('放大：'+name))}">${imageHTML({...photo,caption:name},{eager:true})}</button></figure>`;
  }
  function introMotion(){
    if(!G||reduced.matches||entrancePlayed)return;entrancePlayed=true;
    G.timeline({defaults:{ease:'power3.out',duration:.8}})
      .from('.profile-head',{autoAlpha:0,y:-10},0)
      .from('.hero-heading span',{autoAlpha:0,y:25,stagger:.1},.1)
      .from('.hero-disciplines,.hero-lead,.hero-actions,.about-link',{autoAlpha:0,y:16,stagger:.07},.25)
      .from('.machine-bezel',{autoAlpha:0,y:-18,duration:1.1},.1)
      .from('.project-window',{autoAlpha:0,duration:.7},.42)
      .from('.software-block,.home-footer',{autoAlpha:0,y:10,stagger:.08},.55);
  }

  function cleanCase() {
    $$('video',content).forEach(video => video.pause());
    if (aboutCleanup) {aboutCleanup(); aboutCleanup = null;}
    if (caseContext) {caseContext.revert(); caseContext = null;}
    clearTimeout(refreshTimer);
  }
  function syncProgress() {
    const maximum = scroll.scrollHeight - scroll.clientHeight;
    $('.reading-progress').style.transform = `scaleX(${maximum > 0 ? scroll.scrollTop / maximum : 0})`;
  }
  scroll.addEventListener('scroll', syncProgress, {passive:true});

  function showPanel(mode) {
    cleanCase();
    localizeDOM(content);
    panelMode = mode;
    panelClosing = false;
    $('.back-to-work').style.visibility = mode === 'collection' ? 'hidden' : 'visible';
    $('.panel-indicator').textContent = mode === 'project' && activeProject >= 0 ? `${String(activeProject+1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')} — ${language==='en'?projects[activeProject].english:projects[activeProject].title}` : (language==='en'?'JULIAN CUI / PORTFOLIO':'CUI XUAN / PORTFOLIO');
    if (!panel.open) {
      panel.showModal();
      document.body.classList.add('modal-open');
      if (G && !reduced.matches) G.fromTo(panel,{y:26,autoAlpha:0,scale:.985},{y:0,autoAlpha:1,scale:1,duration:.6,ease:'power3.out',clearProps:'transform,opacity,visibility'});
    }
    scroll.scrollTop = 0;
    syncProgress();
    if (G && !reduced.matches) G.fromTo(content,{y:14,autoAlpha:0},{y:0,autoAlpha:1,duration:.5,ease:'power2.out',overwrite:true,clearProps:'transform,opacity,visibility'});
    $('.close-panel').focus({preventScroll:true});
  }

  function setupCaseReveals() {
    if (!G || !ST || reduced.matches) return;
    caseContext = G.context(() => {
      $$('.case-section',content).forEach(section => {
        G.from(section.querySelector('.section-copy'),{y:22,autoAlpha:0,duration:.7,ease:'power2.out',scrollTrigger:{trigger:section,scroller:scroll,start:'top 88%',once:true}});
      });
    }, content);
    const refresh = () => {clearTimeout(refreshTimer); refreshTimer = setTimeout(() => {if(panel.open)ST.refresh();},80);};
    $$('img',content).forEach(img => {if (!img.complete) img.addEventListener('load',refresh,{once:true});});
    requestAnimationFrame(() => ST.refresh());
  }

  function figureHTML(image, eager = false) {
    return `<figure class="${image.layout || 'wide'}"><button class="image-button" data-full="${escape(image.src)}" data-caption="${escape(image.caption)}" aria-label="放大：${escape(image.caption)}">${imageHTML(image,{eager})}</button><figcaption>${escape(image.caption)}</figcaption></figure>`;
  }
  function openProject(index) {
    activeProject = mod(index,projects.length);
    const p = projects[activeProject];
    cleanCase();
    content.innerHTML = `<article class="case-study" data-project="${p.id}">
      ${p.video ? `<figure class="case-video"><video controls controlslist="nodownload noremoteplayback" disableremoteplayback playsinline preload="none" poster="${escape(p.hero.src)}" aria-label="${escape(p.video.caption)}"><source src="${escape(p.video.file)}" type="video/mp4">请使用支持 HTML5 视频的浏览器观看。</video></figure>` : ''}
      <header class="case-heading"><div class="eyebrow">${escape(p.category)} ${p.year ? ' / '+escape(p.year) : ''}</div><div class="case-heading-layout"><div><h2 id="panel-title">${escape(p.title)}</h2><p class="case-subtitle">${escape(p.subtitle)}</p></div><p class="case-intro">${escape(p.intro)}</p></div><dl class="case-facts">${p.facts.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl></header>
      <figure class="hero-image-wrap"><button class="image-button" data-full="${escape(p.hero.src)}" data-caption="${escape(p.hero.caption)}" aria-label="放大：${escape(p.hero.caption)}">${imageHTML(p.hero,{eager:true})}</button></figure>
      ${p.sections.map(section=>`<section class="case-section"><div class="section-copy"><h3>${escape(section.title)}</h3><p>${escape(section.text)}</p></div><div class="image-grid">${section.images.map(image=>figureHTML(image)).join('')}</div></section>`).join('')}
      <footer class="case-pagination"><button data-project="${mod(activeProject-1,projects.length)}"><small>← 上一个项目</small><strong>${escape(projects[mod(activeProject-1,projects.length)].title)}</strong></button><button data-project="${mod(activeProject+1,projects.length)}"><small>下一个项目 →</small><strong>${escape(projects[mod(activeProject+1,projects.length)].title)}</strong></button></footer><div class="case-endnote">CUI XUAN / SELECTED WORKS</div></article>`;
    showPanel('project');
    setupCaseReveals();
    history.replaceState(null,'','#project='+p.id);
  }

  function openCollection() {
    cleanCase(); activeProject = -1;
    content.innerHTML = `<section><header class="page-heading"><div class="eyebrow">SELECTED WORKS / CUI XUAN</div><h2 id="panel-title">从研究到落地，<br>也从工业走向日常。</h2><p>8 个设计项目与 2 个 AIGC 工作流案例，记录工业造型、数字孪生、适老产品、数字交互与角色视觉的探索过程。</p></header><div class="collection-grid">${projects.map((p,i)=>`<button class="collection-card" data-project="${i}" aria-label="查看${escape(p.title)}"><div class="collection-image">${imageHTML({...p.cover,caption:p.title},{eager:i<3,fit:p.fit,position:p.position})}</div><div class="collection-meta"><span>${String(i+1).padStart(2,'0')} / ${escape(p.category)}</span><span>${escape(p.year)} ↗</span></div><h3>${escape(p.title)}</h3><p>${escape(p.subtitle)}</p></button>`).join('')}</div></section>`;
    showPanel('collection'); history.replaceState(null,'','#works');
  }

  function openAbout() {
    cleanCase(); activeProject = -1;
    const about = data.about;
    const row = (date,title,copy) => `<div class="experience"><time>${escape(date)}</time><h4>${escape(title)}</h4><p>${escape(copy)}</p></div>`;
    const section = (id,title,rows) => `<section class="about-section" id="about-${id}"><h3>${title}</h3><div>${rows.map(item=>row(...item)).join('')}</div></section>`;
    content.innerHTML = `<section class="about-page">
      <header class="about-profile">
        <div class="about-profile-copy"><div class="eyebrow">ABOUT / CUI XUAN</div><h2 id="panel-title">你好，<br>我是崔轩。</h2><p class="about-lead">把想法落到可感知的细节。</p><p class="about-summary">${escape(about.summary)}</p><div class="about-meta"><span>${escape(about.location)}</span><span>技术美术 / 游戏引擎开发 / AIGC / UI 设计</span></div><a class="about-resume-link" href="#about-education">往下看看我的经历 <span aria-hidden="true">↓</span></a></div>
        ${singlePortraitHTML(about.photos[0])}
      </header>
      ${section('education','学习经历',about.education)}
      ${section('internships','实习经历',about.internships)}
      ${section('projects','设计与项目经历',about.experience)}
      <section class="about-section"><h3>技能与工具</h3><div class="about-skill-groups">${about.skillGroups.map(([title,items])=>`<div><h4>${escape(title)}</h4><p>${escape(items)}</p></div>`).join('')}</div></section>
      ${section('publications','论文与出版',about.publications)}
      ${section('patents','专利成果',about.patents)}
      <section class="about-section"><h3>获奖记录</h3><ul class="about-awards-list">${about.awards.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></section>
      ${section('activities','学习与校园经历',about.activities)}
      <section class="about-section about-interests"><h3>工作之外</h3><div class="about-tools">${about.interests.map(item=>`<span>${escape(item)}</span>`).join('')}</div></section><div class="case-endnote">CUI XUAN / ALWAYS EXPLORING</div></section>`;
    showPanel('about'); history.replaceState(null,'','#about');

    if (G && ST && !reduced.matches) caseContext = G.context(()=>{
      G.from('.about-profile-copy > *',{y:16,autoAlpha:0,stagger:.055,duration:.65,ease:'power3.out'});
      $$('.about-section',content).forEach(section=>G.from(section.children,{y:16,autoAlpha:0,duration:.65,stagger:.05,ease:'power2.out',scrollTrigger:{trigger:section,scroller:scroll,start:'top 94%',once:true}}));
      requestAnimationFrame(()=>{if(panel.open)ST.refresh();});
    },content);
    $('.about-resume-link').addEventListener('click',e=>{
      e.preventDefault(); const target=$('#about-education');
      const top=target.getBoundingClientRect().top-scroll.getBoundingClientRect().top+scroll.scrollTop-28;
      if(G&&!reduced.matches)G.to(scroll,{scrollTop:top,duration:.85,ease:'power3.inOut',overwrite:'auto'});else scroll.scrollTop=top;
    });
  }

  function openContact() {
    cleanCase(); activeProject = -1;
    content.innerHTML = `<section class="contact-page"><div class="eyebrow">LET'S MAKE SOMETHING MEANINGFUL</div><h2 id="panel-title">有一个想法？<br>我们聊聊。</h2><p>关于工业造型、数字孪生、交互体验，<br>或是一个还在酝酿中的设计问题。</p><a class="email-link" href="mailto:${escape(data.email)}">${escape(data.email)} ↗</a><button class="copy-email">复制邮箱地址</button><div class="contact-footer">崔轩 / CUI XUAN<br>INDUSTRIAL DESIGN & DIGITAL EXPERIENCE</div></section>`;
    showPanel('contact'); history.replaceState(null,'','#contact');
  }

  function closePanel() {
    if (!panel.open || panelClosing) return;
    panelClosing = true;
    cleanCase();
    const finish = () => {
      panel.close(); document.body.classList.remove('modal-open'); panelClosing = false;
      content.innerHTML = ''; history.replaceState(null,'',location.pathname+location.search);
      if (G) G.set(panel,{clearProps:'transform,opacity,visibility'});
    };
    if (G && !reduced.matches) G.to(panel,{y:18,autoAlpha:0,scale:.99,duration:.24,ease:'power2.in',overwrite:true,onComplete:finish}); else finish();
  }
  panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
  $('.close-panel').addEventListener('click',closePanel);
  panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});

  function closeLightbox() {
    if (!lightbox.open) return;
    lightbox.close();
    $('#lightbox img').removeAttribute('src');
  }
  $('.lightbox-close').addEventListener('click',closeLightbox);
  lightbox.addEventListener('cancel',e=>{e.preventDefault();closeLightbox();});
  function openLightbox(src,caption) {
    $('#lightbox img').src=src; $('#lightbox img').alt=caption;
    $('#lightbox p').textContent=caption;
    lightbox.showModal();
    if(G&&!reduced.matches)G.fromTo(lightbox,{autoAlpha:0,scale:.98},{autoAlpha:1,scale:1,duration:.35,ease:'power2.out',clearProps:'transform,opacity,visibility'});
  }
  document.addEventListener('click',e=>{
    const lang=e.target.closest('[data-language]');if(lang){setLanguage(lang.dataset.language);return;}
    const view = e.target.closest('[data-view]');
    if(view&&data){({collection:openCollection,about:openAbout,contact:openContact})[view.dataset.view]?.();return;}
    const project = e.target.closest('[data-project]');
    if(project?.matches('button')){if(project.classList.contains('project-card')&&performance.now()<suppressClickUntil)return;openProject(Number(project.dataset.project));return;}
    const full = e.target.closest('[data-full]');
    if(full){openLightbox(full.dataset.full,full.dataset.caption);return;}
    if(e.target.closest('.copy-email')){
      navigator.clipboard.writeText(data.email).then(()=>toast('邮箱地址已复制')).catch(()=>toast(data.email));
    }
  });
  function toast(message){message=t(message);const el=$('.toast');const host=lightbox.open?lightbox:panel.open?panel:document.body;if(el.parentElement!==host)host.appendChild(el);el.textContent=message;clearTimeout(toastTimer);if(G)G.to(el,{autoAlpha:1,duration:.2});else{el.style.visibility='visible';el.style.opacity='1';}toastTimer=setTimeout(()=>{if(G)G.to(el,{autoAlpha:0,duration:.2});else el.style.opacity='0';},2200);}

  function routeHash() {
    const hash=location.hash;
    if(hash.startsWith('#project=')){const i=projects.findIndex(p=>p.id===hash.slice(9));if(i>=0)openProject(i);}
    else if(hash==='#works')openCollection(); else if(hash==='#about')openAbout(); else if(hash==='#contact')openContact();
  }
  reduced.addEventListener('change',()=>{
    if(G)G.killTweensOf(state);state.velocity=0;state.pace=-18;needsDraw=true;draw();
    if(panelMode==='about'&&panel.open){openAbout();}
    else if(reduced.matches&&caseContext){cleanCase();}
    else if(panelMode==='project'&&panel.open)setupCaseReveals();
  });
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('hashchange',routeHash);
  document.fonts?.ready.then(resize);
  applyStaticCopy();
  resize();

  fetch('content.json').then(response=>{if(!response.ok)throw new Error(t('内容暂时无法加载'));return response.json();}).then(value=>{
    sourceData=value;data=localize(sourceData);projects=data.projects;applyStaticCopy();createCards();introMotion();routeHash();
    if(G)G.ticker.add((time,delta)=>tick(delta));
    else {const loop=time=>{tick(lastFallback?time-lastFallback:16);lastFallback=time;requestAnimationFrame(loop);};requestAnimationFrame(loop);}
  }).catch(error=>{
    console.error(error);
    band.innerHTML='<p class="load-error">'+escape(t('作品暂时无法加载，请刷新页面重试。'))+'</p>';
  });
})();

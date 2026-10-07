(() => {
  const nav = document.querySelector('[data-page-nav]');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a')];
  const byPage = key => links.find(a => a.dataset.pageLink === key);
  const byFile = file => links.find(a => a.getAttribute('href') === file);
  const groups = [
    ['Dashboard', 'dashboard', ['controlTower']],
    ['Broker Workspace', 'broker', ['passport','workbench','tools','flagship','theater','commercial','brokerOS','autopilot','dealIQ','terminal','edge','proOps','businessCenter','growthSuite','superSuite','nextGen','innovationLab','enterprise','saasCore','aiCore','pythonEngine']],
    ['Decision Lab', 'decision-lab.html', ['decisionLab']],
    ['Intelligence', 'market', ['portsPage','seaTraffic']],
    ['Academy', 'academyPage', ['studentCenter','caseRoom']]
  ];
  nav.replaceChildren();
  groups.forEach(([label, key, children]) => {
    const primary = byPage(key) || byFile(key);
    if (!primary) return;
    primary.textContent = label;
    primary.classList.add('workspace-primary');
    nav.append(primary);
    const details = document.createElement('details');
    details.className = 'workspace-tools';
    const summary = document.createElement('summary');
    summary.textContent = label === 'Broker Workspace' ? 'More broker tools' : `${label} tools`;
    const list = document.createElement('div');
    children.forEach(k => { const a = byPage(k); if (a) list.append(a); });
    if (label === 'Broker Workspace') { const a = byFile('deal-surgeon.html'); if (a) {a.textContent='Review a fixture';list.prepend(a);} }
    if (list.childElementCount) {details.append(summary,list);nav.append(details);}
  });
  const specialist = document.createElement('details');
  specialist.className='workspace-tools workspace-specialists';
  specialist.innerHTML='<summary>Specialist workspaces</summary><div></div>';
  [['stability.html','Loadicator'],['insurance.html','Marine Insurance'],['insuranceDesk','Insurance tools']].forEach(([key,label])=>{const a=byFile(key)||byPage(key);if(a){a.textContent=label;specialist.lastElementChild.append(a);}});
  nav.append(specialist);
  ['accountPage','aboutFocusea'].forEach(k=>{const a=byPage(k);if(a){a.classList.add('workspace-secondary');nav.append(a);}});
  const health=byFile('site-health.html');if(health){health.classList.add('workspace-secondary');nav.append(health);}
  const mission=document.querySelector('.mission-card');
  if(mission){mission.querySelector('span').textContent='Focusea';mission.querySelector('strong').textContent='From offer to decision';mission.querySelector('p').textContent='Calculate a voyage, review its risks and prepare the commercial documents.';}
  const strip=document.createElement('section');strip.className='workspace-flow';strip.setAttribute('aria-label','Broker workflow');
  strip.innerHTML='<div><strong>Broker Workspace</strong><span>From offer to decision. From decision to document.</span></div><nav aria-label="Fixture steps"><a href="#passport">1. Offer</a><a href="#broker">2. Calculate</a><a href="decision-lab.html">3. Compare risks</a><a href="#tools">4. Documents &amp; laytime</a></nav>';
  strip.addEventListener('click',event=>{const a=event.target.closest('a');if(a?.hash && a.getAttribute('href').startsWith('#')){const original=byPage(a.hash.slice(1));if(original){event.preventDefault();original.click();}}});
  document.querySelector('.top-account-bar')?.after(strip);
  const update=()=>{
    const page=document.body.dataset.activePage||'dashboard';
    strip.hidden=['dashboard','market','portsPage','seaTraffic','academyPage','studentCenter','caseRoom','aboutFocusea','accountPage'].includes(page);
    groups.forEach(([,key,children])=>{const a=byPage(key)||byFile(key);a?.classList.toggle('workspace-selected',page===key||children.includes(page));});
  };
  new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['data-active-page']});update();
})();

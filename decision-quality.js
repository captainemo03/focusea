(() => {
  const form = document.querySelector('#decisionForm');
  if (!form) return;
  const limits = {cargo_qty:[1,10000000],freight_rate:[0,100000],target_tce:[0,1000000],distance:[1,50000],speed:[6,30],sea_cons:[0,1000],port_days:[0,365],bunker_price:[0,10000],daily_hire:[0,1000000],port_costs:[0,100000000],canal_costs:[0,100000000],commission:[0,99],laycan_buffer:[0,365],delay_cost:[0,1000000],wave_height:[0,15],eu_share:[0,100]};
  Object.entries(limits).forEach(([key,[min,max]])=>{const field=form.elements[key];field.min=min;field.max=max;field.required=true;field.step='any';});
  const error = document.createElement('p');error.className='quality-error';error.setAttribute('role','alert');error.hidden=true;form.prepend(error);
  const valid = event => {
    if (!form.checkValidity()) {event.preventDefault();event.stopImmediatePropagation();error.hidden=false;error.textContent='Check the highlighted inputs before calculating.';form.reportValidity();return false;}
    error.hidden=true;return true;
  };
  form.addEventListener('submit',valid,true);
  document.querySelector('#evidenceChecks').addEventListener('change',valid,true);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value||0);
  const panel=document.createElement('section');panel.className='panel quality-ledger';panel.innerHTML='<header><div><p class="eye">Voyage economics</p><h2>Revenue, costs and earnings</h2></div><em>User assumptions</em></header><div id="qualityLedger"></div><p>TCE = (freight revenue − commission − voyage expenses) / voyage days. Net voyage profit also deducts hire. Delay exposure is a planning allowance.</p>';
  document.querySelector('#replay').before(panel);
  const refresh=()=>{
    let snapshot;try{snapshot=JSON.parse(localStorage.getItem('focuseaDecisionLabLast'));}catch{return;}
    if(!snapshot?.result?.digital_twin?.base)return;
    const b=snapshot.result.digital_twin.base,v=snapshot.input;
    document.querySelector('#confidenceText').textContent='Assumptions not independently verified';document.querySelector('.confidence').hidden=true;
    const rows=[['Gross freight',b.gross_revenue],['Commission',b.commission_cost],['Bunker',b.bunker_cost],['Port / canal',Number(v.port_costs)+Number(v.canal_costs)],['Delay allowance',b.delay_exposure],['Hire',b.hire_cost],['Net voyage profit',b.net_profit],['TCE / day',b.tce],['Profit after hire / day',b.daily_profit]];
    document.querySelector('#qualityLedger').innerHTML=rows.map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('');
  };
  new MutationObserver(refresh).observe(document.querySelector('#twinMetrics'),{childList:true});
  const trust=document.querySelector('.trust');trust.innerHTML='<article><span>Commercial inputs</span><b>User supplied</b><small>Not market quotations</small></article><article><span>Ocean conditions</span><b>Simulated</b><small>No weather feed connected</small></article><article><span>Carbon</span><b>Planning assumptions</b><small>Not a compliance assessment</small></article><article><span>AIS / Baltic</span><b>Licensed source required</b><small>No live feed connected</small></article>';
  const actions=document.querySelector('.export .buttons');
  const resume=document.createElement('button');resume.type='button';resume.className='ghost';resume.textContent='Resume last calculation';
  let saved;try{saved=JSON.parse(localStorage.getItem('focuseaDecisionLabLast'));}catch{}
  resume.disabled=!saved?.input;
  resume.onclick=()=>{Object.entries(saved.input).forEach(([key,value])=>{const field=form.elements[key];if(field){field.value=value;if(field.type==='range')field.nextElementSibling.textContent=value+'%';}});document.querySelectorAll('#evidenceChecks input').forEach(field=>field.checked=(saved.input.evidence_docs||[]).includes(field.value));form.requestSubmit();};
  actions.prepend(resume);
  const print=document.createElement('button');print.type='button';print.textContent='Print / Save PDF';actions.prepend(print);
  print.onclick=()=>{
    const record=JSON.parse(localStorage.getItem('focuseaDecisionLabLast')||'null');if(!record)return;
    const report=document.querySelector('#clientDecisionReport')||document.body.appendChild(document.createElement('article'));report.id='clientDecisionReport';
    const r=record.result,b=r.digital_twin.base;
    report.innerHTML=`<h1>Focusea Voyage Decision Report</h1><p>${escape(record.input.vessel_name)} · ${escape(record.input.route)}</p><p>Calculated: ${escape(record.time)} | Source: user inputs and deterministic simulation</p><h2>${escape(r.decision)}</h2><p>TCE ${money(b.tce)}/day · Net profit ${money(b.net_profit)}</p><h2>Input register</h2><table>${Object.entries(record.input).filter(([key])=>key!=='api_base').map(([key,value])=>`<tr><th>${escape(key.replaceAll('_',' '))}</th><td>${escape(Array.isArray(value)?value.join(', '):value)}</td></tr>`).join('')}</table><h2>Stress scenarios</h2><table><tr><th>Scenario</th><th>TCE/day</th><th>Net profit</th></tr>${r.stress_cases.map(x=>`<tr><td>${escape(x.name)}</td><td>${money(x.tce)}</td><td>${money(x.net_profit)}</td></tr>`).join('')}</table><h2>Calculation basis</h2><p>TCE excludes hire. Net profit includes hire. Ocean risks and delay allowances are modeled assumptions.</p><h2>Actions</h2><ul>${r.actions.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`;
    window.print();
  };
  refresh();
})();

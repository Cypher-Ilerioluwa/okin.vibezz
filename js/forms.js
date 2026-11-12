const cfg=window.SITE_CFG||{};
// Allow links such as /contact/?subject=Press to prefill the subject field
const pre=new URLSearchParams(location.search).get('subject');
if(pre){const f=document.querySelector('form[data-form=contact] [name=subject]');if(f)f.value=pre.slice(0,200)}

document.querySelectorAll('form[data-form]').forEach(form=>{
 const status=form.querySelector('.status'),btn=form.querySelector('button[type=submit]');
 form.addEventListener('submit',async e=>{e.preventDefault();status.className='status';status.textContent='';
  form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
  const bad=[...form.elements].find(x=>x.name&&!x.checkValidity());
  if(bad){bad.setAttribute('aria-invalid','true');status.classList.add('err');status.textContent=bad.validationMessage||'Please check this field.';bad.focus();return}
  if(!cfg.fn){status.classList.add('err');status.textContent='Form service is not configured yet.';return}
  const body=Object.fromEntries(new FormData(form));body.type=form.dataset.form;body.consent=!!form.elements.consent.checked;
  btn.disabled=true;btn.classList.add('busy');
  try{const r=await fetch(cfg.fn,{method:'POST',headers:{'content-type':'application/json',apikey:cfg.key,Authorization:'Bearer '+cfg.key},body:JSON.stringify(body)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'Something went wrong. Please try again.');
   form.reset();status.classList.add('ok');status.textContent=j.reference?`Request received. Your reference is ${j.reference}. This is an enquiry, not a confirmed booking.`:(form.dataset.success||'Message sent. Thank you.');status.focus()}
  catch(err){status.classList.add('err');status.textContent=err.message}
  finally{btn.disabled=false;btn.classList.remove('busy')}})});

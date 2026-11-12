// Deploy: supabase functions deploy submit-form --no-verify-jwt
// Secrets (optional): RESEND_API_KEY, NOTIFY_EMAIL, NOTIFY_FROM, ALLOWED_ORIGIN
import {createClient} from 'npm:@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const origin=Deno.env.get('ALLOWED_ORIGIN')||'*';
const cors: Record<string, string> = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json'}});
const s=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);
const emailOk=(e:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
async function hash(t:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t+(Deno.env.get('IP_SALT')||'okv')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function notify(subject:string,text:string){const k=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('NOTIFY_EMAIL');if(!k||!to)return;
 try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${k}`,'content-type':'application/json'},body:JSON.stringify({from:Deno.env.get('NOTIFY_FROM')||'onboarding@resend.dev',to:[to],subject,text})})}catch(_){}}
Deno.serve(async req=>{
  // Answer the browser's pre-check with exactly the headers it asks for (prevents spurious CORS failures)
  cors['Access-Control-Allow-Headers'] = req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers']; cors['Access-Control-Max-Age'] = '86400';
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 let b:any;try{b=await req.json()}catch{return json({error:'Invalid request'},400)}
 if(b.website)return json({ok:true}); // honeypot: pretend success
 const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'x');
 const type=b.type==='booking'?'booking':'contact',table=type==='booking'?'booking_enquiries':'contact_messages';
 const since=new Date(Date.now()-3600e3).toISOString();
 const {count}=await db.from(table).select('id',{count:'exact',head:true}).eq('ip_hash',ip).gte('created_at',since);
 if((count??0)>=5)return json({error:'Too many submissions. Please try again later.'},429);
 const name=s(b.name,120),email=s(b.email,254);
 if(!name||!emailOk(email)||b.consent!==true)return json({error:'Please complete the required fields.'},422);
 if(type==='contact'){const message=s(b.message,5000);if(!message)return json({error:'Please write a message.'},422);
  const {error}=await db.from('contact_messages').insert({name,email,subject:s(b.subject,200),message,ip_hash:ip});
  if(error)return json({error:'Could not save your message.'},500);
  await notify('New contact message',`${name} <${email}>\n\n${message}`);return json({ok:true})}
 const f=(k:string,m:number)=>s(b[k],m);
 const details={name,email,phone:f('phone',40),organisation:f('organisation',160),event_type:f('event_type',60),event_date:f('event_date',20),event_time:f('event_time',20),duration:f('duration',60),venue:f('venue',200),city:f('city',100),country:f('country',100),description:f('description',3000),budget:f('budget',60),notes:f('notes',3000)};
 if(!details.event_type||!details.event_date||!details.city||!details.country||!details.description)return json({error:'Please complete the required fields.'},422);
 const reference='OKV-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
 const {error}=await db.from('booking_enquiries').insert({reference,details,ip_hash:ip});
 if(error)return json({error:'Could not save your request.'},500);
 await notify(`New booking enquiry ${reference}`,`${name} <${email}>\n${details.event_type} on ${details.event_date} in ${details.city}, ${details.country}`);
 return json({ok:true,reference});
});

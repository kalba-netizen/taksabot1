const ADMIN_ID = "1780245841";
const cors = {
  "Access-Control-Allow-Origin": "https://kalba-netizen.github.io",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-StaticGram-Init-Data",
  "Vary": "Origin"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
async function verifyInitData(raw, botToken) {
  if (!raw || !botToken) return null;
  const p = new URLSearchParams(raw), hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n");
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(botToken));
  const key = await crypto.subtle.importKey("raw", secret, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(check)));
  const hex = [...sig].map(b=>b.toString(16).padStart(2,"0")).join("");
  if (hex.length!==hash.length || ![...hex].every((c,i)=>c===hash[i])) return null;
  const auth = p.get("auth_date");
  if (!auth || Math.abs(Date.now()/1000-Number(auth))>86400) return null;
  try { const u=JSON.parse(p.get("user")||"{}"); return u.id ? u : null; } catch { return null; }
}
async function userFor(req,env){return verifyInitData(req.headers.get("X-StaticGram-Init-Data")||"",env.BOT_TOKEN)}
async function adminFor(req,env){const u=await userFor(req,env);return u&&String(u.id)===ADMIN_ID?u:null}
const safeInt=(v,min=0,max=100000000)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.floor(Number(v)))):null;
export default {
 async fetch(req,env) {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const url=new URL(req.url),path=url.pathname;
  if(!env.DB||!env.BOT_TOKEN)return json({error:"Worker is not configured"},503);
  try {
   if(path==="/api/save" && (req.method==="GET"||req.method==="POST")) {
    const u=await userFor(req,env);if(!u?.id)return json({error:"Unauthorized"},401);
    const id=String(u.id),seen=Date.now();
    await env.DB.prepare("INSERT INTO players(id,username,first_name,last_name,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,last_seen=excluded.last_seen").bind(id,u.username||"",u.first_name||"",u.last_name||"",seen).run();
    const p=await env.DB.prepare("SELECT blocked,save_json FROM players WHERE id=?").bind(id).first();
    if(p.blocked)return json({error:"Blocked"},403);
    if(req.method==="GET")return json({save:p.save_json?JSON.parse(p.save_json):null});
    const body=await req.json();
    if(!body||typeof body.save!=="object"||Array.isArray(body.save))return json({error:"Invalid save"},400);
    const save=JSON.stringify(body.save);
    if(save.length>30000)return json({error:"Save too large"},413);
    await env.DB.prepare("UPDATE players SET save_json=?,balance=?,xp=?,level=?,last_seen=? WHERE id=?").bind(save,safeInt(body.save.balance)||0,safeInt(body.save.xp)||0,safeInt(body.save.level)||0,seen,id).run();
    return json({ok:true});
   }
   if(path.startsWith("/api/admin/")) {
    const admin=await adminFor(req,env);if(!admin)return json({error:"Forbidden"},403);
    if(path==="/api/admin/players"&&req.method==="GET"){
     const q=(url.searchParams.get("q")||"").slice(0,80);
     const rows=await env.DB.prepare("SELECT id,username,first_name,last_name,balance,xp,level,blocked,last_seen,save_json FROM players WHERE id LIKE ? OR username LIKE ? OR first_name LIKE ? ORDER BY last_seen DESC LIMIT 200").bind("%"+q+"%","%"+q+"%","%"+q+"%").all();
     return json({players:rows.results.map(p=>{let s={};try{s=JSON.parse(p.save_json||"{}")}catch{}return {...p,save_json:undefined,dog_name:s.name||"Такса",hunger:s.hunger??null,joy:s.joy??null}})});
    }
    if(path==="/api/admin/stats"&&req.method==="GET"){
     const r=await env.DB.prepare("SELECT COUNT(*) total, SUM(CASE WHEN last_seen>? THEN 1 ELSE 0 END) active24, COALESCE(SUM(balance),0) sausages, COALESCE(AVG(level),0) avg_level FROM players").bind(Date.now()-86400000).first();
     return json({stats:r});
    }
    if(path==="/api/admin/player"&&req.method==="GET"){
     const id=url.searchParams.get("id")||"";
     const p=await env.DB.prepare("SELECT * FROM players WHERE id=?").bind(id).first();
     if(!p)return json({error:"Player not found"},404);
     let save=null;try{save=p.save_json?JSON.parse(p.save_json):null}catch{}
     return json({player:{...p,save_json:undefined},save});
    }
    if(path==="/api/admin/player"&&req.method==="POST"){
     const b=await req.json(),id=String(b.id||"");
     if(!/^\d{1,24}$/.test(id))return json({error:"Invalid player id"},400);
     const p=await env.DB.prepare("SELECT id,save_json FROM players WHERE id=?").bind(id).first();
     if(!p)return json({error:"Player not found"},404);
     let current={};try{current=JSON.parse(p.save_json||"{}")}catch{} for(const k of ["balance","xp","level"]){if(b[k]!==undefined){const v=safeInt(b[k]);if(v===null)return json({error:"Invalid "+k},400);current[k]=v;await env.DB.prepare("UPDATE players SET "+k+"=? WHERE id=?").bind(v,id).run();}} if(Object.keys(current).length)await env.DB.prepare("UPDATE players SET save_json=? WHERE id=?").bind(JSON.stringify(current),id).run();
     if(typeof b.blocked==="boolean")await env.DB.prepare("UPDATE players SET blocked=? WHERE id=?").bind(b.blocked?1:0,id).run();
     if(b.reset===true){const fresh={balance:100,name:"Такса",hunger:100,joy:100,level:0,xp:0,lastTick:Date.now(),lastBonus:0,shift:null,restUntil:0,inventory:{food:0,bone:0,gift:0},initialGrant100:true};await env.DB.prepare("UPDATE players SET save_json=?,balance=100,xp=0,level=0 WHERE id=?").bind(JSON.stringify(fresh),id).run();}
     return json({ok:true});
    }
    if(path==="/api/admin/professions"&&req.method==="GET"){
     const rows=await env.DB.prepare("SELECT id,name,pay,level FROM professions ORDER BY level").all();return json({professions:rows.results});
    }
    if(path==="/api/admin/professions"&&req.method==="POST"){
     const b=await req.json(),id=String(b.id||"").slice(0,32),name=String(b.name||"").slice(0,60),pay=safeInt(b.pay),level=safeInt(b.level);
     if(!/^[a-z0-9_-]+$/.test(id)||!name||pay===null||level===null)return json({error:"Invalid profession"},400);
     await env.DB.prepare("INSERT INTO professions(id,name,pay,level) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,pay=excluded.pay,level=excluded.level").bind(id,name,pay,level).run();return json({ok:true});
    }
   }
   return json({error:"Not found"},404);
  }catch(e){return json({error:"Server error",detail:String(e).slice(0,180)},500)}
 }
};
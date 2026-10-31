const ADMIN_ID = "1780245841";
const cors = {
  "Access-Control-Allow-Origin": "https://kalba-netizen.github.io",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-StaticGram-Init-Data",
  "Vary": "Origin"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
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
  try { return JSON.parse(p.get("user")||"{}"); } catch { return null; }
}
async function requireUser(req, env) {
  const raw=req.headers.get("X-StaticGram-Init-Data") || "";
  return verifyInitData(raw, env.BOT_TOKEN);
}
async function requireAdmin(req, env) {
  const u=await requireUser(req,env);
  return u && String(u.id)===ADMIN_ID ? u : null;
}
export default {
 async fetch(req,env) {
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const url=new URL(req.url), path=url.pathname;
  if(!env.DB || !env.BOT_TOKEN) return json({error:"Worker is not configured"},503);
  if(path==="/api/me" && req.method==="GET") {
   const u=await requireUser(req,env); if(!u?.id) return json({error:"Unauthorized"},401);
   await env.DB.prepare("INSERT INTO players (id, username, first_name, last_name, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name, last_seen=excluded.last_seen")
    .bind(String(u.id),u.username||"",u.first_name||"",u.last_name||"",Date.now()).run();
   const player=await env.DB.prepare("SELECT id, username, first_name, last_name, balance, xp, level, blocked FROM players WHERE id=?").bind(String(u.id)).first();
   if(player.blocked) return json({error:"Blocked"},403);
   return json({player});
  }
  if(path.startsWith("/api/admin/")) {
   const admin=await requireAdmin(req,env); if(!admin) return json({error:"Forbidden"},403);
   if(path==="/api/admin/players" && req.method==="GET") {
    const q=(url.searchParams.get("q")||"").slice(0,80);
    const rows=await env.DB.prepare("SELECT id, username, first_name, last_name, balance, xp, level, blocked, last_seen FROM players WHERE id LIKE ? OR username LIKE ? OR first_name LIKE ? ORDER BY last_seen DESC LIMIT 200")
     .bind("%"+q+"%","%"+q+"%","%"+q+"%").all();
    return json({players:rows.results});
   }
   if(path==="/api/admin/player" && req.method==="POST") {
    const b=await req.json(), id=String(b.id||"");
    if(!/^\\d{1,24}$/.test(id)) return json({error:"Invalid player id"},400);
    const exists=await env.DB.prepare("SELECT id FROM players WHERE id=?").bind(id).first();
    if(!exists) return json({error:"Player not found"},404);
    const balance=Number.isFinite(Number(b.balance))?Math.max(0,Math.floor(Number(b.balance))):null;
    const xp=Number.isFinite(Number(b.xp))?Math.max(0,Math.floor(Number(b.xp))):null;
    const level=Number.isFinite(Number(b.level))?Math.max(0,Math.floor(Number(b.level))):null;
    if(balance!==null) await env.DB.prepare("UPDATE players SET balance=? WHERE id=?").bind(balance,id).run();
    if(xp!==null) await env.DB.prepare("UPDATE players SET xp=? WHERE id=?").bind(xp,id).run();
    if(level!==null) await env.DB.prepare("UPDATE players SET level=? WHERE id=?").bind(level,id).run();
    if(typeof b.blocked==="boolean") await env.DB.prepare("UPDATE players SET blocked=? WHERE id=?").bind(b.blocked?1:0,id).run();
    return json({ok:true});
   }
   if(path==="/api/admin/professions" && req.method==="GET") {
    const rows=await env.DB.prepare("SELECT id,name,pay,level FROM professions ORDER BY level").all();
    return json({professions:rows.results});
   }
   if(path==="/api/admin/professions" && req.method==="POST") {
    const b=await req.json(),id=String(b.id||"").slice(0,32),name=String(b.name||"").slice(0,60);
    const pay=Math.max(0,Math.floor(Number(b.pay)||0)),level=Math.max(0,Math.floor(Number(b.level)||0));
    if(!/^[a-z0-9_-]+$/.test(id)||!name) return json({error:"Invalid profession"},400);
    await env.DB.prepare("INSERT INTO professions(id,name,pay,level) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,pay=excluded.pay,level=excluded.level").bind(id,name,pay,level).run();
    return json({ok:true});
   }
   if(path==="/api/admin/gift" && req.method==="POST") {
    const b=await req.json(),id=String(b.id||""),amount=Math.floor(Number(b.amount)||0),xp=Math.floor(Number(b.xp)||0);
    if(!/^\\d{1,24}$/.test(id)||amount<0||xp<0||amount+xp===0) return json({error:"Invalid gift"},400);
    const r=await env.DB.prepare("UPDATE players SET balance=balance+?, xp=xp+? WHERE id=?").bind(amount,xp,id).run();
    if(!r.meta?.changes) return json({error:"Player not found"},404);
    return json({ok:true});
   }
  }
  return json({error:"Not found"},404);
 }
};
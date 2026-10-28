"use strict";
const crypto=require("node:crypto");
const {db,verifyFirebaseIdToken,json,parseBody,getClientIp,rateLimit}=require("./_lib/firebase-auth");
const ADMIN_EMAIL="shakil.dev.pro@gmail.com";
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST"){res.setHeader("Allow","POST");return json(res,405,{error:"Use POST."});}
 const auth=await verifyFirebaseIdToken(req);
 if(!auth.ok)return json(res,auth.status,{error:auth.error});
 const user=auth.user, isAdmin=user.email===ADMIN_EMAIL&&user.emailVerified;
 const rl=await rateLimit("keys:"+user.uid,30,600);
 if(rl.limited)return json(res,429,{error:"অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করো।"});
 const parsed=parseBody(req);if(parsed.error)return json(res,parsed.status,{error:parsed.error});
 const body=parsed.body, action=String(body.action||"");
 try{
  if(action==="registerProfile"){
   const photoURL=String(body.photoURL||"").trim().slice(0,2048);
   const name=String(body.name||user.name||"").trim().slice(0,120);
   const email=String(user.email||"").toLowerCase().slice(0,254);
   const path="shakilUsers/"+user.uid;
   const old=await db(path,"GET")||{};
   await db(path,"PUT",{uid:user.uid,email,name,photoURL,createdAt:old.createdAt||new Date().toISOString(),lastSeenAt:new Date().toISOString()});
   return json(res,200,{ok:true});
  }
  if(action==="adminOverview"){
   if(!isAdmin)return json(res,403,{error:"Admin access required."});
   const [usersRaw,keysRaw]=await Promise.all([db("shakilUsers","GET"),db("shakilApiKeys","GET")]);
   const users=Object.values(usersRaw||{}).filter(u=>u&&u.uid).map(u=>({
    uid:String(u.uid),email:String(u.email||""),name:String(u.name||""),photoURL:String(u.photoURL||""),createdAt:String(u.createdAt||""),lastSeenAt:String(u.lastSeenAt||""),
    apiKeyCount:Object.values(keysRaw||{}).filter(k=>k&&k.ownerUid===u.uid&&k.revoked!==true).length
   })).sort((a,b)=>b.apiKeyCount-a.apiKeyCount||a.email.localeCompare(b.email));
   const totalApiKeys=Object.values(keysRaw||{}).filter(k=>k&&k.revoked!==true).length;
   return json(res,200,{isAdmin:true,totalAccounts:users.length,totalApiKeys,users});
  }
  if(action==="create"){
   const label=String(body.label||"My project").trim().slice(0,64)||"My project";
   let key="",hash="";
   for(let i=0;i<3;i++){const candidate="sk-shakil-"+crypto.randomBytes(32).toString("base64url");const digest=crypto.createHash("sha256").update(candidate).digest("hex");if(!await db("shakilApiKeys/"+digest,"GET")){key=candidate;hash=digest;break;}}
   if(!key)return json(res,503,{error:"Could not allocate a unique API key. Please retry."});
   const record={label,prefix:key.slice(0,18),createdAt:new Date().toISOString(),revoked:false,ownerUid:user.uid,ownerEmail:user.email||"",ownerName:user.name||""};
   await db("shakilApiKeys/"+hash,"PUT",record);
   return json(res,200,{key,record:{label:record.label,prefix:record.prefix,createdAt:record.createdAt,revoked:false},warning:"Copy this key now. It will not be shown again."});
  }
  if(action==="list"){
   const all=await db("shakilApiKeys","GET");
   const keys=Object.entries(all||{}).filter(([id,r])=>r?.revoked!==true&&(isAdmin||r?.ownerUid===user.uid)).map(([id,r])=>({id,label:r.label||"My project",prefix:r.prefix||"",createdAt:r.createdAt||"",revoked:r.revoked===true,ownerEmail:isAdmin?(r.ownerEmail||"") : undefined})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   return json(res,200,{keys,isAdmin});
  }
  if(action==="revoke"){
   const id=String(body.id||"");if(!/^[a-f0-9]{64}$/.test(id))return json(res,400,{error:"Invalid key ID."});
   const current=await db("shakilApiKeys/"+id,"GET");if(!current)return json(res,404,{error:"API key not found."});
   if(current.ownerUid!==user.uid&&!isAdmin)return json(res,403,{error:"You can only revoke your own API keys."});
   await db("shakilApiKeys/"+id,"DELETE");return json(res,200,{ok:true,deleted:true});
  }
  return json(res,400,{error:"Unknown action."});
 }catch(e){console.error("Shakil API key manager:",e?.message||e);return json(res,503,{error:"API key manager unavailable. Check Firebase server configuration."});}
};
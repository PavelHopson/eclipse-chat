// Runtime compatibility checks for the existing web client; no production requests.
// Node 24+, PLAYWRIGHT_MODULE points to an installed playwright package.
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const modules=new Map();
for(const name of ['api','storage','accountVault']) {
 const source=await readFile(new URL(`../../apps/web/src/lib/${name}.ts`,import.meta.url),'utf8');
 modules.set('/'+name,stripTypeScriptTypes(source.replaceAll('import.meta.env.BASE_URL','"/"'),{mode:'transform'}));
}
const server=http.createServer((req,res)=>{const body=modules.get(req.url);res.setHeader('content-type',body?'application/javascript':'text/html');res.end(body||'<!doctype html><title>Identity compatibility QA</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
const checks=[];
try {
 const page=await browser.newPage();
 for(const scenario of ['upgrade','mutation','revoked','old-client','concurrent']) {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result=await page.evaluate(async scenario=>{
   const storage=await import('/storage'),api=await import('/api');
   localStorage.setItem(storage.AUTH_STATE_KEY,JSON.stringify({schema:2,activeId:'qa',revision:1,accounts:[{id:'qa',user:{id:'qa',displayName:'QA'},accessToken:'legacy-access',refreshToken:'refresh-one',generation:'g1',updatedAt:new Date().toISOString()}]}));
   storage.bindDisplayedIdentity(storage.captureAuth().identity);
   const calls=[];
   window.fetch=async (url,init={})=>{
    const headers=new Headers(init.headers);calls.push({url,protocol:headers.get('X-Eclipse-Auth-Protocol'),authorization:headers.get('Authorization'),method:init.method||'GET'});
    if(url.includes('/refresh')){
     if(scenario==='revoked')return Response.json({error:'REAUTH_REQUIRED'},{status:401});
     await new Promise(resolve=>setTimeout(resolve,20));
     return Response.json({accessToken:'v2-access',refreshToken:'refresh-two'});
    }
    if(scenario==='revoked')return Response.json({error:'REAUTH_REQUIRED'},{status:401});
    if(scenario==='old-client')return Response.json({code:'CLIENT_UPDATE_REQUIRED'},{status:426});
    if(headers.get('Authorization')==='Bearer legacy-access')return Response.json({code:'SESSION_UPGRADE_REQUIRED'},{status:426});
    return Response.json({id:'qa'});
   };
   let error=null;
   try {
    if(scenario==='mutation')await api.apiJson('api/ecosystem/authorize',{method:'POST',body:'{}'});
    else if(scenario==='concurrent')await Promise.all([api.apiJson('api/auth/me'),api.apiJson('api/auth/me')]);
    else await api.apiJson('api/auth/me');
   }catch(cause){error=cause.name;}
   if(scenario==='old-client'){try{await api.apiJson('api/auth/me');}catch{}}
   return {calls,error,state:storage.readAuthState(),blocked:api.isClientUpdateRequired(),locks:!!navigator.locks};
  },scenario);
  assert.ok(result.locks);assert.ok(result.calls.every(call=>call.protocol==='2'));
  const refresh=result.calls.filter(call=>call.url.includes('/refresh'));
  if(scenario==='upgrade'||scenario==='concurrent'){
   assert.equal(result.error,null);assert.equal(refresh.length,1);assert.equal(result.state.accounts[0].refreshToken,'refresh-two');assert.equal(result.state.accounts[0].refreshAttempt,undefined);
  }else if(scenario==='mutation'){
   assert.equal(result.error,'SessionUpgradeRequiredError');assert.equal(result.calls.length,1);assert.equal(refresh.length,0);
  }else if(scenario==='revoked'){
   assert.equal(result.error,'ApiError');assert.equal(refresh.length,1);assert.equal(result.calls.length,2);
  }else {
   assert.equal(result.error,'ClientUpdateRequiredError');assert.equal(result.blocked,true);assert.equal(result.calls.length,1);
  }
  checks.push(scenario);
 }
 console.log(JSON.stringify({passed:true,checks,scope:'Real web API/storage modules in Chromium; server replies simulated. Native installed apps and production not tested.'}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

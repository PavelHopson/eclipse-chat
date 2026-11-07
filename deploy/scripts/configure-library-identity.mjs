import fs from 'node:fs';
import {createRequire} from 'node:module';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const CLIENT={id:'eclipse-library',sessions:true,redirectUris:['https://library.eclipse-forge.ru/editor-api/api/editor/identity/callback']};
export function updatesFor(env){
 const clients=JSON.parse(env.ECOSYSTEM_IDENTITY_CLIENTS_JSON||'[]');
 if(!Array.isArray(clients))throw Error('Invalid clients list');
 const matches=clients.filter(c=>c.id===CLIENT.id);
 if(matches.length>1 || (matches.length===1 && JSON.stringify(matches[0])!==JSON.stringify(CLIENT)))throw Error('Existing Library client differs; manual review required');
 const updates={AUTH_PROTOCOL_V2_REQUIRED:'true',ECOSYSTEM_IDENTITY_CLIENTS_JSON:JSON.stringify(matches.length?clients:[...clients,CLIENT])};
 if(!env.ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64?.trim())updates.ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64=generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
 return updates;
}
export function replaceSettings(source,updates){
 let result=source;
 for(const [key,value] of Object.entries(updates)){
  if(!['AUTH_PROTOCOL_V2_REQUIRED','ECOSYSTEM_IDENTITY_CLIENTS_JSON','ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64'].includes(key))throw Error('Unexpected setting');
  const pattern=new RegExp('^[ \t]*(?:export[ \t]+)?'+key+'\\s*=.*$','gm');
  if([...result.matchAll(pattern)].length>1)throw Error('Duplicate setting');
  const line=key+"='"+value+"'";
  if(value.includes("'")||value.includes('\n'))throw Error('Unsafe setting value');
  result=pattern.test(result)?result.replace(pattern,()=>line):(result.trimEnd()?result.trimEnd()+'\n':'')+line+'\n';
 }
 return result;
}
async function main(){
 const mode=process.argv[2];if(!['inspect','enable'].includes(mode))throw Error('Unknown mode');
 const root='/var/www/eclipse-chat',file=root+'/apps/server/.env';
 const metadata=fs.lstatSync(file);if(metadata.isSymbolicLink()||metadata.uid!==0||(metadata.mode&0o037))throw Error('Unsafe environment file');
 const require=createRequire(root+'/apps/server/package.json');const {parse}=require('dotenv');
 const before=fs.readFileSync(file,'utf8'),env=parse(before);
 const version=JSON.parse(fs.readFileSync(root+'/apps/server/package.json','utf8')).version;
 if(version!=='1.7.92')throw Error('Unexpected runtime version');
 const {EcosystemIdentityService}=await import(pathToFileURL(root+'/apps/server/dist/security/ecosystemIdentity.js'));
 const service=new EcosystemIdentityService(env);if(service.issuer!=='https://app.star-crm.ru/eclipse-chat')throw Error('Unexpected issuer');
 const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}},log:[]});
 try{const rows=await db.$queryRawUnsafe('SELECT to_regclass(\'public."EcosystemSession"\') AS name');if(!rows[0]?.name)throw Error('Migration missing');}finally{await db.$disconnect();}
 const updates=updatesFor(env);const next=replaceSettings(before,updates);const configured=new EcosystemIdentityService(parse(next));
 if(!configured.enabled||!configured.allowsSessions(CLIENT.id))throw Error('Invalid proposed settings');
 console.log(JSON.stringify({mode,version,migration:true,protocolV2:env.AUTH_PROTOCOL_V2_REQUIRED==='true',signingKeyPresent:service.enabled,libraryConfigured:service.allowsSessions(CLIENT.id)}));
 if(mode==='inspect')return;
 const dir='/var/backups/eclipse-chat';fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const backup=dir+'/library-identity-'+randomUUID()+'.env';fs.writeFileSync(backup,before,{mode:0o600,flag:'wx'});
 function install(text){const tmp=file+'.identity-'+randomUUID();try{fs.writeFileSync(tmp,text,{mode:metadata.mode&0o777,flag:'wx'});fs.chownSync(tmp,metadata.uid,metadata.gid);fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 const restart=()=>execFileSync('supervisorctl',['restart','eclipse-chat-server'],{stdio:'ignore'});
 async function smoke(){for(let i=0;i<20;i++){try{const base='https://app.star-crm.ru/eclipse-chat';const health=await (await fetch(base+'/api/health',{signal:AbortSignal.timeout(5000)})).json();const response=await fetch(base+'/api/ecosystem/session/inspect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:CLIENT.id,token:'x'.repeat(43)}),signal:AbortSignal.timeout(5000)});const jwks=await (await fetch(base+'/api/ecosystem/.well-known/jwks.json',{signal:AbortSignal.timeout(5000)})).json();if(health.ok&&health.database&&response.status===200&&(await response.json()).active===false&&JSON.stringify(jwks)===JSON.stringify(configured.jwks))return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('Identity smoke failed');}
 try{install(next);restart();await smoke();console.log('Library identity enabled; health, grant boundary and JWKS verified; protected backup retained');}
 catch{install(before);restart();throw Error('Configuration rolled back after failed activation');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Identity configuration failed; no credentials printed. Check bounded preflight/rollback status.');process.exitCode=1;});

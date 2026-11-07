import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import fs from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { db } from '../../src/db.js';
import { EcosystemIdentityService } from '../../src/security/ecosystemIdentity.js';
import { EcosystemSessionService } from '../../src/security/ecosystemSessions.js';
import { registerEcosystemIdentityRoutes } from '../../src/routes/ecosystemIdentity.js';
export { db, EcosystemSessionService };
export async function startChat(origin:string,cert:string,key:string) {
 const app=Fastify({logger:false,https:{cert:fs.readFileSync(cert),key:fs.readFileSync(key)}});
 await app.register(jwt,{secret:randomBytes(32).toString('hex')});
 const {privateKey}=generateKeyPairSync('ed25519');
 const identity=new EcosystemIdentityService({ECOSYSTEM_IDENTITY_ISSUER:'https://localhost:18898',ECOSYSTEM_IDENTITY_PRIVATE_KEY_B64:privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),ECOSYSTEM_IDENTITY_CLIENTS_JSON:JSON.stringify([{id:'eclipse-library',sessions:true,redirectUris:[origin+'/editor-api/api/editor/identity/callback']}])});
 await registerEcosystemIdentityRoutes(app,identity);
 await app.listen({port:18898,host:'127.0.0.1'});
 return app;
}

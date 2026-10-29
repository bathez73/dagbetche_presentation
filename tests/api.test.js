const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const schemas = require('../api/schema.json');

function handlerWithFakes({captchaOk = true} = {}) {
 const source = fs.readFileSync(path.join(__dirname,'../api/submit.js'),'utf8');
 const writes=[];
 const fakeDb = {collection(name){return {async add(value){writes.push({collection:name,value});}};}};
 const firebase = {
  app: {getApps:()=>[], initializeApp:()=>{}, cert:x=>x},
  firestore: {getFirestore:()=>fakeDb, FieldValue:{serverTimestamp:()=>'<timestamp>'}, Timestamp:{fromDate: d=>d.toISOString()}}
 };
 const fakeRequire=(mod)=>{
  if(mod==='firebase-admin/app')return firebase.app;
  if(mod==='firebase-admin/firestore')return firebase.firestore;
  if(mod==='./schema.json')return schemas;
  throw new Error(`unexpected require ${mod}`);
 };
 const context={module:{exports:{}},require:fakeRequire,process:{env:{FIREBASE_SERVICE_ACCOUNT_JSON:'{"project_id":"demo"}',TURNSTILE_SECRET_KEY:'secret',TURNSTILE_SITE_KEY:'site',ALLOWED_ORIGIN:'https://dagbetche.vercel.app'}},URL,URLSearchParams,Date,Number,JSON,String,Object,Array,Set,console,AbortSignal,fetch:async()=>({ok:true,json:async()=>({success:captchaOk,hostname:'dagbetche.vercel.app'})})};
 vm.runInNewContext(source,context,{filename:'submit.js'});
 return {handler:context.module.exports,writes};
}
function validRequest(survey='jeunes') {
 const answers={};
 for(const [key,rule] of Object.entries(schemas[survey]))answers[key]= rule.type==='text'?'':rule.type==='multi'?[]:''; answers.q1 = schemas[survey].q1.type === 'multi' ? [schemas[survey].q1.allowed[0]] : schemas[survey].q1.allowed[0];
 return {method:'POST',headers:{origin:'https://dagbetche.vercel.app','content-type':'application/json','content-length':'250'},body:{survey,answers,ageConfirmed:true,consent:true,website:'',turnstileToken:'test-token-valid'}};
}
async function call(handler, req) {
 const res={code:200,header:{},setHeader(key,value){this.header[key]=value;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler(req,res);
 return res;
}
test('une réponse valide est enregistrée uniquement après challenge', async()=>{
 const {handler,writes}=handlerWithFakes();
 const res=await call(handler,validRequest());
 assert.equal(res.code,201);assert.equal(res.body.saved,true);
 assert.equal(writes.length,1);assert.equal(writes[0].collection,'enquete_jeunes');
 assert.equal(writes[0].value.adultSelfDeclared,true);
 assert.ok(!('turnstileToken' in writes[0].value));
});
test('aucune donnée si le consentement manque, ou si origine externe',async()=>{
 const {handler,writes}=handlerWithFakes();
 let req=validRequest();req.body.consent=false;
 assert.equal((await call(handler,req)).code,400);
 req=validRequest();req.headers.origin='https://malicious.test';
 assert.equal((await call(handler,req)).code,403);
 assert.equal(writes.length,0);
});
test('aucune donnée si captcha échoue ou choix hors liste',async()=>{
 const {handler,writes}=handlerWithFakes({captchaOk:false});
 assert.equal((await call(handler,validRequest())).code,403);
 const req=validRequest();req.body.answers.q1='autre-valeur';
 assert.equal((await call(handler,req)).code,400);
 assert.equal(writes.length,0);
});
test('les réponses pros utilisent leur collection et commentaires PII rejetés',async()=>{
 const {handler,writes}=handlerWithFakes();
 let req=validRequest('pros');req.body.answers.q2='Écrivez-moi : test@example.com';
 assert.equal((await call(handler,req)).code,400);
 req=validRequest('pros');
 assert.equal((await call(handler,req)).code,201);
 assert.equal(writes[0].collection,'enquete_professionnels');
});

test('les réponses facultatives sont acceptées et un formulaire vide est refusé',async()=>{
 const {handler,writes}=handlerWithFakes();
 let req=validRequest();req.body.answers.q1='';
 assert.equal((await call(handler,req)).code,400);
 req=validRequest();
 assert.equal((await call(handler,req)).code,201);
 assert.equal(writes.length,1);
});
test('les autres champs et choix multiples sont contrôlés',async()=>{
 const {handler,writes}=handlerWithFakes();
 let req=validRequest();req.body.answers.q3=['Intrus'];
 assert.equal((await call(handler,req)).code,400);
 req=validRequest();req.body.answers.q3=[schemas.jeunes.q3.allowed[0],schemas.jeunes.q3.allowed[0]];
 assert.equal((await call(handler,req)).code,400);
 req=validRequest();req.body.answers.q3=[schemas.jeunes.q3.allowed[0],schemas.jeunes.q3.allowed[1]];
 assert.equal((await call(handler,req)).code,201);
 assert.equal(writes.length,1);
});

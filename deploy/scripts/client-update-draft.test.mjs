import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../apps/web/src/lib/updateDraftRecovery.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const draft = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function store() { const data = new Map(); return { data, getItem(k) {return data.has(k) ? data.get(k) : null}, setItem(k,v) {data.set(k,String(v))}, removeItem(k) {data.delete(k)} }; }
globalThis.localStorage=store();
function participant(accountId,draftKey,text,current=()=>true,select=()=>{}) { return draft.registerUpdateDraft(()=>({accountId,draftKey,text,isCurrent:current,select})); }
test('no composer permits update',()=>{globalThis.sessionStorage=store();assert.equal(draft.flushUpdateDrafts(),true)});
test('current text blocks update without touching scoped storage',()=>{
  globalThis.sessionStorage=store();let text='до';
  const off=draft.registerUpdateDraft(()=>({accountId:'a',draftKey:'room',text,isCurrent:()=>true,select(){}}));
  assert.equal(draft.checkUpdateDrafts(),false);text='новый';assert.equal(draft.checkUpdateDrafts(),false);
  assert.equal(draft.loadScopedDraft('a','room'),null);assert.equal(draft.loadScopedDraft('b','room'),null);assert.equal(draft.loadScopedDraft('a','other'),null);off();
});
test('storage error blocks reload and allows selection',()=>{
  const data=store();globalThis.sessionStorage={...data,setItem(){throw new Error('quota')}};let selected=false;
  const off=participant('a','room','текст',()=>true,()=>{selected=true});assert.equal(draft.flushUpdateDrafts(),false);
  draft.selectUpdateDraft();assert.equal(selected,true);off();
});
test('incompatible drafts in one tab block update',()=>{
  globalThis.sessionStorage=store();const a=participant('a','room','A'),b=participant('a','room','B');
  assert.equal(draft.flushUpdateDrafts(),false);assert.equal(sessionStorage.data.size,0);a();b();
});
test('identity change before or during write blocks update',()=>{
  const memory=store();let current=true;globalThis.sessionStorage={...memory,setItem(k,v){memory.setItem(k,v);current=false}};
  const off=participant('a','room','A',()=>current);assert.equal(draft.flushUpdateDrafts(),false);off();
});
test('independent tabs never overwrite each other, even for the same account and room',()=>{
  globalThis.localStorage=store();const tabA=store(),tabB=store();globalThis.sessionStorage=tabA;draft.saveScopedDraft('a','room','A');
  globalThis.sessionStorage=tabB;draft.saveScopedDraft('a','room','B');assert.equal(draft.loadScopedDraft('a','room'),'B');
  globalThis.sessionStorage=tabA;assert.equal(draft.loadScopedDraft('a','room'),'A');
});
test('closed-tab recovery uses account-scoped latest durable copy without importing legacy',()=>{
  globalThis.localStorage=store();globalThis.sessionStorage=store();
  localStorage.setItem('eclipse-chat:draft:v1:room','legacy private');
  assert.equal(draft.loadScopedDraft('a','room'),null);draft.saveScopedDraft('a','room','durable A');
  globalThis.sessionStorage=store();assert.equal(draft.loadScopedDraft('a','room'),'durable A');assert.equal(draft.loadScopedDraft('b','room'),null);
  assert.equal(localStorage.getItem('eclipse-chat:draft:v1:room'),'legacy private');
});
test('edit after recovery blocks update and leaves stored copy untouched',()=>{
  globalThis.sessionStorage=store();draft.saveScopedDraft('a','room','A');let text='B';
  const off=draft.registerUpdateDraft(()=>({accountId:'a',draftKey:'room',text,isCurrent:()=>true,select(){}}));
  assert.equal(draft.checkUpdateDrafts(),false);assert.equal(draft.loadScopedDraft('a','room'),'A');off();
});
test('sent recovered text is cleared immediately but newer text is never cleared',()=>{
  globalThis.sessionStorage=store();draft.saveScopedDraft('a','room','A');draft.clearSentDraft('a','room','A');assert.equal(draft.loadScopedDraft('a','room'),'');
  draft.saveScopedDraft('a','room','B');draft.clearSentDraft('a','room','A');assert.equal(draft.loadScopedDraft('a','room'),'B');
  draft.clearSentDraft('other','room','B');assert.equal(draft.loadScopedDraft('a','room'),'B');
});
test('confirmed send synchronously replaces an older saved draft before debounce',()=>{
  globalThis.localStorage=store();globalThis.sessionStorage=store();draft.saveScopedDraft('a','room','старый');
  assert.equal(draft.saveAfterConfirmedSend('a','room','отправленный','отправленный'),true);
  assert.equal(draft.loadScopedDraft('a','room'),'');
  draft.saveScopedDraft('a','room','старый');
  assert.equal(draft.saveAfterConfirmedSend('a','room','отправленный','новый'),true);
  assert.equal(draft.loadScopedDraft('a','room'),'новый');
});
test('sending in tab A and its later empty autosave do not erase tab B durable draft',()=>{
  globalThis.localStorage=store();const tabA=store(),tabB=store();
  globalThis.sessionStorage=tabA;draft.saveScopedDraft('a','room','A');
  globalThis.sessionStorage=tabB;draft.saveScopedDraft('a','room','B');
  globalThis.sessionStorage=tabA;
  assert.equal(draft.saveAfterConfirmedSend('a','room','A','A'),true);
  draft.saveScopedDraft('a','room','');
  assert.equal(draft.loadScopedDraft('a','room'),'');
  globalThis.sessionStorage=tabB;assert.equal(draft.loadScopedDraft('a','room'),'B');
  globalThis.sessionStorage=store();assert.equal(draft.loadScopedDraft('a','room'),'B');
});
test('new text after a send never replaces a durable draft changed by another tab',()=>{
  globalThis.localStorage=store();const tabA=store(),tabB=store();
  globalThis.sessionStorage=tabA;draft.saveScopedDraft('a','room','A');
  globalThis.sessionStorage=tabB;draft.saveScopedDraft('a','room','B');
  globalThis.sessionStorage=tabA;
  draft.saveAfterConfirmedSend('a','room','A','A новый');
  assert.equal(draft.loadScopedDraft('a','room'),'A новый');
  globalThis.sessionStorage=store();assert.equal(draft.loadScopedDraft('a','room'),'B');
});
test('new text is saved durably when sent snapshot is still the durable value',()=>{
  globalThis.localStorage=store();globalThis.sessionStorage=store();draft.saveScopedDraft('a','room','A');
  draft.saveAfterConfirmedSend('a','room','A','новый');
  globalThis.sessionStorage=store();assert.equal(draft.loadScopedDraft('a','room'),'новый');
});
test('legacy detection reveals only presence and leaves data untouched',()=>{
  globalThis.localStorage=store();localStorage.setItem('eclipse-chat:draft:v1:room','private');
  assert.equal(draft.hasLegacyDraft('room'),true);assert.equal(draft.hasLegacyDraft('other'),false);
  assert.equal(localStorage.getItem('eclipse-chat:draft:v1:room'),'private');
});
test('send acknowledgement preserves DOM-only IME text and ref-ahead edits',()=>{
  globalThis.localStorage=store();globalThis.sessionStorage=store();draft.saveScopedDraft('a','room','A');
  const composing=draft.liveDraftText('A','A','A новый');
  draft.saveAfterConfirmedSend('a','room','A',composing);
  assert.equal(draft.loadScopedDraft('a','room'),'A новый');
  assert.equal(draft.liveDraftText('новый ref','старый render','старый DOM'),'новый ref');
});
test('missing identity with text blocks update',()=>{globalThis.sessionStorage=store();const off=participant(null,null,'текст');assert.equal(draft.flushUpdateDrafts(),false);off()});
test('composition and attachments block update even without text',()=>{
  let blocked=true;const off=draft.registerUpdateDraft(()=>({blocked,select(){}}));
  assert.equal(draft.checkUpdateDrafts(),false);blocked=false;assert.equal(draft.checkUpdateDrafts(),true);off();
});
test('work arriving during asynchronous cleanup stops the final reload check',async()=>{
  let text='';const off=draft.registerUpdateDraft(()=>({text,select(){}}));
  assert.equal(draft.checkUpdateDrafts(),true);await Promise.resolve().then(()=>{text='новый ввод'});
  assert.equal(draft.checkUpdateDrafts(),false);off();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../apps/web/src/components/MessageInput.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('MessageInput.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const funcs = tree.statements.filter(n => ts.isFunctionDeclaration(n) && ['createOwnedVoiceRecorder', 'adoptRecordingStream', 'confirmedSendNeedsIdentityNotice', 'sendFailureMessage'].includes(n.name?.text));
assert.equal(funcs.length, 4);
const js = ts.transpileModule(funcs.map(f => f.getFullText(tree)).join('\n'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createOwnedVoiceRecorder,adoptRecordingStream,confirmedSendNeedsIdentityNotice,sendFailureMessage} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('throwing recorder constructor stops acquired tracks and releases ownership',()=>{
  let stopped=0;const stream={getTracks:()=>[{stop(){stopped++}},{stop(){stopped++}}]};const owner={current:null};
  assert.throws(()=>createOwnedVoiceRecorder(stream,owner,()=>{assert.equal(owner.current,stream);throw Error('constructor')}));
  assert.equal(stopped,2);assert.equal(owner.current,null);
});
test('successful constructor retains stream ownership until cleanup',()=>{
  let stopped=0;const stream={getTracks:()=>[{stop(){stopped++}}]};const owner={current:null};const recorder={};
  assert.equal(createOwnedVoiceRecorder(stream,owner,()=>recorder),recorder);assert.equal(owner.current,stream);assert.equal(stopped,0);
});
test('late old-chat microphone stream is stopped without affecting the new chat stream',()=>{
  let oldStopped=0,newStopped=0;const oldStream={getTracks:()=>[{stop(){oldStopped++}}]};const newStream={getTracks:()=>[{stop(){newStopped++}}]};
  const owner={current:null};assert.equal(adoptRecordingStream(newStream,owner,2,2),true);
  assert.equal(adoptRecordingStream(oldStream,owner,1,2),false);assert.equal(oldStopped,1);assert.equal(newStopped,0);assert.equal(owner.current,newStream);
  const begin=source.indexOf('  const startVoiceRecording = async');const end=source.indexOf('  const submit = async',begin);const recording=source.slice(begin,end);
  assert.match(recording,/if \(generation === recordingGenerationRef\.current\) recordingRequestRef\.current = false/);
});
test('delayed confirmed send after account switch yields a do-not-repeat notice',()=>{
  assert.equal(confirmedSendNeedsIdentityNotice(false),true);
  assert.equal(confirmedSendNeedsIdentityNotice(true),false);
  assert.match(sendFailureMessage(true),/Не отправляйте его повторно/i);
});
test('confirmed send with later local failure never reports send failure or retry',()=>{
  const message=sendFailureMessage(true);assert.match(message,/отправлено/i);assert.match(message,/Не отправляйте его повторно/i);
  assert.match(sendFailureMessage(false),/Не удалось подтвердить отправку/i);
  assert.match(sendFailureMessage(false),/Проверьте чат перед повтором/i);
  const submit=source.slice(source.indexOf('  const submit = async'),source.indexOf('  const canSend ='));
  assert.ok(submit.indexOf('sendConfirmed = true;') > submit.indexOf('if (!ok)'));
  assert.match(submit,/if \(sendConfirmed\)\s*\{\s*setSendError\(null\);\s*setPostSendNotice\(sendFailureMessage\(true\)\)/);
});

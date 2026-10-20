#!/usr/bin/env node
// Predictions: JSON array [{id, verdict:"supported"|"unsupported"|"uncertain"}].
const fs=require('node:fs'),assert=require('node:assert/strict');
const cases=JSON.parse(fs.readFileSync(__dirname+'/cases.json','utf8')).cases;
const labels=['supported','unsupported','uncertain'];
assert.equal(new Set(cases.map(c=>c.id)).size,cases.length,'Duplicate fixture ids');
for(const c of cases){assert.ok(labels.includes(c.expect));for(const k of ['id','corpus','generated','why','category'])assert.equal(typeof c[k],'string');}
if(!process.argv[2]) { console.log(JSON.stringify({valid:true,total:cases.length,labels:Object.fromEntries(labels.map(l=>[l,cases.filter(c=>c.expect===l).length]))},null,2));process.exit(0); }
const predictions=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.ok(Array.isArray(predictions));
assert.equal(predictions.length,cases.length,'Incomplete evaluation');
const byId=new Map();for(const p of predictions){assert.ok(cases.some(c=>c.id===p.id),'Unknown case');assert.ok(!byId.has(p.id),'Duplicate prediction');assert.ok(labels.includes(p.verdict),'Invalid verdict');byId.set(p.id,p.verdict);}
const matrix=Object.fromEntries(labels.map(l=>[l,Object.fromEntries(labels.map(p=>[p,0]))]));
const mismatches=[];
for(const c of cases){const p=byId.get(c.id);matrix[c.expect][p]++;if(p!==c.expect)mismatches.push({id:c.id,expected:c.expect,actual:p,category:c.category});}
const report={total:cases.length,confusionMatrix:{rows:'expected',columns:'predicted',counts:matrix},falseReassurance:matrix.unsupported.supported,wrongRejection:matrix.supported.unsupported,unsupportedDeferred:matrix.unsupported.uncertain,supportedDeferred:matrix.supported.uncertain,uncertaintyOverstatedAsSupport:matrix.uncertain.supported,uncertaintyOverstatedAsRejection:matrix.uncertain.unsupported,mismatches};
console.log(JSON.stringify(report,null,2));process.exitCode=mismatches.length?1:0;

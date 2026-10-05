import {writeFile, access} from 'node:fs/promises';
const target=new URL('../public/demo.pdf',import.meta.url);
try { await access(target); console.log('Example PDF already exists.'); process.exit(0); } catch {}
const url='https://arxiv.org/pdf/1706.03762';
console.log('Downloading Attention Is All You Need from arXiv. The paper remains under its own terms.');
const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
if(!response.ok)throw Error(`Download failed: HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Response was not a PDF.');
await writeFile(target,bytes,{flag:'wx'});
console.log('Saved public/demo.pdf. Restart the app or import this file if your library is already initialized.');

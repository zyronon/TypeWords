// Return scripts for Chrome DevTools evaluate_script in a NEW isolated context.
// 1. Open /setting, run importScript(zipBase64).
// 2. Reload /setting, run exportScript(), save returned ZIP as decoded bytes.
// Real UI handlers perform export/import; only the file picker and download are captured.
export function importScript(zipBase64) {
  return `async () => {
 const config=JSON.parse(localStorage.getItem('supabase_config')||'{}');
 if(config.url||config.key)throw Error('Use a clean isolated browser context');
 const find=text=>[...document.querySelectorAll('*')].filter(x=>x.childElementCount===0&&x.textContent.trim()===text).at(-1);
 document.querySelectorAll('.tab')[5].click();await new Promise(r=>setTimeout(r,100));
 find('Import Data Restore').click();await new Promise(r=>setTimeout(r,100));
 find('数据备份').click();
 for(let i=0;i<100&&!document.querySelector('input[type=file]');i++)await new Promise(r=>setTimeout(r,100));
 const input=document.querySelector('input[type=file]');if(!input)throw Error('Backup gate did not open');
 const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('${zipBase64}'),c=>c.charCodeAt(0))],'backup.zip',{type:'application/zip'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 const p=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia;
 for(let i=0;i<100&&p._s.get('base').noteData.fixture!=='ZIP semantic round-trip';i++)await new Promise(r=>setTimeout(r,100));
 if(p._s.get('base').noteData.fixture!=='ZIP semantic round-trip')throw Error('Import not restored');
 return {imported:true,volume:p._s.get('setting').wordSoundVolume,text:document.body.innerText.slice(-180)};
 }`
}
export function exportScript() {
  return `async () => {
 const p=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia;
 if(p._s.get('base').noteData.fixture!=='ZIP semantic round-trip')throw Error('Reload lost data');
 const r=indexedDB.open('keyval-store');const db=await new Promise((s,j)=>{r.onsuccess=()=>s(r.result);r.onerror=j});
 const get=k=>new Promise(s=>{let r=db.transaction('keyval').objectStore('keyval').get(k);r.onsuccess=()=>s(r.result)});
 const record=(await get('typing-word-files')).find(x=>x.id==='backup-tone');
 const ac=new AudioContext();const decoded=await ac.decodeAudioData(await record.file.arrayBuffer());const duration=decoded.duration;await ac.close();
 const blobs=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type==='application/zip')blobs.push(b);return original(b)};
 document.querySelectorAll('.tab')[5].click();await new Promise(r=>setTimeout(r,100));
 [...document.querySelectorAll('*')].find(x=>x.childElementCount===0&&x.textContent.trim()==='Export Data Backup (ZIP)').click();
 for(let i=0;i<100&&!blobs.length;i++)await new Promise(r=>setTimeout(r,100));URL.createObjectURL=original;
 if(!blobs.length)throw Error('Export did not produce ZIP');
 return {afterReload:true,zip:btoa(String.fromCharCode(...new Uint8Array(await blobs[0].arrayBuffer()))),audioBytes:record.file.size,audioDuration:duration,wordCache:await get('PracticeSaveWord'),articleCache:await get('PracticeSaveArticle'),sync:localStorage.getItem('supabase_config'),userAgent:navigator.userAgent,libs:performance.getEntriesByType('resource').filter(x=>x.name.includes('jszip')).map(x=>x.name)};
 }`
}

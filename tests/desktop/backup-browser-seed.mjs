// Run returned function in a NEW isolated browser context at /setting; never a personal profile.
import { readFileSync } from 'node:fs'
export function backupSeedScript() {
  const audio = readFileSync(new URL('./fixtures/backup/backup-tone.mp3', import.meta.url)).toString('base64')
  return `async () => {
 if(localStorage.getItem('supabase_config')) throw Error('Sync configuration present: use clean context');
 const pinia=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia;
 const base=pinia._s.get('base'), setting=pinia._s.get('setting');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const template=clone(base.word.bookList[0]);
 const word={id:'backup-word',custom:true,word:'fixture',phonetic0:'',phonetic1:'',trans:['隔离测试'],sentences:[],phrases:[],synos:[],relWords:{root:'',rels:[]},etymology:[]};
 const builtin={...clone(template),...(await fetch('/list/recommend_word.json').then(r=>r.json()))[0],system:false,custom:false,lastLearnIndex:7,words:[],articles:[]};
 const custom={...clone(template),id:'backup-custom',enName:'backup-custom',name:'Backup isolated words',system:false,custom:true,length:1,words:[word],articles:[]};
 const article={id:'backup-article',title:'Audio fixture',titleTranslate:'音频测试',text:'This is a fixture.',textTranslate:'这是隔离测试。',newWords:[],sections:[],audioSrc:'',audioFileId:'backup-tone',lrcPosition:[],questions:[],nameList:[]};
 base.word.bookList.push(builtin,custom);base.word.studyIndex=base.word.bookList.length-1;
 base.article.bookList.push({...clone(template),id:'backup-articles',enName:'backup-articles',name:'Backup isolated articles',type:'article',system:false,custom:true,length:1,articles:[article],words:[]});base.article.studyIndex=base.article.bookList.length-1;
 base.noteData={fixture:'ZIP semantic round-trip'};setting.wordSoundVolume=.37;setting.articleSoundSpeed=1.25;setting.theme='dark';
 const stat={startDate:1789084800000,spend:1250,total:3,wrong:1,newWordNumber:1,reviewWordNumber:2,segments:[],stage:0,inputWordNumber:3};
 const wp={taskWordsStr:{new:['fixture'],review:[]},practiceData:{wordsStr:['fixture'],wrongWordsStr:[],index:0,question:null},statStoreData:stat,sessionSnapshot:{flowId:'system',cursor:{nodeIndex:0,stepIndex:0,inWrongWordClear:false,loop:null,endActionIndex:null}}};
 const ap={practiceData:{sectionIndex:0,sentenceIndex:0,wordIndex:1},statStoreData:stat};
 const r=indexedDB.open('keyval-store');const db=await new Promise((s,j)=>{r.onsuccess=()=>s(r.result);r.onerror=j});
 const bytes=Uint8Array.from(atob('${audio}'),c=>c.charCodeAt(0));
 const tx=db.transaction('keyval','readwrite');const os=tx.objectStore('keyval');
 os.put([{id:'backup-tone',file:new Blob([bytes],{type:'audio/mpeg'})}],'typing-word-files');
 os.put(JSON.stringify({version:2,val:wp}),'PracticeSaveWord');os.put(JSON.stringify({version:1,val:ap}),'PracticeSaveArticle');
 await new Promise((s,j)=>{tx.oncomplete=s;tx.onerror=j});
 window.__backupBlobs=[];const create=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type==='application/zip')window.__backupBlobs.push(b);return create(b)};
 document.querySelectorAll('.tab')[5].click();
 return {isolation:'new context; no sync config',audioBytes:bytes.length,builtin: builtin.enName,custom:custom.id,wordCache:wp,articleCache:ap};
 }`
}

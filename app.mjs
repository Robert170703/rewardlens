import {parseIssueUrl, analyzeIssue} from './core.mjs';
import {demos} from './demo-data.mjs';
const el=(id)=>document.getElementById(id);
const create=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const currency=(n)=>n===null?'Sin importe':new Intl.NumberFormat('es',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
const statuses={closed:'DESCARTAR',caution:'REVISAR CON CUIDADO',review:'VERIFICAR CON EL CLIENTE'};
let current=null;
let activeController=null;
function setMessage(text,error=false){el('message').textContent=text;el('message').classList.toggle('error',error);}
function metric(label,value,note,small=false){const item=create('div','metric');item.append(create('small','',label),create('strong',small?'small-value':'',value),create('span','',note));return item;}
function safeLink(container,label,url){try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password)return;const a=create('a','',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}catch{}}
function render(data,mode){
 const result=analyzeIssue(data);current={data,result,mode};
 const panel=el('report');panel.replaceChildren();
 const top=create('div','report-top');top.append(create('span',`status ${result.status}`,statuses[result.status]),create('span','report-mode',mode));
 panel.append(top,create('h2','result-title',result.title),create('div','repo-link',data.repo.full_name));
 const metrics=create('div','metrics');metrics.append(metric('IMPORTE EN EL TÍTULO',currency(result.amount),'Confirma si corresponde a una recompensa'),metric('ESTADO DEL ISSUE',data.issue.state==='closed'?'Cerrado':'Abierto',data.repo.archived?'Repositorio archivado':'Estado publicado en GitHub',true),metric('PROPUESTAS OBSERVADAS',String(result.proposalCount),result.commentsComplete?'Comentarios consultados':'Historial parcial'));
 panel.append(metrics,create('p','summary',result.summary));
 const flags=create('ul','flags');for(const flag of result.flags){const li=create('li','flag');const copy=create('div','');copy.append(create('strong','',flag.label),create('p','',flag.detail));li.append(create('span','flag-icon','!'),copy);flags.append(li);}panel.append(flags);
 const todo=create('li','flag');const text=create('div','');text.append(create('strong','','Antes de empezar'),create('p','','Confirma financiación, selección, contrato, requisitos de pruebas y vía de cobro. Una etiqueta abierta no confirma ninguno de esos pasos.'));todo.append(create('span','flag-icon','↗'),text);flags.append(todo);
 const source=create('div','source-panel');source.append(create('span','section-label','COMPRUEBA LAS FUENTES'));const links=create('div','source-links');safeLink(links,'Issue y conversación ↗',result.url);safeLink(links,'Repositorio ↗',data.repo.html_url);if(mode==='Instantánea'&&data.comments?.[0]?.html_url)safeLink(links,'Comentario observado ↗',data.comments[0].html_url);source.append(links);
 const at=new Date(result.checkedAt);const date=Number.isNaN(at.valueOf())?'Fecha no disponible':new Intl.DateTimeFormat('es',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Rome'}).format(at);
 source.append(create('p','checked-at',`Consulta: ${date} · hora de Roma${mode==='Instantánea'?' · datos de ejemplo, sin consulta nueva':''}`));
 const report={tool:'RewardLens',version:1,mode,...result,externalRewardObservation:data.issue.advertisedReward??null,limitations:['Importe extraído del título; financiación no verificada.','No es prueba de selección, contrato ni pago.','Las señales textuales requieren revisión humana.'],sources:{issue:result.url,repo:data.repo.html_url}};
 const json=JSON.stringify(report,null,2);
 const download=create('button','export','Descargar informe .json ↓');download.type='button';download.addEventListener('click',()=>{
  const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`rewardlens-${data.issue.number}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Archivo preparado. Si el navegador no lo guarda, abre «Ver informe JSON» y copia su contenido.');
 });
 const preview=create('details','export-preview');preview.append(create('summary','','Ver informe JSON'),create('pre','',json));source.append(download,preview);panel.append(source);
}
for(const demo of demos.filter(d=>!d.synthetic)){
 const button=create('button','demo-button');button.type='button';button.dataset.id=demo.id;button.append(create('small','',`${currency(analyzeIssue(demo).amount)} / INSTANTÁNEA`),create('strong','',demo.label));button.addEventListener('click',()=>{
  activeController?.abort();el('audit-button').disabled=false;document.querySelectorAll('.demo-button').forEach(b=>b.classList.toggle('active',b===button));el('issue-url').value=demo.issue.html_url;render(demo,'Instantánea');setMessage('Ejemplo basado en fuentes comprobadas. Usa Revisar enlace para consultar el estado actual.');
 });el('demo-buttons').append(button);
}
async function github(path,signal){const response=await fetch(`https://api.github.com${path}`,{signal,headers:{Accept:'application/vnd.github+json'}});if(!response.ok){if(response.status===404)throw new Error('GitHub no encuentra este issue público. Comprueba el enlace y el acceso al repositorio.');if(response.status===403||response.status===429)throw new Error('GitHub limitó las consultas públicas. Inténtalo más tarde; los ejemplos siguen disponibles.');throw new Error(`GitHub devolvió un error (${response.status}). Inténtalo más tarde.`);}return {data:await response.json(),next:response.headers.get('link')?.includes('rel="next"')??false};}
el('audit-form').addEventListener('submit',async(event)=>{
 event.preventDefault();let parsed;try{parsed=parseIssueUrl(el('issue-url').value);}catch(error){setMessage(error.message,true);return;}
 activeController?.abort();const controller=new AbortController();activeController=controller;const timeout=setTimeout(()=>controller.abort('timeout'),20000);el('audit-button').disabled=true;setMessage('Consultando el issue, el repositorio y la conversación pública…');document.querySelectorAll('.demo-button').forEach(b=>b.classList.remove('active'));
 try{
  const base=`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const [issue,repo,first]=await Promise.all([github(`${base}/issues/${parsed.number}`,controller.signal),github(base,controller.signal),github(`${base}/issues/${parsed.number}/comments?per_page=100`,controller.signal)]);
  let comments=first.data;let complete=!first.next;if(first.next){const second=await github(`${base}/issues/${parsed.number}/comments?per_page=100&page=2`,controller.signal);comments=comments.concat(second.data);complete=!second.next;}
  if(controller.signal.aborted)return;
  render({issue:issue.data,repo:repo.data,comments,commentsComplete:complete,checkedAt:new Date().toISOString()},'Consulta en vivo');setMessage(`Fuente: GitHub · ${comments.length} comentarios leídos${complete?'':' · historial parcial (máximo 200)'}.`);
 }catch(error){const retained=current?' El informe anterior conserva su fecha y no se actualizó.':'';if(controller.signal.reason==='timeout')setMessage('La consulta tardó demasiado. Puedes volver a intentarlo o abrir un ejemplo.'+retained,true);else if(!controller.signal.aborted)setMessage((error instanceof TypeError?'No se pudo conectar con GitHub. Comprueba tu conexión o usa los ejemplos sin conexión.':error.message)+retained,true);}
 finally{clearTimeout(timeout);if(activeController===controller)el('audit-button').disabled=false;}
});

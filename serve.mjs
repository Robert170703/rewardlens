import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
const routes=new Map([['/','index.html'],['/index.html','index.html'],['/style.css','style.css'],['/app.mjs','app.mjs'],['/core.mjs','core.mjs'],['/demo-data.mjs','demo-data.mjs']]);
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8'};
export function createRewardLensServer(){return http.createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=new URL(req.url,'http://127.0.0.1').pathname;}catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Bad request');return;}
 const file=routes.get(pathname);if(!file){res.writeHead(404);res.end('Not found');return;}
 try{const bytes=await fs.readFile(fileURLToPath(new URL(file,import.meta.url)));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src https://api.github.com; img-src 'self' data:; object-src 'none'; base-uri 'self'"});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500);res.end('Cannot read asset');}
});}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 createRewardLensServer().listen(4317,'127.0.0.1',()=>console.log('RewardLens disponible en http://127.0.0.1:4317'));
}

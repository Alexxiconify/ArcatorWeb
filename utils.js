import{auth,db,appId,firebaseReadyPromise}from"./firebase-init.js";
import{doc,getDoc,setDoc,collection,getDocs,query,where,orderBy,limit,serverTimestamp}from"https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function showMessageBox(message,isError=false,allowHtml=false){
const messageBox=document.getElementById("message-box");
if(!messageBox){console.warn("Message box element not found");return;}
messageBox.textContent="";messageBox.className=`message-box ${isError?"error":"success"}`;
if(allowHtml){messageBox.innerHTML=message;}else{messageBox.textContent=message;}
messageBox.style.display="block";setTimeout(()=>{messageBox.style.display="none";},5000);}

export function showCustomConfirm(message,submessage=""){
return new Promise((resolve)=>{
const modal=document.getElementById("custom-confirm-modal");
if(!modal){console.warn("Custom confirm modal not found");resolve(false);return;}
modal.style.display="none";
const messageEl=document.getElementById("confirm-message");
const submessageEl=document.getElementById("confirm-submessage");
const yesBtn=document.getElementById("confirm-yes");
const noBtn=document.getElementById("confirm-no");
if(messageEl)messageEl.textContent=message;
if(submessageEl)submessageEl.textContent=submessage;
const handleYes=()=>{modal.style.display="none";resolve(true);};
const handleNo=()=>{modal.style.display="none";resolve(false);};
yesBtn.onclick=handleYes;noBtn.onclick=handleNo;modal.style.display="flex";});}

export function escapeHtml(text){
const div=document.createElement("div");div.textContent=text;return div.innerHTML;}

export function parseCSVLine(line){
const result=[];let current='';let inQuotes=false;
for(let i=0;i<line.length;i++){
const char=line[i];
if(char==='"'){inQuotes=!inQuotes;}
else if(char===','&&!inQuotes){result.push(current.trim());current='';}
else{current+=char;}}
result.push(current.trim());return result.map(val=>val.replace(/^"|"$/g,''));}

export function parseCSV(csvText){
const lines=csvText.trim().split('\n');
if(lines.length<2)return[];
const headers=lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
const data=[];
for(let i=1;i<lines.length;i++){
const values=parseCSVLine(lines[i]);
if(values.length>=2){
const row={interest:values[0]||'',members:values[1]||'0',category:'Gaming',description:``};
const players=[];
for(let j=2;j<values.length;j++){
if(values[j]&&values[j].trim()!==''){players.push(headers[j]||`Player ${j}`);}}
if(players.length>0){row.description+=`Users: ${players.join(', ')}`;}
if(row.interest&&row.interest.trim()!==''){data.push(row);}}}
return data;}

export function parseDonationsCSV(csvText){
const lines=csvText.trim().split('\n');
if(lines.length<2)return[];
const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());
const data=[];
for(let i=1;i<lines.length;i++){
const values=lines[i].split(',');
const row={};
headers.forEach((header,idx)=>{row[header]=values[idx]||'';});
data.push({
expense:row['expense']||row['expenses']||'',
cost:row['cost']||'',
description:row['description']||'',
donor:row['donor']||row['donation']||row['donations']||''});}
return data;}

export function parseMachinesCSV(csvText){
const lines=csvText.trim().split('\n');
if(lines.length<2)return[];
const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());
const data=[];
for(let i=1;i<lines.length;i++){
const values=lines[i].split(',');
const row={};
headers.forEach((header,idx)=>{row[header]=values[idx]||'';});
data.push({
name:row['machine name']||row['name']||'',
owner:row['owner']||'',
location:row['location']||'',
purpose:row['purpose']||'',
internalId:row['s# (internal)']||row['internalid']||'',
notes:row['notes']||''});}
return data;}

export function convertDiscordUrlToReliableCDN(url){
if(!url||typeof url!=='string')return url;
if(url.includes('cdn.discordapp.com')||url.includes('media.discordapp.net')){
return url.replace(/\.(png|jpg|jpeg|gif|webp)\?.*$/,'.$1');}
return url;}

export async function uploadImageToImgBB(imageFile,apiKey){
try{
const formData=new FormData();
formData.append('image',imageFile);
formData.append('key',apiKey);
const response=await fetch('https://api.imgbb.com/1/upload',{
method:'POST',body:formData});
if(!response.ok)throw new Error('Upload failed');
const data=await response.json();
if(data.success){return data.data.url;}
else{throw new Error(data.error?.message||'Upload failed');}}
catch(error){console.error('ImgBB upload error:',error);throw error;}}

export function validatePhotoURL(url){
if(!url||typeof url!=='string')return false;
const validExtensions=['.jpg','.jpeg','.png','.gif','.webp'];
const lowerUrl=url.toLowerCase();
return validExtensions.some(ext=>lowerUrl.includes(ext))||
lowerUrl.includes('cdn.discordapp.com')||
lowerUrl.includes('media.discordapp.net')||
lowerUrl.includes('imgbb.com')||
lowerUrl.includes('i.imgur.com');}

export async function testImageURL(url,timeout=5000){
return new Promise((resolve)=>{
const img=new Image();
const timer=setTimeout(()=>{img.src='';resolve(false);},timeout);
img.onload=()=>{clearTimeout(timer);resolve(true);};
img.onerror=()=>{clearTimeout(timer);resolve(false);};
img.src=url;});}

export function renderMediaContent(url,containerId){
const container=document.getElementById(containerId);
if(!container)return;
container.innerHTML='';
if(!url||!validateMediaUrl(url)){container.innerHTML='<p>Invalid media URL</p>';return;}
const videoId=extractYouTubeVideoId(url);
if(videoId){
container.innerHTML=`<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
return;}
if(url.match(/\.(jpg|jpeg|png|gif|webp)$/i)){
container.innerHTML=`<img src="${url}" alt="Media content" style="max-width:100%;height:auto;">`;
return;}
container.innerHTML=`<p>Unsupported media type: ${url}</p>`;}

export function validateMediaUrl(url){
if(!url||typeof url!=='string')return false;
const videoId=extractYouTubeVideoId(url);
if(videoId)return true;
const imageExtensions=['.jpg','.jpeg','.png','.gif','.webp'];
const lowerUrl=url.toLowerCase();
return imageExtensions.some(ext=>lowerUrl.includes(ext));}

export function createMediaPreview(url,containerId){
const container=document.getElementById(containerId);
if(!container)return;
container.innerHTML='';
if(!url||!validateMediaUrl(url)){container.innerHTML='<p>Invalid media URL</p>';return;}
const videoId=extractYouTubeVideoId(url);
if(videoId){
container.innerHTML=`<div style="position:relative;width:100%;height:200px;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;">
<img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" alt="YouTube thumbnail" style="max-width:100%;max-height:100%;object-fit:cover;border-radius:8px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 16px;border-radius:4px;">▶ Play</div>
</div>`;
return;}
if(url.match(/\.(jpg|jpeg|png|gif|webp)$/i)){
container.innerHTML=`<img src="${url}" alt="Media preview" style="max-width:100%;max-height:200px;object-fit:cover;border-radius:8px;">`;
return;}
container.innerHTML=`<p>Unsupported media type: ${url}</p>`;}

export function extractYouTubeVideoId(url){
if(!url||typeof url!=='string')return null;
const patterns=[
/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
/^https?:\/\/youtu\.be\/([^?]+)/,
/^https?:\/\/(?:www\.)?youtube\.com\/embed\/([^?]+)/];
for(const pattern of patterns){
const match=url.match(pattern);
if(match)return match[1];}
return null;}

export async function resolveHandlesToUids(handles){
if(!Array.isArray(handles)||handles.length===0)return [];
try{
const handlesRef=collection(db,'handles');
const q=query(handlesRef,where('handle','in',handles));
const snapshot=await getDocs(q);
const uidMap={};
snapshot.forEach(doc=>{
const data=doc.data();
if(data.handle&&data.uid){uidMap[data.handle]=data.uid;}});
return handles.map(handle=>uidMap[handle]||null);}
catch(error){console.error('Error resolving handles:',error);return handles.map(()=>null);}}

export async function getUserProfileFromFirestore(uid){
if(!uid)return null;
try{
const userDoc=await getDoc(doc(db,'users',uid));
if(userDoc.exists()){return userDoc.data();}
return null;}
catch(error){console.error('Error fetching user profile:',error);return null;}}
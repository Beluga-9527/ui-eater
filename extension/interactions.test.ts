import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { foodAtPoint } from './interactions';

function fixture(){
  const dom=new JSDOM('<button id="food"><span id="caption">Eat me</span></button><form><button id="protected">Do not eat</button></form><div id="cover"></div><div id="host"><button id="own">Stop</button></div>',{pretendToBeVisual:true});
  const document=dom.window.document,host=document.getElementById('host')!;
  for(const element of document.querySelectorAll<HTMLElement>('*'))element.getBoundingClientRect=()=>({x:100,y:100,width:100,height:40,left:100,top:100,right:200,bottom:140,toJSON:()=>({})});
  return{dom,document,host,get:(id:string)=>document.getElementById(id)!};
}

test('target picking skips the extension host and selects a complete underlying control without clicking it',()=>{
  const{dom,document,host,get}=fixture();let clicks=0;get('food').addEventListener('click',()=>clicks++);
  document.elementsFromPoint=()=>[host,get('caption'),get('food')];
  assert.equal(foodAtPoint(document,host,130,120),get('food'));assert.equal(clicks,0);dom.window.close();
});
test('target picking never reaches through a protected form to eat a control behind it',()=>{
  const{dom,document,host,get}=fixture();document.elementsFromPoint=()=>[host,get('protected'),get('food')];
  assert.equal(foodAtPoint(document,host,130,120),null);dom.window.close();
});
test('a covering surface blocks food beneath it, and invalid pointer coordinates are ignored',()=>{
  const{dom,document,host,get}=fixture();document.elementsFromPoint=()=>[host,get('cover'),get('food')];
  assert.equal(foodAtPoint(document,host,130,120),null);assert.equal(foodAtPoint(document,host,NaN,120),null);dom.window.close();
});

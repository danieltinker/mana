import{A as Bo,a as ec,b as tc,c as is,e as nc,f as Fo,g as rs,n as ic,p as Io,q as ss,r as os,s as mt,t as rc,u as zo,v as sc,w as oc,x as ac,y as lc,z as cc}from"./chunk-AV2Z4LDG.js";/**
 * @license
 * Copyright 2010-2021 Three.js Authors
 * SPDX-License-Identifier: MIT
 */var Oh=0,uc=1,Hh=2;var Au=1,kh=2,dr=3,go=0,ot=1,Rt=2,Lu=1;var pr=0,mr=1,br=2,hc=3,dc=4,Vi=5,Xt=100,Gh=101,Vh=102,fc=103,pc=104,Cl=200,$t=201,Wh=202,qh=203,Ru=204,Wi=205,Xh=206,Yh=207,Zh=208,Jh=209,jh=210,$h=0,Kh=1,Qh=2,xa=3,ed=4,td=5,nd=6,id=7,vo=0,rd=1,sd=2,gr=0,od=1,ad=2,ld=3,cd=4,ud=5,Cu=300,Pl=301,Dl=302,mc=303,gc=304,Fl=306,Il=307,Mr=1e3,Yt=1001,Sr=1002,Mt=1003,vc=1004;var xc=1005;var vt=1006,hd=1007;var ni=1008;var zl=1009,dd=1010,fd=1011,Os=1012,pd=1013,Ns=1014,Fn=1015,Hs=1016,md=1017,gd=1018,vd=1019,vr=1020,xd=1021,gn=1022,Zt=1023,yd=1024,_d=1025;var Li=1026,Tr=1027,wd=1028,bd=1029,Md=1030,Sd=1031,Td=1032,Ed=1033,yc=33776,_c=33777,wc=33778,bc=33779,Mc=35840,Sc=35841,Tc=35842,Ec=35843,Ad=36196,Ac=37492,Lc=37496,Ld=37808,Rd=37809,Cd=37810,Pd=37811,Dd=37812,Fd=37813,Id=37814,zd=37815,Bd=37816,Nd=37817,Ud=37818,Od=37819,Hd=37820,kd=37821,Gd=36492,Vd=37840,Wd=37841,qd=37842,Xd=37843,Yd=37844,Zd=37845,Jd=37846,jd=37847,$d=37848,Kd=37849,Qd=37850,ef=37851,tf=37852,nf=37853,rf=2200,sf=2201,of=2202,ks=2300,Gs=2301,No=2302,Ti=2400,Ei=2401,Vs=2402,Bl=2500,Pu=2501,af=0;var qi=3e3,Nl=3001,Du=3007,Fu=3002,lf=3003,Iu=3004,zu=3005,Bu=3006,cf=3200,uf=3201,Xi=0,hf=1;var Uo=7680;var df=519,Er=35044,Ws=35048;var Rc="300 es",xn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let i=this._listeners[e];if(i!==void 0){let s=i.indexOf(t);s!==-1&&i.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let n=this._listeners[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let s=0,o=i.length;s<o;s++)i[s].call(this,e);e.target=null}}},dt=[];for(let r=0;r<256;r++)dt[r]=(r<16?"0":"")+r.toString(16);var Oo=Math.PI/180,ya=180/Math.PI;function Jt(){let r=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(dt[r&255]+dt[r>>8&255]+dt[r>>16&255]+dt[r>>24&255]+"-"+dt[e&255]+dt[e>>8&255]+"-"+dt[e>>16&15|64]+dt[e>>24&255]+"-"+dt[t&63|128]+dt[t>>8&255]+"-"+dt[t>>16&255]+dt[t>>24&255]+dt[n&255]+dt[n>>8&255]+dt[n>>16&255]+dt[n>>24&255]).toUpperCase()}function bt(r,e,t){return Math.max(e,Math.min(t,r))}function ff(r,e){return(r%e+e)%e}function Ho(r,e,t){return(1-t)*r+t*e}function Cc(r){return(r&r-1)===0&&r!==0}function pf(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function mf(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}var te=class{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this)}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this)}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector2: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*n-o*i+e.x,this.y=s*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}};te.prototype.isVector2=!0;var at=class{constructor(){this.elements=[1,0,0,0,1,0,0,0,1],arguments.length>0&&console.error("THREE.Matrix3: the constructor no longer reads arguments. use .set() instead.")}set(e,t,n,i,s,o,a,l,c){let u=this.elements;return u[0]=e,u[1]=i,u[2]=a,u[3]=t,u[4]=s,u[5]=l,u[6]=n,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],u=n[4],h=n[7],d=n[2],f=n[5],g=n[8],v=i[0],_=i[3],m=i[6],p=i[1],L=i[4],A=i[7],C=i[2],b=i[5],I=i[8];return s[0]=o*v+a*p+l*C,s[3]=o*_+a*L+l*b,s[6]=o*m+a*A+l*I,s[1]=c*v+u*p+h*C,s[4]=c*_+u*L+h*b,s[7]=c*m+u*A+h*I,s[2]=d*v+f*p+g*C,s[5]=d*_+f*L+g*b,s[8]=d*m+f*A+g*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-n*s*u+n*a*l+i*s*c-i*o*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=u*o-a*c,d=a*l-u*s,f=c*s-o*l,g=t*h+n*d+i*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let v=1/g;return e[0]=h*v,e[1]=(i*c-u*n)*v,e[2]=(a*n-i*o)*v,e[3]=d*v,e[4]=(u*t-i*l)*v,e[5]=(i*s-a*t)*v,e[6]=f*v,e[7]=(n*l-c*t)*v,e[8]=(o*t-n*s)*v,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-i*c,i*l,-i*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){let n=this.elements;return n[0]*=e,n[3]*=e,n[6]*=e,n[1]*=t,n[4]*=t,n[7]*=t,this}rotate(e){let t=Math.cos(e),n=Math.sin(e),i=this.elements,s=i[0],o=i[3],a=i[6],l=i[1],c=i[4],u=i[7];return i[0]=t*s+n*l,i[3]=t*o+n*c,i[6]=t*a+n*u,i[1]=-n*s+t*l,i[4]=-n*o+t*c,i[7]=-n*a+t*u,this}translate(e,t){let n=this.elements;return n[0]+=e*n[2],n[3]+=e*n[5],n[6]+=e*n[8],n[1]+=t*n[2],n[4]+=t*n[5],n[7]+=t*n[8],this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};at.prototype.isMatrix3=!0;var ai,Bn=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement=="undefined")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{ai===void 0&&(ai=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")),ai.width=e.width,ai.height=e.height;let n=ai.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=ai}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}},gf=0,yt=class r extends xn{constructor(e=r.DEFAULT_IMAGE,t=r.DEFAULT_MAPPING,n=Yt,i=Yt,s=vt,o=ni,a=Zt,l=zl,c=1,u=qi){super(),Object.defineProperty(this,"id",{value:gf++}),this.uuid=Jt(),this.name="",this.image=e,this.mipmaps=[],this.mapping=t,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new te(0,0),this.repeat=new te(1,1),this.center=new te(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new at,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.encoding=u,this.version=0,this.onUpdate=null}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.image=e.image,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.encoding=e.encoding,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.5,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,mapping:this.mapping,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,type:this.type,encoding:this.encoding,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(this.image!==void 0){let i=this.image;if(i.uuid===void 0&&(i.uuid=Jt()),!t&&e.images[i.uuid]===void 0){let s;if(Array.isArray(i)){s=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?s.push(ko(i[o].image)):s.push(ko(i[o]))}else s=ko(i);e.images[i.uuid]={uuid:i.uuid,url:s}}n.image=i.uuid}return t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Cu)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Mr:e.x=e.x-Math.floor(e.x);break;case Yt:e.x=e.x<0?0:1;break;case Sr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Mr:e.y=e.y-Math.floor(e.y);break;case Yt:e.y=e.y<0?0:1;break;case Sr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&this.version++}};yt.DEFAULT_IMAGE=void 0;yt.DEFAULT_MAPPING=Cu;yt.prototype.isTexture=!0;function ko(r){return typeof HTMLImageElement!="undefined"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&r instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&r instanceof ImageBitmap?Bn.getDataURL(r):r.data?{data:Array.prototype.slice.call(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var He=class{constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector4: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector4: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*s,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*s,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*s,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,s,l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],g=l[9],v=l[2],_=l[6],m=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-v)<.01&&Math.abs(g-_)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+v)<.1&&Math.abs(g+_)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let L=(c+1)/2,A=(f+1)/2,C=(m+1)/2,b=(u+d)/4,I=(h+v)/4,N=(g+_)/4;return L>A&&L>C?L<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(L),i=b/n,s=I/n):A>C?A<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(A),n=b/i,s=N/i):C<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(C),n=I/s,i=N/s),this.set(n,i,s,t),this}let p=Math.sqrt((_-g)*(_-g)+(h-v)*(h-v)+(d-u)*(d-u));return Math.abs(p)<.001&&(p=1),this.x=(_-g)/p,this.y=(h-v)/p,this.z=(d-u)/p,this.w=Math.acos((c+f+m-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this.w=this.w<0?Math.ceil(this.w):Math.floor(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector4: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}};He.prototype.isVector4=!0;var jt=class extends xn{constructor(e,t,n){super(),this.width=e,this.height=t,this.depth=1,this.scissor=new He(0,0,e,t),this.scissorTest=!1,this.viewport=new He(0,0,e,t),n=n||{},this.texture=new yt(void 0,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.encoding),this.texture.image={},this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=1,this.texture.generateMipmaps=n.generateMipmaps!==void 0?n.generateMipmaps:!1,this.texture.minFilter=n.minFilter!==void 0?n.minFilter:vt,this.depthBuffer=n.depthBuffer!==void 0?n.depthBuffer:!0,this.stencilBuffer=n.stencilBuffer!==void 0?n.stencilBuffer:!1,this.depthTexture=n.depthTexture!==void 0?n.depthTexture:null}setTexture(e){e.image={width:this.width,height:this.height,depth:this.depth},this.texture=e}setSize(e,t,n=1){(this.width!==e||this.height!==t||this.depth!==n)&&(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.width=e.width,this.height=e.height,this.depth=e.depth,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.depthTexture=e.depthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}};jt.prototype.isWebGLRenderTarget=!0;var _a=class extends jt{constructor(e,t,n){super(e,t,n),this.samples=4}copy(e){return super.copy.call(this,e),this.samples=e.samples,this}};_a.prototype.isWebGLMultisampleRenderTarget=!0;var pt=class{constructor(e=0,t=0,n=0,i=1){this._x=e,this._y=t,this._z=n,this._w=i}static slerp(e,t,n,i){return console.warn("THREE.Quaternion: Static .slerp() has been deprecated. Use qm.slerpQuaternions( qa, qb, t ) instead."),n.slerpQuaternions(e,t,i)}static slerpFlat(e,t,n,i,s,o,a){let l=n[i+0],c=n[i+1],u=n[i+2],h=n[i+3],d=s[o+0],f=s[o+1],g=s[o+2],v=s[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(a===1){e[t+0]=d,e[t+1]=f,e[t+2]=g,e[t+3]=v;return}if(h!==v||l!==d||c!==f||u!==g){let _=1-a,m=l*d+c*f+u*g+h*v,p=m>=0?1:-1,L=1-m*m;if(L>Number.EPSILON){let C=Math.sqrt(L),b=Math.atan2(C,m*p);_=Math.sin(_*b)/C,a=Math.sin(a*b)/C}let A=a*p;if(l=l*_+d*A,c=c*_+f*A,u=u*_+g*A,h=h*_+v*A,_===1-a){let C=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=C,c*=C,u*=C,h*=C}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,s,o){let a=n[i],l=n[i+1],c=n[i+2],u=n[i+3],h=s[o],d=s[o+1],f=s[o+2],g=s[o+3];return e[t]=a*g+u*h+l*f-c*d,e[t+1]=l*g+u*d+c*h-a*f,e[t+2]=c*g+u*f+a*d-l*h,e[t+3]=u*g-a*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t){if(!(e&&e.isEuler))throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");let n=e._x,i=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),u=a(i/2),h=a(s/2),d=l(n/2),f=l(i/2),g=l(s/2);switch(o){case"XYZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"YXZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"ZXY":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"ZYX":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"YZX":this._x=d*u*h+c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h-d*f*g;break;case"XZY":this._x=d*u*h-c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t!==!1&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=n+a+h;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(s-c)*f,this._z=(o-i)*f}else if(n>a&&n>h){let f=2*Math.sqrt(1+n-a-h);this._w=(u-l)/f,this._x=.25*f,this._y=(i+o)/f,this._z=(s+c)/f}else if(a>h){let f=2*Math.sqrt(1+a-n-h);this._w=(s-c)/f,this._x=(i+o)/f,this._y=.25*f,this._z=(l+u)/f}else{let f=2*Math.sqrt(1+h-n-a);this._w=(o-i)/f,this._x=(s+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(bt(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e,t){return t!==void 0?(console.warn("THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead."),this.multiplyQuaternions(e,t)):this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+o*a+i*c-s*l,this._y=i*u+o*l+s*a-n*c,this._z=s*u+o*c+n*l-i*a,this._w=o*u-n*a-i*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,i=this._y,s=this._z,o=this._w,a=o*e._w+n*e._x+i*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=i,this._z=s,this;let l=1-a*a;if(l<=Number.EPSILON){let f=1-t;return this._w=f*o+t*this._w,this._x=f*n+t*this._x,this._y=f*i+t*this._y,this._z=f*s+t*this._z,this.normalize(),this._onChangeCallback(),this}let c=Math.sqrt(l),u=Math.atan2(c,a),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=o*h+this._w*d,this._x=n*h+this._x*d,this._y=i*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){this.copy(e).slerp(t,n)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}};pt.prototype.isQuaternion=!0;var T=class{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e,t){return t!==void 0?(console.warn("THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead."),this.multiplyVectors(e,t)):(this.x*=e.x,this.y*=e.y,this.z*=e.z,this)}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return e&&e.isEuler||console.error("THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order."),this.applyQuaternion(Pc.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Pc.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=e.elements,o=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*o,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*o,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=l*t+o*i-a*n,u=l*n+a*t-s*i,h=l*i+s*n-o*t,d=-s*t-o*n-a*i;return this.x=c*l+d*-s+u*-a-h*-o,this.y=u*l+d*-o+h*-s-c*-a,this.z=h*l+d*-a+c*-o-u*-s,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e,t){return t!==void 0?(console.warn("THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead."),this.crossVectors(e,t)):this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=i*l-s*a,this.y=s*o-n*l,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Go.copy(this).projectOnVector(e),this.sub(Go)}reflect(e){return this.sub(Go.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(bt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector3: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}};T.prototype.isVector3=!0;var Go=new T,Pc=new pt,At=class{constructor(e=new T(1/0,1/0,1/0),t=new T(-1/0,-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){let t=1/0,n=1/0,i=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=e.length;l<c;l+=3){let u=e[l],h=e[l+1],d=e[l+2];u<t&&(t=u),h<n&&(n=h),d<i&&(i=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,n,i),this.max.set(s,o,a),this}setFromBufferAttribute(e){let t=1/0,n=1/0,i=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=e.count;l<c;l++){let u=e.getX(l),h=e.getY(l),d=e.getZ(l);u<t&&(t=u),h<n&&(n=h),d<i&&(i=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,n,i),this.max.set(s,o,a),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=nr.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e){return this.makeEmpty(),this.expandByObject(e)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return e===void 0&&(console.warn("THREE.Box3: .getCenter() target is now required"),e=new T),this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(console.warn("THREE.Box3: .getSize() target is now required"),e=new T),this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e){e.updateWorldMatrix(!1,!1);let t=e.geometry;t!==void 0&&(t.boundingBox===null&&t.computeBoundingBox(),Vo.copy(t.boundingBox),Vo.applyMatrix4(e.matrixWorld),this.union(Vo));let n=e.children;for(let i=0,s=n.length;i<s;i++)this.expandByObject(n[i]);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t===void 0&&(console.warn("THREE.Box3: .getParameter() target is now required"),t=new T),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,nr),nr.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ir),as.subVectors(this.max,ir),li.subVectors(e.a,ir),ci.subVectors(e.b,ir),ui.subVectors(e.c,ir),Tn.subVectors(ci,li),En.subVectors(ui,ci),Zn.subVectors(li,ui);let t=[0,-Tn.z,Tn.y,0,-En.z,En.y,0,-Zn.z,Zn.y,Tn.z,0,-Tn.x,En.z,0,-En.x,Zn.z,0,-Zn.x,-Tn.y,Tn.x,0,-En.y,En.x,0,-Zn.y,Zn.x,0];return!Wo(t,li,ci,ui,as)||(t=[1,0,0,0,1,0,0,0,1],!Wo(t,li,ci,ui,as))?!1:(ls.crossVectors(Tn,En),t=[ls.x,ls.y,ls.z],Wo(t,li,ci,ui,as))}clampPoint(e,t){return t===void 0&&(console.warn("THREE.Box3: .clampPoint() target is now required"),t=new T),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return nr.copy(e).clamp(this.min,this.max).sub(e).length()}getBoundingSphere(e){return e===void 0&&console.error("THREE.Box3: .getBoundingSphere() target is now required"),this.getCenter(e.center),e.radius=this.getSize(nr).length()*.5,e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(hn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),hn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),hn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),hn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),hn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),hn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),hn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),hn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(hn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};At.prototype.isBox3=!0;var hn=[new T,new T,new T,new T,new T,new T,new T,new T],nr=new T,Vo=new At,li=new T,ci=new T,ui=new T,Tn=new T,En=new T,Zn=new T,ir=new T,as=new T,ls=new T,Jn=new T;function Wo(r,e,t,n,i){for(let s=0,o=r.length-3;s<=o;s+=3){Jn.fromArray(r,s);let a=i.x*Math.abs(Jn.x)+i.y*Math.abs(Jn.y)+i.z*Math.abs(Jn.z),l=e.dot(Jn),c=t.dot(Jn),u=n.dot(Jn);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var vf=new At,Dc=new T,qo=new T,Xo=new T,Nn=class{constructor(e=new T,t=-1){this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):vf.setFromPoints(e).getCenter(n);let i=0;for(let s=0,o=e.length;s<o;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t===void 0&&(console.warn("THREE.Sphere: .clampPoint() target is now required"),t=new T),t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return e===void 0&&(console.warn("THREE.Sphere: .getBoundingBox() target is now required"),e=new At),this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){Xo.subVectors(e,this.center);let t=Xo.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.add(Xo.multiplyScalar(i/n)),this.radius+=i}return this}union(e){return qo.subVectors(e.center,this.center).normalize().multiplyScalar(e.radius),this.expandByPoint(Dc.copy(e.center).add(qo)),this.expandByPoint(Dc.copy(e.center).sub(qo)),this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},dn=new T,Yo=new T,cs=new T,An=new T,Zo=new T,us=new T,Jo=new T,Un=class{constructor(e=new T,t=new T(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t===void 0&&(console.warn("THREE.Ray: .at() target is now required"),t=new T),t.copy(this.direction).multiplyScalar(e).add(this.origin)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,dn)),this}closestPointToPoint(e,t){t===void 0&&(console.warn("THREE.Ray: .closestPointToPoint() target is now required"),t=new T),t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.direction).multiplyScalar(n).add(this.origin)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=dn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(dn.copy(this.direction).multiplyScalar(t).add(this.origin),dn.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){Yo.copy(e).add(t).multiplyScalar(.5),cs.copy(t).sub(e).normalize(),An.copy(this.origin).sub(Yo);let s=e.distanceTo(t)*.5,o=-this.direction.dot(cs),a=An.dot(this.direction),l=-An.dot(cs),c=An.lengthSq(),u=Math.abs(1-o*o),h,d,f,g;if(u>0)if(h=o*l-a,d=o*a-l,g=s*u,h>=0)if(d>=-g)if(d<=g){let v=1/u;h*=v,d*=v,f=h*(h+o*d+2*a)+d*(o*h+d+2*l)+c}else d=s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d<=-g?(h=Math.max(0,-(-o*s+a)),d=h>0?-s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c):d<=g?(h=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(h=Math.max(0,-(o*s+a)),d=h>0?s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c);else d=o>0?-s:s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;return n&&n.copy(this.direction).multiplyScalar(h).add(this.origin),i&&i.copy(cs).multiplyScalar(d).add(Yo),f}intersectSphere(e,t){dn.subVectors(e.center,this.origin);let n=dn.dot(this.direction),i=dn.dot(dn)-n*n,s=e.radius*e.radius;if(i>s)return null;let o=Math.sqrt(s-i),a=n-o,l=n+o;return a<0&&l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,s,o,a,l,c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,o=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,o=(e.min.y-d.y)*u),n>o||s>i||((s>n||n!==n)&&(n=s),(o<i||i!==i)&&(i=o),h>=0?(a=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(a=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,dn)!==null}intersectTriangle(e,t,n,i,s){Zo.subVectors(t,e),us.subVectors(n,e),Jo.crossVectors(Zo,us);let o=this.direction.dot(Jo),a;if(o>0){if(i)return null;a=1}else if(o<0)a=-1,o=-o;else return null;An.subVectors(this.origin,e);let l=a*this.direction.dot(us.crossVectors(An,us));if(l<0)return null;let c=a*this.direction.dot(Zo.cross(An));if(c<0||l+c>o)return null;let u=-a*An.dot(Jo);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},De=class r{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],arguments.length>0&&console.error("THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.")}set(e,t,n,i,s,o,a,l,c,u,h,d,f,g,v,_){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=s,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=u,m[10]=h,m[14]=d,m[3]=f,m[7]=g,m[11]=v,m[15]=_,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new r().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,i=1/hi.setFromMatrixColumn(e,0).length(),s=1/hi.setFromMatrixColumn(e,1).length(),o=1/hi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){e&&e.isEuler||console.error("THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.");let t=this.elements,n=e.x,i=e.y,s=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(i),c=Math.sin(i),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){let d=o*u,f=o*h,g=a*u,v=a*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+g*c,t[5]=d-v*c,t[9]=-a*l,t[2]=v-d*c,t[6]=g+f*c,t[10]=o*l}else if(e.order==="YXZ"){let d=l*u,f=l*h,g=c*u,v=c*h;t[0]=d+v*a,t[4]=g*a-f,t[8]=o*c,t[1]=o*h,t[5]=o*u,t[9]=-a,t[2]=f*a-g,t[6]=v+d*a,t[10]=o*l}else if(e.order==="ZXY"){let d=l*u,f=l*h,g=c*u,v=c*h;t[0]=d-v*a,t[4]=-o*h,t[8]=g+f*a,t[1]=f+g*a,t[5]=o*u,t[9]=v-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let d=o*u,f=o*h,g=a*u,v=a*h;t[0]=l*u,t[4]=g*c-f,t[8]=d*c+v,t[1]=l*h,t[5]=v*c+d,t[9]=f*c-g,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let d=o*l,f=o*c,g=a*l,v=a*c;t[0]=l*u,t[4]=v-d*h,t[8]=g*h+f,t[1]=h,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=f*h+g,t[10]=d-v*h}else if(e.order==="XZY"){let d=o*l,f=o*c,g=a*l,v=a*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+v,t[5]=o*u,t[9]=f*h-g,t[2]=g*h-f,t[6]=a*u,t[10]=v*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(xf,e,yf)}lookAt(e,t,n){let i=this.elements;return Pt.subVectors(e,t),Pt.lengthSq()===0&&(Pt.z=1),Pt.normalize(),Ln.crossVectors(n,Pt),Ln.lengthSq()===0&&(Math.abs(n.z)===1?Pt.x+=1e-4:Pt.z+=1e-4,Pt.normalize(),Ln.crossVectors(n,Pt)),Ln.normalize(),hs.crossVectors(Pt,Ln),i[0]=Ln.x,i[4]=hs.x,i[8]=Pt.x,i[1]=Ln.y,i[5]=hs.y,i[9]=Pt.y,i[2]=Ln.z,i[6]=hs.z,i[10]=Pt.z,this}multiply(e,t){return t!==void 0?(console.warn("THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead."),this.multiplyMatrices(e,t)):this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],u=n[1],h=n[5],d=n[9],f=n[13],g=n[2],v=n[6],_=n[10],m=n[14],p=n[3],L=n[7],A=n[11],C=n[15],b=i[0],I=i[4],N=i[8],k=i[12],V=i[1],X=i[5],W=i[9],R=i[13],U=i[2],O=i[6],z=i[10],$=i[14],oe=i[3],re=i[7],we=i[11],xe=i[15];return s[0]=o*b+a*V+l*U+c*oe,s[4]=o*I+a*X+l*O+c*re,s[8]=o*N+a*W+l*z+c*we,s[12]=o*k+a*R+l*$+c*xe,s[1]=u*b+h*V+d*U+f*oe,s[5]=u*I+h*X+d*O+f*re,s[9]=u*N+h*W+d*z+f*we,s[13]=u*k+h*R+d*$+f*xe,s[2]=g*b+v*V+_*U+m*oe,s[6]=g*I+v*X+_*O+m*re,s[10]=g*N+v*W+_*z+m*we,s[14]=g*k+v*R+_*$+m*xe,s[3]=p*b+L*V+A*U+C*oe,s[7]=p*I+L*X+A*O+C*re,s[11]=p*N+L*W+A*z+C*we,s[15]=p*k+L*R+A*$+C*xe,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],g=e[3],v=e[7],_=e[11],m=e[15];return g*(+s*l*h-i*c*h-s*a*d+n*c*d+i*a*f-n*l*f)+v*(+t*l*f-t*c*d+s*o*d-i*o*f+i*c*u-s*l*u)+_*(+t*c*h-t*a*f-s*o*h+n*o*f+s*a*u-n*c*u)+m*(-i*a*u-t*l*h+t*a*d+i*o*h-n*o*d+n*l*u)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],g=e[12],v=e[13],_=e[14],m=e[15],p=h*_*c-v*d*c+v*l*f-a*_*f-h*l*m+a*d*m,L=g*d*c-u*_*c-g*l*f+o*_*f+u*l*m-o*d*m,A=u*v*c-g*h*c+g*a*f-o*v*f-u*a*m+o*h*m,C=g*h*l-u*v*l-g*a*d+o*v*d+u*a*_-o*h*_,b=t*p+n*L+i*A+s*C;if(b===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let I=1/b;return e[0]=p*I,e[1]=(v*d*s-h*_*s-v*i*f+n*_*f+h*i*m-n*d*m)*I,e[2]=(a*_*s-v*l*s+v*i*c-n*_*c-a*i*m+n*l*m)*I,e[3]=(h*l*s-a*d*s-h*i*c+n*d*c+a*i*f-n*l*f)*I,e[4]=L*I,e[5]=(u*_*s-g*d*s+g*i*f-t*_*f-u*i*m+t*d*m)*I,e[6]=(g*l*s-o*_*s-g*i*c+t*_*c+o*i*m-t*l*m)*I,e[7]=(o*d*s-u*l*s+u*i*c-t*d*c-o*i*f+t*l*f)*I,e[8]=A*I,e[9]=(g*h*s-u*v*s-g*n*f+t*v*f+u*n*m-t*h*m)*I,e[10]=(o*v*s-g*a*s+g*n*c-t*v*c-o*n*m+t*a*m)*I,e[11]=(u*a*s-o*h*s-u*n*c+t*h*c+o*n*f-t*a*f)*I,e[12]=C*I,e[13]=(u*v*i-g*h*i+g*n*d-t*v*d-u*n*_+t*h*_)*I,e[14]=(g*a*i-o*v*i-g*n*l+t*v*l+o*n*_-t*a*_)*I,e[15]=(o*h*i-u*a*i+u*n*l-t*h*l-o*n*d+t*a*d)*I,this}scale(e){let t=this.elements,n=e.x,i=e.y,s=e.z;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),s=1-n,o=e.x,a=e.y,l=e.z,c=s*o,u=s*a;return this.set(c*o+n,c*a-i*l,c*l+i*a,0,c*a+i*l,u*a+n,u*l-i*o,0,c*l-i*a,u*l+i*o,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n){return this.set(1,t,n,0,e,1,n,0,e,t,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,u=o+o,h=a+a,d=s*c,f=s*u,g=s*h,v=o*u,_=o*h,m=a*h,p=l*c,L=l*u,A=l*h,C=n.x,b=n.y,I=n.z;return i[0]=(1-(v+m))*C,i[1]=(f+A)*C,i[2]=(g-L)*C,i[3]=0,i[4]=(f-A)*b,i[5]=(1-(d+m))*b,i[6]=(_+p)*b,i[7]=0,i[8]=(g+L)*I,i[9]=(_-p)*I,i[10]=(1-(d+v))*I,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements,s=hi.set(i[0],i[1],i[2]).length(),o=hi.set(i[4],i[5],i[6]).length(),a=hi.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),e.x=i[12],e.y=i[13],e.z=i[14],Gt.copy(this);let c=1/s,u=1/o,h=1/a;return Gt.elements[0]*=c,Gt.elements[1]*=c,Gt.elements[2]*=c,Gt.elements[4]*=u,Gt.elements[5]*=u,Gt.elements[6]*=u,Gt.elements[8]*=h,Gt.elements[9]*=h,Gt.elements[10]*=h,t.setFromRotationMatrix(Gt),n.x=s,n.y=o,n.z=a,this}makePerspective(e,t,n,i,s,o){o===void 0&&console.warn("THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.");let a=this.elements,l=2*s/(t-e),c=2*s/(n-i),u=(t+e)/(t-e),h=(n+i)/(n-i),d=-(o+s)/(o-s),f=-2*o*s/(o-s);return a[0]=l,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=c,a[9]=h,a[13]=0,a[2]=0,a[6]=0,a[10]=d,a[14]=f,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(e,t,n,i,s,o){let a=this.elements,l=1/(t-e),c=1/(n-i),u=1/(o-s),h=(t+e)*l,d=(n+i)*c,f=(o+s)*u;return a[0]=2*l,a[4]=0,a[8]=0,a[12]=-h,a[1]=0,a[5]=2*c,a[9]=0,a[13]=-d,a[2]=0,a[6]=0,a[10]=-2*u,a[14]=-f,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};De.prototype.isMatrix4=!0;var hi=new T,Gt=new De,xf=new T(0,0,0),yf=new T(1,1,1),Ln=new T,hs=new T,Pt=new T,Fc=new De,Ic=new pt,Ri=class r{constructor(e=0,t=0,n=0,i=r.DefaultOrder){this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._order=i||this._order,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t,n){let i=e.elements,s=i[0],o=i[4],a=i[8],l=i[1],c=i[5],u=i[9],h=i[2],d=i[6],f=i[10];switch(t=t||this._order,t){case"XYZ":this._y=Math.asin(bt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-bt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(bt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-bt(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(bt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-bt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n!==!1&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Fc.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Fc,t,n)}setFromVector3(e,t){return this.set(e.x,e.y,e.z,t||this._order)}reorder(e){return Ic.setFromEuler(this),this.setFromQuaternion(Ic,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}toVector3(e){return e?e.set(this._x,this._y,this._z):new T(this._x,this._y,this._z)}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}};Ri.prototype.isEuler=!0;Ri.DefaultOrder="XYZ";Ri.RotationOrders=["XYZ","YZX","ZXY","XZY","YXZ","ZYX"];var wa=class{constructor(){this.mask=1}set(e){this.mask=1<<e|0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}},_f=0,zc=new T,di=new pt,fn=new De,ds=new T,rr=new T,wf=new T,bf=new pt,Bc=new T(1,0,0),Nc=new T(0,1,0),Uc=new T(0,0,1),Mf={type:"added"},Oc={type:"removed"},Xe=class r extends xn{constructor(){super(),Object.defineProperty(this,"id",{value:_f++}),this.uuid=Jt(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=r.DefaultUp.clone();let e=new T,t=new Ri,n=new pt,i=new T(1,1,1);function s(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new De},normalMatrix:{value:new at}}),this.matrix=new De,this.matrixWorld=new De,this.matrixAutoUpdate=r.DefaultMatrixAutoUpdate,this.matrixWorldNeedsUpdate=!1,this.layers=new wa,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return di.setFromAxisAngle(e,t),this.quaternion.multiply(di),this}rotateOnWorldAxis(e,t){return di.setFromAxisAngle(e,t),this.quaternion.premultiply(di),this}rotateX(e){return this.rotateOnAxis(Bc,e)}rotateY(e){return this.rotateOnAxis(Nc,e)}rotateZ(e){return this.rotateOnAxis(Uc,e)}translateOnAxis(e,t){return zc.copy(e).applyQuaternion(this.quaternion),this.position.add(zc.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Bc,e)}translateY(e){return this.translateOnAxis(Nc,e)}translateZ(e){return this.translateOnAxis(Uc,e)}localToWorld(e){return e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return e.applyMatrix4(fn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ds.copy(e):ds.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),rr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fn.lookAt(rr,ds,this.up):fn.lookAt(ds,rr,this.up),this.quaternion.setFromRotationMatrix(fn),i&&(fn.extractRotation(i.matrixWorld),di.setFromRotationMatrix(fn),this.quaternion.premultiply(di.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(Mf)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Oc)),this}clear(){for(let e=0;e<this.children.length;e++){let t=this.children[e];t.parent=null,t.dispatchEvent(Oc)}return this.children.length=0,this}attach(e){return this.updateWorldMatrix(!0,!1),fn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fn.multiply(e.parent.matrixWorld)),e.applyMatrix4(fn),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getWorldPosition(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldPosition() target is now required"),e=new T),this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldQuaternion() target is now required"),e=new pt),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(rr,e,wf),e}getWorldScale(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldScale() target is now required"),e=new T),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(rr,bf,e),e}getWorldDirection(e){e===void 0&&(console.warn("THREE.Object3D: .getWorldDirection() target is now required"),e=new T),this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){let i=this.children;for(let s=0,o=i.length;s<o;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{}},n.metadata={version:4.5,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),JSON.stringify(this.userData)!=="{}"&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));i.material=a}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),h=o(e.shapes),d=o(e.skeletons),f=o(e.animations);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),h.length>0&&(n.shapes=h),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f)}return n.object=i,n;function o(a){let l=[];for(let c in a){let u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};Xe.DefaultUp=new T(0,1,0);Xe.DefaultMatrixAutoUpdate=!0;Xe.prototype.isObject3D=!0;var jo=new T,Sf=new T,Tf=new at,Bt=class{constructor(e=new T(1,0,0),t=0){this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=jo.subVectors(n,t).cross(Sf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t===void 0&&(console.warn("THREE.Plane: .projectPoint() target is now required"),t=new T),t.copy(this.normal).multiplyScalar(-this.distanceToPoint(e)).add(e)}intersectLine(e,t){t===void 0&&(console.warn("THREE.Plane: .intersectLine() target is now required"),t=new T);let n=e.delta(jo),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let s=-(e.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:t.copy(n).multiplyScalar(s).add(e.start)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e===void 0&&(console.warn("THREE.Plane: .coplanarPoint() target is now required"),e=new T),e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Tf.getNormalMatrix(e),i=this.coplanarPoint(jo).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}};Bt.prototype.isPlane=!0;var Vt=new T,pn=new T,$o=new T,mn=new T,fi=new T,pi=new T,Hc=new T,Ko=new T,Qo=new T,ea=new T,xt=class r{constructor(e=new T,t=new T,n=new T){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i===void 0&&(console.warn("THREE.Triangle: .getNormal() target is now required"),i=new T),i.subVectors(n,t),Vt.subVectors(e,t),i.cross(Vt);let s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(e,t,n,i,s){Vt.subVectors(i,t),pn.subVectors(n,t),$o.subVectors(e,t);let o=Vt.dot(Vt),a=Vt.dot(pn),l=Vt.dot($o),c=pn.dot(pn),u=pn.dot($o),h=o*c-a*a;if(s===void 0&&(console.warn("THREE.Triangle: .getBarycoord() target is now required"),s=new T),h===0)return s.set(-2,-1,-1);let d=1/h,f=(c*l-a*u)*d,g=(o*u-a*l)*d;return s.set(1-f-g,g,f)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,mn),mn.x>=0&&mn.y>=0&&mn.x+mn.y<=1}static getUV(e,t,n,i,s,o,a,l){return this.getBarycoord(e,t,n,i,mn),l.set(0,0),l.addScaledVector(s,mn.x),l.addScaledVector(o,mn.y),l.addScaledVector(a,mn.z),l}static isFrontFacing(e,t,n,i){return Vt.subVectors(n,t),pn.subVectors(e,t),Vt.cross(pn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Vt.subVectors(this.c,this.b),pn.subVectors(this.a,this.b),Vt.cross(pn).length()*.5}getMidpoint(e){return e===void 0&&(console.warn("THREE.Triangle: .getMidpoint() target is now required"),e=new T),e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return r.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e===void 0&&(console.warn("THREE.Triangle: .getPlane() target is now required"),e=new Bt),e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return r.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,i,s){return r.getUV(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return r.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return r.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){t===void 0&&(console.warn("THREE.Triangle: .closestPointToPoint() target is now required"),t=new T);let n=this.a,i=this.b,s=this.c,o,a;fi.subVectors(i,n),pi.subVectors(s,n),Ko.subVectors(e,n);let l=fi.dot(Ko),c=pi.dot(Ko);if(l<=0&&c<=0)return t.copy(n);Qo.subVectors(e,i);let u=fi.dot(Qo),h=pi.dot(Qo);if(u>=0&&h<=u)return t.copy(i);let d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(n).addScaledVector(fi,o);ea.subVectors(e,s);let f=fi.dot(ea),g=pi.dot(ea);if(g>=0&&f<=g)return t.copy(s);let v=f*c-l*g;if(v<=0&&c>=0&&g<=0)return a=c/(c-g),t.copy(n).addScaledVector(pi,a);let _=u*g-f*h;if(_<=0&&h-u>=0&&f-g>=0)return Hc.subVectors(s,i),a=(h-u)/(h-u+(f-g)),t.copy(i).addScaledVector(Hc,a);let m=1/(_+v+d);return o=v*m,a=d*m,t.copy(n).addScaledVector(fi,o).addScaledVector(pi,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Ef=0;function ut(){Object.defineProperty(this,"id",{value:Ef++}),this.uuid=Jt(),this.name="",this.type="Material",this.fog=!0,this.blending=mr,this.side=go,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.blendSrc=Ru,this.blendDst=Wi,this.blendEquation=Xt,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.depthFunc=xa,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=df,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Uo,this.stencilZFail=Uo,this.stencilZPass=Uo,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaTest=0,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0}ut.prototype=Object.assign(Object.create(xn.prototype),{constructor:ut,isMaterial:!0,onBuild:function(){},onBeforeCompile:function(){},customProgramCacheKey:function(){return this.onBeforeCompile.toString()},setValues:function(r){if(r!==void 0)for(let e in r){let t=r[e];if(t===void 0){console.warn("THREE.Material: '"+e+"' parameter is undefined.");continue}if(e==="shading"){console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=t===Lu;continue}let n=this[e];if(n===void 0){console.warn("THREE."+this.type+": '"+e+"' is not a property of this material.");continue}n&&n.isColor?n.set(t):n&&n.isVector3&&t&&t.isVector3?n.copy(t):this[e]=t}},toJSON:function(r){let e=r===void 0||typeof r=="string";e&&(r={textures:{},images:{}});let t={metadata:{version:4.5,type:"Material",generator:"Material.toJSON"}};t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),this.color&&this.color.isColor&&(t.color=this.color.getHex()),this.roughness!==void 0&&(t.roughness=this.roughness),this.metalness!==void 0&&(t.metalness=this.metalness),this.sheen&&this.sheen.isColor&&(t.sheen=this.sheen.getHex()),this.emissive&&this.emissive.isColor&&(t.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(t.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(t.specular=this.specular.getHex()),this.shininess!==void 0&&(t.shininess=this.shininess),this.clearcoat!==void 0&&(t.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(t.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(t.clearcoatMap=this.clearcoatMap.toJSON(r).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(t.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(r).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(t.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(r).uuid,t.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.map&&this.map.isTexture&&(t.map=this.map.toJSON(r).uuid),this.matcap&&this.matcap.isTexture&&(t.matcap=this.matcap.toJSON(r).uuid),this.alphaMap&&this.alphaMap.isTexture&&(t.alphaMap=this.alphaMap.toJSON(r).uuid),this.lightMap&&this.lightMap.isTexture&&(t.lightMap=this.lightMap.toJSON(r).uuid,t.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(t.aoMap=this.aoMap.toJSON(r).uuid,t.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(t.bumpMap=this.bumpMap.toJSON(r).uuid,t.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(t.normalMap=this.normalMap.toJSON(r).uuid,t.normalMapType=this.normalMapType,t.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(t.displacementMap=this.displacementMap.toJSON(r).uuid,t.displacementScale=this.displacementScale,t.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(t.roughnessMap=this.roughnessMap.toJSON(r).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(t.metalnessMap=this.metalnessMap.toJSON(r).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(t.emissiveMap=this.emissiveMap.toJSON(r).uuid),this.specularMap&&this.specularMap.isTexture&&(t.specularMap=this.specularMap.toJSON(r).uuid),this.envMap&&this.envMap.isTexture&&(t.envMap=this.envMap.toJSON(r).uuid,this.combine!==void 0&&(t.combine=this.combine)),this.envMapIntensity!==void 0&&(t.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(t.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(t.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(t.gradientMap=this.gradientMap.toJSON(r).uuid),this.size!==void 0&&(t.size=this.size),this.shadowSide!==null&&(t.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(t.sizeAttenuation=this.sizeAttenuation),this.blending!==mr&&(t.blending=this.blending),this.side!==go&&(t.side=this.side),this.vertexColors&&(t.vertexColors=!0),this.opacity<1&&(t.opacity=this.opacity),this.transparent===!0&&(t.transparent=this.transparent),t.depthFunc=this.depthFunc,t.depthTest=this.depthTest,t.depthWrite=this.depthWrite,t.colorWrite=this.colorWrite,t.stencilWrite=this.stencilWrite,t.stencilWriteMask=this.stencilWriteMask,t.stencilFunc=this.stencilFunc,t.stencilRef=this.stencilRef,t.stencilFuncMask=this.stencilFuncMask,t.stencilFail=this.stencilFail,t.stencilZFail=this.stencilZFail,t.stencilZPass=this.stencilZPass,this.rotation&&this.rotation!==0&&(t.rotation=this.rotation),this.polygonOffset===!0&&(t.polygonOffset=!0),this.polygonOffsetFactor!==0&&(t.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(t.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth&&this.linewidth!==1&&(t.linewidth=this.linewidth),this.dashSize!==void 0&&(t.dashSize=this.dashSize),this.gapSize!==void 0&&(t.gapSize=this.gapSize),this.scale!==void 0&&(t.scale=this.scale),this.dithering===!0&&(t.dithering=!0),this.alphaTest>0&&(t.alphaTest=this.alphaTest),this.alphaToCoverage===!0&&(t.alphaToCoverage=this.alphaToCoverage),this.premultipliedAlpha===!0&&(t.premultipliedAlpha=this.premultipliedAlpha),this.wireframe===!0&&(t.wireframe=this.wireframe),this.wireframeLinewidth>1&&(t.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(t.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(t.wireframeLinejoin=this.wireframeLinejoin),this.morphTargets===!0&&(t.morphTargets=!0),this.morphNormals===!0&&(t.morphNormals=!0),this.skinning===!0&&(t.skinning=!0),this.flatShading===!0&&(t.flatShading=this.flatShading),this.visible===!1&&(t.visible=!1),this.toneMapped===!1&&(t.toneMapped=!1),JSON.stringify(this.userData)!=="{}"&&(t.userData=this.userData);function n(i){let s=[];for(let o in i){let a=i[o];delete a.metadata,s.push(a)}return s}if(e){let i=n(r.textures),s=n(r.images);i.length>0&&(t.textures=i),s.length>0&&(t.images=s)}return t},clone:function(){return new this.constructor().copy(this)},copy:function(r){this.name=r.name,this.fog=r.fog,this.blending=r.blending,this.side=r.side,this.vertexColors=r.vertexColors,this.opacity=r.opacity,this.transparent=r.transparent,this.blendSrc=r.blendSrc,this.blendDst=r.blendDst,this.blendEquation=r.blendEquation,this.blendSrcAlpha=r.blendSrcAlpha,this.blendDstAlpha=r.blendDstAlpha,this.blendEquationAlpha=r.blendEquationAlpha,this.depthFunc=r.depthFunc,this.depthTest=r.depthTest,this.depthWrite=r.depthWrite,this.stencilWriteMask=r.stencilWriteMask,this.stencilFunc=r.stencilFunc,this.stencilRef=r.stencilRef,this.stencilFuncMask=r.stencilFuncMask,this.stencilFail=r.stencilFail,this.stencilZFail=r.stencilZFail,this.stencilZPass=r.stencilZPass,this.stencilWrite=r.stencilWrite;let e=r.clippingPlanes,t=null;if(e!==null){let n=e.length;t=new Array(n);for(let i=0;i!==n;++i)t[i]=e[i].clone()}return this.clippingPlanes=t,this.clipIntersection=r.clipIntersection,this.clipShadows=r.clipShadows,this.shadowSide=r.shadowSide,this.colorWrite=r.colorWrite,this.precision=r.precision,this.polygonOffset=r.polygonOffset,this.polygonOffsetFactor=r.polygonOffsetFactor,this.polygonOffsetUnits=r.polygonOffsetUnits,this.dithering=r.dithering,this.alphaTest=r.alphaTest,this.alphaToCoverage=r.alphaToCoverage,this.premultipliedAlpha=r.premultipliedAlpha,this.visible=r.visible,this.toneMapped=r.toneMapped,this.userData=JSON.parse(JSON.stringify(r.userData)),this},dispose:function(){this.dispatchEvent({type:"dispose"})}});Object.defineProperty(ut.prototype,"needsUpdate",{set:function(r){r===!0&&this.version++}});var Nu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Wt={h:0,s:0,l:0},fs={h:0,s:0,l:0};function ta(r,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?r+(e-r)*6*t:t<1/2?e:t<2/3?r+(e-r)*6*(2/3-t):r}function na(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function ia(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}var pe=class{constructor(e,t,n){return t===void 0&&n===void 0?this.set(e):this.setRGB(e,t,n)}set(e){return e&&e.isColor?this.copy(e):typeof e=="number"?this.setHex(e):typeof e=="string"&&this.setStyle(e),this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,this}setRGB(e,t,n){return this.r=e,this.g=t,this.b=n,this}setHSL(e,t,n){if(e=ff(e,1),t=bt(t,0,1),n=bt(n,0,1),t===0)this.r=this.g=this.b=n;else{let i=n<=.5?n*(1+t):n+t-n*t,s=2*n-i;this.r=ta(s,i,e+1/3),this.g=ta(s,i,e),this.b=ta(s,i,e-1/3)}return this}setStyle(e){function t(i){i!==void 0&&parseFloat(i)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let n;if(n=/^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(e)){let i,s=n[1],o=n[2];switch(s){case"rgb":case"rgba":if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(255,parseInt(i[1],10))/255,this.g=Math.min(255,parseInt(i[2],10))/255,this.b=Math.min(255,parseInt(i[3],10))/255,t(i[4]),this;if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(100,parseInt(i[1],10))/100,this.g=Math.min(100,parseInt(i[2],10))/100,this.b=Math.min(100,parseInt(i[3],10))/100,t(i[4]),this;break;case"hsl":case"hsla":if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)){let a=parseFloat(i[1])/360,l=parseInt(i[2],10)/100,c=parseInt(i[3],10)/100;return t(i[4]),this.setHSL(a,l,c)}break}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(e)){let i=n[1],s=i.length;if(s===3)return this.r=parseInt(i.charAt(0)+i.charAt(0),16)/255,this.g=parseInt(i.charAt(1)+i.charAt(1),16)/255,this.b=parseInt(i.charAt(2)+i.charAt(2),16)/255,this;if(s===6)return this.r=parseInt(i.charAt(0)+i.charAt(1),16)/255,this.g=parseInt(i.charAt(2)+i.charAt(3),16)/255,this.b=parseInt(i.charAt(4)+i.charAt(5),16)/255,this}return e&&e.length>0?this.setColorName(e):this}setColorName(e){let t=Nu[e.toLowerCase()];return t!==void 0?this.setHex(t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copyGammaToLinear(e,t=2){return this.r=Math.pow(e.r,t),this.g=Math.pow(e.g,t),this.b=Math.pow(e.b,t),this}copyLinearToGamma(e,t=2){let n=t>0?1/t:1;return this.r=Math.pow(e.r,n),this.g=Math.pow(e.g,n),this.b=Math.pow(e.b,n),this}convertGammaToLinear(e){return this.copyGammaToLinear(this,e),this}convertLinearToGamma(e){return this.copyLinearToGamma(this,e),this}copySRGBToLinear(e){return this.r=na(e.r),this.g=na(e.g),this.b=na(e.b),this}copyLinearToSRGB(e){return this.r=ia(e.r),this.g=ia(e.g),this.b=ia(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(){return this.r*255<<16^this.g*255<<8^this.b*255<<0}getHexString(){return("000000"+this.getHex().toString(16)).slice(-6)}getHSL(e){e===void 0&&(console.warn("THREE.Color: .getHSL() target is now required"),e={h:0,s:0,l:0});let t=this.r,n=this.g,i=this.b,s=Math.max(t,n,i),o=Math.min(t,n,i),a,l,c=(o+s)/2;if(o===s)a=0,l=0;else{let u=s-o;switch(l=c<=.5?u/(s+o):u/(2-s-o),s){case t:a=(n-i)/u+(n<i?6:0);break;case n:a=(i-t)/u+2;break;case i:a=(t-n)/u+4;break}a/=6}return e.h=a,e.s=l,e.l=c,e}getStyle(){return"rgb("+(this.r*255|0)+","+(this.g*255|0)+","+(this.b*255|0)+")"}offsetHSL(e,t,n){return this.getHSL(Wt),Wt.h+=e,Wt.s+=t,Wt.l+=n,this.setHSL(Wt.h,Wt.s,Wt.l),this}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Wt),e.getHSL(fs);let n=Ho(Wt.h,fs.h,t),i=Ho(Wt.s,fs.s,t),s=Ho(Wt.l,fs.l,t);return this.setHSL(n,i,s),this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),e.normalized===!0&&(this.r/=255,this.g/=255,this.b/=255),this}toJSON(){return this.getHex()}};pe.NAMES=Nu;pe.prototype.isColor=!0;pe.prototype.r=1;pe.prototype.g=1;pe.prototype.b=1;var Ar=class extends ut{constructor(e){super(),this.type="MeshBasicMaterial",this.color=new pe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=vo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this}};Ar.prototype.isMeshBasicMaterial=!0;var Je=new T,ps=new te,$e=class{constructor(e,t,n){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n===!0,this.usage=Er,this.updateRange={offset:0,count:-1},this.version=0,this.onUploadCallback=function(){}}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}copyColorsArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyColorsArray(): color is undefined",i),o=new pe),t[n++]=o.r,t[n++]=o.g,t[n++]=o.b}return this}copyVector2sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector2sArray(): vector is undefined",i),o=new te),t[n++]=o.x,t[n++]=o.y}return this}copyVector3sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector3sArray(): vector is undefined",i),o=new T),t[n++]=o.x,t[n++]=o.y,t[n++]=o.z}return this}copyVector4sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector4sArray(): vector is undefined",i),o=new He),t[n++]=o.x,t[n++]=o.y,t[n++]=o.z,t[n++]=o.w}return this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ps.fromBufferAttribute(this,t),ps.applyMatrix3(e),this.setXY(t,ps.x,ps.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Je.fromBufferAttribute(this,t),Je.applyMatrix3(e),this.setXYZ(t,Je.x,Je.y,Je.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Je.x=this.getX(t),Je.y=this.getY(t),Je.z=this.getZ(t),Je.applyMatrix4(e),this.setXYZ(t,Je.x,Je.y,Je.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Je.x=this.getX(t),Je.y=this.getY(t),Je.z=this.getZ(t),Je.applyNormalMatrix(e),this.setXYZ(t,Je.x,Je.y,Je.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Je.x=this.getX(t),Je.y=this.getY(t),Je.z=this.getZ(t),Je.transformDirection(e),this.setXYZ(t,Je.x,Je.y,Je.z);return this}set(e,t=0){return this.array.set(e,t),this}getX(e){return this.array[e*this.itemSize]}setX(e,t){return this.array[e*this.itemSize]=t,this}getY(e){return this.array[e*this.itemSize+1]}setY(e,t){return this.array[e*this.itemSize+1]=t,this}getZ(e){return this.array[e*this.itemSize+2]}setZ(e,t){return this.array[e*this.itemSize+2]=t,this}getW(e){return this.array[e*this.itemSize+3]}setW(e,t){return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.prototype.slice.call(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Er&&(e.usage=this.usage),(this.updateRange.offset!==0||this.updateRange.count!==-1)&&(e.updateRange=this.updateRange),e}};$e.prototype.isBufferAttribute=!0;var qs=class extends $e{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Xs=class extends $e{constructor(e,t,n){super(new Uint32Array(e),t,n)}},ba=class extends $e{constructor(e,t,n){super(new Uint16Array(e),t,n)}};ba.prototype.isFloat16BufferAttribute=!0;var Ve=class extends $e{constructor(e,t,n){super(new Float32Array(e),t,n)}};function Uu(r){if(r.length===0)return-1/0;let e=r[0];for(let t=1,n=r.length;t<n;++t)r[t]>e&&(e=r[t]);return e}var Af=0,nn=new De,ra=new Xe,mi=new T,Dt=new At,sr=new At,ct=new T,Ge=class r extends xn{constructor(){super(),Object.defineProperty(this,"id",{value:Af++}),this.uuid=Jt(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Uu(e)>65535?Xs:qs)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new at().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}rotateX(e){return nn.makeRotationX(e),this.applyMatrix4(nn),this}rotateY(e){return nn.makeRotationY(e),this.applyMatrix4(nn),this}rotateZ(e){return nn.makeRotationZ(e),this.applyMatrix4(nn),this}translate(e,t,n){return nn.makeTranslation(e,t,n),this.applyMatrix4(nn),this}scale(e,t,n){return nn.makeScale(e,t,n),this.applyMatrix4(nn),this}lookAt(e){return ra.lookAt(e),ra.updateMatrix(),this.applyMatrix4(ra.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(mi).negate(),this.translate(mi.x,mi.y,mi.z),this}setFromPoints(e){let t=[];for(let n=0,i=e.length;n<i;n++){let s=e[n];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new Ve(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new At);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new T(-1/0,-1/0,-1/0),new T(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let s=t[n];Dt.setFromBufferAttribute(s),this.morphTargetsRelative?(ct.addVectors(this.boundingBox.min,Dt.min),this.boundingBox.expandByPoint(ct),ct.addVectors(this.boundingBox.max,Dt.max),this.boundingBox.expandByPoint(ct)):(this.boundingBox.expandByPoint(Dt.min),this.boundingBox.expandByPoint(Dt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Nn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new T,1/0);return}if(e){let n=this.boundingSphere.center;if(Dt.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];sr.setFromBufferAttribute(a),this.morphTargetsRelative?(ct.addVectors(Dt.min,sr.min),Dt.expandByPoint(ct),ct.addVectors(Dt.max,sr.max),Dt.expandByPoint(ct)):(Dt.expandByPoint(sr.min),Dt.expandByPoint(sr.max))}Dt.getCenter(n);let i=0;for(let s=0,o=e.count;s<o;s++)ct.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(ct));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)ct.fromBufferAttribute(a,c),l&&(mi.fromBufferAttribute(e,c),ct.add(mi)),i=Math.max(i,n.distanceToSquared(ct))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeFaceNormals(){}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.array,i=t.position.array,s=t.normal.array,o=t.uv.array,a=i.length/3;t.tangent===void 0&&this.setAttribute("tangent",new $e(new Float32Array(4*a),4));let l=t.tangent.array,c=[],u=[];for(let V=0;V<a;V++)c[V]=new T,u[V]=new T;let h=new T,d=new T,f=new T,g=new te,v=new te,_=new te,m=new T,p=new T;function L(V,X,W){h.fromArray(i,V*3),d.fromArray(i,X*3),f.fromArray(i,W*3),g.fromArray(o,V*2),v.fromArray(o,X*2),_.fromArray(o,W*2),d.sub(h),f.sub(h),v.sub(g),_.sub(g);let R=1/(v.x*_.y-_.x*v.y);isFinite(R)&&(m.copy(d).multiplyScalar(_.y).addScaledVector(f,-v.y).multiplyScalar(R),p.copy(f).multiplyScalar(v.x).addScaledVector(d,-_.x).multiplyScalar(R),c[V].add(m),c[X].add(m),c[W].add(m),u[V].add(p),u[X].add(p),u[W].add(p))}let A=this.groups;A.length===0&&(A=[{start:0,count:n.length}]);for(let V=0,X=A.length;V<X;++V){let W=A[V],R=W.start,U=W.count;for(let O=R,z=R+U;O<z;O+=3)L(n[O+0],n[O+1],n[O+2])}let C=new T,b=new T,I=new T,N=new T;function k(V){I.fromArray(s,V*3),N.copy(I);let X=c[V];C.copy(X),C.sub(I.multiplyScalar(I.dot(X))).normalize(),b.crossVectors(N,X);let R=b.dot(u[V])<0?-1:1;l[V*4]=C.x,l[V*4+1]=C.y,l[V*4+2]=C.z,l[V*4+3]=R}for(let V=0,X=A.length;V<X;++V){let W=A[V],R=W.start,U=W.count;for(let O=R,z=R+U;O<z;O+=3)k(n[O+0]),k(n[O+1]),k(n[O+2])}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new $e(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let i=new T,s=new T,o=new T,a=new T,l=new T,c=new T,u=new T,h=new T;if(e)for(let d=0,f=e.count;d<f;d+=3){let g=e.getX(d+0),v=e.getX(d+1),_=e.getX(d+2);i.fromBufferAttribute(t,g),s.fromBufferAttribute(t,v),o.fromBufferAttribute(t,_),u.subVectors(o,s),h.subVectors(i,s),u.cross(h),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,_),a.add(u),l.add(u),c.add(u),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(_,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)i.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),u.subVectors(o,s),h.subVectors(i,s),u.cross(h),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}merge(e,t){if(!(e&&e.isBufferGeometry)){console.error("THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.",e);return}t===void 0&&(t=0,console.warn("THREE.BufferGeometry.merge(): Overwriting original geometry, starting at offset=0. Use BufferGeometryUtils.mergeBufferGeometries() for lossless merge."));let n=this.attributes;for(let i in n){if(e.attributes[i]===void 0)continue;let o=n[i].array,a=e.attributes[i],l=a.array,c=a.itemSize*t,u=Math.min(l.length,o.length-c);for(let h=0,d=c;h<u;h++,d++)o[d]=l[h]}return this}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)ct.fromBufferAttribute(e,t),ct.normalize(),e.setXYZ(t,ct.x,ct.y,ct.z)}toNonIndexed(){function e(a,l){let c=a.array,u=a.itemSize,h=a.normalized,d=new c.constructor(l.length*u),f=0,g=0;for(let v=0,_=l.length;v<_;v++){f=l[v]*u;for(let m=0;m<u;m++)d[g++]=c[f++]}return new $e(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new r,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],c=e(l,n);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let u=0,h=c.length;u<h;u++){let d=c[u],f=e(d,n);l.push(f)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.5,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){let f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(i[l]=u,s=!0)}s&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new r().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let i=e.attributes;for(let c in i){let u=i[c];this.setAttribute(c,u.clone(t))}let s=e.morphAttributes;for(let c in s){let u=[],h=s[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,u=o.length;c<u;c++){let h=o[c];this.addGroup(h.start,h.count,h.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}};Ge.prototype.isBufferGeometry=!0;var kc=new De,gi=new Un,sa=new Nn,Rn=new T,Cn=new T,Pn=new T,oa=new T,aa=new T,la=new T,ms=new T,gs=new T,vs=new T,xs=new te,ys=new te,_s=new te,ca=new T,ws=new T,Oe=class extends Xe{constructor(e=new Ge,t=new Ar){super(),this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Mesh.updateMorphTargets() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}}raycast(e,t){let n=this.geometry,i=this.material,s=this.matrixWorld;if(i===void 0||(n.boundingSphere===null&&n.computeBoundingSphere(),sa.copy(n.boundingSphere),sa.applyMatrix4(s),e.ray.intersectsSphere(sa)===!1)||(kc.copy(s).invert(),gi.copy(e.ray).applyMatrix4(kc),n.boundingBox!==null&&gi.intersectsBox(n.boundingBox)===!1))return;let o;if(n.isBufferGeometry){let a=n.index,l=n.attributes.position,c=n.morphAttributes.position,u=n.morphTargetsRelative,h=n.attributes.uv,d=n.attributes.uv2,f=n.groups,g=n.drawRange;if(a!==null)if(Array.isArray(i))for(let v=0,_=f.length;v<_;v++){let m=f[v],p=i[m.materialIndex],L=Math.max(m.start,g.start),A=Math.min(m.start+m.count,g.start+g.count);for(let C=L,b=A;C<b;C+=3){let I=a.getX(C),N=a.getX(C+1),k=a.getX(C+2);o=bs(this,p,e,gi,l,c,u,h,d,I,N,k),o&&(o.faceIndex=Math.floor(C/3),o.face.materialIndex=m.materialIndex,t.push(o))}}else{let v=Math.max(0,g.start),_=Math.min(a.count,g.start+g.count);for(let m=v,p=_;m<p;m+=3){let L=a.getX(m),A=a.getX(m+1),C=a.getX(m+2);o=bs(this,i,e,gi,l,c,u,h,d,L,A,C),o&&(o.faceIndex=Math.floor(m/3),t.push(o))}}else if(l!==void 0)if(Array.isArray(i))for(let v=0,_=f.length;v<_;v++){let m=f[v],p=i[m.materialIndex],L=Math.max(m.start,g.start),A=Math.min(m.start+m.count,g.start+g.count);for(let C=L,b=A;C<b;C+=3){let I=C,N=C+1,k=C+2;o=bs(this,p,e,gi,l,c,u,h,d,I,N,k),o&&(o.faceIndex=Math.floor(C/3),o.face.materialIndex=m.materialIndex,t.push(o))}}else{let v=Math.max(0,g.start),_=Math.min(l.count,g.start+g.count);for(let m=v,p=_;m<p;m+=3){let L=m,A=m+1,C=m+2;o=bs(this,i,e,gi,l,c,u,h,d,L,A,C),o&&(o.faceIndex=Math.floor(m/3),t.push(o))}}}else n.isGeometry&&console.error("THREE.Mesh.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}};Oe.prototype.isMesh=!0;function Lf(r,e,t,n,i,s,o,a){let l;if(e.side===ot?l=n.intersectTriangle(o,s,i,!0,a):l=n.intersectTriangle(i,s,o,e.side!==Rt,a),l===null)return null;ws.copy(a),ws.applyMatrix4(r.matrixWorld);let c=t.ray.origin.distanceTo(ws);return c<t.near||c>t.far?null:{distance:c,point:ws.clone(),object:r}}function bs(r,e,t,n,i,s,o,a,l,c,u,h){Rn.fromBufferAttribute(i,c),Cn.fromBufferAttribute(i,u),Pn.fromBufferAttribute(i,h);let d=r.morphTargetInfluences;if(e.morphTargets&&s&&d){ms.set(0,0,0),gs.set(0,0,0),vs.set(0,0,0);for(let g=0,v=s.length;g<v;g++){let _=d[g],m=s[g];_!==0&&(oa.fromBufferAttribute(m,c),aa.fromBufferAttribute(m,u),la.fromBufferAttribute(m,h),o?(ms.addScaledVector(oa,_),gs.addScaledVector(aa,_),vs.addScaledVector(la,_)):(ms.addScaledVector(oa.sub(Rn),_),gs.addScaledVector(aa.sub(Cn),_),vs.addScaledVector(la.sub(Pn),_)))}Rn.add(ms),Cn.add(gs),Pn.add(vs)}r.isSkinnedMesh&&e.skinning&&(r.boneTransform(c,Rn),r.boneTransform(u,Cn),r.boneTransform(h,Pn));let f=Lf(r,e,t,n,Rn,Cn,Pn,ca);if(f){a&&(xs.fromBufferAttribute(a,c),ys.fromBufferAttribute(a,u),_s.fromBufferAttribute(a,h),f.uv=xt.getUV(ca,Rn,Cn,Pn,xs,ys,_s,new te)),l&&(xs.fromBufferAttribute(l,c),ys.fromBufferAttribute(l,u),_s.fromBufferAttribute(l,h),f.uv2=xt.getUV(ca,Rn,Cn,Pn,xs,ys,_s,new te));let g={a:c,b:u,c:h,normal:new T,materialIndex:0};xt.getNormal(Rn,Cn,Pn,g.normal),f.face=g}return f}var Lr=class extends Ge{constructor(e=1,t=1,n=1,i=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:o};let a=this;i=Math.floor(i),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],u=[],h=[],d=0,f=0;g("z","y","x",-1,-1,n,t,e,o,s,0),g("z","y","x",1,-1,n,t,-e,o,s,1),g("x","z","y",1,1,e,n,t,i,o,2),g("x","z","y",1,-1,e,n,-t,i,o,3),g("x","y","z",1,-1,e,t,n,i,s,4),g("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new Ve(c,3)),this.setAttribute("normal",new Ve(u,3)),this.setAttribute("uv",new Ve(h,2));function g(v,_,m,p,L,A,C,b,I,N,k){let V=A/I,X=C/N,W=A/2,R=C/2,U=b/2,O=I+1,z=N+1,$=0,oe=0,re=new T;for(let we=0;we<z;we++){let xe=we*X-R;for(let Le=0;Le<O;Le++){let Ce=Le*V-W;re[v]=Ce*p,re[_]=xe*L,re[m]=U,c.push(re.x,re.y,re.z),re[v]=0,re[_]=0,re[m]=b>0?1:-1,u.push(re.x,re.y,re.z),h.push(Le/I),h.push(1-we/N),$+=1}}for(let we=0;we<N;we++)for(let xe=0;xe<I;xe++){let Le=d+xe+O*we,Ce=d+xe+O*(we+1),J=d+(xe+1)+O*(we+1),Z=d+(xe+1)+O*we;l.push(Le,Ce,Z),l.push(Ce,J,Z),oe+=6}a.addGroup(f,oe,k),f+=oe,d+=$}}};function Ci(r){let e={};for(let t in r){e[t]={};for(let n in r[t]){let i=r[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function gt(r){let e={};for(let t=0;t<r.length;t++){let n=Ci(r[t]);for(let i in n)e[i]=n[i]}return e}var Rf={clone:Ci,merge:gt},Cf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Pf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,qe=class extends ut{constructor(e){super(),this.type="ShaderMaterial",this.defines={},this.uniforms={},this.vertexShader=Cf,this.fragmentShader=Pf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv2:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&(e.attributes!==void 0&&console.error("THREE.ShaderMaterial: attributes should now be defined in THREE.BufferGeometry instead."),this.setValues(e))}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ci(e.uniforms),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.lights=e.lights,this.clipping=e.clipping,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}};qe.prototype.isShaderMaterial=!0;var Rr=class extends Xe{constructor(){super(),this.type="Camera",this.matrixWorldInverse=new De,this.projectionMatrix=new De,this.projectionMatrixInverse=new De}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this}getWorldDirection(e){e===void 0&&(console.warn("THREE.Camera: .getWorldDirection() target is now required"),e=new T),this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(-t[8],-t[9],-t[10]).normalize()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}};Rr.prototype.isCamera=!0;var ft=class extends Rr{constructor(e=50,t=1,n=.1,i=2e3){super(),this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=ya*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Oo*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return ya*2*Math.atan(Math.tan(Oo*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,i,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Oo*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*i/l,t-=o.offsetY*n/c,i*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};ft.prototype.isPerspectiveCamera=!0;var vi=90,xi=1,Cr=class extends Xe{constructor(e,t,n){if(super(),this.type="CubeCamera",n.isWebGLCubeRenderTarget!==!0){console.error("THREE.CubeCamera: The constructor now expects an instance of WebGLCubeRenderTarget as third parameter.");return}this.renderTarget=n;let i=new ft(vi,xi,e,t);i.layers=this.layers,i.up.set(0,-1,0),i.lookAt(new T(1,0,0)),this.add(i);let s=new ft(vi,xi,e,t);s.layers=this.layers,s.up.set(0,-1,0),s.lookAt(new T(-1,0,0)),this.add(s);let o=new ft(vi,xi,e,t);o.layers=this.layers,o.up.set(0,0,1),o.lookAt(new T(0,1,0)),this.add(o);let a=new ft(vi,xi,e,t);a.layers=this.layers,a.up.set(0,0,-1),a.lookAt(new T(0,-1,0)),this.add(a);let l=new ft(vi,xi,e,t);l.layers=this.layers,l.up.set(0,-1,0),l.lookAt(new T(0,0,1)),this.add(l);let c=new ft(vi,xi,e,t);c.layers=this.layers,c.up.set(0,-1,0),c.lookAt(new T(0,0,-1)),this.add(c)}update(e,t){this.parent===null&&this.updateMatrixWorld();let n=this.renderTarget,[i,s,o,a,l,c]=this.children,u=e.xr.enabled,h=e.getRenderTarget();e.xr.enabled=!1;let d=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0),e.render(t,i),e.setRenderTarget(n,1),e.render(t,s),e.setRenderTarget(n,2),e.render(t,o),e.setRenderTarget(n,3),e.render(t,a),e.setRenderTarget(n,4),e.render(t,l),n.texture.generateMipmaps=d,e.setRenderTarget(n,5),e.render(t,c),e.setRenderTarget(h),e.xr.enabled=u}},Pi=class extends yt{constructor(e,t,n,i,s,o,a,l,c,u){e=e!==void 0?e:[],t=t!==void 0?t:Pl,a=a!==void 0?a:gn,super(e,t,n,i,s,o,a,l,c,u),this._needsFlipEnvMap=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};Pi.prototype.isCubeTexture=!0;var Ys=class extends jt{constructor(e,t,n){Number.isInteger(t)&&(console.warn("THREE.WebGLCubeRenderTarget: constructor signature is now WebGLCubeRenderTarget( size, options )"),t=n),super(e,e,t),t=t||{},this.texture=new Pi(void 0,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.encoding),this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:vt,this.texture._needsFlipEnvMap=!1}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.format=Zt,this.texture.encoding=t.encoding,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Lr(5,5,5),s=new qe({name:"CubemapFromEquirect",uniforms:Ci(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:ot,blending:pr});s.uniforms.tEquirect.value=t;let o=new Oe(i,s),a=t.minFilter;return t.minFilter===ni&&(t.minFilter=vt),new Cr(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,n,i){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(s)}};Ys.prototype.isWebGLCubeRenderTarget=!0;var Di=class extends yt{constructor(e,t,n,i,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,i,s,h,d),this.image={data:e||null,width:t||1,height:n||1},this.magFilter=c!==void 0?c:Mt,this.minFilter=u!==void 0?u:Mt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};Di.prototype.isDataTexture=!0;var yi=new Nn,Ms=new T,Fi=class{constructor(e=new Bt,t=new Bt,n=new Bt,i=new Bt,s=new Bt,o=new Bt){this.planes=[e,t,n,i,s,o]}set(e,t,n,i,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e){let t=this.planes,n=e.elements,i=n[0],s=n[1],o=n[2],a=n[3],l=n[4],c=n[5],u=n[6],h=n[7],d=n[8],f=n[9],g=n[10],v=n[11],_=n[12],m=n[13],p=n[14],L=n[15];return t[0].setComponents(a-i,h-l,v-d,L-_).normalize(),t[1].setComponents(a+i,h+l,v+d,L+_).normalize(),t[2].setComponents(a+s,h+c,v+f,L+m).normalize(),t[3].setComponents(a-s,h-c,v-f,L-m).normalize(),t[4].setComponents(a-o,h-u,v-g,L-p).normalize(),t[5].setComponents(a+o,h+u,v+g,L+p).normalize(),this}intersectsObject(e){let t=e.geometry;return t.boundingSphere===null&&t.computeBoundingSphere(),yi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld),this.intersectsSphere(yi)}intersectsSprite(e){return yi.center.set(0,0,0),yi.radius=.7071067811865476,yi.applyMatrix4(e.matrixWorld),this.intersectsSphere(yi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Ms.x=i.normal.x>0?e.max.x:e.min.x,Ms.y=i.normal.y>0?e.max.y:e.min.y,Ms.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Ms)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function Ou(){let r=null,e=!1,t=null,n=null;function i(s,o){t(s,o),n=r.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=r.requestAnimationFrame(i),e=!0)},stop:function(){r.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){r=s}}}function Df(r,e){let t=e.isWebGL2,n=new WeakMap;function i(c,u){let h=c.array,d=c.usage,f=r.createBuffer();r.bindBuffer(u,f),r.bufferData(u,h,d),c.onUploadCallback();let g=5126;return h instanceof Float32Array?g=5126:h instanceof Float64Array?console.warn("THREE.WebGLAttributes: Unsupported data buffer format: Float64Array."):h instanceof Uint16Array?c.isFloat16BufferAttribute?t?g=5131:console.warn("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2."):g=5123:h instanceof Int16Array?g=5122:h instanceof Uint32Array?g=5125:h instanceof Int32Array?g=5124:h instanceof Int8Array?g=5120:h instanceof Uint8Array&&(g=5121),{buffer:f,type:g,bytesPerElement:h.BYTES_PER_ELEMENT,version:c.version}}function s(c,u,h){let d=u.array,f=u.updateRange;r.bindBuffer(h,c),f.count===-1?r.bufferSubData(h,0,d):(t?r.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d,f.offset,f.count):r.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d.subarray(f.offset,f.offset+f.count)),f.count=-1)}function o(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function a(c){c.isInterleavedBufferAttribute&&(c=c.data);let u=n.get(c);u&&(r.deleteBuffer(u.buffer),n.delete(c))}function l(c,u){if(c.isGLBufferAttribute){let d=n.get(c);(!d||d.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);let h=n.get(c);h===void 0?n.set(c,i(c,u)):h.version<c.version&&(s(h.buffer,c,u),h.version=c.version)}return{get:o,remove:a,update:l}}var St=class extends Ge{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let s=e/2,o=t/2,a=Math.floor(n),l=Math.floor(i),c=a+1,u=l+1,h=e/a,d=t/l,f=[],g=[],v=[],_=[];for(let m=0;m<u;m++){let p=m*d-o;for(let L=0;L<c;L++){let A=L*h-s;g.push(A,-p,0),v.push(0,0,1),_.push(L/a),_.push(1-m/l)}}for(let m=0;m<l;m++)for(let p=0;p<a;p++){let L=p+c*m,A=p+c*(m+1),C=p+1+c*(m+1),b=p+1+c*m;f.push(L,A,b),f.push(A,C,b)}this.setIndex(f),this.setAttribute("position",new Ve(g,3)),this.setAttribute("normal",new Ve(v,3)),this.setAttribute("uv",new Ve(_,2))}},Ff=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vUv ).g;
#endif`,If=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,zf=`#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif`,Bf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );
	#endif
#endif`,Nf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Uf="vec3 transformed = vec3( position );",Of=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Hf=`vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	return vec2( -1.04, 1.04 ) * a004 + r.zw;
}
float punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
#if defined ( PHYSICALLY_CORRECT_LIGHTS )
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
#else
	if( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
		return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );
	}
	return 1.0;
#endif
}
vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {
	float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );
	return ( 1.0 - specularColor ) * fresnel + specularColor;
}
vec3 F_Schlick_RoughnessDependent( const in vec3 F0, const in float dotNV, const in float roughness ) {
	float fresnel = exp2( ( -5.55473 * dotNV - 6.98316 ) * dotNV );
	vec3 Fr = max( vec3( 1.0 - roughness ), F0 ) - F0;
	return Fr * fresnel + F0;
}
float G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gl = dotNL + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	float gv = dotNV + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	return 1.0 / ( gl * gv );
}
float G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
vec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( incidentLight.direction + viewDir );
	float dotNL = saturate( dot( normal, incidentLight.direction ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );
	vec3 F = F_Schlick( specularColor, dotLH );
	float G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );
	float D = D_GGX( alpha, dotNH );
	return F * ( G * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
vec3 BRDF_Specular_GGX_Environment( const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );
	return specularColor * brdf.x + brdf.y;
}
void BRDF_Specular_Multiscattering_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
	float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
	vec3 F = F_Schlick_RoughnessDependent( specularColor, dotNV, roughness );
	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );
	vec3 FssEss = F * brdf.x + brdf.y;
	float Ess = brdf.x + brdf.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );
	float dotNH = saturate( dot( geometry.normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );
	vec3 F = F_Schlick( specularColor, dotLH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
}
float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {
	return ( 2.0 / pow2( ggxRoughness + 0.0001 ) - 2.0 );
}
float BlinnExponentToGGXRoughness( const in float blinnExponent ) {
	return sqrt( 2.0 / ( blinnExponent + 2.0 ) );
}
#if defined( USE_SHEEN )
float D_Charlie(float roughness, float NoH) {
	float invAlpha = 1.0 / roughness;
	float cos2h = NoH * NoH;
	float sin2h = max(1.0 - cos2h, 0.0078125);	return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) / (2.0 * PI);
}
float V_Neubelt(float NoV, float NoL) {
	return saturate(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));
}
vec3 BRDF_Specular_Sheen( const in float roughness, const in vec3 L, const in GeometricContext geometry, vec3 specularColor ) {
	vec3 N = geometry.normal;
	vec3 V = geometry.viewDir;
	vec3 H = normalize( V + L );
	float dotNH = saturate( dot( N, H ) );
	return specularColor * D_Charlie( roughness, dotNH ) * V_Neubelt( dot(N, V), dot(N, L) );
}
#endif`,kf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vUv );
		vec2 dSTdy = dFdy( vUv );
		float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );
		vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Gf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,Vf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Wf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,qf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Xf=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Yf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Zf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Jf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,jf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate(a) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement(a) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float max3( vec3 v ) { return max( max( v.x, v.y ), v.z ); }
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
struct GeometricContext {
	vec3 position;
	vec3 normal;
	vec3 viewDir;
#ifdef CLEARCOAT
	vec3 clearcoatNormal;
#endif
};
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
vec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {
	float distance = dot( planeNormal, point - pointOnPlane );
	return - distance * planeNormal + point;
}
float sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {
	return sign( dot( point - pointOnPlane, planeNormal ) );
}
vec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {
	return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float linearToRelativeLuminance( const in vec3 color ) {
	vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
	return dot( weights, color.rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}`,$f=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_maxMipLevel 8.0
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_maxTileSize 256.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		float texelSize = 1.0 / ( 3.0 * cubeUV_maxTileSize );
		vec2 uv = getUV( direction, face ) * ( faceSize - 1.0 );
		vec2 f = fract( uv );
		uv += 0.5 - f;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		if ( mipInt < cubeUV_maxMipLevel ) {
			uv.y += 2.0 * cubeUV_maxTileSize;
		}
		uv.y += filterInt * 2.0 * cubeUV_minTileSize;
		uv.x += 3.0 * max( 0.0, cubeUV_maxTileSize - 2.0 * faceSize );
		uv *= texelSize;
		vec3 tl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.x += texelSize;
		vec3 tr = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.y += texelSize;
		vec3 br = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.x -= texelSize;
		vec3 bl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		vec3 tm = mix( tl, tr, f.x );
		vec3 bm = mix( bl, br, f.x );
		return mix( tm, bm, f.y );
	}
	#define r0 1.0
	#define v0 0.339
	#define m0 - 2.0
	#define r1 0.8
	#define v1 0.276
	#define m1 - 1.0
	#define r4 0.4
	#define v4 0.046
	#define m4 2.0
	#define r5 0.305
	#define v5 0.016
	#define m5 3.0
	#define r6 0.21
	#define v6 0.0038
	#define m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= r1 ) {
			mip = ( r0 - roughness ) * ( m1 - m0 ) / ( r0 - r1 ) + m0;
		} else if ( roughness >= r4 ) {
			mip = ( r1 - roughness ) * ( m4 - m1 ) / ( r1 - r4 ) + m1;
		} else if ( roughness >= r5 ) {
			mip = ( r4 - roughness ) * ( m5 - m4 ) / ( r4 - r5 ) + m4;
		} else if ( roughness >= r6 ) {
			mip = ( r5 - roughness ) * ( m6 - m5 ) / ( r5 - r6 ) + m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), m0, cubeUV_maxMipLevel );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Kf=`vec3 transformedNormal = objectNormal;
#ifdef USE_INSTANCING
	mat3 m = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
	transformedNormal = m * transformedNormal;
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Qf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ep=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
#endif`,tp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vUv );
	emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,np=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ip="gl_FragColor = linearToOutputTexel( gl_FragColor );",rp=`
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 GammaToLinear( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );
}
vec4 LinearToGamma( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( 1.0 / gammaFactor ) ), value.a );
}
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 RGBEToLinear( in vec4 value ) {
	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}
vec4 LinearToRGBE( in vec4 value ) {
	float maxComponent = max( max( value.r, value.g ), value.b );
	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
}
vec4 RGBMToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * value.a * maxRange, 1.0 );
}
vec4 LinearToRGBM( in vec4 value, in float maxRange ) {
	float maxRGB = max( value.r, max( value.g, value.b ) );
	float M = clamp( maxRGB / maxRange, 0.0, 1.0 );
	M = ceil( M * 255.0 ) / 255.0;
	return vec4( value.rgb / ( M * maxRange ), M );
}
vec4 RGBDToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );
}
vec4 LinearToRGBD( in vec4 value, in float maxRange ) {
	float maxRGB = max( value.r, max( value.g, value.b ) );
	float D = max( maxRange / maxRGB, 1.0 );
	D = clamp( floor( D ) / 255.0, 0.0, 1.0 );
	return vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );
}
const mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );
vec4 LinearToLogLuv( in vec4 value ) {
	vec3 Xp_Y_XYZp = cLogLuvM * value.rgb;
	Xp_Y_XYZp = max( Xp_Y_XYZp, vec3( 1e-6, 1e-6, 1e-6 ) );
	vec4 vResult;
	vResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;
	float Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;
	vResult.w = fract( Le );
	vResult.z = ( Le - ( floor( vResult.w * 255.0 ) ) / 255.0 ) / 255.0;
	return vResult;
}
const mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );
vec4 LogLuvToLinear( in vec4 value ) {
	float Le = value.z * 255.0 + value.w;
	vec3 Xp_Y_XYZp;
	Xp_Y_XYZp.y = exp2( ( Le - 127.0 ) / 2.0 );
	Xp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;
	Xp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;
	vec3 vRGB = cLogLuvInverseM * Xp_Y_XYZp.rgb;
	return vec4( max( vRGB, 0.0 ), 1.0 );
}`,sp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 envColor = textureCubeUV( envMap, reflectVec, 0.0 );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifndef ENVMAP_TYPE_CUBE_UV
		envColor = envMapTexelToLinear( envColor );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,op=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform int maxMipLevel;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,ap=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,lp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,cp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,up=`#ifdef USE_FOG
	fogDepth = - mvPosition.z;
#endif`,hp=`#ifdef USE_FOG
	varying float fogDepth;
#endif`,dp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float fogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,pp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return texture2D( gradientMap, coord ).rgb;
	#else
		return ( coord.x < 0.7 ) ? vec3( 0.7 ) : vec3( 1.0 );
	#endif
}`,mp=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel= texture2D( lightMap, vUv2 );
	reflectedLight.indirectDiffuse += PI * lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
#endif`,gp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,vp=`vec3 diffuse = vec3( 1.0 );
GeometricContext geometry;
geometry.position = mvPosition.xyz;
geometry.normal = normalize( transformedNormal );
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( -mvPosition.xyz );
GeometricContext backGeometry;
backGeometry.position = geometry.position;
backGeometry.normal = -geometry.normal;
backGeometry.viewDir = geometry.viewDir;
vLightFront = vec3( 0.0 );
vIndirectFront = vec3( 0.0 );
#ifdef DOUBLE_SIDED
	vLightBack = vec3( 0.0 );
	vIndirectBack = vec3( 0.0 );
#endif
IncidentLight directLight;
float dotNL;
vec3 directLightColor_Diffuse;
vIndirectFront += getAmbientLightIrradiance( ambientLightColor );
vIndirectFront += getLightProbeIrradiance( lightProbe, geometry );
#ifdef DOUBLE_SIDED
	vIndirectBack += getAmbientLightIrradiance( ambientLightColor );
	vIndirectBack += getLightProbeIrradiance( lightProbe, backGeometry );
#endif
#if NUM_POINT_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		getPointDirectLightIrradiance( pointLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_SPOT_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		getSpotDirectLightIrradiance( spotLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_DIR_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		getDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_HEMI_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
		vIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
		#ifdef DOUBLE_SIDED
			vIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );
		#endif
	}
	#pragma unroll_loop_end
#endif`,xp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
uniform vec3 lightProbe[ 9 ];
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in GeometricContext geometry ) {
	vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	return irradiance;
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		directLight.color = directionalLight.color;
		directLight.direction = directionalLight.direction;
		directLight.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		vec3 lVector = pointLight.position - geometry.position;
		directLight.direction = normalize( lVector );
		float lightDistance = length( lVector );
		directLight.color = pointLight.color;
		directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );
		directLight.visible = ( directLight.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		vec3 lVector = spotLight.position - geometry.position;
		directLight.direction = normalize( lVector );
		float lightDistance = length( lVector );
		float angleCos = dot( directLight.direction, spotLight.direction );
		if ( angleCos > spotLight.coneCos ) {
			float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );
			directLight.color = spotLight.color;
			directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );
			directLight.visible = true;
		} else {
			directLight.color = vec3( 0.0 );
			directLight.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {
		float dotNL = dot( geometry.normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			irradiance *= PI;
		#endif
		return irradiance;
	}
#endif`,yp=`#if defined( USE_ENVMAP )
	#ifdef ENVMAP_MODE_REFRACTION
		uniform float refractionRatio;
	#endif
	vec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {
		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
		#ifdef ENVMAP_TYPE_CUBE
			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );
			#ifdef TEXTURE_LOD_EXT
				vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );
			#else
				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );
			#endif
			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
		#elif defined( ENVMAP_TYPE_CUBE_UV )
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
		#else
			vec4 envMapColor = vec4( 0.0 );
		#endif
		return PI * envMapColor.rgb * envMapIntensity;
	}
	float getSpecularMIPLevel( const in float roughness, const in int maxMIPLevel ) {
		float maxMIPLevelScalar = float( maxMIPLevel );
		float sigma = PI * roughness * roughness / ( 1.0 + roughness );
		float desiredMIPLevel = maxMIPLevelScalar + log2( sigma );
		return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );
	}
	vec3 getLightProbeIndirectRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in int maxMIPLevel ) {
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( -viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
		#else
			vec3 reflectVec = refract( -viewDir, normal, refractionRatio );
		#endif
		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
		float specularMIPLevel = getSpecularMIPLevel( roughness, maxMIPLevel );
		#ifdef ENVMAP_TYPE_CUBE
			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
			#ifdef TEXTURE_LOD_EXT
				vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );
			#else
				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );
			#endif
			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
		#elif defined( ENVMAP_TYPE_CUBE_UV )
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
		#endif
		return envMapColor.rgb * envMapIntensity;
	}
#endif`,_p=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,wp=`varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometry.normal, directLight.direction ) * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
#define Material_LightProbeLOD( material )	(0)`,bp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Mp=`varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong
#define Material_LightProbeLOD( material )	(0)`,Sp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.specularRoughness = max( roughnessFactor, 0.0525 );material.specularRoughness += geometryRoughness;
material.specularRoughness = min( material.specularRoughness, 1.0 );
#ifdef REFLECTIVITY
	material.specularColor = mix( vec3( MAXIMUM_SPECULAR_COEFFICIENT * pow2( reflectivity ) ), diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( DEFAULT_SPECULAR_COEFFICIENT ), diffuseColor.rgb, metalnessFactor );
#endif
#ifdef CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheen;
#endif`,Tp=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float specularRoughness;
	vec3 specularColor;
#ifdef CLEARCOAT
	float clearcoat;
	float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
	vec3 sheenColor;
#endif
};
#define MAXIMUM_SPECULAR_COEFFICIENT 0.16
#define DEFAULT_SPECULAR_COEFFICIENT 0.04
float clearcoatDHRApprox( const in float roughness, const in float dotNL ) {
	return DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometry.normal;
		vec3 viewDir = geometry.viewDir;
		vec3 position = geometry.position;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.specularRoughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	#ifdef CLEARCOAT
		float ccDotNL = saturate( dot( geometry.clearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = ccDotNL * directLight.color;
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			ccIrradiance *= PI;
		#endif
		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );
		reflectedLight.directSpecular += ccIrradiance * material.clearcoat * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );
	#else
		float clearcoatDHR = 0.0;
	#endif
	#ifdef USE_SHEEN
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_Sheen(
			material.specularRoughness,
			directLight.direction,
			geometry,
			material.sheenColor
		);
	#else
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);
	#endif
	reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef CLEARCOAT
		float ccDotNV = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );
		reflectedLight.indirectSpecular += clearcoatRadiance * material.clearcoat * BRDF_Specular_GGX_Environment( geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );
		float ccDotNL = ccDotNV;
		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );
	#else
		float clearcoatDHR = 0.0;
	#endif
	float clearcoatInv = 1.0 - clearcoatDHR;
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	BRDF_Specular_Multiscattering_Environment( geometry, material.specularColor, material.specularRoughness, singleScattering, multiScattering );
	vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );
	reflectedLight.indirectSpecular += clearcoatInv * radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Ep=`
GeometricContext geometry;
geometry.position = - vViewPosition;
geometry.normal = normal;
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
#ifdef CLEARCOAT
	geometry.clearcoatNormal = clearcoatNormal;
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointDirectLightIrradiance( pointLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotDirectLightIrradiance( spotLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	irradiance += getLightProbeIrradiance( lightProbe, geometry );
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ap=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel= texture2D( lightMap, vUv2 );
		vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			lightMapIrradiance *= PI;
		#endif
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getLightProbeIndirectIrradiance( geometry, maxMipLevel );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	radiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.normal, material.specularRoughness, maxMipLevel );
	#ifdef CLEARCOAT
		clearcoatRadiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.clearcoatNormal, material.clearcoatRoughness, maxMipLevel );
	#endif
#endif`,Lp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
#endif`,Rp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Cp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Pp=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Dp=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Fp=`#ifdef USE_MAP
	vec4 texelColor = texture2D( map, vUv );
	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;
#endif`,Ip=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,zp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
#endif
#ifdef USE_MAP
	vec4 mapTexel = texture2D( map, uv );
	diffuseColor *= mapTexelToLinear( mapTexel );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Bp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	uniform mat3 uvTransform;
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Np=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Up=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Op=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
	objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
	objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
	objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
#endif`,Hp=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifndef USE_MORPHNORMALS
		uniform float morphTargetInfluences[ 8 ];
	#else
		uniform float morphTargetInfluences[ 4 ];
	#endif
#endif`,kp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	transformed += morphTarget0 * morphTargetInfluences[ 0 ];
	transformed += morphTarget1 * morphTargetInfluences[ 1 ];
	transformed += morphTarget2 * morphTargetInfluences[ 2 ];
	transformed += morphTarget3 * morphTargetInfluences[ 3 ];
	#ifndef USE_MORPHNORMALS
		transformed += morphTarget4 * morphTargetInfluences[ 4 ];
		transformed += morphTarget5 * morphTargetInfluences[ 5 ];
		transformed += morphTarget6 * morphTargetInfluences[ 6 ];
		transformed += morphTarget7 * morphTargetInfluences[ 7 ];
	#endif
#endif`,Gp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
	vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	#ifdef USE_TANGENT
		vec3 tangent = normalize( vTangent );
		vec3 bitangent = normalize( vBitangent );
		#ifdef DOUBLE_SIDED
			tangent = tangent * faceDirection;
			bitangent = bitangent * faceDirection;
		#endif
		#if defined( TANGENTSPACE_NORMALMAP ) || defined( USE_CLEARCOAT_NORMALMAP )
			mat3 vTBN = mat3( tangent, bitangent, normal );
		#endif
	#endif
#endif
vec3 geometryNormal = normal;`,Vp=`#ifdef OBJECTSPACE_NORMALMAP
	normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( TANGENTSPACE_NORMALMAP )
	vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	#ifdef USE_TANGENT
		normal = normalize( vTBN * mapN );
	#else
		normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );
	#endif
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Wp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef OBJECTSPACE_NORMALMAP
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( TANGENTSPACE_NORMALMAP ) || defined ( USE_CLEARCOAT_NORMALMAP ) )
	vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {
		vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
		vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
		vec2 st0 = dFdx( vUv.st );
		vec2 st1 = dFdy( vUv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );
		return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );
	}
#endif`,qp=`#ifdef CLEARCOAT
	vec3 clearcoatNormal = geometryNormal;
#endif`,Xp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	#ifdef USE_TANGENT
		clearcoatNormal = normalize( vTBN * clearcoatMapN );
	#else
		clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );
	#endif
#endif`,Yp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif`,Zp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ));
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w);
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
	return linearClipZ * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return (( near + viewZ ) * far ) / (( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * invClipZ - far );
}`,Jp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,jp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,$p=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Kp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Qp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vUv );
	roughnessFactor *= texelRoughness.g;
#endif`,em=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,tm=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
		bool inFrustum = all( inFrustumVec );
		bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
		bool frustumTest = all( frustumTestVec );
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ), 
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ), 
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,nm=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHT_SHADOWS ];
		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,im=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		vec4 shadowWorldPosition;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
		vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias, 0 );
		vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
		vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
#endif`,rm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,sm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,om=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	#ifdef BONE_TEXTURE
		uniform highp sampler2D boneTexture;
		uniform int boneTextureSize;
		mat4 getBoneMatrix( const in float i ) {
			float j = i * 4.0;
			float x = mod( j, float( boneTextureSize ) );
			float y = floor( j / float( boneTextureSize ) );
			float dx = 1.0 / float( boneTextureSize );
			float dy = 1.0 / float( boneTextureSize );
			y = dy * ( y + 0.5 );
			vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
			vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
			vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
			vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );
			mat4 bone = mat4( v1, v2, v3, v4 );
			return bone;
		}
	#else
		uniform mat4 boneMatrices[ MAX_BONES ];
		mat4 getBoneMatrix( const in float i ) {
			mat4 bone = boneMatrices[ int(i) ];
			return bone;
		}
	#endif
#endif`,am=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,lm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,cm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,um=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,hm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,dm=`#ifndef saturate
#define saturate(a) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return toneMappingExposure * color;
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,fm=`#ifdef USE_TRANSMISSIONMAP
	totalTransmission *= texture2D( transmissionMap, vUv ).r;
#endif`,pm=`#ifdef USE_TRANSMISSIONMAP
	uniform sampler2D transmissionMap;
#endif`,mm=`#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif`,gm=`#ifdef USE_UV
	#ifdef UVS_VERTEX_ONLY
		vec2 vUv;
	#else
		varying vec2 vUv;
	#endif
	uniform mat3 uvTransform;
#endif`,vm=`#ifdef USE_UV
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
#endif`,xm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	varying vec2 vUv2;
#endif`,ym=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	attribute vec2 uv2;
	varying vec2 vUv2;
	uniform mat3 uv2Transform;
#endif`,_m=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
#endif`,wm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,bm=`uniform sampler2D t2D;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,Mm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Sm=`#include <envmap_common_pars_fragment>
uniform float opacity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	vec3 vReflect = vWorldDirection;
	#include <envmap_fragment>
	gl_FragColor = envColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,Tm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Em=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,Am=`#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Lm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Rm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Cm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	vec4 texColor = texture2D( tEquirect, sampleUV );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,Pm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Dm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Fm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <color_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Im=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
	
		vec4 lightMapTexel= texture2D( lightMap, vUv2 );
		reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zm=`#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <skinbase_vertex>
	#ifdef USE_ENVMAP
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Bm=`uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
varying vec3 vLightFront;
varying vec3 vIndirectFront;
#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <fog_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <emissivemap_fragment>
	#ifdef DOUBLE_SIDED
		reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;
	#else
		reflectedLight.indirectDiffuse += vIndirectFront;
	#endif
	#include <lightmap_fragment>
	reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );
	#ifdef DOUBLE_SIDED
		reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;
	#else
		reflectedLight.directDiffuse = vLightFront;
	#endif
	reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Nm=`#define LAMBERT
varying vec3 vLightFront;
varying vec3 vIndirectFront;
#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <envmap_pars_vertex>
#include <bsdfs>
#include <lights_pars_begin>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <lights_lambert_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Um=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <fog_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
		matcapColor = matcapTexelToLinear( matcapColor );
	#else
		vec4 matcapColor = vec4( 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Om=`#define MATCAP
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#ifndef FLAT_SHADED
		vNormal = normalize( transformedNormal );
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Hm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,km=`#define TOON
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Gm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Vm=`#define PHONG
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Wm=`#define STANDARD
#ifdef PHYSICAL
	#define REFLECTIVITY
	#define CLEARCOAT
	#define TRANSMISSION
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef TRANSMISSION
	uniform float transmission;
#endif
#ifdef REFLECTIVITY
	uniform float reflectivity;
#endif
#ifdef CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheen;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <transmissionmap_pars_fragment>
#include <bsdfs>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#ifdef TRANSMISSION
		float totalTransmission = transmission;
	#endif
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <transmissionmap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#ifdef TRANSMISSION
		diffuseColor.a *= mix( saturate( 1. - totalTransmission + linearToRelativeLuminance( reflectedLight.directSpecular + reflectedLight.indirectSpecular ) ), 1.0, metalness );
	#endif
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qm=`#define STANDARD
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Xm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	varying vec3 vViewPosition;
#endif
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <packing>
#include <uv_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
}`,Ym=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	varying vec3 vViewPosition;
#endif
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Zm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Jm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <color_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,jm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
}`,$m=`#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <begin_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Km=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
}`,Qm=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Ue={alphamap_fragment:Ff,alphamap_pars_fragment:If,alphatest_fragment:zf,aomap_fragment:Bf,aomap_pars_fragment:Nf,begin_vertex:Uf,beginnormal_vertex:Of,bsdfs:Hf,bumpmap_pars_fragment:kf,clipping_planes_fragment:Gf,clipping_planes_pars_fragment:Vf,clipping_planes_pars_vertex:Wf,clipping_planes_vertex:qf,color_fragment:Xf,color_pars_fragment:Yf,color_pars_vertex:Zf,color_vertex:Jf,common:jf,cube_uv_reflection_fragment:$f,defaultnormal_vertex:Kf,displacementmap_pars_vertex:Qf,displacementmap_vertex:ep,emissivemap_fragment:tp,emissivemap_pars_fragment:np,encodings_fragment:ip,encodings_pars_fragment:rp,envmap_fragment:sp,envmap_common_pars_fragment:op,envmap_pars_fragment:ap,envmap_pars_vertex:lp,envmap_physical_pars_fragment:yp,envmap_vertex:cp,fog_vertex:up,fog_pars_vertex:hp,fog_fragment:dp,fog_pars_fragment:fp,gradientmap_pars_fragment:pp,lightmap_fragment:mp,lightmap_pars_fragment:gp,lights_lambert_vertex:vp,lights_pars_begin:xp,lights_toon_fragment:_p,lights_toon_pars_fragment:wp,lights_phong_fragment:bp,lights_phong_pars_fragment:Mp,lights_physical_fragment:Sp,lights_physical_pars_fragment:Tp,lights_fragment_begin:Ep,lights_fragment_maps:Ap,lights_fragment_end:Lp,logdepthbuf_fragment:Rp,logdepthbuf_pars_fragment:Cp,logdepthbuf_pars_vertex:Pp,logdepthbuf_vertex:Dp,map_fragment:Fp,map_pars_fragment:Ip,map_particle_fragment:zp,map_particle_pars_fragment:Bp,metalnessmap_fragment:Np,metalnessmap_pars_fragment:Up,morphnormal_vertex:Op,morphtarget_pars_vertex:Hp,morphtarget_vertex:kp,normal_fragment_begin:Gp,normal_fragment_maps:Vp,normalmap_pars_fragment:Wp,clearcoat_normal_fragment_begin:qp,clearcoat_normal_fragment_maps:Xp,clearcoat_pars_fragment:Yp,packing:Zp,premultiplied_alpha_fragment:Jp,project_vertex:jp,dithering_fragment:$p,dithering_pars_fragment:Kp,roughnessmap_fragment:Qp,roughnessmap_pars_fragment:em,shadowmap_pars_fragment:tm,shadowmap_pars_vertex:nm,shadowmap_vertex:im,shadowmask_pars_fragment:rm,skinbase_vertex:sm,skinning_pars_vertex:om,skinning_vertex:am,skinnormal_vertex:lm,specularmap_fragment:cm,specularmap_pars_fragment:um,tonemapping_fragment:hm,tonemapping_pars_fragment:dm,transmissionmap_fragment:fm,transmissionmap_pars_fragment:pm,uv_pars_fragment:mm,uv_pars_vertex:gm,uv_vertex:vm,uv2_pars_fragment:xm,uv2_pars_vertex:ym,uv2_vertex:_m,worldpos_vertex:wm,background_frag:bm,background_vert:Mm,cube_frag:Sm,cube_vert:Tm,depth_frag:Em,depth_vert:Am,distanceRGBA_frag:Lm,distanceRGBA_vert:Rm,equirect_frag:Cm,equirect_vert:Pm,linedashed_frag:Dm,linedashed_vert:Fm,meshbasic_frag:Im,meshbasic_vert:zm,meshlambert_frag:Bm,meshlambert_vert:Nm,meshmatcap_frag:Um,meshmatcap_vert:Om,meshtoon_frag:Hm,meshtoon_vert:km,meshphong_frag:Gm,meshphong_vert:Vm,meshphysical_frag:Wm,meshphysical_vert:qm,normal_frag:Xm,normal_vert:Ym,points_frag:Zm,points_vert:Jm,shadow_frag:jm,shadow_vert:$m,sprite_frag:Km,sprite_vert:Qm},ve={common:{diffuse:{value:new pe(15658734)},opacity:{value:1},map:{value:null},uvTransform:{value:new at},uv2Transform:{value:new at},alphaMap:{value:null}},specularmap:{specularMap:{value:null}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},refractionRatio:{value:.98},maxMipLevel:{value:0}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1}},emissivemap:{emissiveMap:{value:null}},bumpmap:{bumpMap:{value:null},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalScale:{value:new te(1,1)}},displacementmap:{displacementMap:{value:null},displacementScale:{value:1},displacementBias:{value:0}},roughnessmap:{roughnessMap:{value:null}},metalnessmap:{metalnessMap:{value:null}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new pe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotShadowMap:{value:[]},spotShadowMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new pe(15658734)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},uvTransform:{value:new at}},sprite:{diffuse:{value:new pe(15658734)},opacity:{value:1},center:{value:new te(.5,.5)},rotation:{value:0},map:{value:null},alphaMap:{value:null},uvTransform:{value:new at}}},rn={basic:{uniforms:gt([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.fog]),vertexShader:Ue.meshbasic_vert,fragmentShader:Ue.meshbasic_frag},lambert:{uniforms:gt([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.fog,ve.lights,{emissive:{value:new pe(0)}}]),vertexShader:Ue.meshlambert_vert,fragmentShader:Ue.meshlambert_frag},phong:{uniforms:gt([ve.common,ve.specularmap,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.fog,ve.lights,{emissive:{value:new pe(0)},specular:{value:new pe(1118481)},shininess:{value:30}}]),vertexShader:Ue.meshphong_vert,fragmentShader:Ue.meshphong_frag},standard:{uniforms:gt([ve.common,ve.envmap,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.roughnessmap,ve.metalnessmap,ve.fog,ve.lights,{emissive:{value:new pe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ue.meshphysical_vert,fragmentShader:Ue.meshphysical_frag},toon:{uniforms:gt([ve.common,ve.aomap,ve.lightmap,ve.emissivemap,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.gradientmap,ve.fog,ve.lights,{emissive:{value:new pe(0)}}]),vertexShader:Ue.meshtoon_vert,fragmentShader:Ue.meshtoon_frag},matcap:{uniforms:gt([ve.common,ve.bumpmap,ve.normalmap,ve.displacementmap,ve.fog,{matcap:{value:null}}]),vertexShader:Ue.meshmatcap_vert,fragmentShader:Ue.meshmatcap_frag},points:{uniforms:gt([ve.points,ve.fog]),vertexShader:Ue.points_vert,fragmentShader:Ue.points_frag},dashed:{uniforms:gt([ve.common,ve.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ue.linedashed_vert,fragmentShader:Ue.linedashed_frag},depth:{uniforms:gt([ve.common,ve.displacementmap]),vertexShader:Ue.depth_vert,fragmentShader:Ue.depth_frag},normal:{uniforms:gt([ve.common,ve.bumpmap,ve.normalmap,ve.displacementmap,{opacity:{value:1}}]),vertexShader:Ue.normal_vert,fragmentShader:Ue.normal_frag},sprite:{uniforms:gt([ve.sprite,ve.fog]),vertexShader:Ue.sprite_vert,fragmentShader:Ue.sprite_frag},background:{uniforms:{uvTransform:{value:new at},t2D:{value:null}},vertexShader:Ue.background_vert,fragmentShader:Ue.background_frag},cube:{uniforms:gt([ve.envmap,{opacity:{value:1}}]),vertexShader:Ue.cube_vert,fragmentShader:Ue.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ue.equirect_vert,fragmentShader:Ue.equirect_frag},distanceRGBA:{uniforms:gt([ve.common,ve.displacementmap,{referencePosition:{value:new T},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ue.distanceRGBA_vert,fragmentShader:Ue.distanceRGBA_frag},shadow:{uniforms:gt([ve.lights,ve.fog,{color:{value:new pe(0)},opacity:{value:1}}]),vertexShader:Ue.shadow_vert,fragmentShader:Ue.shadow_frag}};rn.physical={uniforms:gt([rn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatNormalScale:{value:new te(1,1)},clearcoatNormalMap:{value:null},sheen:{value:new pe(0)},transmission:{value:0},transmissionMap:{value:null}}]),vertexShader:Ue.meshphysical_vert,fragmentShader:Ue.meshphysical_frag};function eg(r,e,t,n,i){let s=new pe(0),o=0,a,l,c=null,u=0,h=null;function d(g,v,_,m){let p=v.isScene===!0?v.background:null;p&&p.isTexture&&(p=e.get(p));let L=r.xr,A=L.getSession&&L.getSession();A&&A.environmentBlendMode==="additive"&&(p=null),p===null?f(s,o):p&&p.isColor&&(f(p,1),m=!0),(r.autoClear||m)&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),p&&(p.isCubeTexture||p.mapping===Fl)?(l===void 0&&(l=new Oe(new Lr(1,1,1),new qe({name:"BackgroundCubeMaterial",uniforms:Ci(rn.cube.uniforms),vertexShader:rn.cube.vertexShader,fragmentShader:rn.cube.fragmentShader,side:ot,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(C,b,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=p,l.material.uniforms.flipEnvMap.value=p.isCubeTexture&&p._needsFlipEnvMap?-1:1,(c!==p||u!==p.version||h!==r.toneMapping)&&(l.material.needsUpdate=!0,c=p,u=p.version,h=r.toneMapping),g.unshift(l,l.geometry,l.material,0,0,null)):p&&p.isTexture&&(a===void 0&&(a=new Oe(new St(2,2),new qe({name:"BackgroundMaterial",uniforms:Ci(rn.background.uniforms),vertexShader:rn.background.vertexShader,fragmentShader:rn.background.fragmentShader,side:go,depthTest:!1,depthWrite:!1,fog:!1})),a.geometry.deleteAttribute("normal"),Object.defineProperty(a.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(a)),a.material.uniforms.t2D.value=p,p.matrixAutoUpdate===!0&&p.updateMatrix(),a.material.uniforms.uvTransform.value.copy(p.matrix),(c!==p||u!==p.version||h!==r.toneMapping)&&(a.material.needsUpdate=!0,c=p,u=p.version,h=r.toneMapping),g.unshift(a,a.geometry,a.material,0,0,null))}function f(g,v){t.buffers.color.setClear(g.r,g.g,g.b,v,i)}return{getClearColor:function(){return s},setClearColor:function(g,v=1){s.set(g),o=v,f(s,o)},getClearAlpha:function(){return o},setClearAlpha:function(g){o=g,f(s,o)},render:d}}function tg(r,e,t,n){let i=r.getParameter(34921),s=n.isWebGL2?null:e.get("OES_vertex_array_object"),o=n.isWebGL2||s!==null,a={},l=v(null),c=l;function u(R,U,O,z,$){let oe=!1;if(o){let re=g(z,O,U);c!==re&&(c=re,d(c.object)),oe=_(z,$),oe&&m(z,$)}else{let re=U.wireframe===!0;(c.geometry!==z.id||c.program!==O.id||c.wireframe!==re)&&(c.geometry=z.id,c.program=O.id,c.wireframe=re,oe=!0)}R.isInstancedMesh===!0&&(oe=!0),$!==null&&t.update($,34963),oe&&(I(R,U,O,z),$!==null&&r.bindBuffer(34963,t.get($).buffer))}function h(){return n.isWebGL2?r.createVertexArray():s.createVertexArrayOES()}function d(R){return n.isWebGL2?r.bindVertexArray(R):s.bindVertexArrayOES(R)}function f(R){return n.isWebGL2?r.deleteVertexArray(R):s.deleteVertexArrayOES(R)}function g(R,U,O){let z=O.wireframe===!0,$=a[R.id];$===void 0&&($={},a[R.id]=$);let oe=$[U.id];oe===void 0&&(oe={},$[U.id]=oe);let re=oe[z];return re===void 0&&(re=v(h()),oe[z]=re),re}function v(R){let U=[],O=[],z=[];for(let $=0;$<i;$++)U[$]=0,O[$]=0,z[$]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:O,attributeDivisors:z,object:R,attributes:{},index:null}}function _(R,U){let O=c.attributes,z=R.attributes,$=0;for(let oe in z){let re=O[oe],we=z[oe];if(re===void 0||re.attribute!==we||re.data!==we.data)return!0;$++}return c.attributesNum!==$||c.index!==U}function m(R,U){let O={},z=R.attributes,$=0;for(let oe in z){let re=z[oe],we={};we.attribute=re,re.data&&(we.data=re.data),O[oe]=we,$++}c.attributes=O,c.attributesNum=$,c.index=U}function p(){let R=c.newAttributes;for(let U=0,O=R.length;U<O;U++)R[U]=0}function L(R){A(R,0)}function A(R,U){let O=c.newAttributes,z=c.enabledAttributes,$=c.attributeDivisors;O[R]=1,z[R]===0&&(r.enableVertexAttribArray(R),z[R]=1),$[R]!==U&&((n.isWebGL2?r:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](R,U),$[R]=U)}function C(){let R=c.newAttributes,U=c.enabledAttributes;for(let O=0,z=U.length;O<z;O++)U[O]!==R[O]&&(r.disableVertexAttribArray(O),U[O]=0)}function b(R,U,O,z,$,oe){n.isWebGL2===!0&&(O===5124||O===5125)?r.vertexAttribIPointer(R,U,O,$,oe):r.vertexAttribPointer(R,U,O,z,$,oe)}function I(R,U,O,z){if(n.isWebGL2===!1&&(R.isInstancedMesh||z.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;p();let $=z.attributes,oe=O.getAttributes(),re=U.defaultAttributeValues;for(let we in oe){let xe=oe[we];if(xe>=0){let Le=$[we];if(Le!==void 0){let Ce=Le.normalized,J=Le.itemSize,Z=t.get(Le);if(Z===void 0)continue;let ae=Z.buffer,ye=Z.type,x=Z.bytesPerElement;if(Le.isInterleavedBufferAttribute){let me=Le.data,le=me.stride,Te=Le.offset;me&&me.isInstancedInterleavedBuffer?(A(xe,me.meshPerAttribute),z._maxInstanceCount===void 0&&(z._maxInstanceCount=me.meshPerAttribute*me.count)):L(xe),r.bindBuffer(34962,ae),b(xe,J,ye,Ce,le*x,Te*x)}else Le.isInstancedBufferAttribute?(A(xe,Le.meshPerAttribute),z._maxInstanceCount===void 0&&(z._maxInstanceCount=Le.meshPerAttribute*Le.count)):L(xe),r.bindBuffer(34962,ae),b(xe,J,ye,Ce,0,0)}else if(we==="instanceMatrix"){let Ce=t.get(R.instanceMatrix);if(Ce===void 0)continue;let J=Ce.buffer,Z=Ce.type;A(xe+0,1),A(xe+1,1),A(xe+2,1),A(xe+3,1),r.bindBuffer(34962,J),r.vertexAttribPointer(xe+0,4,Z,!1,64,0),r.vertexAttribPointer(xe+1,4,Z,!1,64,16),r.vertexAttribPointer(xe+2,4,Z,!1,64,32),r.vertexAttribPointer(xe+3,4,Z,!1,64,48)}else if(we==="instanceColor"){let Ce=t.get(R.instanceColor);if(Ce===void 0)continue;let J=Ce.buffer,Z=Ce.type;A(xe,1),r.bindBuffer(34962,J),r.vertexAttribPointer(xe,3,Z,!1,12,0)}else if(re!==void 0){let Ce=re[we];if(Ce!==void 0)switch(Ce.length){case 2:r.vertexAttrib2fv(xe,Ce);break;case 3:r.vertexAttrib3fv(xe,Ce);break;case 4:r.vertexAttrib4fv(xe,Ce);break;default:r.vertexAttrib1fv(xe,Ce)}}}}C()}function N(){X();for(let R in a){let U=a[R];for(let O in U){let z=U[O];for(let $ in z)f(z[$].object),delete z[$];delete U[O]}delete a[R]}}function k(R){if(a[R.id]===void 0)return;let U=a[R.id];for(let O in U){let z=U[O];for(let $ in z)f(z[$].object),delete z[$];delete U[O]}delete a[R.id]}function V(R){for(let U in a){let O=a[U];if(O[R.id]===void 0)continue;let z=O[R.id];for(let $ in z)f(z[$].object),delete z[$];delete O[R.id]}}function X(){W(),c!==l&&(c=l,d(c.object))}function W(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:X,resetDefaultState:W,dispose:N,releaseStatesOfGeometry:k,releaseStatesOfProgram:V,initAttributes:p,enableAttribute:L,disableUnusedAttributes:C}}function ng(r,e,t,n){let i=n.isWebGL2,s;function o(c){s=c}function a(c,u){r.drawArrays(s,c,u),t.update(u,s,1)}function l(c,u,h){if(h===0)return;let d,f;if(i)d=r,f="drawArraysInstanced";else if(d=e.get("ANGLE_instanced_arrays"),f="drawArraysInstancedANGLE",d===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}d[f](s,c,u,h),t.update(u,s,h)}this.setMode=o,this.render=a,this.renderInstances=l}function ig(r,e,t){let n;function i(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){let b=e.get("EXT_texture_filter_anisotropic");n=r.getParameter(b.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function s(b){if(b==="highp"){if(r.getShaderPrecisionFormat(35633,36338).precision>0&&r.getShaderPrecisionFormat(35632,36338).precision>0)return"highp";b="mediump"}return b==="mediump"&&r.getShaderPrecisionFormat(35633,36337).precision>0&&r.getShaderPrecisionFormat(35632,36337).precision>0?"mediump":"lowp"}let o=typeof WebGL2RenderingContext!="undefined"&&r instanceof WebGL2RenderingContext||typeof WebGL2ComputeRenderingContext!="undefined"&&r instanceof WebGL2ComputeRenderingContext,a=t.precision!==void 0?t.precision:"highp",l=s(a);l!==a&&(console.warn("THREE.WebGLRenderer:",a,"not supported, using",l,"instead."),a=l);let c=t.logarithmicDepthBuffer===!0,u=r.getParameter(34930),h=r.getParameter(35660),d=r.getParameter(3379),f=r.getParameter(34076),g=r.getParameter(34921),v=r.getParameter(36347),_=r.getParameter(36348),m=r.getParameter(36349),p=h>0,L=o||e.has("OES_texture_float"),A=p&&L,C=o?r.getParameter(36183):0;return{isWebGL2:o,getMaxAnisotropy:i,getMaxPrecision:s,precision:a,logarithmicDepthBuffer:c,maxTextures:u,maxVertexTextures:h,maxTextureSize:d,maxCubemapSize:f,maxAttributes:g,maxVertexUniforms:v,maxVaryings:_,maxFragmentUniforms:m,vertexTextures:p,floatFragmentTextures:L,floatVertexTextures:A,maxSamples:C}}function rg(r){let e=this,t=null,n=0,i=!1,s=!1,o=new Bt,a=new at,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d,f){let g=h.length!==0||d||n!==0||i;return i=d,t=u(h,f,0),n=h.length,g},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1,c()},this.setState=function(h,d,f){let g=h.clippingPlanes,v=h.clipIntersection,_=h.clipShadows,m=r.get(h);if(!i||g===null||g.length===0||s&&!_)s?u(null):c();else{let p=s?0:n,L=p*4,A=m.clippingState||null;l.value=A,A=u(g,d,L,f);for(let C=0;C!==L;++C)A[C]=t[C];m.clippingState=A,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=p}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(h,d,f,g){let v=h!==null?h.length:0,_=null;if(v!==0){if(_=l.value,g!==!0||_===null){let m=f+v*4,p=d.matrixWorldInverse;a.getNormalMatrix(p),(_===null||_.length<m)&&(_=new Float32Array(m));for(let L=0,A=f;L!==v;++L,A+=4)o.copy(h[L]).applyMatrix4(p,a),o.normal.toArray(_,A),_[A+3]=o.constant}l.value=_,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,_}}function sg(r){let e=new WeakMap;function t(o,a){return a===mc?o.mapping=Pl:a===gc&&(o.mapping=Dl),o}function n(o){if(o&&o.isTexture){let a=o.mapping;if(a===mc||a===gc)if(e.has(o)){let l=e.get(o).texture;return t(l,o.mapping)}else{let l=o.image;if(l&&l.height>0){let c=r.getRenderTarget(),u=new Ys(l.height/2);return u.fromEquirectangularTexture(r,o),e.set(o,u),r.setRenderTarget(c),o.addEventListener("dispose",i),t(u.texture,o.mapping)}else return null}}return o}function i(o){let a=o.target;a.removeEventListener("dispose",i);let l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function s(){e=new WeakMap}return{get:n,dispose:s}}function og(r){let e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?t("EXT_color_buffer_float"):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float")},get:function(n){let i=t(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function ag(r,e,t,n){let i={},s=new WeakMap;function o(h){let d=h.target;d.index!==null&&e.remove(d.index);for(let g in d.attributes)e.remove(d.attributes[g]);d.removeEventListener("dispose",o),delete i[d.id];let f=s.get(d);f&&(e.remove(f),s.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(h,d){return i[d.id]===!0||(d.addEventListener("dispose",o),i[d.id]=!0,t.memory.geometries++),d}function l(h){let d=h.attributes;for(let g in d)e.update(d[g],34962);let f=h.morphAttributes;for(let g in f){let v=f[g];for(let _=0,m=v.length;_<m;_++)e.update(v[_],34962)}}function c(h){let d=[],f=h.index,g=h.attributes.position,v=0;if(f!==null){let p=f.array;v=f.version;for(let L=0,A=p.length;L<A;L+=3){let C=p[L+0],b=p[L+1],I=p[L+2];d.push(C,b,b,I,I,C)}}else{let p=g.array;v=g.version;for(let L=0,A=p.length/3-1;L<A;L+=3){let C=L+0,b=L+1,I=L+2;d.push(C,b,b,I,I,C)}}let _=new(Uu(d)>65535?Xs:qs)(d,1);_.version=v;let m=s.get(h);m&&e.remove(m),s.set(h,_)}function u(h){let d=s.get(h);if(d){let f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:u}}function lg(r,e,t,n){let i=n.isWebGL2,s;function o(d){s=d}let a,l;function c(d){a=d.type,l=d.bytesPerElement}function u(d,f){r.drawElements(s,f,a,d*l),t.update(f,s,1)}function h(d,f,g){if(g===0)return;let v,_;if(i)v=r,_="drawElementsInstanced";else if(v=e.get("ANGLE_instanced_arrays"),_="drawElementsInstancedANGLE",v===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}v[_](s,f,a,d*l,g),t.update(f,s,g)}this.setMode=o,this.setIndex=c,this.render=u,this.renderInstances=h}function cg(r){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,o,a){switch(t.calls++,o){case 4:t.triangles+=a*(s/3);break;case 1:t.lines+=a*(s/2);break;case 3:t.lines+=a*(s-1);break;case 2:t.lines+=a*s;break;case 0:t.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function i(){t.frame++,t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function ug(r,e){return r[0]-e[0]}function hg(r,e){return Math.abs(e[1])-Math.abs(r[1])}function dg(r){let e={},t=new Float32Array(8),n=[];for(let s=0;s<8;s++)n[s]=[s,0];function i(s,o,a,l){let c=s.morphTargetInfluences,u=c===void 0?0:c.length,h=e[o.id];if(h===void 0){h=[];for(let _=0;_<u;_++)h[_]=[_,0];e[o.id]=h}for(let _=0;_<u;_++){let m=h[_];m[0]=_,m[1]=c[_]}h.sort(hg);for(let _=0;_<8;_++)_<u&&h[_][1]?(n[_][0]=h[_][0],n[_][1]=h[_][1]):(n[_][0]=Number.MAX_SAFE_INTEGER,n[_][1]=0);n.sort(ug);let d=a.morphTargets&&o.morphAttributes.position,f=a.morphNormals&&o.morphAttributes.normal,g=0;for(let _=0;_<8;_++){let m=n[_],p=m[0],L=m[1];p!==Number.MAX_SAFE_INTEGER&&L?(d&&o.getAttribute("morphTarget"+_)!==d[p]&&o.setAttribute("morphTarget"+_,d[p]),f&&o.getAttribute("morphNormal"+_)!==f[p]&&o.setAttribute("morphNormal"+_,f[p]),t[_]=L,g+=L):(d&&o.hasAttribute("morphTarget"+_)===!0&&o.deleteAttribute("morphTarget"+_),f&&o.hasAttribute("morphNormal"+_)===!0&&o.deleteAttribute("morphNormal"+_),t[_]=0)}let v=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(r,"morphTargetBaseInfluence",v),l.getUniforms().setValue(r,"morphTargetInfluences",t)}return{update:i}}function fg(r,e,t,n){let i=new WeakMap;function s(l){let c=n.render.frame,u=l.geometry,h=e.get(l,u);return i.get(h)!==c&&(e.update(h),i.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),t.update(l.instanceMatrix,34962),l.instanceColor!==null&&t.update(l.instanceColor,34962)),h}function o(){i=new WeakMap}function a(l){let c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:o}}var Zs=class extends yt{constructor(e=null,t=1,n=1,i=1){super(null),this.image={data:e,width:t,height:n,depth:i},this.magFilter=Mt,this.minFilter=Mt,this.wrapR=Yt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};Zs.prototype.isDataTexture2DArray=!0;var Js=class extends yt{constructor(e=null,t=1,n=1,i=1){super(null),this.image={data:e,width:t,height:n,depth:i},this.magFilter=Mt,this.minFilter=Mt,this.wrapR=Yt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};Js.prototype.isDataTexture3D=!0;var Hu=new yt,pg=new Zs,mg=new Js,ku=new Pi,Gc=[],Vc=[],Wc=new Float32Array(16),qc=new Float32Array(9),Xc=new Float32Array(4);function Yi(r,e,t){let n=r[0];if(n<=0||n>0)return r;let i=e*t,s=Gc[i];if(s===void 0&&(s=new Float32Array(i),Gc[i]=s),e!==0){n.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,r[o].toArray(s,a)}return s}function Tt(r,e){if(r.length!==e.length)return!1;for(let t=0,n=r.length;t<n;t++)if(r[t]!==e[t])return!1;return!0}function _t(r,e){for(let t=0,n=e.length;t<n;t++)r[t]=e[t]}function Gu(r,e){let t=Vc[e];t===void 0&&(t=new Int32Array(e),Vc[e]=t);for(let n=0;n!==e;++n)t[n]=r.allocateTextureUnit();return t}function gg(r,e){let t=this.cache;t[0]!==e&&(r.uniform1f(this.addr,e),t[0]=e)}function vg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(r.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Tt(t,e))return;r.uniform2fv(this.addr,e),_t(t,e)}}function xg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(r.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(r.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Tt(t,e))return;r.uniform3fv(this.addr,e),_t(t,e)}}function yg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(r.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Tt(t,e))return;r.uniform4fv(this.addr,e),_t(t,e)}}function _g(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;r.uniformMatrix2fv(this.addr,!1,e),_t(t,e)}else{if(Tt(t,n))return;Xc.set(n),r.uniformMatrix2fv(this.addr,!1,Xc),_t(t,n)}}function wg(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;r.uniformMatrix3fv(this.addr,!1,e),_t(t,e)}else{if(Tt(t,n))return;qc.set(n),r.uniformMatrix3fv(this.addr,!1,qc),_t(t,n)}}function bg(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;r.uniformMatrix4fv(this.addr,!1,e),_t(t,e)}else{if(Tt(t,n))return;Wc.set(n),r.uniformMatrix4fv(this.addr,!1,Wc),_t(t,n)}}function Mg(r,e){let t=this.cache;t[0]!==e&&(r.uniform1i(this.addr,e),t[0]=e)}function Sg(r,e){let t=this.cache;Tt(t,e)||(r.uniform2iv(this.addr,e),_t(t,e))}function Tg(r,e){let t=this.cache;Tt(t,e)||(r.uniform3iv(this.addr,e),_t(t,e))}function Eg(r,e){let t=this.cache;Tt(t,e)||(r.uniform4iv(this.addr,e),_t(t,e))}function Ag(r,e){let t=this.cache;t[0]!==e&&(r.uniform1ui(this.addr,e),t[0]=e)}function Lg(r,e){let t=this.cache;Tt(t,e)||(r.uniform2uiv(this.addr,e),_t(t,e))}function Rg(r,e){let t=this.cache;Tt(t,e)||(r.uniform3uiv(this.addr,e),_t(t,e))}function Cg(r,e){let t=this.cache;Tt(t,e)||(r.uniform4uiv(this.addr,e),_t(t,e))}function Pg(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.safeSetTexture2D(e||Hu,i)}function Dg(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||mg,i)}function Fg(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.safeSetTextureCube(e||ku,i)}function Ig(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||pg,i)}function zg(r){switch(r){case 5126:return gg;case 35664:return vg;case 35665:return xg;case 35666:return yg;case 35674:return _g;case 35675:return wg;case 35676:return bg;case 5124:case 35670:return Mg;case 35667:case 35671:return Sg;case 35668:case 35672:return Tg;case 35669:case 35673:return Eg;case 5125:return Ag;case 36294:return Lg;case 36295:return Rg;case 36296:return Cg;case 35678:case 36198:case 36298:case 36306:case 35682:return Pg;case 35679:case 36299:case 36307:return Dg;case 35680:case 36300:case 36308:case 36293:return Fg;case 36289:case 36303:case 36311:case 36292:return Ig}}function Bg(r,e){r.uniform1fv(this.addr,e)}function Ng(r,e){let t=Yi(e,this.size,2);r.uniform2fv(this.addr,t)}function Ug(r,e){let t=Yi(e,this.size,3);r.uniform3fv(this.addr,t)}function Og(r,e){let t=Yi(e,this.size,4);r.uniform4fv(this.addr,t)}function Hg(r,e){let t=Yi(e,this.size,4);r.uniformMatrix2fv(this.addr,!1,t)}function kg(r,e){let t=Yi(e,this.size,9);r.uniformMatrix3fv(this.addr,!1,t)}function Gg(r,e){let t=Yi(e,this.size,16);r.uniformMatrix4fv(this.addr,!1,t)}function Vg(r,e){r.uniform1iv(this.addr,e)}function Wg(r,e){r.uniform2iv(this.addr,e)}function qg(r,e){r.uniform3iv(this.addr,e)}function Xg(r,e){r.uniform4iv(this.addr,e)}function Yg(r,e){r.uniform1uiv(this.addr,e)}function Zg(r,e){r.uniform2uiv(this.addr,e)}function Jg(r,e){r.uniform3uiv(this.addr,e)}function jg(r,e){r.uniform4uiv(this.addr,e)}function $g(r,e,t){let n=e.length,i=Gu(t,n);r.uniform1iv(this.addr,i);for(let s=0;s!==n;++s)t.safeSetTexture2D(e[s]||Hu,i[s])}function Kg(r,e,t){let n=e.length,i=Gu(t,n);r.uniform1iv(this.addr,i);for(let s=0;s!==n;++s)t.safeSetTextureCube(e[s]||ku,i[s])}function Qg(r){switch(r){case 5126:return Bg;case 35664:return Ng;case 35665:return Ug;case 35666:return Og;case 35674:return Hg;case 35675:return kg;case 35676:return Gg;case 5124:case 35670:return Vg;case 35667:case 35671:return Wg;case 35668:case 35672:return qg;case 35669:case 35673:return Xg;case 5125:return Yg;case 36294:return Zg;case 36295:return Jg;case 36296:return jg;case 35678:case 36198:case 36298:case 36306:case 35682:return $g;case 35680:case 36300:case 36308:case 36293:return Kg}}function e0(r,e,t){this.id=r,this.addr=t,this.cache=[],this.setValue=zg(e.type)}function Vu(r,e,t){this.id=r,this.addr=t,this.cache=[],this.size=e.size,this.setValue=Qg(e.type)}Vu.prototype.updateCache=function(r){let e=this.cache;r instanceof Float32Array&&e.length!==r.length&&(this.cache=new Float32Array(r.length)),_t(e,r)};function Wu(r){this.id=r,this.seq=[],this.map={}}Wu.prototype.setValue=function(r,e,t){let n=this.seq;for(let i=0,s=n.length;i!==s;++i){let o=n[i];o.setValue(r,e[o.id],t)}};var ua=/(\w+)(\])?(\[|\.)?/g;function Yc(r,e){r.seq.push(e),r.map[e.id]=e}function t0(r,e,t){let n=r.name,i=n.length;for(ua.lastIndex=0;;){let s=ua.exec(n),o=ua.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===i){Yc(t,c===void 0?new e0(a,r,e):new Vu(a,r,e));break}else{let h=t.map[a];h===void 0&&(h=new Wu(a),Yc(t,h)),t=h}}}function In(r,e){this.seq=[],this.map={};let t=r.getProgramParameter(e,35718);for(let n=0;n<t;++n){let i=r.getActiveUniform(e,n),s=r.getUniformLocation(e,i.name);t0(i,s,this)}}In.prototype.setValue=function(r,e,t,n){let i=this.map[e];i!==void 0&&i.setValue(r,t,n)};In.prototype.setOptional=function(r,e,t){let n=e[t];n!==void 0&&this.setValue(r,t,n)};In.upload=function(r,e,t,n){for(let i=0,s=e.length;i!==s;++i){let o=e[i],a=t[o.id];a.needsUpdate!==!1&&o.setValue(r,a.value,n)}};In.seqWithValue=function(r,e){let t=[];for(let n=0,i=r.length;n!==i;++n){let s=r[n];s.id in e&&t.push(s)}return t};function Zc(r,e,t){let n=r.createShader(e);return r.shaderSource(n,t),r.compileShader(n),n}var n0=0;function i0(r){let e=r.split(`
`);for(let t=0;t<e.length;t++)e[t]=t+1+": "+e[t];return e.join(`
`)}function qu(r){switch(r){case qi:return["Linear","( value )"];case Nl:return["sRGB","( value )"];case Fu:return["RGBE","( value )"];case Iu:return["RGBM","( value, 7.0 )"];case zu:return["RGBM","( value, 16.0 )"];case Bu:return["RGBD","( value, 256.0 )"];case Du:return["Gamma","( value, float( GAMMA_FACTOR ) )"];case lf:return["LogLuv","( value )"];default:return console.warn("THREE.WebGLProgram: Unsupported encoding:",r),["Linear","( value )"]}}function Jc(r,e,t){let n=r.getShaderParameter(e,35713),i=r.getShaderInfoLog(e).trim();if(n&&i==="")return"";let s=r.getShaderSource(e);return"THREE.WebGLShader: gl.getShaderInfoLog() "+t+`
`+i+i0(s)}function or(r,e){let t=qu(e);return"vec4 "+r+"( vec4 value ) { return "+t[0]+"ToLinear"+t[1]+"; }"}function r0(r,e){let t=qu(e);return"vec4 "+r+"( vec4 value ) { return LinearTo"+t[0]+t[1]+"; }"}function s0(r,e){let t;switch(e){case od:t="Linear";break;case ad:t="Reinhard";break;case ld:t="OptimizedCineon";break;case cd:t="ACESFilmic";break;case ud:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+r+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function o0(r){return[r.extensionDerivatives||r.envMapCubeUV||r.bumpMap||r.tangentSpaceNormalMap||r.clearcoatNormalMap||r.flatShading||r.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(r.extensionFragDepth||r.logarithmicDepthBuffer)&&r.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",r.extensionDrawBuffers&&r.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(r.extensionShaderTextureLOD||r.envMap)&&r.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(fr).join(`
`)}function a0(r){let e=[];for(let t in r){let n=r[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function l0(r,e){let t={},n=r.getProgramParameter(e,35721);for(let i=0;i<n;i++){let o=r.getActiveAttrib(e,i).name;t[o]=r.getAttribLocation(e,o)}return t}function fr(r){return r!==""}function jc(r,e){return r.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function $c(r,e){return r.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var c0=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ma(r){return r.replace(c0,u0)}function u0(r,e){let t=Ue[e];if(t===void 0)throw new Error("Can not resolve #include <"+e+">");return Ma(t)}var h0=/#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g,d0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Kc(r){return r.replace(d0,Xu).replace(h0,f0)}function f0(r,e,t,n){return console.warn("WebGLProgram: #pragma unroll_loop shader syntax is deprecated. Please use #pragma unroll_loop_start syntax instead."),Xu(r,e,t,n)}function Xu(r,e,t,n){let i="";for(let s=parseInt(e);s<parseInt(t);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function Qc(r){let e="precision "+r.precision+` float;
precision `+r.precision+" int;";return r.precision==="highp"?e+=`
#define HIGH_PRECISION`:r.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function p0(r){let e="SHADOWMAP_TYPE_BASIC";return r.shadowMapType===Au?e="SHADOWMAP_TYPE_PCF":r.shadowMapType===kh?e="SHADOWMAP_TYPE_PCF_SOFT":r.shadowMapType===dr&&(e="SHADOWMAP_TYPE_VSM"),e}function m0(r){let e="ENVMAP_TYPE_CUBE";if(r.envMap)switch(r.envMapMode){case Pl:case Dl:e="ENVMAP_TYPE_CUBE";break;case Fl:case Il:e="ENVMAP_TYPE_CUBE_UV";break}return e}function g0(r){let e="ENVMAP_MODE_REFLECTION";if(r.envMap)switch(r.envMapMode){case Dl:case Il:e="ENVMAP_MODE_REFRACTION";break}return e}function v0(r){let e="ENVMAP_BLENDING_NONE";if(r.envMap)switch(r.combine){case vo:e="ENVMAP_BLENDING_MULTIPLY";break;case rd:e="ENVMAP_BLENDING_MIX";break;case sd:e="ENVMAP_BLENDING_ADD";break}return e}function x0(r,e,t,n){let i=r.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=p0(t),c=m0(t),u=g0(t),h=v0(t),d=r.gammaFactor>0?r.gammaFactor:1,f=t.isWebGL2?"":o0(t),g=a0(s),v=i.createProgram(),_,m,p=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(_=[g].filter(fr).join(`
`),_.length>0&&(_+=`
`),m=[f,g].filter(fr).join(`
`),m.length>0&&(m+=`
`)):(_=[Qc(t),"#define SHADER_NAME "+t.shaderName,g,t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.supportsVertexTextures?"#define VERTEX_TEXTURES":"","#define GAMMA_FACTOR "+d,"#define MAX_BONES "+t.maxBones,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.displacementMap&&t.supportsVertexTextures?"#define USE_DISPLACEMENTMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.useVertexTexture?"#define BONE_TEXTURE":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_MORPHTARGETS","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(fr).join(`
`),m=[f,Qc(t),"#define SHADER_NAME "+t.shaderName,g,t.alphaTest?"#define ALPHATEST "+t.alphaTest+(t.alphaTest%1?"":".0"):"","#define GAMMA_FACTOR "+d,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.sheen?"#define USE_SHEEN":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.physicallyCorrectLights?"#define PHYSICALLY_CORRECT_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"",(t.extensionShaderTextureLOD||t.envMap)&&t.rendererExtensionShaderTextureLod?"#define TEXTURE_LOD_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==gr?"#define TONE_MAPPING":"",t.toneMapping!==gr?Ue.tonemapping_pars_fragment:"",t.toneMapping!==gr?s0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",Ue.encodings_pars_fragment,t.map?or("mapTexelToLinear",t.mapEncoding):"",t.matcap?or("matcapTexelToLinear",t.matcapEncoding):"",t.envMap?or("envMapTexelToLinear",t.envMapEncoding):"",t.emissiveMap?or("emissiveMapTexelToLinear",t.emissiveMapEncoding):"",t.lightMap?or("lightMapTexelToLinear",t.lightMapEncoding):"",r0("linearToOutputTexel",t.outputEncoding),t.depthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(fr).join(`
`)),o=Ma(o),o=jc(o,t),o=$c(o,t),a=Ma(a),a=jc(a,t),a=$c(a,t),o=Kc(o),a=Kc(a),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(p=`#version 300 es
`,_=["#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+_,m=["#define varying in",t.glslVersion===Rc?"":"out highp vec4 pc_fragColor;",t.glslVersion===Rc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let L=p+_+o,A=p+m+a,C=Zc(i,35633,L),b=Zc(i,35632,A);if(i.attachShader(v,C),i.attachShader(v,b),t.index0AttributeName!==void 0?i.bindAttribLocation(v,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(v,0,"position"),i.linkProgram(v),r.debug.checkShaderErrors){let k=i.getProgramInfoLog(v).trim(),V=i.getShaderInfoLog(C).trim(),X=i.getShaderInfoLog(b).trim(),W=!0,R=!0;if(i.getProgramParameter(v,35714)===!1){W=!1;let U=Jc(i,C,"vertex"),O=Jc(i,b,"fragment");console.error("THREE.WebGLProgram: shader error: ",i.getError(),"35715",i.getProgramParameter(v,35715),"gl.getProgramInfoLog",k,U,O)}else k!==""?console.warn("THREE.WebGLProgram: gl.getProgramInfoLog()",k):(V===""||X==="")&&(R=!1);R&&(this.diagnostics={runnable:W,programLog:k,vertexShader:{log:V,prefix:_},fragmentShader:{log:X,prefix:m}})}i.deleteShader(C),i.deleteShader(b);let I;this.getUniforms=function(){return I===void 0&&(I=new In(i,v)),I};let N;return this.getAttributes=function(){return N===void 0&&(N=l0(i,v)),N},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(v),this.program=void 0},this.name=t.shaderName,this.id=n0++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=C,this.fragmentShader=b,this}function y0(r,e,t,n,i,s){let o=[],a=n.isWebGL2,l=n.logarithmicDepthBuffer,c=n.floatVertexTextures,u=n.maxVertexUniforms,h=n.vertexTextures,d=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"},g=["precision","isWebGL2","supportsVertexTextures","outputEncoding","instancing","instancingColor","map","mapEncoding","matcap","matcapEncoding","envMap","envMapMode","envMapEncoding","envMapCubeUV","lightMap","lightMapEncoding","aoMap","emissiveMap","emissiveMapEncoding","bumpMap","normalMap","objectSpaceNormalMap","tangentSpaceNormalMap","clearcoatMap","clearcoatRoughnessMap","clearcoatNormalMap","displacementMap","specularMap","roughnessMap","metalnessMap","gradientMap","alphaMap","combine","vertexColors","vertexAlphas","vertexTangents","vertexUvs","uvsVertexOnly","fog","useFog","fogExp2","flatShading","sizeAttenuation","logarithmicDepthBuffer","skinning","maxBones","useVertexTexture","morphTargets","morphNormals","premultipliedAlpha","numDirLights","numPointLights","numSpotLights","numHemiLights","numRectAreaLights","numDirLightShadows","numPointLightShadows","numSpotLightShadows","shadowMapEnabled","shadowMapType","toneMapping","physicallyCorrectLights","alphaTest","doubleSided","flipSided","numClippingPlanes","numClipIntersection","depthPacking","dithering","sheen","transmissionMap"];function v(b){let N=b.skeleton.bones;if(c)return 1024;{let V=Math.floor((u-20)/4),X=Math.min(V,N.length);return X<N.length?(console.warn("THREE.WebGLRenderer: Skeleton has "+N.length+" bones. This GPU supports "+X+"."),0):X}}function _(b){let I;return b&&b.isTexture?I=b.encoding:b&&b.isWebGLRenderTarget?(console.warn("THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead."),I=b.texture.encoding):I=qi,I}function m(b,I,N,k,V){let X=k.fog,W=b.isMeshStandardMaterial?k.environment:null,R=e.get(b.envMap||W),U=f[b.type],O=V.isSkinnedMesh?v(V):0;b.precision!==null&&(d=n.getMaxPrecision(b.precision),d!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",d,"instead."));let z,$;if(U){let we=rn[U];z=we.vertexShader,$=we.fragmentShader}else z=b.vertexShader,$=b.fragmentShader;let oe=r.getRenderTarget();return{isWebGL2:a,shaderID:U,shaderName:b.type,vertexShader:z,fragmentShader:$,defines:b.defines,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:d,instancing:V.isInstancedMesh===!0,instancingColor:V.isInstancedMesh===!0&&V.instanceColor!==null,supportsVertexTextures:h,outputEncoding:oe!==null?_(oe.texture):r.outputEncoding,map:!!b.map,mapEncoding:_(b.map),matcap:!!b.matcap,matcapEncoding:_(b.matcap),envMap:!!R,envMapMode:R&&R.mapping,envMapEncoding:_(R),envMapCubeUV:!!R&&(R.mapping===Fl||R.mapping===Il),lightMap:!!b.lightMap,lightMapEncoding:_(b.lightMap),aoMap:!!b.aoMap,emissiveMap:!!b.emissiveMap,emissiveMapEncoding:_(b.emissiveMap),bumpMap:!!b.bumpMap,normalMap:!!b.normalMap,objectSpaceNormalMap:b.normalMapType===hf,tangentSpaceNormalMap:b.normalMapType===Xi,clearcoatMap:!!b.clearcoatMap,clearcoatRoughnessMap:!!b.clearcoatRoughnessMap,clearcoatNormalMap:!!b.clearcoatNormalMap,displacementMap:!!b.displacementMap,roughnessMap:!!b.roughnessMap,metalnessMap:!!b.metalnessMap,specularMap:!!b.specularMap,alphaMap:!!b.alphaMap,gradientMap:!!b.gradientMap,sheen:!!b.sheen,transmissionMap:!!b.transmissionMap,combine:b.combine,vertexTangents:b.normalMap&&b.vertexTangents,vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&V.geometry&&V.geometry.attributes.color&&V.geometry.attributes.color.itemSize===4,vertexUvs:!!b.map||!!b.bumpMap||!!b.normalMap||!!b.specularMap||!!b.alphaMap||!!b.emissiveMap||!!b.roughnessMap||!!b.metalnessMap||!!b.clearcoatMap||!!b.clearcoatRoughnessMap||!!b.clearcoatNormalMap||!!b.displacementMap||!!b.transmissionMap,uvsVertexOnly:!(b.map||b.bumpMap||b.normalMap||b.specularMap||b.alphaMap||b.emissiveMap||b.roughnessMap||b.metalnessMap||b.clearcoatNormalMap||b.transmissionMap)&&!!b.displacementMap,fog:!!X,useFog:b.fog,fogExp2:X&&X.isFogExp2,flatShading:!!b.flatShading,sizeAttenuation:b.sizeAttenuation,logarithmicDepthBuffer:l,skinning:b.skinning&&O>0,maxBones:O,useVertexTexture:c,morphTargets:b.morphTargets,morphNormals:b.morphNormals,numDirLights:I.directional.length,numPointLights:I.point.length,numSpotLights:I.spot.length,numRectAreaLights:I.rectArea.length,numHemiLights:I.hemi.length,numDirLightShadows:I.directionalShadowMap.length,numPointLightShadows:I.pointShadowMap.length,numSpotLightShadows:I.spotShadowMap.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:b.dithering,shadowMapEnabled:r.shadowMap.enabled&&N.length>0,shadowMapType:r.shadowMap.type,toneMapping:b.toneMapped?r.toneMapping:gr,physicallyCorrectLights:r.physicallyCorrectLights,premultipliedAlpha:b.premultipliedAlpha,alphaTest:b.alphaTest,doubleSided:b.side===Rt,flipSided:b.side===ot,depthPacking:b.depthPacking!==void 0?b.depthPacking:!1,index0AttributeName:b.index0AttributeName,extensionDerivatives:b.extensions&&b.extensions.derivatives,extensionFragDepth:b.extensions&&b.extensions.fragDepth,extensionDrawBuffers:b.extensions&&b.extensions.drawBuffers,extensionShaderTextureLOD:b.extensions&&b.extensions.shaderTextureLOD,rendererExtensionFragDepth:a||t.has("EXT_frag_depth"),rendererExtensionDrawBuffers:a||t.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:a||t.has("EXT_shader_texture_lod"),customProgramCacheKey:b.customProgramCacheKey()}}function p(b){let I=[];if(b.shaderID?I.push(b.shaderID):(I.push(b.fragmentShader),I.push(b.vertexShader)),b.defines!==void 0)for(let N in b.defines)I.push(N),I.push(b.defines[N]);if(b.isRawShaderMaterial===!1){for(let N=0;N<g.length;N++)I.push(b[g[N]]);I.push(r.outputEncoding),I.push(r.gammaFactor)}return I.push(b.customProgramCacheKey),I.join()}function L(b){let I=f[b.type],N;if(I){let k=rn[I];N=Rf.clone(k.uniforms)}else N=b.uniforms;return N}function A(b,I){let N;for(let k=0,V=o.length;k<V;k++){let X=o[k];if(X.cacheKey===I){N=X,++N.usedTimes;break}}return N===void 0&&(N=new x0(r,I,b,i),o.push(N)),N}function C(b){if(--b.usedTimes===0){let I=o.indexOf(b);o[I]=o[o.length-1],o.pop(),b.destroy()}}return{getParameters:m,getProgramCacheKey:p,getUniforms:L,acquireProgram:A,releaseProgram:C,programs:o}}function _0(){let r=new WeakMap;function e(s){let o=r.get(s);return o===void 0&&(o={},r.set(s,o)),o}function t(s){r.delete(s)}function n(s,o,a){r.get(s)[o]=a}function i(){r=new WeakMap}return{get:e,remove:t,update:n,dispose:i}}function w0(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.program!==e.program?r.program.id-e.program.id:r.material.id!==e.material.id?r.material.id-e.material.id:r.z!==e.z?r.z-e.z:r.id-e.id}function b0(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.z!==e.z?e.z-r.z:r.id-e.id}function eu(r){let e=[],t=0,n=[],i=[],s={id:-1};function o(){t=0,n.length=0,i.length=0}function a(d,f,g,v,_,m){let p=e[t],L=r.get(g);return p===void 0?(p={id:d.id,object:d,geometry:f,material:g,program:L.program||s,groupOrder:v,renderOrder:d.renderOrder,z:_,group:m},e[t]=p):(p.id=d.id,p.object=d,p.geometry=f,p.material=g,p.program=L.program||s,p.groupOrder=v,p.renderOrder=d.renderOrder,p.z=_,p.group=m),t++,p}function l(d,f,g,v,_,m){let p=a(d,f,g,v,_,m);(g.transparent===!0?i:n).push(p)}function c(d,f,g,v,_,m){let p=a(d,f,g,v,_,m);(g.transparent===!0?i:n).unshift(p)}function u(d,f){n.length>1&&n.sort(d||w0),i.length>1&&i.sort(f||b0)}function h(){for(let d=t,f=e.length;d<f;d++){let g=e[d];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.program=null,g.group=null}}return{opaque:n,transparent:i,init:o,push:l,unshift:c,finish:h,sort:u}}function M0(r){let e=new WeakMap;function t(i,s){let o;return e.has(i)===!1?(o=new eu(r),e.set(i,[o])):s>=e.get(i).length?(o=new eu(r),e.get(i).push(o)):o=e.get(i)[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}function S0(){let r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new T,color:new pe};break;case"SpotLight":t={position:new T,direction:new T,color:new pe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new T,color:new pe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new T,skyColor:new pe,groundColor:new pe};break;case"RectAreaLight":t={color:new pe,position:new T,halfWidth:new T,halfHeight:new T};break}return r[e.id]=t,t}}}function T0(){let r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new te};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new te};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new te,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[e.id]=t,t}}}var E0=0;function A0(r,e){return(e.castShadow?1:0)-(r.castShadow?1:0)}function L0(r,e){let t=new S0,n=T0(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotShadow:[],spotShadowMap:[],spotShadowMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[]};for(let u=0;u<9;u++)i.probe.push(new T);let s=new T,o=new De,a=new De;function l(u){let h=0,d=0,f=0;for(let I=0;I<9;I++)i.probe[I].set(0,0,0);let g=0,v=0,_=0,m=0,p=0,L=0,A=0,C=0;u.sort(A0);for(let I=0,N=u.length;I<N;I++){let k=u[I],V=k.color,X=k.intensity,W=k.distance,R=k.shadow&&k.shadow.map?k.shadow.map.texture:null;if(k.isAmbientLight)h+=V.r*X,d+=V.g*X,f+=V.b*X;else if(k.isLightProbe)for(let U=0;U<9;U++)i.probe[U].addScaledVector(k.sh.coefficients[U],X);else if(k.isDirectionalLight){let U=t.get(k);if(U.color.copy(k.color).multiplyScalar(k.intensity),k.castShadow){let O=k.shadow,z=n.get(k);z.shadowBias=O.bias,z.shadowNormalBias=O.normalBias,z.shadowRadius=O.radius,z.shadowMapSize=O.mapSize,i.directionalShadow[g]=z,i.directionalShadowMap[g]=R,i.directionalShadowMatrix[g]=k.shadow.matrix,L++}i.directional[g]=U,g++}else if(k.isSpotLight){let U=t.get(k);if(U.position.setFromMatrixPosition(k.matrixWorld),U.color.copy(V).multiplyScalar(X),U.distance=W,U.coneCos=Math.cos(k.angle),U.penumbraCos=Math.cos(k.angle*(1-k.penumbra)),U.decay=k.decay,k.castShadow){let O=k.shadow,z=n.get(k);z.shadowBias=O.bias,z.shadowNormalBias=O.normalBias,z.shadowRadius=O.radius,z.shadowMapSize=O.mapSize,i.spotShadow[_]=z,i.spotShadowMap[_]=R,i.spotShadowMatrix[_]=k.shadow.matrix,C++}i.spot[_]=U,_++}else if(k.isRectAreaLight){let U=t.get(k);U.color.copy(V).multiplyScalar(X),U.halfWidth.set(k.width*.5,0,0),U.halfHeight.set(0,k.height*.5,0),i.rectArea[m]=U,m++}else if(k.isPointLight){let U=t.get(k);if(U.color.copy(k.color).multiplyScalar(k.intensity),U.distance=k.distance,U.decay=k.decay,k.castShadow){let O=k.shadow,z=n.get(k);z.shadowBias=O.bias,z.shadowNormalBias=O.normalBias,z.shadowRadius=O.radius,z.shadowMapSize=O.mapSize,z.shadowCameraNear=O.camera.near,z.shadowCameraFar=O.camera.far,i.pointShadow[v]=z,i.pointShadowMap[v]=R,i.pointShadowMatrix[v]=k.shadow.matrix,A++}i.point[v]=U,v++}else if(k.isHemisphereLight){let U=t.get(k);U.skyColor.copy(k.color).multiplyScalar(X),U.groundColor.copy(k.groundColor).multiplyScalar(X),i.hemi[p]=U,p++}}m>0&&(e.isWebGL2||r.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ve.LTC_FLOAT_1,i.rectAreaLTC2=ve.LTC_FLOAT_2):r.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=ve.LTC_HALF_1,i.rectAreaLTC2=ve.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=h,i.ambient[1]=d,i.ambient[2]=f;let b=i.hash;(b.directionalLength!==g||b.pointLength!==v||b.spotLength!==_||b.rectAreaLength!==m||b.hemiLength!==p||b.numDirectionalShadows!==L||b.numPointShadows!==A||b.numSpotShadows!==C)&&(i.directional.length=g,i.spot.length=_,i.rectArea.length=m,i.point.length=v,i.hemi.length=p,i.directionalShadow.length=L,i.directionalShadowMap.length=L,i.pointShadow.length=A,i.pointShadowMap.length=A,i.spotShadow.length=C,i.spotShadowMap.length=C,i.directionalShadowMatrix.length=L,i.pointShadowMatrix.length=A,i.spotShadowMatrix.length=C,b.directionalLength=g,b.pointLength=v,b.spotLength=_,b.rectAreaLength=m,b.hemiLength=p,b.numDirectionalShadows=L,b.numPointShadows=A,b.numSpotShadows=C,i.version=E0++)}function c(u,h){let d=0,f=0,g=0,v=0,_=0,m=h.matrixWorldInverse;for(let p=0,L=u.length;p<L;p++){let A=u[p];if(A.isDirectionalLight){let C=i.directional[d];C.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),C.direction.sub(s),C.direction.transformDirection(m),d++}else if(A.isSpotLight){let C=i.spot[g];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),C.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),C.direction.sub(s),C.direction.transformDirection(m),g++}else if(A.isRectAreaLight){let C=i.rectArea[v];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),a.identity(),o.copy(A.matrixWorld),o.premultiply(m),a.extractRotation(o),C.halfWidth.set(A.width*.5,0,0),C.halfHeight.set(0,A.height*.5,0),C.halfWidth.applyMatrix4(a),C.halfHeight.applyMatrix4(a),v++}else if(A.isPointLight){let C=i.point[f];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),f++}else if(A.isHemisphereLight){let C=i.hemi[_];C.direction.setFromMatrixPosition(A.matrixWorld),C.direction.transformDirection(m),C.direction.normalize(),_++}}}return{setup:l,setupView:c,state:i}}function tu(r,e){let t=new L0(r,e),n=[],i=[];function s(){n.length=0,i.length=0}function o(h){n.push(h)}function a(h){i.push(h)}function l(){t.setup(n)}function c(h){t.setupView(n,h)}return{init:s,state:{lightsArray:n,shadowsArray:i,lights:t},setupLights:l,setupLightsView:c,pushLight:o,pushShadow:a}}function R0(r,e){let t=new WeakMap;function n(s,o=0){let a;return t.has(s)===!1?(a=new tu(r,e),t.set(s,[a])):o>=t.get(s).length?(a=new tu(r,e),t.get(s).push(a)):a=t.get(s)[o],a}function i(){t=new WeakMap}return{get:n,dispose:i}}var js=class extends ut{constructor(e){super(),this.type="MeshDepthMaterial",this.depthPacking=cf,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}};js.prototype.isMeshDepthMaterial=!0;var $s=class extends ut{constructor(e){super(),this.type="MeshDistanceMaterial",this.referencePosition=new T,this.nearDistance=1,this.farDistance=1e3,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.referencePosition.copy(e.referencePosition),this.nearDistance=e.nearDistance,this.farDistance=e.farDistance,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};$s.prototype.isMeshDistanceMaterial=!0;var C0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	float mean = 0.0;
	float squared_mean = 0.0;
	float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy ) / resolution ) );
	for ( float i = -1.0; i < 1.0 ; i += SAMPLE_RATE) {
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( i, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, i ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean * HALF_SAMPLE_RATE;
	squared_mean = squared_mean * HALF_SAMPLE_RATE;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`,P0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`;function Yu(r,e,t){let n=new Fi,i=new te,s=new te,o=new He,a=[],l=[],c={},u=t.maxTextureSize,h={0:ot,1:go,2:Rt},d=new qe({defines:{SAMPLE_RATE:2/8,HALF_SAMPLE_RATE:1/8},uniforms:{shadow_pass:{value:null},resolution:{value:new te},radius:{value:4}},vertexShader:P0,fragmentShader:C0}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let g=new Ge;g.setAttribute("position",new $e(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let v=new Oe(g,d),_=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Au,this.render=function(b,I,N){if(_.enabled===!1||_.autoUpdate===!1&&_.needsUpdate===!1||b.length===0)return;let k=r.getRenderTarget(),V=r.getActiveCubeFace(),X=r.getActiveMipmapLevel(),W=r.state;W.setBlending(pr),W.buffers.color.setClear(1,1,1,1),W.buffers.depth.setTest(!0),W.setScissorTest(!1);for(let R=0,U=b.length;R<U;R++){let O=b[R],z=O.shadow;if(z===void 0){console.warn("THREE.WebGLShadowMap:",O,"has no shadow.");continue}if(z.autoUpdate===!1&&z.needsUpdate===!1)continue;i.copy(z.mapSize);let $=z.getFrameExtents();if(i.multiply($),s.copy(z.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(s.x=Math.floor(u/$.x),i.x=s.x*$.x,z.mapSize.x=s.x),i.y>u&&(s.y=Math.floor(u/$.y),i.y=s.y*$.y,z.mapSize.y=s.y)),z.map===null&&!z.isPointLightShadow&&this.type===dr){let re={minFilter:vt,magFilter:vt,format:Zt};z.map=new jt(i.x,i.y,re),z.map.texture.name=O.name+".shadowMap",z.mapPass=new jt(i.x,i.y,re),z.camera.updateProjectionMatrix()}if(z.map===null){let re={minFilter:Mt,magFilter:Mt,format:Zt};z.map=new jt(i.x,i.y,re),z.map.texture.name=O.name+".shadowMap",z.camera.updateProjectionMatrix()}r.setRenderTarget(z.map),r.clear();let oe=z.getViewportCount();for(let re=0;re<oe;re++){let we=z.getViewport(re);o.set(s.x*we.x,s.y*we.y,s.x*we.z,s.y*we.w),W.viewport(o),z.updateMatrices(O,re),n=z.getFrustum(),C(I,N,z.camera,O,this.type)}!z.isPointLightShadow&&this.type===dr&&m(z,N),z.needsUpdate=!1}_.needsUpdate=!1,r.setRenderTarget(k,V,X)};function m(b,I){let N=e.update(v);d.uniforms.shadow_pass.value=b.map.texture,d.uniforms.resolution.value=b.mapSize,d.uniforms.radius.value=b.radius,r.setRenderTarget(b.mapPass),r.clear(),r.renderBufferDirect(I,null,N,d,v,null),f.uniforms.shadow_pass.value=b.mapPass.texture,f.uniforms.resolution.value=b.mapSize,f.uniforms.radius.value=b.radius,r.setRenderTarget(b.map),r.clear(),r.renderBufferDirect(I,null,N,f,v,null)}function p(b,I,N){let k=b<<0|I<<1|N<<2,V=a[k];return V===void 0&&(V=new js({depthPacking:uf,morphTargets:b,skinning:I}),a[k]=V),V}function L(b,I,N){let k=b<<0|I<<1|N<<2,V=l[k];return V===void 0&&(V=new $s({morphTargets:b,skinning:I}),l[k]=V),V}function A(b,I,N,k,V,X,W){let R=null,U=p,O=b.customDepthMaterial;if(k.isPointLight===!0&&(U=L,O=b.customDistanceMaterial),O===void 0){let z=!1;N.morphTargets===!0&&(z=I.morphAttributes&&I.morphAttributes.position&&I.morphAttributes.position.length>0);let $=!1;b.isSkinnedMesh===!0&&(N.skinning===!0?$=!0:console.warn("THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false:",b));let oe=b.isInstancedMesh===!0;R=U(z,$,oe)}else R=O;if(r.localClippingEnabled&&N.clipShadows===!0&&N.clippingPlanes.length!==0){let z=R.uuid,$=N.uuid,oe=c[z];oe===void 0&&(oe={},c[z]=oe);let re=oe[$];re===void 0&&(re=R.clone(),oe[$]=re),R=re}return R.visible=N.visible,R.wireframe=N.wireframe,W===dr?R.side=N.shadowSide!==null?N.shadowSide:N.side:R.side=N.shadowSide!==null?N.shadowSide:h[N.side],R.clipShadows=N.clipShadows,R.clippingPlanes=N.clippingPlanes,R.clipIntersection=N.clipIntersection,R.wireframeLinewidth=N.wireframeLinewidth,R.linewidth=N.linewidth,k.isPointLight===!0&&R.isMeshDistanceMaterial===!0&&(R.referencePosition.setFromMatrixPosition(k.matrixWorld),R.nearDistance=V,R.farDistance=X),R}function C(b,I,N,k,V){if(b.visible===!1)return;if(b.layers.test(I.layers)&&(b.isMesh||b.isLine||b.isPoints)&&(b.castShadow||b.receiveShadow&&V===dr)&&(!b.frustumCulled||n.intersectsObject(b))){b.modelViewMatrix.multiplyMatrices(N.matrixWorldInverse,b.matrixWorld);let R=e.update(b),U=b.material;if(Array.isArray(U)){let O=R.groups;for(let z=0,$=O.length;z<$;z++){let oe=O[z],re=U[oe.materialIndex];if(re&&re.visible){let we=A(b,R,re,k,N.near,N.far,V);r.renderBufferDirect(N,null,R,we,b,oe)}}}else if(U.visible){let O=A(b,R,U,k,N.near,N.far,V);r.renderBufferDirect(N,null,R,O,b,null)}}let W=b.children;for(let R=0,U=W.length;R<U;R++)C(W[R],I,N,k,V)}}function D0(r,e,t){let n=t.isWebGL2;function i(){let B=!1,ue=new He,ge=null,Re=new He(0,0,0,0);return{setMask:function(ie){ge!==ie&&!B&&(r.colorMask(ie,ie,ie,ie),ge=ie)},setLocked:function(ie){B=ie},setClear:function(ie,Pe,ke,et,en){en===!0&&(ie*=et,Pe*=et,ke*=et),ue.set(ie,Pe,ke,et),Re.equals(ue)===!1&&(r.clearColor(ie,Pe,ke,et),Re.copy(ue))},reset:function(){B=!1,ge=null,Re.set(-1,0,0,0)}}}function s(){let B=!1,ue=null,ge=null,Re=null;return{setTest:function(ie){ie?Le(2929):Ce(2929)},setMask:function(ie){ue!==ie&&!B&&(r.depthMask(ie),ue=ie)},setFunc:function(ie){if(ge!==ie){if(ie)switch(ie){case $h:r.depthFunc(512);break;case Kh:r.depthFunc(519);break;case Qh:r.depthFunc(513);break;case xa:r.depthFunc(515);break;case ed:r.depthFunc(514);break;case td:r.depthFunc(518);break;case nd:r.depthFunc(516);break;case id:r.depthFunc(517);break;default:r.depthFunc(515)}else r.depthFunc(515);ge=ie}},setLocked:function(ie){B=ie},setClear:function(ie){Re!==ie&&(r.clearDepth(ie),Re=ie)},reset:function(){B=!1,ue=null,ge=null,Re=null}}}function o(){let B=!1,ue=null,ge=null,Re=null,ie=null,Pe=null,ke=null,et=null,en=null;return{setTest:function(Ke){B||(Ke?Le(2960):Ce(2960))},setMask:function(Ke){ue!==Ke&&!B&&(r.stencilMask(Ke),ue=Ke)},setFunc:function(Ke,wt,Et){(ge!==Ke||Re!==wt||ie!==Et)&&(r.stencilFunc(Ke,wt,Et),ge=Ke,Re=wt,ie=Et)},setOp:function(Ke,wt,Et){(Pe!==Ke||ke!==wt||et!==Et)&&(r.stencilOp(Ke,wt,Et),Pe=Ke,ke=wt,et=Et)},setLocked:function(Ke){B=Ke},setClear:function(Ke){en!==Ke&&(r.clearStencil(Ke),en=Ke)},reset:function(){B=!1,ue=null,ge=null,Re=null,ie=null,Pe=null,ke=null,et=null,en=null}}}let a=new i,l=new s,c=new o,u={},h=null,d={},f=null,g=!1,v=null,_=null,m=null,p=null,L=null,A=null,C=null,b=!1,I=null,N=null,k=null,V=null,X=null,W=r.getParameter(35661),R=!1,U=0,O=r.getParameter(7938);O.indexOf("WebGL")!==-1?(U=parseFloat(/^WebGL (\d)/.exec(O)[1]),R=U>=1):O.indexOf("OpenGL ES")!==-1&&(U=parseFloat(/^OpenGL ES (\d)/.exec(O)[1]),R=U>=2);let z=null,$={},oe=new He(0,0,r.canvas.width,r.canvas.height),re=new He(0,0,r.canvas.width,r.canvas.height);function we(B,ue,ge){let Re=new Uint8Array(4),ie=r.createTexture();r.bindTexture(B,ie),r.texParameteri(B,10241,9728),r.texParameteri(B,10240,9728);for(let Pe=0;Pe<ge;Pe++)r.texImage2D(ue+Pe,0,6408,1,1,0,6408,5121,Re);return ie}let xe={};xe[3553]=we(3553,3553,1),xe[34067]=we(34067,34069,6),a.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Le(2929),l.setFunc(xa),Te(!1),K(uc),Le(2884),me(pr);function Le(B){u[B]!==!0&&(r.enable(B),u[B]=!0)}function Ce(B){u[B]!==!1&&(r.disable(B),u[B]=!1)}function J(B){B!==h&&(r.bindFramebuffer(36160,B),h=B)}function Z(B,ue){ue===null&&h!==null&&(ue=h),d[B]!==ue&&(r.bindFramebuffer(B,ue),d[B]=ue,n&&(B===36009&&(d[36160]=ue),B===36160&&(d[36009]=ue)))}function ae(B){return f!==B?(r.useProgram(B),f=B,!0):!1}let ye={[Xt]:32774,[Gh]:32778,[Vh]:32779};if(n)ye[fc]=32775,ye[pc]=32776;else{let B=e.get("EXT_blend_minmax");B!==null&&(ye[fc]=B.MIN_EXT,ye[pc]=B.MAX_EXT)}let x={[Cl]:0,[$t]:1,[Wh]:768,[Ru]:770,[jh]:776,[Zh]:774,[Xh]:772,[qh]:769,[Wi]:771,[Jh]:775,[Yh]:773};function me(B,ue,ge,Re,ie,Pe,ke,et){if(B===pr){g===!0&&(Ce(3042),g=!1);return}if(g===!1&&(Le(3042),g=!0),B!==Vi){if(B!==v||et!==b){if((_!==Xt||L!==Xt)&&(r.blendEquation(32774),_=Xt,L=Xt),et)switch(B){case mr:r.blendFuncSeparate(1,771,1,771);break;case br:r.blendFunc(1,1);break;case hc:r.blendFuncSeparate(0,0,769,771);break;case dc:r.blendFuncSeparate(0,768,0,770);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}else switch(B){case mr:r.blendFuncSeparate(770,771,1,771);break;case br:r.blendFunc(770,1);break;case hc:r.blendFunc(0,769);break;case dc:r.blendFunc(0,768);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}m=null,p=null,A=null,C=null,v=B,b=et}return}ie=ie||ue,Pe=Pe||ge,ke=ke||Re,(ue!==_||ie!==L)&&(r.blendEquationSeparate(ye[ue],ye[ie]),_=ue,L=ie),(ge!==m||Re!==p||Pe!==A||ke!==C)&&(r.blendFuncSeparate(x[ge],x[Re],x[Pe],x[ke]),m=ge,p=Re,A=Pe,C=ke),v=B,b=null}function le(B,ue){B.side===Rt?Ce(2884):Le(2884);let ge=B.side===ot;ue&&(ge=!ge),Te(ge),B.blending===mr&&B.transparent===!1?me(pr):me(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.premultipliedAlpha),l.setFunc(B.depthFunc),l.setTest(B.depthTest),l.setMask(B.depthWrite),a.setMask(B.colorWrite);let Re=B.stencilWrite;c.setTest(Re),Re&&(c.setMask(B.stencilWriteMask),c.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),c.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),se(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?Le(32926):Ce(32926)}function Te(B){I!==B&&(B?r.frontFace(2304):r.frontFace(2305),I=B)}function K(B){B!==Oh?(Le(2884),B!==N&&(B===uc?r.cullFace(1029):B===Hh?r.cullFace(1028):r.cullFace(1032))):Ce(2884),N=B}function ee(B){B!==k&&(R&&r.lineWidth(B),k=B)}function se(B,ue,ge){B?(Le(32823),(V!==ue||X!==ge)&&(r.polygonOffset(ue,ge),V=ue,X=ge)):Ce(32823)}function be(B){B?Le(3089):Ce(3089)}function ne(B){B===void 0&&(B=33984+W-1),z!==B&&(r.activeTexture(B),z=B)}function E(B,ue){z===null&&ne();let ge=$[z];ge===void 0&&(ge={type:void 0,texture:void 0},$[z]=ge),(ge.type!==B||ge.texture!==ue)&&(r.bindTexture(B,ue||xe[B]),ge.type=B,ge.texture=ue)}function S(){let B=$[z];B!==void 0&&B.type!==void 0&&(r.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function j(){try{r.compressedTexImage2D.apply(r,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Q(){try{r.texImage2D.apply(r,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function _e(){try{r.texImage3D.apply(r,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Ee(B){oe.equals(B)===!1&&(r.scissor(B.x,B.y,B.z,B.w),oe.copy(B))}function Be(B){re.equals(B)===!1&&(r.viewport(B.x,B.y,B.z,B.w),re.copy(B))}function Fe(){r.disable(3042),r.disable(2884),r.disable(2929),r.disable(32823),r.disable(3089),r.disable(2960),r.disable(32926),r.blendEquation(32774),r.blendFunc(1,0),r.blendFuncSeparate(1,0,1,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(513),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(519,0,4294967295),r.stencilOp(7680,7680,7680),r.clearStencil(0),r.cullFace(1029),r.frontFace(2305),r.polygonOffset(0,0),r.activeTexture(33984),r.bindFramebuffer(36160,null),n===!0&&(r.bindFramebuffer(36009,null),r.bindFramebuffer(36008,null)),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),u={},z=null,$={},h=null,d={},f=null,g=!1,v=null,_=null,m=null,p=null,L=null,A=null,C=null,b=!1,I=null,N=null,k=null,V=null,X=null,oe.set(0,0,r.canvas.width,r.canvas.height),re.set(0,0,r.canvas.width,r.canvas.height),a.reset(),l.reset(),c.reset()}return{buffers:{color:a,depth:l,stencil:c},enable:Le,disable:Ce,bindFramebuffer:Z,bindXRFramebuffer:J,useProgram:ae,setBlending:me,setMaterial:le,setFlipSided:Te,setCullFace:K,setLineWidth:ee,setPolygonOffset:se,setScissorTest:be,activeTexture:ne,bindTexture:E,unbindTexture:S,compressedTexImage2D:j,texImage2D:Q,texImage3D:_e,scissor:Ee,viewport:Be,reset:Fe}}function F0(r,e,t,n,i,s,o){let a=i.isWebGL2,l=i.maxTextures,c=i.maxCubemapSize,u=i.maxTextureSize,h=i.maxSamples,d=new WeakMap,f,g=!1;try{g=typeof OffscreenCanvas!="undefined"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(E,S){return g?new OffscreenCanvas(E,S):document.createElementNS("http://www.w3.org/1999/xhtml","canvas")}function _(E,S,j,Q){let _e=1;if((E.width>Q||E.height>Q)&&(_e=Q/Math.max(E.width,E.height)),_e<1||S===!0)if(typeof HTMLImageElement!="undefined"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&E instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&E instanceof ImageBitmap){let Ee=S?mf:Math.floor,Be=Ee(_e*E.width),Fe=Ee(_e*E.height);f===void 0&&(f=v(Be,Fe));let B=j?v(Be,Fe):f;return B.width=Be,B.height=Fe,B.getContext("2d").drawImage(E,0,0,Be,Fe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+Be+"x"+Fe+")."),B}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E;return E}function m(E){return Cc(E.width)&&Cc(E.height)}function p(E){return a?!1:E.wrapS!==Yt||E.wrapT!==Yt||E.minFilter!==Mt&&E.minFilter!==vt}function L(E,S){return E.generateMipmaps&&S&&E.minFilter!==Mt&&E.minFilter!==vt}function A(E,S,j,Q){r.generateMipmap(E);let _e=n.get(S);_e.__maxMipLevel=Math.log2(Math.max(j,Q))}function C(E,S,j){if(a===!1)return S;if(E!==null){if(r[E]!==void 0)return r[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let Q=S;return S===6403&&(j===5126&&(Q=33326),j===5131&&(Q=33325),j===5121&&(Q=33321)),S===6407&&(j===5126&&(Q=34837),j===5131&&(Q=34843),j===5121&&(Q=32849)),S===6408&&(j===5126&&(Q=34836),j===5131&&(Q=34842),j===5121&&(Q=32856)),(Q===33325||Q===33326||Q===34842||Q===34836)&&e.get("EXT_color_buffer_float"),Q}function b(E){return E===Mt||E===vc||E===xc?9728:9729}function I(E){let S=E.target;S.removeEventListener("dispose",I),k(S),S.isVideoTexture&&d.delete(S),o.memory.textures--}function N(E){let S=E.target;S.removeEventListener("dispose",N),V(S),o.memory.textures--}function k(E){let S=n.get(E);S.__webglInit!==void 0&&(r.deleteTexture(S.__webglTexture),n.remove(E))}function V(E){let S=E.texture,j=n.get(E),Q=n.get(S);if(E){if(Q.__webglTexture!==void 0&&r.deleteTexture(Q.__webglTexture),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let _e=0;_e<6;_e++)r.deleteFramebuffer(j.__webglFramebuffer[_e]),j.__webglDepthbuffer&&r.deleteRenderbuffer(j.__webglDepthbuffer[_e]);else r.deleteFramebuffer(j.__webglFramebuffer),j.__webglDepthbuffer&&r.deleteRenderbuffer(j.__webglDepthbuffer),j.__webglMultisampledFramebuffer&&r.deleteFramebuffer(j.__webglMultisampledFramebuffer),j.__webglColorRenderbuffer&&r.deleteRenderbuffer(j.__webglColorRenderbuffer),j.__webglDepthRenderbuffer&&r.deleteRenderbuffer(j.__webglDepthRenderbuffer);n.remove(S),n.remove(E)}}let X=0;function W(){X=0}function R(){let E=X;return E>=l&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+l),X+=1,E}function U(E,S){let j=n.get(E);if(E.isVideoTexture&&K(E),E.version>0&&j.__version!==E.version){let Q=E.image;if(Q===void 0)console.warn("THREE.WebGLRenderer: Texture marked for update but image is undefined");else if(Q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Le(j,E,S);return}}t.activeTexture(33984+S),t.bindTexture(3553,j.__webglTexture)}function O(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Le(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(35866,j.__webglTexture)}function z(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Le(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(32879,j.__webglTexture)}function $(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Ce(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(34067,j.__webglTexture)}let oe={[Mr]:10497,[Yt]:33071,[Sr]:33648},re={[Mt]:9728,[vc]:9984,[xc]:9986,[vt]:9729,[hd]:9985,[ni]:9987};function we(E,S,j){if(j?(r.texParameteri(E,10242,oe[S.wrapS]),r.texParameteri(E,10243,oe[S.wrapT]),(E===32879||E===35866)&&r.texParameteri(E,32882,oe[S.wrapR]),r.texParameteri(E,10240,re[S.magFilter]),r.texParameteri(E,10241,re[S.minFilter])):(r.texParameteri(E,10242,33071),r.texParameteri(E,10243,33071),(E===32879||E===35866)&&r.texParameteri(E,32882,33071),(S.wrapS!==Yt||S.wrapT!==Yt)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),r.texParameteri(E,10240,b(S.magFilter)),r.texParameteri(E,10241,b(S.minFilter)),S.minFilter!==Mt&&S.minFilter!==vt&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),e.has("EXT_texture_filter_anisotropic")===!0){let Q=e.get("EXT_texture_filter_anisotropic");if(S.type===Fn&&e.has("OES_texture_float_linear")===!1||a===!1&&S.type===Hs&&e.has("OES_texture_half_float_linear")===!1)return;(S.anisotropy>1||n.get(S).__currentAnisotropy)&&(r.texParameterf(E,Q.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,i.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy)}}function xe(E,S){E.__webglInit===void 0&&(E.__webglInit=!0,S.addEventListener("dispose",I),E.__webglTexture=r.createTexture(),o.memory.textures++)}function Le(E,S,j){let Q=3553;S.isDataTexture2DArray&&(Q=35866),S.isDataTexture3D&&(Q=32879),xe(E,S),t.activeTexture(33984+j),t.bindTexture(Q,E.__webglTexture),r.pixelStorei(37440,S.flipY),r.pixelStorei(37441,S.premultiplyAlpha),r.pixelStorei(3317,S.unpackAlignment),r.pixelStorei(37443,0);let _e=p(S)&&m(S.image)===!1,Ee=_(S.image,_e,!1,u),Be=m(Ee)||a,Fe=s.convert(S.format),B=s.convert(S.type),ue=C(S.internalFormat,Fe,B);we(Q,S,Be);let ge,Re=S.mipmaps;if(S.isDepthTexture)ue=6402,a?S.type===Fn?ue=36012:S.type===Ns?ue=33190:S.type===vr?ue=35056:ue=33189:S.type===Fn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),S.format===Li&&ue===6402&&S.type!==Os&&S.type!==Ns&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),S.type=Os,B=s.convert(S.type)),S.format===Tr&&ue===6402&&(ue=34041,S.type!==vr&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),S.type=vr,B=s.convert(S.type))),t.texImage2D(3553,0,ue,Ee.width,Ee.height,0,Fe,B,null);else if(S.isDataTexture)if(Re.length>0&&Be){for(let ie=0,Pe=Re.length;ie<Pe;ie++)ge=Re[ie],t.texImage2D(3553,ie,ue,ge.width,ge.height,0,Fe,B,ge.data);S.generateMipmaps=!1,E.__maxMipLevel=Re.length-1}else t.texImage2D(3553,0,ue,Ee.width,Ee.height,0,Fe,B,Ee.data),E.__maxMipLevel=0;else if(S.isCompressedTexture){for(let ie=0,Pe=Re.length;ie<Pe;ie++)ge=Re[ie],S.format!==Zt&&S.format!==gn?Fe!==null?t.compressedTexImage2D(3553,ie,ue,ge.width,ge.height,0,ge.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):t.texImage2D(3553,ie,ue,ge.width,ge.height,0,Fe,B,ge.data);E.__maxMipLevel=Re.length-1}else if(S.isDataTexture2DArray)t.texImage3D(35866,0,ue,Ee.width,Ee.height,Ee.depth,0,Fe,B,Ee.data),E.__maxMipLevel=0;else if(S.isDataTexture3D)t.texImage3D(32879,0,ue,Ee.width,Ee.height,Ee.depth,0,Fe,B,Ee.data),E.__maxMipLevel=0;else if(Re.length>0&&Be){for(let ie=0,Pe=Re.length;ie<Pe;ie++)ge=Re[ie],t.texImage2D(3553,ie,ue,Fe,B,ge);S.generateMipmaps=!1,E.__maxMipLevel=Re.length-1}else t.texImage2D(3553,0,ue,Fe,B,Ee),E.__maxMipLevel=0;L(S,Be)&&A(Q,S,Ee.width,Ee.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function Ce(E,S,j){if(S.image.length!==6)return;xe(E,S),t.activeTexture(33984+j),t.bindTexture(34067,E.__webglTexture),r.pixelStorei(37440,S.flipY),r.pixelStorei(37441,S.premultiplyAlpha),r.pixelStorei(3317,S.unpackAlignment),r.pixelStorei(37443,0);let Q=S&&(S.isCompressedTexture||S.image[0].isCompressedTexture),_e=S.image[0]&&S.image[0].isDataTexture,Ee=[];for(let ie=0;ie<6;ie++)!Q&&!_e?Ee[ie]=_(S.image[ie],!1,!0,c):Ee[ie]=_e?S.image[ie].image:S.image[ie];let Be=Ee[0],Fe=m(Be)||a,B=s.convert(S.format),ue=s.convert(S.type),ge=C(S.internalFormat,B,ue);we(34067,S,Fe);let Re;if(Q){for(let ie=0;ie<6;ie++){Re=Ee[ie].mipmaps;for(let Pe=0;Pe<Re.length;Pe++){let ke=Re[Pe];S.format!==Zt&&S.format!==gn?B!==null?t.compressedTexImage2D(34069+ie,Pe,ge,ke.width,ke.height,0,ke.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):t.texImage2D(34069+ie,Pe,ge,ke.width,ke.height,0,B,ue,ke.data)}}E.__maxMipLevel=Re.length-1}else{Re=S.mipmaps;for(let ie=0;ie<6;ie++)if(_e){t.texImage2D(34069+ie,0,ge,Ee[ie].width,Ee[ie].height,0,B,ue,Ee[ie].data);for(let Pe=0;Pe<Re.length;Pe++){let et=Re[Pe].image[ie].image;t.texImage2D(34069+ie,Pe+1,ge,et.width,et.height,0,B,ue,et.data)}}else{t.texImage2D(34069+ie,0,ge,B,ue,Ee[ie]);for(let Pe=0;Pe<Re.length;Pe++){let ke=Re[Pe];t.texImage2D(34069+ie,Pe+1,ge,B,ue,ke.image[ie])}}E.__maxMipLevel=Re.length}L(S,Fe)&&A(34067,S,Be.width,Be.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function J(E,S,j,Q){let _e=S.texture,Ee=s.convert(_e.format),Be=s.convert(_e.type),Fe=C(_e.internalFormat,Ee,Be);Q===32879||Q===35866?t.texImage3D(Q,0,Fe,S.width,S.height,S.depth,0,Ee,Be,null):t.texImage2D(Q,0,Fe,S.width,S.height,0,Ee,Be,null),t.bindFramebuffer(36160,E),r.framebufferTexture2D(36160,j,Q,n.get(_e).__webglTexture,0),t.bindFramebuffer(36160,null)}function Z(E,S,j){if(r.bindRenderbuffer(36161,E),S.depthBuffer&&!S.stencilBuffer){let Q=33189;if(j){let _e=S.depthTexture;_e&&_e.isDepthTexture&&(_e.type===Fn?Q=36012:_e.type===Ns&&(Q=33190));let Ee=Te(S);r.renderbufferStorageMultisample(36161,Ee,Q,S.width,S.height)}else r.renderbufferStorage(36161,Q,S.width,S.height);r.framebufferRenderbuffer(36160,36096,36161,E)}else if(S.depthBuffer&&S.stencilBuffer){if(j){let Q=Te(S);r.renderbufferStorageMultisample(36161,Q,35056,S.width,S.height)}else r.renderbufferStorage(36161,34041,S.width,S.height);r.framebufferRenderbuffer(36160,33306,36161,E)}else{let Q=S.texture,_e=s.convert(Q.format),Ee=s.convert(Q.type),Be=C(Q.internalFormat,_e,Ee);if(j){let Fe=Te(S);r.renderbufferStorageMultisample(36161,Fe,Be,S.width,S.height)}else r.renderbufferStorage(36161,Be,S.width,S.height)}r.bindRenderbuffer(36161,null)}function ae(E,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(36160,E),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),U(S.depthTexture,0);let Q=n.get(S.depthTexture).__webglTexture;if(S.depthTexture.format===Li)r.framebufferTexture2D(36160,36096,3553,Q,0);else if(S.depthTexture.format===Tr)r.framebufferTexture2D(36160,33306,3553,Q,0);else throw new Error("Unknown depthTexture format")}function ye(E){let S=n.get(E),j=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture){if(j)throw new Error("target.depthTexture not supported in Cube render targets");ae(S.__webglFramebuffer,E)}else if(j){S.__webglDepthbuffer=[];for(let Q=0;Q<6;Q++)t.bindFramebuffer(36160,S.__webglFramebuffer[Q]),S.__webglDepthbuffer[Q]=r.createRenderbuffer(),Z(S.__webglDepthbuffer[Q],E,!1)}else t.bindFramebuffer(36160,S.__webglFramebuffer),S.__webglDepthbuffer=r.createRenderbuffer(),Z(S.__webglDepthbuffer,E,!1);t.bindFramebuffer(36160,null)}function x(E){let S=E.texture,j=n.get(E),Q=n.get(S);E.addEventListener("dispose",N),Q.__webglTexture=r.createTexture(),Q.__version=S.version,o.memory.textures++;let _e=E.isWebGLCubeRenderTarget===!0,Ee=E.isWebGLMultisampleRenderTarget===!0,Be=S.isDataTexture3D||S.isDataTexture2DArray,Fe=m(E)||a;if(a&&S.format===gn&&(S.type===Fn||S.type===Hs)&&(S.format=Zt,console.warn("THREE.WebGLRenderer: Rendering to textures with RGB format is not supported. Using RGBA format instead.")),_e){j.__webglFramebuffer=[];for(let B=0;B<6;B++)j.__webglFramebuffer[B]=r.createFramebuffer()}else if(j.__webglFramebuffer=r.createFramebuffer(),Ee)if(a){j.__webglMultisampledFramebuffer=r.createFramebuffer(),j.__webglColorRenderbuffer=r.createRenderbuffer(),r.bindRenderbuffer(36161,j.__webglColorRenderbuffer);let B=s.convert(S.format),ue=s.convert(S.type),ge=C(S.internalFormat,B,ue),Re=Te(E);r.renderbufferStorageMultisample(36161,Re,ge,E.width,E.height),t.bindFramebuffer(36160,j.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(36160,36064,36161,j.__webglColorRenderbuffer),r.bindRenderbuffer(36161,null),E.depthBuffer&&(j.__webglDepthRenderbuffer=r.createRenderbuffer(),Z(j.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(36160,null)}else console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.");if(_e){t.bindTexture(34067,Q.__webglTexture),we(34067,S,Fe);for(let B=0;B<6;B++)J(j.__webglFramebuffer[B],E,36064,34069+B);L(S,Fe)&&A(34067,S,E.width,E.height),t.bindTexture(34067,null)}else{let B=3553;Be&&(a?B=S.isDataTexture3D?32879:35866:console.warn("THREE.DataTexture3D and THREE.DataTexture2DArray only supported with WebGL2.")),t.bindTexture(B,Q.__webglTexture),we(B,S,Fe),J(j.__webglFramebuffer,E,36064,B),L(S,Fe)&&A(3553,S,E.width,E.height),t.bindTexture(3553,null)}E.depthBuffer&&ye(E)}function me(E){let S=E.texture,j=m(E)||a;if(L(S,j)){let Q=E.isWebGLCubeRenderTarget?34067:3553,_e=n.get(S).__webglTexture;t.bindTexture(Q,_e),A(Q,S,E.width,E.height),t.bindTexture(Q,null)}}function le(E){if(E.isWebGLMultisampleRenderTarget)if(a){let S=E.width,j=E.height,Q=16384;E.depthBuffer&&(Q|=256),E.stencilBuffer&&(Q|=1024);let _e=n.get(E);t.bindFramebuffer(36008,_e.__webglMultisampledFramebuffer),t.bindFramebuffer(36009,_e.__webglFramebuffer),r.blitFramebuffer(0,0,S,j,0,0,S,j,Q,9728),t.bindFramebuffer(36008,null),t.bindFramebuffer(36009,_e.__webglMultisampledFramebuffer)}else console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.")}function Te(E){return a&&E.isWebGLMultisampleRenderTarget?Math.min(h,E.samples):0}function K(E){let S=o.render.frame;d.get(E)!==S&&(d.set(E,S),E.update())}let ee=!1,se=!1;function be(E,S){E&&E.isWebGLRenderTarget&&(ee===!1&&(console.warn("THREE.WebGLTextures.safeSetTexture2D: don't use render targets as textures. Use their .texture property instead."),ee=!0),E=E.texture),U(E,S)}function ne(E,S){E&&E.isWebGLCubeRenderTarget&&(se===!1&&(console.warn("THREE.WebGLTextures.safeSetTextureCube: don't use cube render targets as textures. Use their .texture property instead."),se=!0),E=E.texture),$(E,S)}this.allocateTextureUnit=R,this.resetTextureUnits=W,this.setTexture2D=U,this.setTexture2DArray=O,this.setTexture3D=z,this.setTextureCube=$,this.setupRenderTarget=x,this.updateRenderTargetMipmap=me,this.updateMultisampleRenderTarget=le,this.safeSetTexture2D=be,this.safeSetTextureCube=ne}function I0(r,e,t){let n=t.isWebGL2;function i(s){let o;if(s===zl)return 5121;if(s===md)return 32819;if(s===gd)return 32820;if(s===vd)return 33635;if(s===dd)return 5120;if(s===fd)return 5122;if(s===Os)return 5123;if(s===pd)return 5124;if(s===Ns)return 5125;if(s===Fn)return 5126;if(s===Hs)return n?5131:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(s===xd)return 6406;if(s===gn)return 6407;if(s===Zt)return 6408;if(s===yd)return 6409;if(s===_d)return 6410;if(s===Li)return 6402;if(s===Tr)return 34041;if(s===wd)return 6403;if(s===bd)return 36244;if(s===Md)return 33319;if(s===Sd)return 33320;if(s===Td)return 36248;if(s===Ed)return 36249;if(s===yc||s===_c||s===wc||s===bc)if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(s===yc)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===_c)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===wc)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===bc)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===Mc||s===Sc||s===Tc||s===Ec)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(s===Mc)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===Sc)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===Tc)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===Ec)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===Ad)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if((s===Ac||s===Lc)&&(o=e.get("WEBGL_compressed_texture_etc"),o!==null)){if(s===Ac)return o.COMPRESSED_RGB8_ETC2;if(s===Lc)return o.COMPRESSED_RGBA8_ETC2_EAC}if(s===Ld||s===Rd||s===Cd||s===Pd||s===Dd||s===Fd||s===Id||s===zd||s===Bd||s===Nd||s===Ud||s===Od||s===Hd||s===kd||s===Vd||s===Wd||s===qd||s===Xd||s===Yd||s===Zd||s===Jd||s===jd||s===$d||s===Kd||s===Qd||s===ef||s===tf||s===nf)return o=e.get("WEBGL_compressed_texture_astc"),o!==null?s:null;if(s===Gd)return o=e.get("EXT_texture_compression_bptc"),o!==null?s:null;if(s===vr)return n?34042:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null)}return{convert:i}}var Ks=class extends ft{constructor(e=[]){super(),this.cameras=e}};Ks.prototype.isArrayCamera=!0;var je=class extends Xe{constructor(){super(),this.type="Group"}};je.prototype.isGroup=!0;var z0={type:"move"},xr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new je,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new je,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new T,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new T),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new je,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new T,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new T),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred")if(a!==null&&(i=t.getPose(e.targetRaySpace,n),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(z0))),c&&e.hand){o=!0;for(let v of e.hand.values()){let _=t.getJointPose(v,n);if(c.joints[v.jointName]===void 0){let p=new je;p.matrixAutoUpdate=!1,p.visible=!1,c.joints[v.jointName]=p,c.add(p)}let m=c.joints[v.jointName];_!==null&&(m.matrix.fromArray(_.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.jointRadius=_.radius),m.visible=_!==null}let u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));return a!==null&&(a.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}},Sa=class extends xn{constructor(e,t){super();let n=this,i=e.state,s=null,o=1,a=null,l="local-floor",c=null,u=[],h=new Map,d=new ft;d.layers.enable(1),d.viewport=new He;let f=new ft;f.layers.enable(2),f.viewport=new He;let g=[d,f],v=new Ks;v.layers.enable(1),v.layers.enable(2);let _=null,m=null;this.enabled=!1,this.isPresenting=!1,this.getController=function(W){let R=u[W];return R===void 0&&(R=new xr,u[W]=R),R.getTargetRaySpace()},this.getControllerGrip=function(W){let R=u[W];return R===void 0&&(R=new xr,u[W]=R),R.getGripSpace()},this.getHand=function(W){let R=u[W];return R===void 0&&(R=new xr,u[W]=R),R.getHandSpace()};function p(W){let R=h.get(W.inputSource);R&&R.dispatchEvent({type:W.type,data:W.inputSource})}function L(){h.forEach(function(W,R){W.disconnect(R)}),h.clear(),_=null,m=null,i.bindXRFramebuffer(null),e.setRenderTarget(e.getRenderTarget()),X.stop(),n.isPresenting=!1,n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(W){o=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(W){l=W,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return a},this.getSession=function(){return s},this.setSession=async function(W){if(s=W,s!==null){s.addEventListener("select",p),s.addEventListener("selectstart",p),s.addEventListener("selectend",p),s.addEventListener("squeeze",p),s.addEventListener("squeezestart",p),s.addEventListener("squeezeend",p),s.addEventListener("end",L),s.addEventListener("inputsourceschange",A);let R=t.getContextAttributes();R.xrCompatible!==!0&&await t.makeXRCompatible();let U={antialias:R.antialias,alpha:R.alpha,depth:R.depth,stencil:R.stencil,framebufferScaleFactor:o},O=new XRWebGLLayer(s,t,U);s.updateRenderState({baseLayer:O}),a=await s.requestReferenceSpace(l),X.setContext(s),X.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}};function A(W){let R=s.inputSources;for(let U=0;U<u.length;U++)h.set(R[U],u[U]);for(let U=0;U<W.removed.length;U++){let O=W.removed[U],z=h.get(O);z&&(z.dispatchEvent({type:"disconnected",data:O}),h.delete(O))}for(let U=0;U<W.added.length;U++){let O=W.added[U],z=h.get(O);z&&z.dispatchEvent({type:"connected",data:O})}}let C=new T,b=new T;function I(W,R,U){C.setFromMatrixPosition(R.matrixWorld),b.setFromMatrixPosition(U.matrixWorld);let O=C.distanceTo(b),z=R.projectionMatrix.elements,$=U.projectionMatrix.elements,oe=z[14]/(z[10]-1),re=z[14]/(z[10]+1),we=(z[9]+1)/z[5],xe=(z[9]-1)/z[5],Le=(z[8]-1)/z[0],Ce=($[8]+1)/$[0],J=oe*Le,Z=oe*Ce,ae=O/(-Le+Ce),ye=ae*-Le;R.matrixWorld.decompose(W.position,W.quaternion,W.scale),W.translateX(ye),W.translateZ(ae),W.matrixWorld.compose(W.position,W.quaternion,W.scale),W.matrixWorldInverse.copy(W.matrixWorld).invert();let x=oe+ae,me=re+ae,le=J-ye,Te=Z+(O-ye),K=we*re/me*x,ee=xe*re/me*x;W.projectionMatrix.makePerspective(le,Te,K,ee,x,me)}function N(W,R){R===null?W.matrixWorld.copy(W.matrix):W.matrixWorld.multiplyMatrices(R.matrixWorld,W.matrix),W.matrixWorldInverse.copy(W.matrixWorld).invert()}this.getCamera=function(W){v.near=f.near=d.near=W.near,v.far=f.far=d.far=W.far,(_!==v.near||m!==v.far)&&(s.updateRenderState({depthNear:v.near,depthFar:v.far}),_=v.near,m=v.far);let R=W.parent,U=v.cameras;N(v,R);for(let z=0;z<U.length;z++)N(U[z],R);W.matrixWorld.copy(v.matrixWorld),W.matrix.copy(v.matrix),W.matrix.decompose(W.position,W.quaternion,W.scale);let O=W.children;for(let z=0,$=O.length;z<$;z++)O[z].updateMatrixWorld(!0);return U.length===2?I(v,d,f):v.projectionMatrix.copy(d.projectionMatrix),v};let k=null;function V(W,R){if(c=R.getViewerPose(a),c!==null){let O=c.views,z=s.renderState.baseLayer;i.bindXRFramebuffer(z.framebuffer);let $=!1;O.length!==v.cameras.length&&(v.cameras.length=0,$=!0);for(let oe=0;oe<O.length;oe++){let re=O[oe],we=z.getViewport(re),xe=g[oe];xe.matrix.fromArray(re.transform.matrix),xe.projectionMatrix.fromArray(re.projectionMatrix),xe.viewport.set(we.x,we.y,we.width,we.height),oe===0&&v.matrix.copy(xe.matrix),$===!0&&v.cameras.push(xe)}}let U=s.inputSources;for(let O=0;O<u.length;O++){let z=u[O],$=U[O];z.update($,R,a)}k&&k(W,R)}let X=new Ou;X.setAnimationLoop(V),this.setAnimationLoop=function(W){k=W},this.dispose=function(){}}};function B0(r){function e(m,p){m.fogColor.value.copy(p.color),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function t(m,p,L,A){p.isMeshBasicMaterial?n(m,p):p.isMeshLambertMaterial?(n(m,p),l(m,p)):p.isMeshToonMaterial?(n(m,p),u(m,p)):p.isMeshPhongMaterial?(n(m,p),c(m,p)):p.isMeshStandardMaterial?(n(m,p),p.isMeshPhysicalMaterial?d(m,p):h(m,p)):p.isMeshMatcapMaterial?(n(m,p),f(m,p)):p.isMeshDepthMaterial?(n(m,p),g(m,p)):p.isMeshDistanceMaterial?(n(m,p),v(m,p)):p.isMeshNormalMaterial?(n(m,p),_(m,p)):p.isLineBasicMaterial?(i(m,p),p.isLineDashedMaterial&&s(m,p)):p.isPointsMaterial?o(m,p,L,A):p.isSpriteMaterial?a(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function n(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap),p.specularMap&&(m.specularMap.value=p.specularMap);let L=r.get(p).envMap;if(L){m.envMap.value=L,m.flipEnvMap.value=L.isCubeTexture&&L._needsFlipEnvMap?-1:1,m.reflectivity.value=p.reflectivity,m.refractionRatio.value=p.refractionRatio;let b=r.get(L).__maxMipLevel;b!==void 0&&(m.maxMipLevel.value=b)}p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity);let A;p.map?A=p.map:p.specularMap?A=p.specularMap:p.displacementMap?A=p.displacementMap:p.normalMap?A=p.normalMap:p.bumpMap?A=p.bumpMap:p.roughnessMap?A=p.roughnessMap:p.metalnessMap?A=p.metalnessMap:p.alphaMap?A=p.alphaMap:p.emissiveMap?A=p.emissiveMap:p.clearcoatMap?A=p.clearcoatMap:p.clearcoatNormalMap?A=p.clearcoatNormalMap:p.clearcoatRoughnessMap&&(A=p.clearcoatRoughnessMap),A!==void 0&&(A.isWebGLRenderTarget&&(A=A.texture),A.matrixAutoUpdate===!0&&A.updateMatrix(),m.uvTransform.value.copy(A.matrix));let C;p.aoMap?C=p.aoMap:p.lightMap&&(C=p.lightMap),C!==void 0&&(C.isWebGLRenderTarget&&(C=C.texture),C.matrixAutoUpdate===!0&&C.updateMatrix(),m.uv2Transform.value.copy(C.matrix))}function i(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity}function s(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function o(m,p,L,A){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*L,m.scale.value=A*.5,p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap);let C;p.map?C=p.map:p.alphaMap&&(C=p.alphaMap),C!==void 0&&(C.matrixAutoUpdate===!0&&C.updateMatrix(),m.uvTransform.value.copy(C.matrix))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap);let L;p.map?L=p.map:p.alphaMap&&(L=p.alphaMap),L!==void 0&&(L.matrixAutoUpdate===!0&&L.updateMatrix(),m.uvTransform.value.copy(L.matrix))}function l(m,p){p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap)}function c(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function h(m,p){m.roughness.value=p.roughness,m.metalness.value=p.metalness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap),p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),r.get(p).envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function d(m,p){h(m,p),m.reflectivity.value=p.reflectivity,m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.sheen&&m.sheen.value.copy(p.sheen),p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap),p.clearcoatNormalMap&&(m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),m.clearcoatNormalMap.value=p.clearcoatNormalMap,p.side===ot&&m.clearcoatNormalScale.value.negate()),m.transmission.value=p.transmission,p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap)}function f(m,p){p.matcap&&(m.matcap.value=p.matcap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function g(m,p){p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function v(m,p){p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),m.referencePosition.value.copy(p.referencePosition),m.nearDistance.value=p.nearDistance,m.farDistance.value=p.farDistance}function _(m,p){p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===ot&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===ot&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}return{refreshFogUniforms:e,refreshMaterialUniforms:t}}function N0(){let r=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");return r.style.display="block",r}function Ye(r){r=r||{};let e=r.canvas!==void 0?r.canvas:N0(),t=r.context!==void 0?r.context:null,n=r.alpha!==void 0?r.alpha:!1,i=r.depth!==void 0?r.depth:!0,s=r.stencil!==void 0?r.stencil:!0,o=r.antialias!==void 0?r.antialias:!1,a=r.premultipliedAlpha!==void 0?r.premultipliedAlpha:!0,l=r.preserveDrawingBuffer!==void 0?r.preserveDrawingBuffer:!1,c=r.powerPreference!==void 0?r.powerPreference:"default",u=r.failIfMajorPerformanceCaveat!==void 0?r.failIfMajorPerformanceCaveat:!1,h=null,d=null,f=[],g=[];this.domElement=e,this.debug={checkShaderErrors:!0},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.gammaFactor=2,this.outputEncoding=qi,this.physicallyCorrectLights=!1,this.toneMapping=gr,this.toneMappingExposure=1;let v=this,_=!1,m=0,p=0,L=null,A=-1,C=null,b=new He,I=new He,N=null,k=e.width,V=e.height,X=1,W=null,R=null,U=new He(0,0,k,V),O=new He(0,0,k,V),z=!1,$=new Fi,oe=!1,re=!1,we=new De,xe=new T,Le={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Ce(){return L===null?X:1}let J=t;function Z(M,y){for(let w=0;w<M.length;w++){let D=M[w],P=e.getContext(D,y);if(P!==null)return P}return null}try{let M={alpha:n,depth:i,stencil:s,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:u};if(e.addEventListener("webglcontextlost",Pe,!1),e.addEventListener("webglcontextrestored",ke,!1),J===null){let y=["webgl2","webgl","experimental-webgl"];if(v.isWebGL1Renderer===!0&&y.shift(),J=Z(y,M),J===null)throw Z(y)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}J.getShaderPrecisionFormat===void 0&&(J.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}let ae,ye,x,me,le,Te,K,ee,se,be,ne,E,S,j,Q,_e,Ee,Be,Fe,B,ue,ge;function Re(){ae=new og(J),ye=new ig(J,ae,r),ae.init(ye),ue=new I0(J,ae,ye),x=new D0(J,ae,ye),me=new cg(J),le=new _0,Te=new F0(J,ae,x,le,ye,ue,me),K=new sg(v),ee=new Df(J,ye),ge=new tg(J,ae,ee,ye),se=new ag(J,ee,me,ge),be=new fg(J,se,ee,me),Be=new dg(J),Q=new rg(le),ne=new y0(v,K,ae,ye,ge,Q),E=new B0(le),S=new M0(le),j=new R0(ae,ye),Ee=new eg(v,K,x,be,a),_e=new Yu(v,be,ye),Fe=new ng(J,ae,me,ye),B=new lg(J,ae,me,ye),me.programs=ne.programs,v.capabilities=ye,v.extensions=ae,v.properties=le,v.renderLists=S,v.shadowMap=_e,v.state=x,v.info=me}Re();let ie=new Sa(v,J);this.xr=ie,this.getContext=function(){return J},this.getContextAttributes=function(){return J.getContextAttributes()},this.forceContextLoss=function(){let M=ae.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=ae.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return X},this.setPixelRatio=function(M){M!==void 0&&(X=M,this.setSize(k,V,!1))},this.getSize=function(M){return M===void 0&&(console.warn("WebGLRenderer: .getsize() now requires a Vector2 as an argument"),M=new te),M.set(k,V)},this.setSize=function(M,y,w){if(ie.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}k=M,V=y,e.width=Math.floor(M*X),e.height=Math.floor(y*X),w!==!1&&(e.style.width=M+"px",e.style.height=y+"px"),this.setViewport(0,0,M,y)},this.getDrawingBufferSize=function(M){return M===void 0&&(console.warn("WebGLRenderer: .getdrawingBufferSize() now requires a Vector2 as an argument"),M=new te),M.set(k*X,V*X).floor()},this.setDrawingBufferSize=function(M,y,w){k=M,V=y,X=w,e.width=Math.floor(M*w),e.height=Math.floor(y*w),this.setViewport(0,0,M,y)},this.getCurrentViewport=function(M){return M===void 0&&(console.warn("WebGLRenderer: .getCurrentViewport() now requires a Vector4 as an argument"),M=new He),M.copy(b)},this.getViewport=function(M){return M.copy(U)},this.setViewport=function(M,y,w,D){M.isVector4?U.set(M.x,M.y,M.z,M.w):U.set(M,y,w,D),x.viewport(b.copy(U).multiplyScalar(X).floor())},this.getScissor=function(M){return M.copy(O)},this.setScissor=function(M,y,w,D){M.isVector4?O.set(M.x,M.y,M.z,M.w):O.set(M,y,w,D),x.scissor(I.copy(O).multiplyScalar(X).floor())},this.getScissorTest=function(){return z},this.setScissorTest=function(M){x.setScissorTest(z=M)},this.setOpaqueSort=function(M){W=M},this.setTransparentSort=function(M){R=M},this.getClearColor=function(M){return M===void 0&&(console.warn("WebGLRenderer: .getClearColor() now requires a Color as an argument"),M=new pe),M.copy(Ee.getClearColor())},this.setClearColor=function(){Ee.setClearColor.apply(Ee,arguments)},this.getClearAlpha=function(){return Ee.getClearAlpha()},this.setClearAlpha=function(){Ee.setClearAlpha.apply(Ee,arguments)},this.clear=function(M,y,w){let D=0;(M===void 0||M)&&(D|=16384),(y===void 0||y)&&(D|=256),(w===void 0||w)&&(D|=1024),J.clear(D)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",Pe,!1),e.removeEventListener("webglcontextrestored",ke,!1),S.dispose(),j.dispose(),le.dispose(),K.dispose(),be.dispose(),ge.dispose(),ie.dispose(),ie.removeEventListener("sessionstart",Zr),ie.removeEventListener("sessionend",Jr),zt.stop()};function Pe(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),_=!0}function ke(){console.log("THREE.WebGLRenderer: Context Restored."),_=!1;let M=me.autoReset,y=_e.enabled,w=_e.autoUpdate,D=_e.needsUpdate,P=_e.type;Re(),me.autoReset=M,_e.enabled=y,_e.autoUpdate=w,_e.needsUpdate=D,_e.type=P}function et(M){let y=M.target;y.removeEventListener("dispose",et),en(y)}function en(M){Ke(M),le.remove(M)}function Ke(M){let y=le.get(M).programs;y!==void 0&&y.forEach(function(w){ne.releaseProgram(w)})}function wt(M,y){M.render(function(w){v.renderBufferImmediate(w,y)})}this.renderBufferImmediate=function(M,y){ge.initAttributes();let w=le.get(M);M.hasPositions&&!w.position&&(w.position=J.createBuffer()),M.hasNormals&&!w.normal&&(w.normal=J.createBuffer()),M.hasUvs&&!w.uv&&(w.uv=J.createBuffer()),M.hasColors&&!w.color&&(w.color=J.createBuffer());let D=y.getAttributes();M.hasPositions&&(J.bindBuffer(34962,w.position),J.bufferData(34962,M.positionArray,35048),ge.enableAttribute(D.position),J.vertexAttribPointer(D.position,3,5126,!1,0,0)),M.hasNormals&&(J.bindBuffer(34962,w.normal),J.bufferData(34962,M.normalArray,35048),ge.enableAttribute(D.normal),J.vertexAttribPointer(D.normal,3,5126,!1,0,0)),M.hasUvs&&(J.bindBuffer(34962,w.uv),J.bufferData(34962,M.uvArray,35048),ge.enableAttribute(D.uv),J.vertexAttribPointer(D.uv,2,5126,!1,0,0)),M.hasColors&&(J.bindBuffer(34962,w.color),J.bufferData(34962,M.colorArray,35048),ge.enableAttribute(D.color),J.vertexAttribPointer(D.color,3,5126,!1,0,0)),ge.disableUnusedAttributes(),J.drawArrays(4,0,M.count),M.count=0},this.renderBufferDirect=function(M,y,w,D,P,q){y===null&&(y=Le);let G=P.isMesh&&P.matrixWorld.determinant()<0,Y=$i(M,y,D,P);x.setMaterial(D,G);let de=w.index,fe=w.attributes.position;if(de===null){if(fe===void 0||fe.count===0)return}else if(de.count===0)return;let H=1;D.wireframe===!0&&(de=se.getWireframeAttribute(w),H=2),(D.morphTargets||D.morphNormals)&&Be.update(P,w,D,Y),ge.setup(P,D,Y,w,de);let he,ce=Fe;de!==null&&(he=ee.get(de),ce=B,ce.setIndex(he));let Me=de!==null?de.count:fe.count,Ae=w.drawRange.start*H,Ie=w.drawRange.count*H,Se=q!==null?q.start*H:0,Ne=q!==null?q.count*H:1/0,ze=Math.max(Ae,Se),st=Math.min(Me,Ae+Ie,Se+Ne)-1,it=Math.max(0,st-ze+1);if(it!==0){if(P.isMesh)D.wireframe===!0?(x.setLineWidth(D.wireframeLinewidth*Ce()),ce.setMode(1)):ce.setMode(4);else if(P.isLine){let lt=D.linewidth;lt===void 0&&(lt=1),x.setLineWidth(lt*Ce()),P.isLineSegments?ce.setMode(1):P.isLineLoop?ce.setMode(2):ce.setMode(3)}else P.isPoints?ce.setMode(0):P.isSprite&&ce.setMode(4);if(P.isInstancedMesh)ce.renderInstances(ze,it,P.count);else if(w.isInstancedBufferGeometry){let lt=Math.min(w.instanceCount,w._maxInstanceCount);ce.renderInstances(ze,it,lt)}else ce.render(ze,it)}},this.compile=function(M,y){d=j.get(M),d.init(),M.traverseVisible(function(w){w.isLight&&w.layers.test(y.layers)&&(d.pushLight(w),w.castShadow&&d.pushShadow(w))}),d.setupLights(),M.traverse(function(w){let D=w.material;if(D)if(Array.isArray(D))for(let P=0;P<D.length;P++){let q=D[P];ri(q,M,w)}else ri(D,M,w)})};let Et=null;function ji(M){Et&&Et(M)}function Zr(){zt.stop()}function Jr(){zt.start()}let zt=new Ou;zt.setAnimationLoop(ji),typeof window!="undefined"&&zt.setContext(window),this.setAnimationLoop=function(M){Et=M,ie.setAnimationLoop(M),M===null?zt.stop():zt.start()},ie.addEventListener("sessionstart",Zr),ie.addEventListener("sessionend",Jr),this.render=function(M,y){let w,D;if(arguments[2]!==void 0&&(console.warn("THREE.WebGLRenderer.render(): the renderTarget argument has been removed. Use .setRenderTarget() instead."),w=arguments[2]),arguments[3]!==void 0&&(console.warn("THREE.WebGLRenderer.render(): the forceClear argument has been removed. Use .clear() instead."),D=arguments[3]),y!==void 0&&y.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(_===!0)return;M.autoUpdate===!0&&M.updateMatrixWorld(),y.parent===null&&y.updateMatrixWorld(),ie.enabled===!0&&ie.isPresenting===!0&&(y=ie.getCamera(y)),M.isScene===!0&&M.onBeforeRender(v,M,y,w||L),d=j.get(M,g.length),d.init(),g.push(d),we.multiplyMatrices(y.projectionMatrix,y.matrixWorldInverse),$.setFromProjectionMatrix(we),re=this.localClippingEnabled,oe=Q.init(this.clippingPlanes,re,y),h=S.get(M,f.length),h.init(),f.push(h),jr(M,y,0,v.sortObjects),h.finish(),v.sortObjects===!0&&h.sort(W,R),oe===!0&&Q.beginShadows();let P=d.state.shadowsArray;_e.render(P,M,y),d.setupLights(),d.setupLightsView(y),oe===!0&&Q.endShadows(),this.info.autoReset===!0&&this.info.reset(),w!==void 0&&this.setRenderTarget(w),Ee.render(h,M,y,D);let q=h.opaque,G=h.transparent;q.length>0&&$r(q,M,y),G.length>0&&$r(G,M,y),L!==null&&(Te.updateRenderTargetMipmap(L),Te.updateMultisampleRenderTarget(L)),M.isScene===!0&&M.onAfterRender(v,M,y),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1),ge.resetDefaultState(),A=-1,C=null,g.pop(),g.length>0?d=g[g.length-1]:d=null,f.pop(),f.length>0?h=f[f.length-1]:h=null};function jr(M,y,w,D){if(M.visible===!1)return;if(M.layers.test(y.layers)){if(M.isGroup)w=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(y);else if(M.isLight)d.pushLight(M),M.castShadow&&d.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||$.intersectsSprite(M)){D&&xe.setFromMatrixPosition(M.matrixWorld).applyMatrix4(we);let G=be.update(M),Y=M.material;Y.visible&&h.push(M,G,Y,w,xe.z,null)}}else if(M.isImmediateRenderObject)D&&xe.setFromMatrixPosition(M.matrixWorld).applyMatrix4(we),h.push(M,null,M.material,w,xe.z,null);else if((M.isMesh||M.isLine||M.isPoints)&&(M.isSkinnedMesh&&M.skeleton.frame!==me.render.frame&&(M.skeleton.update(),M.skeleton.frame=me.render.frame),!M.frustumCulled||$.intersectsObject(M))){D&&xe.setFromMatrixPosition(M.matrixWorld).applyMatrix4(we);let G=be.update(M),Y=M.material;if(Array.isArray(Y)){let de=G.groups;for(let fe=0,H=de.length;fe<H;fe++){let he=de[fe],ce=Y[he.materialIndex];ce&&ce.visible&&h.push(M,G,ce,w,xe.z,he)}}else Y.visible&&h.push(M,G,Y,w,xe.z,null)}}let q=M.children;for(let G=0,Y=q.length;G<Y;G++)jr(q[G],y,w,D)}function $r(M,y,w){let D=y.isScene===!0?y.overrideMaterial:null;for(let P=0,q=M.length;P<q;P++){let G=M[P],Y=G.object,de=G.geometry,fe=D===null?G.material:D,H=G.group;if(w.isArrayCamera){let he=w.cameras;for(let ce=0,Me=he.length;ce<Me;ce++){let Ae=he[ce];Y.layers.test(Ae.layers)&&(x.viewport(b.copy(Ae.viewport)),d.setupLightsView(Ae),ht(Y,y,Ae,de,fe,H))}}else ht(Y,y,w,de,fe,H)}}function ht(M,y,w,D,P,q){if(M.onBeforeRender(v,y,w,D,P,q),M.modelViewMatrix.multiplyMatrices(w.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),M.isImmediateRenderObject){let G=$i(w,y,P,M);x.setMaterial(P),ge.reset(),wt(M,G)}else v.renderBufferDirect(w,y,D,P,M,q);M.onAfterRender(v,y,w,D,P,q)}function ri(M,y,w){y.isScene!==!0&&(y=Le);let D=le.get(M),P=d.state.lights,q=d.state.shadowsArray,G=P.state.version,Y=ne.getParameters(M,P.state,q,y,w),de=ne.getProgramCacheKey(Y),fe=D.programs;D.environment=M.isMeshStandardMaterial?y.environment:null,D.fog=y.fog,D.envMap=K.get(M.envMap||D.environment),fe===void 0&&(M.addEventListener("dispose",et),fe=new Map,D.programs=fe);let H=fe.get(de);if(H!==void 0){if(D.currentProgram===H&&D.lightsStateVersion===G)return Vn(M,Y),H}else Y.uniforms=ne.getUniforms(M),M.onBuild(Y,v),M.onBeforeCompile(Y,v),H=ne.acquireProgram(Y,de),fe.set(de,H),D.uniforms=Y.uniforms;let he=D.uniforms;(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(he.clippingPlanes=Q.uniform),Vn(M,Y),D.needsLights=To(M),D.lightsStateVersion=G,D.needsLights&&(he.ambientLightColor.value=P.state.ambient,he.lightProbe.value=P.state.probe,he.directionalLights.value=P.state.directional,he.directionalLightShadows.value=P.state.directionalShadow,he.spotLights.value=P.state.spot,he.spotLightShadows.value=P.state.spotShadow,he.rectAreaLights.value=P.state.rectArea,he.ltc_1.value=P.state.rectAreaLTC1,he.ltc_2.value=P.state.rectAreaLTC2,he.pointLights.value=P.state.point,he.pointLightShadows.value=P.state.pointShadow,he.hemisphereLights.value=P.state.hemi,he.directionalShadowMap.value=P.state.directionalShadowMap,he.directionalShadowMatrix.value=P.state.directionalShadowMatrix,he.spotShadowMap.value=P.state.spotShadowMap,he.spotShadowMatrix.value=P.state.spotShadowMatrix,he.pointShadowMap.value=P.state.pointShadowMap,he.pointShadowMatrix.value=P.state.pointShadowMatrix);let ce=H.getUniforms(),Me=In.seqWithValue(ce.seq,he);return D.currentProgram=H,D.uniformsList=Me,H}function Vn(M,y){let w=le.get(M);w.outputEncoding=y.outputEncoding,w.instancing=y.instancing,w.numClippingPlanes=y.numClippingPlanes,w.numIntersection=y.numClipIntersection,w.vertexAlphas=y.vertexAlphas}function $i(M,y,w,D){y.isScene!==!0&&(y=Le),Te.resetTextureUnits();let P=y.fog,q=w.isMeshStandardMaterial?y.environment:null,G=L===null?v.outputEncoding:L.texture.encoding,Y=K.get(w.envMap||q),de=w.vertexColors===!0&&D.geometry&&D.geometry.attributes.color&&D.geometry.attributes.color.itemSize===4,fe=le.get(w),H=d.state.lights;if(oe===!0&&(re===!0||M!==C)){let ze=M===C&&w.id===A;Q.setState(w,M,ze)}let he=!1;w.version===fe.__version?(fe.needsLights&&fe.lightsStateVersion!==H.state.version||fe.outputEncoding!==G||D.isInstancedMesh&&fe.instancing===!1||!D.isInstancedMesh&&fe.instancing===!0||fe.envMap!==Y||w.fog&&fe.fog!==P||fe.numClippingPlanes!==void 0&&(fe.numClippingPlanes!==Q.numPlanes||fe.numIntersection!==Q.numIntersection)||fe.vertexAlphas!==de)&&(he=!0):(he=!0,fe.__version=w.version);let ce=fe.currentProgram;he===!0&&(ce=ri(w,y,D));let Me=!1,Ae=!1,Ie=!1,Se=ce.getUniforms(),Ne=fe.uniforms;if(x.useProgram(ce.program)&&(Me=!0,Ae=!0,Ie=!0),w.id!==A&&(A=w.id,Ae=!0),Me||C!==M){if(Se.setValue(J,"projectionMatrix",M.projectionMatrix),ye.logarithmicDepthBuffer&&Se.setValue(J,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),C!==M&&(C=M,Ae=!0,Ie=!0),w.isShaderMaterial||w.isMeshPhongMaterial||w.isMeshToonMaterial||w.isMeshStandardMaterial||w.envMap){let ze=Se.map.cameraPosition;ze!==void 0&&ze.setValue(J,xe.setFromMatrixPosition(M.matrixWorld))}(w.isMeshPhongMaterial||w.isMeshToonMaterial||w.isMeshLambertMaterial||w.isMeshBasicMaterial||w.isMeshStandardMaterial||w.isShaderMaterial)&&Se.setValue(J,"isOrthographic",M.isOrthographicCamera===!0),(w.isMeshPhongMaterial||w.isMeshToonMaterial||w.isMeshLambertMaterial||w.isMeshBasicMaterial||w.isMeshStandardMaterial||w.isShaderMaterial||w.isShadowMaterial||w.skinning)&&Se.setValue(J,"viewMatrix",M.matrixWorldInverse)}if(w.skinning){Se.setOptional(J,D,"bindMatrix"),Se.setOptional(J,D,"bindMatrixInverse");let ze=D.skeleton;if(ze){let st=ze.bones;if(ye.floatVertexTextures){if(ze.boneTexture===null){let it=Math.sqrt(st.length*4);it=pf(it),it=Math.max(it,4);let lt=new Float32Array(it*it*4);lt.set(ze.boneMatrices);let si=new Di(lt,it,it,Zt,Fn);ze.boneMatrices=lt,ze.boneTexture=si,ze.boneTextureSize=it}Se.setValue(J,"boneTexture",ze.boneTexture,Te),Se.setValue(J,"boneTextureSize",ze.boneTextureSize)}else Se.setOptional(J,ze,"boneMatrices")}}return(Ae||fe.receiveShadow!==D.receiveShadow)&&(fe.receiveShadow=D.receiveShadow,Se.setValue(J,"receiveShadow",D.receiveShadow)),Ae&&(Se.setValue(J,"toneMappingExposure",v.toneMappingExposure),fe.needsLights&&Kr(Ne,Ie),P&&w.fog&&E.refreshFogUniforms(Ne,P),E.refreshMaterialUniforms(Ne,w,X,V),In.upload(J,fe.uniformsList,Ne,Te)),w.isShaderMaterial&&w.uniformsNeedUpdate===!0&&(In.upload(J,fe.uniformsList,Ne,Te),w.uniformsNeedUpdate=!1),w.isSpriteMaterial&&Se.setValue(J,"center",D.center),Se.setValue(J,"modelViewMatrix",D.modelViewMatrix),Se.setValue(J,"normalMatrix",D.normalMatrix),Se.setValue(J,"modelMatrix",D.matrixWorld),ce}function Kr(M,y){M.ambientLightColor.needsUpdate=y,M.lightProbe.needsUpdate=y,M.directionalLights.needsUpdate=y,M.directionalLightShadows.needsUpdate=y,M.pointLights.needsUpdate=y,M.pointLightShadows.needsUpdate=y,M.spotLights.needsUpdate=y,M.spotLightShadows.needsUpdate=y,M.rectAreaLights.needsUpdate=y,M.hemisphereLights.needsUpdate=y}function To(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return m},this.getActiveMipmapLevel=function(){return p},this.getRenderTarget=function(){return L},this.setRenderTarget=function(M,y=0,w=0){L=M,m=y,p=w,M&&le.get(M).__webglFramebuffer===void 0&&Te.setupRenderTarget(M);let D=null,P=!1,q=!1;if(M){let G=M.texture;(G.isDataTexture3D||G.isDataTexture2DArray)&&(q=!0);let Y=le.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(D=Y[y],P=!0):M.isWebGLMultisampleRenderTarget?D=le.get(M).__webglMultisampledFramebuffer:D=Y,b.copy(M.viewport),I.copy(M.scissor),N=M.scissorTest}else b.copy(U).multiplyScalar(X).floor(),I.copy(O).multiplyScalar(X).floor(),N=z;if(x.bindFramebuffer(36160,D),x.viewport(b),x.scissor(I),x.setScissorTest(N),P){let G=le.get(M.texture);J.framebufferTexture2D(36160,36064,34069+y,G.__webglTexture,w)}else if(q){let G=le.get(M.texture),Y=y||0;J.framebufferTextureLayer(36160,36064,G.__webglTexture,w||0,Y)}},this.readRenderTargetPixels=function(M,y,w,D,P,q,G){if(!(M&&M.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Y=le.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&G!==void 0&&(Y=Y[G]),Y){x.bindFramebuffer(36160,Y);try{let de=M.texture,fe=de.format,H=de.type;if(fe!==Zt&&ue.convert(fe)!==J.getParameter(35739)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}let he=H===Hs&&(ae.has("EXT_color_buffer_half_float")||ye.isWebGL2&&ae.has("EXT_color_buffer_float"));if(H!==zl&&ue.convert(H)!==J.getParameter(35738)&&!(H===Fn&&(ye.isWebGL2||ae.has("OES_texture_float")||ae.has("WEBGL_color_buffer_float")))&&!he){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}J.checkFramebufferStatus(36160)===36053?y>=0&&y<=M.width-D&&w>=0&&w<=M.height-P&&J.readPixels(y,w,D,P,ue.convert(fe),ue.convert(H),q):console.error("THREE.WebGLRenderer.readRenderTargetPixels: readPixels from renderTarget failed. Framebuffer not complete.")}finally{let de=L!==null?le.get(L).__webglFramebuffer:null;x.bindFramebuffer(36160,de)}}},this.copyFramebufferToTexture=function(M,y,w=0){let D=Math.pow(2,-w),P=Math.floor(y.image.width*D),q=Math.floor(y.image.height*D),G=ue.convert(y.format);Te.setTexture2D(y,0),J.copyTexImage2D(3553,w,G,M.x,M.y,P,q,0),x.unbindTexture()},this.copyTextureToTexture=function(M,y,w,D=0){let P=y.image.width,q=y.image.height,G=ue.convert(w.format),Y=ue.convert(w.type);Te.setTexture2D(w,0),J.pixelStorei(37440,w.flipY),J.pixelStorei(37441,w.premultiplyAlpha),J.pixelStorei(3317,w.unpackAlignment),y.isDataTexture?J.texSubImage2D(3553,D,M.x,M.y,P,q,G,Y,y.image.data):y.isCompressedTexture?J.compressedTexSubImage2D(3553,D,M.x,M.y,y.mipmaps[0].width,y.mipmaps[0].height,G,y.mipmaps[0].data):J.texSubImage2D(3553,D,M.x,M.y,G,Y,y.image),D===0&&w.generateMipmaps&&J.generateMipmap(3553),x.unbindTexture()},this.copyTextureToTexture3D=function(M,y,w,D,P=0){if(v.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}let{width:q,height:G,data:Y}=w.image,de=ue.convert(D.format),fe=ue.convert(D.type),H;if(D.isDataTexture3D)Te.setTexture3D(D,0),H=32879;else if(D.isDataTexture2DArray)Te.setTexture2DArray(D,0),H=35866;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}J.pixelStorei(37440,D.flipY),J.pixelStorei(37441,D.premultiplyAlpha),J.pixelStorei(3317,D.unpackAlignment);let he=J.getParameter(3314),ce=J.getParameter(32878),Me=J.getParameter(3316),Ae=J.getParameter(3315),Ie=J.getParameter(32877);J.pixelStorei(3314,q),J.pixelStorei(32878,G),J.pixelStorei(3316,M.min.x),J.pixelStorei(3315,M.min.y),J.pixelStorei(32877,M.min.z),J.texSubImage3D(H,P,y.x,y.y,y.z,M.max.x-M.min.x+1,M.max.y-M.min.y+1,M.max.z-M.min.z+1,de,fe,Y),J.pixelStorei(3314,he),J.pixelStorei(32878,ce),J.pixelStorei(3316,Me),J.pixelStorei(3315,Ae),J.pixelStorei(32877,Ie),P===0&&D.generateMipmaps&&J.generateMipmap(H),x.unbindTexture()},this.initTexture=function(M){Te.setTexture2D(M,0),x.unbindTexture()},this.resetState=function(){m=0,p=0,L=null,x.reset(),ge.reset()},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}var Ta=class extends Ye{};Ta.prototype.isWebGL1Renderer=!0;var Ea=class r{constructor(e,t=25e-5){this.name="",this.color=new pe(e),this.density=t}clone(){return new r(this.color,this.density)}toJSON(){return{type:"FogExp2",color:this.color.getHex(),density:this.density}}};Ea.prototype.isFogExp2=!0;var Aa=class r{constructor(e,t=1,n=1e3){this.name="",this.color=new pe(e),this.near=t,this.far=n}clone(){return new r(this.color,this.near,this.far)}toJSON(){return{type:"Fog",color:this.color.getHex(),near:this.near,far:this.far}}};Aa.prototype.isFog=!0;var $n=class extends Xe{constructor(){super(),this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.overrideMaterial=null,this.autoUpdate=!0,typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.autoUpdate=e.autoUpdate,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.background!==null&&(t.object.background=this.background.toJSON(e)),this.environment!==null&&(t.object.environment=this.environment.toJSON(e)),this.fog!==null&&(t.object.fog=this.fog.toJSON()),t}};$n.prototype.isScene=!0;var Kn=class r{constructor(e,t){this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Er,this.updateRange={offset:0,count:-1},this.version=0,this.uuid=Jt(),this.onUploadCallback=function(){}}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Jt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new r(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Jt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.prototype.slice.call(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}};Kn.prototype.isInterleavedBuffer=!0;var rt=new T,Pr=class r{constructor(e,t,n,i){this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i===!0}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)rt.x=this.getX(t),rt.y=this.getY(t),rt.z=this.getZ(t),rt.applyMatrix4(e),this.setXYZ(t,rt.x,rt.y,rt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)rt.x=this.getX(t),rt.y=this.getY(t),rt.z=this.getZ(t),rt.applyNormalMatrix(e),this.setXYZ(t,rt.x,rt.y,rt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)rt.x=this.getX(t),rt.y=this.getY(t),rt.z=this.getZ(t),rt.transformDirection(e),this.setXYZ(t,rt.x,rt.y,rt.z);return this}setX(e,t){return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){return this.data.array[e*this.data.stride+this.offset]}getY(e){return this.data.array[e*this.data.stride+this.offset+1]}getZ(e){return this.data.array[e*this.data.stride+this.offset+2]}getW(e){return this.data.array[e*this.data.stride+this.offset+3]}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interlaved buffer attribute will deinterleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new $e(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new r(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interlaved buffer attribute will deinterleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}};Pr.prototype.isInterleavedBufferAttribute=!0;var Ii=class extends ut{constructor(e){super(),this.type="SpriteMaterial",this.color=new pe(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this}};Ii.prototype.isSpriteMaterial=!0;var _i,ar=new T,wi=new T,bi=new T,Mi=new te,lr=new te,Zu=new De,Ss=new T,cr=new T,Ts=new T,nu=new te,ha=new te,iu=new te,Dr=class extends Xe{constructor(e){if(super(),this.type="Sprite",_i===void 0){_i=new Ge;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Kn(t,5);_i.setIndex([0,1,2,0,2,3]),_i.setAttribute("position",new Pr(n,3,0,!1)),_i.setAttribute("uv",new Pr(n,2,3,!1))}this.geometry=_i,this.material=e!==void 0?e:new Ii,this.center=new te(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),wi.setFromMatrixScale(this.matrixWorld),Zu.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),bi.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&wi.multiplyScalar(-bi.z);let n=this.material.rotation,i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));let o=this.center;Es(Ss.set(-.5,-.5,0),bi,o,wi,i,s),Es(cr.set(.5,-.5,0),bi,o,wi,i,s),Es(Ts.set(.5,.5,0),bi,o,wi,i,s),nu.set(0,0),ha.set(1,0),iu.set(1,1);let a=e.ray.intersectTriangle(Ss,cr,Ts,!1,ar);if(a===null&&(Es(cr.set(-.5,.5,0),bi,o,wi,i,s),ha.set(0,1),a=e.ray.intersectTriangle(Ss,Ts,cr,!1,ar),a===null))return;let l=e.ray.origin.distanceTo(ar);l<e.near||l>e.far||t.push({distance:l,point:ar.clone(),uv:xt.getUV(ar,Ss,cr,Ts,nu,ha,iu,new te),face:null,object:this})}copy(e){return super.copy(e),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};Dr.prototype.isSprite=!0;function Es(r,e,t,n,i,s){Mi.subVectors(r,t).addScalar(.5).multiply(n),i!==void 0?(lr.x=s*Mi.x-i*Mi.y,lr.y=i*Mi.x+s*Mi.y):lr.copy(Mi),r.copy(e),r.x+=lr.x,r.y+=lr.y,r.applyMatrix4(Zu)}var ru=new T,su=new He,ou=new He,U0=new T,au=new De,Qs=class extends Oe{constructor(e,t){super(e,t),this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new De,this.bindMatrixInverse=new De}copy(e){return super.copy(e),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,this}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new He,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.x=t.getX(n),e.y=t.getY(n),e.z=t.getZ(n),e.w=t.getW(n);let s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode==="attached"?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode==="detached"?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}boneTransform(e,t){let n=this.skeleton,i=this.geometry;su.fromBufferAttribute(i.attributes.skinIndex,e),ou.fromBufferAttribute(i.attributes.skinWeight,e),ru.fromBufferAttribute(i.attributes.position,e).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){let o=ou.getComponent(s);if(o!==0){let a=su.getComponent(s);au.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(U0.copy(ru).applyMatrix4(au),o)}}return t.applyMatrix4(this.bindMatrixInverse)}};Qs.prototype.isSkinnedMesh=!0;var La=class extends Xe{constructor(){super(),this.type="Bone"}};La.prototype.isBone=!0;var lu=new De,cu=new De,As=[],ur=new Oe,Ra=class extends Oe{constructor(e,t,n){super(e,t),this.instanceMatrix=new $e(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.frustumCulled=!1}copy(e){return super.copy(e),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}raycast(e,t){let n=this.matrixWorld,i=this.count;if(ur.geometry=this.geometry,ur.material=this.material,ur.material!==void 0)for(let s=0;s<i;s++){this.getMatrixAt(s,lu),cu.multiplyMatrices(n,lu),ur.matrixWorld=cu,ur.raycast(e,As);for(let o=0,a=As.length;o<a;o++){let l=As[o];l.instanceId=s,l.object=this,t.push(l)}As.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new $e(new Float32Array(this.count*3),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}};Ra.prototype.isInstancedMesh=!0;var Qn=class extends ut{constructor(e){super(),this.type="LineBasicMaterial",this.color=new pe(16777215),this.linewidth=1,this.linecap="round",this.linejoin="round",this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.morphTargets=e.morphTargets,this}};Qn.prototype.isLineBasicMaterial=!0;var uu=new T,hu=new T,du=new De,da=new Un,Ls=new Nn,Fr=class extends Xe{constructor(e=new Ge,t=new Qn){super(),this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),this.material=e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.isBufferGeometry)if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)uu.fromBufferAttribute(t,i-1),hu.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=uu.distanceTo(hu);e.setAttribute("lineDistance",new Ve(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else e.isGeometry&&console.error("THREE.Line.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ls.copy(n.boundingSphere),Ls.applyMatrix4(i),Ls.radius+=s,e.ray.intersectsSphere(Ls)===!1)return;du.copy(i).invert(),da.copy(e.ray).applyMatrix4(du);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=new T,u=new T,h=new T,d=new T,f=this.isLineSegments?2:1;if(n.isBufferGeometry){let g=n.index,_=n.attributes.position;if(g!==null){let m=Math.max(0,o.start),p=Math.min(g.count,o.start+o.count);for(let L=m,A=p-1;L<A;L+=f){let C=g.getX(L),b=g.getX(L+1);if(c.fromBufferAttribute(_,C),u.fromBufferAttribute(_,b),da.distanceSqToSegment(c,u,d,h)>l)continue;d.applyMatrix4(this.matrixWorld);let N=e.ray.origin.distanceTo(d);N<e.near||N>e.far||t.push({distance:N,point:h.clone().applyMatrix4(this.matrixWorld),index:L,face:null,faceIndex:null,object:this})}}else{let m=Math.max(0,o.start),p=Math.min(_.count,o.start+o.count);for(let L=m,A=p-1;L<A;L+=f){if(c.fromBufferAttribute(_,L),u.fromBufferAttribute(_,L+1),da.distanceSqToSegment(c,u,d,h)>l)continue;d.applyMatrix4(this.matrixWorld);let b=e.ray.origin.distanceTo(d);b<e.near||b>e.far||t.push({distance:b,point:h.clone().applyMatrix4(this.matrixWorld),index:L,face:null,faceIndex:null,object:this})}}}else n.isGeometry&&console.error("THREE.Line.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Line.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.")}}};Fr.prototype.isLine=!0;var fu=new T,pu=new T,Ir=class extends Fr{constructor(e,t){super(e,t),this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.isBufferGeometry)if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)fu.fromBufferAttribute(t,i),pu.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+fu.distanceTo(pu);e.setAttribute("lineDistance",new Ve(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else e.isGeometry&&console.error("THREE.LineSegments.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");return this}};Ir.prototype.isLineSegments=!0;var Ca=class extends Fr{constructor(e,t){super(e,t),this.type="LineLoop"}};Ca.prototype.isLineLoop=!0;var eo=class extends ut{constructor(e){super(),this.type="PointsMaterial",this.color=new pe(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.morphTargets=e.morphTargets,this}};eo.prototype.isPointsMaterial=!0;var mu=new De,Pa=new Un,Rs=new Nn,Cs=new T,zr=class extends Xe{constructor(e=new Ge,t=new eo){super(),this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),this.material=e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Rs.copy(n.boundingSphere),Rs.applyMatrix4(i),Rs.radius+=s,e.ray.intersectsSphere(Rs)===!1)return;mu.copy(i).invert(),Pa.copy(e.ray).applyMatrix4(mu);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a;if(n.isBufferGeometry){let c=n.index,h=n.attributes.position;if(c!==null){let d=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=d,v=f;g<v;g++){let _=c.getX(g);Cs.fromBufferAttribute(h,_),gu(Cs,_,l,i,e,t,this)}}else{let d=Math.max(0,o.start),f=Math.min(h.count,o.start+o.count);for(let g=d,v=f;g<v;g++)Cs.fromBufferAttribute(h,g),gu(Cs,g,l,i,e,t,this)}}else console.error("THREE.Points.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Points.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.")}}};zr.prototype.isPoints=!0;function gu(r,e,t,n,i,s,o){let a=Pa.distanceSqToPoint(r);if(a<t){let l=new T;Pa.closestPointToPoint(r,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,object:o})}}var Da=class extends yt{constructor(e,t,n,i,s,o,a,l,c){super(e,t,n,i,s,o,a,l,c),this.format=a!==void 0?a:gn,this.minFilter=o!==void 0?o:vt,this.magFilter=s!==void 0?s:vt,this.generateMipmaps=!1;let u=this;function h(){u.needsUpdate=!0,e.requestVideoFrameCallback(h)}"requestVideoFrameCallback"in e&&e.requestVideoFrameCallback(h)}clone(){return new this.constructor(this.image).copy(this)}update(){let e=this.image;"requestVideoFrameCallback"in e===!1&&e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}};Da.prototype.isVideoTexture=!0;var Fa=class extends yt{constructor(e,t,n,i,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,i,s,h,d),this.image={width:t,height:n},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}};Fa.prototype.isCompressedTexture=!0;var yn=class extends yt{constructor(e,t,n,i,s,o,a,l,c){super(e,t,n,i,s,o,a,l,c),this.needsUpdate=!0}};yn.prototype.isCanvasTexture=!0;var Ia=class extends yt{constructor(e,t,n,i,s,o,a,l,c,u){if(u=u!==void 0?u:Li,u!==Li&&u!==Tr)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===Li&&(n=Os),n===void 0&&u===Tr&&(n=vr),super(null,i,s,o,a,l,u,n,c),this.image={width:e,height:t},this.magFilter=a!==void 0?a:Mt,this.minFilter=l!==void 0?l:Mt,this.flipY=!1,this.generateMipmaps=!1}};Ia.prototype.isDepthTexture=!0;var On=class extends Ge{constructor(e=1,t=8,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let s=[],o=[],a=[],l=[],c=new T,u=new te;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){let f=n+h/t*i;c.x=e*Math.cos(f),c.y=e*Math.sin(f),o.push(c.x,c.y,c.z),a.push(0,0,1),u.x=(o[d]/e+1)/2,u.y=(o[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new Ve(o,3)),this.setAttribute("normal",new Ve(a,3)),this.setAttribute("uv",new Ve(l,2))}},Ft=class extends Ge{constructor(e=1,t=1,n=1,i=8,s=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:l};let c=this;i=Math.floor(i),s=Math.floor(s);let u=[],h=[],d=[],f=[],g=0,v=[],_=n/2,m=0;p(),o===!1&&(e>0&&L(!0),t>0&&L(!1)),this.setIndex(u),this.setAttribute("position",new Ve(h,3)),this.setAttribute("normal",new Ve(d,3)),this.setAttribute("uv",new Ve(f,2));function p(){let A=new T,C=new T,b=0,I=(t-e)/n;for(let N=0;N<=s;N++){let k=[],V=N/s,X=V*(t-e)+e;for(let W=0;W<=i;W++){let R=W/i,U=R*l+a,O=Math.sin(U),z=Math.cos(U);C.x=X*O,C.y=-V*n+_,C.z=X*z,h.push(C.x,C.y,C.z),A.set(O,I,z).normalize(),d.push(A.x,A.y,A.z),f.push(R,1-V),k.push(g++)}v.push(k)}for(let N=0;N<i;N++)for(let k=0;k<s;k++){let V=v[k][N],X=v[k+1][N],W=v[k+1][N+1],R=v[k][N+1];u.push(V,X,R),u.push(X,W,R),b+=6}c.addGroup(m,b,0),m+=b}function L(A){let C=g,b=new te,I=new T,N=0,k=A===!0?e:t,V=A===!0?1:-1;for(let W=1;W<=i;W++)h.push(0,_*V,0),d.push(0,V,0),f.push(.5,.5),g++;let X=g;for(let W=0;W<=i;W++){let U=W/i*l+a,O=Math.cos(U),z=Math.sin(U);I.x=k*z,I.y=_*V,I.z=k*O,h.push(I.x,I.y,I.z),d.push(0,V,0),b.x=O*.5+.5,b.y=z*.5*V+.5,f.push(b.x,b.y),g++}for(let W=0;W<i;W++){let R=C+W,U=X+W;A===!0?u.push(U,U+1,R):u.push(U+1,U,R),N+=3}c.addGroup(m,N,A===!0?1:2),m+=N}}};var Bv=new T,Nv=new T,Uv=new T,Ov=new xt;var O0={triangulate:function(r,e,t){t=t||2;let n=e&&e.length,i=n?e[0]*t:r.length,s=Ju(r,0,i,t,!0),o=[];if(!s||s.next===s.prev)return o;let a,l,c,u,h,d,f;if(n&&(s=W0(r,e,s,t)),r.length>80*t){a=c=r[0],l=u=r[1];for(let g=t;g<i;g+=t)h=r[g],d=r[g+1],h<a&&(a=h),d<l&&(l=d),h>c&&(c=h),d>u&&(u=d);f=Math.max(c-a,u-l),f=f!==0?1/f:0}return Br(s,o,t,a,l,f),o}};function Ju(r,e,t,n,i){let s,o;if(i===tv(r,e,t,n)>0)for(s=e;s<t;s+=n)o=vu(s,r[s],r[s+1],o);else for(s=t-n;s>=e;s-=n)o=vu(s,r[s],r[s+1],o);return o&&xo(o,o.next)&&(Ur(o),o=o.next),o}function Hn(r,e){if(!r)return r;e||(e=r);let t=r,n;do if(n=!1,!t.steiner&&(xo(t,t.next)||nt(t.prev,t,t.next)===0)){if(Ur(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function Br(r,e,t,n,i,s,o){if(!r)return;!o&&s&&J0(r,n,i,s);let a=r,l,c;for(;r.prev!==r.next;){if(l=r.prev,c=r.next,s?k0(r,n,i,s):H0(r)){e.push(l.i/t),e.push(r.i/t),e.push(c.i/t),Ur(r),r=c.next,a=c.next;continue}if(r=c,r===a){o?o===1?(r=G0(Hn(r),e,t),Br(r,e,t,n,i,s,2)):o===2&&V0(r,e,t,n,i,s):Br(Hn(r),e,t,n,i,s,1);break}}}function H0(r){let e=r.prev,t=r,n=r.next;if(nt(e,t,n)>=0)return!1;let i=r.next.next;for(;i!==r.prev;){if(Ai(e.x,e.y,t.x,t.y,n.x,n.y,i.x,i.y)&&nt(i.prev,i,i.next)>=0)return!1;i=i.next}return!0}function k0(r,e,t,n){let i=r.prev,s=r,o=r.next;if(nt(i,s,o)>=0)return!1;let a=i.x<s.x?i.x<o.x?i.x:o.x:s.x<o.x?s.x:o.x,l=i.y<s.y?i.y<o.y?i.y:o.y:s.y<o.y?s.y:o.y,c=i.x>s.x?i.x>o.x?i.x:o.x:s.x>o.x?s.x:o.x,u=i.y>s.y?i.y>o.y?i.y:o.y:s.y>o.y?s.y:o.y,h=za(a,l,e,t,n),d=za(c,u,e,t,n),f=r.prevZ,g=r.nextZ;for(;f&&f.z>=h&&g&&g.z<=d;){if(f!==r.prev&&f!==r.next&&Ai(i.x,i.y,s.x,s.y,o.x,o.y,f.x,f.y)&&nt(f.prev,f,f.next)>=0||(f=f.prevZ,g!==r.prev&&g!==r.next&&Ai(i.x,i.y,s.x,s.y,o.x,o.y,g.x,g.y)&&nt(g.prev,g,g.next)>=0))return!1;g=g.nextZ}for(;f&&f.z>=h;){if(f!==r.prev&&f!==r.next&&Ai(i.x,i.y,s.x,s.y,o.x,o.y,f.x,f.y)&&nt(f.prev,f,f.next)>=0)return!1;f=f.prevZ}for(;g&&g.z<=d;){if(g!==r.prev&&g!==r.next&&Ai(i.x,i.y,s.x,s.y,o.x,o.y,g.x,g.y)&&nt(g.prev,g,g.next)>=0)return!1;g=g.nextZ}return!0}function G0(r,e,t){let n=r;do{let i=n.prev,s=n.next.next;!xo(i,s)&&ju(i,n,n.next,s)&&Nr(i,s)&&Nr(s,i)&&(e.push(i.i/t),e.push(n.i/t),e.push(s.i/t),Ur(n),Ur(n.next),n=r=s),n=n.next}while(n!==r);return Hn(n)}function V0(r,e,t,n,i,s){let o=r;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&K0(o,a)){let l=$u(o,a);o=Hn(o,o.next),l=Hn(l,l.next),Br(o,e,t,n,i,s),Br(l,e,t,n,i,s);return}a=a.next}o=o.next}while(o!==r)}function W0(r,e,t,n){let i=[],s,o,a,l,c;for(s=0,o=e.length;s<o;s++)a=e[s]*n,l=s<o-1?e[s+1]*n:r.length,c=Ju(r,a,l,n,!1),c===c.next&&(c.steiner=!0),i.push($0(c));for(i.sort(q0),s=0;s<i.length;s++)X0(i[s],t),t=Hn(t,t.next);return t}function q0(r,e){return r.x-e.x}function X0(r,e){if(e=Y0(r,e),e){let t=$u(e,r);Hn(e,e.next),Hn(t,t.next)}}function Y0(r,e){let t=e,n=r.x,i=r.y,s=-1/0,o;do{if(i<=t.y&&i>=t.next.y&&t.next.y!==t.y){let d=t.x+(i-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=n&&d>s){if(s=d,d===n){if(i===t.y)return t;if(i===t.next.y)return t.next}o=t.x<t.next.x?t:t.next}}t=t.next}while(t!==e);if(!o)return null;if(n===s)return o;let a=o,l=o.x,c=o.y,u=1/0,h;t=o;do n>=t.x&&t.x>=l&&n!==t.x&&Ai(i<c?n:s,i,l,c,i<c?s:n,i,t.x,t.y)&&(h=Math.abs(i-t.y)/(n-t.x),Nr(t,r)&&(h<u||h===u&&(t.x>o.x||t.x===o.x&&Z0(o,t)))&&(o=t,u=h)),t=t.next;while(t!==a);return o}function Z0(r,e){return nt(r.prev,r,e.prev)<0&&nt(e.next,r,r.next)<0}function J0(r,e,t,n){let i=r;do i.z===null&&(i.z=za(i.x,i.y,e,t,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==r);i.prevZ.nextZ=null,i.prevZ=null,j0(i)}function j0(r){let e,t,n,i,s,o,a,l,c=1;do{for(t=r,r=null,s=null,o=0;t;){for(o++,n=t,a=0,e=0;e<c&&(a++,n=n.nextZ,!!n);e++);for(l=c;a>0||l>0&&n;)a!==0&&(l===0||!n||t.z<=n.z)?(i=t,t=t.nextZ,a--):(i=n,n=n.nextZ,l--),s?s.nextZ=i:r=i,i.prevZ=s,s=i;t=n}s.nextZ=null,c*=2}while(o>1);return r}function za(r,e,t,n,i){return r=32767*(r-t)*i,e=32767*(e-n)*i,r=(r|r<<8)&16711935,r=(r|r<<4)&252645135,r=(r|r<<2)&858993459,r=(r|r<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,r|e<<1}function $0(r){let e=r,t=r;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==r);return t}function Ai(r,e,t,n,i,s,o,a){return(i-o)*(e-a)-(r-o)*(s-a)>=0&&(r-o)*(n-a)-(t-o)*(e-a)>=0&&(t-o)*(s-a)-(i-o)*(n-a)>=0}function K0(r,e){return r.next.i!==e.i&&r.prev.i!==e.i&&!Q0(r,e)&&(Nr(r,e)&&Nr(e,r)&&ev(r,e)&&(nt(r.prev,r,e.prev)||nt(r,e.prev,e))||xo(r,e)&&nt(r.prev,r,r.next)>0&&nt(e.prev,e,e.next)>0)}function nt(r,e,t){return(e.y-r.y)*(t.x-e.x)-(e.x-r.x)*(t.y-e.y)}function xo(r,e){return r.x===e.x&&r.y===e.y}function ju(r,e,t,n){let i=Ds(nt(r,e,t)),s=Ds(nt(r,e,n)),o=Ds(nt(t,n,r)),a=Ds(nt(t,n,e));return!!(i!==s&&o!==a||i===0&&Ps(r,t,e)||s===0&&Ps(r,n,e)||o===0&&Ps(t,r,n)||a===0&&Ps(t,e,n))}function Ps(r,e,t){return e.x<=Math.max(r.x,t.x)&&e.x>=Math.min(r.x,t.x)&&e.y<=Math.max(r.y,t.y)&&e.y>=Math.min(r.y,t.y)}function Ds(r){return r>0?1:r<0?-1:0}function Q0(r,e){let t=r;do{if(t.i!==r.i&&t.next.i!==r.i&&t.i!==e.i&&t.next.i!==e.i&&ju(t,t.next,r,e))return!0;t=t.next}while(t!==r);return!1}function Nr(r,e){return nt(r.prev,r,r.next)<0?nt(r,e,r.next)>=0&&nt(r,r.prev,e)>=0:nt(r,e,r.prev)<0||nt(r,r.next,e)<0}function ev(r,e){let t=r,n=!1,i=(r.x+e.x)/2,s=(r.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&i<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==r);return n}function $u(r,e){let t=new Ba(r.i,r.x,r.y),n=new Ba(e.i,e.x,e.y),i=r.next,s=e.prev;return r.next=e,e.prev=r,t.next=i,i.prev=t,n.next=t,t.prev=n,s.next=n,n.prev=s,n}function vu(r,e,t,n){let i=new Ba(r,e,t);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Ur(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function Ba(r,e,t){this.i=r,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}function tv(r,e,t,n){let i=0;for(let s=e,o=t-n;s<t;s+=n)i+=(r[o]-r[s])*(r[s+1]+r[o+1]),o=s;return i}var vn=class r{static area(e){let t=e.length,n=0;for(let i=t-1,s=0;s<t;i=s++)n+=e[i].x*e[s].y-e[s].x*e[i].y;return n*.5}static isClockWise(e){return r.area(e)<0}static triangulateShape(e,t){let n=[],i=[],s=[];xu(e),yu(n,e);let o=e.length;t.forEach(xu);for(let l=0;l<t.length;l++)i.push(o),o+=t[l].length,yu(n,t[l]);let a=O0.triangulate(n,i);for(let l=0;l<a.length;l+=3)s.push(a.slice(l,l+3));return s}};function xu(r){let e=r.length;e>2&&r[e-1].equals(r[0])&&r.pop()}function yu(r,e){for(let t=0;t<e.length;t++)r.push(e[t].x),r.push(e[t].y)}var zi=class extends Ge{constructor(e,t){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,i=[],s=[];for(let a=0,l=e.length;a<l;a++){let c=e[a];o(c)}this.setAttribute("position",new Ve(i,3)),this.setAttribute("uv",new Ve(s,2)),this.computeVertexNormals();function o(a){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,u=t.steps!==void 0?t.steps:1,h=t.depth!==void 0?t.depth:100,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:6,g=t.bevelSize!==void 0?t.bevelSize:f-2,v=t.bevelOffset!==void 0?t.bevelOffset:0,_=t.bevelSegments!==void 0?t.bevelSegments:3,m=t.extrudePath,p=t.UVGenerator!==void 0?t.UVGenerator:nv;t.amount!==void 0&&(console.warn("THREE.ExtrudeBufferGeometry: amount has been renamed to depth."),h=t.amount);let L,A=!1,C,b,I,N;m&&(L=m.getSpacedPoints(u),A=!0,d=!1,C=m.computeFrenetFrames(u,!1),b=new T,I=new T,N=new T),d||(_=0,f=0,g=0,v=0);let k=a.extractPoints(c),V=k.shape,X=k.holes;if(!vn.isClockWise(V)){V=V.reverse();for(let K=0,ee=X.length;K<ee;K++){let se=X[K];vn.isClockWise(se)&&(X[K]=se.reverse())}}let R=vn.triangulateShape(V,X),U=V;for(let K=0,ee=X.length;K<ee;K++){let se=X[K];V=V.concat(se)}function O(K,ee,se){return ee||console.error("THREE.ExtrudeGeometry: vec does not exist"),ee.clone().multiplyScalar(se).add(K)}let z=V.length,$=R.length;function oe(K,ee,se){let be,ne,E,S=K.x-ee.x,j=K.y-ee.y,Q=se.x-K.x,_e=se.y-K.y,Ee=S*S+j*j,Be=S*_e-j*Q;if(Math.abs(Be)>Number.EPSILON){let Fe=Math.sqrt(Ee),B=Math.sqrt(Q*Q+_e*_e),ue=ee.x-j/Fe,ge=ee.y+S/Fe,Re=se.x-_e/B,ie=se.y+Q/B,Pe=((Re-ue)*_e-(ie-ge)*Q)/(S*_e-j*Q);be=ue+S*Pe-K.x,ne=ge+j*Pe-K.y;let ke=be*be+ne*ne;if(ke<=2)return new te(be,ne);E=Math.sqrt(ke/2)}else{let Fe=!1;S>Number.EPSILON?Q>Number.EPSILON&&(Fe=!0):S<-Number.EPSILON?Q<-Number.EPSILON&&(Fe=!0):Math.sign(j)===Math.sign(_e)&&(Fe=!0),Fe?(be=-j,ne=S,E=Math.sqrt(Ee)):(be=S,ne=j,E=Math.sqrt(Ee/2))}return new te(be/E,ne/E)}let re=[];for(let K=0,ee=U.length,se=ee-1,be=K+1;K<ee;K++,se++,be++)se===ee&&(se=0),be===ee&&(be=0),re[K]=oe(U[K],U[se],U[be]);let we=[],xe,Le=re.concat();for(let K=0,ee=X.length;K<ee;K++){let se=X[K];xe=[];for(let be=0,ne=se.length,E=ne-1,S=be+1;be<ne;be++,E++,S++)E===ne&&(E=0),S===ne&&(S=0),xe[be]=oe(se[be],se[E],se[S]);we.push(xe),Le=Le.concat(xe)}for(let K=0;K<_;K++){let ee=K/_,se=f*Math.cos(ee*Math.PI/2),be=g*Math.sin(ee*Math.PI/2)+v;for(let ne=0,E=U.length;ne<E;ne++){let S=O(U[ne],re[ne],be);ye(S.x,S.y,-se)}for(let ne=0,E=X.length;ne<E;ne++){let S=X[ne];xe=we[ne];for(let j=0,Q=S.length;j<Q;j++){let _e=O(S[j],xe[j],be);ye(_e.x,_e.y,-se)}}}let Ce=g+v;for(let K=0;K<z;K++){let ee=d?O(V[K],Le[K],Ce):V[K];A?(I.copy(C.normals[0]).multiplyScalar(ee.x),b.copy(C.binormals[0]).multiplyScalar(ee.y),N.copy(L[0]).add(I).add(b),ye(N.x,N.y,N.z)):ye(ee.x,ee.y,0)}for(let K=1;K<=u;K++)for(let ee=0;ee<z;ee++){let se=d?O(V[ee],Le[ee],Ce):V[ee];A?(I.copy(C.normals[K]).multiplyScalar(se.x),b.copy(C.binormals[K]).multiplyScalar(se.y),N.copy(L[K]).add(I).add(b),ye(N.x,N.y,N.z)):ye(se.x,se.y,h/u*K)}for(let K=_-1;K>=0;K--){let ee=K/_,se=f*Math.cos(ee*Math.PI/2),be=g*Math.sin(ee*Math.PI/2)+v;for(let ne=0,E=U.length;ne<E;ne++){let S=O(U[ne],re[ne],be);ye(S.x,S.y,h+se)}for(let ne=0,E=X.length;ne<E;ne++){let S=X[ne];xe=we[ne];for(let j=0,Q=S.length;j<Q;j++){let _e=O(S[j],xe[j],be);A?ye(_e.x,_e.y+L[u-1].y,L[u-1].x+se):ye(_e.x,_e.y,h+se)}}}J(),Z();function J(){let K=i.length/3;if(d){let ee=0,se=z*ee;for(let be=0;be<$;be++){let ne=R[be];x(ne[2]+se,ne[1]+se,ne[0]+se)}ee=u+_*2,se=z*ee;for(let be=0;be<$;be++){let ne=R[be];x(ne[0]+se,ne[1]+se,ne[2]+se)}}else{for(let ee=0;ee<$;ee++){let se=R[ee];x(se[2],se[1],se[0])}for(let ee=0;ee<$;ee++){let se=R[ee];x(se[0]+z*u,se[1]+z*u,se[2]+z*u)}}n.addGroup(K,i.length/3-K,0)}function Z(){let K=i.length/3,ee=0;ae(U,ee),ee+=U.length;for(let se=0,be=X.length;se<be;se++){let ne=X[se];ae(ne,ee),ee+=ne.length}n.addGroup(K,i.length/3-K,1)}function ae(K,ee){let se=K.length;for(;--se>=0;){let be=se,ne=se-1;ne<0&&(ne=K.length-1);for(let E=0,S=u+_*2;E<S;E++){let j=z*E,Q=z*(E+1),_e=ee+be+j,Ee=ee+ne+j,Be=ee+ne+Q,Fe=ee+be+Q;me(_e,Ee,Be,Fe)}}}function ye(K,ee,se){l.push(K),l.push(ee),l.push(se)}function x(K,ee,se){le(K),le(ee),le(se);let be=i.length/3,ne=p.generateTopUV(n,i,be-3,be-2,be-1);Te(ne[0]),Te(ne[1]),Te(ne[2])}function me(K,ee,se,be){le(K),le(ee),le(be),le(ee),le(se),le(be);let ne=i.length/3,E=p.generateSideWallUV(n,i,ne-6,ne-3,ne-2,ne-1);Te(E[0]),Te(E[1]),Te(E[3]),Te(E[1]),Te(E[2]),Te(E[3])}function le(K){i.push(l[K*3+0]),i.push(l[K*3+1]),i.push(l[K*3+2])}function Te(K){s.push(K.x),s.push(K.y)}}}toJSON(){let e=Ge.prototype.toJSON.call(this),t=this.parameters.shapes,n=this.parameters.options;return iv(t,n,e)}},nv={generateTopUV:function(r,e,t,n,i){let s=e[t*3],o=e[t*3+1],a=e[n*3],l=e[n*3+1],c=e[i*3],u=e[i*3+1];return[new te(s,o),new te(a,l),new te(c,u)]},generateSideWallUV:function(r,e,t,n,i,s){let o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[n*3],u=e[n*3+1],h=e[n*3+2],d=e[i*3],f=e[i*3+1],g=e[i*3+2],v=e[s*3],_=e[s*3+1],m=e[s*3+2];return Math.abs(a-u)<.01?[new te(o,1-l),new te(c,1-h),new te(d,1-g),new te(v,1-m)]:[new te(a,1-l),new te(u,1-h),new te(f,1-g),new te(_,1-m)]}};function iv(r,e,t){if(t.shapes=[],Array.isArray(r))for(let n=0,i=r.length;n<i;n++){let s=r[n];t.shapes.push(s.uuid)}else t.shapes.push(r.uuid);return e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var to=class extends Ge{constructor(e,t=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:i},t=Math.floor(t),i=bt(i,0,Math.PI*2);let s=[],o=[],a=[],l=1/t,c=new T,u=new te;for(let h=0;h<=t;h++){let d=n+h*l*i,f=Math.sin(d),g=Math.cos(d);for(let v=0;v<=e.length-1;v++)c.x=e[v].x*f,c.y=e[v].y,c.z=e[v].x*g,o.push(c.x,c.y,c.z),u.x=h/t,u.y=v/(e.length-1),a.push(u.x,u.y)}for(let h=0;h<t;h++)for(let d=0;d<e.length-1;d++){let f=d+h*e.length,g=f,v=f+e.length,_=f+e.length+1,m=f+1;s.push(g,v,m),s.push(v,_,m)}if(this.setIndex(s),this.setAttribute("position",new Ve(o,3)),this.setAttribute("uv",new Ve(a,2)),this.computeVertexNormals(),i===Math.PI*2){let h=this.attributes.normal.array,d=new T,f=new T,g=new T,v=t*e.length*3;for(let _=0,m=0;_<e.length;_++,m+=3)d.x=h[m+0],d.y=h[m+1],d.z=h[m+2],f.x=h[v+m+0],f.y=h[v+m+1],f.z=h[v+m+2],g.addVectors(d,f).normalize(),h[m+0]=h[v+m+0]=g.x,h[m+1]=h[v+m+1]=g.y,h[m+2]=h[v+m+2]=g.z}}};var Or=class extends Ge{constructor(e=.5,t=1,n=8,i=1,s=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:o},n=Math.max(3,n),i=Math.max(1,i);let a=[],l=[],c=[],u=[],h=e,d=(t-e)/i,f=new T,g=new te;for(let v=0;v<=i;v++){for(let _=0;_<=n;_++){let m=s+_/n*o;f.x=h*Math.cos(m),f.y=h*Math.sin(m),l.push(f.x,f.y,f.z),c.push(0,0,1),g.x=(f.x/t+1)/2,g.y=(f.y/t+1)/2,u.push(g.x,g.y)}h+=d}for(let v=0;v<i;v++){let _=v*(n+1);for(let m=0;m<n;m++){let p=m+_,L=p,A=p+n+1,C=p+n+2,b=p+1;a.push(L,A,b),a.push(A,C,b)}}this.setIndex(a),this.setAttribute("position",new Ve(l,3)),this.setAttribute("normal",new Ve(c,3)),this.setAttribute("uv",new Ve(u,2))}},Na=class extends Ge{constructor(e,t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],i=[],s=[],o=[],a=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let u=0;u<e.length;u++)c(e[u]),this.addGroup(a,l,u),a+=l,l=0;this.setIndex(n),this.setAttribute("position",new Ve(i,3)),this.setAttribute("normal",new Ve(s,3)),this.setAttribute("uv",new Ve(o,2));function c(u){let h=i.length/3,d=u.extractPoints(t),f=d.shape,g=d.holes;vn.isClockWise(f)===!1&&(f=f.reverse());for(let _=0,m=g.length;_<m;_++){let p=g[_];vn.isClockWise(p)===!0&&(g[_]=p.reverse())}let v=vn.triangulateShape(f,g);for(let _=0,m=g.length;_<m;_++){let p=g[_];f=f.concat(p)}for(let _=0,m=f.length;_<m;_++){let p=f[_];i.push(p.x,p.y,0),s.push(0,0,1),o.push(p.x,p.y)}for(let _=0,m=v.length;_<m;_++){let p=v[_],L=p[0]+h,A=p[1]+h,C=p[2]+h;n.push(L,A,C),l+=3}}}toJSON(){let e=Ge.prototype.toJSON.call(this),t=this.parameters.shapes;return rv(t,e)}};function rv(r,e){if(e.shapes=[],Array.isArray(r))for(let t=0,n=r.length;t<n;t++){let i=r[t];e.shapes.push(i.uuid)}else e.shapes.push(r.uuid);return e}var Ua=class extends ut{constructor(e){super(),this.type="ShadowMaterial",this.color=new pe(0),this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this}};Ua.prototype.isShadowMaterial=!0;var Oa=class extends qe{constructor(e){super(e),this.type="RawShaderMaterial"}};Oa.prototype.isRawShaderMaterial=!0;var no=class extends ut{constructor(e){super(),this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new pe(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new pe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xi,this.normalScale=new te(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.vertexTangents=!1,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this.vertexTangents=e.vertexTangents,this}};no.prototype.isMeshStandardMaterial=!0;var Ha=class extends no{constructor(e){super(),this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.clearcoat=0,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new te(1,1),this.clearcoatNormalMap=null,this.reflectivity=.5,Object.defineProperty(this,"ior",{get:function(){return(1+.4*this.reflectivity)/(1-.4*this.reflectivity)},set:function(t){this.reflectivity=bt(2.5*(t-1)/(t+1),0,1)}}),this.sheen=null,this.transmission=0,this.transmissionMap=null,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.reflectivity=e.reflectivity,e.sheen?this.sheen=(this.sheen||new pe).copy(e.sheen):this.sheen=null,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this}};Ha.prototype.isMeshPhysicalMaterial=!0;var ka=class extends ut{constructor(e){super(),this.type="MeshPhongMaterial",this.color=new pe(16777215),this.specular=new pe(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new pe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xi,this.normalScale=new te(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=vo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};ka.prototype.isMeshPhongMaterial=!0;var Ga=class extends ut{constructor(e){super(),this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new pe(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new pe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xi,this.normalScale=new te(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}};Ga.prototype.isMeshToonMaterial=!0;var Va=class extends ut{constructor(e){super(),this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xi,this.normalScale=new te(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};Va.prototype.isMeshNormalMaterial=!0;var Wa=class extends ut{constructor(e){super(),this.type="MeshLambertMaterial",this.color=new pe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new pe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=vo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}};Wa.prototype.isMeshLambertMaterial=!0;var qa=class extends ut{constructor(e){super(),this.defines={MATCAP:""},this.type="MeshMatcapMaterial",this.color=new pe(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xi,this.normalScale=new te(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};qa.prototype.isMeshMatcapMaterial=!0;var Xa=class extends Qn{constructor(e){super(),this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}};Xa.prototype.isLineDashedMaterial=!0;var Qe={arraySlice:function(r,e,t){return Qe.isTypedArray(r)?new r.constructor(r.subarray(e,t!==void 0?t:r.length)):r.slice(e,t)},convertArray:function(r,e,t){return!r||!t&&r.constructor===e?r:typeof e.BYTES_PER_ELEMENT=="number"?new e(r):Array.prototype.slice.call(r)},isTypedArray:function(r){return ArrayBuffer.isView(r)&&!(r instanceof DataView)},getKeyframeOrder:function(r){function e(i,s){return r[i]-r[s]}let t=r.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n},sortedArray:function(r,e,t){let n=r.length,i=new r.constructor(n);for(let s=0,o=0;o!==n;++s){let a=t[s]*e;for(let l=0;l!==e;++l)i[o++]=r[a+l]}return i},flattenJSON:function(r,e,t,n){let i=1,s=r[0];for(;s!==void 0&&s[n]===void 0;)s=r[i++];if(s===void 0)return;let o=s[n];if(o!==void 0)if(Array.isArray(o))do o=s[n],o!==void 0&&(e.push(s.time),t.push.apply(t,o)),s=r[i++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[n],o!==void 0&&(e.push(s.time),o.toArray(t,t.length)),s=r[i++];while(s!==void 0);else do o=s[n],o!==void 0&&(e.push(s.time),t.push(o)),s=r[i++];while(s!==void 0)},subclip:function(r,e,t,n,i=30){let s=r.clone();s.name=e;let o=[];for(let l=0;l<s.tracks.length;++l){let c=s.tracks[l],u=c.getValueSize(),h=[],d=[];for(let f=0;f<c.times.length;++f){let g=c.times[f]*i;if(!(g<t||g>=n)){h.push(c.times[f]);for(let v=0;v<u;++v)d.push(c.values[f*u+v])}}h.length!==0&&(c.times=Qe.convertArray(h,c.times.constructor),c.values=Qe.convertArray(d,c.values.constructor),o.push(c))}s.tracks=o;let a=1/0;for(let l=0;l<s.tracks.length;++l)a>s.tracks[l].times[0]&&(a=s.tracks[l].times[0]);for(let l=0;l<s.tracks.length;++l)s.tracks[l].shift(-1*a);return s.resetDuration(),s},makeClipAdditive:function(r,e=0,t=r,n=30){n<=0&&(n=30);let i=t.tracks.length,s=e/n;for(let o=0;o<i;++o){let a=t.tracks[o],l=a.ValueTypeName;if(l==="bool"||l==="string")continue;let c=r.tracks.find(function(m){return m.name===a.name&&m.ValueTypeName===l});if(c===void 0)continue;let u=0,h=a.getValueSize();a.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(u=h/3);let d=0,f=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=f/3);let g=a.times.length-1,v;if(s<=a.times[0]){let m=u,p=h-u;v=Qe.arraySlice(a.values,m,p)}else if(s>=a.times[g]){let m=g*h+u,p=m+h-u;v=Qe.arraySlice(a.values,m,p)}else{let m=a.createInterpolant(),p=u,L=h-u;m.evaluate(s),v=Qe.arraySlice(m.resultBuffer,p,L)}l==="quaternion"&&new pt().fromArray(v).normalize().conjugate().toArray(v);let _=c.times.length;for(let m=0;m<_;++m){let p=m*f+d;if(l==="quaternion")pt.multiplyQuaternionsFlat(c.values,p,v,0,c.values,p);else{let L=f-d*2;for(let A=0;A<L;++A)c.values[p+A]-=v[A]}}}return r.blendMode=Pu,r}},sn=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],s=t[n-1];e:{t:{let o;n:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.afterEnd_(n-1,e,s)}if(n===a)break;if(s=i,i=t[++n],e<i)break t}o=t.length;break n}if(!(e>=s)){let a=t[1];e<a&&(n=2,s=a);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.beforeStart_(0,e,i);if(n===l)break;if(i=s,s=t[--n-1],e>=s)break t}o=n,n=0;break n}break e}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.beforeStart_(0,e,i);if(i===void 0)return n=t.length,this._cachedIndex=n,this.afterEnd_(n-1,s,e)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let o=0;o!==i;++o)t[o]=n[s+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}};sn.prototype.beforeStart_=sn.prototype.copySampleValue_;sn.prototype.afterEnd_=sn.prototype.copySampleValue_;var Ya=class extends sn{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ti,endingEnd:Ti}}intervalChanged_(e,t,n){let i=this.parameterPositions,s=e-2,o=e+1,a=i[s],l=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case Ei:s=e,a=2*t-n;break;case Vs:s=i.length-2,a=t+i[s]-i[s+1];break;default:s=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Ei:o=e,l=2*n-t;break;case Vs:o=1,l=n+i[1]-i[0];break;default:o=e-1,l=t}let c=(n-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-n),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,f=this._weightNext,g=(n-t)/(i-t),v=g*g,_=v*g,m=-d*_+2*d*v-d*g,p=(1+d)*_+(-1.5-2*d)*v+(-.5+d)*g+1,L=(-1-f)*_+(1.5+f)*v+.5*g,A=f*_-f*v;for(let C=0;C!==a;++C)s[C]=m*o[u+C]+p*o[c+C]+L*o[l+C]+A*o[h+C];return s}},io=class extends sn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(n-t)/(i-t),h=1-u;for(let d=0;d!==a;++d)s[d]=o[c+d]*h+o[l+d]*u;return s}},Za=class extends sn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},Nt=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Qe.convertArray(t,this.TimeBufferType),this.values=Qe.convertArray(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Qe.convertArray(e.times,Array),values:Qe.convertArray(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Za(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new io(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Ya(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case ks:t=this.InterpolantFactoryMethodDiscrete;break;case Gs:t=this.InterpolantFactoryMethodLinear;break;case No:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ks;case this.InterpolantFactoryMethodLinear:return Gs;case this.InterpolantFactoryMethodSmooth:return No}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,s=0,o=i-1;for(;s!==i&&n[s]<e;)++s;for(;o!==-1&&n[o]>t;)--o;if(++o,s!==0||o!==i){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=Qe.arraySlice(n,s,o),this.values=Qe.arraySlice(this.values,s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,s=n.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(i!==void 0&&Qe.isTypedArray(i))for(let a=0,l=i.length;a!==l;++a){let c=i[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=Qe.arraySlice(this.times),t=Qe.arraySlice(this.values),n=this.getValueSize(),i=this.getInterpolation()===No,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(i)l=!0;else{let h=a*n,d=h-n,f=h+n;for(let g=0;g!==n;++g){let v=t[h+g];if(v!==t[d+g]||v!==t[f+g]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let h=a*n,d=o*n;for(let f=0;f!==n;++f)t[d+f]=t[h+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*n,l=o*n,c=0;c!==n;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=Qe.arraySlice(e,0,o),this.values=Qe.arraySlice(t,0,o*n)):(this.times=e,this.values=t),this}clone(){let e=Qe.arraySlice(this.times,0),t=Qe.arraySlice(this.values,0),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};Nt.prototype.TimeBufferType=Float32Array;Nt.prototype.ValueBufferType=Float32Array;Nt.prototype.DefaultInterpolation=Gs;var kn=class extends Nt{};kn.prototype.ValueTypeName="bool";kn.prototype.ValueBufferType=Array;kn.prototype.DefaultInterpolation=ks;kn.prototype.InterpolantFactoryMethodLinear=void 0;kn.prototype.InterpolantFactoryMethodSmooth=void 0;var ro=class extends Nt{};ro.prototype.ValueTypeName="color";var Bi=class extends Nt{};Bi.prototype.ValueTypeName="number";var Ja=class extends sn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(i-t),c=e*a;for(let u=c+a;c!==u;c+=4)pt.slerpFlat(s,0,o,c-a,o,c,l);return s}},ei=class extends Nt{InterpolantFactoryMethodLinear(e){return new Ja(this.times,this.values,this.getValueSize(),e)}};ei.prototype.ValueTypeName="quaternion";ei.prototype.DefaultInterpolation=Gs;ei.prototype.InterpolantFactoryMethodSmooth=void 0;var Gn=class extends Nt{};Gn.prototype.ValueTypeName="string";Gn.prototype.ValueBufferType=Array;Gn.prototype.DefaultInterpolation=ks;Gn.prototype.InterpolantFactoryMethodLinear=void 0;Gn.prototype.InterpolantFactoryMethodSmooth=void 0;var Ni=class extends Nt{};Ni.prototype.ValueTypeName="vector";var so=class{constructor(e,t=-1,n,i=Bl){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=Jt(),this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(ov(n[o]).scale(i));let s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,o=n.length;s!==o;++s)t.push(Nt.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let s=t.length,o=[];for(let a=0;a<s;a++){let l=[],c=[];l.push((a+s-1)%s,a,(a+1)%s),c.push(0,1,0);let u=Qe.getKeyframeOrder(l);l=Qe.sortedArray(l,1,u),c=Qe.sortedArray(c,1,u),!i&&l[0]===0&&(l.push(s),c.push(c[0])),o.push(new Bi(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],u=c.name.match(s);if(u&&u.length>1){let h=u[1],d=i[h];d||(i[h]=d=[]),d.push(c)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let n=function(h,d,f,g,v){if(f.length!==0){let _=[],m=[];Qe.flattenJSON(f,_,m,g),_.length!==0&&v.push(new h(d,_,m))}},i=[],s=e.name||"default",o=e.fps||30,a=e.blendMode,l=e.length||-1,c=e.hierarchy||[];for(let h=0;h<c.length;h++){let d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){let f={},g;for(g=0;g<d.length;g++)if(d[g].morphTargets)for(let v=0;v<d[g].morphTargets.length;v++)f[d[g].morphTargets[v]]=-1;for(let v in f){let _=[],m=[];for(let p=0;p!==d[g].morphTargets.length;++p){let L=d[g];_.push(L.time),m.push(L.morphTarget===v?1:0)}i.push(new Bi(".morphTargetInfluence["+v+"]",_,m))}l=f.length*(o||1)}else{let f=".bones["+t[h].name+"]";n(Ni,f+".position",d,"pos",i),n(ei,f+".quaternion",d,"rot",i),n(Ni,f+".scale",d,"scl",i)}}return i.length===0?null:new this(s,l,i,a)}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let s=this.tracks[n];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}};function sv(r){switch(r.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Bi;case"vector":case"vector2":case"vector3":case"vector4":return Ni;case"color":return ro;case"quaternion":return ei;case"bool":case"boolean":return kn;case"string":return Gn}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+r)}function ov(r){if(r.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=sv(r.type);if(r.times===void 0){let t=[],n=[];Qe.flattenJSON(r.keys,t,n,"value"),r.times=t,r.values=n}return e.parse!==void 0?e.parse(r):new e(r.name,r.times,r.values,r.interpolation)}var Ui={enabled:!1,files:{},add:function(r,e){this.enabled!==!1&&(this.files[r]=e)},get:function(r){if(this.enabled!==!1)return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}},ja=class{constructor(e,t,n){let i=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(u){a++,s===!1&&i.onStart!==void 0&&i.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,i.onProgress!==void 0&&i.onProgress(u,o,a),o===a&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(u){i.onError!==void 0&&i.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){let h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){let f=c[h],g=c[h+1];if(f.global&&(f.lastIndex=0),f.test(u))return g}return null}}},av=new ja,on=class{constructor(e){this.manager=e!==void 0?e:av,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,s){n.load(e,i,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}},qt={},$a=class extends on{constructor(e){super(e)}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=Ui.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;if(qt[e]!==void 0){qt[e].push({onLoad:t,onProgress:n,onError:i});return}let a=/^data:(.*?)(;base64)?,(.*)$/,l=e.match(a),c;if(l){let u=l[1],h=!!l[2],d=l[3];d=decodeURIComponent(d),h&&(d=atob(d));try{let f,g=(this.responseType||"").toLowerCase();switch(g){case"arraybuffer":case"blob":let v=new Uint8Array(d.length);for(let m=0;m<d.length;m++)v[m]=d.charCodeAt(m);g==="blob"?f=new Blob([v.buffer],{type:u}):f=v.buffer;break;case"document":f=new DOMParser().parseFromString(d,u);break;case"json":f=JSON.parse(d);break;default:f=d;break}setTimeout(function(){t&&t(f),s.manager.itemEnd(e)},0)}catch(f){setTimeout(function(){i&&i(f),s.manager.itemError(e),s.manager.itemEnd(e)},0)}}else{qt[e]=[],qt[e].push({onLoad:t,onProgress:n,onError:i}),c=new XMLHttpRequest,c.open("GET",e,!0),c.addEventListener("load",function(u){let h=this.response,d=qt[e];if(delete qt[e],this.status===200||this.status===0){this.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),Ui.add(e,h);for(let f=0,g=d.length;f<g;f++){let v=d[f];v.onLoad&&v.onLoad(h)}s.manager.itemEnd(e)}else{for(let f=0,g=d.length;f<g;f++){let v=d[f];v.onError&&v.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)}},!1),c.addEventListener("progress",function(u){let h=qt[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onProgress&&g.onProgress(u)}},!1),c.addEventListener("error",function(u){let h=qt[e];delete qt[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onError&&g.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)},!1),c.addEventListener("abort",function(u){let h=qt[e];delete qt[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onError&&g.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)},!1),this.responseType!==void 0&&(c.responseType=this.responseType),this.withCredentials!==void 0&&(c.withCredentials=this.withCredentials),c.overrideMimeType&&c.overrideMimeType(this.mimeType!==void 0?this.mimeType:"text/plain");for(let u in this.requestHeader)c.setRequestHeader(u,this.requestHeader[u]);c.send(null)}return s.manager.itemStart(e),c}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}};var oo=class extends on{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=Ui.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;let a=document.createElementNS("http://www.w3.org/1999/xhtml","img");function l(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),Ui.add(e,this),t&&t(this),s.manager.itemEnd(e)}function c(u){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),i&&i(u),s.manager.itemError(e),s.manager.itemEnd(e)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.substr(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}},Ka=class extends on{constructor(e){super(e)}load(e,t,n,i){let s=new Pi,o=new oo(this.manager);o.setCrossOrigin(this.crossOrigin),o.setPath(this.path);let a=0;function l(c){o.load(e[c],function(u){s.images[c]=u,a++,a===6&&(s.needsUpdate=!0,t&&t(s))},void 0,i)}for(let c=0;c<e.length;++c)l(c);return s}};var Hr=class extends on{constructor(e){super(e)}load(e,t,n,i){let s=new yt,o=new oo(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){s.image=a;let l=e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0;s.format=l?gn:Zt,s.needsUpdate=!0,t!==void 0&&t(s)},n,i),s}},Lt=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),s=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),s+=n.distanceTo(i),t.push(s),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){let n=this.getLengths(),i=0,s=n.length,o;t?o=t:o=e*n[s-1];let a=0,l=s-1,c;for(;a<=l;)if(i=Math.floor(a+(l-a)/2),c=n[i]-o,c<0)a=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===o)return i/(s-1);let u=n[i],d=n[i+1]-u,f=(o-u)/d;return(i+f)/(s-1)}getTangent(e,t){let i=e-1e-4,s=e+1e-4;i<0&&(i=0),s>1&&(s=1);let o=this.getPoint(i),a=this.getPoint(s),l=t||(o.isVector2?new te:new T);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){let n=new T,i=[],s=[],o=[],a=new T,l=new De;for(let f=0;f<=e;f++){let g=f/e;i[f]=this.getTangentAt(g,new T),i[f].normalize()}s[0]=new T,o[0]=new T;let c=Number.MAX_VALUE,u=Math.abs(i[0].x),h=Math.abs(i[0].y),d=Math.abs(i[0].z);u<=c&&(c=u,n.set(1,0,0)),h<=c&&(c=h,n.set(0,1,0)),d<=c&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),s[0].crossVectors(i[0],a),o[0].crossVectors(i[0],s[0]);for(let f=1;f<=e;f++){if(s[f]=s[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(i[f-1],i[f]),a.length()>Number.EPSILON){a.normalize();let g=Math.acos(bt(i[f-1].dot(i[f]),-1,1));s[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(i[f],s[f])}if(t===!0){let f=Math.acos(bt(s[0].dot(s[e]),-1,1));f/=e,i[0].dot(a.crossVectors(s[0],s[e]))>0&&(f=-f);for(let g=1;g<=e;g++)s[g].applyMatrix4(l.makeRotationAxis(i[g],f*g)),o[g].crossVectors(i[g],s[g])}return{tangents:i,normals:s,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.5,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Oi=class extends Lt{constructor(e=0,t=0,n=1,i=1,s=0,o=Math.PI*2,a=!1,l=0){super(),this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=s,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t){let n=t||new te,i=Math.PI*2,s=this.aEndAngle-this.aStartAngle,o=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=i;for(;s>i;)s-=i;s<Number.EPSILON&&(o?s=0:s=i),this.aClockwise===!0&&!o&&(s===i?s=-i:s=s-i);let a=this.aStartAngle+e*s,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let u=Math.cos(this.aRotation),h=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*u-f*h+this.aX,c=d*h+f*u+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}};Oi.prototype.isEllipseCurve=!0;var ao=class extends Oi{constructor(e,t,n,i,s,o){super(e,t,n,n,i,s,o),this.type="ArcCurve"}};ao.prototype.isArcCurve=!0;function Ul(){let r=0,e=0,t=0,n=0;function i(s,o,a,l){r=s,e=a,t=-3*s+3*o-2*a-l,n=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){i(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,u,h){let d=(o-s)/c-(a-s)/(c+u)+(a-o)/u,f=(a-o)/u-(l-o)/(u+h)+(l-a)/h;d*=u,f*=u,i(o,a,d,f)},calc:function(s){let o=s*s,a=o*s;return r+e*s+t*o+n*a}}}var Fs=new T,fa=new Ul,pa=new Ul,ma=new Ul,lo=class extends Lt{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new T){let n=t,i=this.points,s=i.length,o=(s-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/s)+1)*s:l===0&&a===s-1&&(a=s-2,l=1);let c,u;this.closed||a>0?c=i[(a-1)%s]:(Fs.subVectors(i[0],i[1]).add(i[0]),c=Fs);let h=i[a%s],d=i[(a+1)%s];if(this.closed||a+2<s?u=i[(a+2)%s]:(Fs.subVectors(i[s-1],i[s-2]).add(i[s-1]),u=Fs),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(h),f),v=Math.pow(h.distanceToSquared(d),f),_=Math.pow(d.distanceToSquared(u),f);v<1e-4&&(v=1),g<1e-4&&(g=v),_<1e-4&&(_=v),fa.initNonuniformCatmullRom(c.x,h.x,d.x,u.x,g,v,_),pa.initNonuniformCatmullRom(c.y,h.y,d.y,u.y,g,v,_),ma.initNonuniformCatmullRom(c.z,h.z,d.z,u.z,g,v,_)}else this.curveType==="catmullrom"&&(fa.initCatmullRom(c.x,h.x,d.x,u.x,this.tension),pa.initCatmullRom(c.y,h.y,d.y,u.y,this.tension),ma.initCatmullRom(c.z,h.z,d.z,u.z,this.tension));return n.set(fa.calc(l),pa.calc(l),ma.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new T().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};lo.prototype.isCatmullRomCurve3=!0;function _u(r,e,t,n,i){let s=(n-e)*.5,o=(i-t)*.5,a=r*r,l=r*a;return(2*t-2*n+s+o)*l+(-3*t+3*n-2*s-o)*a+s*r+t}function lv(r,e){let t=1-r;return t*t*e}function cv(r,e){return 2*(1-r)*r*e}function uv(r,e){return r*r*e}function yr(r,e,t,n){return lv(r,e)+cv(r,t)+uv(r,n)}function hv(r,e){let t=1-r;return t*t*t*e}function dv(r,e){let t=1-r;return 3*t*t*r*e}function fv(r,e){return 3*(1-r)*r*r*e}function pv(r,e){return r*r*r*e}function _r(r,e,t,n,i){return hv(r,e)+dv(r,t)+fv(r,n)+pv(r,i)}var kr=class extends Lt{constructor(e=new te,t=new te,n=new te,i=new te){super(),this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new te){let n=t,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(_r(e,i.x,s.x,o.x,a.x),_r(e,i.y,s.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}};kr.prototype.isCubicBezierCurve=!0;var co=class extends Lt{constructor(e=new T,t=new T,n=new T,i=new T){super(),this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new T){let n=t,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(_r(e,i.x,s.x,o.x,a.x),_r(e,i.y,s.y,o.y,a.y),_r(e,i.z,s.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}};co.prototype.isCubicBezierCurve3=!0;var Hi=class extends Lt{constructor(e=new te,t=new te){super(),this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new te){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t){let n=t||new te;return n.copy(this.v2).sub(this.v1).normalize(),n}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};Hi.prototype.isLineCurve=!0;var Qa=class extends Lt{constructor(e=new T,t=new T){super(),this.type="LineCurve3",this.isLineCurve3=!0,this.v1=e,this.v2=t}getPoint(e,t=new T){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Gr=class extends Lt{constructor(e=new te,t=new te,n=new te){super(),this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new te){let n=t,i=this.v0,s=this.v1,o=this.v2;return n.set(yr(e,i.x,s.x,o.x),yr(e,i.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};Gr.prototype.isQuadraticBezierCurve=!0;var uo=class extends Lt{constructor(e=new T,t=new T,n=new T){super(),this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new T){let n=t,i=this.v0,s=this.v1,o=this.v2;return n.set(yr(e,i.x,s.x,o.x),yr(e,i.y,s.y,o.y),yr(e,i.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};uo.prototype.isQuadraticBezierCurve3=!0;var Vr=class extends Lt{constructor(e=[]){super(),this.type="SplineCurve",this.points=e}getPoint(e,t=new te){let n=t,i=this.points,s=(i.length-1)*e,o=Math.floor(s),a=s-o,l=i[o===0?o:o-1],c=i[o],u=i[o>i.length-2?i.length-1:o+1],h=i[o>i.length-3?i.length-1:o+2];return n.set(_u(a,l.x,c.x,u.x,h.x),_u(a,l.y,c.y,u.y,h.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new te().fromArray(i))}return this}};Vr.prototype.isSplineCurve=!0;var mv=Object.freeze({__proto__:null,ArcCurve:ao,CatmullRomCurve3:lo,CubicBezierCurve:kr,CubicBezierCurve3:co,EllipseCurve:Oi,LineCurve:Hi,LineCurve3:Qa,QuadraticBezierCurve:Gr,QuadraticBezierCurve3:uo,SplineCurve:Vr}),el=class extends Lt{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);e.equals(t)||this.curves.push(new Hi(t,e))}getPoint(e){let t=e*this.getLength(),n=this.getCurveLengths(),i=0;for(;i<n.length;){if(n[i]>=t){let s=n[i]-t,o=this.curves[i],a=o.getLength(),l=a===0?0:1-s/a;return o.getPointAt(l)}i++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let i=0,s=this.curves;i<s.length;i++){let o=s[i],a=o&&o.isEllipseCurve?e*2:o&&(o.isLineCurve||o.isLineCurve3)?1:o&&o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){let u=l[c];n&&n.equals(u)||(t.push(u),n=u)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(new mv[i.type]().fromJSON(i))}return this}},ki=class extends el{constructor(e){super(),this.type="Path",this.currentPoint=new te,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new Hi(this.currentPoint.clone(),new te(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){let s=new Gr(this.currentPoint.clone(),new te(e,t),new te(n,i));return this.curves.push(s),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,s,o){let a=new kr(this.currentPoint.clone(),new te(e,t),new te(n,i),new te(s,o));return this.curves.push(a),this.currentPoint.set(s,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new Vr(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,s,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,n,i,s,o),this}absarc(e,t,n,i,s,o){return this.absellipse(e,t,n,n,i,s,o),this}ellipse(e,t,n,i,s,o,a,l){let c=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(e+c,t+u,n,i,s,o,a,l),this}absellipse(e,t,n,i,s,o,a,l){let c=new Oi(e,t,n,i,s,o,a,l);if(this.curves.length>0){let h=c.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(c);let u=c.getPoint(1);return this.currentPoint.copy(u),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},zn=class extends ki{constructor(e){super(e),this.uuid=Jt(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(new ki().fromJSON(i))}return this}},Ut=class extends Xe{constructor(e,t=1){super(),this.type="Light",this.color=new pe(e),this.intensity=t}dispose(){}copy(e){return super.copy(e),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}};Ut.prototype.isLight=!0;var tl=class extends Ut{constructor(e,t,n){super(e,n),this.type="HemisphereLight",this.position.copy(Xe.DefaultUp),this.updateMatrix(),this.groundColor=new pe(t)}copy(e){return Ut.prototype.copy.call(this,e),this.groundColor.copy(e.groundColor),this}};tl.prototype.isHemisphereLight=!0;var wu=new De,bu=new T,Mu=new T,Wr=class{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.mapSize=new te(512,512),this.map=null,this.mapPass=null,this.matrix=new De,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Fi,this._frameExtents=new te(1,1),this._viewportCount=1,this._viewports=[new He(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;bu.setFromMatrixPosition(e.matrixWorld),t.position.copy(bu),Mu.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Mu),t.updateMatrixWorld(),wu.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(wu),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(t.projectionMatrix),n.multiply(t.matrixWorldInverse)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ho=class extends Wr{constructor(){super(new ft(50,1,.5,500)),this.focus=1}updateMatrices(e){let t=this.camera,n=ya*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;(n!==t.fov||i!==t.aspect||s!==t.far)&&(t.fov=n,t.aspect=i,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}};ho.prototype.isSpotLightShadow=!0;var nl=class extends Ut{constructor(e,t,n=0,i=Math.PI/3,s=0,o=1){super(e,t),this.type="SpotLight",this.position.copy(Xe.DefaultUp),this.updateMatrix(),this.target=new Xe,this.distance=n,this.angle=i,this.penumbra=s,this.decay=o,this.shadow=new ho}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};nl.prototype.isSpotLight=!0;var Su=new De,hr=new T,ga=new T,fo=class extends Wr{constructor(){super(new ft(90,1,.5,500)),this._frameExtents=new te(4,2),this._viewportCount=6,this._viewports=[new He(2,1,1,1),new He(0,1,1,1),new He(3,1,1,1),new He(1,1,1,1),new He(3,0,1,1),new He(1,0,1,1)],this._cubeDirections=[new T(1,0,0),new T(-1,0,0),new T(0,0,1),new T(0,0,-1),new T(0,1,0),new T(0,-1,0)],this._cubeUps=[new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,0,1),new T(0,0,-1)]}updateMatrices(e,t=0){let n=this.camera,i=this.matrix,s=e.distance||n.far;s!==n.far&&(n.far=s,n.updateProjectionMatrix()),hr.setFromMatrixPosition(e.matrixWorld),n.position.copy(hr),ga.copy(n.position),ga.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(ga),n.updateMatrixWorld(),i.makeTranslation(-hr.x,-hr.y,-hr.z),Su.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Su)}};fo.prototype.isPointLightShadow=!0;var il=class extends Ut{constructor(e,t,n=0,i=1){super(e,t),this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new fo}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}};il.prototype.isPointLight=!0;var Gi=class extends Rr{constructor(e=-1,t=1,n=1,i=-1,s=.1,o=2e3){super(),this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,s=n-e,o=n+e,a=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};Gi.prototype.isOrthographicCamera=!0;var po=class extends Wr{constructor(){super(new Gi(-5,5,5,-5,.5,500))}};po.prototype.isDirectionalLightShadow=!0;var rl=class extends Ut{constructor(e,t){super(e,t),this.type="DirectionalLight",this.position.copy(Xe.DefaultUp),this.updateMatrix(),this.target=new Xe,this.shadow=new po}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};rl.prototype.isDirectionalLight=!0;var sl=class extends Ut{constructor(e,t){super(e,t),this.type="AmbientLight"}};sl.prototype.isAmbientLight=!0;var ol=class extends Ut{constructor(e,t,n=10,i=10){super(e,t),this.type="RectAreaLight",this.width=n,this.height=i}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){let t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}};ol.prototype.isRectAreaLight=!0;var mo=class{constructor(){this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new T)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){let n=e.x,i=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.282095),t.addScaledVector(o[1],.488603*i),t.addScaledVector(o[2],.488603*s),t.addScaledVector(o[3],.488603*n),t.addScaledVector(o[4],1.092548*(n*i)),t.addScaledVector(o[5],1.092548*(i*s)),t.addScaledVector(o[6],.315392*(3*s*s-1)),t.addScaledVector(o[7],1.092548*(n*s)),t.addScaledVector(o[8],.546274*(n*n-i*i)),t}getIrradianceAt(e,t){let n=e.x,i=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.886227),t.addScaledVector(o[1],2*.511664*i),t.addScaledVector(o[2],2*.511664*s),t.addScaledVector(o[3],2*.511664*n),t.addScaledVector(o[4],2*.429043*n*i),t.addScaledVector(o[5],2*.429043*i*s),t.addScaledVector(o[6],.743125*s*s-.247708),t.addScaledVector(o[7],2*.429043*n*s),t.addScaledVector(o[8],.429043*(n*n-i*i)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(e.coefficients[n],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let n=0;n<9;n++)this.coefficients[n].lerp(e.coefficients[n],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].fromArray(e,t+i*3);return this}toArray(e=[],t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].toArray(e,t+i*3);return e}static getBasisAt(e,t){let n=e.x,i=e.y,s=e.z;t[0]=.282095,t[1]=.488603*i,t[2]=.488603*s,t[3]=.488603*n,t[4]=1.092548*n*i,t[5]=1.092548*i*s,t[6]=.315392*(3*s*s-1),t[7]=1.092548*n*s,t[8]=.546274*(n*n-i*i)}};mo.prototype.isSphericalHarmonics3=!0;var qr=class extends Ut{constructor(e=new mo,t=1){super(void 0,t),this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){let t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}};qr.prototype.isLightProbe=!0;var al=class{static decodeText(e){if(typeof TextDecoder!="undefined")return new TextDecoder().decode(e);let t="";for(let n=0,i=e.length;n<i;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.substr(0,t+1)}},ll=class extends Ge{constructor(){super(),this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}clone(){return new this.constructor().copy(this)}toJSON(){let e=super.toJSON(this);return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}};ll.prototype.isInstancedBufferGeometry=!0;var cl=class extends $e{constructor(e,t,n,i){typeof n=="number"&&(i=n,n=!1,console.error("THREE.InstancedBufferAttribute: The constructor now expects normalized as the third argument.")),super(e,t,n),this.meshPerAttribute=i||1}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}};cl.prototype.isInstancedBufferAttribute=!0;var ul=class extends on{constructor(e){super(e),typeof createImageBitmap=="undefined"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch=="undefined"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=Ui.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,fetch(e,a).then(function(l){return l.blob()}).then(function(l){return createImageBitmap(l,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(l){Ui.add(e,l),t&&t(l),s.manager.itemEnd(e)}).catch(function(l){i&&i(l),s.manager.itemError(e),s.manager.itemEnd(e)}),s.manager.itemStart(e)}};ul.prototype.isImageBitmapLoader=!0;var hl=class{constructor(){this.type="ShapePath",this.color=new pe,this.subPaths=[],this.currentPath=null}moveTo(e,t){return this.currentPath=new ki,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t),this}lineTo(e,t){return this.currentPath.lineTo(e,t),this}quadraticCurveTo(e,t,n,i){return this.currentPath.quadraticCurveTo(e,t,n,i),this}bezierCurveTo(e,t,n,i,s,o){return this.currentPath.bezierCurveTo(e,t,n,i,s,o),this}splineThru(e){return this.currentPath.splineThru(e),this}toShapes(e,t){function n(p){let L=[];for(let A=0,C=p.length;A<C;A++){let b=p[A],I=new zn;I.curves=b.curves,L.push(I)}return L}function i(p,L){let A=L.length,C=!1;for(let b=A-1,I=0;I<A;b=I++){let N=L[b],k=L[I],V=k.x-N.x,X=k.y-N.y;if(Math.abs(X)>Number.EPSILON){if(X<0&&(N=L[I],V=-V,k=L[b],X=-X),p.y<N.y||p.y>k.y)continue;if(p.y===N.y){if(p.x===N.x)return!0}else{let W=X*(p.x-N.x)-V*(p.y-N.y);if(W===0)return!0;if(W<0)continue;C=!C}}else{if(p.y!==N.y)continue;if(k.x<=p.x&&p.x<=N.x||N.x<=p.x&&p.x<=k.x)return!0}}return C}let s=vn.isClockWise,o=this.subPaths;if(o.length===0)return[];if(t===!0)return n(o);let a,l,c,u=[];if(o.length===1)return l=o[0],c=new zn,c.curves=l.curves,u.push(c),u;let h=!s(o[0].getPoints());h=e?!h:h;let d=[],f=[],g=[],v=0,_;f[v]=void 0,g[v]=[];for(let p=0,L=o.length;p<L;p++)l=o[p],_=l.getPoints(),a=s(_),a=e?!a:a,a?(!h&&f[v]&&v++,f[v]={s:new zn,p:_},f[v].s.curves=l.curves,h&&v++,g[v]=[]):g[v].push({h:l,p:_[0]});if(!f[0])return n(o);if(f.length>1){let p=!1,L=[];for(let A=0,C=f.length;A<C;A++)d[A]=[];for(let A=0,C=f.length;A<C;A++){let b=g[A];for(let I=0;I<b.length;I++){let N=b[I],k=!0;for(let V=0;V<f.length;V++)i(N.p,f[V].p)&&(A!==V&&L.push({froms:A,tos:V,hole:I}),k?(k=!1,d[V].push(N)):p=!0);k&&d[A].push(N)}}L.length>0&&(p||(g=d))}let m;for(let p=0,L=f.length;p<L;p++){c=f[p].s,u.push(c),m=g[p];for(let A=0,C=m.length;A<C;A++)c.holes.push(m[A].h)}return u}},dl=class{constructor(e){this.type="Font",this.data=e}generateShapes(e,t=100){let n=[],i=gv(e,t,this.data);for(let s=0,o=i.length;s<o;s++)Array.prototype.push.apply(n,i[s].toShapes());return n}};function gv(r,e,t){let n=Array.from(r),i=e/t.resolution,s=(t.boundingBox.yMax-t.boundingBox.yMin+t.underlineThickness)*i,o=[],a=0,l=0;for(let c=0;c<n.length;c++){let u=n[c];if(u===`
`)a=0,l-=s;else{let h=vv(u,i,a,l,t);a+=h.offsetX,o.push(h.path)}}return o}function vv(r,e,t,n,i){let s=i.glyphs[r]||i.glyphs["?"];if(!s){console.error('THREE.Font: character "'+r+'" does not exists in font family '+i.familyName+".");return}let o=new hl,a,l,c,u,h,d,f,g;if(s.o){let v=s._cachedOutline||(s._cachedOutline=s.o.split(" "));for(let _=0,m=v.length;_<m;)switch(v[_++]){case"m":a=v[_++]*e+t,l=v[_++]*e+n,o.moveTo(a,l);break;case"l":a=v[_++]*e+t,l=v[_++]*e+n,o.lineTo(a,l);break;case"q":c=v[_++]*e+t,u=v[_++]*e+n,h=v[_++]*e+t,d=v[_++]*e+n,o.quadraticCurveTo(h,d,c,u);break;case"b":c=v[_++]*e+t,u=v[_++]*e+n,h=v[_++]*e+t,d=v[_++]*e+n,f=v[_++]*e+t,g=v[_++]*e+n,o.bezierCurveTo(h,d,f,g,c,u);break}}return{offsetX:s.ha*e,path:o}}dl.prototype.isFont=!0;var Is,xv={getContext:function(){return Is===void 0&&(Is=new(window.AudioContext||window.webkitAudioContext)),Is},setContext:function(r){Is=r}},fl=class extends on{constructor(e){super(e)}load(e,t,n,i){let s=this,o=new $a(this.manager);o.setResponseType("arraybuffer"),o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(a){try{let l=a.slice(0);xv.getContext().decodeAudioData(l,function(u){t(u)})}catch(l){i?i(l):console.error(l),s.manager.itemError(e)}},n,i)}},pl=class extends qr{constructor(e,t,n=1){super(void 0,n);let i=new pe().set(e),s=new pe().set(t),o=new T(i.r,i.g,i.b),a=new T(s.r,s.g,s.b),l=Math.sqrt(Math.PI),c=l*Math.sqrt(.75);this.sh.coefficients[0].copy(o).add(a).multiplyScalar(l),this.sh.coefficients[1].copy(o).sub(a).multiplyScalar(c)}};pl.prototype.isHemisphereLightProbe=!0;var ml=class extends qr{constructor(e,t=1){super(void 0,t);let n=new pe().set(e);this.sh.coefficients[0].set(n.r,n.g,n.b).multiplyScalar(2*Math.sqrt(Math.PI))}};ml.prototype.isAmbientLightProbe=!0;var gl=class extends Xe{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0){console.warn("THREE.Audio: Audio is already playing.");return}if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}this._startedAt=this.context.currentTime+e;let t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this._progress=0,this.source.stop(),this.source.onended=null,this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){if(this.detune=e,this.source.detune!==void 0)return this.isPlaying===!0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}};var vl=class{constructor(e,t=2048){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=t,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let e=0,t=this.getFrequencyData();for(let n=0;n<t.length;n++)e+=t[n];return e/t.length}},xl=class{constructor(e,t,n){this.binding=e,this.valueSize=n;let i,s,o;switch(t){case"quaternion":i=this._slerp,s=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":i=this._select,s=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:i=this._lerp,s=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=s,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){let n=this.buffer,i=this.valueSize,s=e*i+i,o=this.cumulativeWeight;if(o===0){for(let a=0;a!==i;++a)n[s+a]=n[a];o=t}else{o+=t;let a=t/o;this._mixBufferRegion(n,s,0,a,i)}this.cumulativeWeight=o}accumulateAdditive(e){let t=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,i,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){let t=this.valueSize,n=this.buffer,i=e*t+t,s=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){let l=t*this._origIndex;this._mixBufferRegion(n,i,l,1-s,t)}o>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(n[l]!==n[l+t]){a.setValue(n,i);break}}saveOriginalState(){let e=this.binding,t=this.buffer,n=this.valueSize,i=n*this._origIndex;e.getValue(t,i);for(let s=n,o=i;s!==o;++s)t[s]=t[i+s%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){let e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){let e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){let e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,i,s){if(i>=.5)for(let o=0;o!==s;++o)e[t+o]=e[n+o]}_slerp(e,t,n,i){pt.slerpFlat(e,t,e,t,e,n,i)}_slerpAdditive(e,t,n,i,s){let o=this._workIndex*s;pt.multiplyQuaternionsFlat(e,o,e,t,e,n),pt.slerpFlat(e,t,e,t,e,o,i)}_lerp(e,t,n,i,s){let o=1-i;for(let a=0;a!==s;++a){let l=t+a;e[l]=e[l]*o+e[n+a]*i}}_lerpAdditive(e,t,n,i,s){for(let o=0;o!==s;++o){let a=t+o;e[a]=e[a]+e[n+o]*i}}},Ol="\\[\\]\\.:\\/",yv=new RegExp("["+Ol+"]","g"),Hl="[^"+Ol+"]",_v="[^"+Ol.replace("\\.","")+"]",wv=/((?:WC+[\/:])*)/.source.replace("WC",Hl),bv=/(WCOD+)?/.source.replace("WCOD",_v),Mv=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Hl),Sv=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Hl),Tv=new RegExp("^"+wv+bv+Mv+Sv+"$"),Ev=["material","materials","bones"],yl=class{constructor(e,t,n){let i=n||Ze.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Ze=class r{constructor(e,t,n){this.path=t,this.parsedPath=n||r.parseTrackName(t),this.node=r.findNode(e,this.parsedPath.nodeName)||e,this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new r.Composite(e,t,n):new r(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(yv,"")}static parseTrackName(e){let t=Tv.exec(e);if(!t)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let s=n.nodeName.substring(i+1);Ev.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(!t||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.node[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,s=t.propertyIndex;if(e||(e=r.findNode(this.rootNode,t.nodeName)||this.rootNode,this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.error("THREE.PropertyBinding: Trying to update node for track: "+this.path+" but it wasn't found.");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[i];if(o===void 0){let c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(e.geometry.isBufferGeometry){if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}else{console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences on THREE.Geometry. Use THREE.BufferGeometry instead.",this);return}}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Ze.Composite=yl;Ze.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Ze.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Ze.prototype.GetterByBindingType=[Ze.prototype._getValue_direct,Ze.prototype._getValue_array,Ze.prototype._getValue_arrayElement,Ze.prototype._getValue_toArray];Ze.prototype.SetterByBindingTypeAndVersioning=[[Ze.prototype._setValue_direct,Ze.prototype._setValue_direct_setNeedsUpdate,Ze.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_array,Ze.prototype._setValue_array_setNeedsUpdate,Ze.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_arrayElement,Ze.prototype._setValue_arrayElement_setNeedsUpdate,Ze.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Ze.prototype._setValue_fromArray,Ze.prototype._setValue_fromArray_setNeedsUpdate,Ze.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var _l=class{constructor(){this.uuid=Jt(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;let e={};this._indicesByUUID=e;for(let n=0,i=arguments.length;n!==i;++n)e[arguments[n].uuid]=n;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};let t=this;this.stats={objects:{get total(){return t._objects.length},get inUse(){return this.total-t.nCachedObjects_}},get bindingsPerObject(){return t._bindings.length}}}add(){let e=this._objects,t=this._indicesByUUID,n=this._paths,i=this._parsedPaths,s=this._bindings,o=s.length,a,l=e.length,c=this.nCachedObjects_;for(let u=0,h=arguments.length;u!==h;++u){let d=arguments[u],f=d.uuid,g=t[f];if(g===void 0){g=l++,t[f]=g,e.push(d);for(let v=0,_=o;v!==_;++v)s[v].push(new Ze(d,n[v],i[v]))}else if(g<c){a=e[g];let v=--c,_=e[v];t[_.uuid]=g,e[g]=_,t[f]=v,e[v]=d;for(let m=0,p=o;m!==p;++m){let L=s[m],A=L[v],C=L[g];L[g]=A,C===void 0&&(C=new Ze(d,n[m],i[m])),L[v]=C}}else e[g]!==a&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=c}remove(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,s=this.nCachedObjects_;for(let o=0,a=arguments.length;o!==a;++o){let l=arguments[o],c=l.uuid,u=t[c];if(u!==void 0&&u>=s){let h=s++,d=e[h];t[d.uuid]=u,e[u]=d,t[c]=h,e[h]=l;for(let f=0,g=i;f!==g;++f){let v=n[f],_=v[h],m=v[u];v[u]=_,v[h]=m}}}this.nCachedObjects_=s}uncache(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,s=this.nCachedObjects_,o=e.length;for(let a=0,l=arguments.length;a!==l;++a){let c=arguments[a],u=c.uuid,h=t[u];if(h!==void 0)if(delete t[u],h<s){let d=--s,f=e[d],g=--o,v=e[g];t[f.uuid]=h,e[h]=f,t[v.uuid]=d,e[d]=v,e.pop();for(let _=0,m=i;_!==m;++_){let p=n[_],L=p[d],A=p[g];p[h]=L,p[d]=A,p.pop()}}else{let d=--o,f=e[d];d>0&&(t[f.uuid]=h),e[h]=f,e.pop();for(let g=0,v=i;g!==v;++g){let _=n[g];_[h]=_[d],_.pop()}}}this.nCachedObjects_=s}subscribe_(e,t){let n=this._bindingsIndicesByPath,i=n[e],s=this._bindings;if(i!==void 0)return s[i];let o=this._paths,a=this._parsedPaths,l=this._objects,c=l.length,u=this.nCachedObjects_,h=new Array(c);i=s.length,n[e]=i,o.push(e),a.push(t),s.push(h);for(let d=u,f=l.length;d!==f;++d){let g=l[d];h[d]=new Ze(g,e,t)}return h}unsubscribe_(e){let t=this._bindingsIndicesByPath,n=t[e];if(n!==void 0){let i=this._paths,s=this._parsedPaths,o=this._bindings,a=o.length-1,l=o[a],c=e[a];t[c]=n,o[n]=l,o.pop(),s[n]=s[a],s.pop(),i[n]=i[a],i.pop()}}};_l.prototype.isAnimationObjectGroup=!0;var wl=class{constructor(e,t,n=null,i=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=i;let s=t.tracks,o=s.length,a=new Array(o),l={endingStart:Ti,endingEnd:Ti};for(let c=0;c!==o;++c){let u=s[c].createInterpolant(null);a[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=sf,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n){if(e.fadeOut(t),this.fadeIn(t),n){let i=this._clip.duration,s=e._clip.duration,o=s/i,a=i/s;e.warp(1,o,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,n){return e.crossFadeFrom(this,t,n)}stopFading(){let e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){let i=this._mixer,s=i.time,o=this.timeScale,a=this._timeScaleInterpolant;a===null&&(a=i._lendControlInterpolant(),this._timeScaleInterpolant=a);let l=a.parameterPositions,c=a.sampleValues;return l[0]=s,l[1]=s+n,c[0]=e/o,c[1]=t/o,this}stopWarping(){let e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,i){if(!this.enabled){this._updateWeight(e);return}let s=this._startTime;if(s!==null){let l=(e-s)*n;if(l<0||n===0)return;this._startTime=null,t=n*l}t*=this._updateTimeScale(e);let o=this._updateTime(t),a=this._updateWeight(e);if(a>0){let l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case Pu:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulateAdditive(a);break;case Bl:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulate(i,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;let n=this._weightInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;let n=this._timeScaleInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){let t=this._clip.duration,n=this.loop,i=this.time+e,s=this._loopCount,o=n===of;if(e===0)return s===-1?i:o&&(s&1)===1?t-i:i;if(n===rf){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i>=t)i=t;else if(i<0)i=0;else{this.time=i;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),i>=t||i<0){let a=Math.floor(i/t);i-=t*a,s+=Math.abs(a);let l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=e>0?t:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){let c=e<0;this._setEndings(c,!c,o)}else this._setEndings(!1,!1,o);this._loopCount=s,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=i;if(o&&(s&1)===1)return t-i}return i}_setEndings(e,t,n){let i=this._interpolantSettings;n?(i.endingStart=Ei,i.endingEnd=Ei):(e?i.endingStart=this.zeroSlopeAtStart?Ei:Ti:i.endingStart=Vs,t?i.endingEnd=this.zeroSlopeAtEnd?Ei:Ti:i.endingEnd=Vs)}_scheduleFading(e,t,n){let i=this._mixer,s=i.time,o=this._weightInterpolant;o===null&&(o=i._lendControlInterpolant(),this._weightInterpolant=o);let a=o.parameterPositions,l=o.sampleValues;return a[0]=s,l[0]=t,a[1]=s+e,l[1]=n,this}},bl=class extends xn{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){let n=e._localRoot||this._root,i=e._clip.tracks,s=i.length,o=e._propertyBindings,a=e._interpolants,l=n.uuid,c=this._bindingsByRootAndName,u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){let d=i[h],f=d.name,g=u[f];if(g!==void 0)o[h]=g;else{if(g=o[h],g!==void 0){g._cacheIndex===null&&(++g.referenceCount,this._addInactiveBinding(g,l,f));continue}let v=t&&t._propertyBindings[h].binding.parsedPath;g=new xl(Ze.create(n,f,v),d.ValueTypeName,d.getValueSize()),++g.referenceCount,this._addInactiveBinding(g,l,f),o[h]=g}a[h].resultBuffer=g.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){let n=(e._localRoot||this._root).uuid,i=e._clip.uuid,s=this._actionsByClip[i];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,i,n)}let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;let e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){let t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,n){let i=this._actions,s=this._actionsByClip,o=s[t];if(o===void 0)o={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=o;else{let a=o.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=i.length,i.push(e),o.actionByRoot[n]=e}_removeInactiveAction(e){let t=this._actions,n=t[t.length-1],i=e._cacheIndex;n._cacheIndex=i,t[i]=n,t.pop(),e._cacheIndex=null;let s=e._clip.uuid,o=this._actionsByClip,a=o[s],l=a.knownActions,c=l[l.length-1],u=e._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),e._byClipCacheIndex=null;let h=a.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],l.length===0&&delete o[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){let t=this._actions,n=e._cacheIndex,i=this._nActiveActions++,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_takeBackAction(e){let t=this._actions,n=e._cacheIndex,i=--this._nActiveActions,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_addInactiveBinding(e,t,n){let i=this._bindingsByRootAndName,s=this._bindings,o=i[t];o===void 0&&(o={},i[t]=o),o[n]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){let t=this._bindings,n=e.binding,i=n.rootNode.uuid,s=n.path,o=this._bindingsByRootAndName,a=o[i],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete a[s],Object.keys(a).length===0&&delete o[i]}_lendBinding(e){let t=this._bindings,n=e._cacheIndex,i=this._nActiveBindings++,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_takeBackBinding(e){let t=this._bindings,n=e._cacheIndex,i=--this._nActiveBindings,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_lendControlInterpolant(){let e=this._controlInterpolants,t=this._nActiveControlInterpolants++,n=e[t];return n===void 0&&(n=new io(new Float32Array(2),new Float32Array(2),1,this._controlInterpolantsResultBuffer),n.__cacheIndex=t,e[t]=n),n}_takeBackControlInterpolant(e){let t=this._controlInterpolants,n=e.__cacheIndex,i=--this._nActiveControlInterpolants,s=t[i];e.__cacheIndex=i,t[i]=e,s.__cacheIndex=n,t[n]=s}clipAction(e,t,n){let i=t||this._root,s=i.uuid,o=typeof e=="string"?so.findByName(i,e):e,a=o!==null?o.uuid:e,l=this._actionsByClip[a],c=null;if(n===void 0&&(o!==null?n=o.blendMode:n=Bl),l!==void 0){let h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===n)return h;c=l.knownActions[0],o===null&&(o=c._clip)}if(o===null)return null;let u=new wl(this,o,t,n);return this._bindAction(u,c),this._addInactiveAction(u,a,s),u}existingAction(e,t){let n=t||this._root,i=n.uuid,s=typeof e=="string"?so.findByName(n,e):e,o=s?s.uuid:e,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[i]||null}stopAllAction(){let e=this._actions,t=this._nActiveActions;for(let n=t-1;n>=0;--n)e[n].stop();return this}update(e){e*=this.timeScale;let t=this._actions,n=this._nActiveActions,i=this.time+=e,s=Math.sign(e),o=this._accuIndex^=1;for(let c=0;c!==n;++c)t[c]._update(i,e,s,o);let a=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)a[c].apply(o);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){let t=this._actions,n=e.uuid,i=this._actionsByClip,s=i[n];if(s!==void 0){let o=s.knownActions;for(let a=0,l=o.length;a!==l;++a){let c=o[a];this._deactivateAction(c);let u=c._cacheIndex,h=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(c)}delete i[n]}}uncacheRoot(e){let t=e.uuid,n=this._actionsByClip;for(let o in n){let a=n[o].actionByRoot,l=a[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}let i=this._bindingsByRootAndName,s=i[t];if(s!==void 0)for(let o in s){let a=s[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(e,t){let n=this.existingAction(e,t);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}};bl.prototype._controlInterpolantsResultBuffer=new Float32Array(1);var Ml=class r{constructor(e){typeof e=="string"&&(console.warn("THREE.Uniform: Type parameter is no longer needed."),e=arguments[1]),this.value=e}clone(){return new r(this.value.clone===void 0?this.value:this.value.clone())}},Sl=class extends Kn{constructor(e,t,n=1){super(e,t),this.meshPerAttribute=n||1}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}};Sl.prototype.isInstancedInterleavedBuffer=!0;var Tl=class{constructor(e,t,n,i,s){this.buffer=e,this.type=t,this.itemSize=n,this.elementSize=i,this.count=s,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}};Tl.prototype.isGLBufferAttribute=!0;var Tu=new te,ti=class{constructor(e=new te(1/0,1/0),t=new te(-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Tu.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return e===void 0&&(console.warn("THREE.Box2: .getCenter() target is now required"),e=new te),this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(console.warn("THREE.Box2: .getSize() target is now required"),e=new te),this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t===void 0&&(console.warn("THREE.Box2: .getParameter() target is now required"),t=new te),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y)}clampPoint(e,t){return t===void 0&&(console.warn("THREE.Box2: .clampPoint() target is now required"),t=new te),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return Tu.copy(e).clamp(this.min,this.max).sub(e).length()}intersect(e){return this.min.max(e.min),this.max.min(e.max),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};ti.prototype.isBox2=!0;var Eu=new T,zs=new T,El=class{constructor(e=new T,t=new T){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e===void 0&&(console.warn("THREE.Line3: .getCenter() target is now required"),e=new T),e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e===void 0&&(console.warn("THREE.Line3: .delta() target is now required"),e=new T),e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return t===void 0&&(console.warn("THREE.Line3: .at() target is now required"),t=new T),this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){Eu.subVectors(e,this.start),zs.subVectors(this.end,this.start);let n=zs.dot(zs),s=zs.dot(Eu)/n;return t&&(s=bt(s,0,1)),s}closestPointToPoint(e,t,n){let i=this.closestPointToPointParameter(e,t);return n===void 0&&(console.warn("THREE.Line3: .closestPointToPoint() target is now required"),n=new T),this.delta(n).multiplyScalar(i).add(this.start)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}},Al=class extends Xe{constructor(e){super(),this.material=e,this.render=function(){},this.hasPositions=!1,this.hasNormals=!1,this.hasColors=!1,this.hasUvs=!1,this.positionArray=null,this.normalArray=null,this.colorArray=null,this.uvArray=null,this.count=0}};Al.prototype.isImmediateRenderObject=!0;var Dn=new T,Bs=new De,va=new De,Ll=class extends Ir{constructor(e){let t=Ku(e),n=new Ge,i=[],s=[],o=new pe(0,0,1),a=new pe(0,1,0);for(let c=0;c<t.length;c++){let u=t[c];u.parent&&u.parent.isBone&&(i.push(0,0,0),i.push(0,0,0),s.push(o.r,o.g,o.b),s.push(a.r,a.g,a.b))}n.setAttribute("position",new Ve(i,3)),n.setAttribute("color",new Ve(s,3));let l=new Qn({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(n,l),this.type="SkeletonHelper",this.isSkeletonHelper=!0,this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(e){let t=this.bones,n=this.geometry,i=n.getAttribute("position");va.copy(this.root.matrixWorld).invert();for(let s=0,o=0;s<t.length;s++){let a=t[s];a.parent&&a.parent.isBone&&(Bs.multiplyMatrices(va,a.matrixWorld),Dn.setFromMatrixPosition(Bs),i.setXYZ(o,Dn.x,Dn.y,Dn.z),Bs.multiplyMatrices(va,a.parent.matrixWorld),Dn.setFromMatrixPosition(Bs),i.setXYZ(o+1,Dn.x,Dn.y,Dn.z),o+=2)}n.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(e)}};function Ku(r){let e=[];r&&r.isBone&&e.push(r);for(let t=0;t<r.children.length;t++)e.push.apply(e,Ku(r.children[t]));return e}var Rl=class extends Ir{constructor(e=10,t=10,n=4473924,i=8947848){n=new pe(n),i=new pe(i);let s=t/2,o=e/t,a=e/2,l=[],c=[];for(let d=0,f=0,g=-a;d<=t;d++,g+=o){l.push(-a,0,g,a,0,g),l.push(g,0,-a,g,0,a);let v=d===s?n:i;v.toArray(c,f),f+=3,v.toArray(c,f),f+=3,v.toArray(c,f),f+=3,v.toArray(c,f),f+=3}let u=new Ge;u.setAttribute("position",new Ve(l,3)),u.setAttribute("color",new Ve(c,3));let h=new Qn({vertexColors:!0,toneMapped:!1});super(u,h),this.type="GridHelper"}};var Av=new Float32Array(1),Hv=new Int32Array(Av.buffer);var Us=4,wr=8,kv=Math.pow(2,wr),Qu=[.125,.215,.35,.446,.526,.582],Lv=wr-Us+1+Qu.length;var Gv={[qi]:0,[Nl]:1,[Fu]:2,[Iu]:3,[zu]:4,[Bu]:5,[Du]:6},Rv=new Ar({side:ot,depthWrite:!1,depthTest:!1}),Vv=new Oe(new Lr,Rv);var{_lodPlanes:Wv,_sizeLods:qv,_sigmas:Xv}=Cv();var jn=(1+Math.sqrt(5))/2,Si=1/jn,Yv=[new T(1,1,1),new T(-1,1,1),new T(1,1,-1),new T(-1,1,-1),new T(0,jn,Si),new T(0,jn,-Si),new T(Si,0,jn),new T(-Si,0,jn),new T(jn,Si,0),new T(-jn,Si,0)];function Cv(){let r=[],e=[],t=[],n=wr;for(let i=0;i<Lv;i++){let s=Math.pow(2,n);e.push(s);let o=1/s;i>wr-Us?o=Qu[i-wr+Us-1]:i==0&&(o=0),t.push(o);let a=1/(s-1),l=-a/2,c=1+a/2,u=[l,l,c,l,c,c,l,l,c,c,l,c],h=6,d=6,f=3,g=2,v=1,_=new Float32Array(f*d*h),m=new Float32Array(g*d*h),p=new Float32Array(v*d*h);for(let A=0;A<h;A++){let C=A%3*2/3-1,b=A>2?0:-1,I=[C,b,0,C+2/3,b,0,C+2/3,b+1,0,C,b,0,C+2/3,b+1,0,C,b+1,0];_.set(I,f*d*A),m.set(u,g*d*A);let N=[A,A,A,A,A,A];p.set(N,v*d*A)}let L=new Ge;L.setAttribute("position",new $e(_,f)),L.setAttribute("uv",new $e(m,g)),L.setAttribute("faceIndex",new $e(p,v)),r.push(L),n>Us&&n--}return{_lodPlanes:r,_sizeLods:e,_sigmas:t}}Lt.create=function(r,e){return console.log("THREE.Curve.create() has been deprecated"),r.prototype=Object.create(Lt.prototype),r.prototype.constructor=r,r.prototype.getPoint=e,r};ki.prototype.fromPoints=function(r){return console.warn("THREE.Path: .fromPoints() has been renamed to .setFromPoints()."),this.setFromPoints(r)};Rl.prototype.setColors=function(){console.error("THREE.GridHelper: setColors() has been deprecated, pass them in the constructor instead.")};Ll.prototype.update=function(){console.error("THREE.SkeletonHelper: update() no longer needs to be called.")};on.prototype.extractUrlBase=function(r){return console.warn("THREE.Loader: .extractUrlBase() has been deprecated. Use THREE.LoaderUtils.extractUrlBase() instead."),al.extractUrlBase(r)};on.Handlers={add:function(){console.error("THREE.Loader: Handlers.add() has been removed. Use LoadingManager.addHandler() instead.")},get:function(){console.error("THREE.Loader: Handlers.get() has been removed. Use LoadingManager.getHandler() instead.")}};ti.prototype.center=function(r){return console.warn("THREE.Box2: .center() has been renamed to .getCenter()."),this.getCenter(r)};ti.prototype.empty=function(){return console.warn("THREE.Box2: .empty() has been renamed to .isEmpty()."),this.isEmpty()};ti.prototype.isIntersectionBox=function(r){return console.warn("THREE.Box2: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};ti.prototype.size=function(r){return console.warn("THREE.Box2: .size() has been renamed to .getSize()."),this.getSize(r)};At.prototype.center=function(r){return console.warn("THREE.Box3: .center() has been renamed to .getCenter()."),this.getCenter(r)};At.prototype.empty=function(){return console.warn("THREE.Box3: .empty() has been renamed to .isEmpty()."),this.isEmpty()};At.prototype.isIntersectionBox=function(r){return console.warn("THREE.Box3: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};At.prototype.isIntersectionSphere=function(r){return console.warn("THREE.Box3: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(r)};At.prototype.size=function(r){return console.warn("THREE.Box3: .size() has been renamed to .getSize()."),this.getSize(r)};Nn.prototype.empty=function(){return console.warn("THREE.Sphere: .empty() has been renamed to .isEmpty()."),this.isEmpty()};Fi.prototype.setFromMatrix=function(r){return console.warn("THREE.Frustum: .setFromMatrix() has been renamed to .setFromProjectionMatrix()."),this.setFromProjectionMatrix(r)};El.prototype.center=function(r){return console.warn("THREE.Line3: .center() has been renamed to .getCenter()."),this.getCenter(r)};at.prototype.flattenToArrayOffset=function(r,e){return console.warn("THREE.Matrix3: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(r,e)};at.prototype.multiplyVector3=function(r){return console.warn("THREE.Matrix3: .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead."),r.applyMatrix3(this)};at.prototype.multiplyVector3Array=function(){console.error("THREE.Matrix3: .multiplyVector3Array() has been removed.")};at.prototype.applyToBufferAttribute=function(r){return console.warn("THREE.Matrix3: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix3( matrix ) instead."),r.applyMatrix3(this)};at.prototype.applyToVector3Array=function(){console.error("THREE.Matrix3: .applyToVector3Array() has been removed.")};at.prototype.getInverse=function(r){return console.warn("THREE.Matrix3: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead."),this.copy(r).invert()};De.prototype.extractPosition=function(r){return console.warn("THREE.Matrix4: .extractPosition() has been renamed to .copyPosition()."),this.copyPosition(r)};De.prototype.flattenToArrayOffset=function(r,e){return console.warn("THREE.Matrix4: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(r,e)};De.prototype.getPosition=function(){return console.warn("THREE.Matrix4: .getPosition() has been removed. Use Vector3.setFromMatrixPosition( matrix ) instead."),new T().setFromMatrixColumn(this,3)};De.prototype.setRotationFromQuaternion=function(r){return console.warn("THREE.Matrix4: .setRotationFromQuaternion() has been renamed to .makeRotationFromQuaternion()."),this.makeRotationFromQuaternion(r)};De.prototype.multiplyToArray=function(){console.warn("THREE.Matrix4: .multiplyToArray() has been removed.")};De.prototype.multiplyVector3=function(r){return console.warn("THREE.Matrix4: .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};De.prototype.multiplyVector4=function(r){return console.warn("THREE.Matrix4: .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};De.prototype.multiplyVector3Array=function(){console.error("THREE.Matrix4: .multiplyVector3Array() has been removed.")};De.prototype.rotateAxis=function(r){console.warn("THREE.Matrix4: .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead."),r.transformDirection(this)};De.prototype.crossVector=function(r){return console.warn("THREE.Matrix4: .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};De.prototype.translate=function(){console.error("THREE.Matrix4: .translate() has been removed.")};De.prototype.rotateX=function(){console.error("THREE.Matrix4: .rotateX() has been removed.")};De.prototype.rotateY=function(){console.error("THREE.Matrix4: .rotateY() has been removed.")};De.prototype.rotateZ=function(){console.error("THREE.Matrix4: .rotateZ() has been removed.")};De.prototype.rotateByAxis=function(){console.error("THREE.Matrix4: .rotateByAxis() has been removed.")};De.prototype.applyToBufferAttribute=function(r){return console.warn("THREE.Matrix4: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};De.prototype.applyToVector3Array=function(){console.error("THREE.Matrix4: .applyToVector3Array() has been removed.")};De.prototype.makeFrustum=function(r,e,t,n,i,s){return console.warn("THREE.Matrix4: .makeFrustum() has been removed. Use .makePerspective( left, right, top, bottom, near, far ) instead."),this.makePerspective(r,e,n,t,i,s)};De.prototype.getInverse=function(r){return console.warn("THREE.Matrix4: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead."),this.copy(r).invert()};Bt.prototype.isIntersectionLine=function(r){return console.warn("THREE.Plane: .isIntersectionLine() has been renamed to .intersectsLine()."),this.intersectsLine(r)};pt.prototype.multiplyVector3=function(r){return console.warn("THREE.Quaternion: .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead."),r.applyQuaternion(this)};pt.prototype.inverse=function(){return console.warn("THREE.Quaternion: .inverse() has been renamed to invert()."),this.invert()};Un.prototype.isIntersectionBox=function(r){return console.warn("THREE.Ray: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};Un.prototype.isIntersectionPlane=function(r){return console.warn("THREE.Ray: .isIntersectionPlane() has been renamed to .intersectsPlane()."),this.intersectsPlane(r)};Un.prototype.isIntersectionSphere=function(r){return console.warn("THREE.Ray: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(r)};xt.prototype.area=function(){return console.warn("THREE.Triangle: .area() has been renamed to .getArea()."),this.getArea()};xt.prototype.barycoordFromPoint=function(r,e){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),this.getBarycoord(r,e)};xt.prototype.midpoint=function(r){return console.warn("THREE.Triangle: .midpoint() has been renamed to .getMidpoint()."),this.getMidpoint(r)};xt.prototypenormal=function(r){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),this.getNormal(r)};xt.prototype.plane=function(r){return console.warn("THREE.Triangle: .plane() has been renamed to .getPlane()."),this.getPlane(r)};xt.barycoordFromPoint=function(r,e,t,n,i){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),xt.getBarycoord(r,e,t,n,i)};xt.normal=function(r,e,t,n){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),xt.getNormal(r,e,t,n)};zn.prototype.extractAllPoints=function(r){return console.warn("THREE.Shape: .extractAllPoints() has been removed. Use .extractPoints() instead."),this.extractPoints(r)};zn.prototype.extrude=function(r){return console.warn("THREE.Shape: .extrude() has been removed. Use ExtrudeGeometry() instead."),new zi(this,r)};zn.prototype.makeGeometry=function(r){return console.warn("THREE.Shape: .makeGeometry() has been removed. Use ShapeGeometry() instead."),new Na(this,r)};te.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector2: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};te.prototype.distanceToManhattan=function(r){return console.warn("THREE.Vector2: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(r)};te.prototype.lengthManhattan=function(){return console.warn("THREE.Vector2: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};T.prototype.setEulerFromRotationMatrix=function(){console.error("THREE.Vector3: .setEulerFromRotationMatrix() has been removed. Use Euler.setFromRotationMatrix() instead.")};T.prototype.setEulerFromQuaternion=function(){console.error("THREE.Vector3: .setEulerFromQuaternion() has been removed. Use Euler.setFromQuaternion() instead.")};T.prototype.getPositionFromMatrix=function(r){return console.warn("THREE.Vector3: .getPositionFromMatrix() has been renamed to .setFromMatrixPosition()."),this.setFromMatrixPosition(r)};T.prototype.getScaleFromMatrix=function(r){return console.warn("THREE.Vector3: .getScaleFromMatrix() has been renamed to .setFromMatrixScale()."),this.setFromMatrixScale(r)};T.prototype.getColumnFromMatrix=function(r,e){return console.warn("THREE.Vector3: .getColumnFromMatrix() has been renamed to .setFromMatrixColumn()."),this.setFromMatrixColumn(e,r)};T.prototype.applyProjection=function(r){return console.warn("THREE.Vector3: .applyProjection() has been removed. Use .applyMatrix4( m ) instead."),this.applyMatrix4(r)};T.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector3: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};T.prototype.distanceToManhattan=function(r){return console.warn("THREE.Vector3: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(r)};T.prototype.lengthManhattan=function(){return console.warn("THREE.Vector3: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};He.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector4: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};He.prototype.lengthManhattan=function(){return console.warn("THREE.Vector4: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};Xe.prototype.getChildByName=function(r){return console.warn("THREE.Object3D: .getChildByName() has been renamed to .getObjectByName()."),this.getObjectByName(r)};Xe.prototype.renderDepth=function(){console.warn("THREE.Object3D: .renderDepth has been removed. Use .renderOrder, instead.")};Xe.prototype.translate=function(r,e){return console.warn("THREE.Object3D: .translate() has been removed. Use .translateOnAxis( axis, distance ) instead."),this.translateOnAxis(e,r)};Xe.prototype.getWorldRotation=function(){console.error("THREE.Object3D: .getWorldRotation() has been removed. Use THREE.Object3D.getWorldQuaternion( target ) instead.")};Xe.prototype.applyMatrix=function(r){return console.warn("THREE.Object3D: .applyMatrix() has been renamed to .applyMatrix4()."),this.applyMatrix4(r)};Object.defineProperties(Xe.prototype,{eulerOrder:{get:function(){return console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order},set:function(r){console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order=r}},useQuaternion:{get:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")},set:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")}}});Oe.prototype.setDrawMode=function(){console.error("THREE.Mesh: .setDrawMode() has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.")};Object.defineProperties(Oe.prototype,{drawMode:{get:function(){return console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode."),af},set:function(){console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.")}}});Qs.prototype.initBones=function(){console.error("THREE.SkinnedMesh: initBones() has been removed.")};ft.prototype.setLens=function(r,e){console.warn("THREE.PerspectiveCamera.setLens is deprecated. Use .setFocalLength and .filmGauge for a photographic setup."),e!==void 0&&(this.filmGauge=e),this.setFocalLength(r)};Object.defineProperties(Ut.prototype,{onlyShadow:{set:function(){console.warn("THREE.Light: .onlyShadow has been removed.")}},shadowCameraFov:{set:function(r){console.warn("THREE.Light: .shadowCameraFov is now .shadow.camera.fov."),this.shadow.camera.fov=r}},shadowCameraLeft:{set:function(r){console.warn("THREE.Light: .shadowCameraLeft is now .shadow.camera.left."),this.shadow.camera.left=r}},shadowCameraRight:{set:function(r){console.warn("THREE.Light: .shadowCameraRight is now .shadow.camera.right."),this.shadow.camera.right=r}},shadowCameraTop:{set:function(r){console.warn("THREE.Light: .shadowCameraTop is now .shadow.camera.top."),this.shadow.camera.top=r}},shadowCameraBottom:{set:function(r){console.warn("THREE.Light: .shadowCameraBottom is now .shadow.camera.bottom."),this.shadow.camera.bottom=r}},shadowCameraNear:{set:function(r){console.warn("THREE.Light: .shadowCameraNear is now .shadow.camera.near."),this.shadow.camera.near=r}},shadowCameraFar:{set:function(r){console.warn("THREE.Light: .shadowCameraFar is now .shadow.camera.far."),this.shadow.camera.far=r}},shadowCameraVisible:{set:function(){console.warn("THREE.Light: .shadowCameraVisible has been removed. Use new THREE.CameraHelper( light.shadow.camera ) instead.")}},shadowBias:{set:function(r){console.warn("THREE.Light: .shadowBias is now .shadow.bias."),this.shadow.bias=r}},shadowDarkness:{set:function(){console.warn("THREE.Light: .shadowDarkness has been removed.")}},shadowMapWidth:{set:function(r){console.warn("THREE.Light: .shadowMapWidth is now .shadow.mapSize.width."),this.shadow.mapSize.width=r}},shadowMapHeight:{set:function(r){console.warn("THREE.Light: .shadowMapHeight is now .shadow.mapSize.height."),this.shadow.mapSize.height=r}}});Object.defineProperties($e.prototype,{length:{get:function(){return console.warn("THREE.BufferAttribute: .length has been deprecated. Use .count instead."),this.array.length}},dynamic:{get:function(){return console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead."),this.usage===Ws},set:function(){console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead."),this.setUsage(Ws)}}});$e.prototype.setDynamic=function(r){return console.warn("THREE.BufferAttribute: .setDynamic() has been deprecated. Use .setUsage() instead."),this.setUsage(r===!0?Ws:Er),this};$e.prototype.copyIndicesArray=function(){console.error("THREE.BufferAttribute: .copyIndicesArray() has been removed.")},$e.prototype.setArray=function(){console.error("THREE.BufferAttribute: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers")};Ge.prototype.addIndex=function(r){console.warn("THREE.BufferGeometry: .addIndex() has been renamed to .setIndex()."),this.setIndex(r)};Ge.prototype.addAttribute=function(r,e){return console.warn("THREE.BufferGeometry: .addAttribute() has been renamed to .setAttribute()."),!(e&&e.isBufferAttribute)&&!(e&&e.isInterleavedBufferAttribute)?(console.warn("THREE.BufferGeometry: .addAttribute() now expects ( name, attribute )."),this.setAttribute(r,new $e(arguments[1],arguments[2]))):r==="index"?(console.warn("THREE.BufferGeometry.addAttribute: Use .setIndex() for index attribute."),this.setIndex(e),this):this.setAttribute(r,e)};Ge.prototype.addDrawCall=function(r,e,t){t!==void 0&&console.warn("THREE.BufferGeometry: .addDrawCall() no longer supports indexOffset."),console.warn("THREE.BufferGeometry: .addDrawCall() is now .addGroup()."),this.addGroup(r,e)};Ge.prototype.clearDrawCalls=function(){console.warn("THREE.BufferGeometry: .clearDrawCalls() is now .clearGroups()."),this.clearGroups()};Ge.prototype.computeOffsets=function(){console.warn("THREE.BufferGeometry: .computeOffsets() has been removed.")};Ge.prototype.removeAttribute=function(r){return console.warn("THREE.BufferGeometry: .removeAttribute() has been renamed to .deleteAttribute()."),this.deleteAttribute(r)};Ge.prototype.applyMatrix=function(r){return console.warn("THREE.BufferGeometry: .applyMatrix() has been renamed to .applyMatrix4()."),this.applyMatrix4(r)};Object.defineProperties(Ge.prototype,{drawcalls:{get:function(){return console.error("THREE.BufferGeometry: .drawcalls has been renamed to .groups."),this.groups}},offsets:{get:function(){return console.warn("THREE.BufferGeometry: .offsets has been renamed to .groups."),this.groups}}});Kn.prototype.setDynamic=function(r){return console.warn("THREE.InterleavedBuffer: .setDynamic() has been deprecated. Use .setUsage() instead."),this.setUsage(r===!0?Ws:Er),this};Kn.prototype.setArray=function(){console.error("THREE.InterleavedBuffer: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers")};zi.prototype.getArrays=function(){console.error("THREE.ExtrudeGeometry: .getArrays() has been removed.")};zi.prototype.addShapeList=function(){console.error("THREE.ExtrudeGeometry: .addShapeList() has been removed.")};zi.prototype.addShape=function(){console.error("THREE.ExtrudeGeometry: .addShape() has been removed.")};$n.prototype.dispose=function(){console.error("THREE.Scene: .dispose() has been removed.")};Ml.prototype.onUpdate=function(){return console.warn("THREE.Uniform: .onUpdate() has been removed. Use object.onBeforeRender() instead."),this};Object.defineProperties(ut.prototype,{wrapAround:{get:function(){console.warn("THREE.Material: .wrapAround has been removed.")},set:function(){console.warn("THREE.Material: .wrapAround has been removed.")}},overdraw:{get:function(){console.warn("THREE.Material: .overdraw has been removed.")},set:function(){console.warn("THREE.Material: .overdraw has been removed.")}},wrapRGB:{get:function(){return console.warn("THREE.Material: .wrapRGB has been removed."),new pe}},shading:{get:function(){console.error("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead.")},set:function(r){console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=r===Lu}},stencilMask:{get:function(){return console.warn("THREE."+this.type+": .stencilMask has been removed. Use .stencilFuncMask instead."),this.stencilFuncMask},set:function(r){console.warn("THREE."+this.type+": .stencilMask has been removed. Use .stencilFuncMask instead."),this.stencilFuncMask=r}}});Object.defineProperties(qe.prototype,{derivatives:{get:function(){return console.warn("THREE.ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives},set:function(r){console.warn("THREE. ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives=r}}});Ye.prototype.clearTarget=function(r,e,t,n){console.warn("THREE.WebGLRenderer: .clearTarget() has been deprecated. Use .setRenderTarget() and .clear() instead."),this.setRenderTarget(r),this.clear(e,t,n)};Ye.prototype.animate=function(r){console.warn("THREE.WebGLRenderer: .animate() is now .setAnimationLoop()."),this.setAnimationLoop(r)};Ye.prototype.getCurrentRenderTarget=function(){return console.warn("THREE.WebGLRenderer: .getCurrentRenderTarget() is now .getRenderTarget()."),this.getRenderTarget()};Ye.prototype.getMaxAnisotropy=function(){return console.warn("THREE.WebGLRenderer: .getMaxAnisotropy() is now .capabilities.getMaxAnisotropy()."),this.capabilities.getMaxAnisotropy()};Ye.prototype.getPrecision=function(){return console.warn("THREE.WebGLRenderer: .getPrecision() is now .capabilities.precision."),this.capabilities.precision};Ye.prototype.resetGLState=function(){return console.warn("THREE.WebGLRenderer: .resetGLState() is now .state.reset()."),this.state.reset()};Ye.prototype.supportsFloatTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsFloatTextures() is now .extensions.get( 'OES_texture_float' )."),this.extensions.get("OES_texture_float")};Ye.prototype.supportsHalfFloatTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsHalfFloatTextures() is now .extensions.get( 'OES_texture_half_float' )."),this.extensions.get("OES_texture_half_float")};Ye.prototype.supportsStandardDerivatives=function(){return console.warn("THREE.WebGLRenderer: .supportsStandardDerivatives() is now .extensions.get( 'OES_standard_derivatives' )."),this.extensions.get("OES_standard_derivatives")};Ye.prototype.supportsCompressedTextureS3TC=function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTextureS3TC() is now .extensions.get( 'WEBGL_compressed_texture_s3tc' )."),this.extensions.get("WEBGL_compressed_texture_s3tc")};Ye.prototype.supportsCompressedTexturePVRTC=function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTexturePVRTC() is now .extensions.get( 'WEBGL_compressed_texture_pvrtc' )."),this.extensions.get("WEBGL_compressed_texture_pvrtc")};Ye.prototype.supportsBlendMinMax=function(){return console.warn("THREE.WebGLRenderer: .supportsBlendMinMax() is now .extensions.get( 'EXT_blend_minmax' )."),this.extensions.get("EXT_blend_minmax")};Ye.prototype.supportsVertexTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsVertexTextures() is now .capabilities.vertexTextures."),this.capabilities.vertexTextures};Ye.prototype.supportsInstancedArrays=function(){return console.warn("THREE.WebGLRenderer: .supportsInstancedArrays() is now .extensions.get( 'ANGLE_instanced_arrays' )."),this.extensions.get("ANGLE_instanced_arrays")};Ye.prototype.enableScissorTest=function(r){console.warn("THREE.WebGLRenderer: .enableScissorTest() is now .setScissorTest()."),this.setScissorTest(r)};Ye.prototype.initMaterial=function(){console.warn("THREE.WebGLRenderer: .initMaterial() has been removed.")};Ye.prototype.addPrePlugin=function(){console.warn("THREE.WebGLRenderer: .addPrePlugin() has been removed.")};Ye.prototype.addPostPlugin=function(){console.warn("THREE.WebGLRenderer: .addPostPlugin() has been removed.")};Ye.prototype.updateShadowMap=function(){console.warn("THREE.WebGLRenderer: .updateShadowMap() has been removed.")};Ye.prototype.setFaceCulling=function(){console.warn("THREE.WebGLRenderer: .setFaceCulling() has been removed.")};Ye.prototype.allocTextureUnit=function(){console.warn("THREE.WebGLRenderer: .allocTextureUnit() has been removed.")};Ye.prototype.setTexture=function(){console.warn("THREE.WebGLRenderer: .setTexture() has been removed.")};Ye.prototype.setTexture2D=function(){console.warn("THREE.WebGLRenderer: .setTexture2D() has been removed.")};Ye.prototype.setTextureCube=function(){console.warn("THREE.WebGLRenderer: .setTextureCube() has been removed.")};Ye.prototype.getActiveMipMapLevel=function(){return console.warn("THREE.WebGLRenderer: .getActiveMipMapLevel() is now .getActiveMipmapLevel()."),this.getActiveMipmapLevel()};Object.defineProperties(Ye.prototype,{shadowMapEnabled:{get:function(){return this.shadowMap.enabled},set:function(r){console.warn("THREE.WebGLRenderer: .shadowMapEnabled is now .shadowMap.enabled."),this.shadowMap.enabled=r}},shadowMapType:{get:function(){return this.shadowMap.type},set:function(r){console.warn("THREE.WebGLRenderer: .shadowMapType is now .shadowMap.type."),this.shadowMap.type=r}},shadowMapCullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")}},context:{get:function(){return console.warn("THREE.WebGLRenderer: .context has been removed. Use .getContext() instead."),this.getContext()}},vr:{get:function(){return console.warn("THREE.WebGLRenderer: .vr has been renamed to .xr"),this.xr}},gammaInput:{get:function(){return console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead."),!1},set:function(){console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead.")}},gammaOutput:{get:function(){return console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead."),!1},set:function(r){console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead."),this.outputEncoding=r===!0?Nl:qi}},toneMappingWhitePoint:{get:function(){return console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed."),1},set:function(){console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed.")}}});Object.defineProperties(Yu.prototype,{cullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")}},renderReverseSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")}},renderSingleSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")}}});Object.defineProperties(jt.prototype,{wrapS:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS},set:function(r){console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS=r}},wrapT:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT},set:function(r){console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT=r}},magFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter},set:function(r){console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter=r}},minFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter},set:function(r){console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter=r}},anisotropy:{get:function(){return console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy},set:function(r){console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy=r}},offset:{get:function(){return console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset},set:function(r){console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset=r}},repeat:{get:function(){return console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat},set:function(r){console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat=r}},format:{get:function(){return console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format},set:function(r){console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format=r}},type:{get:function(){return console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type},set:function(r){console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type=r}},generateMipmaps:{get:function(){return console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps},set:function(r){console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps=r}}});gl.prototype.load=function(r){console.warn("THREE.Audio: .load has been deprecated. Use THREE.AudioLoader instead.");let e=this;return new fl().load(r,function(n){e.setBuffer(n)}),this};vl.prototype.getData=function(){return console.warn("THREE.AudioAnalyser: .getData() is now .getFrequencyData()."),this.getFrequencyData()};Cr.prototype.updateCubeMap=function(r,e){return console.warn("THREE.CubeCamera: .updateCubeMap() is now .update()."),this.update(r,e)};Cr.prototype.clear=function(r,e,t,n){return console.warn("THREE.CubeCamera: .clear() is now .renderTarget.clear()."),this.renderTarget.clear(r,e,t,n)};Bn.crossOrigin=void 0;Bn.loadTexture=function(r,e,t,n){console.warn("THREE.ImageUtils.loadTexture has been deprecated. Use THREE.TextureLoader() instead.");let i=new Hr;i.setCrossOrigin(this.crossOrigin);let s=i.load(r,t,void 0,n);return e&&(s.mapping=e),s};Bn.loadTextureCube=function(r,e,t,n){console.warn("THREE.ImageUtils.loadTextureCube has been deprecated. Use THREE.CubeTextureLoader() instead.");let i=new Ka;i.setCrossOrigin(this.crossOrigin);let s=i.load(r,t,void 0,n);return e&&(s.mapping=e),s};Bn.loadCompressedTexture=function(){console.error("THREE.ImageUtils.loadCompressedTexture has been removed. Use THREE.DDSLoader instead.")};Bn.loadCompressedTextureCube=function(){console.error("THREE.ImageUtils.loadCompressedTextureCube has been removed. Use THREE.DDSLoader instead.")};typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"128"}}));typeof window!="undefined"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="128");var eh=`
uniform sampler2D aux; uniform float uH; uniform float uE; uniform float uGlitch; uniform float uTime; uniform vec2 uO;
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vUv = uv;
  float h = texture2D(aux, uv).r * uH;
  float se = sin(uE), ce = cos(uE);
  // the photo was shot from elevation uE: lay its plane flat, push each pixel out along the old view axis
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x, h * se, -q.y / se + h * ce);
  float n = fract(sin(floor(uv.y * 30.0) * 91.7 + floor(uTime * 24.0) * 13.3) * 43758.5453);
  p.x += (n - 0.5) * 0.2 * uGlitch * step(0.5, fract(n * 7.3));
  vY = p.y;
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,th=`
uniform sampler2D map; uniform sampler2D aux;
uniform float uH; uniform float uFocus; uniform float uReveal; uniform float uTime; uniform float uScan; uniform float uGlitch;
uniform float uGlow; uniform float uMirror; uniform vec3 uAccent; uniform vec3 uCenter;
uniform float uHolo; uniform float uLight; uniform float uRefl; uniform vec4 uMask; uniform float uSat;   // [view] uSat: a sold-out dish is drained of colour \xB7 uHolo: 1 = drawn as a projection (a placeholder, or the projector stage)
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vec4 ax = texture2D(aux, vUv);
  float a = ax.g;
  if (a < 0.03) discard;
  if (uMirror > 0.5 && uGlow > 0.5) discard;
  vec3 c = texture2D(map, vUv).rgb;
  if (uHolo < 0.5) {            // on a table: the dish as photographed, under the lamp; no hologram treatment
    float fade = a * uReveal;
    vec3 ct = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat) * uLight;
    if (uGlow > 0.5) { gl_FragColor = vec4(ct * smoothstep(0.74, 1.0, dot(c, vec3(0.299, 0.587, 0.114))) * 0.1, fade); return; }
    if (uMirror > 0.5) {        // a glossy table gives standing things a faint reflection
      float inside = 1.0 - smoothstep(uMask.y - 0.3, uMask.y, abs(vW.x - uMask.x));      // [view] only on its own table top
      gl_FragColor = vec4(ct * 0.85, fade * uRefl * inside * exp(-vY * 2.6)); return;
    }
    gl_FragColor = vec4(ct, fade); return;
  }
  if (uGlitch > 0.01) { vec2 ca = vec2(0.016 * uGlitch, 0.0); c.r = texture2D(map, vUv + ca).r; c.b = texture2D(map, vUv - ca).b; }
  float tx = 1.0 / 256.0;
  float gx = texture2D(aux, vUv + vec2(tx, 0.0)).r - texture2D(aux, vUv - vec2(tx, 0.0)).r;
  float gy = texture2D(aux, vUv + vec2(0.0, tx)).r - texture2D(aux, vUv - vec2(0.0, tx)).r;
  float steep = smoothstep(0.08, 0.5, length(vec2(gx, gy)) * uH * 22.0);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 holo = mix(uAccent * (pow(l, 0.8) * 1.45 + 0.08), c * 1.05, 0.7);            // [view] an illustration keeps about 70% of its own colour and leans lightly towards the menu's accent
  vec3 col = mix(holo, c * 1.03, uFocus);
  col *= 1.0 - 0.12 * steep * (1.0 - uFocus * 0.5);
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 2.1 + uTime * 0.5);                  // fine scan lines, drifting slowly: no flicker
  col *= 1.0 - mix(0.13, 0.018, uFocus) * sl;
  float edge = smoothstep(0.03, 0.5, a) * (1.0 - smoothstep(0.6, 0.99, a));
  vec3 em = uAccent * edge * mix(0.55, 0.5, uFocus);
  em += uAccent * exp(-pow((vY - uScan) / 0.026, 2.0)) * 0.6;
  float r = length(vUv - 0.5) * 1.45, front = uReveal * 1.3;
  float vis = 1.0 - smoothstep(front - 0.03, front, r);
  em += uAccent * smoothstep(front - 0.16, front - 0.02, r) * vis * 1.3;
  float bar = step(0.8, fract(sin(floor(vUv.y * 30.0) * 12.9898 + floor(uTime * 24.0) * 7.1) * 43758.5453));
  em += uAccent * uGlitch * (0.25 + bar * 0.6);
  float al = a * vis * mix(0.84, 1.0, uFocus);
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))) * 0.7, col, uSat) * mix(0.5, 1.0, uLight); em *= mix(0.35, 1.0, uSat) * mix(0.45, 1.0, uLight);   // [view]
  if (uGlow > 0.5) {            // light-only pass, feeds the bloom; the dish still hides what is behind it
    gl_FragColor = vec4(em + holo * (1.0 - uFocus) * 0.07 + c * smoothstep(0.7, 1.0, l) * 0.12 * uFocus, a * vis);
    return;
  }
  col += em;
  if (uMirror > 0.5) {          // reflection in the projector glass
    float rr = length(vW.xz - uCenter.xz);
    float m = (1.0 - smoothstep(1.0, 1.3, rr)) * exp(-vY * 4.5);
    gl_FragColor = vec4(mix(col, uAccent * (l + 0.1), 0.4), al * 0.34 * m);
    return;
  }
  gl_FragColor = vec4(col, al);
}`,nh=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.014, 0.0, abs(r - 0.955)) * 1.3 + 0.6 * smoothstep(0.01, 0.0, abs(r - 0.8));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.875));
  float tick = step(0.86, fract(an * 60.0 / 6.2831853)) * smoothstep(0.03, 0.0, abs(r - 0.68)) * 0.6;
  float lens = smoothstep(0.34, 0.0, r) * 0.4 + smoothstep(0.012, 0.0, abs(r - 0.36)) * 0.7;
  float glow = pow(max(0.0, 1.0 - r), 2.0) * 0.5;
  float a = (ring + dash * 0.9 + tick + glow + lens * uOn) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  float glass = step(r, 1.0) * 0.8;          // dark glass under the light
  gl_FragColor = vec4(uAccent * a, glass);
}`,ih=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.016, 0.0, abs(r - 0.93)) * 1.2 + 0.5 * smoothstep(0.01, 0.0, abs(r - 0.80));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.865));
  float glow = pow(max(0.0, 1.0 - r), 1.5) * 0.5;
  float a = (ring + dash * 0.8 + glow) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  gl_FragColor = vec4(uAccent * a, a);
}`,rh=`
uniform vec3 uAccent; uniform float uOn;
varying vec2 vUv;
void main(){
  float lip = smoothstep(0.7, 0.98, vUv.y);
  vec3 body = vec3(0.02, 0.03, 0.045) + uAccent * 0.05;
  gl_FragColor = vec4(body + uAccent * lip * mix(0.35, 1.0, uOn), 1.0);
}`,sh=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.72 + 0.28 * sin(vUv.x * 190.0 + sin(vUv.x * 37.0) * 4.0);
  float rise = 0.85 + 0.15 * sin(vUv.y * 26.0 - uTime * 3.0);
  float a = pow(1.0 - vUv.y, 1.6) * 0.42 * streak * rise * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`,oh=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.6 + 0.4 * sin(vUv.x * 120.0 + sin(vUv.x * 23.0 + uTime * 0.3) * 5.0);
  float a = pow(1.0 - vUv.y, 2.4) * 0.2 * streak * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`,kl=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn; uniform float uKind;
varying vec3 vL;
void main(){
  float r = length(vL.xz), an = atan(vL.z, vL.x) / 6.2831853 + 0.5, a = 0.0;
  if (uKind < 0.5) {            // flat instrument ring around the projector
    float t = an + uTime * 0.012;
    a += smoothstep(0.01, 0.0, abs(r - 1.5)) * 0.55;
    a += step(0.5, fract(t * 180.0)) * smoothstep(0.03, 0.0, abs(r - 1.55)) * 0.4;
    a += step(0.88, fract(t * 12.0)) * smoothstep(0.055, 0.0, abs(r - 1.575)) * 0.9;
    a += smoothstep(0.016, 0.0, abs(r - 1.69)) * step(0.66, fract(-an * 3.0 + uTime * 0.045));
  } else if (uKind < 1.5) {     // tilted orbit with one bright satellite
    float d = abs(fract(an - uTime * 0.07) - 0.5);
    a += smoothstep(0.012, 0.0, abs(r - 1.86)) * (0.2 + 0.9 * smoothstep(0.16, 0.0, d));
    a += smoothstep(0.05, 0.0, length(vec2((fract(an - uTime * 0.07) - 0.5) * 11.7, r - 1.86))) * 1.6;
  } else {                      // scanner hoop that rides up with the scan line
    a += smoothstep(0.011, 0.0, abs(r - 1.3)) * 0.8 + smoothstep(0.12, 0.0, abs(r - 1.3)) * 0.07;
  }
  a *= uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`,ah=`
uniform vec3 uAccent; uniform float uTime; uniform vec2 uHub; uniform float uPulse; uniform float uGlow; uniform vec2 uAt;   // [view] uAt: the light pools under the open item, not the origin
varying vec3 vW;
void main(){
  vec2 q = vW.xz - uHub; float r = length(q); float an = atan(q.y, q.x);
  float rings = smoothstep(0.03, 0.0, abs(fract(r * 0.5) - 0.5) * 2.0 - 0.94);
  float spokes = smoothstep(0.012, 0.0, abs(fract(an * 24.0 / 6.2831853) - 0.5) * 2.0 - 0.985 + 0.012 / max(r, 0.4));
  float d0 = length(vW.xz - uAt);
  float fade = exp(-d0 * 0.16) * smoothstep(13.0, 6.0, d0);
  float pool = exp(-d0 * d0 * 0.22) * 0.5;
  float rp = uPulse * 5.5;
  float ripple = exp(-pow((d0 - rp) / 0.16, 2.0)) * exp(-uPulse * 2.6) * step(1.3, d0) * 1.3;
  float a = ((rings * 0.42 + spokes * 0.26) * fade + pool + ripple) * mix(1.0, 0.45, uGlow);
  gl_FragColor = vec4(uAccent * a * 0.55, a * 0.55);
}`,lh=`
uniform float uE; uniform vec2 uO; uniform float uLen; uniform vec2 uCast;   // [view] uCast: pushed away from wherever the lamp is
varying vec2 vUv;
void main(){
  vUv = uv;
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x * 1.05, 0.0, -q.y / sin(uE) * uLen * 1.05 - 0.02) + vec3(uCast.x, 0.0, uCast.y);         // the dish's outline on the table, pushed a little away from the lamp
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,ch=`
uniform sampler2D aux; uniform float uK;
varying vec2 vUv;
float tap(vec2 o){ return texture2D(aux, vUv + o).g; }
void main(){
  float a = tap(vec2(0.0));
  float near = (a + tap(vec2(0.012, 0.0)) + tap(vec2(-0.012, 0.0)) + tap(vec2(0.0, 0.012)) + tap(vec2(0.0, -0.012))) / 5.0;
  float far = (tap(vec2(0.045, 0.012)) + tap(vec2(-0.045, -0.012)) + tap(vec2(0.012, -0.045)) + tap(vec2(-0.012, 0.045))
             + tap(vec2(0.032, 0.032)) + tap(vec2(-0.032, 0.032)) + tap(vec2(0.032, -0.032)) + tap(vec2(-0.032, -0.032))) / 8.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, (near * 0.55 + far * 0.45) * uK);
}`;var uh=`
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tex, vUv) * 0.227027;
  s += (texture2D(tex, vUv + dir * 1.384615) + texture2D(tex, vUv - dir * 1.384615)) * 0.316216;
  s += (texture2D(tex, vUv + dir * 3.230769) + texture2D(tex, vUv - dir * 3.230769)) * 0.070270;
  gl_FragColor = s;
}`,hh=`
uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.95) * k;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
}`,dh="uniform sampler2D map; uniform float uGlow; uniform float uK; uniform float uLight; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, t.a * uK); return; } gl_FragColor = vec4(t.rgb * uLight, t.a * uK); }",Ot="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",Gl="varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",Xr="varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }";var Vl="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",fh=`
uniform vec4 uLane; uniform vec2 uLanes;
float laneEdge(vec3 w, out float j){ j = clamp(floor((w.x - uLane.x) / uLane.z + 0.5), -uLanes.x, uLanes.y); return uLane.y - abs(w.x - uLane.x - j * uLane.z); }`,ph=`
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam;
uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
varying vec3 vW;
${fh}
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }      // the table gives off no light, it only hides what is under it
  float j; float edge = laneEdge(vW, j);
  vec2 uv = (vW.xz + vec2(j * 1.731, j * 0.413)) / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r,
                texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 l = normalize(uLampPos - vW);
  float d = length(vW.xz - uPool.xy);
  float pool = uDim / pow(1.0 + d * d / uPool.z, 1.5);
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 hv = normalize(l + normalize(uCam - vW));
  float sp = pow(max(dot(n, hv), 0.0), uShin) * uSpec * pool;
  vec3 amb = vec3(0.105, 0.097, 0.09) * (0.45 + 0.55 * uDim);                       // the room is dim, never black: the table shows its own wood to every edge of the screen
  vec3 col = alb * (amb + uLamp * dif * 1.25) + uLamp * sp;
  col = mix(col, alb * amb * 0.85, 0.9 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y)));     // far along it: the same wood, in shadow
  col *= 0.7 + 0.3 * smoothstep(0.0, 0.34, edge);                                   // the top darkens a little towards its long edges,
  col += uLamp * alb * 0.5 * pool * smoothstep(0.05, 0.0, abs(edge - 0.035));       // which catch a line of light
  col *= smoothstep(0.0, 0.02, edge);                                              // beside the table: the dark of the room
  gl_FragColor = vec4(sqrt(col) * uFade, 1.0);
}`,mh=`
uniform sampler2D map; uniform float uLight; uniform float uReveal; uniform float uGlow; uniform float uSat;
uniform vec2 uSize; uniform float uBorder; uniform vec4 uFit; uniform vec3 uTint; uniform float uBlank;
varying vec2 vUv;
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, uReveal); return; }
  vec2 p = vUv * uSize; vec3 col = vec3(0.94, 0.92, 0.88);
  if (uBlank > 0.5) { col = vec3(0.80, 0.77, 0.72); }
  else if (uBorder <= 0.0 || (p.x > uBorder && p.y > uBorder && p.x < uSize.x - uBorder && p.y < uSize.y - uBorder)) {
    vec2 uv = uBorder > 0.0 ? (p - uBorder) / (uSize - 2.0 * uBorder) : vUv;
    col = texture2D(map, (uv - 0.5) * uFit.xy + 0.5 + uFit.zw).rgb;
  }
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat);
  gl_FragColor = vec4(col * uTint * uLight, uReveal);
}`,yo=`
uniform float uK; varying vec2 vUv;
void main(){ vec2 p = (vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, length(p * vec2(1.0, 1.0))); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uK); }`,gh=`
float bbHash(float n){ return fract(sin(n * 91.345) * 47453.5453); }
vec3 backbar(vec2 p){
  vec3 col = vec3(0.030, 0.024, 0.020) * (0.5 + 0.5 * smoothstep(-1.0, 7.0, p.y));
  for (int i = 0; i < 2; i++) {
    float fi = float(i), sy = -0.05 + fi * 2.75, up = p.y - sy;
    float wash = smoothstep(-0.02, 0.14, up) * smoothstep(2.6, 1.3, up);                    // warm light on the wall above each shelf
    col += vec3(1.0, 0.56, 0.22) * wash * (0.08 + 0.30 * smoothstep(0.1, 2.4, up));
    float cell = 0.78, u = p.x / cell + fi * 0.37, ix = floor(u), fx = (fract(u) - 0.5) * cell;
    float h = 1.2 + 0.8 * bbHash(ix * 1.7 + fi * 13.0), w = 0.17 + 0.10 * bbHash(ix * 3.1 + 2.0);
    float hw = mix(w, w * 0.34, smoothstep(h * 0.60, h * 0.80, up));
    float body = smoothstep(hw + 0.13, hw - 0.09, abs(fx)) * smoothstep(-0.06, 0.14, up) * smoothstep(h + 0.12, h - 0.14, up) * step(0.14, bbHash(ix * 5.3 + fi));
    vec3 tint = mix(vec3(0.46, 0.18, 0.04), vec3(0.10, 0.24, 0.08), step(0.5, bbHash(ix * 7.7)));
    tint = mix(tint, vec3(0.52, 0.44, 0.30), step(0.78, bbHash(ix * 2.9)));
    col = mix(col, tint * (0.07 + 0.80 * wash * (0.45 + 0.55 * bbHash(ix * 9.1))), body * 0.86);   // glass glowing with the light behind it
    col += vec3(1.0, 0.86, 0.62) * smoothstep(0.13, 0.0, length(vec2(fx + w * 0.42, (up - h * 0.42) * 0.3))) * body * 0.30;
    col = mix(col, vec3(0.012, 0.010, 0.009), smoothstep(0.03, -0.02, up) * smoothstep(-0.20, -0.13, up));      // the shelf board
    col += vec3(1.0, 0.60, 0.26) * smoothstep(0.04, 0.0, abs(up + 0.015)) * 0.20;                                 // a line of light on its edge
  }
  return col;
}`,vh=`
uniform float uFade; uniform float uGlow;
varying vec3 vW;
${gh}
void main(){
  vec3 c = backbar(vW.xy);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(c - 0.22, 0.0) * 0.5 * uFade, 1.0); return; }
  gl_FragColor = vec4(c * uFade, 1.0);
}`,xh=`
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam; uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
uniform float uBack; uniform float uGloss;
varying vec3 vW;
${fh}
${gh}
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float j; float edge = laneEdge(vW, j);
  vec2 uv = (vW.xz + vec2(j * 1.731, j * 0.413)) / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r,
                texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 l = normalize(uLampPos - vW);
  float d = length(vW.xz - uPool.xy);
  float pool = uDim / pow(1.0 + d * d / uPool.z, 1.5);
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 v = normalize(uCam - vW);
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), uShin) * uSpec * pool;
  vec3 amb = vec3(0.085, 0.08, 0.08) * (0.45 + 0.55 * uDim);
  vec3 col = sqrt(alb * (amb + uLamp * dif * 1.25) + uLamp * sp);
  col *= 1.0 - 0.55 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y));
  vec3 r = reflect(-v, normalize(vec3(n.x * 0.35, 1.0, n.z * 0.35)));
  if (r.z < -0.001) {
    float t = (uBack - vW.z) / r.z; vec2 hp = vec2(vW.x + r.x * t, r.y * t);
    vec3 rf = (backbar(hp) + backbar(vec2(hp.x, hp.y * 1.14)) + backbar(vec2(hp.x, hp.y * 0.88))) / 3.0;       // a honed surface smears the light upward
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(v, n), 0.0), 4.0);
    col += rf * fres * uGloss * smoothstep(9.0, 1.0, hp.y) * (0.3 + 0.7 * uDim);
  }
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.3, edge);
  col += vec3(1.0, 0.72, 0.42) * 0.05 * pool * smoothstep(0.05, 0.0, abs(edge - 0.035));       // the edge of the counter catches a little light
  col *= smoothstep(0.0, 0.02, edge) * smoothstep(0.0, 1.2, vW.z - uBack);
  gl_FragColor = vec4(col * uFade, 1.0);
}`,Pv=`
vec3 env(vec3 d){
  vec3 c = vec3(0.022, 0.019, 0.017);
  c += vec3(1.0, 0.60, 0.26) * smoothstep(0.15, -0.85, d.z) * smoothstep(-0.30, 0.10, d.y) * smoothstep(0.80, 0.25, d.y) * 0.50;
  c += vec3(1.0, 0.96, 0.90) * smoothstep(0.90, 0.985, dot(d, normalize(vec3(-0.45, 0.72, 0.52)))) * 1.9;
  float az = atan(d.x, d.z);
  c += vec3(0.92, 0.96, 1.0) * smoothstep(0.085, 0.03, abs(az - 0.95)) * smoothstep(-0.15, 0.15, d.y) * smoothstep(0.92, 0.62, d.y) * 1.1;
  c += vec3(1.0, 0.94, 0.86) * smoothstep(0.05, 0.015, abs(az + 1.25)) * smoothstep(-0.05, 0.2, d.y) * smoothstep(0.8, 0.5, d.y) * 0.5;
  c += vec3(0.10, 0.09, 0.085) * smoothstep(0.0, -0.7, d.y);
  return c;
}`,yh=`
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
void main(){
  vUv = uv; vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,_o=`
uniform vec3 uCam; uniform float uReveal; uniform float uLight; uniform float uSat; uniform float uGlow; uniform float uMirror; uniform float uRefl;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
${Pv}
vec3 grey(vec3 c){ return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat); }
float mirrorFade(){ return uMirror > 0.5 ? uRefl * exp(vW.y * 1.5) * 0.9 : 1.0; }      // below the counter: the reflection, fading with depth
`,Wl=`
uniform vec3 uTint; uniform float uDark; uniform vec3 uInside; uniform float uHasFill; uniform vec3 uUp; uniform float uFillD;
${_o}
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0);
  vec3 e = env(reflect(-V, N));
  vec3 clear = e * (0.22 + 0.95 * F) + uTint * 0.035;
  float aClear = clamp(0.045 + 0.72 * F + dot(e, vec3(0.34)) * 0.95, 0.0, 0.96);
  vec3 body = uTint * (0.30 + 0.70 * nv) * (0.35 + 0.65 * uLight) + uTint * 1.6 * F * 0.35 + e * (0.26 + 0.80 * F);
  vec3 col = mix(clear, body, uDark); float a = mix(aClear, 1.0, uDark);
  if (uHasFill > 0.5 && dot(vL, uUp) < uFillD) {                    // wine seen through a clear bottle
    col = mix(uInside * 1.25, uInside * 0.62, pow(nv, 1.6)) * (0.34 + 0.66 * uLight) * (1.0 - 0.5 * F) + e * (0.30 + 1.0 * F) + uTint * 0.03; a = 1.0;
  }
  col = grey(col);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(e - 0.8, 0.0) * 0.10 * uReveal, a * uReveal); return; }
  gl_FragColor = vec4(col, a * uReveal * mirrorFade());
}`,Kt=`
uniform sampler2D map; uniform float uUseMap; uniform vec3 uTint; uniform float uMetal; uniform vec3 uLampPos;
${_o}
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0);
  vec3 base = uUseMap > 0.5 ? texture2D(map, vUv).rgb : uTint;
  vec3 e = env(reflect(-V, N));
  float dif = 0.42 + 0.58 * max(dot(N, normalize(uLampPos - vW)), 0.0);
  vec3 paper = base * dif * (0.30 + 0.70 * uLight) * vec3(1.0, 0.97, 0.92) + e * F * 0.10;
  vec3 metal = base * (0.16 * uLight + e * 1.7 + 0.10);
  vec3 col = grey(mix(paper, metal, uMetal));
  if (uGlow > 0.5) { gl_FragColor = vec4(max(e - 0.8, 0.0) * 0.12 * uMetal * uReveal, uReveal); return; }
  gl_FragColor = vec4(col, uReveal * mirrorFade());
}`,_h=`
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uLevel; uniform float uFoam; uniform vec2 uWob; uniform vec3 uAt; uniform float uAlpha; uniform float uTime;
${_o}
float fh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float fn(vec3 p){                                               // smooth noise: a foam of small bubbles, not squares
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1, 0, 0)), f.x), mix(fh(i + vec3(0, 1, 0)), fh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fh(i + vec3(0, 0, 1)), fh(i + vec3(1, 0, 1)), f.x), mix(fh(i + vec3(0, 1, 1)), fh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main(){
  float y = uMirror > 0.5 ? -vW.y : vW.y;
  float lvl = uLevel + dot(vW.xz - uAt.xz, uWob);
  if (y > lvl + uFoam) discard;
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0);
  vec3 col;
  if (y > lvl) {                                                   // the head
    float b = fn(vL * 150.0) * 0.55 + fn(vL * 60.0) * 0.45;
    col = uFoamCol * (0.82 + 0.18 * b) * (0.45 + 0.55 * uLight) * (0.82 + 0.18 * nv);
    col = mix(col, uEdge * 0.9, smoothstep(0.05, 0.0, y - lvl) * 0.45);
  } else {
    float thick = pow(nv, 2.2) * (0.72 + 0.28 * smoothstep(0.0, 0.6, lvl - y));
    col = mix(uEdge, uDeep, thick);
    vec3 through = env(refract(-V, N, 0.76));
    col += uEdge * dot(through, vec3(0.42)) * (1.0 - 0.6 * thick);          // the room, seen through the wine
    col *= 0.50 + 0.50 * uLight;
    col = mix(col, uEdge * 1.15, smoothstep(0.035, 0.0, lvl - y) * 0.55);   // meniscus
    col += env(reflect(-V, N)) * pow(1.0 - nv, 3.0) * 0.25;
  }
  col = grey(col);
  float a = uReveal * uAlpha;
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a * mirrorFade() * (uMirror > 0.5 ? 0.4 : 1.0));      // in the counter the drink is a hint of colour, no more
}`,wh=`
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uFoamy; uniform float uAlpha;
${_o}
float fh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec3 N = vec3(0.0, 1.0, 0.0), V = normalize(uCam - vW);
  float nv = max(dot(N, V), 0.0), F = pow(1.0 - nv, 3.0), r = length(vUv - 0.5) * 2.0;
  vec3 liquid = mix(uDeep, uEdge, 0.35 + 0.65 * smoothstep(0.55, 1.0, r)) * (0.5 + 0.5 * uLight) + env(reflect(-V, N)) * (0.10 + 0.7 * F);
  vec3 foam = uFoamCol * (0.86 + 0.14 * fn(vUv * 60.0)) * (0.5 + 0.5 * uLight);
  vec3 col = grey(mix(liquid, foam, uFoamy));
  float a = uReveal * uAlpha * smoothstep(1.0, 0.97, r);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a);
}`,bh=`
uniform vec3 uA; uniform vec3 uB; uniform float uR;
varying float vU; varying float vS;
void main(){
  float u = position.y + 0.5; vU = u; vS = position.x;
  vec3 c = vec3(mix(uA.x, uB.x, sqrt(u)), mix(uA.y, uB.y, u), mix(uA.z, uB.z, sqrt(u)));       // sideways speed constant, falling faster
  float r = uR * mix(1.0, 0.5, u);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(position.x, 0.0, position.z) * r, 1.0);
}`,Mh=`
uniform vec3 uEdge; uniform vec3 uDeep; uniform float uHead; uniform float uTail; uniform float uReveal; uniform float uLight; uniform float uGlow; uniform float uTime;
varying float vU; varying float vS;
void main(){
  if (vU > uHead || vU < uTail) discard;
  float core = 1.0 - abs(vS);
  vec3 col = mix(uDeep, uEdge, 0.55 + 0.45 * core) * (0.55 + 0.45 * uLight) + vec3(1.0, 0.97, 0.9) * smoothstep(0.55, 0.9, core) * (0.20 + 0.10 * sin(vU * 40.0 - uTime * 30.0));
  float a = 0.9 * uReveal * smoothstep(uTail, uTail + 0.04, vU);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a);
}`,Sh=`
attribute float aSeed; uniform float uTime; uniform float uPx; uniform float uOn; uniform float uBase; uniform float uTop; uniform float uR; uniform float uSize;
varying float vA;
void main(){
  float t = fract(aSeed * 7.13 + uTime * (0.22 + 0.30 * fract(aSeed * 3.7)));
  float k = 0.30 + 0.70 * t;
  vec3 p = vec3(position.x * uR * k + sin(uTime * 3.0 + aSeed * 40.0) * 0.006, mix(uBase, uTop, t), position.z * uR * k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (0.8 + 1.4 * fract(aSeed * 5.3)) * uPx * uSize / max(-mv.z, 0.5);
  vA = sin(t * 3.14159) * (0.35 + 0.65 * fract(aSeed * 9.1)) * uOn;
  gl_Position = projectionMatrix * mv;
}`,Th="uniform vec3 uCol; uniform float uGlow; varying float vA; void main(){ if (vA < 0.004) discard; float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, d) * vA; gl_FragColor = vec4(uCol * a * (uGlow > 0.5 ? 0.0 : 1.0), 0.0); }",Eh=`
uniform vec3 uCol; uniform float uK; uniform float uGlow; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float a = smoothstep(1.0, 0.1, r) * (0.55 + 0.45 * smoothstep(0.9, 0.2, abs(r - 0.45) * 2.2)) * uK * (uGlow > 0.5 ? 0.0 : 1.0);
  gl_FragColor = vec4(uCol * a, 0.0);
}`;var wo='"Frank Ruhl Libre","Times New Roman",serif',ii='"IBM Plex Sans Hebrew",Arial,sans-serif',ql=r=>typeof r=="string"?r:"rgb("+r.map(e=>Math.round(Math.min(1,Math.max(0,e))*255)).join(",")+")";function Dv(r,e){try{r.direction=rs(e)?"rtl":"ltr"}catch{}}function bo(r,e,t){try{r.letterSpacing=rs(e)?"0px":t+"px"}catch{}}function Qt(r,e,t,n,i,s,o,a,l=1,c=!1){if(e=String(e||"").trim(),!e)return 0;c&&!rs(e)&&(e=e.toUpperCase()),Dv(r,e);let u=e.split(/\s+/),h=[e],d=o,f=()=>Math.max.apply(null,h.map(_=>r.measureText(_).width)),g=()=>{for(d=o,r.font=s(d);f()>i&&d>a;)d-=2,r.font=s(d)};if(g(),l>1&&u.length>1&&d<o*.72){let _=1,m=1e9;for(let p=1;p<u.length;p++){let L=Math.abs(u.slice(0,p).join(" ").length-u.slice(p).join(" ").length);L<m&&(m=L,_=p)}h=[u.slice(0,_).join(" "),u.slice(_).join(" ")],g()}f()>i&&(h=h.map(_=>{for(;r.measureText(_+"\u2026").width>i&&_.length>3;)_=_.slice(0,-1);return _===e?_:_+"\u2026"}));let v=d*1.08;return h.forEach((_,m)=>r.fillText(_,t,n+m*v+d*.5)),h.length*v}function Lh(r,e,t){let n=t.style,i=r.width,s=r.height,o=r.getContext("2d"),a=ql(t.ink),l=ql(t.paper);if(o.clearRect(0,0,i,s),o.textAlign="center",o.textBaseline="middle",n==="can"){o.fillStyle=ql(t.wrap),o.fillRect(0,0,i,s),o.fillStyle=a,o.globalAlpha=.9,o.fillRect(0,s*.1,i,s*.012),o.fillRect(0,s*.888,i,s*.012),o.globalAlpha=1;let v=i/2,_=i*.3,m=s*.2;bo(o,e.top,3),m+=Qt(o,e.top,v,m,_,p=>"600 "+p+"px "+ii,30,16,1,!0)+s*.05,bo(o,"",0),m+=Qt(o,e.title,v,m,_,p=>"700 "+p+"px "+wo,104,40,2)+s*.03,o.fillRect(v-34,m,68,3),m+=s*.045,m+=Qt(o,e.mid,v,m,_,p=>"500 "+p+"px "+ii,34,18,2)+s*.02,Qt(o,e.foot,v,s*.8,_,p=>"500 "+p+"px "+ii,30,16);return}if(o.fillStyle=l,o.fillRect(0,0,i,s),n==="back"){o.fillStyle=a;let v=s*.2;(e.back||[]).slice(0,3).forEach(_=>{v+=Qt(o,_,i/2,v,i*.8,m=>"400 "+m+"px "+ii,34,18,2)+s*.07});return}let c=n==="badge"?i*.07:i*.055;o.strokeStyle=a,o.fillStyle=a,o.globalAlpha=.85,o.lineWidth=Math.max(2,i*.008),o.strokeRect(c,c,i-2*c,s-2*c),o.globalAlpha=.5,o.lineWidth=Math.max(1,i*.003),o.strokeRect(c+i*.022,c+i*.022,i-2*c-i*.044,s-2*c-i*.044),o.globalAlpha=1;let u=i/2,h=i-2*c-i*.11;if(n==="badge"){let v=s*.2;v+=Qt(o,e.top,u,v,h,_=>"600 "+_+"px "+ii,26,14,1,!0)+s*.06,Qt(o,e.title,u,v,h,_=>"700 "+_+"px "+wo,76,26,2);return}let d=s*(n==="beer"?.3:.34),f=s*.15;bo(o,e.top,i*.008),f+=Qt(o,e.top,u,f,h,v=>"600 "+v+"px "+ii,i*.062,i*.034,2,!0),bo(o,"",0),f=Math.max(f+s*.03,s*.26),o.globalAlpha=.7,o.fillRect(u-i*.09,f,i*.18,Math.max(2,s*.005)),o.globalAlpha=1,o.save(),o.translate(u,f+Math.max(2,s*.005)/2),o.rotate(Math.PI/4),o.fillRect(-i*.012,-i*.012,i*.024,i*.024),o.restore(),f+=s*.06;let g=Qt(o,e.title,u,f+(d-Math.min(d,i*.21))*.25,h,v=>"700 "+v+"px "+wo,i*.21,i*.075,2);f+=Math.max(g,d*.7)+s*.04,f+=Qt(o,e.mid,u,f,h,v=>"italic 400 "+v+"px "+wo,i*.068,i*.04,2),Qt(o,e.foot,u,s*.835,h,v=>"500 "+v+"px "+ii,i*.056,i*.032)}var _n=Math.PI,Rh={transparent:!0,depthWrite:!1,blending:Vi,blendEquation:Xt,blendSrc:$t,blendDst:$t,blendSrcAlpha:Cl,blendDstAlpha:$t};function Ch(r){let e=new Map,t=0,n=(l,c)=>{let u=e.get(l);return u||(u={g:c(),refs:0},e.set(l,u)),u.refs++,u.g},i=l=>{let c=e.get(l);c&&--c.refs<=0&&(c.g.dispose(),e.delete(l))},s=(l,c)=>new to(l.map(u=>new te(Math.max(u[0],5e-4)*.075,u[1]*.075)),c),o=(l,c,u,h)=>{let d=[];for(let f=0;f<=h;f++){let g=c[0]+(c[1]-c[0])*f/h;d.push([is(l.p,Math.min(g,l.h-.01))+u,g])}return d.push([0,c[1]]),d};function a(l,c){t++;let u=new je,h=[],d=[],f=[],g={uCam:{value:r.cam},uReveal:{value:0},uLight:{value:1},uSat:{value:1},uGlow:r.U.glow,uMirror:{value:0},uRefl:r.U.refl,uLampPos:r.lampPos,uTime:r.U.time},v=(Z,ae)=>(h.push(Z),n(Z,ae)),_=(Z,ae,ye)=>new qe(Object.assign({uniforms:Object.assign({},g,ae),vertexShader:yh,fragmentShader:Z,transparent:!0,side:Rt},ye||{})),m=(Z,ae,ye,x)=>{let me=new Oe(ae,ye);return me.renderOrder=x||0,me.frustumCulled=!1,Z.add(me),me},p=new je;p.scale.y=-1,u.add(p);let L=(Z,ae)=>{let ye=ae.material,x=new Oe(ae.geometry,new qe({uniforms:Object.assign({},ye.uniforms,{uMirror:{value:1}}),vertexShader:ye.vertexShader,fragmentShader:ye.fragmentShader,transparent:!0,side:Rt,depthTest:!1,depthWrite:!1}));return x.position.copy(ae.position),x.rotation.copy(ae.rotation),x.renderOrder=-1.5,x.frustumCulled=!1,Z.add(x),x},A=Z=>{let ae=m(u,v("quad",()=>new St(1,1)),new qe({uniforms:{uK:{value:0}},vertexShader:Ot,fragmentShader:yo,transparent:!0,depthWrite:!1}),-2);return ae.rotation.x=-_n/2,ae.position.y=.006,ae.scale.set(Z*2.9,Z*2.5,1),ae},C=(Z,ae,ye)=>{let x=document.createElement("canvas");x.width=Z,x.height=ae;let me=new yn(x);return me.anisotropy=r.maxAniso,me.minFilter=ni,f.push({cv:x,t:me,style:ye}),d.push(me),me},b={ink:l.ink,paper:l.paper,wrap:l.wrap},I=null;if(l.bottle){let Z=ec[l.vessel],ae=Z.h*.075/2,ye=new je,x=new je,me=new je,le=new je,Te=new je;if(ye.add(x),x.add(me),me.add(le),le.position.y=-ae,u.add(ye),p.add(Te),I={V:Z,half:ae,pos:ye,tilt:x,yaw:me,mYaw:Te,kind:l.vessel,shadow:A(Z.r*.075)},l.vessel==="tap"){let K={uUseMap:{value:0},map:{value:r.blank},uTint:{value:new pe(.74,.56,.3)},uMetal:{value:1}};m(le,v("tap:column",()=>s(Z.p,32)),_(Kt,K,{depthWrite:!0}));let ee=Z.spout[0]*.075,se=Z.spout[1]*.075,be=m(le,v("tap:arm",()=>new Ft(.062,.075,1,16)),_(Kt,K,{depthWrite:!0}));be.rotation.z=_n/2,be.scale.y=ee,be.position.set(ee/2,se,0),m(le,v("tap:noz",()=>new Ft(.05,.04,.2,14)),_(Kt,K,{depthWrite:!0})).position.set(ee,se-.11,0),I.handle=new je,I.handle.position.set(ee*.78,se+.05,0),le.add(I.handle),m(I.handle,v("tap:handle",()=>s([[0,0],[.5,0],[.55,.5],[.8,2.6],[1.15,6.6],[1.2,8.2],[.9,8.9],[0,9.1]],20)),_(Kt,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new pe(.07,.06,.055)},uMetal:{value:.22}},{depthWrite:!0})),m(le,v("tap:plate",()=>new St(.36,.36)),_(Kt,{uUseMap:{value:1},map:{value:C(256,256,"badge")},uTint:{value:new pe(1,1,1)},uMetal:{value:0}},{depthWrite:!0}),1).position.set(0,11.6*.075,Z.p[5][0]*.075+.012),I.spoutAt=[ee,se-.2]}else if(l.vessel==="can"){let K=m(le,v("can:body",()=>s(Z.p,40)),_(Kt,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new pe(.8,.81,.82)},uMetal:{value:1}},{depthWrite:!0})),ee=m(le,v("can:wrap",()=>new Ft(Z.r*.075*1.004,Z.r*.075*1.004,(Z.label[1]-Z.label[0])*.075,40,1,!0,-_n,2*_n)),_(Kt,{uUseMap:{value:1},map:{value:C(1024,448,"can")},uTint:{value:new pe(1,1,1)},uMetal:{value:.16}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);ee.position.y=(Z.label[0]+Z.label[1])/2*.075,L(Te,K),L(Te,ee)}else{let K=!l.dark&&l.liquid;I.glassU={uTint:{value:new pe().fromArray(l.glassTint)},uDark:{value:l.dark},uInside:{value:new pe().fromArray(l.liquid?l.liquid.deep.map((S,j)=>S*.55+l.liquid.edge[j]*.45):[0,0,0])},uHasFill:{value:K?1:0},uUp:{value:new T(0,1,0)},uFillD:{value:Z.fill*.075}};let ee=m(le,v("bottle:"+l.vessel,()=>s(Z.p,40)),_(Wl,I.glassU,{depthWrite:!0})),se=Z.label[2]*_n/180,be=(Z.label[1]-Z.label[0])*.075,ne=Z.r*.075*1.006,E=m(le,v("label:"+l.vessel,()=>new Ft(ne,ne,be,28,1,!0,-se,2*se)),_(Kt,{uUseMap:{value:1},map:{value:C(512,Math.round(512*be/(2*se*ne)),l.beer?"beer":"wine")},uTint:{value:new pe(1,1,1)},uMetal:{value:0}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);if(E.position.y=(Z.label[0]+Z.label[1])/2*.075,L(Te,ee),L(Te,E),Z.back&&c.back&&c.back.length){let S=Z.back[2]*_n/180,j=(Z.back[1]-Z.back[0])*.075,Q=m(le,v("back:"+l.vessel,()=>new Ft(ne,ne,j,16,1,!0,_n-S,2*S)),_(Kt,{uUseMap:{value:1},map:{value:C(256,Math.round(256*j/(2*S*ne)),"back")},uTint:{value:new pe(1,1,1)},uMetal:{value:0}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);Q.position.y=(Z.back[0]+Z.back[1])/2*.075}if(Z.capsule&&l.foil){let S=m(le,v("cap:"+l.vessel,()=>s(o(Z,Z.capsule,.05,10),28)),_(Kt,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new pe().fromArray(l.foil)},uMetal:{value:l.vessel==="longneck"?.95:.7}},{depthWrite:!0}),1);L(Te,S)}}}let N=tc[l.glass],k=new je,V=new je,X=N.inner[0][1],W=l.beer?N.head:l.sparkling?1.3:0;k.position.set(l.glassAt[0],0,l.glassAt[1]),V.position.copy(k.position),u.add(k),p.add(V);let R=Math.max.apply(null,N.outer.map(Z=>Z[0]))*.075,U=A(R*.8);U.position.x=l.glassAt[0],U.position.z=l.glassAt[1];let O=null,z=null,$=null,oe=null,re=null;if(l.liquid){let Z={uDeep:{value:new pe().fromArray(l.liquid.deep)},uEdge:{value:new pe().fromArray(l.liquid.edge)},uFoamCol:{value:new pe().fromArray(l.liquid.foam)},uLevel:{value:0},uFoam:{value:0},uWob:{value:new te},uAt:{value:new T},uAlpha:{value:1},uFoamy:{value:0}};if(O=m(k,v("liquid:"+l.glass,()=>s(N.inner.map(ae=>[ae[0]*.982,ae[1]]),44)),_(_h,Z,{depthWrite:!0}),2),z=m(k,v("disc",()=>new On(1,40).rotateX(-_n/2)),_(wh,Z,{depthWrite:!0}),2.2),L(V,O),r.motion){let ae=l.beer?44:l.sparkling?52:18;$=new zr(v("bubbles:"+ae,()=>{let ye=new Float32Array(ae*3),x=new Float32Array(ae);for(let le=0;le<ae;le++){let Te=le*2.39996,K=Math.sqrt((le+.5)/ae);ye[le*3]=Math.cos(Te)*K,ye[le*3+2]=Math.sin(Te)*K,x[le]=le*.6180339%1}let me=new Ge;return me.setAttribute("position",new $e(ye,3)),me.setAttribute("aSeed",new $e(x,1)),me}),new qe(Object.assign({uniforms:{uTime:r.U.time,uPx:r.U.px,uOn:{value:0},uBase:{value:0},uTop:{value:1},uR:{value:.2},uSize:{value:l.sparkling?5:7},uCol:{value:new pe(1,.96,.86)},uGlow:r.U.glow},vertexShader:Sh,fragmentShader:Th,depthTest:!1},Rh))),$.frustumCulled=!1,$.renderOrder=3,$.visible=!1,k.add($),oe=m(u,v("stream",()=>new Ft(1,1,1,8,16,!0)),new qe({uniforms:{uA:{value:new T},uB:{value:new T},uR:{value:l.beer?.042:.028},uEdge:Z.uEdge,uDeep:Z.uDeep,uHead:{value:0},uTail:{value:1},uReveal:g.uReveal,uLight:g.uLight,uGlow:r.U.glow,uTime:r.U.time},vertexShader:bh,fragmentShader:Mh,transparent:!0,depthWrite:!1,side:Rt}),3),oe.visible=!1}re=m(u,v("quad",()=>new St(1,1)),new qe(Object.assign({uniforms:{uCol:Z.uEdge,uK:{value:0},uGlow:r.U.glow},vertexShader:Ot,fragmentShader:Eh},Rh)),-1),re.rotation.x=-_n/2,re.scale.set(R*2.4,R*1.8,1),O.userData.u=Z}let we=m(k,v("glass:"+l.glass,()=>s(N.outer.concat(N.inner.slice().reverse()),44)),_(Wl,{uTint:{value:new pe(.9,.95,.92)},uDark:{value:0},uInside:{value:new pe},uHasFill:{value:0},uUp:{value:new T(0,1,0)},uFillD:{value:0}},{depthWrite:!1}),5);L(V,we);function xe(Z){f.forEach(ae=>{Lh(ae.cv,Z,Object.assign({style:ae.style},b)),ae.t.needsUpdate=!0})}xe(c);let Le=0;u.traverse(Z=>{Z.isMesh&&(Le+=(Z.geometry.index?Z.geometry.index.count:Z.geometry.attributes.position.count)/3)});function Ce(Z,ae){let ye=ae.refl>.02&&!ae.holo;if(u.position.y=ae.baseY,I){let x=l.bottle[0],me=l.bottle[1];if(I.kind==="tap")I.pos.position.set(x,I.half,me),I.handle.rotation.z=-Z.tilt*.55,I.yaw.rotation.y=0;else{let le=l.source==="bottle"?nc(l,Z.tilt):{x,y:I.half,z:me,angle:0};I.pos.position.set(le.x,le.y,le.z),I.tilt.rotation.z=-le.angle,x=le.x,me=le.z,I.mouth=le.mouth;let Te=Math.atan2(ae.cx-(ae.wx+x),ae.cz-(ae.wz+me))*(1-Z.tilt)+ae.yaw;if(I.yaw.rotation.y=Te,I.glassU){let K=Math.sin(le.angle),ee=Math.cos(le.angle),se=I.V;I.glassU.uUp.value.set(-K*Math.cos(Te),ee,-K*Math.sin(Te)),I.glassU.uFillD.value=se.fill*.075/2*ee+se.r*.075*.45*(1-ee*ee)+se.fill*.075/2*ee*ee}I.mYaw.position.set(l.bottle[0],0,l.bottle[1]),I.mYaw.rotation.y=Te}I.mYaw.visible=ye&&Z.tilt<.03,I.shadow.position.x=x,I.shadow.position.z=me,I.shadow.material.uniforms.uK.value=(ae.holo?0:.5)*g.uReveal.value*(1-.65*Z.tilt)}if(V.visible=ye,U.material.uniforms.uK.value=(ae.holo?0:.34)*g.uReveal.value,O){let x=O.userData.u,me=X+(N.fill-X)*Z.level,le=W*Z.foam,Te=Z.fade>.01&&(Z.level>.004||le>.02);if(x.uLevel.value=ae.baseY+me*.075,x.uFoam.value=le*.075,x.uWob.value.set(Z.wobble*.05,Z.wobble*.02),x.uAt.value.set(ae.wx+l.glassAt[0],0,ae.wz+l.glassAt[1]),x.uAlpha.value=Z.fade,x.uFoamy.value=Math.min(1,le/.25),O.visible=Te,z.visible=Te,z.position.y=(me+le)*.075,z.scale.setScalar(is(N.inner,me+le)*.075*.98),z.rotation.z=-Z.wobble*.05,z.rotation.x=Z.wobble*.02,$){let K=Z.bubbles*Z.fade;$.visible=K>.01&&Z.level>.05,$.material.uniforms.uOn.value=K,$.material.uniforms.uBase.value=(X+.3)*.075,$.material.uniforms.uTop.value=me*.075,$.material.uniforms.uR.value=is(N.inner,me)*.075*.8}if(oe){let K=oe.material.uniforms,ee=Z.head>0&&Z.tail<1;oe.visible=ee,ee&&(l.source==="tap"?K.uA.value.set(l.bottle[0]+I.spoutAt[0],I.spoutAt[1],l.bottle[1]):l.source==="bottle"&&I&&I.mouth?K.uA.value.set(I.mouth[0],I.mouth[1]-.02,I.mouth[2]):K.uA.value.set(l.glassAt[0],N.h*.075+4.4,l.glassAt[1]),K.uB.value.set(l.glassAt[0]+(l.source==="bottle"?.03:0),Math.max(me,X+.2)*.075,l.glassAt[1]),K.uHead.value=Z.head,K.uTail.value=Z.tail)}re.position.set(l.glassAt[0]+R*.55,.008,l.glassAt[1]-R*.35),re.material.uniforms.uK.value=(ae.holo?0:.07)*Z.level*Z.fade*g.uReveal.value*g.uLight.value}}function J(){t--,d.forEach(Z=>Z.dispose()),h.forEach(i),h.length=0}return{group:u,shared:g,update:Ce,paint:xe,tris:Math.round(Le),dispose:J,spec:l}}return{build:a,stats:()=>({drinks:t,geometries:e.size})}}var Yr=r=>Math.min(1,Math.max(0,r)),wn=r=>(r=Yr(r),r*r*(3-2*r)),Fv=r=>(r=Yr(r),r*r*r*(r*(r*6-15)+10));function Iv(r={}){let e=r.source==="above"||r.source==="tap",t=e?.3:.5,n=r.beer?2.1:1.9,i=e?.3:.55,s=t,o=s+n,a=o+.17,l=a+i,c=r.beer?5.5:r.sparkling?6:.7,u=r.beer?3.2:.9;return{t0:s,t1:o,tb:a,t2:l,fizz:c,settle:u,beer:!!r.beer,sparkling:!!r.sparkling,action:l,end:Math.max(l+.25,o+u,o+c)}}var Zi=(r={})=>({fade:1,tilt:0,head:0,tail:1,level:1,wobble:0,foam:r.beer?1:0,bubbles:0,cam:0,done:!0});function Xl(r,e={}){let t=Iv(e);if(r>=t.end)return Zi(e);if(r<0)return Object.assign(Zi(e),{fade:1-wn((r+.5)/(.5*.7)),cam:wn((r+.5)/.5),done:!1});let n=r<t.t0?wn(r/t.t0):r<t.tb?1:1-wn((r-t.tb)/(t.t2-t.tb)),i=Yr((r-(t.t0-.06))/.2),s=Yr((r-t.t1)/.16),o=Fv((r-t.t0-.12)/(t.t1-t.t0-.04)),a=r<t.t0?0:r<t.t1?.9*Yr((r-t.t0)/.3):.9*Math.exp(-(r-t.t1)*4.2),l=a<.004?0:a*Math.sin(r*12.5),c=0,u=0;t.beer?(c=r<t.t1?1.55*Math.pow(o,.7):1+.55*Math.exp(-(r-t.t1)/.75),r>=t.t1&&c<1.004&&(c=1),u=r<t.t0?0:r<t.t1?1:1-wn((r-t.t1)/t.fizz)):t.sparkling?(c=r<t.t1?.55*Math.pow(o,.7):.55*(1-wn((r-t.t1)/1.3)),u=r<t.t0?0:r<t.t1?1:1-wn((r-t.t1)/t.fizz)):u=r<t.t0?0:r<t.t1?.7:.7*(1-wn((r-t.t1)/t.fizz));let h=r<t.tb?1:1-wn((r-t.tb)/(t.t2-t.tb+.25));return{fade:1,tilt:n,head:i,tail:s,level:o,wobble:l,foam:c,bubbles:u,cam:h,done:!1}}var ln=Math.PI,dx=ln*2,an=.07,Mo=.5,Yl=r=>(r=mt(r),r*r*(3-2*r)),It=(r,e)=>1-Math.exp(-r*e),Dh=3,Fh=3,Zl=3.6,Ih=10,zh=.62,zv=45,Ji=[1.5,.95],So=28*os;function fx(r){let e=r.canvas,t=!!r.reduce,n=r.themes||"themes/",i=r.glide,s=r.theme||{},o;try{o=new Ye({canvas:e,antialias:!0,alpha:!0,powerPreference:"high-performance"})}catch{return null}if(!o.getContext())return null;let l=o.capabilities.getMaxAnisotropy(),c=r.pixelRatio||Math.min(window.devicePixelRatio||1,2);o.setPixelRatio(c),o.setClearColor(0,0),o.info.autoReset=!1;let u={time:{value:0},accent:{value:new pe(s.accent||"#5fd0ff")},px:{value:c},hub:{value:new te},glow:{value:0},pulse:{value:9},refl:{value:0},mask:{value:new He(0,2,0,0)},at:{value:new te}},h=new $n,d=new ft(30,1,.1,160),f=new Hr,g=Math.min(window.innerWidth,window.innerHeight)<600,v=new St(1,1,g?220:300,g?220:300),_=new St(1,1,96,96),m=new St(1,1),p=(y,w,D)=>{let P=new Di(new Uint8Array([y,w,D]),1,1,gn);return P.needsUpdate=!0,P},L=p(128,128,128),A=p(18,16,14),C=(y,w,D,P)=>new qe(Object.assign({uniforms:w,vertexShader:D||Ot,fragmentShader:y,transparent:!0,depthWrite:!1,blending:br},P||{})),b={map:{value:A},hmap:{value:L},uSize:{value:6},uSpec:{value:.1},uShin:{value:20},uBump:{value:0},uGlow:u.glow,uFade:{value:0},uLamp:{value:new pe(1,.95,.86)},uCam:{value:d.position},uLampPos:{value:new T(.5,3.6,1.5)},uPool:{value:new T(0,.1,9.5)},uDim:{value:1},uFar:{value:new te(5.5,13)},uLane:{value:new He(0,2.1,zo,0)},uLanes:{value:new te(0,0)}},I=new St(1,1).rotateX(-ln/2),N=new Oe(I,new qe({uniforms:b,vertexShader:Xr,fragmentShader:ph}));N.frustumCulled=!1,N.scale.set(260,1,260),h.add(N);let k=new je;h.add(k);let V=Ch({U:u,cam:d.position,lampPos:b.uLampPos,maxAniso:l,blank:L,motion:!t}),X=null;function W(){if(X)return X;let y=Object.assign({},b,{uBack:{value:-12},uGloss:{value:1}}),w=new je,D=new Oe(I,new qe({uniforms:y,vertexShader:Xr,fragmentShader:xh}));D.frustumCulled=!1,D.scale.set(260,1,260),w.add(D);let P=new Oe(new St(160,30),new qe({uniforms:{uFade:b.uFade,uGlow:u.glow},vertexShader:Xr,fragmentShader:vh}));return P.frustumCulled=!1,w.add(P),w.visible=!1,h.add(w),X={g:w,counter:D,wall:P,cu:y},X}let R=null;function U(){if(R)return R;let y=(()=>{let q=document.createElement("canvas");q.width=q.height=128;let G=q.getContext("2d"),Y=G.createRadialGradient(64,64,0,64,64,64);return Y.addColorStop(0,"rgba(255,255,255,1)"),Y.addColorStop(.3,"rgba(255,255,255,.5)"),Y.addColorStop(1,"rgba(255,255,255,0)"),G.fillStyle=Y,G.fillRect(0,0,128,128),new yn(q)})(),w={g:new je,fxU:{uAccent:u.accent,uTime:u.time,uOn:{value:0}},fxOn:0,scanAt:2.2,softTex:y};w.geoBase=new On(1.36,72).rotateX(-ln/2).translate(0,an,0),w.geoSide=new Ft(1.36,1.4,an+.03,72,1,!0).translate(0,(an-.03)/2,0),w.geoCone=new Ft(1.2,.42,Mo-an+.05,64,1,!0).translate(0,an+(Mo-an+.05)/2,0),w.geoRing=new On(1.3,72).rotateX(-ln/2).translate(0,.012,0),w.floor=new Oe(new On(40,64).rotateX(-ln/2),C(ah,{uAccent:u.accent,uTime:u.time,uHub:u.hub,uPulse:u.pulse,uGlow:u.glow,uAt:u.at},Xr)),w.floor.position.y=-.02,w.floor.renderOrder=-6,w.floor.frustumCulled=!1,w.g.add(w.floor),w.halo=new Dr(new Ii({map:y,color:u.accent.value,blending:br,depthWrite:!1,transparent:!0,opacity:.16})),w.halo.scale.set(9,6,1),w.halo.renderOrder=-4,w.g.add(w.halo),w.fx=new je,w.g.add(w.fx);let D=new Oe(new Ft(1.5,1.36,2.7,64,1,!0).translate(0,an+1.35,0),C(oh,w.fxU,Ot,{side:ot}));D.renderOrder=-1,w.fx.add(D);let P=new Oe(new Or(1.44,1.74,128).rotateX(-ln/2),C(kl,Object.assign({uKind:{value:0}},w.fxU),Gl,{side:Rt}));return P.position.y=.012,P.renderOrder=-2,w.fx.add(P),w.hoop=new Oe(new Or(1.1,1.5,96).rotateX(-ln/2),C(kl,{uAccent:u.accent,uTime:u.time,uOn:{value:0},uKind:{value:2}},Gl,{side:Rt})),w.hoop.renderOrder=5,w.fx.add(w.hoop),w.g.visible=!1,h.add(w.g),R=w,w}let O=y=>new jt(4,4,{minFilter:vt,magFilter:vt,depthBuffer:y,stencilBuffer:!1}),z=O(!0),$=O(!1),oe=O(!1),re=O(!1),we=O(!1),xe=new Gi(-1,1,1,-1,0,1),Le=new $n,Ce=new qe({uniforms:{tex:{value:null},dir:{value:new te}},vertexShader:Vl,fragmentShader:uh,depthTest:!1,depthWrite:!1}),J=new qe({uniforms:{a:{value:oe.texture},b:{value:we.texture},k:{value:.75}},vertexShader:Vl,fragmentShader:hh,depthTest:!1,depthWrite:!1,transparent:!0,blending:Vi,blendEquation:Xt,blendSrc:$t,blendDst:$t,blendSrcAlpha:$t,blendDstAlpha:Wi}),Z=new Oe(new St(2,2),Ce);Z.frustumCulled=!1,Le.add(Z);let ae=(y,w,D,P)=>{Z.material=Ce,Ce.uniforms.tex.value=y.texture,Ce.uniforms.dir.value.set(D,P),o.setRenderTarget(w),o.render(Le,xe)},ye=y=>({x:y,v:0}),x={w:0,h:0,frame:null,view:null,preset:null,walk:r.walk===-1?-1:1,first:!0,clock:0,lane:{x:0,z:0,places:[],n:0,cat:null},actors:new Map,dev:ye(0),E:ye(45),zoom:ye(1),cy:ye(300),lookY:ye(0),offX:ye(0),lift:ye(0),pool:ye(8.5),dimT:9,dimFrom:1,lampK:1,devZ:{x:0,v:0},titles:[],dragX:{dx:0,active:!1},touchAt:0,sway:0,tilt:[0,0],tiltT:[0,0],ptr:[0,0],ptrT:[0,0],turning:!1,bump:0,swayK:0,hot:[],bloom:r.bloom!==!1,tier:0,slow:0,lost:!1,auto:r.auto!==!1,moving:!0,frames:0,disposed:!1,pours:0,hush:!1,heroReady:null,stats:{calls:0,triangles:0},base:new T,focus:new T,intro:0},me=new Map,le=0,Te=0,K=[],ee=y=>{let w=le;le+=y,r.onBusy&&w===0!=(le===0)&&r.onBusy(le>0),le===0&&K.splice(0).forEach(D=>D())};function se(y,w,D){let P=me.get(y);return P?(P.refs++,P.last=++Te,P.ready?D(P.tex):P.wait.push(D),P):(P={tex:null,refs:1,ready:!1,failed:!1,wait:[D],url:y,last:++Te},me.set(y,P),ee(1),P.tex=f.load(y,q=>{if(!me.has(y)||me.get(y)!==P){q.dispose(),ee(-1);return}q.generateMipmaps=w,q.minFilter=w?ni:vt,q.anisotropy=w?l:1,q.needsUpdate=!0,P.ready=!0,P.wait.splice(0).forEach(G=>G(q)),ee(-1),ht()},void 0,()=>{P.failed=!0,P.wait.length=0,r.onAssetError&&r.onAssetError(y),ee(-1),ht()}),P)}function be(){let y=[];me.forEach(w=>{w.refs<=0&&y.push(w)}),!(y.length<=Ih)&&y.sort((w,D)=>D.last-w.last).slice(Ih).forEach(w=>{w.tex&&w.tex.dispose(),me.delete(w.url)})}let ne={cur:null,want:null,texs:new Map};function E(y){let w=ne.texs.get(y.id+(y.img||""));if(w)return w;w={map:null,h:null,ready:!1,def:y},ne.texs.set(y.id+(y.img||""),w);let D=P=>(P.wrapS=P.wrapT=y.mirror?Sr:Mr,P.anisotropy=l,P.needsUpdate=!0,P);return ee(1),w.map=f.load(y.img||n+y.id+".jpg",P=>{D(P),w.ready=!0,ee(-1),ht()},void 0,()=>{w.map=A,w.ready=!0,ee(-1),ht()}),y.img||(w.h=f.load(n+y.id+"_h.jpg",P=>{D(P),ht()})),w}function S(y){let w=y==="bar";N.visible=!w&&y!=="holo",w&&W(),X&&(X.g.visible=w),R&&(R.g.visible=y==="holo")}function j(y){if(y.id==="holo"){ne.want=null,ne.cur=null,u.refl.value=0,U(),S("holo"),J.uniforms.k.value=1;return}J.uniforms.k.value=.75;let w=E(y);if(ne.cur===w){ne.want=null;return}ne.cur||S(y.kind||"table"),ne.want=w,ne.texs.size>3&&ne.texs.forEach((D,P)=>{D!==w&&D!==ne.cur&&(D.map&&D.map!==A&&D.map.dispose(),D.h&&D.h.dispose(),ne.texs.delete(P))})}function Q(y){if(ne.want&&ne.want.ready&&(b.uFade.value<.04||!ne.cur||t)){let P=ne.cur=ne.want,q=P.def;ne.want=null,S(q.kind||"table"),X&&q.kind==="bar"&&(X.cu.uGloss.value=q.gloss==null?1:q.gloss),b.map.value=P.map,b.hmap.value=P.h||L,b.uSize.value=q.size,b.uSpec.value=q.spec,b.uShin.value=q.shin,b.uBump.value=q.bump,u.refl.value=q.refl;let G=q.tint||[1,.95,.86];b.uLamp.value.setRGB(G[0],G[1],G[2])}let w=ne.want?0:ne.cur?1:0,D=b.uFade.value;return b.uFade.value=t?w:D+(w-D)*It(y,ne.want?12:6),Math.abs(b.uFade.value-w)>.004}function _e(y){let w=r.cardInfo?r.cardInfo(y.item):{title:"",price:"",rtl:!1},D=y.canvas||(y.canvas=document.createElement("canvas"));D.width=760,D.height=480;let P=D.getContext("2d"),q=D.width,G=D.height;P.fillStyle="#f4efe5",P.fillRect(0,0,q,G),P.strokeStyle="rgba(60,44,28,.6)",P.lineWidth=4,P.strokeRect(24,24,q-48,G-48),P.lineWidth=1.5,P.strokeRect(36,36,q-72,G-72);try{P.direction=w.rtl?"rtl":"ltr"}catch{}P.textAlign="center",P.textBaseline="middle",P.fillStyle="#2a1e12";let Y=String(w.title||"").split(/\s+/).filter(Boolean),de=q-120,fe=[Y.join(" ")],H=0,he=Se=>{H=Se;do H-=4,P.font="700 "+H+'px "Frank Ruhl Libre","Times New Roman",serif';while(Math.max.apply(null,fe.map(Ne=>P.measureText(Ne).width))>de&&H>34)};if(he(150),H<96&&Y.length>1){let Se=1,Ne=1e9;for(let ze=1;ze<Y.length;ze++){let st=Math.abs(Y.slice(0,ze).join(" ").length-Y.slice(ze).join(" ").length);st<Ne&&(Ne=st,Se=ze)}fe=[Y.slice(0,Se).join(" "),Y.slice(Se).join(" ")],he(128)}let ce=H*1.04,Me=!!w.price,Ae=fe.length*ce+(Me?96:0),Ie=G/2-Ae/2+ce/2+4;if(fe.forEach((Se,Ne)=>P.fillText(Se,q/2,Ie+Ne*ce)),Me){let Se=Ie+(fe.length-1)*ce+ce/2;P.fillStyle="rgba(60,44,28,.55)",P.fillRect(q/2-34,Se+16,68,3),P.font='500 62px "Frank Ruhl Libre","Times New Roman",serif',P.fillStyle="#2a1e12";try{P.direction="ltr"}catch{}P.fillText(String(w.price),q/2,Se+62)}y.cardTex?y.cardTex.needsUpdate=!0:(y.cardTex=new yn(D),y.cardTex.anisotropy=l),y.um.map.value=y.cardTex,y.ready=!0}function Ee(y,w){let D=x.view,P=x.preset,q=D.kind,G=rc(y,q),Y=y.asset,de=new je,fe=x.lane.places[w],H={id:y.id,item:y,i:w,cat:D.catId,kind:q,shape:G,type:G.type,g:de,x:x.lane.x+fe.dx,z:x.lane.z-x.walk*w*P.S+fe.dz,spin:fe.spin,vis:0,visT:1,light:1,turn:{x:0,v:0},lift:0,ready:!1,leaving:!1,tex:[],sat:1,pour:null,pose:null,holo:!!(P.holo||G.holo),stock:!!G.holo};if(G.type==="relief"||G.type==="stand"){let he=H.um={map:{value:A},aux:{value:L},uH:{value:Y.h},uE:{value:Y.e*os},uFocus:{value:0},uReveal:{value:0},uTime:u.time,uScan:{value:-9},uGlitch:{value:0},uGlow:u.glow,uMirror:{value:0},uAccent:u.accent,uCenter:{value:de.position},uHolo:{value:H.holo?1:0},uLight:{value:1},uRefl:u.refl,uMask:u.mask,uSat:{value:1},uO:{value:new te(Y.o?Y.o[0]:0,Y.o?Y.o[1]:0)}},ce=Ie=>new qe({uniforms:Ie?Object.assign({},he,{uMirror:{value:1}}):he,vertexShader:eh,fragmentShader:th,transparent:!0,side:Rt,depthWrite:!Ie});H.mesh=new Oe(_,ce(!1)),H.mesh.frustumCulled=!1,H.mesh.rotation.order="YXZ",H.mesh.visible=!1,de.add(H.mesh),H.mir=new je,H.mir.scale.y=-1,de.add(H.mir),H.refl=new Oe(_,ce(!0)),H.refl.frustumCulled=!1,H.refl.rotation.order="YXZ",H.refl.renderOrder=-1.5,H.refl.visible=!1,H.mir.add(H.refl),H.shadow=new Oe(m,new qe({uniforms:{aux:he.aux,uE:he.uE,uO:he.uO,uLen:{value:Y.o?.5:1},uK:{value:0},uCast:{value:new te}},vertexShader:lh,fragmentShader:ch,transparent:!0,depthWrite:!1})),H.shadow.frustumCulled=!1,H.shadow.renderOrder=-2,H.shadow.position.y=.006,H.shadow.visible=!1,de.add(H.shadow),G.reliefX&&(H.mesh.position.x=H.refl.position.x=H.shadow.position.x=G.reliefX);let Me=0,Ae=()=>{++Me>=2&&(H.ready=!0,H.mesh.visible=!0)};H.tex.push(se(Y.color,!0,Ie=>{he.map.value=Ie,Ae()}),se(Y.aux,!1,Ie=>{he.aux.value=Ie,Ae()}))}else if(G.type==="drink")H.ready=!0;else{let he=G.type==="photo",ce=he?1.9:Ji[0],Me=he?1.9:Ji[1];H.cardSize=[ce,Me];let Ae=H.um={map:{value:A},uLight:{value:1},uReveal:{value:0},uGlow:u.glow,uSat:{value:1},uSize:{value:new te(ce,Me)},uBorder:{value:he?.07:0},uFit:{value:new He(1,1,0,0)},uTint:{value:new pe(1,1,1)},uBlank:{value:0}},Ie=Se=>new qe({uniforms:Se?Object.assign({},Ae,Se):Ae,vertexShader:Ot,fragmentShader:mh,transparent:!0,side:Rt});if(H.mesh=new Oe(new St(ce,Me),Ie()),H.mesh.rotation.order="YXZ",H.mesh.frustumCulled=!1,H.shadow=new Oe(m,new qe({uniforms:{uK:{value:0}},vertexShader:Ot,fragmentShader:yo,transparent:!0,depthWrite:!1})),H.shadow.rotation.x=-ln/2,H.shadow.position.y=.006,H.shadow.renderOrder=-2,de.add(H.shadow),he)de.add(H.mesh),H.tex.push(se(Y.color,!0,Se=>{Ae.map.value=Se;let Ne=Se.image,ze=Ne&&Ne.width&&Ne.height?Ne.width/Ne.height:1;Ae.uFit.value.set(ze>1?1/ze:1,ze>1?1:ze,0,0),H.ready=!0}));else{H.tent=new je,H.tent.rotation.order="YXZ",de.add(H.tent);let Se=Math.sin(So)*Me,Ne=Math.cos(So)*Me;H.mesh.rotation.x=-So,H.mesh.position.set(0,Ne/2,Se/2),H.tent.add(H.mesh),H.back=new Oe(H.mesh.geometry,Ie({uBlank:{value:1},uTint:{value:new pe(.62,.6,.58)}})),H.back.frustumCulled=!1,H.back.rotation.x=So,H.back.position.set(0,Ne/2,-Se/2),H.tent.add(H.back),_e(H)}}if(G.drink&&(H.drink=V.build(G.drink,Fo(y,q,D.lang)),H.drink.group.position.set(G.drinkX,0,G.drinkZ),de.add(H.drink.group),H.pose=Zi(G.drink),G.type==="drink"&&(H.um=H.drink.shared)),H.holo){let he=U();H.ub={uAccent:u.accent,uTime:u.time,uOn:{value:0}};let ce=G.type==="stand"?.62:G.type==="text"||G.type==="photo"?.8:1;if(P.holo){let Me=new Oe(he.geoSide,new qe({uniforms:H.ub,vertexShader:Ot,fragmentShader:rh}));Me.renderOrder=-3;let Ae=new Oe(he.geoBase,new qe({uniforms:H.ub,vertexShader:Ot,fragmentShader:nh,transparent:!0,depthWrite:!1,blending:Vi,blendEquation:Xt,blendSrc:$t,blendDst:Wi,blendSrcAlpha:$t,blendDstAlpha:Wi}));if(Ae.renderOrder=-2.5,H.kit=[Me,Ae],H.float=G.type==="stand"?an+.1:Mo,G.type==="relief"){let Ie=new Oe(he.geoCone,C(sh,H.ub,Ot,{side:Rt}));Ie.renderOrder=-1,H.kit.push(Ie)}H.kit.forEach(Ie=>{Ie.scale.set(ce*.8,1,ce*.8),Ie.frustumCulled=!1,de.add(Ie)})}else{let Me=new Oe(he.geoRing,C(ih,H.ub));Me.renderOrder=-2.5,Me.scale.set(ce*.92,1,ce*.92),Me.frustumCulled=!1,de.add(Me),H.kit=[Me],H.float=G.type==="stand"?.03:.15}}return de.position.set(H.x,0,H.z),k.add(de),H}function Be(y){k.remove(y.g),y.tex.forEach(w=>{w.refs--,w.last=++Te}),y.g.traverse(w=>{w.material&&w.material.dispose()}),y.drink&&y.drink.dispose(),y.cardTex&&y.cardTex.dispose(),(y.type==="photo"||y.type==="text")&&y.mesh.geometry.dispose(),x.actors.delete(y.id)}function Fe(){let y=x.view;if(!y)return;let w=y.items.length,D=i.state.p,P=mt(Math.round(D),0,w-1),q=Math.max(0,P-Dh),G=Math.min(w-1,P+Fh),Y=mt(y.index,0,w-1),de=!1,fe=H=>{let he=y.items[H],ce=x.actors.get(he.id);if(ce&&ce.leaving){let Me=x.lane.places[H];if(ce.visT>0&&Math.abs(ce.z-(x.lane.z-x.walk*H*x.preset.S+Me.dz))<.03&&Math.abs(ce.x-(x.lane.x+Me.dx))<.03){ce.leaving=!1,ce.i=H,ce.cat=y.catId;return}Be(ce),ce=null}ce||x.actors.set(he.id,Ee(he,H))};x.actors.forEach(H=>{!H.leaving&&H.cat===y.catId&&Math.abs(H.i-D)>Zl&&Math.abs(H.i-Y)>1&&(Be(H),de=!0)});for(let H=q;H<=G;H++)fe(H);for(let H=Math.max(0,Y-1);H<=Math.min(w-1,Y+1);H++)fe(H);de&&be()}function B(y,w,D){let P=x.preset;x.lane={x:w,z:D,cat:y.catId,n:y.items.length,places:y.items.map((q,G)=>lc(P,G,q.id,y.rtl))}}function ue(y){let w=x.preset,D=x.lane;return[D.x+cc(D.places,y),D.z-x.walk*y*w.S]}function ge(y){if(x.lost||x.disposed){x.view=y;return}let w=x.view,D=sc(y.scene),P=!x.preset||x.preset.id!==D.id,q=x.preset,G=!w||w.catId!==y.catId||P||w.rtl!==y.rtl||w.rev!==y.rev,Y=w&&q&&x.lane.cat!=null?ue(x.lastP==null?i.state.p:x.lastP):[0,0];if(x.view=y,x.preset=D,(P||!w)&&j(D.surface(s)),(!x.frame||P||w&&w.rtl!==y.rtl)&&et(),G){let Me=w&&y.nav&&y.nav.kind==="category"?y.nav.dir||1:0,Ae=D,Ie=y.items.length,Se=mt(y.index,0,Ie-1),Ne=Y[0]+x.dev.x,ze=Y[1]+x.devZ.x,st=-x.walk*Ae.S;if(!!w&&!P&&w.rtl===y.rtl&&w.rev===y.rev&&!!Me&&!x.first){let lt=Me>0?Math.min(Dh,Se):Math.min(Fh,Ie-1-Se),si=lt+1+zh,Ki=ze+Me*st*si;x.actors.forEach(bn=>{let Qi=(bn.z-ze)/st*Me;bn.leaving=!0,bn.visT=bn.visT>0&&Qi<.5?1:0}),B(y,x.lane.x,Ki-st*Se),x.lastP=Se,t?(x.devZ.x=0,x.dev.x=0,x.actors.forEach(bn=>{bn.visT=0}),Pe()):(x.devZ.x=ze-Ki,x.dev.x=Ne-ue(Se)[0],Re(Me>0?y.catName:w.catName,x.lane.x,Ki-Me*st*(lt+(1+zh)/2),y.rtl))}else x.actors.forEach(lt=>{lt.leaving=!0,lt.visT=0}),Pe(),B(y,w?x.lane.x:0,0),x.lane.z=Y[1]+x.walk*Se*Ae.S,x.lastP=Se,x.dev.x=0,x.dev.v=0,x.devZ.x=0,x.devZ.v=0,w&&Me&&P&&!t&&!x.first&&(x.dimT=0,x.dimFrom=x.lampK);x.heroReady=null}Fe();let de=x.actors.get(y.itemId),fe=!!y.lifted,H=fe&&de&&(!w||!w.lifted||w.itemId!==y.itemId),he=!!w&&w.pourSeq!==y.pourSeq;x.actors.forEach(Me=>{(Me!==de||!fe)&&(Me.pour=null)});let ce=x.hush;x.hush=!1,fe&&de&&de.drink&&de.drink.spec.pourable&&!t&&!ce&&(H||he)&&(de.pour={t:-.5},de.pose=Xl(-.5,de.drink.spec),x.pours++),y.nav&&y.nav.kind==="edge"&&y.nav.seq!==x.navSeq&&!t&&(x.bump=-(y.nav.axis==="x"?y.rtl?-1:1:0)*y.nav.dir*.5),y.nav&&(x.navSeq=y.nav.seq),w&&w.lang!==y.lang&&ke(),x.first&&(x.first=!1,x.intro=t||!r.intro?0:1,Ke()),wt(),ht()}function Re(y,w,D,P){if(!y)return;for(;x.titles.length>1;)ie(x.titles[0]);let q=document.createElement("canvas");q.width=1024,q.height=256;let G=q.getContext("2d"),Y=Ie=>"700 "+Ie+'px "Frank Ruhl Libre","Times New Roman",serif',de=132;G.font=Y(de);let fe=G.measureText(y).width;fe>900&&(de=Math.max(40,Math.floor(de*900/fe)),G.font=Y(de));try{G.direction=P?"rtl":"ltr"}catch{}G.textAlign="center",G.textBaseline="middle",G.shadowColor="rgba(0,0,0,.6)",G.shadowBlur=26,G.fillStyle="rgba(250,243,230,.95)",G.fillText(y,512,132),G.shadowBlur=8,G.fillText(y,512,132);let H=new yn(q);H.anisotropy=l;let he=Math.min(x.frame?x.frame.W/x.frame.ppu*.9:2.2,3),ce=Math.min(he,1024/Math.max(260,Math.min(900,fe))*1.15),Me={map:{value:H},uGlow:u.glow,uK:{value:0},uLight:{value:1}},Ae=new Oe(I,new qe({uniforms:Me,vertexShader:Ot,fragmentShader:dh,transparent:!0,depthWrite:!1}));Ae.frustumCulled=!1,Ae.renderOrder=-4,Ae.scale.set(ce,1,ce/4),Ae.position.set(w,.012,D),h.add(Ae),x.titles.push({m:Ae,u:Me,tex:H,x:w,z:D,k:0,text:y})}function ie(y){h.remove(y.m),y.tex.dispose(),y.m.material.dispose();let w=x.titles.indexOf(y);w>=0&&x.titles.splice(w,1)}function Pe(){x.titles.slice().forEach(ie)}function ke(){x.actors.forEach(y=>{y.type==="text"&&_e(y),y.drink&&x.view&&y.drink.paint(Fo(y.item,y.kind,x.view.lang))}),ht()}function et(){!x.w||!x.preset||!x.view||(x.frame=oc(x.preset,x.w,x.h,!!x.view.rtl),r.onFrame&&r.onFrame(x.frame))}function en(){let y=x.preset,w=x.frame,D=x.view,P=x.actors.get(D.itemId),q=!!D.lifted,G=y.E,Y=1,de=w.cy,fe=0,H=0;if(q){let he=P&&P.type==="drink",ce=P&&P.type==="stand",Me=w.wide?w.sheetH:mt(r.sheet&&r.sheet()||w.sheetH,w.cardH,w.sheetH);if(G=y.kind==="bar"?he?y.liftE:ce?y.liftEStand:38:y.liftE,Y=w.liftZoom,de=w.wide?w.liftCy:ac(w.H,Me,w.standing),fe=y.liftY+(P?(P.float||0)+Math.min(.5,P.shape.top*.4):0),y.kind==="bar"&&P){let Ae=P.shape,Ie=P.pose&&P.pour?P.pose.cam:0,Se=Ae.drink?{r:Ae.drink.rest.r+(Ae.drink.pour.r-Ae.drink.rest.r)*Ie,cx:Ae.drink.rest.cx+(Ae.drink.pour.cx-Ae.drink.rest.cx)*Ie,top:Ae.drink.rest.top+(Ae.drink.pour.top-Ae.drink.rest.top)*Ie}:{r:Ae.r,cx:0,top:Ae.top},Ne=w.wide?(w.W-w.cardW)*.56:w.W*.86,ze=w.wide?w.H-w.top-40:w.H-Me-64,st=G*os,it=Math.min(Ne/(2*Se.r+.1),ze/(Se.top*Math.cos(st)+Se.r*1.2*Math.sin(st)+.1));Y=mt(it/w.ppu,.45,1.5),H=Se.cx+(Ae.drinkX||0)*0,fe=0,de=w.wide?w.top+(w.H-w.top)*.86:w.H-Me-14-Se.r*.6*Math.sin(st)*it}}return{E:G,zoom:Y,cy:de,lookY:fe,offX:H}}function Ke(){let y=en();x.E.x=y.E,x.zoom.x=y.zoom,x.cy.x=y.cy,x.lookY.x=y.lookY,x.offX.x=y.offX,x.E.v=x.zoom.v=x.cy.v=x.lookY.v=x.offX.v=0,x.lift.x=x.view&&x.view.lifted?1:0,x.lift.v=0,x.pool.x=x.preset.pool}function wt(){x.touchAt=x.clock}let Et=new T,ji=new T;function Zr(y){x.clock+=y;let w=x.clock;u.time.value=w,u.pulse.value+=y;let D=x.view;if(!D||!x.frame||x.lost)return!1;let P=Q(y),q=x.preset,G=x.frame,Y=i.state,de=Y.p,fe=!!D.lifted,H=!!q.holo,he=q.kind==="bar";x.lastP=de,Fe();let ce=x.actors.get(D.itemId)||null,Me=(F,tt,Co)=>{if(t){F.x=tt,F.v=0;return}ic(F,tt,Co,y),Math.abs(F.x-tt)>.001||Math.abs(F.v)>.01?P=!0:(F.x=tt,F.v=0)},Ae=en();Me(x.E,Ae.E,9),Me(x.zoom,Ae.zoom,10),Me(x.cy,Ae.cy,11),Me(x.lookY,Ae.lookY,11),Me(x.offX,Ae.offX,9),Me(x.lift,fe?1:0,12),Me(x.pool,fe?q.pool*.46:q.pool,7),r.onLift&&r.onLift(mt(x.lift.x,0,1.2)),x.dragX.active?(x.dev.x=-x.dragX.dx/G.ppu*.3,x.dev.v=0,P=!0):Me(x.dev,0,12),Me(x.devZ,0,5.6),Math.abs(x.bump)>.002?(P=!0,x.bump*=Math.exp(-y*8)):x.bump=0,x.intro>.002?(x.intro*=Math.exp(-y*3.2),P=!0):x.intro=0;let Ie=ue(de),Se=Ie[0]+x.dev.x+x.bump+x.offX.x,Ne=Ie[1]+x.devZ.x+x.walk*x.intro*1.1,ze=w-x.touchAt,st=t||ze>zv?0:Y.mode==="rest"&&!x.dragX.active&&!x.turning?1:.25;x.swayK+=(st-x.swayK)*It(y,2.2),Math.abs(st-x.swayK)<.002&&(x.swayK=st);let it=x.swayK,lt=it>0||st>0,si=It(y,5);for(let F=0;F<2;F++)x.tilt[F]+=(x.tiltT[F]-x.tilt[F])*si,x.ptr[F]+=(x.ptrT[F]-x.ptr[F])*si,Math.abs(x.tiltT[F]-x.tilt[F])+Math.abs(x.ptrT[F]-x.ptr[F])>.002&&(P=!0);let Ki=t?0:Math.sin(w*.52)*.06*it+x.tilt[0]*.13+x.ptr[0]*-.075,bn=t?0:Math.sin(w*.37+1)*.7*it+x.tilt[1]*3+x.ptr[1]*1.6;lt&&(P=P||"slow");let Qi=[Se,x.lookY.x,Ne],er=Bo(G,Qi,x.E.x+bn,x.zoom.x,Ki,G.cx,x.cy.x),Bh=Bo(G,Qi,x.E.x,x.zoom.x,0,G.cx,x.cy.x);if(d.position.fromArray(er.pos),Et.fromArray(Qi),d.lookAt(Et),(Math.abs(d.fov-er.fov)>1e-4||d.aspect!==x.w/x.h)&&(d.fov=er.fov,d.aspect=x.w/x.h),d.setViewOffset(x.w,x.h,er.offset[0],er.offset[1],x.w,x.h),d.updateMatrixWorld(),x.base.fromArray(Bh.pos),x.focus.set(Ie[0],0,Ie[1]),x.dimT<1){x.dimT+=y;let F=x.dimT;x.lampK=F<.12?x.dimFrom+(.12-x.dimFrom)*Yl(F/.12):F<.2?.12:.12+.88*Yl((F-.2)/.24),P=!0,F>=.44&&(x.dimT=9,x.lampK=1)}else x.lampK=1;let Wn=Ie[0]+x.offX.x,qn=Ie[1]+x.devZ.x;b.uPool.value.set(Wn,qn+.1,x.pool.x),b.uLampPos.value.set(Wn+.5,3.6,qn+1.5),b.uDim.value=x.lampK,b.uFar.value.set(q.far[0],q.far[1]),b.uLane.value.set(x.lane.x,q.width/2,zo,0),u.mask.value.set(x.lane.x,q.width/2,0,0),N.position.set(Se,0,Ne),X&&(X.counter.position.set(Se,0,Ne),X.cu.uBack.value=Ne-(q.wall||12.5),X.wall.position.set(Se,9,X.cu.uBack.value)),u.hub.value.set(x.lane.x,Ne),u.at.value.set(Wn,qn);let Eo=d.position,oi=x.base,Jl=t?1:It(y,7),tr=-9;if(R){let F=w-R.scanAt;F>0&&F<1.6&&!t&&(tr=-.06+F/1.6),F>7&&(R.scanAt=w)}let Ao=[],Lo=!1;if(x.glowing=!1,x.titles.slice().forEach(F=>{if(Math.abs(F.z-Ne)>(Zl+1.4)*q.S){ie(F);return}F.k<1&&(F.k=t?1:Math.min(1,F.k+y*5),P=!0);let tt=Math.hypot(F.x-Wn,F.z-qn);F.u.uK.value=F.k*b.uFade.value*(fe?.45:1),F.u.uLight.value=(.34+.66/Math.pow(1+tt*tt/x.pool.x,1.5))*(.25+.75*x.lampK)}),x.actors.forEach(F=>{let tt=F===ce&&!F.leaving,Co=F.g.position,Nh=fe&&he&&!tt&&ce&&(ce.type==="drink"||ce.type==="stand"),jl=F.ready?Nh?0:F.visT:0;if(F.vis+=(jl-F.vis)*(F.leaving&&!t?It(y,11):Jl),(Math.abs(jl-F.vis)>.004||!F.ready&&!F.leaving)&&(P=!0),F.leaving&&F.visT>0&&Math.abs(F.z-Ne)>(Zl+.8)*q.S&&(F.visT=0),F.leaving&&F.visT===0&&!F.ghost&&(F.ghost=!0,F.g.traverse(tn=>{tn.material&&(tn.material.depthWrite=!1)})),F.leaving&&F.vis<.012){Ao.push(F);return}F.g.visible=F.vis>.004;let Xn=F.x,Yn=F.z,cn=t?F.vis>.5?1:0:Yl(F.vis),$l=Math.hypot(Xn-Wn,Yn-qn),Po=(.16+.84/Math.pow(1+$l*$l/x.pool.x,1.5))*(.25+.75*x.lampK),Kl=F.item.available===!1;Kl&&!tt&&(Po*=.7),F.light+=(Po-F.light)*(t?1:It(y,9)),Math.abs(Po-F.light)>.004&&(P=!0);let Ql=Kl?tt?.12:.08:1;F.sat+=(Ql-F.sat)*Jl,Math.abs(Ql-F.sat)>.01&&(P=!0);let Uh=tt?x.lift.x:0;F.lift=tt?Uh:F.lift+(0-F.lift)*(t?1:It(y,10)),F.lift>.002&&!tt&&(P=!0);let Qr=F.type==="drink"?F.drink.spec.turns?1/0:0:F.type==="stand"?.95:F.type==="relief"?.45:F.type==="photo"?.3:.5;tt&&fe?x.turning||(Qr===0?(F.turn.x=0,F.turn.v=0):Io(F.turn,Qr,t?0:y)):isFinite(Qr)?Io(F.turn,Math.max(Qr,.01),t?0:y):(F.turn.v=0,F.turn.x=Math.atan2(Math.sin(F.turn.x),Math.cos(F.turn.x)),F.turn.x*=t?0:Math.exp(-y*9),Math.abs(F.turn.x)<.002&&(F.turn.x=0)),t&&!(tt&&fe)&&(F.turn.x=0,F.turn.v=0),(Math.abs(F.turn.x)>.0015||Math.abs(F.turn.v)>.01)&&(P=!0);let es=F.turn.x,ts=F.lift*q.liftY;Co.set(Xn,0,Yn);let Do=Math.atan2(oi.x-Xn,oi.z-Yn)*.85+(F.holo?0:F.spin)+es;if(F.um.uReveal.value=cn,F.um.uLight.value=F.light,F.um.uSat.value=F.sat,F.drink){let tn=F.drink.spec;if(F.pour)F.pour.t+=y,F.pose=Xl(F.pour.t,tn),F.pose.done&&(F.pour=null),P=!0;else if(!F.pose.done){let Ct=Zi(tn),Mn=t?1:It(y,9),Ht=F.pose,Sn=0;["fade","tilt","level","wobble","foam","bubbles","cam"].forEach(kt=>{Ht[kt]+=(Ct[kt]-Ht[kt])*Mn,Sn=Math.max(Sn,Math.abs(Ct[kt]-Ht[kt]))}),Ht.head=0,Ht.tail=1,Sn<.004?F.pose=Ct:P=!0}if(F.type!=="drink"){let Ct=F.drink.shared;Ct.uReveal.value=cn,Ct.uLight.value=F.light,Ct.uSat.value=F.sat}F.drink.update(F.pose,{cx:oi.x,cz:oi.z,wx:Xn+F.shape.drinkX,wz:Yn+F.shape.drinkZ,baseY:F.holo&&F.type==="drink"?an:0,yaw:F.type==="drink"?es:0,refl:u.refl.value,holo:F.holo})}if(F.type==="relief"||F.type==="stand"){let tn=tt?v:_;F.mesh.geometry!==tn&&(F.mesh.geometry=tn);let Ct=F.shape.s||1;if(F.holo){Lo=!0;let Mn=H&&!F.stock&&tt?1:0;F.um.uFocus.value+=(Mn-F.um.uFocus.value)*It(y,6),F.ub.uOn.value+=((tt?1:.4)*cn-F.ub.uOn.value)*It(y,5),F.um.uGlitch.value*=Math.exp(-y*7),F.um.uGlitch.value<.004?F.um.uGlitch.value=0:P=!0,F.um.uScan.value=tt?tr/(ss*Ct):-9;let Ht=F.float+ts+(t?0:Math.sin(w*1.1+F.x*2.1)*.018),Sn=Math.atan2(Eo.y-Ht,Math.hypot(Eo.x-Xn,Eo.z-Yn)),kt=mt(F.um.uE.value-Sn,-.4,.4),ns=ss*Ct*(tt?1.04:1);[F.mesh,F.refl].forEach(un=>{un.position.y=Ht,un.rotation.y=Do,un.rotation.x=kt,un.scale.setScalar(ns)}),F.mir.position.y=2*an,F.refl.material.depthTest=!0,F.refl.visible=F.ready&&H,F.shadow.visible=!1,lt&&(P=P||"slow")}else{let Mn=ss*Ct*(.96+.04*cn)*(1+.035*F.lift);[F.mesh,F.refl].forEach(un=>{un.position.y=.016+ts,un.rotation.y=Do,un.rotation.x=0,un.scale.setScalar(Mn)}),F.mir.position.y=0,F.refl.material.depthTest=!1,F.refl.visible=F.ready&&F.lift<.02&&u.refl.value>.02&&(F.type==="stand"||F.shape.top>.5),F.shadow.visible=F.ready,F.shadow.rotation.y=Do,F.shadow.scale.setScalar(Mn*(1+.16*F.lift)),F.shadow.material.uniforms.uK.value=(F.type==="stand"?.42:.62)*cn*(1-.42*F.lift);let Ht=Xn-(Wn+.5),Sn=Yn-(qn+1.5),kt=Math.hypot(Ht,Sn)||1,ns=(Math.min(.05,kt*.012)+.22*F.lift)/Mn;F.shadow.material.uniforms.uCast.value.set(Ht/kt*ns,Sn/kt*ns-.1*F.lift/Mn)}}else if(F.type==="drink")F.holo&&(Lo=!0,F.ub.uOn.value+=((tt?1:.4)*cn-F.ub.uOn.value)*It(y,5));else if(F.type==="photo"){let tn=F.cardSize[0],Ct=F.cardSize[1];F.mesh.position.y=.014+ts,F.mesh.rotation.y=F.spin*1.6+es,F.mesh.rotation.x=-ln/2,F.shadow.rotation.z=F.spin*1.6,F.shadow.position.set(.03+.2*F.lift,.006,.05+.16*F.lift),F.shadow.scale.set(tn*1.22,Ct*1.3,1),F.shadow.material.uniforms.uK.value=.55*cn*(1-.4*F.lift)}else F.tent.position.y=ts,F.tent.rotation.y=Math.atan2(oi.x-Xn,oi.z-Yn)*.5+F.spin+es,F.shadow.position.set(.04,.006,0),F.shadow.scale.set(Ji[0]*1.3,Ji[1]*1.5,1),F.shadow.material.uniforms.uK.value=.5*cn*(1-.5*F.lift),F.holo&&(F.ub.uOn.value+=((tt?1:.4)*cn-F.ub.uOn.value)*It(y,5))}),Ao.forEach(Be),Ao.length&&be(),x.glowing=Lo,R&&R.g.visible){let F=ce&&ce.ready?1:0;R.fxOn+=(F-R.fxOn)*It(y,6),R.fxU.uOn.value=R.fxOn,ce&&R.fx.position.copy(ce.g.position),R.hoop.position.y=Mo+Math.max(tr,0)*.92,R.hoop.material.uniforms.uOn.value=tr>-1?R.fxOn*Math.sin(mt((tr+.06)/1)*ln):0,R.halo.position.set(Wn,.8,qn-1.4),R.halo.material.opacity=.14+(t?0:Math.sin(w*.9)*.02),R.floor.position.set(Se,-.02,Ne)}let Ro=!!(ce&&ce.ready&&ce.vis>.9&&(ne.cur||H)&&b.uFade.value>.85||ce&&ce.ready&&H);return Ro!==x.heroReady&&(x.heroReady=Ro,r.onHero&&r.onHero(Ro,ce?ce.id:null)),(x.dragX.active||x.turning||i.busy())&&(P=!0),x.moving=P,P}function Jr(){if(x.lost||!x.w||!x.view)return;let y=x.bloom&&(x.glowing||x.preset&&x.preset.kind!=="table");if(o.info.reset(),y){let w=R?R.halo.visible:!1;u.glow.value=1,R&&(R.halo.visible=!1),o.setRenderTarget(z),o.render(h,d),u.glow.value=0,R&&(R.halo.visible=w),ae(z,$,2/z.width,0),ae($,oe,0,1.5/$.height),ae(oe,re,2/oe.width,0),ae(re,we,0,2/re.height)}o.setRenderTarget(null),o.render(h,d),y&&(Z.material=J,o.autoClear=!1,o.render(Le,xe),o.autoClear=!0),x.frames++,x.stats.calls=o.info.render.calls,x.stats.triangles=o.info.render.triangles,jr(),!x.full&&r.onFull&&x.heroReady&&(x.full=!0,r.onFull())}let zt=(y,w,D)=>(ji.set(y,w,D).project(d),[(ji.x*.5+.5)*x.w,(.5-ji.y*.5)*x.h]);function jr(){let y=[];x.actors.forEach(w=>{if(w.leaving||!w.ready||w.vis<.5)return;let D=w.type==="stand"||w.type==="drink"||w.type==="text",P=w.x,q=w.z,G=w.type==="text"?Ji[0]/2:w.shape.r,Y=w.lift*x.preset.liftY+(w.holo?(w.float||0)*.8:0),de=w.type==="text"?Ji[1]*.9:D?w.shape.top:w.shape.top*.5,fe=zt(P-G,Y,q),H=zt(P+G,Y,q),he=zt(P,Y,q+(D?G*.5:G)),ce=zt(P,Y+de,D?q:q-G);y.push({id:w.id,i:w.i,cx:(fe[0]+H[0])/2,cy:(he[1]+ce[1])/2,rx:Math.abs(H[0]-fe[0])/2,ry:Math.abs(he[1]-ce[1])/2,z:w.z})}),x.hot=y}function $r(y,w){let D=null,P=x.view?x.view.itemId:null;return x.hot.forEach(q=>{let G=(y-q.cx)/(q.rx*1.04),Y=(w-q.cy)/(q.ry*1.06);G*G+Y*Y<=1&&(!D||q.id===P||D.id!==P&&q.z>D.z)&&(D=q)}),D?D.id:null}function ht(){x.disposed||x.lost||r.wake&&r.wake()}function ri(y){x.slow=y>.045?x.slow+(y>.12?3:1):Math.max(0,x.slow-2),x.slow>45&&(x.slow=0,x.tier++,x.tier===1?x.bloom=!1:x.tier===2?(c=1,o.setPixelRatio(1),u.px.value=1,Vn(!0)):x.tier===3&&(c=.7,o.setPixelRatio(c),Vn(!0)),r.onTier&&r.onTier(x.tier))}function Vn(y){let w=e.clientWidth,D=e.clientHeight;if(!w||!D||!y&&w===x.w&&D===x.h)return;x.w=w,x.h=D,o.setSize(w,D,!1),d.aspect=w/D;let P=o.domElement.width,q=o.domElement.height,G=Y=>Math.max(2,Math.round(Y));z.setSize(G(P/2),G(q/2)),$.setSize(G(P/4),G(q/4)),oe.setSize(G(P/4),G(q/4)),re.setSize(G(P/8),G(q/8)),we.setSize(G(P/8),G(q/8)),x.view&&x.preset&&(et(),Ke()),ht()}let $i=y=>{y.preventDefault(),x.actors.forEach(w=>{w.pour=null,w.drink&&(w.pose=Zi(w.drink.spec))}),x.lost=!0,r.onLost&&r.onLost(!0)},Kr=()=>{x.lost=!1,x.w=0,M(),Vn(!0),r.onLost&&r.onLost(!1),ht()};e.addEventListener("webglcontextlost",$i,!1),e.addEventListener("webglcontextrestored",Kr,!1);function To(){let y=(Y,de)=>Y&&Y.width?Y.width*Y.height*4*(de?1.33:1):0,w=0,D=0,P=0;me.forEach(Y=>{Y.ready&&(w+=y(Y.tex.image,Y.tex.generateMipmaps))}),ne.texs.forEach(Y=>{Y.map&&Y.map.image&&(P+=y(Y.map.image,!0)),Y.h&&Y.h.image&&(P+=y(Y.h.image,!0))}),k.traverse(Y=>{let de=Y.material&&Y.material.uniforms&&Y.material.uniforms.map;de&&de.value&&de.value.isCanvasTexture&&!(Y.material.uniforms.uMirror&&Y.material.uniforms.uMirror.value)&&!(Y.material.uniforms.uBlank&&Y.material.uniforms.uBlank.value)&&(D+=y(de.value.image,!0))});let q=[z,$,oe,re,we].reduce((Y,de)=>Y+de.width*de.height*4,0)+z.width*z.height*4,G=Y=>+(Y/1048576).toFixed(1);return{pictures:G(w),labels:G(D),surfaces:G(P),targets:G(q),total:G(w+D+P+q)}}function M(){Pe(),x.devZ.x=0,x.devZ.v=0,[...x.actors.values()].forEach(Be),x.view=null,x.first=!0,x.hot=[],x.heroReady=null,x.lane={x:0,z:0,places:[],n:0,cat:null},x.lastP=null,x.dev.x=0,x.dev.v=0,x.dimT=9,x.lampK=1,x.full=!1}return{sync:ge,size:Vn,hit:$r,repaintCards:ke,step:Zr,draw:Jr,perf:ri,touch:wt,dragX(y,w){x.dragX.active=!!w,x.dragX.dx=w?y:0,wt(),ht()},turn(y,w,D){let P=x.view;if(!P||!P.lifted){x.turning=!1;return}let q=x.actors.get(P.itemId);if(!q)return;let G=q.type==="drink"?q.drink.spec.turns?1/0:0:q.type==="stand"?.95:q.type==="relief"?.45:q.type==="photo"?.3:.5;if(w){x.turning=!0,q.pour=null;let Y=q.turn.x+y*.0085;q.turn.x=isFinite(G)?mt(Y,-G,G):Y,q.turn.v=0}else x.turning=!1,q.turn.v=t||G===0?0:mt((D||0)*.0085,-9,9);wt(),ht()},turnBy(y){let w=x.view;if(!w||!w.lifted)return;let D=x.actors.get(w.itemId);D&&(t?D.turn.x+=y:D.turn.v+=y*6,wt(),ht())},setPointer(y,w){x.ptrT[0]=mt(y,-1,1),x.ptrT[1]=mt(w,-1,1),ht()},setTilt(y,w){x.tiltT[0]=mt(y,-1,1),x.tiltT[1]=mt(w,-1,1),ht()},feedFrameTime(y){x.frames=99,ri(y)},metrics:()=>x.frame?x.frame:null,pending:()=>le,loaded:(y=8e3)=>le===0?Promise.resolve():new Promise(w=>{K.push(w),setTimeout(w,y)}),info:()=>({moving:x.moving,tier:x.tier,bloom:x.bloom,pixelRatio:c,frames:x.frames,p:+i.state.p.toFixed(4),mode:i.state.mode,lampK:+x.lampK.toFixed(3),lift:+x.lift.x.toFixed(3),fade:+b.uFade.value.toFixed(3),heroReady:!!x.heroReady,actors:[...x.actors.values()].map(y=>({id:y.id,i:y.i,type:y.type,holo:y.holo,ready:y.ready,leaving:y.leaving,left:y.leaving&&y.visT>0,vis:+y.vis.toFixed(3),yaw:+y.turn.x.toFixed(3),lift:+y.lift.toFixed(3),sat:+y.sat.toFixed(2),x:+y.x.toFixed(2),z:+y.z.toFixed(2),pouring:!!y.pour,pose:y.pose?{tilt:+y.pose.tilt.toFixed(3),level:+y.pose.level.toFixed(3),foam:+y.pose.foam.toFixed(3),fade:+y.pose.fade.toFixed(3),t:y.pour?+y.pour.t.toFixed(2):null}:null,tris:y.drink?y.drink.tris:void 0})),hot:x.hot.map(y=>({id:y.id,cx:Math.round(y.cx),cy:Math.round(y.cy),rx:Math.round(y.rx),ry:Math.round(y.ry)})),pours:x.pours,drinks:V.stats(),stats:{calls:x.stats.calls,triangles:x.stats.triangles},memory:To(),lane:{x:+x.lane.x.toFixed(2),z:+x.lane.z.toFixed(2)},walkOn:+x.devZ.x.toFixed(3),titles:x.titles.map(y=>({text:y.text,z:+y.z.toFixed(2),k:+y.k.toFixed(2)})),textures:me.size,surfaces:ne.texs.size,scene:x.preset?x.preset.id:null,lost:x.lost,frame:x.frame,cam:{pos:d.position.toArray(),E:+x.E.x.toFixed(2),zoom:+x.zoom.x.toFixed(3),cy:+x.cy.x.toFixed(1),fov:d.fov},gl:{geometries:o.info.memory.geometries,textures:o.info.memory.textures}}),sleep(){M(),me.forEach(y=>y.tex&&y.tex.dispose()),me.clear(),o.setRenderTarget(null),o.clear()},reset:M,isLost:()=>x.lost,rewind(){x.clock=0,x.touchAt=0,x.swayK=0,x.intro=0,x.tilt=[0,0],x.tiltT=[0,0],x.ptr=[0,0],x.ptrT=[0,0],u.pulse.value=9,R&&(R.scanAt=2.2)},hush(){x.hush=!0},setWalk(y){x.walk=y===-1?-1:1},setTheme(y){y&&(s=y,y.accent&&u.accent.value.set(y.accent),x.preset=null)},resetPerf(){x.tier=0,x.slow=0,x.bloom=!0,c=r.pixelRatio||Math.min(window.devicePixelRatio||1,2),o.setPixelRatio(c),u.px.value=c,x.w=0},dispose(){x.disposed=!0,Pe(),e.removeEventListener("webglcontextlost",$i),e.removeEventListener("webglcontextrestored",Kr),[...x.actors.values()].forEach(Be),me.forEach(y=>y.tex&&y.tex.dispose()),me.clear(),ne.texs.forEach(y=>{y.map&&y.map.dispose(),y.h&&y.h.dispose()}),o.dispose()}}}export{fx as createStage};

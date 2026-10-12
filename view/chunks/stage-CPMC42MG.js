import{A as aa,B as Bc,C as la,a as Lc,b as Rc,c as bs,e as Cc,f as ia,g as Ms,n as Pc,p as ra,q as Ss,r as Ts,s as At,t as Dc,u as sa,v as Ti,w as Fc,x as Ic,y as oa,z as zc}from"./chunk-2G4G5GJB.js";/**
 * @license
 * Copyright 2010-2021 Three.js Authors
 * SPDX-License-Identifier: MIT
 */var fd=0,Nc=1,pd=2;var eh=1,md=2,Fr=3,zo=0,yt=1,Ht=2,th=1;var zr=0,Br=1,Vr=2,Uc=3,Oc=4,lr=5,ln=100,gd=101,vd=102,kc=103,Hc=104,nc=200,fn=201,xd=202,yd=203,nh=204,cr=205,_d=206,wd=207,bd=208,Md=209,Sd=210,Td=0,Ed=1,Ad=2,Wa=3,Ld=4,Rd=5,Cd=6,Pd=7,Bo=0,Dd=1,Fd=2,Nr=0,Id=1,zd=2,Bd=3,Nd=4,Ud=5,ih=300,ic=301,rc=302,Gc=303,Vc=304,sc=306,oc=307,Wr=1e3,cn=1001,qr=1002,It=1003,Wc=1004;var qc=1005;var Rt=1006,Od=1007;var wi=1008;var ac=1009,kd=1010,Hd=1011,ro=1012,Gd=1013,no=1014,$n=1015,so=1016,Vd=1017,Wd=1018,qd=1019,Ur=1020,Xd=1021,Pn=1022,un=1023,Yd=1024,Zd=1025;var Yi=1026,Xr=1027,Jd=1028,jd=1029,$d=1030,Kd=1031,Qd=1032,ef=1033,Xc=33776,Yc=33777,Zc=33778,Jc=33779,jc=35840,$c=35841,Kc=35842,Qc=35843,tf=36196,eu=37492,tu=37496,nf=37808,rf=37809,sf=37810,of=37811,af=37812,lf=37813,cf=37814,uf=37815,hf=37816,df=37817,ff=37818,pf=37819,mf=37820,gf=37821,vf=36492,xf=37840,yf=37841,_f=37842,wf=37843,bf=37844,Mf=37845,Sf=37846,Tf=37847,Ef=37848,Af=37849,Lf=37850,Rf=37851,Cf=37852,Pf=37853,Df=2200,Ff=2201,If=2202,oo=2300,ao=2301,ca=2302,Wi=2400,qi=2401,lo=2402,lc=2500,rh=2501,zf=0;var ur=3e3,cc=3001,sh=3007,oh=3002,Bf=3003,ah=3004,lh=3005,ch=3006,Nf=3200,Uf=3201,hr=0,Of=1;var ua=7680;var kf=519,Yr=35044,co=35048;var nu="300 es",Fn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let i=this._listeners[e];if(i!==void 0){let s=i.indexOf(t);s!==-1&&i.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let n=this._listeners[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let s=0,o=i.length;s<o;s++)i[s].call(this,e);e.target=null}}},St=[];for(let r=0;r<256;r++)St[r]=(r<16?"0":"")+r.toString(16);var ha=Math.PI/180,qa=180/Math.PI;function hn(){let r=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(St[r&255]+St[r>>8&255]+St[r>>16&255]+St[r>>24&255]+"-"+St[e&255]+St[e>>8&255]+"-"+St[e>>16&15|64]+St[e>>24&255]+"-"+St[t&63|128]+St[t>>8&255]+"-"+St[t>>16&255]+St[t>>24&255]+St[n&255]+St[n>>8&255]+St[n>>16&255]+St[n>>24&255]).toUpperCase()}function Ft(r,e,t){return Math.max(e,Math.min(t,r))}function Hf(r,e){return(r%e+e)%e}function da(r,e,t){return(1-t)*r+t*e}function iu(r){return(r&r-1)===0&&r!==0}function Gf(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function Vf(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}var se=class{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this)}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this)}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector2: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*n-o*i+e.x,this.y=s*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}};se.prototype.isVector2=!0;var _t=class{constructor(){this.elements=[1,0,0,0,1,0,0,0,1],arguments.length>0&&console.error("THREE.Matrix3: the constructor no longer reads arguments. use .set() instead.")}set(e,t,n,i,s,o,a,l,c){let u=this.elements;return u[0]=e,u[1]=i,u[2]=a,u[3]=t,u[4]=s,u[5]=l,u[6]=n,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],u=n[4],h=n[7],d=n[2],f=n[5],g=n[8],x=i[0],y=i[3],m=i[6],p=i[1],R=i[4],A=i[7],C=i[2],w=i[5],F=i[8];return s[0]=o*x+a*p+l*C,s[3]=o*y+a*R+l*w,s[6]=o*m+a*A+l*F,s[1]=c*x+u*p+h*C,s[4]=c*y+u*R+h*w,s[7]=c*m+u*A+h*F,s[2]=d*x+f*p+g*C,s[5]=d*y+f*R+g*w,s[8]=d*m+f*A+g*F,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-n*s*u+n*a*l+i*s*c-i*o*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=u*o-a*c,d=a*l-u*s,f=c*s-o*l,g=t*h+n*d+i*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=h*x,e[1]=(i*c-u*n)*x,e[2]=(a*n-i*o)*x,e[3]=d*x,e[4]=(u*t-i*l)*x,e[5]=(i*s-a*t)*x,e[6]=f*x,e[7]=(n*l-c*t)*x,e[8]=(o*t-n*s)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,o,a){let l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-i*c,i*l,-i*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){let n=this.elements;return n[0]*=e,n[3]*=e,n[6]*=e,n[1]*=t,n[4]*=t,n[7]*=t,this}rotate(e){let t=Math.cos(e),n=Math.sin(e),i=this.elements,s=i[0],o=i[3],a=i[6],l=i[1],c=i[4],u=i[7];return i[0]=t*s+n*l,i[3]=t*o+n*c,i[6]=t*a+n*u,i[1]=-n*s+t*l,i[4]=-n*o+t*c,i[7]=-n*a+t*u,this}translate(e,t){let n=this.elements;return n[0]+=e*n[2],n[3]+=e*n[5],n[6]+=e*n[8],n[1]+=t*n[2],n[4]+=t*n[5],n[7]+=t*n[8],this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};_t.prototype.isMatrix3=!0;var Ei,ei=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement=="undefined")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Ei===void 0&&(Ei=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")),Ei.width=e.width,Ei.height=e.height;let n=Ei.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=Ei}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}},Wf=0,Pt=class r extends Fn{constructor(e=r.DEFAULT_IMAGE,t=r.DEFAULT_MAPPING,n=cn,i=cn,s=Rt,o=wi,a=un,l=ac,c=1,u=ur){super(),Object.defineProperty(this,"id",{value:Wf++}),this.uuid=hn(),this.name="",this.image=e,this.mipmaps=[],this.mapping=t,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new se(0,0),this.repeat=new se(1,1),this.center=new se(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new _t,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.encoding=u,this.version=0,this.onUpdate=null}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.image=e.image,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.encoding=e.encoding,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.5,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,mapping:this.mapping,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,type:this.type,encoding:this.encoding,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(this.image!==void 0){let i=this.image;if(i.uuid===void 0&&(i.uuid=hn()),!t&&e.images[i.uuid]===void 0){let s;if(Array.isArray(i)){s=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?s.push(fa(i[o].image)):s.push(fa(i[o]))}else s=fa(i);e.images[i.uuid]={uuid:i.uuid,url:s}}n.image=i.uuid}return t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==ih)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Wr:e.x=e.x-Math.floor(e.x);break;case cn:e.x=e.x<0?0:1;break;case qr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Wr:e.y=e.y-Math.floor(e.y);break;case cn:e.y=e.y<0?0:1;break;case qr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&this.version++}};Pt.DEFAULT_IMAGE=void 0;Pt.DEFAULT_MAPPING=ih;Pt.prototype.isTexture=!0;function fa(r){return typeof HTMLImageElement!="undefined"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&r instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&r instanceof ImageBitmap?ei.getDataURL(r):r.data?{data:Array.prototype.slice.call(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Je=class{constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector4: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector4: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*s,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*s,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*s,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,s,l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],g=l[9],x=l[2],y=l[6],m=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-x)<.01&&Math.abs(g-y)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+x)<.1&&Math.abs(g+y)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let R=(c+1)/2,A=(f+1)/2,C=(m+1)/2,w=(u+d)/4,F=(h+x)/4,B=(g+y)/4;return R>A&&R>C?R<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(R),i=w/n,s=F/n):A>C?A<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(A),n=w/i,s=B/i):C<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(C),n=F/s,i=B/s),this.set(n,i,s,t),this}let p=Math.sqrt((y-g)*(y-g)+(h-x)*(h-x)+(d-u)*(d-u));return Math.abs(p)<.001&&(p=1),this.x=(y-g)/p,this.y=(h-x)/p,this.z=(d-u)/p,this.w=Math.acos((c+f+m-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this.w=this.w<0?Math.ceil(this.w):Math.floor(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector4: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}};Je.prototype.isVector4=!0;var dn=class extends Fn{constructor(e,t,n){super(),this.width=e,this.height=t,this.depth=1,this.scissor=new Je(0,0,e,t),this.scissorTest=!1,this.viewport=new Je(0,0,e,t),n=n||{},this.texture=new Pt(void 0,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.encoding),this.texture.image={},this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=1,this.texture.generateMipmaps=n.generateMipmaps!==void 0?n.generateMipmaps:!1,this.texture.minFilter=n.minFilter!==void 0?n.minFilter:Rt,this.depthBuffer=n.depthBuffer!==void 0?n.depthBuffer:!0,this.stencilBuffer=n.stencilBuffer!==void 0?n.stencilBuffer:!1,this.depthTexture=n.depthTexture!==void 0?n.depthTexture:null}setTexture(e){e.image={width:this.width,height:this.height,depth:this.depth},this.texture=e}setSize(e,t,n=1){(this.width!==e||this.height!==t||this.depth!==n)&&(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.width=e.width,this.height=e.height,this.depth=e.depth,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.depthTexture=e.depthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}};dn.prototype.isWebGLRenderTarget=!0;var Xa=class extends dn{constructor(e,t,n){super(e,t,n),this.samples=4}copy(e){return super.copy.call(this,e),this.samples=e.samples,this}};Xa.prototype.isWebGLMultisampleRenderTarget=!0;var Et=class{constructor(e=0,t=0,n=0,i=1){this._x=e,this._y=t,this._z=n,this._w=i}static slerp(e,t,n,i){return console.warn("THREE.Quaternion: Static .slerp() has been deprecated. Use qm.slerpQuaternions( qa, qb, t ) instead."),n.slerpQuaternions(e,t,i)}static slerpFlat(e,t,n,i,s,o,a){let l=n[i+0],c=n[i+1],u=n[i+2],h=n[i+3],d=s[o+0],f=s[o+1],g=s[o+2],x=s[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(a===1){e[t+0]=d,e[t+1]=f,e[t+2]=g,e[t+3]=x;return}if(h!==x||l!==d||c!==f||u!==g){let y=1-a,m=l*d+c*f+u*g+h*x,p=m>=0?1:-1,R=1-m*m;if(R>Number.EPSILON){let C=Math.sqrt(R),w=Math.atan2(C,m*p);y=Math.sin(y*w)/C,a=Math.sin(a*w)/C}let A=a*p;if(l=l*y+d*A,c=c*y+f*A,u=u*y+g*A,h=h*y+x*A,y===1-a){let C=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=C,c*=C,u*=C,h*=C}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,s,o){let a=n[i],l=n[i+1],c=n[i+2],u=n[i+3],h=s[o],d=s[o+1],f=s[o+2],g=s[o+3];return e[t]=a*g+u*h+l*f-c*d,e[t+1]=l*g+u*d+c*h-a*f,e[t+2]=c*g+u*f+a*d-l*h,e[t+3]=u*g-a*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t){if(!(e&&e.isEuler))throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");let n=e._x,i=e._y,s=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),u=a(i/2),h=a(s/2),d=l(n/2),f=l(i/2),g=l(s/2);switch(o){case"XYZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"YXZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"ZXY":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"ZYX":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"YZX":this._x=d*u*h+c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h-d*f*g;break;case"XZY":this._x=d*u*h-c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t!==!1&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],s=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=n+a+h;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(s-c)*f,this._z=(o-i)*f}else if(n>a&&n>h){let f=2*Math.sqrt(1+n-a-h);this._w=(u-l)/f,this._x=.25*f,this._y=(i+o)/f,this._z=(s+c)/f}else if(a>h){let f=2*Math.sqrt(1+a-n-h);this._w=(s-c)/f,this._x=(i+o)/f,this._y=.25*f,this._z=(l+u)/f}else{let f=2*Math.sqrt(1+h-n-a);this._w=(o-i)/f,this._x=(s+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ft(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e,t){return t!==void 0?(console.warn("THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead."),this.multiplyQuaternions(e,t)):this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,s=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+o*a+i*c-s*l,this._y=i*u+o*l+s*a-n*c,this._z=s*u+o*c+n*l-i*a,this._w=o*u-n*a-i*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,i=this._y,s=this._z,o=this._w,a=o*e._w+n*e._x+i*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=i,this._z=s,this;let l=1-a*a;if(l<=Number.EPSILON){let f=1-t;return this._w=f*o+t*this._w,this._x=f*n+t*this._x,this._y=f*i+t*this._y,this._z=f*s+t*this._z,this.normalize(),this._onChangeCallback(),this}let c=Math.sqrt(l),u=Math.atan2(c,a),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=o*h+this._w*d,this._x=n*h+this._x*d,this._y=i*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){this.copy(e).slerp(t,n)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}};Et.prototype.isQuaternion=!0;var M=class{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e,t){return t!==void 0?(console.warn("THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e,t){return t!==void 0?(console.warn("THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e,t){return t!==void 0?(console.warn("THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead."),this.multiplyVectors(e,t)):(this.x*=e.x,this.y*=e.y,this.z*=e.z,this)}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return e&&e.isEuler||console.error("THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order."),this.applyQuaternion(ru.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(ru.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=e.elements,o=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*o,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*o,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,s=e.x,o=e.y,a=e.z,l=e.w,c=l*t+o*i-a*n,u=l*n+a*t-s*i,h=l*i+s*n-o*t,d=-s*t-o*n-a*i;return this.x=c*l+d*-s+u*-a-h*-o,this.y=u*l+d*-o+h*-s-c*-a,this.z=h*l+d*-a+c*-o-u*-s,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e,t){return t!==void 0?(console.warn("THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead."),this.crossVectors(e,t)):this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,s=e.z,o=t.x,a=t.y,l=t.z;return this.x=i*l-s*a,this.y=s*o-n*l,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return pa.copy(this).projectOnVector(e),this.sub(pa)}reflect(e){return this.sub(pa.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ft(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t,n){return n!==void 0&&console.warn("THREE.Vector3: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}};M.prototype.isVector3=!0;var pa=new M,ru=new Et,Ot=class{constructor(e=new M(1/0,1/0,1/0),t=new M(-1/0,-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){let t=1/0,n=1/0,i=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=e.length;l<c;l+=3){let u=e[l],h=e[l+1],d=e[l+2];u<t&&(t=u),h<n&&(n=h),d<i&&(i=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,n,i),this.max.set(s,o,a),this}setFromBufferAttribute(e){let t=1/0,n=1/0,i=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=e.count;l<c;l++){let u=e.getX(l),h=e.getY(l),d=e.getZ(l);u<t&&(t=u),h<n&&(n=h),d<i&&(i=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,n,i),this.max.set(s,o,a),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Mr.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e){return this.makeEmpty(),this.expandByObject(e)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return e===void 0&&(console.warn("THREE.Box3: .getCenter() target is now required"),e=new M),this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(console.warn("THREE.Box3: .getSize() target is now required"),e=new M),this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e){e.updateWorldMatrix(!1,!1);let t=e.geometry;t!==void 0&&(t.boundingBox===null&&t.computeBoundingBox(),ma.copy(t.boundingBox),ma.applyMatrix4(e.matrixWorld),this.union(ma));let n=e.children;for(let i=0,s=n.length;i<s;i++)this.expandByObject(n[i]);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t===void 0&&(console.warn("THREE.Box3: .getParameter() target is now required"),t=new M),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,Mr),Mr.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Sr),Es.subVectors(this.max,Sr),Ai.subVectors(e.a,Sr),Li.subVectors(e.b,Sr),Ri.subVectors(e.c,Sr),Vn.subVectors(Li,Ai),Wn.subVectors(Ri,Li),fi.subVectors(Ai,Ri);let t=[0,-Vn.z,Vn.y,0,-Wn.z,Wn.y,0,-fi.z,fi.y,Vn.z,0,-Vn.x,Wn.z,0,-Wn.x,fi.z,0,-fi.x,-Vn.y,Vn.x,0,-Wn.y,Wn.x,0,-fi.y,fi.x,0];return!ga(t,Ai,Li,Ri,Es)||(t=[1,0,0,0,1,0,0,0,1],!ga(t,Ai,Li,Ri,Es))?!1:(As.crossVectors(Vn,Wn),t=[As.x,As.y,As.z],ga(t,Ai,Li,Ri,Es))}clampPoint(e,t){return t===void 0&&(console.warn("THREE.Box3: .clampPoint() target is now required"),t=new M),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return Mr.copy(e).clamp(this.min,this.max).sub(e).length()}getBoundingSphere(e){return e===void 0&&console.error("THREE.Box3: .getBoundingSphere() target is now required"),this.getCenter(e.center),e.radius=this.getSize(Mr).length()*.5,e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(En[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),En[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),En[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),En[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),En[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),En[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),En[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),En[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(En),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};Ot.prototype.isBox3=!0;var En=[new M,new M,new M,new M,new M,new M,new M,new M],Mr=new M,ma=new Ot,Ai=new M,Li=new M,Ri=new M,Vn=new M,Wn=new M,fi=new M,Sr=new M,Es=new M,As=new M,pi=new M;function ga(r,e,t,n,i){for(let s=0,o=r.length-3;s<=o;s+=3){pi.fromArray(r,s);let a=i.x*Math.abs(pi.x)+i.y*Math.abs(pi.y)+i.z*Math.abs(pi.z),l=e.dot(pi),c=t.dot(pi),u=n.dot(pi);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var qf=new Ot,su=new M,va=new M,xa=new M,ti=class{constructor(e=new M,t=-1){this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):qf.setFromPoints(e).getCenter(n);let i=0;for(let s=0,o=e.length;s<o;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t===void 0&&(console.warn("THREE.Sphere: .clampPoint() target is now required"),t=new M),t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return e===void 0&&(console.warn("THREE.Sphere: .getBoundingBox() target is now required"),e=new Ot),this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){xa.subVectors(e,this.center);let t=xa.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.add(xa.multiplyScalar(i/n)),this.radius+=i}return this}union(e){return va.subVectors(e.center,this.center).normalize().multiplyScalar(e.radius),this.expandByPoint(su.copy(e.center).add(va)),this.expandByPoint(su.copy(e.center).sub(va)),this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},An=new M,ya=new M,Ls=new M,qn=new M,_a=new M,Rs=new M,wa=new M,ni=class{constructor(e=new M,t=new M(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t===void 0&&(console.warn("THREE.Ray: .at() target is now required"),t=new M),t.copy(this.direction).multiplyScalar(e).add(this.origin)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,An)),this}closestPointToPoint(e,t){t===void 0&&(console.warn("THREE.Ray: .closestPointToPoint() target is now required"),t=new M),t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.direction).multiplyScalar(n).add(this.origin)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=An.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(An.copy(this.direction).multiplyScalar(t).add(this.origin),An.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){ya.copy(e).add(t).multiplyScalar(.5),Ls.copy(t).sub(e).normalize(),qn.copy(this.origin).sub(ya);let s=e.distanceTo(t)*.5,o=-this.direction.dot(Ls),a=qn.dot(this.direction),l=-qn.dot(Ls),c=qn.lengthSq(),u=Math.abs(1-o*o),h,d,f,g;if(u>0)if(h=o*l-a,d=o*a-l,g=s*u,h>=0)if(d>=-g)if(d<=g){let x=1/u;h*=x,d*=x,f=h*(h+o*d+2*a)+d*(o*h+d+2*l)+c}else d=s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d<=-g?(h=Math.max(0,-(-o*s+a)),d=h>0?-s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c):d<=g?(h=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(h=Math.max(0,-(o*s+a)),d=h>0?s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c);else d=o>0?-s:s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;return n&&n.copy(this.direction).multiplyScalar(h).add(this.origin),i&&i.copy(Ls).multiplyScalar(d).add(ya),f}intersectSphere(e,t){An.subVectors(e.center,this.origin);let n=An.dot(this.direction),i=An.dot(An)-n*n,s=e.radius*e.radius;if(i>s)return null;let o=Math.sqrt(s-i),a=n-o,l=n+o;return a<0&&l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,s,o,a,l,c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,o=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,o=(e.min.y-d.y)*u),n>o||s>i||((s>n||n!==n)&&(n=s),(o<i||i!==i)&&(i=o),h>=0?(a=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(a=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,An)!==null}intersectTriangle(e,t,n,i,s){_a.subVectors(t,e),Rs.subVectors(n,e),wa.crossVectors(_a,Rs);let o=this.direction.dot(wa),a;if(o>0){if(i)return null;a=1}else if(o<0)a=-1,o=-o;else return null;qn.subVectors(this.origin,e);let l=a*this.direction.dot(Rs.crossVectors(qn,Rs));if(l<0)return null;let c=a*this.direction.dot(_a.cross(qn));if(c<0||l+c>o)return null;let u=-a*qn.dot(wa);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ie=class r{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],arguments.length>0&&console.error("THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.")}set(e,t,n,i,s,o,a,l,c,u,h,d,f,g,x,y){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=s,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=u,m[10]=h,m[14]=d,m[3]=f,m[7]=g,m[11]=x,m[15]=y,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new r().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,i=1/Ci.setFromMatrixColumn(e,0).length(),s=1/Ci.setFromMatrixColumn(e,1).length(),o=1/Ci.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){e&&e.isEuler||console.error("THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.");let t=this.elements,n=e.x,i=e.y,s=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(i),c=Math.sin(i),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){let d=o*u,f=o*h,g=a*u,x=a*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+g*c,t[5]=d-x*c,t[9]=-a*l,t[2]=x-d*c,t[6]=g+f*c,t[10]=o*l}else if(e.order==="YXZ"){let d=l*u,f=l*h,g=c*u,x=c*h;t[0]=d+x*a,t[4]=g*a-f,t[8]=o*c,t[1]=o*h,t[5]=o*u,t[9]=-a,t[2]=f*a-g,t[6]=x+d*a,t[10]=o*l}else if(e.order==="ZXY"){let d=l*u,f=l*h,g=c*u,x=c*h;t[0]=d-x*a,t[4]=-o*h,t[8]=g+f*a,t[1]=f+g*a,t[5]=o*u,t[9]=x-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let d=o*u,f=o*h,g=a*u,x=a*h;t[0]=l*u,t[4]=g*c-f,t[8]=d*c+x,t[1]=l*h,t[5]=x*c+d,t[9]=f*c-g,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let d=o*l,f=o*c,g=a*l,x=a*c;t[0]=l*u,t[4]=x-d*h,t[8]=g*h+f,t[1]=h,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=f*h+g,t[10]=d-x*h}else if(e.order==="XZY"){let d=o*l,f=o*c,g=a*l,x=a*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+x,t[5]=o*u,t[9]=f*h-g,t[2]=g*h-f,t[6]=a*u,t[10]=x*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Xf,e,Yf)}lookAt(e,t,n){let i=this.elements;return Xt.subVectors(e,t),Xt.lengthSq()===0&&(Xt.z=1),Xt.normalize(),Xn.crossVectors(n,Xt),Xn.lengthSq()===0&&(Math.abs(n.z)===1?Xt.x+=1e-4:Xt.z+=1e-4,Xt.normalize(),Xn.crossVectors(n,Xt)),Xn.normalize(),Cs.crossVectors(Xt,Xn),i[0]=Xn.x,i[4]=Cs.x,i[8]=Xt.x,i[1]=Xn.y,i[5]=Cs.y,i[9]=Xt.y,i[2]=Xn.z,i[6]=Cs.z,i[10]=Xt.z,this}multiply(e,t){return t!==void 0?(console.warn("THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead."),this.multiplyMatrices(e,t)):this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],u=n[1],h=n[5],d=n[9],f=n[13],g=n[2],x=n[6],y=n[10],m=n[14],p=n[3],R=n[7],A=n[11],C=n[15],w=i[0],F=i[4],B=i[8],O=i[12],H=i[1],K=i[5],q=i[9],D=i[13],z=i[2],N=i[6],P=i[10],te=i[14],ce=i[3],oe=i[7],we=i[11],pe=i[15];return s[0]=o*w+a*H+l*z+c*ce,s[4]=o*F+a*K+l*N+c*oe,s[8]=o*B+a*q+l*P+c*we,s[12]=o*O+a*D+l*te+c*pe,s[1]=u*w+h*H+d*z+f*ce,s[5]=u*F+h*K+d*N+f*oe,s[9]=u*B+h*q+d*P+f*we,s[13]=u*O+h*D+d*te+f*pe,s[2]=g*w+x*H+y*z+m*ce,s[6]=g*F+x*K+y*N+m*oe,s[10]=g*B+x*q+y*P+m*we,s[14]=g*O+x*D+y*te+m*pe,s[3]=p*w+R*H+A*z+C*ce,s[7]=p*F+R*K+A*N+C*oe,s[11]=p*B+R*q+A*P+C*we,s[15]=p*O+R*D+A*te+C*pe,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],g=e[3],x=e[7],y=e[11],m=e[15];return g*(+s*l*h-i*c*h-s*a*d+n*c*d+i*a*f-n*l*f)+x*(+t*l*f-t*c*d+s*o*d-i*o*f+i*c*u-s*l*u)+y*(+t*c*h-t*a*f-s*o*h+n*o*f+s*a*u-n*c*u)+m*(-i*a*u-t*l*h+t*a*d+i*o*h-n*o*d+n*l*u)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],g=e[12],x=e[13],y=e[14],m=e[15],p=h*y*c-x*d*c+x*l*f-a*y*f-h*l*m+a*d*m,R=g*d*c-u*y*c-g*l*f+o*y*f+u*l*m-o*d*m,A=u*x*c-g*h*c+g*a*f-o*x*f-u*a*m+o*h*m,C=g*h*l-u*x*l-g*a*d+o*x*d+u*a*y-o*h*y,w=t*p+n*R+i*A+s*C;if(w===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/w;return e[0]=p*F,e[1]=(x*d*s-h*y*s-x*i*f+n*y*f+h*i*m-n*d*m)*F,e[2]=(a*y*s-x*l*s+x*i*c-n*y*c-a*i*m+n*l*m)*F,e[3]=(h*l*s-a*d*s-h*i*c+n*d*c+a*i*f-n*l*f)*F,e[4]=R*F,e[5]=(u*y*s-g*d*s+g*i*f-t*y*f-u*i*m+t*d*m)*F,e[6]=(g*l*s-o*y*s-g*i*c+t*y*c+o*i*m-t*l*m)*F,e[7]=(o*d*s-u*l*s+u*i*c-t*d*c-o*i*f+t*l*f)*F,e[8]=A*F,e[9]=(g*h*s-u*x*s-g*n*f+t*x*f+u*n*m-t*h*m)*F,e[10]=(o*x*s-g*a*s+g*n*c-t*x*c-o*n*m+t*a*m)*F,e[11]=(u*a*s-o*h*s-u*n*c+t*h*c+o*n*f-t*a*f)*F,e[12]=C*F,e[13]=(u*x*i-g*h*i+g*n*d-t*x*d-u*n*y+t*h*y)*F,e[14]=(g*a*i-o*x*i-g*n*l+t*x*l+o*n*y-t*a*y)*F,e[15]=(o*h*i-u*a*i+u*n*l-t*h*l-o*n*d+t*a*d)*F,this}scale(e){let t=this.elements,n=e.x,i=e.y,s=e.z;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),s=1-n,o=e.x,a=e.y,l=e.z,c=s*o,u=s*a;return this.set(c*o+n,c*a-i*l,c*l+i*a,0,c*a+i*l,u*a+n,u*l-i*o,0,c*l-i*a,u*l+i*o,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n){return this.set(1,t,n,0,e,1,n,0,e,t,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,s=t._x,o=t._y,a=t._z,l=t._w,c=s+s,u=o+o,h=a+a,d=s*c,f=s*u,g=s*h,x=o*u,y=o*h,m=a*h,p=l*c,R=l*u,A=l*h,C=n.x,w=n.y,F=n.z;return i[0]=(1-(x+m))*C,i[1]=(f+A)*C,i[2]=(g-R)*C,i[3]=0,i[4]=(f-A)*w,i[5]=(1-(d+m))*w,i[6]=(y+p)*w,i[7]=0,i[8]=(g+R)*F,i[9]=(y-p)*F,i[10]=(1-(d+x))*F,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements,s=Ci.set(i[0],i[1],i[2]).length(),o=Ci.set(i[4],i[5],i[6]).length(),a=Ci.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),e.x=i[12],e.y=i[13],e.z=i[14],rn.copy(this);let c=1/s,u=1/o,h=1/a;return rn.elements[0]*=c,rn.elements[1]*=c,rn.elements[2]*=c,rn.elements[4]*=u,rn.elements[5]*=u,rn.elements[6]*=u,rn.elements[8]*=h,rn.elements[9]*=h,rn.elements[10]*=h,t.setFromRotationMatrix(rn),n.x=s,n.y=o,n.z=a,this}makePerspective(e,t,n,i,s,o){o===void 0&&console.warn("THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.");let a=this.elements,l=2*s/(t-e),c=2*s/(n-i),u=(t+e)/(t-e),h=(n+i)/(n-i),d=-(o+s)/(o-s),f=-2*o*s/(o-s);return a[0]=l,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=c,a[9]=h,a[13]=0,a[2]=0,a[6]=0,a[10]=d,a[14]=f,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(e,t,n,i,s,o){let a=this.elements,l=1/(t-e),c=1/(n-i),u=1/(o-s),h=(t+e)*l,d=(n+i)*c,f=(o+s)*u;return a[0]=2*l,a[4]=0,a[8]=0,a[12]=-h,a[1]=0,a[5]=2*c,a[9]=0,a[13]=-d,a[2]=0,a[6]=0,a[10]=-2*u,a[14]=-f,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};Ie.prototype.isMatrix4=!0;var Ci=new M,rn=new Ie,Xf=new M(0,0,0),Yf=new M(1,1,1),Xn=new M,Cs=new M,Xt=new M,ou=new Ie,au=new Et,Zi=class r{constructor(e=0,t=0,n=0,i=r.DefaultOrder){this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._order=i||this._order,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t,n){let i=e.elements,s=i[0],o=i[4],a=i[8],l=i[1],c=i[5],u=i[9],h=i[2],d=i[6],f=i[10];switch(t=t||this._order,t){case"XYZ":this._y=Math.asin(Ft(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ft(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ft(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ft(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ft(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-Ft(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n!==!1&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ou.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ou,t,n)}setFromVector3(e,t){return this.set(e.x,e.y,e.z,t||this._order)}reorder(e){return au.setFromEuler(this),this.setFromQuaternion(au,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}toVector3(e){return e?e.set(this._x,this._y,this._z):new M(this._x,this._y,this._z)}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}};Zi.prototype.isEuler=!0;Zi.DefaultOrder="XYZ";Zi.RotationOrders=["XYZ","YZX","ZXY","XZY","YXZ","ZYX"];var Ya=class{constructor(){this.mask=1}set(e){this.mask=1<<e|0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}},Zf=0,lu=new M,Pi=new Et,Ln=new Ie,Ps=new M,Tr=new M,Jf=new M,jf=new Et,cu=new M(1,0,0),uu=new M(0,1,0),hu=new M(0,0,1),$f={type:"added"},du={type:"removed"},nt=class r extends Fn{constructor(){super(),Object.defineProperty(this,"id",{value:Zf++}),this.uuid=hn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=r.DefaultUp.clone();let e=new M,t=new Zi,n=new Et,i=new M(1,1,1);function s(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ie},normalMatrix:{value:new _t}}),this.matrix=new Ie,this.matrixWorld=new Ie,this.matrixAutoUpdate=r.DefaultMatrixAutoUpdate,this.matrixWorldNeedsUpdate=!1,this.layers=new Ya,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Pi.setFromAxisAngle(e,t),this.quaternion.multiply(Pi),this}rotateOnWorldAxis(e,t){return Pi.setFromAxisAngle(e,t),this.quaternion.premultiply(Pi),this}rotateX(e){return this.rotateOnAxis(cu,e)}rotateY(e){return this.rotateOnAxis(uu,e)}rotateZ(e){return this.rotateOnAxis(hu,e)}translateOnAxis(e,t){return lu.copy(e).applyQuaternion(this.quaternion),this.position.add(lu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(cu,e)}translateY(e){return this.translateOnAxis(uu,e)}translateZ(e){return this.translateOnAxis(hu,e)}localToWorld(e){return e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return e.applyMatrix4(Ln.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Ps.copy(e):Ps.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Tr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Ln.lookAt(Tr,Ps,this.up):Ln.lookAt(Ps,Tr,this.up),this.quaternion.setFromRotationMatrix(Ln),i&&(Ln.extractRotation(i.matrixWorld),Pi.setFromRotationMatrix(Ln),this.quaternion.premultiply(Pi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent($f)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(du)),this}clear(){for(let e=0;e<this.children.length;e++){let t=this.children[e];t.parent=null,t.dispatchEvent(du)}return this.children.length=0,this}attach(e){return this.updateWorldMatrix(!0,!1),Ln.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Ln.multiply(e.parent.matrixWorld)),e.applyMatrix4(Ln),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getWorldPosition(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldPosition() target is now required"),e=new M),this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldQuaternion() target is now required"),e=new Et),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Tr,e,Jf),e}getWorldScale(e){return e===void 0&&(console.warn("THREE.Object3D: .getWorldScale() target is now required"),e=new M),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Tr,jf,e),e}getWorldDirection(e){e===void 0&&(console.warn("THREE.Object3D: .getWorldDirection() target is now required"),e=new M),this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){let i=this.children;for(let s=0,o=i.length;s<o;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{}},n.metadata={version:4.5,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),JSON.stringify(this.userData)!=="{}"&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON()));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(e.materials,this.material[l]));i.material=a}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(s(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),h=o(e.shapes),d=o(e.skeletons),f=o(e.animations);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),h.length>0&&(n.shapes=h),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f)}return n.object=i,n;function o(a){let l=[];for(let c in a){let u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};nt.DefaultUp=new M(0,1,0);nt.DefaultMatrixAutoUpdate=!0;nt.prototype.isObject3D=!0;var ba=new M,Kf=new M,Qf=new _t,$t=class{constructor(e=new M(1,0,0),t=0){this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=ba.subVectors(n,t).cross(Kf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t===void 0&&(console.warn("THREE.Plane: .projectPoint() target is now required"),t=new M),t.copy(this.normal).multiplyScalar(-this.distanceToPoint(e)).add(e)}intersectLine(e,t){t===void 0&&(console.warn("THREE.Plane: .intersectLine() target is now required"),t=new M);let n=e.delta(ba),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let s=-(e.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:t.copy(n).multiplyScalar(s).add(e.start)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e===void 0&&(console.warn("THREE.Plane: .coplanarPoint() target is now required"),e=new M),e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Qf.getNormalMatrix(e),i=this.coplanarPoint(ba).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}};$t.prototype.isPlane=!0;var sn=new M,Rn=new M,Ma=new M,Cn=new M,Di=new M,Fi=new M,fu=new M,Sa=new M,Ta=new M,Ea=new M,Ct=class r{constructor(e=new M,t=new M,n=new M){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i===void 0&&(console.warn("THREE.Triangle: .getNormal() target is now required"),i=new M),i.subVectors(n,t),sn.subVectors(e,t),i.cross(sn);let s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(e,t,n,i,s){sn.subVectors(i,t),Rn.subVectors(n,t),Ma.subVectors(e,t);let o=sn.dot(sn),a=sn.dot(Rn),l=sn.dot(Ma),c=Rn.dot(Rn),u=Rn.dot(Ma),h=o*c-a*a;if(s===void 0&&(console.warn("THREE.Triangle: .getBarycoord() target is now required"),s=new M),h===0)return s.set(-2,-1,-1);let d=1/h,f=(c*l-a*u)*d,g=(o*u-a*l)*d;return s.set(1-f-g,g,f)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,Cn),Cn.x>=0&&Cn.y>=0&&Cn.x+Cn.y<=1}static getUV(e,t,n,i,s,o,a,l){return this.getBarycoord(e,t,n,i,Cn),l.set(0,0),l.addScaledVector(s,Cn.x),l.addScaledVector(o,Cn.y),l.addScaledVector(a,Cn.z),l}static isFrontFacing(e,t,n,i){return sn.subVectors(n,t),Rn.subVectors(e,t),sn.cross(Rn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return sn.subVectors(this.c,this.b),Rn.subVectors(this.a,this.b),sn.cross(Rn).length()*.5}getMidpoint(e){return e===void 0&&(console.warn("THREE.Triangle: .getMidpoint() target is now required"),e=new M),e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return r.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e===void 0&&(console.warn("THREE.Triangle: .getPlane() target is now required"),e=new $t),e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return r.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,i,s){return r.getUV(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return r.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return r.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){t===void 0&&(console.warn("THREE.Triangle: .closestPointToPoint() target is now required"),t=new M);let n=this.a,i=this.b,s=this.c,o,a;Di.subVectors(i,n),Fi.subVectors(s,n),Sa.subVectors(e,n);let l=Di.dot(Sa),c=Fi.dot(Sa);if(l<=0&&c<=0)return t.copy(n);Ta.subVectors(e,i);let u=Di.dot(Ta),h=Fi.dot(Ta);if(u>=0&&h<=u)return t.copy(i);let d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(n).addScaledVector(Di,o);Ea.subVectors(e,s);let f=Di.dot(Ea),g=Fi.dot(Ea);if(g>=0&&f<=g)return t.copy(s);let x=f*c-l*g;if(x<=0&&c>=0&&g<=0)return a=c/(c-g),t.copy(n).addScaledVector(Fi,a);let y=u*g-f*h;if(y<=0&&h-u>=0&&f-g>=0)return fu.subVectors(s,i),a=(h-u)/(h-u+(f-g)),t.copy(i).addScaledVector(fu,a);let m=1/(y+x+d);return o=x*m,a=d*m,t.copy(n).addScaledVector(Di,o).addScaledVector(Fi,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},ep=0;function Mt(){Object.defineProperty(this,"id",{value:ep++}),this.uuid=hn(),this.name="",this.type="Material",this.fog=!0,this.blending=Br,this.side=zo,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.blendSrc=nh,this.blendDst=cr,this.blendEquation=ln,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.depthFunc=Wa,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=kf,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ua,this.stencilZFail=ua,this.stencilZPass=ua,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaTest=0,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0}Mt.prototype=Object.assign(Object.create(Fn.prototype),{constructor:Mt,isMaterial:!0,onBuild:function(){},onBeforeCompile:function(){},customProgramCacheKey:function(){return this.onBeforeCompile.toString()},setValues:function(r){if(r!==void 0)for(let e in r){let t=r[e];if(t===void 0){console.warn("THREE.Material: '"+e+"' parameter is undefined.");continue}if(e==="shading"){console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=t===th;continue}let n=this[e];if(n===void 0){console.warn("THREE."+this.type+": '"+e+"' is not a property of this material.");continue}n&&n.isColor?n.set(t):n&&n.isVector3&&t&&t.isVector3?n.copy(t):this[e]=t}},toJSON:function(r){let e=r===void 0||typeof r=="string";e&&(r={textures:{},images:{}});let t={metadata:{version:4.5,type:"Material",generator:"Material.toJSON"}};t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),this.color&&this.color.isColor&&(t.color=this.color.getHex()),this.roughness!==void 0&&(t.roughness=this.roughness),this.metalness!==void 0&&(t.metalness=this.metalness),this.sheen&&this.sheen.isColor&&(t.sheen=this.sheen.getHex()),this.emissive&&this.emissive.isColor&&(t.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(t.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(t.specular=this.specular.getHex()),this.shininess!==void 0&&(t.shininess=this.shininess),this.clearcoat!==void 0&&(t.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(t.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(t.clearcoatMap=this.clearcoatMap.toJSON(r).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(t.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(r).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(t.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(r).uuid,t.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.map&&this.map.isTexture&&(t.map=this.map.toJSON(r).uuid),this.matcap&&this.matcap.isTexture&&(t.matcap=this.matcap.toJSON(r).uuid),this.alphaMap&&this.alphaMap.isTexture&&(t.alphaMap=this.alphaMap.toJSON(r).uuid),this.lightMap&&this.lightMap.isTexture&&(t.lightMap=this.lightMap.toJSON(r).uuid,t.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(t.aoMap=this.aoMap.toJSON(r).uuid,t.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(t.bumpMap=this.bumpMap.toJSON(r).uuid,t.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(t.normalMap=this.normalMap.toJSON(r).uuid,t.normalMapType=this.normalMapType,t.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(t.displacementMap=this.displacementMap.toJSON(r).uuid,t.displacementScale=this.displacementScale,t.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(t.roughnessMap=this.roughnessMap.toJSON(r).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(t.metalnessMap=this.metalnessMap.toJSON(r).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(t.emissiveMap=this.emissiveMap.toJSON(r).uuid),this.specularMap&&this.specularMap.isTexture&&(t.specularMap=this.specularMap.toJSON(r).uuid),this.envMap&&this.envMap.isTexture&&(t.envMap=this.envMap.toJSON(r).uuid,this.combine!==void 0&&(t.combine=this.combine)),this.envMapIntensity!==void 0&&(t.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(t.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(t.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(t.gradientMap=this.gradientMap.toJSON(r).uuid),this.size!==void 0&&(t.size=this.size),this.shadowSide!==null&&(t.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(t.sizeAttenuation=this.sizeAttenuation),this.blending!==Br&&(t.blending=this.blending),this.side!==zo&&(t.side=this.side),this.vertexColors&&(t.vertexColors=!0),this.opacity<1&&(t.opacity=this.opacity),this.transparent===!0&&(t.transparent=this.transparent),t.depthFunc=this.depthFunc,t.depthTest=this.depthTest,t.depthWrite=this.depthWrite,t.colorWrite=this.colorWrite,t.stencilWrite=this.stencilWrite,t.stencilWriteMask=this.stencilWriteMask,t.stencilFunc=this.stencilFunc,t.stencilRef=this.stencilRef,t.stencilFuncMask=this.stencilFuncMask,t.stencilFail=this.stencilFail,t.stencilZFail=this.stencilZFail,t.stencilZPass=this.stencilZPass,this.rotation&&this.rotation!==0&&(t.rotation=this.rotation),this.polygonOffset===!0&&(t.polygonOffset=!0),this.polygonOffsetFactor!==0&&(t.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(t.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth&&this.linewidth!==1&&(t.linewidth=this.linewidth),this.dashSize!==void 0&&(t.dashSize=this.dashSize),this.gapSize!==void 0&&(t.gapSize=this.gapSize),this.scale!==void 0&&(t.scale=this.scale),this.dithering===!0&&(t.dithering=!0),this.alphaTest>0&&(t.alphaTest=this.alphaTest),this.alphaToCoverage===!0&&(t.alphaToCoverage=this.alphaToCoverage),this.premultipliedAlpha===!0&&(t.premultipliedAlpha=this.premultipliedAlpha),this.wireframe===!0&&(t.wireframe=this.wireframe),this.wireframeLinewidth>1&&(t.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(t.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(t.wireframeLinejoin=this.wireframeLinejoin),this.morphTargets===!0&&(t.morphTargets=!0),this.morphNormals===!0&&(t.morphNormals=!0),this.skinning===!0&&(t.skinning=!0),this.flatShading===!0&&(t.flatShading=this.flatShading),this.visible===!1&&(t.visible=!1),this.toneMapped===!1&&(t.toneMapped=!1),JSON.stringify(this.userData)!=="{}"&&(t.userData=this.userData);function n(i){let s=[];for(let o in i){let a=i[o];delete a.metadata,s.push(a)}return s}if(e){let i=n(r.textures),s=n(r.images);i.length>0&&(t.textures=i),s.length>0&&(t.images=s)}return t},clone:function(){return new this.constructor().copy(this)},copy:function(r){this.name=r.name,this.fog=r.fog,this.blending=r.blending,this.side=r.side,this.vertexColors=r.vertexColors,this.opacity=r.opacity,this.transparent=r.transparent,this.blendSrc=r.blendSrc,this.blendDst=r.blendDst,this.blendEquation=r.blendEquation,this.blendSrcAlpha=r.blendSrcAlpha,this.blendDstAlpha=r.blendDstAlpha,this.blendEquationAlpha=r.blendEquationAlpha,this.depthFunc=r.depthFunc,this.depthTest=r.depthTest,this.depthWrite=r.depthWrite,this.stencilWriteMask=r.stencilWriteMask,this.stencilFunc=r.stencilFunc,this.stencilRef=r.stencilRef,this.stencilFuncMask=r.stencilFuncMask,this.stencilFail=r.stencilFail,this.stencilZFail=r.stencilZFail,this.stencilZPass=r.stencilZPass,this.stencilWrite=r.stencilWrite;let e=r.clippingPlanes,t=null;if(e!==null){let n=e.length;t=new Array(n);for(let i=0;i!==n;++i)t[i]=e[i].clone()}return this.clippingPlanes=t,this.clipIntersection=r.clipIntersection,this.clipShadows=r.clipShadows,this.shadowSide=r.shadowSide,this.colorWrite=r.colorWrite,this.precision=r.precision,this.polygonOffset=r.polygonOffset,this.polygonOffsetFactor=r.polygonOffsetFactor,this.polygonOffsetUnits=r.polygonOffsetUnits,this.dithering=r.dithering,this.alphaTest=r.alphaTest,this.alphaToCoverage=r.alphaToCoverage,this.premultipliedAlpha=r.premultipliedAlpha,this.visible=r.visible,this.toneMapped=r.toneMapped,this.userData=JSON.parse(JSON.stringify(r.userData)),this},dispose:function(){this.dispatchEvent({type:"dispose"})}});Object.defineProperty(Mt.prototype,"needsUpdate",{set:function(r){r===!0&&this.version++}});var uh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},on={h:0,s:0,l:0},Ds={h:0,s:0,l:0};function Aa(r,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?r+(e-r)*6*t:t<1/2?e:t<2/3?r+(e-r)*6*(2/3-t):r}function La(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function Ra(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}var ge=class{constructor(e,t,n){return t===void 0&&n===void 0?this.set(e):this.setRGB(e,t,n)}set(e){return e&&e.isColor?this.copy(e):typeof e=="number"?this.setHex(e):typeof e=="string"&&this.setStyle(e),this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,this}setRGB(e,t,n){return this.r=e,this.g=t,this.b=n,this}setHSL(e,t,n){if(e=Hf(e,1),t=Ft(t,0,1),n=Ft(n,0,1),t===0)this.r=this.g=this.b=n;else{let i=n<=.5?n*(1+t):n+t-n*t,s=2*n-i;this.r=Aa(s,i,e+1/3),this.g=Aa(s,i,e),this.b=Aa(s,i,e-1/3)}return this}setStyle(e){function t(i){i!==void 0&&parseFloat(i)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let n;if(n=/^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(e)){let i,s=n[1],o=n[2];switch(s){case"rgb":case"rgba":if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(255,parseInt(i[1],10))/255,this.g=Math.min(255,parseInt(i[2],10))/255,this.b=Math.min(255,parseInt(i[3],10))/255,t(i[4]),this;if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(100,parseInt(i[1],10))/100,this.g=Math.min(100,parseInt(i[2],10))/100,this.b=Math.min(100,parseInt(i[3],10))/100,t(i[4]),this;break;case"hsl":case"hsla":if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)){let a=parseFloat(i[1])/360,l=parseInt(i[2],10)/100,c=parseInt(i[3],10)/100;return t(i[4]),this.setHSL(a,l,c)}break}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(e)){let i=n[1],s=i.length;if(s===3)return this.r=parseInt(i.charAt(0)+i.charAt(0),16)/255,this.g=parseInt(i.charAt(1)+i.charAt(1),16)/255,this.b=parseInt(i.charAt(2)+i.charAt(2),16)/255,this;if(s===6)return this.r=parseInt(i.charAt(0)+i.charAt(1),16)/255,this.g=parseInt(i.charAt(2)+i.charAt(3),16)/255,this.b=parseInt(i.charAt(4)+i.charAt(5),16)/255,this}return e&&e.length>0?this.setColorName(e):this}setColorName(e){let t=uh[e.toLowerCase()];return t!==void 0?this.setHex(t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copyGammaToLinear(e,t=2){return this.r=Math.pow(e.r,t),this.g=Math.pow(e.g,t),this.b=Math.pow(e.b,t),this}copyLinearToGamma(e,t=2){let n=t>0?1/t:1;return this.r=Math.pow(e.r,n),this.g=Math.pow(e.g,n),this.b=Math.pow(e.b,n),this}convertGammaToLinear(e){return this.copyGammaToLinear(this,e),this}convertLinearToGamma(e){return this.copyLinearToGamma(this,e),this}copySRGBToLinear(e){return this.r=La(e.r),this.g=La(e.g),this.b=La(e.b),this}copyLinearToSRGB(e){return this.r=Ra(e.r),this.g=Ra(e.g),this.b=Ra(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(){return this.r*255<<16^this.g*255<<8^this.b*255<<0}getHexString(){return("000000"+this.getHex().toString(16)).slice(-6)}getHSL(e){e===void 0&&(console.warn("THREE.Color: .getHSL() target is now required"),e={h:0,s:0,l:0});let t=this.r,n=this.g,i=this.b,s=Math.max(t,n,i),o=Math.min(t,n,i),a,l,c=(o+s)/2;if(o===s)a=0,l=0;else{let u=s-o;switch(l=c<=.5?u/(s+o):u/(2-s-o),s){case t:a=(n-i)/u+(n<i?6:0);break;case n:a=(i-t)/u+2;break;case i:a=(t-n)/u+4;break}a/=6}return e.h=a,e.s=l,e.l=c,e}getStyle(){return"rgb("+(this.r*255|0)+","+(this.g*255|0)+","+(this.b*255|0)+")"}offsetHSL(e,t,n){return this.getHSL(on),on.h+=e,on.s+=t,on.l+=n,this.setHSL(on.h,on.s,on.l),this}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(on),e.getHSL(Ds);let n=da(on.h,Ds.h,t),i=da(on.s,Ds.s,t),s=da(on.l,Ds.l,t);return this.setHSL(n,i,s),this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),e.normalized===!0&&(this.r/=255,this.g/=255,this.b/=255),this}toJSON(){return this.getHex()}};ge.NAMES=uh;ge.prototype.isColor=!0;ge.prototype.r=1;ge.prototype.g=1;ge.prototype.b=1;var Zr=class extends Mt{constructor(e){super(),this.type="MeshBasicMaterial",this.color=new ge(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Bo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this}};Zr.prototype.isMeshBasicMaterial=!0;var at=new M,Fs=new se,ct=class{constructor(e,t,n){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n===!0,this.usage=Yr,this.updateRange={offset:0,count:-1},this.version=0,this.onUploadCallback=function(){}}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}copyColorsArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyColorsArray(): color is undefined",i),o=new ge),t[n++]=o.r,t[n++]=o.g,t[n++]=o.b}return this}copyVector2sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector2sArray(): vector is undefined",i),o=new se),t[n++]=o.x,t[n++]=o.y}return this}copyVector3sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector3sArray(): vector is undefined",i),o=new M),t[n++]=o.x,t[n++]=o.y,t[n++]=o.z}return this}copyVector4sArray(e){let t=this.array,n=0;for(let i=0,s=e.length;i<s;i++){let o=e[i];o===void 0&&(console.warn("THREE.BufferAttribute.copyVector4sArray(): vector is undefined",i),o=new Je),t[n++]=o.x,t[n++]=o.y,t[n++]=o.z,t[n++]=o.w}return this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Fs.fromBufferAttribute(this,t),Fs.applyMatrix3(e),this.setXY(t,Fs.x,Fs.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)at.fromBufferAttribute(this,t),at.applyMatrix3(e),this.setXYZ(t,at.x,at.y,at.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)at.x=this.getX(t),at.y=this.getY(t),at.z=this.getZ(t),at.applyMatrix4(e),this.setXYZ(t,at.x,at.y,at.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)at.x=this.getX(t),at.y=this.getY(t),at.z=this.getZ(t),at.applyNormalMatrix(e),this.setXYZ(t,at.x,at.y,at.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)at.x=this.getX(t),at.y=this.getY(t),at.z=this.getZ(t),at.transformDirection(e),this.setXYZ(t,at.x,at.y,at.z);return this}set(e,t=0){return this.array.set(e,t),this}getX(e){return this.array[e*this.itemSize]}setX(e,t){return this.array[e*this.itemSize]=t,this}getY(e){return this.array[e*this.itemSize+1]}setY(e,t){return this.array[e*this.itemSize+1]=t,this}getZ(e){return this.array[e*this.itemSize+2]}setZ(e,t){return this.array[e*this.itemSize+2]=t,this}getW(e){return this.array[e*this.itemSize+3]}setW(e,t){return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.prototype.slice.call(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Yr&&(e.usage=this.usage),(this.updateRange.offset!==0||this.updateRange.count!==-1)&&(e.updateRange=this.updateRange),e}};ct.prototype.isBufferAttribute=!0;var uo=class extends ct{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var ho=class extends ct{constructor(e,t,n){super(new Uint32Array(e),t,n)}},Za=class extends ct{constructor(e,t,n){super(new Uint16Array(e),t,n)}};Za.prototype.isFloat16BufferAttribute=!0;var Ke=class extends ct{constructor(e,t,n){super(new Float32Array(e),t,n)}};function hh(r){if(r.length===0)return-1/0;let e=r[0];for(let t=1,n=r.length;t<n;++t)r[t]>e&&(e=r[t]);return e}var tp=0,xn=new Ie,Ca=new nt,Ii=new M,Yt=new Ot,Er=new Ot,bt=new M,$e=class r extends Fn{constructor(){super(),Object.defineProperty(this,"id",{value:tp++}),this.uuid=hn(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(hh(e)>65535?ho:uo)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new _t().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}rotateX(e){return xn.makeRotationX(e),this.applyMatrix4(xn),this}rotateY(e){return xn.makeRotationY(e),this.applyMatrix4(xn),this}rotateZ(e){return xn.makeRotationZ(e),this.applyMatrix4(xn),this}translate(e,t,n){return xn.makeTranslation(e,t,n),this.applyMatrix4(xn),this}scale(e,t,n){return xn.makeScale(e,t,n),this.applyMatrix4(xn),this}lookAt(e){return Ca.lookAt(e),Ca.updateMatrix(),this.applyMatrix4(Ca.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ii).negate(),this.translate(Ii.x,Ii.y,Ii.z),this}setFromPoints(e){let t=[];for(let n=0,i=e.length;n<i;n++){let s=e[n];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new Ke(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ot);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new M(-1/0,-1/0,-1/0),new M(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let s=t[n];Yt.setFromBufferAttribute(s),this.morphTargetsRelative?(bt.addVectors(this.boundingBox.min,Yt.min),this.boundingBox.expandByPoint(bt),bt.addVectors(this.boundingBox.max,Yt.max),this.boundingBox.expandByPoint(bt)):(this.boundingBox.expandByPoint(Yt.min),this.boundingBox.expandByPoint(Yt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ti);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new M,1/0);return}if(e){let n=this.boundingSphere.center;if(Yt.setFromBufferAttribute(e),t)for(let s=0,o=t.length;s<o;s++){let a=t[s];Er.setFromBufferAttribute(a),this.morphTargetsRelative?(bt.addVectors(Yt.min,Er.min),Yt.expandByPoint(bt),bt.addVectors(Yt.max,Er.max),Yt.expandByPoint(bt)):(Yt.expandByPoint(Er.min),Yt.expandByPoint(Er.max))}Yt.getCenter(n);let i=0;for(let s=0,o=e.count;s<o;s++)bt.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(bt));if(t)for(let s=0,o=t.length;s<o;s++){let a=t[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)bt.fromBufferAttribute(a,c),l&&(Ii.fromBufferAttribute(e,c),bt.add(Ii)),i=Math.max(i,n.distanceToSquared(bt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeFaceNormals(){}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.array,i=t.position.array,s=t.normal.array,o=t.uv.array,a=i.length/3;t.tangent===void 0&&this.setAttribute("tangent",new ct(new Float32Array(4*a),4));let l=t.tangent.array,c=[],u=[];for(let H=0;H<a;H++)c[H]=new M,u[H]=new M;let h=new M,d=new M,f=new M,g=new se,x=new se,y=new se,m=new M,p=new M;function R(H,K,q){h.fromArray(i,H*3),d.fromArray(i,K*3),f.fromArray(i,q*3),g.fromArray(o,H*2),x.fromArray(o,K*2),y.fromArray(o,q*2),d.sub(h),f.sub(h),x.sub(g),y.sub(g);let D=1/(x.x*y.y-y.x*x.y);isFinite(D)&&(m.copy(d).multiplyScalar(y.y).addScaledVector(f,-x.y).multiplyScalar(D),p.copy(f).multiplyScalar(x.x).addScaledVector(d,-y.x).multiplyScalar(D),c[H].add(m),c[K].add(m),c[q].add(m),u[H].add(p),u[K].add(p),u[q].add(p))}let A=this.groups;A.length===0&&(A=[{start:0,count:n.length}]);for(let H=0,K=A.length;H<K;++H){let q=A[H],D=q.start,z=q.count;for(let N=D,P=D+z;N<P;N+=3)R(n[N+0],n[N+1],n[N+2])}let C=new M,w=new M,F=new M,B=new M;function O(H){F.fromArray(s,H*3),B.copy(F);let K=c[H];C.copy(K),C.sub(F.multiplyScalar(F.dot(K))).normalize(),w.crossVectors(B,K);let D=w.dot(u[H])<0?-1:1;l[H*4]=C.x,l[H*4+1]=C.y,l[H*4+2]=C.z,l[H*4+3]=D}for(let H=0,K=A.length;H<K;++H){let q=A[H],D=q.start,z=q.count;for(let N=D,P=D+z;N<P;N+=3)O(n[N+0]),O(n[N+1]),O(n[N+2])}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new ct(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let i=new M,s=new M,o=new M,a=new M,l=new M,c=new M,u=new M,h=new M;if(e)for(let d=0,f=e.count;d<f;d+=3){let g=e.getX(d+0),x=e.getX(d+1),y=e.getX(d+2);i.fromBufferAttribute(t,g),s.fromBufferAttribute(t,x),o.fromBufferAttribute(t,y),u.subVectors(o,s),h.subVectors(i,s),u.cross(h),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,y),a.add(u),l.add(u),c.add(u),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(y,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)i.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),u.subVectors(o,s),h.subVectors(i,s),u.cross(h),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}merge(e,t){if(!(e&&e.isBufferGeometry)){console.error("THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.",e);return}t===void 0&&(t=0,console.warn("THREE.BufferGeometry.merge(): Overwriting original geometry, starting at offset=0. Use BufferGeometryUtils.mergeBufferGeometries() for lossless merge."));let n=this.attributes;for(let i in n){if(e.attributes[i]===void 0)continue;let o=n[i].array,a=e.attributes[i],l=a.array,c=a.itemSize*t,u=Math.min(l.length,o.length-c);for(let h=0,d=c;h<u;h++,d++)o[d]=l[h]}return this}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)bt.fromBufferAttribute(e,t),bt.normalize(),e.setXYZ(t,bt.x,bt.y,bt.z)}toNonIndexed(){function e(a,l){let c=a.array,u=a.itemSize,h=a.normalized,d=new c.constructor(l.length*u),f=0,g=0;for(let x=0,y=l.length;x<y;x++){f=l[x]*u;for(let m=0;m<u;m++)d[g++]=c[f++]}return new ct(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new r,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],c=e(l,n);t.setAttribute(a,c)}let s=this.morphAttributes;for(let a in s){let l=[],c=s[a];for(let u=0,h=c.length;u<h;u++){let d=c[u],f=e(d,n);l.push(f)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.5,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){let f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(i[l]=u,s=!0)}s&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new r().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let i=e.attributes;for(let c in i){let u=i[c];this.setAttribute(c,u.clone(t))}let s=e.morphAttributes;for(let c in s){let u=[],h=s[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,u=o.length;c<u;c++){let h=o[c];this.addGroup(h.start,h.count,h.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}};$e.prototype.isBufferGeometry=!0;var pu=new Ie,zi=new ni,Pa=new ti,Yn=new M,Zn=new M,Jn=new M,Da=new M,Fa=new M,Ia=new M,Is=new M,zs=new M,Bs=new M,Ns=new se,Us=new se,Os=new se,za=new M,ks=new M,Xe=class extends nt{constructor(e=new $e,t=new Zr){super(),this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Mesh.updateMorphTargets() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}}raycast(e,t){let n=this.geometry,i=this.material,s=this.matrixWorld;if(i===void 0||(n.boundingSphere===null&&n.computeBoundingSphere(),Pa.copy(n.boundingSphere),Pa.applyMatrix4(s),e.ray.intersectsSphere(Pa)===!1)||(pu.copy(s).invert(),zi.copy(e.ray).applyMatrix4(pu),n.boundingBox!==null&&zi.intersectsBox(n.boundingBox)===!1))return;let o;if(n.isBufferGeometry){let a=n.index,l=n.attributes.position,c=n.morphAttributes.position,u=n.morphTargetsRelative,h=n.attributes.uv,d=n.attributes.uv2,f=n.groups,g=n.drawRange;if(a!==null)if(Array.isArray(i))for(let x=0,y=f.length;x<y;x++){let m=f[x],p=i[m.materialIndex],R=Math.max(m.start,g.start),A=Math.min(m.start+m.count,g.start+g.count);for(let C=R,w=A;C<w;C+=3){let F=a.getX(C),B=a.getX(C+1),O=a.getX(C+2);o=Hs(this,p,e,zi,l,c,u,h,d,F,B,O),o&&(o.faceIndex=Math.floor(C/3),o.face.materialIndex=m.materialIndex,t.push(o))}}else{let x=Math.max(0,g.start),y=Math.min(a.count,g.start+g.count);for(let m=x,p=y;m<p;m+=3){let R=a.getX(m),A=a.getX(m+1),C=a.getX(m+2);o=Hs(this,i,e,zi,l,c,u,h,d,R,A,C),o&&(o.faceIndex=Math.floor(m/3),t.push(o))}}else if(l!==void 0)if(Array.isArray(i))for(let x=0,y=f.length;x<y;x++){let m=f[x],p=i[m.materialIndex],R=Math.max(m.start,g.start),A=Math.min(m.start+m.count,g.start+g.count);for(let C=R,w=A;C<w;C+=3){let F=C,B=C+1,O=C+2;o=Hs(this,p,e,zi,l,c,u,h,d,F,B,O),o&&(o.faceIndex=Math.floor(C/3),o.face.materialIndex=m.materialIndex,t.push(o))}}else{let x=Math.max(0,g.start),y=Math.min(l.count,g.start+g.count);for(let m=x,p=y;m<p;m+=3){let R=m,A=m+1,C=m+2;o=Hs(this,i,e,zi,l,c,u,h,d,R,A,C),o&&(o.faceIndex=Math.floor(m/3),t.push(o))}}}else n.isGeometry&&console.error("THREE.Mesh.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}};Xe.prototype.isMesh=!0;function np(r,e,t,n,i,s,o,a){let l;if(e.side===yt?l=n.intersectTriangle(o,s,i,!0,a):l=n.intersectTriangle(i,s,o,e.side!==Ht,a),l===null)return null;ks.copy(a),ks.applyMatrix4(r.matrixWorld);let c=t.ray.origin.distanceTo(ks);return c<t.near||c>t.far?null:{distance:c,point:ks.clone(),object:r}}function Hs(r,e,t,n,i,s,o,a,l,c,u,h){Yn.fromBufferAttribute(i,c),Zn.fromBufferAttribute(i,u),Jn.fromBufferAttribute(i,h);let d=r.morphTargetInfluences;if(e.morphTargets&&s&&d){Is.set(0,0,0),zs.set(0,0,0),Bs.set(0,0,0);for(let g=0,x=s.length;g<x;g++){let y=d[g],m=s[g];y!==0&&(Da.fromBufferAttribute(m,c),Fa.fromBufferAttribute(m,u),Ia.fromBufferAttribute(m,h),o?(Is.addScaledVector(Da,y),zs.addScaledVector(Fa,y),Bs.addScaledVector(Ia,y)):(Is.addScaledVector(Da.sub(Yn),y),zs.addScaledVector(Fa.sub(Zn),y),Bs.addScaledVector(Ia.sub(Jn),y)))}Yn.add(Is),Zn.add(zs),Jn.add(Bs)}r.isSkinnedMesh&&e.skinning&&(r.boneTransform(c,Yn),r.boneTransform(u,Zn),r.boneTransform(h,Jn));let f=np(r,e,t,n,Yn,Zn,Jn,za);if(f){a&&(Ns.fromBufferAttribute(a,c),Us.fromBufferAttribute(a,u),Os.fromBufferAttribute(a,h),f.uv=Ct.getUV(za,Yn,Zn,Jn,Ns,Us,Os,new se)),l&&(Ns.fromBufferAttribute(l,c),Us.fromBufferAttribute(l,u),Os.fromBufferAttribute(l,h),f.uv2=Ct.getUV(za,Yn,Zn,Jn,Ns,Us,Os,new se));let g={a:c,b:u,c:h,normal:new M,materialIndex:0};Ct.getNormal(Yn,Zn,Jn,g.normal),f.face=g}return f}var Jr=class extends $e{constructor(e=1,t=1,n=1,i=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:o};let a=this;i=Math.floor(i),s=Math.floor(s),o=Math.floor(o);let l=[],c=[],u=[],h=[],d=0,f=0;g("z","y","x",-1,-1,n,t,e,o,s,0),g("z","y","x",1,-1,n,t,-e,o,s,1),g("x","z","y",1,1,e,n,t,i,o,2),g("x","z","y",1,-1,e,n,-t,i,o,3),g("x","y","z",1,-1,e,t,n,i,s,4),g("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new Ke(c,3)),this.setAttribute("normal",new Ke(u,3)),this.setAttribute("uv",new Ke(h,2));function g(x,y,m,p,R,A,C,w,F,B,O){let H=A/F,K=C/B,q=A/2,D=C/2,z=w/2,N=F+1,P=B+1,te=0,ce=0,oe=new M;for(let we=0;we<P;we++){let pe=we*K-D;for(let Ce=0;Ce<N;Ce++){let Fe=Ce*H-q;oe[x]=Fe*p,oe[y]=pe*R,oe[m]=z,c.push(oe.x,oe.y,oe.z),oe[x]=0,oe[y]=0,oe[m]=w>0?1:-1,u.push(oe.x,oe.y,oe.z),h.push(Ce/F),h.push(1-we/B),te+=1}}for(let we=0;we<B;we++)for(let pe=0;pe<F;pe++){let Ce=d+pe+N*we,Fe=d+pe+N*(we+1),ee=d+(pe+1)+N*(we+1),$=d+(pe+1)+N*we;l.push(Ce,Fe,$),l.push(Fe,ee,$),ce+=6}a.addGroup(f,ce,O),f+=ce,d+=te}}};function Ji(r){let e={};for(let t in r){e[t]={};for(let n in r[t]){let i=r[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function Lt(r){let e={};for(let t=0;t<r.length;t++){let n=Ji(r[t]);for(let i in n)e[i]=n[i]}return e}var ip={clone:Ji,merge:Lt},rp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,sp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,tt=class extends Mt{constructor(e){super(),this.type="ShaderMaterial",this.defines={},this.uniforms={},this.vertexShader=rp,this.fragmentShader=sp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv2:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&(e.attributes!==void 0&&console.error("THREE.ShaderMaterial: attributes should now be defined in THREE.BufferGeometry instead."),this.setValues(e))}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ji(e.uniforms),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.lights=e.lights,this.clipping=e.clipping,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}};tt.prototype.isShaderMaterial=!0;var jr=class extends nt{constructor(){super(),this.type="Camera",this.matrixWorldInverse=new Ie,this.projectionMatrix=new Ie,this.projectionMatrixInverse=new Ie}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this}getWorldDirection(e){e===void 0&&(console.warn("THREE.Camera: .getWorldDirection() target is now required"),e=new M),this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(-t[8],-t[9],-t[10]).normalize()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}};jr.prototype.isCamera=!0;var Tt=class extends jr{constructor(e=50,t=1,n=.1,i=2e3){super(),this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=qa*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(ha*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return qa*2*Math.atan(Math.tan(ha*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,i,s,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(ha*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*i/l,t-=o.offsetY*n/c,i*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(s+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};Tt.prototype.isPerspectiveCamera=!0;var Bi=90,Ni=1,$r=class extends nt{constructor(e,t,n){if(super(),this.type="CubeCamera",n.isWebGLCubeRenderTarget!==!0){console.error("THREE.CubeCamera: The constructor now expects an instance of WebGLCubeRenderTarget as third parameter.");return}this.renderTarget=n;let i=new Tt(Bi,Ni,e,t);i.layers=this.layers,i.up.set(0,-1,0),i.lookAt(new M(1,0,0)),this.add(i);let s=new Tt(Bi,Ni,e,t);s.layers=this.layers,s.up.set(0,-1,0),s.lookAt(new M(-1,0,0)),this.add(s);let o=new Tt(Bi,Ni,e,t);o.layers=this.layers,o.up.set(0,0,1),o.lookAt(new M(0,1,0)),this.add(o);let a=new Tt(Bi,Ni,e,t);a.layers=this.layers,a.up.set(0,0,-1),a.lookAt(new M(0,-1,0)),this.add(a);let l=new Tt(Bi,Ni,e,t);l.layers=this.layers,l.up.set(0,-1,0),l.lookAt(new M(0,0,1)),this.add(l);let c=new Tt(Bi,Ni,e,t);c.layers=this.layers,c.up.set(0,-1,0),c.lookAt(new M(0,0,-1)),this.add(c)}update(e,t){this.parent===null&&this.updateMatrixWorld();let n=this.renderTarget,[i,s,o,a,l,c]=this.children,u=e.xr.enabled,h=e.getRenderTarget();e.xr.enabled=!1;let d=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0),e.render(t,i),e.setRenderTarget(n,1),e.render(t,s),e.setRenderTarget(n,2),e.render(t,o),e.setRenderTarget(n,3),e.render(t,a),e.setRenderTarget(n,4),e.render(t,l),n.texture.generateMipmaps=d,e.setRenderTarget(n,5),e.render(t,c),e.setRenderTarget(h),e.xr.enabled=u}},ji=class extends Pt{constructor(e,t,n,i,s,o,a,l,c,u){e=e!==void 0?e:[],t=t!==void 0?t:ic,a=a!==void 0?a:Pn,super(e,t,n,i,s,o,a,l,c,u),this._needsFlipEnvMap=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};ji.prototype.isCubeTexture=!0;var fo=class extends dn{constructor(e,t,n){Number.isInteger(t)&&(console.warn("THREE.WebGLCubeRenderTarget: constructor signature is now WebGLCubeRenderTarget( size, options )"),t=n),super(e,e,t),t=t||{},this.texture=new ji(void 0,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.encoding),this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Rt,this.texture._needsFlipEnvMap=!1}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.format=un,this.texture.encoding=t.encoding,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Jr(5,5,5),s=new tt({name:"CubemapFromEquirect",uniforms:Ji(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:yt,blending:zr});s.uniforms.tEquirect.value=t;let o=new Xe(i,s),a=t.minFilter;return t.minFilter===wi&&(t.minFilter=Rt),new $r(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,n,i){let s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(s)}};fo.prototype.isWebGLCubeRenderTarget=!0;var $i=class extends Pt{constructor(e,t,n,i,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,i,s,h,d),this.image={data:e||null,width:t||1,height:n||1},this.magFilter=c!==void 0?c:It,this.minFilter=u!==void 0?u:It,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};$i.prototype.isDataTexture=!0;var Ui=new ti,Gs=new M,Ki=class{constructor(e=new $t,t=new $t,n=new $t,i=new $t,s=new $t,o=new $t){this.planes=[e,t,n,i,s,o]}set(e,t,n,i,s,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(s),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e){let t=this.planes,n=e.elements,i=n[0],s=n[1],o=n[2],a=n[3],l=n[4],c=n[5],u=n[6],h=n[7],d=n[8],f=n[9],g=n[10],x=n[11],y=n[12],m=n[13],p=n[14],R=n[15];return t[0].setComponents(a-i,h-l,x-d,R-y).normalize(),t[1].setComponents(a+i,h+l,x+d,R+y).normalize(),t[2].setComponents(a+s,h+c,x+f,R+m).normalize(),t[3].setComponents(a-s,h-c,x-f,R-m).normalize(),t[4].setComponents(a-o,h-u,x-g,R-p).normalize(),t[5].setComponents(a+o,h+u,x+g,R+p).normalize(),this}intersectsObject(e){let t=e.geometry;return t.boundingSphere===null&&t.computeBoundingSphere(),Ui.copy(t.boundingSphere).applyMatrix4(e.matrixWorld),this.intersectsSphere(Ui)}intersectsSprite(e){return Ui.center.set(0,0,0),Ui.radius=.7071067811865476,Ui.applyMatrix4(e.matrixWorld),this.intersectsSphere(Ui)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Gs.x=i.normal.x>0?e.max.x:e.min.x,Gs.y=i.normal.y>0?e.max.y:e.min.y,Gs.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Gs)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function dh(){let r=null,e=!1,t=null,n=null;function i(s,o){t(s,o),n=r.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=r.requestAnimationFrame(i),e=!0)},stop:function(){r.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){r=s}}}function op(r,e){let t=e.isWebGL2,n=new WeakMap;function i(c,u){let h=c.array,d=c.usage,f=r.createBuffer();r.bindBuffer(u,f),r.bufferData(u,h,d),c.onUploadCallback();let g=5126;return h instanceof Float32Array?g=5126:h instanceof Float64Array?console.warn("THREE.WebGLAttributes: Unsupported data buffer format: Float64Array."):h instanceof Uint16Array?c.isFloat16BufferAttribute?t?g=5131:console.warn("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2."):g=5123:h instanceof Int16Array?g=5122:h instanceof Uint32Array?g=5125:h instanceof Int32Array?g=5124:h instanceof Int8Array?g=5120:h instanceof Uint8Array&&(g=5121),{buffer:f,type:g,bytesPerElement:h.BYTES_PER_ELEMENT,version:c.version}}function s(c,u,h){let d=u.array,f=u.updateRange;r.bindBuffer(h,c),f.count===-1?r.bufferSubData(h,0,d):(t?r.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d,f.offset,f.count):r.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d.subarray(f.offset,f.offset+f.count)),f.count=-1)}function o(c){return c.isInterleavedBufferAttribute&&(c=c.data),n.get(c)}function a(c){c.isInterleavedBufferAttribute&&(c=c.data);let u=n.get(c);u&&(r.deleteBuffer(u.buffer),n.delete(c))}function l(c,u){if(c.isGLBufferAttribute){let d=n.get(c);(!d||d.version<c.version)&&n.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);let h=n.get(c);h===void 0?n.set(c,i(c,u)):h.version<c.version&&(s(h.buffer,c,u),h.version=c.version)}return{get:o,remove:a,update:l}}var zt=class extends $e{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let s=e/2,o=t/2,a=Math.floor(n),l=Math.floor(i),c=a+1,u=l+1,h=e/a,d=t/l,f=[],g=[],x=[],y=[];for(let m=0;m<u;m++){let p=m*d-o;for(let R=0;R<c;R++){let A=R*h-s;g.push(A,-p,0),x.push(0,0,1),y.push(R/a),y.push(1-m/l)}}for(let m=0;m<l;m++)for(let p=0;p<a;p++){let R=p+c*m,A=p+c*(m+1),C=p+1+c*(m+1),w=p+1+c*m;f.push(R,A,w),f.push(A,C,w)}this.setIndex(f),this.setAttribute("position",new Ke(g,3)),this.setAttribute("normal",new Ke(x,3)),this.setAttribute("uv",new Ke(y,2))}},ap=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vUv ).g;
#endif`,lp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,cp=`#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif`,up=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );
	#endif
#endif`,hp=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,dp="vec3 transformed = vec3( position );",fp=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,pp=`vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {
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
#endif`,mp=`#ifdef USE_BUMPMAP
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
#endif`,gp=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,vp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,xp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,yp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,_p=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,wp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,bp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Mp=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,Sp=`#define PI 3.141592653589793
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
}`,Tp=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Ep=`vec3 transformedNormal = objectNormal;
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
#endif`,Ap=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Lp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
#endif`,Rp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vUv );
	emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Cp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Pp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Dp=`
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
}`,Fp=`#ifdef USE_ENVMAP
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
#endif`,Ip=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform int maxMipLevel;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,zp=`#ifdef USE_ENVMAP
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
#endif`,Bp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Np=`#ifdef USE_ENVMAP
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
#endif`,Up=`#ifdef USE_FOG
	fogDepth = - mvPosition.z;
#endif`,Op=`#ifdef USE_FOG
	varying float fogDepth;
#endif`,kp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Hp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float fogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Gp=`#ifdef USE_GRADIENTMAP
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
}`,Vp=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel= texture2D( lightMap, vUv2 );
	reflectedLight.indirectDiffuse += PI * lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
#endif`,Wp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,qp=`vec3 diffuse = vec3( 1.0 );
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
#endif`,Xp=`uniform bool receiveShadow;
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
#endif`,Yp=`#if defined( USE_ENVMAP )
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
#endif`,Zp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Jp=`varying vec3 vViewPosition;
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
#define Material_LightProbeLOD( material )	(0)`,jp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,$p=`varying vec3 vViewPosition;
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
#define Material_LightProbeLOD( material )	(0)`,Kp=`PhysicalMaterial material;
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
#endif`,Qp=`struct PhysicalMaterial {
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
}`,em=`
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
#endif`,tm=`#if defined( RE_IndirectDiffuse )
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
#endif`,nm=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
#endif`,im=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,rm=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,sm=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,om=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,am=`#ifdef USE_MAP
	vec4 texelColor = texture2D( map, vUv );
	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;
#endif`,lm=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,cm=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
#endif
#ifdef USE_MAP
	vec4 mapTexel = texture2D( map, uv );
	diffuseColor *= mapTexelToLinear( mapTexel );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,um=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	uniform mat3 uvTransform;
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,hm=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vUv );
	metalnessFactor *= texelMetalness.b;
#endif`,dm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,fm=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
	objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
	objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
	objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
#endif`,pm=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifndef USE_MORPHNORMALS
		uniform float morphTargetInfluences[ 8 ];
	#else
		uniform float morphTargetInfluences[ 4 ];
	#endif
#endif`,mm=`#ifdef USE_MORPHTARGETS
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
#endif`,gm=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 geometryNormal = normal;`,vm=`#ifdef OBJECTSPACE_NORMALMAP
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
#endif`,xm=`#ifdef USE_NORMALMAP
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
#endif`,ym=`#ifdef CLEARCOAT
	vec3 clearcoatNormal = geometryNormal;
#endif`,_m=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	#ifdef USE_TANGENT
		clearcoatNormal = normalize( vTBN * clearcoatMapN );
	#else
		clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );
	#endif
#endif`,wm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif`,bm=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Mm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Sm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Tm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Em=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Am=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Lm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Rm=`#ifdef USE_SHADOWMAP
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
#endif`,Cm=`#ifdef USE_SHADOWMAP
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
#endif`,Pm=`#ifdef USE_SHADOWMAP
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
#endif`,Dm=`float getShadowMask() {
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
}`,Fm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Im=`#ifdef USE_SKINNING
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
#endif`,zm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Bm=`#ifdef USE_SKINNING
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
#endif`,Nm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Um=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Om=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,km=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Hm=`#ifdef USE_TRANSMISSIONMAP
	totalTransmission *= texture2D( transmissionMap, vUv ).r;
#endif`,Gm=`#ifdef USE_TRANSMISSIONMAP
	uniform sampler2D transmissionMap;
#endif`,Vm=`#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif`,Wm=`#ifdef USE_UV
	#ifdef UVS_VERTEX_ONLY
		vec2 vUv;
	#else
		varying vec2 vUv;
	#endif
	uniform mat3 uvTransform;
#endif`,qm=`#ifdef USE_UV
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
#endif`,Xm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	varying vec2 vUv2;
#endif`,Ym=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	attribute vec2 uv2;
	varying vec2 vUv2;
	uniform mat3 uv2Transform;
#endif`,Zm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
#endif`,Jm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,jm=`uniform sampler2D t2D;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,$m=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Km=`#include <envmap_common_pars_fragment>
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
}`,Qm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,eg=`#if DEPTH_PACKING == 3200
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
}`,tg=`#include <common>
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
}`,ng=`#define DISTANCE
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
}`,ig=`#define DISTANCE
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
}`,rg=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	vec4 texColor = texture2D( tEquirect, sampleUV );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,sg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,og=`uniform vec3 diffuse;
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
}`,ag=`uniform float scale;
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
}`,lg=`uniform vec3 diffuse;
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
}`,cg=`#include <common>
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
}`,ug=`uniform vec3 diffuse;
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
}`,hg=`#define LAMBERT
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
}`,dg=`#define MATCAP
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
}`,fg=`#define MATCAP
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
}`,pg=`#define TOON
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
}`,mg=`#define TOON
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
}`,gg=`#define PHONG
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
}`,vg=`#define PHONG
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
}`,xg=`#define STANDARD
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
}`,yg=`#define STANDARD
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
}`,_g=`#define NORMAL
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
}`,wg=`#define NORMAL
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
}`,bg=`uniform vec3 diffuse;
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
}`,Mg=`uniform float size;
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
}`,Sg=`uniform vec3 color;
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
}`,Tg=`#include <common>
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
}`,Eg=`uniform vec3 diffuse;
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
}`,Ag=`uniform float rotation;
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
}`,qe={alphamap_fragment:ap,alphamap_pars_fragment:lp,alphatest_fragment:cp,aomap_fragment:up,aomap_pars_fragment:hp,begin_vertex:dp,beginnormal_vertex:fp,bsdfs:pp,bumpmap_pars_fragment:mp,clipping_planes_fragment:gp,clipping_planes_pars_fragment:vp,clipping_planes_pars_vertex:xp,clipping_planes_vertex:yp,color_fragment:_p,color_pars_fragment:wp,color_pars_vertex:bp,color_vertex:Mp,common:Sp,cube_uv_reflection_fragment:Tp,defaultnormal_vertex:Ep,displacementmap_pars_vertex:Ap,displacementmap_vertex:Lp,emissivemap_fragment:Rp,emissivemap_pars_fragment:Cp,encodings_fragment:Pp,encodings_pars_fragment:Dp,envmap_fragment:Fp,envmap_common_pars_fragment:Ip,envmap_pars_fragment:zp,envmap_pars_vertex:Bp,envmap_physical_pars_fragment:Yp,envmap_vertex:Np,fog_vertex:Up,fog_pars_vertex:Op,fog_fragment:kp,fog_pars_fragment:Hp,gradientmap_pars_fragment:Gp,lightmap_fragment:Vp,lightmap_pars_fragment:Wp,lights_lambert_vertex:qp,lights_pars_begin:Xp,lights_toon_fragment:Zp,lights_toon_pars_fragment:Jp,lights_phong_fragment:jp,lights_phong_pars_fragment:$p,lights_physical_fragment:Kp,lights_physical_pars_fragment:Qp,lights_fragment_begin:em,lights_fragment_maps:tm,lights_fragment_end:nm,logdepthbuf_fragment:im,logdepthbuf_pars_fragment:rm,logdepthbuf_pars_vertex:sm,logdepthbuf_vertex:om,map_fragment:am,map_pars_fragment:lm,map_particle_fragment:cm,map_particle_pars_fragment:um,metalnessmap_fragment:hm,metalnessmap_pars_fragment:dm,morphnormal_vertex:fm,morphtarget_pars_vertex:pm,morphtarget_vertex:mm,normal_fragment_begin:gm,normal_fragment_maps:vm,normalmap_pars_fragment:xm,clearcoat_normal_fragment_begin:ym,clearcoat_normal_fragment_maps:_m,clearcoat_pars_fragment:wm,packing:bm,premultiplied_alpha_fragment:Mm,project_vertex:Sm,dithering_fragment:Tm,dithering_pars_fragment:Em,roughnessmap_fragment:Am,roughnessmap_pars_fragment:Lm,shadowmap_pars_fragment:Rm,shadowmap_pars_vertex:Cm,shadowmap_vertex:Pm,shadowmask_pars_fragment:Dm,skinbase_vertex:Fm,skinning_pars_vertex:Im,skinning_vertex:zm,skinnormal_vertex:Bm,specularmap_fragment:Nm,specularmap_pars_fragment:Um,tonemapping_fragment:Om,tonemapping_pars_fragment:km,transmissionmap_fragment:Hm,transmissionmap_pars_fragment:Gm,uv_pars_fragment:Vm,uv_pars_vertex:Wm,uv_vertex:qm,uv2_pars_fragment:Xm,uv2_pars_vertex:Ym,uv2_vertex:Zm,worldpos_vertex:Jm,background_frag:jm,background_vert:$m,cube_frag:Km,cube_vert:Qm,depth_frag:eg,depth_vert:tg,distanceRGBA_frag:ng,distanceRGBA_vert:ig,equirect_frag:rg,equirect_vert:sg,linedashed_frag:og,linedashed_vert:ag,meshbasic_frag:lg,meshbasic_vert:cg,meshlambert_frag:ug,meshlambert_vert:hg,meshmatcap_frag:dg,meshmatcap_vert:fg,meshtoon_frag:pg,meshtoon_vert:mg,meshphong_frag:gg,meshphong_vert:vg,meshphysical_frag:xg,meshphysical_vert:yg,normal_frag:_g,normal_vert:wg,points_frag:bg,points_vert:Mg,shadow_frag:Sg,shadow_vert:Tg,sprite_frag:Eg,sprite_vert:Ag},_e={common:{diffuse:{value:new ge(15658734)},opacity:{value:1},map:{value:null},uvTransform:{value:new _t},uv2Transform:{value:new _t},alphaMap:{value:null}},specularmap:{specularMap:{value:null}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},refractionRatio:{value:.98},maxMipLevel:{value:0}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1}},emissivemap:{emissiveMap:{value:null}},bumpmap:{bumpMap:{value:null},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalScale:{value:new se(1,1)}},displacementmap:{displacementMap:{value:null},displacementScale:{value:1},displacementBias:{value:0}},roughnessmap:{roughnessMap:{value:null}},metalnessmap:{metalnessMap:{value:null}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ge(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotShadowMap:{value:[]},spotShadowMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ge(15658734)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},uvTransform:{value:new _t}},sprite:{diffuse:{value:new ge(15658734)},opacity:{value:1},center:{value:new se(.5,.5)},rotation:{value:0},map:{value:null},alphaMap:{value:null},uvTransform:{value:new _t}}},yn={basic:{uniforms:Lt([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.fog]),vertexShader:qe.meshbasic_vert,fragmentShader:qe.meshbasic_frag},lambert:{uniforms:Lt([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.fog,_e.lights,{emissive:{value:new ge(0)}}]),vertexShader:qe.meshlambert_vert,fragmentShader:qe.meshlambert_frag},phong:{uniforms:Lt([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,_e.lights,{emissive:{value:new ge(0)},specular:{value:new ge(1118481)},shininess:{value:30}}]),vertexShader:qe.meshphong_vert,fragmentShader:qe.meshphong_frag},standard:{uniforms:Lt([_e.common,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.roughnessmap,_e.metalnessmap,_e.fog,_e.lights,{emissive:{value:new ge(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag},toon:{uniforms:Lt([_e.common,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.gradientmap,_e.fog,_e.lights,{emissive:{value:new ge(0)}}]),vertexShader:qe.meshtoon_vert,fragmentShader:qe.meshtoon_frag},matcap:{uniforms:Lt([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,{matcap:{value:null}}]),vertexShader:qe.meshmatcap_vert,fragmentShader:qe.meshmatcap_frag},points:{uniforms:Lt([_e.points,_e.fog]),vertexShader:qe.points_vert,fragmentShader:qe.points_frag},dashed:{uniforms:Lt([_e.common,_e.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:qe.linedashed_vert,fragmentShader:qe.linedashed_frag},depth:{uniforms:Lt([_e.common,_e.displacementmap]),vertexShader:qe.depth_vert,fragmentShader:qe.depth_frag},normal:{uniforms:Lt([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,{opacity:{value:1}}]),vertexShader:qe.normal_vert,fragmentShader:qe.normal_frag},sprite:{uniforms:Lt([_e.sprite,_e.fog]),vertexShader:qe.sprite_vert,fragmentShader:qe.sprite_frag},background:{uniforms:{uvTransform:{value:new _t},t2D:{value:null}},vertexShader:qe.background_vert,fragmentShader:qe.background_frag},cube:{uniforms:Lt([_e.envmap,{opacity:{value:1}}]),vertexShader:qe.cube_vert,fragmentShader:qe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:qe.equirect_vert,fragmentShader:qe.equirect_frag},distanceRGBA:{uniforms:Lt([_e.common,_e.displacementmap,{referencePosition:{value:new M},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:qe.distanceRGBA_vert,fragmentShader:qe.distanceRGBA_frag},shadow:{uniforms:Lt([_e.lights,_e.fog,{color:{value:new ge(0)},opacity:{value:1}}]),vertexShader:qe.shadow_vert,fragmentShader:qe.shadow_frag}};yn.physical={uniforms:Lt([yn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatNormalScale:{value:new se(1,1)},clearcoatNormalMap:{value:null},sheen:{value:new ge(0)},transmission:{value:0},transmissionMap:{value:null}}]),vertexShader:qe.meshphysical_vert,fragmentShader:qe.meshphysical_frag};function Lg(r,e,t,n,i){let s=new ge(0),o=0,a,l,c=null,u=0,h=null;function d(g,x,y,m){let p=x.isScene===!0?x.background:null;p&&p.isTexture&&(p=e.get(p));let R=r.xr,A=R.getSession&&R.getSession();A&&A.environmentBlendMode==="additive"&&(p=null),p===null?f(s,o):p&&p.isColor&&(f(p,1),m=!0),(r.autoClear||m)&&r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil),p&&(p.isCubeTexture||p.mapping===sc)?(l===void 0&&(l=new Xe(new Jr(1,1,1),new tt({name:"BackgroundCubeMaterial",uniforms:Ji(yn.cube.uniforms),vertexShader:yn.cube.vertexShader,fragmentShader:yn.cube.fragmentShader,side:yt,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(C,w,F){this.matrixWorld.copyPosition(F.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=p,l.material.uniforms.flipEnvMap.value=p.isCubeTexture&&p._needsFlipEnvMap?-1:1,(c!==p||u!==p.version||h!==r.toneMapping)&&(l.material.needsUpdate=!0,c=p,u=p.version,h=r.toneMapping),g.unshift(l,l.geometry,l.material,0,0,null)):p&&p.isTexture&&(a===void 0&&(a=new Xe(new zt(2,2),new tt({name:"BackgroundMaterial",uniforms:Ji(yn.background.uniforms),vertexShader:yn.background.vertexShader,fragmentShader:yn.background.fragmentShader,side:zo,depthTest:!1,depthWrite:!1,fog:!1})),a.geometry.deleteAttribute("normal"),Object.defineProperty(a.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(a)),a.material.uniforms.t2D.value=p,p.matrixAutoUpdate===!0&&p.updateMatrix(),a.material.uniforms.uvTransform.value.copy(p.matrix),(c!==p||u!==p.version||h!==r.toneMapping)&&(a.material.needsUpdate=!0,c=p,u=p.version,h=r.toneMapping),g.unshift(a,a.geometry,a.material,0,0,null))}function f(g,x){t.buffers.color.setClear(g.r,g.g,g.b,x,i)}return{getClearColor:function(){return s},setClearColor:function(g,x=1){s.set(g),o=x,f(s,o)},getClearAlpha:function(){return o},setClearAlpha:function(g){o=g,f(s,o)},render:d}}function Rg(r,e,t,n){let i=r.getParameter(34921),s=n.isWebGL2?null:e.get("OES_vertex_array_object"),o=n.isWebGL2||s!==null,a={},l=x(null),c=l;function u(D,z,N,P,te){let ce=!1;if(o){let oe=g(P,N,z);c!==oe&&(c=oe,d(c.object)),ce=y(P,te),ce&&m(P,te)}else{let oe=z.wireframe===!0;(c.geometry!==P.id||c.program!==N.id||c.wireframe!==oe)&&(c.geometry=P.id,c.program=N.id,c.wireframe=oe,ce=!0)}D.isInstancedMesh===!0&&(ce=!0),te!==null&&t.update(te,34963),ce&&(F(D,z,N,P),te!==null&&r.bindBuffer(34963,t.get(te).buffer))}function h(){return n.isWebGL2?r.createVertexArray():s.createVertexArrayOES()}function d(D){return n.isWebGL2?r.bindVertexArray(D):s.bindVertexArrayOES(D)}function f(D){return n.isWebGL2?r.deleteVertexArray(D):s.deleteVertexArrayOES(D)}function g(D,z,N){let P=N.wireframe===!0,te=a[D.id];te===void 0&&(te={},a[D.id]=te);let ce=te[z.id];ce===void 0&&(ce={},te[z.id]=ce);let oe=ce[P];return oe===void 0&&(oe=x(h()),ce[P]=oe),oe}function x(D){let z=[],N=[],P=[];for(let te=0;te<i;te++)z[te]=0,N[te]=0,P[te]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:z,enabledAttributes:N,attributeDivisors:P,object:D,attributes:{},index:null}}function y(D,z){let N=c.attributes,P=D.attributes,te=0;for(let ce in P){let oe=N[ce],we=P[ce];if(oe===void 0||oe.attribute!==we||oe.data!==we.data)return!0;te++}return c.attributesNum!==te||c.index!==z}function m(D,z){let N={},P=D.attributes,te=0;for(let ce in P){let oe=P[ce],we={};we.attribute=oe,oe.data&&(we.data=oe.data),N[ce]=we,te++}c.attributes=N,c.attributesNum=te,c.index=z}function p(){let D=c.newAttributes;for(let z=0,N=D.length;z<N;z++)D[z]=0}function R(D){A(D,0)}function A(D,z){let N=c.newAttributes,P=c.enabledAttributes,te=c.attributeDivisors;N[D]=1,P[D]===0&&(r.enableVertexAttribArray(D),P[D]=1),te[D]!==z&&((n.isWebGL2?r:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](D,z),te[D]=z)}function C(){let D=c.newAttributes,z=c.enabledAttributes;for(let N=0,P=z.length;N<P;N++)z[N]!==D[N]&&(r.disableVertexAttribArray(N),z[N]=0)}function w(D,z,N,P,te,ce){n.isWebGL2===!0&&(N===5124||N===5125)?r.vertexAttribIPointer(D,z,N,te,ce):r.vertexAttribPointer(D,z,N,P,te,ce)}function F(D,z,N,P){if(n.isWebGL2===!1&&(D.isInstancedMesh||P.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;p();let te=P.attributes,ce=N.getAttributes(),oe=z.defaultAttributeValues;for(let we in ce){let pe=ce[we];if(pe>=0){let Ce=te[we];if(Ce!==void 0){let Fe=Ce.normalized,ee=Ce.itemSize,$=t.get(Ce);if($===void 0)continue;let ue=$.buffer,Se=$.type,he=$.bytesPerElement;if(Ce.isInterleavedBufferAttribute){let be=Ce.data,le=be.stride,v=Ce.offset;be&&be.isInstancedInterleavedBuffer?(A(pe,be.meshPerAttribute),P._maxInstanceCount===void 0&&(P._maxInstanceCount=be.meshPerAttribute*be.count)):R(pe),r.bindBuffer(34962,ue),w(pe,ee,Se,Fe,le*he,v*he)}else Ce.isInstancedBufferAttribute?(A(pe,Ce.meshPerAttribute),P._maxInstanceCount===void 0&&(P._maxInstanceCount=Ce.meshPerAttribute*Ce.count)):R(pe),r.bindBuffer(34962,ue),w(pe,ee,Se,Fe,0,0)}else if(we==="instanceMatrix"){let Fe=t.get(D.instanceMatrix);if(Fe===void 0)continue;let ee=Fe.buffer,$=Fe.type;A(pe+0,1),A(pe+1,1),A(pe+2,1),A(pe+3,1),r.bindBuffer(34962,ee),r.vertexAttribPointer(pe+0,4,$,!1,64,0),r.vertexAttribPointer(pe+1,4,$,!1,64,16),r.vertexAttribPointer(pe+2,4,$,!1,64,32),r.vertexAttribPointer(pe+3,4,$,!1,64,48)}else if(we==="instanceColor"){let Fe=t.get(D.instanceColor);if(Fe===void 0)continue;let ee=Fe.buffer,$=Fe.type;A(pe,1),r.bindBuffer(34962,ee),r.vertexAttribPointer(pe,3,$,!1,12,0)}else if(oe!==void 0){let Fe=oe[we];if(Fe!==void 0)switch(Fe.length){case 2:r.vertexAttrib2fv(pe,Fe);break;case 3:r.vertexAttrib3fv(pe,Fe);break;case 4:r.vertexAttrib4fv(pe,Fe);break;default:r.vertexAttrib1fv(pe,Fe)}}}}C()}function B(){K();for(let D in a){let z=a[D];for(let N in z){let P=z[N];for(let te in P)f(P[te].object),delete P[te];delete z[N]}delete a[D]}}function O(D){if(a[D.id]===void 0)return;let z=a[D.id];for(let N in z){let P=z[N];for(let te in P)f(P[te].object),delete P[te];delete z[N]}delete a[D.id]}function H(D){for(let z in a){let N=a[z];if(N[D.id]===void 0)continue;let P=N[D.id];for(let te in P)f(P[te].object),delete P[te];delete N[D.id]}}function K(){q(),c!==l&&(c=l,d(c.object))}function q(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:K,resetDefaultState:q,dispose:B,releaseStatesOfGeometry:O,releaseStatesOfProgram:H,initAttributes:p,enableAttribute:R,disableUnusedAttributes:C}}function Cg(r,e,t,n){let i=n.isWebGL2,s;function o(c){s=c}function a(c,u){r.drawArrays(s,c,u),t.update(u,s,1)}function l(c,u,h){if(h===0)return;let d,f;if(i)d=r,f="drawArraysInstanced";else if(d=e.get("ANGLE_instanced_arrays"),f="drawArraysInstancedANGLE",d===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}d[f](s,c,u,h),t.update(u,s,h)}this.setMode=o,this.render=a,this.renderInstances=l}function Pg(r,e,t){let n;function i(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){let w=e.get("EXT_texture_filter_anisotropic");n=r.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function s(w){if(w==="highp"){if(r.getShaderPrecisionFormat(35633,36338).precision>0&&r.getShaderPrecisionFormat(35632,36338).precision>0)return"highp";w="mediump"}return w==="mediump"&&r.getShaderPrecisionFormat(35633,36337).precision>0&&r.getShaderPrecisionFormat(35632,36337).precision>0?"mediump":"lowp"}let o=typeof WebGL2RenderingContext!="undefined"&&r instanceof WebGL2RenderingContext||typeof WebGL2ComputeRenderingContext!="undefined"&&r instanceof WebGL2ComputeRenderingContext,a=t.precision!==void 0?t.precision:"highp",l=s(a);l!==a&&(console.warn("THREE.WebGLRenderer:",a,"not supported, using",l,"instead."),a=l);let c=t.logarithmicDepthBuffer===!0,u=r.getParameter(34930),h=r.getParameter(35660),d=r.getParameter(3379),f=r.getParameter(34076),g=r.getParameter(34921),x=r.getParameter(36347),y=r.getParameter(36348),m=r.getParameter(36349),p=h>0,R=o||e.has("OES_texture_float"),A=p&&R,C=o?r.getParameter(36183):0;return{isWebGL2:o,getMaxAnisotropy:i,getMaxPrecision:s,precision:a,logarithmicDepthBuffer:c,maxTextures:u,maxVertexTextures:h,maxTextureSize:d,maxCubemapSize:f,maxAttributes:g,maxVertexUniforms:x,maxVaryings:y,maxFragmentUniforms:m,vertexTextures:p,floatFragmentTextures:R,floatVertexTextures:A,maxSamples:C}}function Dg(r){let e=this,t=null,n=0,i=!1,s=!1,o=new $t,a=new _t,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d,f){let g=h.length!==0||d||n!==0||i;return i=d,t=u(h,f,0),n=h.length,g},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1,c()},this.setState=function(h,d,f){let g=h.clippingPlanes,x=h.clipIntersection,y=h.clipShadows,m=r.get(h);if(!i||g===null||g.length===0||s&&!y)s?u(null):c();else{let p=s?0:n,R=p*4,A=m.clippingState||null;l.value=A,A=u(g,d,R,f);for(let C=0;C!==R;++C)A[C]=t[C];m.clippingState=A,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=p}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(h,d,f,g){let x=h!==null?h.length:0,y=null;if(x!==0){if(y=l.value,g!==!0||y===null){let m=f+x*4,p=d.matrixWorldInverse;a.getNormalMatrix(p),(y===null||y.length<m)&&(y=new Float32Array(m));for(let R=0,A=f;R!==x;++R,A+=4)o.copy(h[R]).applyMatrix4(p,a),o.normal.toArray(y,A),y[A+3]=o.constant}l.value=y,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,y}}function Fg(r){let e=new WeakMap;function t(o,a){return a===Gc?o.mapping=ic:a===Vc&&(o.mapping=rc),o}function n(o){if(o&&o.isTexture){let a=o.mapping;if(a===Gc||a===Vc)if(e.has(o)){let l=e.get(o).texture;return t(l,o.mapping)}else{let l=o.image;if(l&&l.height>0){let c=r.getRenderTarget(),u=new fo(l.height/2);return u.fromEquirectangularTexture(r,o),e.set(o,u),r.setRenderTarget(c),o.addEventListener("dispose",i),t(u.texture,o.mapping)}else return null}}return o}function i(o){let a=o.target;a.removeEventListener("dispose",i);let l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function s(){e=new WeakMap}return{get:n,dispose:s}}function Ig(r){let e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?t("EXT_color_buffer_float"):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float")},get:function(n){let i=t(n);return i===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function zg(r,e,t,n){let i={},s=new WeakMap;function o(h){let d=h.target;d.index!==null&&e.remove(d.index);for(let g in d.attributes)e.remove(d.attributes[g]);d.removeEventListener("dispose",o),delete i[d.id];let f=s.get(d);f&&(e.remove(f),s.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(h,d){return i[d.id]===!0||(d.addEventListener("dispose",o),i[d.id]=!0,t.memory.geometries++),d}function l(h){let d=h.attributes;for(let g in d)e.update(d[g],34962);let f=h.morphAttributes;for(let g in f){let x=f[g];for(let y=0,m=x.length;y<m;y++)e.update(x[y],34962)}}function c(h){let d=[],f=h.index,g=h.attributes.position,x=0;if(f!==null){let p=f.array;x=f.version;for(let R=0,A=p.length;R<A;R+=3){let C=p[R+0],w=p[R+1],F=p[R+2];d.push(C,w,w,F,F,C)}}else{let p=g.array;x=g.version;for(let R=0,A=p.length/3-1;R<A;R+=3){let C=R+0,w=R+1,F=R+2;d.push(C,w,w,F,F,C)}}let y=new(hh(d)>65535?ho:uo)(d,1);y.version=x;let m=s.get(h);m&&e.remove(m),s.set(h,y)}function u(h){let d=s.get(h);if(d){let f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:u}}function Bg(r,e,t,n){let i=n.isWebGL2,s;function o(d){s=d}let a,l;function c(d){a=d.type,l=d.bytesPerElement}function u(d,f){r.drawElements(s,f,a,d*l),t.update(f,s,1)}function h(d,f,g){if(g===0)return;let x,y;if(i)x=r,y="drawElementsInstanced";else if(x=e.get("ANGLE_instanced_arrays"),y="drawElementsInstancedANGLE",x===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}x[y](s,f,a,d*l,g),t.update(f,s,g)}this.setMode=o,this.setIndex=c,this.render=u,this.renderInstances=h}function Ng(r){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,o,a){switch(t.calls++,o){case 4:t.triangles+=a*(s/3);break;case 1:t.lines+=a*(s/2);break;case 3:t.lines+=a*(s-1);break;case 2:t.lines+=a*s;break;case 0:t.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function i(){t.frame++,t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function Ug(r,e){return r[0]-e[0]}function Og(r,e){return Math.abs(e[1])-Math.abs(r[1])}function kg(r){let e={},t=new Float32Array(8),n=[];for(let s=0;s<8;s++)n[s]=[s,0];function i(s,o,a,l){let c=s.morphTargetInfluences,u=c===void 0?0:c.length,h=e[o.id];if(h===void 0){h=[];for(let y=0;y<u;y++)h[y]=[y,0];e[o.id]=h}for(let y=0;y<u;y++){let m=h[y];m[0]=y,m[1]=c[y]}h.sort(Og);for(let y=0;y<8;y++)y<u&&h[y][1]?(n[y][0]=h[y][0],n[y][1]=h[y][1]):(n[y][0]=Number.MAX_SAFE_INTEGER,n[y][1]=0);n.sort(Ug);let d=a.morphTargets&&o.morphAttributes.position,f=a.morphNormals&&o.morphAttributes.normal,g=0;for(let y=0;y<8;y++){let m=n[y],p=m[0],R=m[1];p!==Number.MAX_SAFE_INTEGER&&R?(d&&o.getAttribute("morphTarget"+y)!==d[p]&&o.setAttribute("morphTarget"+y,d[p]),f&&o.getAttribute("morphNormal"+y)!==f[p]&&o.setAttribute("morphNormal"+y,f[p]),t[y]=R,g+=R):(d&&o.hasAttribute("morphTarget"+y)===!0&&o.deleteAttribute("morphTarget"+y),f&&o.hasAttribute("morphNormal"+y)===!0&&o.deleteAttribute("morphNormal"+y),t[y]=0)}let x=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(r,"morphTargetBaseInfluence",x),l.getUniforms().setValue(r,"morphTargetInfluences",t)}return{update:i}}function Hg(r,e,t,n){let i=new WeakMap;function s(l){let c=n.render.frame,u=l.geometry,h=e.get(l,u);return i.get(h)!==c&&(e.update(h),i.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),t.update(l.instanceMatrix,34962),l.instanceColor!==null&&t.update(l.instanceColor,34962)),h}function o(){i=new WeakMap}function a(l){let c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:o}}var po=class extends Pt{constructor(e=null,t=1,n=1,i=1){super(null),this.image={data:e,width:t,height:n,depth:i},this.magFilter=It,this.minFilter=It,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};po.prototype.isDataTexture2DArray=!0;var mo=class extends Pt{constructor(e=null,t=1,n=1,i=1){super(null),this.image={data:e,width:t,height:n,depth:i},this.magFilter=It,this.minFilter=It,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}};mo.prototype.isDataTexture3D=!0;var fh=new Pt,Gg=new po,Vg=new mo,ph=new ji,mu=[],gu=[],vu=new Float32Array(16),xu=new Float32Array(9),yu=new Float32Array(4);function dr(r,e,t){let n=r[0];if(n<=0||n>0)return r;let i=e*t,s=mu[i];if(s===void 0&&(s=new Float32Array(i),mu[i]=s),e!==0){n.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,r[o].toArray(s,a)}return s}function Bt(r,e){if(r.length!==e.length)return!1;for(let t=0,n=r.length;t<n;t++)if(r[t]!==e[t])return!1;return!0}function Dt(r,e){for(let t=0,n=e.length;t<n;t++)r[t]=e[t]}function mh(r,e){let t=gu[e];t===void 0&&(t=new Int32Array(e),gu[e]=t);for(let n=0;n!==e;++n)t[n]=r.allocateTextureUnit();return t}function Wg(r,e){let t=this.cache;t[0]!==e&&(r.uniform1f(this.addr,e),t[0]=e)}function qg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(r.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;r.uniform2fv(this.addr,e),Dt(t,e)}}function Xg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(r.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(r.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Bt(t,e))return;r.uniform3fv(this.addr,e),Dt(t,e)}}function Yg(r,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(r.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;r.uniform4fv(this.addr,e),Dt(t,e)}}function Zg(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Bt(t,e))return;r.uniformMatrix2fv(this.addr,!1,e),Dt(t,e)}else{if(Bt(t,n))return;yu.set(n),r.uniformMatrix2fv(this.addr,!1,yu),Dt(t,n)}}function Jg(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Bt(t,e))return;r.uniformMatrix3fv(this.addr,!1,e),Dt(t,e)}else{if(Bt(t,n))return;xu.set(n),r.uniformMatrix3fv(this.addr,!1,xu),Dt(t,n)}}function jg(r,e){let t=this.cache,n=e.elements;if(n===void 0){if(Bt(t,e))return;r.uniformMatrix4fv(this.addr,!1,e),Dt(t,e)}else{if(Bt(t,n))return;vu.set(n),r.uniformMatrix4fv(this.addr,!1,vu),Dt(t,n)}}function $g(r,e){let t=this.cache;t[0]!==e&&(r.uniform1i(this.addr,e),t[0]=e)}function Kg(r,e){let t=this.cache;Bt(t,e)||(r.uniform2iv(this.addr,e),Dt(t,e))}function Qg(r,e){let t=this.cache;Bt(t,e)||(r.uniform3iv(this.addr,e),Dt(t,e))}function e0(r,e){let t=this.cache;Bt(t,e)||(r.uniform4iv(this.addr,e),Dt(t,e))}function t0(r,e){let t=this.cache;t[0]!==e&&(r.uniform1ui(this.addr,e),t[0]=e)}function n0(r,e){let t=this.cache;Bt(t,e)||(r.uniform2uiv(this.addr,e),Dt(t,e))}function i0(r,e){let t=this.cache;Bt(t,e)||(r.uniform3uiv(this.addr,e),Dt(t,e))}function r0(r,e){let t=this.cache;Bt(t,e)||(r.uniform4uiv(this.addr,e),Dt(t,e))}function s0(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.safeSetTexture2D(e||fh,i)}function o0(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Vg,i)}function a0(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.safeSetTextureCube(e||ph,i)}function l0(r,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Gg,i)}function c0(r){switch(r){case 5126:return Wg;case 35664:return qg;case 35665:return Xg;case 35666:return Yg;case 35674:return Zg;case 35675:return Jg;case 35676:return jg;case 5124:case 35670:return $g;case 35667:case 35671:return Kg;case 35668:case 35672:return Qg;case 35669:case 35673:return e0;case 5125:return t0;case 36294:return n0;case 36295:return i0;case 36296:return r0;case 35678:case 36198:case 36298:case 36306:case 35682:return s0;case 35679:case 36299:case 36307:return o0;case 35680:case 36300:case 36308:case 36293:return a0;case 36289:case 36303:case 36311:case 36292:return l0}}function u0(r,e){r.uniform1fv(this.addr,e)}function h0(r,e){let t=dr(e,this.size,2);r.uniform2fv(this.addr,t)}function d0(r,e){let t=dr(e,this.size,3);r.uniform3fv(this.addr,t)}function f0(r,e){let t=dr(e,this.size,4);r.uniform4fv(this.addr,t)}function p0(r,e){let t=dr(e,this.size,4);r.uniformMatrix2fv(this.addr,!1,t)}function m0(r,e){let t=dr(e,this.size,9);r.uniformMatrix3fv(this.addr,!1,t)}function g0(r,e){let t=dr(e,this.size,16);r.uniformMatrix4fv(this.addr,!1,t)}function v0(r,e){r.uniform1iv(this.addr,e)}function x0(r,e){r.uniform2iv(this.addr,e)}function y0(r,e){r.uniform3iv(this.addr,e)}function _0(r,e){r.uniform4iv(this.addr,e)}function w0(r,e){r.uniform1uiv(this.addr,e)}function b0(r,e){r.uniform2uiv(this.addr,e)}function M0(r,e){r.uniform3uiv(this.addr,e)}function S0(r,e){r.uniform4uiv(this.addr,e)}function T0(r,e,t){let n=e.length,i=mh(t,n);r.uniform1iv(this.addr,i);for(let s=0;s!==n;++s)t.safeSetTexture2D(e[s]||fh,i[s])}function E0(r,e,t){let n=e.length,i=mh(t,n);r.uniform1iv(this.addr,i);for(let s=0;s!==n;++s)t.safeSetTextureCube(e[s]||ph,i[s])}function A0(r){switch(r){case 5126:return u0;case 35664:return h0;case 35665:return d0;case 35666:return f0;case 35674:return p0;case 35675:return m0;case 35676:return g0;case 5124:case 35670:return v0;case 35667:case 35671:return x0;case 35668:case 35672:return y0;case 35669:case 35673:return _0;case 5125:return w0;case 36294:return b0;case 36295:return M0;case 36296:return S0;case 35678:case 36198:case 36298:case 36306:case 35682:return T0;case 35680:case 36300:case 36308:case 36293:return E0}}function L0(r,e,t){this.id=r,this.addr=t,this.cache=[],this.setValue=c0(e.type)}function gh(r,e,t){this.id=r,this.addr=t,this.cache=[],this.size=e.size,this.setValue=A0(e.type)}gh.prototype.updateCache=function(r){let e=this.cache;r instanceof Float32Array&&e.length!==r.length&&(this.cache=new Float32Array(r.length)),Dt(e,r)};function vh(r){this.id=r,this.seq=[],this.map={}}vh.prototype.setValue=function(r,e,t){let n=this.seq;for(let i=0,s=n.length;i!==s;++i){let o=n[i];o.setValue(r,e[o.id],t)}};var Ba=/(\w+)(\])?(\[|\.)?/g;function _u(r,e){r.seq.push(e),r.map[e.id]=e}function R0(r,e,t){let n=r.name,i=n.length;for(Ba.lastIndex=0;;){let s=Ba.exec(n),o=Ba.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===i){_u(t,c===void 0?new L0(a,r,e):new gh(a,r,e));break}else{let h=t.map[a];h===void 0&&(h=new vh(a),_u(t,h)),t=h}}}function Kn(r,e){this.seq=[],this.map={};let t=r.getProgramParameter(e,35718);for(let n=0;n<t;++n){let i=r.getActiveUniform(e,n),s=r.getUniformLocation(e,i.name);R0(i,s,this)}}Kn.prototype.setValue=function(r,e,t,n){let i=this.map[e];i!==void 0&&i.setValue(r,t,n)};Kn.prototype.setOptional=function(r,e,t){let n=e[t];n!==void 0&&this.setValue(r,t,n)};Kn.upload=function(r,e,t,n){for(let i=0,s=e.length;i!==s;++i){let o=e[i],a=t[o.id];a.needsUpdate!==!1&&o.setValue(r,a.value,n)}};Kn.seqWithValue=function(r,e){let t=[];for(let n=0,i=r.length;n!==i;++n){let s=r[n];s.id in e&&t.push(s)}return t};function wu(r,e,t){let n=r.createShader(e);return r.shaderSource(n,t),r.compileShader(n),n}var C0=0;function P0(r){let e=r.split(`
`);for(let t=0;t<e.length;t++)e[t]=t+1+": "+e[t];return e.join(`
`)}function xh(r){switch(r){case ur:return["Linear","( value )"];case cc:return["sRGB","( value )"];case oh:return["RGBE","( value )"];case ah:return["RGBM","( value, 7.0 )"];case lh:return["RGBM","( value, 16.0 )"];case ch:return["RGBD","( value, 256.0 )"];case sh:return["Gamma","( value, float( GAMMA_FACTOR ) )"];case Bf:return["LogLuv","( value )"];default:return console.warn("THREE.WebGLProgram: Unsupported encoding:",r),["Linear","( value )"]}}function bu(r,e,t){let n=r.getShaderParameter(e,35713),i=r.getShaderInfoLog(e).trim();if(n&&i==="")return"";let s=r.getShaderSource(e);return"THREE.WebGLShader: gl.getShaderInfoLog() "+t+`
`+i+P0(s)}function Ar(r,e){let t=xh(e);return"vec4 "+r+"( vec4 value ) { return "+t[0]+"ToLinear"+t[1]+"; }"}function D0(r,e){let t=xh(e);return"vec4 "+r+"( vec4 value ) { return LinearTo"+t[0]+t[1]+"; }"}function F0(r,e){let t;switch(e){case Id:t="Linear";break;case zd:t="Reinhard";break;case Bd:t="OptimizedCineon";break;case Nd:t="ACESFilmic";break;case Ud:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+r+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function I0(r){return[r.extensionDerivatives||r.envMapCubeUV||r.bumpMap||r.tangentSpaceNormalMap||r.clearcoatNormalMap||r.flatShading||r.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(r.extensionFragDepth||r.logarithmicDepthBuffer)&&r.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",r.extensionDrawBuffers&&r.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(r.extensionShaderTextureLOD||r.envMap)&&r.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(Ir).join(`
`)}function z0(r){let e=[];for(let t in r){let n=r[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function B0(r,e){let t={},n=r.getProgramParameter(e,35721);for(let i=0;i<n;i++){let o=r.getActiveAttrib(e,i).name;t[o]=r.getAttribLocation(e,o)}return t}function Ir(r){return r!==""}function Mu(r,e){return r.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Su(r,e){return r.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var N0=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ja(r){return r.replace(N0,U0)}function U0(r,e){let t=qe[e];if(t===void 0)throw new Error("Can not resolve #include <"+e+">");return Ja(t)}var O0=/#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g,k0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Tu(r){return r.replace(k0,yh).replace(O0,H0)}function H0(r,e,t,n){return console.warn("WebGLProgram: #pragma unroll_loop shader syntax is deprecated. Please use #pragma unroll_loop_start syntax instead."),yh(r,e,t,n)}function yh(r,e,t,n){let i="";for(let s=parseInt(e);s<parseInt(t);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function Eu(r){let e="precision "+r.precision+` float;
precision `+r.precision+" int;";return r.precision==="highp"?e+=`
#define HIGH_PRECISION`:r.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function G0(r){let e="SHADOWMAP_TYPE_BASIC";return r.shadowMapType===eh?e="SHADOWMAP_TYPE_PCF":r.shadowMapType===md?e="SHADOWMAP_TYPE_PCF_SOFT":r.shadowMapType===Fr&&(e="SHADOWMAP_TYPE_VSM"),e}function V0(r){let e="ENVMAP_TYPE_CUBE";if(r.envMap)switch(r.envMapMode){case ic:case rc:e="ENVMAP_TYPE_CUBE";break;case sc:case oc:e="ENVMAP_TYPE_CUBE_UV";break}return e}function W0(r){let e="ENVMAP_MODE_REFLECTION";if(r.envMap)switch(r.envMapMode){case rc:case oc:e="ENVMAP_MODE_REFRACTION";break}return e}function q0(r){let e="ENVMAP_BLENDING_NONE";if(r.envMap)switch(r.combine){case Bo:e="ENVMAP_BLENDING_MULTIPLY";break;case Dd:e="ENVMAP_BLENDING_MIX";break;case Fd:e="ENVMAP_BLENDING_ADD";break}return e}function X0(r,e,t,n){let i=r.getContext(),s=t.defines,o=t.vertexShader,a=t.fragmentShader,l=G0(t),c=V0(t),u=W0(t),h=q0(t),d=r.gammaFactor>0?r.gammaFactor:1,f=t.isWebGL2?"":I0(t),g=z0(s),x=i.createProgram(),y,m,p=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(y=[g].filter(Ir).join(`
`),y.length>0&&(y+=`
`),m=[f,g].filter(Ir).join(`
`),m.length>0&&(m+=`
`)):(y=[Eu(t),"#define SHADER_NAME "+t.shaderName,g,t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.supportsVertexTextures?"#define VERTEX_TEXTURES":"","#define GAMMA_FACTOR "+d,"#define MAX_BONES "+t.maxBones,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.displacementMap&&t.supportsVertexTextures?"#define USE_DISPLACEMENTMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.useVertexTexture?"#define BONE_TEXTURE":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_MORPHTARGETS","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ir).join(`
`),m=[f,Eu(t),"#define SHADER_NAME "+t.shaderName,g,t.alphaTest?"#define ALPHATEST "+t.alphaTest+(t.alphaTest%1?"":".0"):"","#define GAMMA_FACTOR "+d,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.sheen?"#define USE_SHEEN":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.physicallyCorrectLights?"#define PHYSICALLY_CORRECT_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"",(t.extensionShaderTextureLOD||t.envMap)&&t.rendererExtensionShaderTextureLod?"#define TEXTURE_LOD_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Nr?"#define TONE_MAPPING":"",t.toneMapping!==Nr?qe.tonemapping_pars_fragment:"",t.toneMapping!==Nr?F0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",qe.encodings_pars_fragment,t.map?Ar("mapTexelToLinear",t.mapEncoding):"",t.matcap?Ar("matcapTexelToLinear",t.matcapEncoding):"",t.envMap?Ar("envMapTexelToLinear",t.envMapEncoding):"",t.emissiveMap?Ar("emissiveMapTexelToLinear",t.emissiveMapEncoding):"",t.lightMap?Ar("lightMapTexelToLinear",t.lightMapEncoding):"",D0("linearToOutputTexel",t.outputEncoding),t.depthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ir).join(`
`)),o=Ja(o),o=Mu(o,t),o=Su(o,t),a=Ja(a),a=Mu(a,t),a=Su(a,t),o=Tu(o),a=Tu(a),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(p=`#version 300 es
`,y=["#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+y,m=["#define varying in",t.glslVersion===nu?"":"out highp vec4 pc_fragColor;",t.glslVersion===nu?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let R=p+y+o,A=p+m+a,C=wu(i,35633,R),w=wu(i,35632,A);if(i.attachShader(x,C),i.attachShader(x,w),t.index0AttributeName!==void 0?i.bindAttribLocation(x,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x),r.debug.checkShaderErrors){let O=i.getProgramInfoLog(x).trim(),H=i.getShaderInfoLog(C).trim(),K=i.getShaderInfoLog(w).trim(),q=!0,D=!0;if(i.getProgramParameter(x,35714)===!1){q=!1;let z=bu(i,C,"vertex"),N=bu(i,w,"fragment");console.error("THREE.WebGLProgram: shader error: ",i.getError(),"35715",i.getProgramParameter(x,35715),"gl.getProgramInfoLog",O,z,N)}else O!==""?console.warn("THREE.WebGLProgram: gl.getProgramInfoLog()",O):(H===""||K==="")&&(D=!1);D&&(this.diagnostics={runnable:q,programLog:O,vertexShader:{log:H,prefix:y},fragmentShader:{log:K,prefix:m}})}i.deleteShader(C),i.deleteShader(w);let F;this.getUniforms=function(){return F===void 0&&(F=new Kn(i,x)),F};let B;return this.getAttributes=function(){return B===void 0&&(B=B0(i,x)),B},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.name=t.shaderName,this.id=C0++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=C,this.fragmentShader=w,this}function Y0(r,e,t,n,i,s){let o=[],a=n.isWebGL2,l=n.logarithmicDepthBuffer,c=n.floatVertexTextures,u=n.maxVertexUniforms,h=n.vertexTextures,d=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"},g=["precision","isWebGL2","supportsVertexTextures","outputEncoding","instancing","instancingColor","map","mapEncoding","matcap","matcapEncoding","envMap","envMapMode","envMapEncoding","envMapCubeUV","lightMap","lightMapEncoding","aoMap","emissiveMap","emissiveMapEncoding","bumpMap","normalMap","objectSpaceNormalMap","tangentSpaceNormalMap","clearcoatMap","clearcoatRoughnessMap","clearcoatNormalMap","displacementMap","specularMap","roughnessMap","metalnessMap","gradientMap","alphaMap","combine","vertexColors","vertexAlphas","vertexTangents","vertexUvs","uvsVertexOnly","fog","useFog","fogExp2","flatShading","sizeAttenuation","logarithmicDepthBuffer","skinning","maxBones","useVertexTexture","morphTargets","morphNormals","premultipliedAlpha","numDirLights","numPointLights","numSpotLights","numHemiLights","numRectAreaLights","numDirLightShadows","numPointLightShadows","numSpotLightShadows","shadowMapEnabled","shadowMapType","toneMapping","physicallyCorrectLights","alphaTest","doubleSided","flipSided","numClippingPlanes","numClipIntersection","depthPacking","dithering","sheen","transmissionMap"];function x(w){let B=w.skeleton.bones;if(c)return 1024;{let H=Math.floor((u-20)/4),K=Math.min(H,B.length);return K<B.length?(console.warn("THREE.WebGLRenderer: Skeleton has "+B.length+" bones. This GPU supports "+K+"."),0):K}}function y(w){let F;return w&&w.isTexture?F=w.encoding:w&&w.isWebGLRenderTarget?(console.warn("THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead."),F=w.texture.encoding):F=ur,F}function m(w,F,B,O,H){let K=O.fog,q=w.isMeshStandardMaterial?O.environment:null,D=e.get(w.envMap||q),z=f[w.type],N=H.isSkinnedMesh?x(H):0;w.precision!==null&&(d=n.getMaxPrecision(w.precision),d!==w.precision&&console.warn("THREE.WebGLProgram.getParameters:",w.precision,"not supported, using",d,"instead."));let P,te;if(z){let we=yn[z];P=we.vertexShader,te=we.fragmentShader}else P=w.vertexShader,te=w.fragmentShader;let ce=r.getRenderTarget();return{isWebGL2:a,shaderID:z,shaderName:w.type,vertexShader:P,fragmentShader:te,defines:w.defines,isRawShaderMaterial:w.isRawShaderMaterial===!0,glslVersion:w.glslVersion,precision:d,instancing:H.isInstancedMesh===!0,instancingColor:H.isInstancedMesh===!0&&H.instanceColor!==null,supportsVertexTextures:h,outputEncoding:ce!==null?y(ce.texture):r.outputEncoding,map:!!w.map,mapEncoding:y(w.map),matcap:!!w.matcap,matcapEncoding:y(w.matcap),envMap:!!D,envMapMode:D&&D.mapping,envMapEncoding:y(D),envMapCubeUV:!!D&&(D.mapping===sc||D.mapping===oc),lightMap:!!w.lightMap,lightMapEncoding:y(w.lightMap),aoMap:!!w.aoMap,emissiveMap:!!w.emissiveMap,emissiveMapEncoding:y(w.emissiveMap),bumpMap:!!w.bumpMap,normalMap:!!w.normalMap,objectSpaceNormalMap:w.normalMapType===Of,tangentSpaceNormalMap:w.normalMapType===hr,clearcoatMap:!!w.clearcoatMap,clearcoatRoughnessMap:!!w.clearcoatRoughnessMap,clearcoatNormalMap:!!w.clearcoatNormalMap,displacementMap:!!w.displacementMap,roughnessMap:!!w.roughnessMap,metalnessMap:!!w.metalnessMap,specularMap:!!w.specularMap,alphaMap:!!w.alphaMap,gradientMap:!!w.gradientMap,sheen:!!w.sheen,transmissionMap:!!w.transmissionMap,combine:w.combine,vertexTangents:w.normalMap&&w.vertexTangents,vertexColors:w.vertexColors,vertexAlphas:w.vertexColors===!0&&H.geometry&&H.geometry.attributes.color&&H.geometry.attributes.color.itemSize===4,vertexUvs:!!w.map||!!w.bumpMap||!!w.normalMap||!!w.specularMap||!!w.alphaMap||!!w.emissiveMap||!!w.roughnessMap||!!w.metalnessMap||!!w.clearcoatMap||!!w.clearcoatRoughnessMap||!!w.clearcoatNormalMap||!!w.displacementMap||!!w.transmissionMap,uvsVertexOnly:!(w.map||w.bumpMap||w.normalMap||w.specularMap||w.alphaMap||w.emissiveMap||w.roughnessMap||w.metalnessMap||w.clearcoatNormalMap||w.transmissionMap)&&!!w.displacementMap,fog:!!K,useFog:w.fog,fogExp2:K&&K.isFogExp2,flatShading:!!w.flatShading,sizeAttenuation:w.sizeAttenuation,logarithmicDepthBuffer:l,skinning:w.skinning&&N>0,maxBones:N,useVertexTexture:c,morphTargets:w.morphTargets,morphNormals:w.morphNormals,numDirLights:F.directional.length,numPointLights:F.point.length,numSpotLights:F.spot.length,numRectAreaLights:F.rectArea.length,numHemiLights:F.hemi.length,numDirLightShadows:F.directionalShadowMap.length,numPointLightShadows:F.pointShadowMap.length,numSpotLightShadows:F.spotShadowMap.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:w.dithering,shadowMapEnabled:r.shadowMap.enabled&&B.length>0,shadowMapType:r.shadowMap.type,toneMapping:w.toneMapped?r.toneMapping:Nr,physicallyCorrectLights:r.physicallyCorrectLights,premultipliedAlpha:w.premultipliedAlpha,alphaTest:w.alphaTest,doubleSided:w.side===Ht,flipSided:w.side===yt,depthPacking:w.depthPacking!==void 0?w.depthPacking:!1,index0AttributeName:w.index0AttributeName,extensionDerivatives:w.extensions&&w.extensions.derivatives,extensionFragDepth:w.extensions&&w.extensions.fragDepth,extensionDrawBuffers:w.extensions&&w.extensions.drawBuffers,extensionShaderTextureLOD:w.extensions&&w.extensions.shaderTextureLOD,rendererExtensionFragDepth:a||t.has("EXT_frag_depth"),rendererExtensionDrawBuffers:a||t.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:a||t.has("EXT_shader_texture_lod"),customProgramCacheKey:w.customProgramCacheKey()}}function p(w){let F=[];if(w.shaderID?F.push(w.shaderID):(F.push(w.fragmentShader),F.push(w.vertexShader)),w.defines!==void 0)for(let B in w.defines)F.push(B),F.push(w.defines[B]);if(w.isRawShaderMaterial===!1){for(let B=0;B<g.length;B++)F.push(w[g[B]]);F.push(r.outputEncoding),F.push(r.gammaFactor)}return F.push(w.customProgramCacheKey),F.join()}function R(w){let F=f[w.type],B;if(F){let O=yn[F];B=ip.clone(O.uniforms)}else B=w.uniforms;return B}function A(w,F){let B;for(let O=0,H=o.length;O<H;O++){let K=o[O];if(K.cacheKey===F){B=K,++B.usedTimes;break}}return B===void 0&&(B=new X0(r,F,w,i),o.push(B)),B}function C(w){if(--w.usedTimes===0){let F=o.indexOf(w);o[F]=o[o.length-1],o.pop(),w.destroy()}}return{getParameters:m,getProgramCacheKey:p,getUniforms:R,acquireProgram:A,releaseProgram:C,programs:o}}function Z0(){let r=new WeakMap;function e(s){let o=r.get(s);return o===void 0&&(o={},r.set(s,o)),o}function t(s){r.delete(s)}function n(s,o,a){r.get(s)[o]=a}function i(){r=new WeakMap}return{get:e,remove:t,update:n,dispose:i}}function J0(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.program!==e.program?r.program.id-e.program.id:r.material.id!==e.material.id?r.material.id-e.material.id:r.z!==e.z?r.z-e.z:r.id-e.id}function j0(r,e){return r.groupOrder!==e.groupOrder?r.groupOrder-e.groupOrder:r.renderOrder!==e.renderOrder?r.renderOrder-e.renderOrder:r.z!==e.z?e.z-r.z:r.id-e.id}function Au(r){let e=[],t=0,n=[],i=[],s={id:-1};function o(){t=0,n.length=0,i.length=0}function a(d,f,g,x,y,m){let p=e[t],R=r.get(g);return p===void 0?(p={id:d.id,object:d,geometry:f,material:g,program:R.program||s,groupOrder:x,renderOrder:d.renderOrder,z:y,group:m},e[t]=p):(p.id=d.id,p.object=d,p.geometry=f,p.material=g,p.program=R.program||s,p.groupOrder=x,p.renderOrder=d.renderOrder,p.z=y,p.group=m),t++,p}function l(d,f,g,x,y,m){let p=a(d,f,g,x,y,m);(g.transparent===!0?i:n).push(p)}function c(d,f,g,x,y,m){let p=a(d,f,g,x,y,m);(g.transparent===!0?i:n).unshift(p)}function u(d,f){n.length>1&&n.sort(d||J0),i.length>1&&i.sort(f||j0)}function h(){for(let d=t,f=e.length;d<f;d++){let g=e[d];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.program=null,g.group=null}}return{opaque:n,transparent:i,init:o,push:l,unshift:c,finish:h,sort:u}}function $0(r){let e=new WeakMap;function t(i,s){let o;return e.has(i)===!1?(o=new Au(r),e.set(i,[o])):s>=e.get(i).length?(o=new Au(r),e.get(i).push(o)):o=e.get(i)[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}function K0(){let r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new M,color:new ge};break;case"SpotLight":t={position:new M,direction:new M,color:new ge,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new M,color:new ge,distance:0,decay:0};break;case"HemisphereLight":t={direction:new M,skyColor:new ge,groundColor:new ge};break;case"RectAreaLight":t={color:new ge,position:new M,halfWidth:new M,halfHeight:new M};break}return r[e.id]=t,t}}}function Q0(){let r={};return{get:function(e){if(r[e.id]!==void 0)return r[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[e.id]=t,t}}}var ev=0;function tv(r,e){return(e.castShadow?1:0)-(r.castShadow?1:0)}function nv(r,e){let t=new K0,n=Q0(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotShadow:[],spotShadowMap:[],spotShadowMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[]};for(let u=0;u<9;u++)i.probe.push(new M);let s=new M,o=new Ie,a=new Ie;function l(u){let h=0,d=0,f=0;for(let F=0;F<9;F++)i.probe[F].set(0,0,0);let g=0,x=0,y=0,m=0,p=0,R=0,A=0,C=0;u.sort(tv);for(let F=0,B=u.length;F<B;F++){let O=u[F],H=O.color,K=O.intensity,q=O.distance,D=O.shadow&&O.shadow.map?O.shadow.map.texture:null;if(O.isAmbientLight)h+=H.r*K,d+=H.g*K,f+=H.b*K;else if(O.isLightProbe)for(let z=0;z<9;z++)i.probe[z].addScaledVector(O.sh.coefficients[z],K);else if(O.isDirectionalLight){let z=t.get(O);if(z.color.copy(O.color).multiplyScalar(O.intensity),O.castShadow){let N=O.shadow,P=n.get(O);P.shadowBias=N.bias,P.shadowNormalBias=N.normalBias,P.shadowRadius=N.radius,P.shadowMapSize=N.mapSize,i.directionalShadow[g]=P,i.directionalShadowMap[g]=D,i.directionalShadowMatrix[g]=O.shadow.matrix,R++}i.directional[g]=z,g++}else if(O.isSpotLight){let z=t.get(O);if(z.position.setFromMatrixPosition(O.matrixWorld),z.color.copy(H).multiplyScalar(K),z.distance=q,z.coneCos=Math.cos(O.angle),z.penumbraCos=Math.cos(O.angle*(1-O.penumbra)),z.decay=O.decay,O.castShadow){let N=O.shadow,P=n.get(O);P.shadowBias=N.bias,P.shadowNormalBias=N.normalBias,P.shadowRadius=N.radius,P.shadowMapSize=N.mapSize,i.spotShadow[y]=P,i.spotShadowMap[y]=D,i.spotShadowMatrix[y]=O.shadow.matrix,C++}i.spot[y]=z,y++}else if(O.isRectAreaLight){let z=t.get(O);z.color.copy(H).multiplyScalar(K),z.halfWidth.set(O.width*.5,0,0),z.halfHeight.set(0,O.height*.5,0),i.rectArea[m]=z,m++}else if(O.isPointLight){let z=t.get(O);if(z.color.copy(O.color).multiplyScalar(O.intensity),z.distance=O.distance,z.decay=O.decay,O.castShadow){let N=O.shadow,P=n.get(O);P.shadowBias=N.bias,P.shadowNormalBias=N.normalBias,P.shadowRadius=N.radius,P.shadowMapSize=N.mapSize,P.shadowCameraNear=N.camera.near,P.shadowCameraFar=N.camera.far,i.pointShadow[x]=P,i.pointShadowMap[x]=D,i.pointShadowMatrix[x]=O.shadow.matrix,A++}i.point[x]=z,x++}else if(O.isHemisphereLight){let z=t.get(O);z.skyColor.copy(O.color).multiplyScalar(K),z.groundColor.copy(O.groundColor).multiplyScalar(K),i.hemi[p]=z,p++}}m>0&&(e.isWebGL2||r.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=_e.LTC_FLOAT_1,i.rectAreaLTC2=_e.LTC_FLOAT_2):r.has("OES_texture_half_float_linear")===!0?(i.rectAreaLTC1=_e.LTC_HALF_1,i.rectAreaLTC2=_e.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),i.ambient[0]=h,i.ambient[1]=d,i.ambient[2]=f;let w=i.hash;(w.directionalLength!==g||w.pointLength!==x||w.spotLength!==y||w.rectAreaLength!==m||w.hemiLength!==p||w.numDirectionalShadows!==R||w.numPointShadows!==A||w.numSpotShadows!==C)&&(i.directional.length=g,i.spot.length=y,i.rectArea.length=m,i.point.length=x,i.hemi.length=p,i.directionalShadow.length=R,i.directionalShadowMap.length=R,i.pointShadow.length=A,i.pointShadowMap.length=A,i.spotShadow.length=C,i.spotShadowMap.length=C,i.directionalShadowMatrix.length=R,i.pointShadowMatrix.length=A,i.spotShadowMatrix.length=C,w.directionalLength=g,w.pointLength=x,w.spotLength=y,w.rectAreaLength=m,w.hemiLength=p,w.numDirectionalShadows=R,w.numPointShadows=A,w.numSpotShadows=C,i.version=ev++)}function c(u,h){let d=0,f=0,g=0,x=0,y=0,m=h.matrixWorldInverse;for(let p=0,R=u.length;p<R;p++){let A=u[p];if(A.isDirectionalLight){let C=i.directional[d];C.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),C.direction.sub(s),C.direction.transformDirection(m),d++}else if(A.isSpotLight){let C=i.spot[g];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),C.direction.setFromMatrixPosition(A.matrixWorld),s.setFromMatrixPosition(A.target.matrixWorld),C.direction.sub(s),C.direction.transformDirection(m),g++}else if(A.isRectAreaLight){let C=i.rectArea[x];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),a.identity(),o.copy(A.matrixWorld),o.premultiply(m),a.extractRotation(o),C.halfWidth.set(A.width*.5,0,0),C.halfHeight.set(0,A.height*.5,0),C.halfWidth.applyMatrix4(a),C.halfHeight.applyMatrix4(a),x++}else if(A.isPointLight){let C=i.point[f];C.position.setFromMatrixPosition(A.matrixWorld),C.position.applyMatrix4(m),f++}else if(A.isHemisphereLight){let C=i.hemi[y];C.direction.setFromMatrixPosition(A.matrixWorld),C.direction.transformDirection(m),C.direction.normalize(),y++}}}return{setup:l,setupView:c,state:i}}function Lu(r,e){let t=new nv(r,e),n=[],i=[];function s(){n.length=0,i.length=0}function o(h){n.push(h)}function a(h){i.push(h)}function l(){t.setup(n)}function c(h){t.setupView(n,h)}return{init:s,state:{lightsArray:n,shadowsArray:i,lights:t},setupLights:l,setupLightsView:c,pushLight:o,pushShadow:a}}function iv(r,e){let t=new WeakMap;function n(s,o=0){let a;return t.has(s)===!1?(a=new Lu(r,e),t.set(s,[a])):o>=t.get(s).length?(a=new Lu(r,e),t.get(s).push(a)):a=t.get(s)[o],a}function i(){t=new WeakMap}return{get:n,dispose:i}}var go=class extends Mt{constructor(e){super(),this.type="MeshDepthMaterial",this.depthPacking=Nf,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}};go.prototype.isMeshDepthMaterial=!0;var vo=class extends Mt{constructor(e){super(),this.type="MeshDistanceMaterial",this.referencePosition=new M,this.nearDistance=1,this.farDistance=1e3,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.referencePosition.copy(e.referencePosition),this.nearDistance=e.nearDistance,this.farDistance=e.farDistance,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};vo.prototype.isMeshDistanceMaterial=!0;var rv=`uniform sampler2D shadow_pass;
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
}`,sv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`;function _h(r,e,t){let n=new Ki,i=new se,s=new se,o=new Je,a=[],l=[],c={},u=t.maxTextureSize,h={0:yt,1:zo,2:Ht},d=new tt({defines:{SAMPLE_RATE:2/8,HALF_SAMPLE_RATE:1/8},uniforms:{shadow_pass:{value:null},resolution:{value:new se},radius:{value:4}},vertexShader:sv,fragmentShader:rv}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let g=new $e;g.setAttribute("position",new ct(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Xe(g,d),y=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=eh,this.render=function(w,F,B){if(y.enabled===!1||y.autoUpdate===!1&&y.needsUpdate===!1||w.length===0)return;let O=r.getRenderTarget(),H=r.getActiveCubeFace(),K=r.getActiveMipmapLevel(),q=r.state;q.setBlending(zr),q.buffers.color.setClear(1,1,1,1),q.buffers.depth.setTest(!0),q.setScissorTest(!1);for(let D=0,z=w.length;D<z;D++){let N=w[D],P=N.shadow;if(P===void 0){console.warn("THREE.WebGLShadowMap:",N,"has no shadow.");continue}if(P.autoUpdate===!1&&P.needsUpdate===!1)continue;i.copy(P.mapSize);let te=P.getFrameExtents();if(i.multiply(te),s.copy(P.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(s.x=Math.floor(u/te.x),i.x=s.x*te.x,P.mapSize.x=s.x),i.y>u&&(s.y=Math.floor(u/te.y),i.y=s.y*te.y,P.mapSize.y=s.y)),P.map===null&&!P.isPointLightShadow&&this.type===Fr){let oe={minFilter:Rt,magFilter:Rt,format:un};P.map=new dn(i.x,i.y,oe),P.map.texture.name=N.name+".shadowMap",P.mapPass=new dn(i.x,i.y,oe),P.camera.updateProjectionMatrix()}if(P.map===null){let oe={minFilter:It,magFilter:It,format:un};P.map=new dn(i.x,i.y,oe),P.map.texture.name=N.name+".shadowMap",P.camera.updateProjectionMatrix()}r.setRenderTarget(P.map),r.clear();let ce=P.getViewportCount();for(let oe=0;oe<ce;oe++){let we=P.getViewport(oe);o.set(s.x*we.x,s.y*we.y,s.x*we.z,s.y*we.w),q.viewport(o),P.updateMatrices(N,oe),n=P.getFrustum(),C(F,B,P.camera,N,this.type)}!P.isPointLightShadow&&this.type===Fr&&m(P,B),P.needsUpdate=!1}y.needsUpdate=!1,r.setRenderTarget(O,H,K)};function m(w,F){let B=e.update(x);d.uniforms.shadow_pass.value=w.map.texture,d.uniforms.resolution.value=w.mapSize,d.uniforms.radius.value=w.radius,r.setRenderTarget(w.mapPass),r.clear(),r.renderBufferDirect(F,null,B,d,x,null),f.uniforms.shadow_pass.value=w.mapPass.texture,f.uniforms.resolution.value=w.mapSize,f.uniforms.radius.value=w.radius,r.setRenderTarget(w.map),r.clear(),r.renderBufferDirect(F,null,B,f,x,null)}function p(w,F,B){let O=w<<0|F<<1|B<<2,H=a[O];return H===void 0&&(H=new go({depthPacking:Uf,morphTargets:w,skinning:F}),a[O]=H),H}function R(w,F,B){let O=w<<0|F<<1|B<<2,H=l[O];return H===void 0&&(H=new vo({morphTargets:w,skinning:F}),l[O]=H),H}function A(w,F,B,O,H,K,q){let D=null,z=p,N=w.customDepthMaterial;if(O.isPointLight===!0&&(z=R,N=w.customDistanceMaterial),N===void 0){let P=!1;B.morphTargets===!0&&(P=F.morphAttributes&&F.morphAttributes.position&&F.morphAttributes.position.length>0);let te=!1;w.isSkinnedMesh===!0&&(B.skinning===!0?te=!0:console.warn("THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false:",w));let ce=w.isInstancedMesh===!0;D=z(P,te,ce)}else D=N;if(r.localClippingEnabled&&B.clipShadows===!0&&B.clippingPlanes.length!==0){let P=D.uuid,te=B.uuid,ce=c[P];ce===void 0&&(ce={},c[P]=ce);let oe=ce[te];oe===void 0&&(oe=D.clone(),ce[te]=oe),D=oe}return D.visible=B.visible,D.wireframe=B.wireframe,q===Fr?D.side=B.shadowSide!==null?B.shadowSide:B.side:D.side=B.shadowSide!==null?B.shadowSide:h[B.side],D.clipShadows=B.clipShadows,D.clippingPlanes=B.clippingPlanes,D.clipIntersection=B.clipIntersection,D.wireframeLinewidth=B.wireframeLinewidth,D.linewidth=B.linewidth,O.isPointLight===!0&&D.isMeshDistanceMaterial===!0&&(D.referencePosition.setFromMatrixPosition(O.matrixWorld),D.nearDistance=H,D.farDistance=K),D}function C(w,F,B,O,H){if(w.visible===!1)return;if(w.layers.test(F.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&H===Fr)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,w.matrixWorld);let D=e.update(w),z=w.material;if(Array.isArray(z)){let N=D.groups;for(let P=0,te=N.length;P<te;P++){let ce=N[P],oe=z[ce.materialIndex];if(oe&&oe.visible){let we=A(w,D,oe,O,B.near,B.far,H);r.renderBufferDirect(B,null,D,we,w,ce)}}}else if(z.visible){let N=A(w,D,z,O,B.near,B.far,H);r.renderBufferDirect(B,null,D,N,w,null)}}let q=w.children;for(let D=0,z=q.length;D<z;D++)C(q[D],F,B,O,H)}}function ov(r,e,t){let n=t.isWebGL2;function i(){let I=!1,fe=new Je,me=null,De=new Je(0,0,0,0);return{setMask:function(re){me!==re&&!I&&(r.colorMask(re,re,re,re),me=re)},setLocked:function(re){I=re},setClear:function(re,ze,We,mt,Sn){Sn===!0&&(re*=mt,ze*=mt,We*=mt),fe.set(re,ze,We,mt),De.equals(fe)===!1&&(r.clearColor(re,ze,We,mt),De.copy(fe))},reset:function(){I=!1,me=null,De.set(-1,0,0,0)}}}function s(){let I=!1,fe=null,me=null,De=null;return{setTest:function(re){re?Ce(2929):Fe(2929)},setMask:function(re){fe!==re&&!I&&(r.depthMask(re),fe=re)},setFunc:function(re){if(me!==re){if(re)switch(re){case Td:r.depthFunc(512);break;case Ed:r.depthFunc(519);break;case Ad:r.depthFunc(513);break;case Wa:r.depthFunc(515);break;case Ld:r.depthFunc(514);break;case Rd:r.depthFunc(518);break;case Cd:r.depthFunc(516);break;case Pd:r.depthFunc(517);break;default:r.depthFunc(515)}else r.depthFunc(515);me=re}},setLocked:function(re){I=re},setClear:function(re){De!==re&&(r.clearDepth(re),De=re)},reset:function(){I=!1,fe=null,me=null,De=null}}}function o(){let I=!1,fe=null,me=null,De=null,re=null,ze=null,We=null,mt=null,Sn=null;return{setTest:function(ut){I||(ut?Ce(2960):Fe(2960))},setMask:function(ut){fe!==ut&&!I&&(r.stencilMask(ut),fe=ut)},setFunc:function(ut,tn,xt){(me!==ut||De!==tn||re!==xt)&&(r.stencilFunc(ut,tn,xt),me=ut,De=tn,re=xt)},setOp:function(ut,tn,xt){(ze!==ut||We!==tn||mt!==xt)&&(r.stencilOp(ut,tn,xt),ze=ut,We=tn,mt=xt)},setLocked:function(ut){I=ut},setClear:function(ut){Sn!==ut&&(r.clearStencil(ut),Sn=ut)},reset:function(){I=!1,fe=null,me=null,De=null,re=null,ze=null,We=null,mt=null,Sn=null}}}let a=new i,l=new s,c=new o,u={},h=null,d={},f=null,g=!1,x=null,y=null,m=null,p=null,R=null,A=null,C=null,w=!1,F=null,B=null,O=null,H=null,K=null,q=r.getParameter(35661),D=!1,z=0,N=r.getParameter(7938);N.indexOf("WebGL")!==-1?(z=parseFloat(/^WebGL (\d)/.exec(N)[1]),D=z>=1):N.indexOf("OpenGL ES")!==-1&&(z=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),D=z>=2);let P=null,te={},ce=new Je(0,0,r.canvas.width,r.canvas.height),oe=new Je(0,0,r.canvas.width,r.canvas.height);function we(I,fe,me){let De=new Uint8Array(4),re=r.createTexture();r.bindTexture(I,re),r.texParameteri(I,10241,9728),r.texParameteri(I,10240,9728);for(let ze=0;ze<me;ze++)r.texImage2D(fe+ze,0,6408,1,1,0,6408,5121,De);return re}let pe={};pe[3553]=we(3553,3553,1),pe[34067]=we(34067,34069,6),a.setClear(0,0,0,1),l.setClear(1),c.setClear(0),Ce(2929),l.setFunc(Wa),v(!1),Z(Nc),Ce(2884),be(zr);function Ce(I){u[I]!==!0&&(r.enable(I),u[I]=!0)}function Fe(I){u[I]!==!1&&(r.disable(I),u[I]=!1)}function ee(I){I!==h&&(r.bindFramebuffer(36160,I),h=I)}function $(I,fe){fe===null&&h!==null&&(fe=h),d[I]!==fe&&(r.bindFramebuffer(I,fe),d[I]=fe,n&&(I===36009&&(d[36160]=fe),I===36160&&(d[36009]=fe)))}function ue(I){return f!==I?(r.useProgram(I),f=I,!0):!1}let Se={[ln]:32774,[gd]:32778,[vd]:32779};if(n)Se[kc]=32775,Se[Hc]=32776;else{let I=e.get("EXT_blend_minmax");I!==null&&(Se[kc]=I.MIN_EXT,Se[Hc]=I.MAX_EXT)}let he={[nc]:0,[fn]:1,[xd]:768,[nh]:770,[Sd]:776,[bd]:774,[_d]:772,[yd]:769,[cr]:771,[Md]:775,[wd]:773};function be(I,fe,me,De,re,ze,We,mt){if(I===zr){g===!0&&(Fe(3042),g=!1);return}if(g===!1&&(Ce(3042),g=!0),I!==lr){if(I!==x||mt!==w){if((y!==ln||R!==ln)&&(r.blendEquation(32774),y=ln,R=ln),mt)switch(I){case Br:r.blendFuncSeparate(1,771,1,771);break;case Vr:r.blendFunc(1,1);break;case Uc:r.blendFuncSeparate(0,0,769,771);break;case Oc:r.blendFuncSeparate(0,768,0,770);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case Br:r.blendFuncSeparate(770,771,1,771);break;case Vr:r.blendFunc(770,1);break;case Uc:r.blendFunc(0,769);break;case Oc:r.blendFunc(0,768);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}m=null,p=null,A=null,C=null,x=I,w=mt}return}re=re||fe,ze=ze||me,We=We||De,(fe!==y||re!==R)&&(r.blendEquationSeparate(Se[fe],Se[re]),y=fe,R=re),(me!==m||De!==p||ze!==A||We!==C)&&(r.blendFuncSeparate(he[me],he[De],he[ze],he[We]),m=me,p=De,A=ze,C=We),x=I,w=null}function le(I,fe){I.side===Ht?Fe(2884):Ce(2884);let me=I.side===yt;fe&&(me=!me),v(me),I.blending===Br&&I.transparent===!1?be(zr):be(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.premultipliedAlpha),l.setFunc(I.depthFunc),l.setTest(I.depthTest),l.setMask(I.depthWrite),a.setMask(I.colorWrite);let De=I.stencilWrite;c.setTest(De),De&&(c.setMask(I.stencilWriteMask),c.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),c.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),ae(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?Ce(32926):Fe(32926)}function v(I){F!==I&&(I?r.frontFace(2304):r.frontFace(2305),F=I)}function Z(I){I!==fd?(Ce(2884),I!==B&&(I===Nc?r.cullFace(1029):I===pd?r.cullFace(1028):r.cullFace(1032))):Fe(2884),B=I}function ie(I){I!==O&&(D&&r.lineWidth(I),O=I)}function ae(I,fe,me){I?(Ce(32823),(H!==fe||K!==me)&&(r.polygonOffset(fe,me),H=fe,K=me)):Fe(32823)}function Ee(I){I?Ce(3089):Fe(3089)}function de(I){I===void 0&&(I=33984+q-1),P!==I&&(r.activeTexture(I),P=I)}function E(I,fe){P===null&&de();let me=te[P];me===void 0&&(me={type:void 0,texture:void 0},te[P]=me),(me.type!==I||me.texture!==fe)&&(r.bindTexture(I,fe||pe[I]),me.type=I,me.texture=fe)}function S(){let I=te[P];I!==void 0&&I.type!==void 0&&(r.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function j(){try{r.compressedTexImage2D.apply(r,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ne(){try{r.texImage2D.apply(r,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ve(){try{r.texImage3D.apply(r,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Re(I){ce.equals(I)===!1&&(r.scissor(I.x,I.y,I.z,I.w),ce.copy(I))}function Ye(I){oe.equals(I)===!1&&(r.viewport(I.x,I.y,I.z,I.w),oe.copy(I))}function ke(){r.disable(3042),r.disable(2884),r.disable(2929),r.disable(32823),r.disable(3089),r.disable(2960),r.disable(32926),r.blendEquation(32774),r.blendFunc(1,0),r.blendFuncSeparate(1,0,1,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(513),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(519,0,4294967295),r.stencilOp(7680,7680,7680),r.clearStencil(0),r.cullFace(1029),r.frontFace(2305),r.polygonOffset(0,0),r.activeTexture(33984),r.bindFramebuffer(36160,null),n===!0&&(r.bindFramebuffer(36009,null),r.bindFramebuffer(36008,null)),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),u={},P=null,te={},h=null,d={},f=null,g=!1,x=null,y=null,m=null,p=null,R=null,A=null,C=null,w=!1,F=null,B=null,O=null,H=null,K=null,ce.set(0,0,r.canvas.width,r.canvas.height),oe.set(0,0,r.canvas.width,r.canvas.height),a.reset(),l.reset(),c.reset()}return{buffers:{color:a,depth:l,stencil:c},enable:Ce,disable:Fe,bindFramebuffer:$,bindXRFramebuffer:ee,useProgram:ue,setBlending:be,setMaterial:le,setFlipSided:v,setCullFace:Z,setLineWidth:ie,setPolygonOffset:ae,setScissorTest:Ee,activeTexture:de,bindTexture:E,unbindTexture:S,compressedTexImage2D:j,texImage2D:ne,texImage3D:ve,scissor:Re,viewport:Ye,reset:ke}}function av(r,e,t,n,i,s,o){let a=i.isWebGL2,l=i.maxTextures,c=i.maxCubemapSize,u=i.maxTextureSize,h=i.maxSamples,d=new WeakMap,f,g=!1;try{g=typeof OffscreenCanvas!="undefined"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(E,S){return g?new OffscreenCanvas(E,S):document.createElementNS("http://www.w3.org/1999/xhtml","canvas")}function y(E,S,j,ne){let ve=1;if((E.width>ne||E.height>ne)&&(ve=ne/Math.max(E.width,E.height)),ve<1||S===!0)if(typeof HTMLImageElement!="undefined"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&E instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&E instanceof ImageBitmap){let Re=S?Vf:Math.floor,Ye=Re(ve*E.width),ke=Re(ve*E.height);f===void 0&&(f=x(Ye,ke));let I=j?x(Ye,ke):f;return I.width=Ye,I.height=ke,I.getContext("2d").drawImage(E,0,0,Ye,ke),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+Ye+"x"+ke+")."),I}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),E;return E}function m(E){return iu(E.width)&&iu(E.height)}function p(E){return a?!1:E.wrapS!==cn||E.wrapT!==cn||E.minFilter!==It&&E.minFilter!==Rt}function R(E,S){return E.generateMipmaps&&S&&E.minFilter!==It&&E.minFilter!==Rt}function A(E,S,j,ne){r.generateMipmap(E);let ve=n.get(S);ve.__maxMipLevel=Math.log2(Math.max(j,ne))}function C(E,S,j){if(a===!1)return S;if(E!==null){if(r[E]!==void 0)return r[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let ne=S;return S===6403&&(j===5126&&(ne=33326),j===5131&&(ne=33325),j===5121&&(ne=33321)),S===6407&&(j===5126&&(ne=34837),j===5131&&(ne=34843),j===5121&&(ne=32849)),S===6408&&(j===5126&&(ne=34836),j===5131&&(ne=34842),j===5121&&(ne=32856)),(ne===33325||ne===33326||ne===34842||ne===34836)&&e.get("EXT_color_buffer_float"),ne}function w(E){return E===It||E===Wc||E===qc?9728:9729}function F(E){let S=E.target;S.removeEventListener("dispose",F),O(S),S.isVideoTexture&&d.delete(S),o.memory.textures--}function B(E){let S=E.target;S.removeEventListener("dispose",B),H(S),o.memory.textures--}function O(E){let S=n.get(E);S.__webglInit!==void 0&&(r.deleteTexture(S.__webglTexture),n.remove(E))}function H(E){let S=E.texture,j=n.get(E),ne=n.get(S);if(E){if(ne.__webglTexture!==void 0&&r.deleteTexture(ne.__webglTexture),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let ve=0;ve<6;ve++)r.deleteFramebuffer(j.__webglFramebuffer[ve]),j.__webglDepthbuffer&&r.deleteRenderbuffer(j.__webglDepthbuffer[ve]);else r.deleteFramebuffer(j.__webglFramebuffer),j.__webglDepthbuffer&&r.deleteRenderbuffer(j.__webglDepthbuffer),j.__webglMultisampledFramebuffer&&r.deleteFramebuffer(j.__webglMultisampledFramebuffer),j.__webglColorRenderbuffer&&r.deleteRenderbuffer(j.__webglColorRenderbuffer),j.__webglDepthRenderbuffer&&r.deleteRenderbuffer(j.__webglDepthRenderbuffer);n.remove(S),n.remove(E)}}let K=0;function q(){K=0}function D(){let E=K;return E>=l&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+l),K+=1,E}function z(E,S){let j=n.get(E);if(E.isVideoTexture&&Z(E),E.version>0&&j.__version!==E.version){let ne=E.image;if(ne===void 0)console.warn("THREE.WebGLRenderer: Texture marked for update but image is undefined");else if(ne.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Ce(j,E,S);return}}t.activeTexture(33984+S),t.bindTexture(3553,j.__webglTexture)}function N(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Ce(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(35866,j.__webglTexture)}function P(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Ce(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(32879,j.__webglTexture)}function te(E,S){let j=n.get(E);if(E.version>0&&j.__version!==E.version){Fe(j,E,S);return}t.activeTexture(33984+S),t.bindTexture(34067,j.__webglTexture)}let ce={[Wr]:10497,[cn]:33071,[qr]:33648},oe={[It]:9728,[Wc]:9984,[qc]:9986,[Rt]:9729,[Od]:9985,[wi]:9987};function we(E,S,j){if(j?(r.texParameteri(E,10242,ce[S.wrapS]),r.texParameteri(E,10243,ce[S.wrapT]),(E===32879||E===35866)&&r.texParameteri(E,32882,ce[S.wrapR]),r.texParameteri(E,10240,oe[S.magFilter]),r.texParameteri(E,10241,oe[S.minFilter])):(r.texParameteri(E,10242,33071),r.texParameteri(E,10243,33071),(E===32879||E===35866)&&r.texParameteri(E,32882,33071),(S.wrapS!==cn||S.wrapT!==cn)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),r.texParameteri(E,10240,w(S.magFilter)),r.texParameteri(E,10241,w(S.minFilter)),S.minFilter!==It&&S.minFilter!==Rt&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),e.has("EXT_texture_filter_anisotropic")===!0){let ne=e.get("EXT_texture_filter_anisotropic");if(S.type===$n&&e.has("OES_texture_float_linear")===!1||a===!1&&S.type===so&&e.has("OES_texture_half_float_linear")===!1)return;(S.anisotropy>1||n.get(S).__currentAnisotropy)&&(r.texParameterf(E,ne.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,i.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy)}}function pe(E,S){E.__webglInit===void 0&&(E.__webglInit=!0,S.addEventListener("dispose",F),E.__webglTexture=r.createTexture(),o.memory.textures++)}function Ce(E,S,j){let ne=3553;S.isDataTexture2DArray&&(ne=35866),S.isDataTexture3D&&(ne=32879),pe(E,S),t.activeTexture(33984+j),t.bindTexture(ne,E.__webglTexture),r.pixelStorei(37440,S.flipY),r.pixelStorei(37441,S.premultiplyAlpha),r.pixelStorei(3317,S.unpackAlignment),r.pixelStorei(37443,0);let ve=p(S)&&m(S.image)===!1,Re=y(S.image,ve,!1,u),Ye=m(Re)||a,ke=s.convert(S.format),I=s.convert(S.type),fe=C(S.internalFormat,ke,I);we(ne,S,Ye);let me,De=S.mipmaps;if(S.isDepthTexture)fe=6402,a?S.type===$n?fe=36012:S.type===no?fe=33190:S.type===Ur?fe=35056:fe=33189:S.type===$n&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),S.format===Yi&&fe===6402&&S.type!==ro&&S.type!==no&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),S.type=ro,I=s.convert(S.type)),S.format===Xr&&fe===6402&&(fe=34041,S.type!==Ur&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),S.type=Ur,I=s.convert(S.type))),t.texImage2D(3553,0,fe,Re.width,Re.height,0,ke,I,null);else if(S.isDataTexture)if(De.length>0&&Ye){for(let re=0,ze=De.length;re<ze;re++)me=De[re],t.texImage2D(3553,re,fe,me.width,me.height,0,ke,I,me.data);S.generateMipmaps=!1,E.__maxMipLevel=De.length-1}else t.texImage2D(3553,0,fe,Re.width,Re.height,0,ke,I,Re.data),E.__maxMipLevel=0;else if(S.isCompressedTexture){for(let re=0,ze=De.length;re<ze;re++)me=De[re],S.format!==un&&S.format!==Pn?ke!==null?t.compressedTexImage2D(3553,re,fe,me.width,me.height,0,me.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):t.texImage2D(3553,re,fe,me.width,me.height,0,ke,I,me.data);E.__maxMipLevel=De.length-1}else if(S.isDataTexture2DArray)t.texImage3D(35866,0,fe,Re.width,Re.height,Re.depth,0,ke,I,Re.data),E.__maxMipLevel=0;else if(S.isDataTexture3D)t.texImage3D(32879,0,fe,Re.width,Re.height,Re.depth,0,ke,I,Re.data),E.__maxMipLevel=0;else if(De.length>0&&Ye){for(let re=0,ze=De.length;re<ze;re++)me=De[re],t.texImage2D(3553,re,fe,ke,I,me);S.generateMipmaps=!1,E.__maxMipLevel=De.length-1}else t.texImage2D(3553,0,fe,ke,I,Re),E.__maxMipLevel=0;R(S,Ye)&&A(ne,S,Re.width,Re.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function Fe(E,S,j){if(S.image.length!==6)return;pe(E,S),t.activeTexture(33984+j),t.bindTexture(34067,E.__webglTexture),r.pixelStorei(37440,S.flipY),r.pixelStorei(37441,S.premultiplyAlpha),r.pixelStorei(3317,S.unpackAlignment),r.pixelStorei(37443,0);let ne=S&&(S.isCompressedTexture||S.image[0].isCompressedTexture),ve=S.image[0]&&S.image[0].isDataTexture,Re=[];for(let re=0;re<6;re++)!ne&&!ve?Re[re]=y(S.image[re],!1,!0,c):Re[re]=ve?S.image[re].image:S.image[re];let Ye=Re[0],ke=m(Ye)||a,I=s.convert(S.format),fe=s.convert(S.type),me=C(S.internalFormat,I,fe);we(34067,S,ke);let De;if(ne){for(let re=0;re<6;re++){De=Re[re].mipmaps;for(let ze=0;ze<De.length;ze++){let We=De[ze];S.format!==un&&S.format!==Pn?I!==null?t.compressedTexImage2D(34069+re,ze,me,We.width,We.height,0,We.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):t.texImage2D(34069+re,ze,me,We.width,We.height,0,I,fe,We.data)}}E.__maxMipLevel=De.length-1}else{De=S.mipmaps;for(let re=0;re<6;re++)if(ve){t.texImage2D(34069+re,0,me,Re[re].width,Re[re].height,0,I,fe,Re[re].data);for(let ze=0;ze<De.length;ze++){let mt=De[ze].image[re].image;t.texImage2D(34069+re,ze+1,me,mt.width,mt.height,0,I,fe,mt.data)}}else{t.texImage2D(34069+re,0,me,I,fe,Re[re]);for(let ze=0;ze<De.length;ze++){let We=De[ze];t.texImage2D(34069+re,ze+1,me,I,fe,We.image[re])}}E.__maxMipLevel=De.length}R(S,ke)&&A(34067,S,Ye.width,Ye.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function ee(E,S,j,ne){let ve=S.texture,Re=s.convert(ve.format),Ye=s.convert(ve.type),ke=C(ve.internalFormat,Re,Ye);ne===32879||ne===35866?t.texImage3D(ne,0,ke,S.width,S.height,S.depth,0,Re,Ye,null):t.texImage2D(ne,0,ke,S.width,S.height,0,Re,Ye,null),t.bindFramebuffer(36160,E),r.framebufferTexture2D(36160,j,ne,n.get(ve).__webglTexture,0),t.bindFramebuffer(36160,null)}function $(E,S,j){if(r.bindRenderbuffer(36161,E),S.depthBuffer&&!S.stencilBuffer){let ne=33189;if(j){let ve=S.depthTexture;ve&&ve.isDepthTexture&&(ve.type===$n?ne=36012:ve.type===no&&(ne=33190));let Re=v(S);r.renderbufferStorageMultisample(36161,Re,ne,S.width,S.height)}else r.renderbufferStorage(36161,ne,S.width,S.height);r.framebufferRenderbuffer(36160,36096,36161,E)}else if(S.depthBuffer&&S.stencilBuffer){if(j){let ne=v(S);r.renderbufferStorageMultisample(36161,ne,35056,S.width,S.height)}else r.renderbufferStorage(36161,34041,S.width,S.height);r.framebufferRenderbuffer(36160,33306,36161,E)}else{let ne=S.texture,ve=s.convert(ne.format),Re=s.convert(ne.type),Ye=C(ne.internalFormat,ve,Re);if(j){let ke=v(S);r.renderbufferStorageMultisample(36161,ke,Ye,S.width,S.height)}else r.renderbufferStorage(36161,Ye,S.width,S.height)}r.bindRenderbuffer(36161,null)}function ue(E,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(36160,E),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),z(S.depthTexture,0);let ne=n.get(S.depthTexture).__webglTexture;if(S.depthTexture.format===Yi)r.framebufferTexture2D(36160,36096,3553,ne,0);else if(S.depthTexture.format===Xr)r.framebufferTexture2D(36160,33306,3553,ne,0);else throw new Error("Unknown depthTexture format")}function Se(E){let S=n.get(E),j=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture){if(j)throw new Error("target.depthTexture not supported in Cube render targets");ue(S.__webglFramebuffer,E)}else if(j){S.__webglDepthbuffer=[];for(let ne=0;ne<6;ne++)t.bindFramebuffer(36160,S.__webglFramebuffer[ne]),S.__webglDepthbuffer[ne]=r.createRenderbuffer(),$(S.__webglDepthbuffer[ne],E,!1)}else t.bindFramebuffer(36160,S.__webglFramebuffer),S.__webglDepthbuffer=r.createRenderbuffer(),$(S.__webglDepthbuffer,E,!1);t.bindFramebuffer(36160,null)}function he(E){let S=E.texture,j=n.get(E),ne=n.get(S);E.addEventListener("dispose",B),ne.__webglTexture=r.createTexture(),ne.__version=S.version,o.memory.textures++;let ve=E.isWebGLCubeRenderTarget===!0,Re=E.isWebGLMultisampleRenderTarget===!0,Ye=S.isDataTexture3D||S.isDataTexture2DArray,ke=m(E)||a;if(a&&S.format===Pn&&(S.type===$n||S.type===so)&&(S.format=un,console.warn("THREE.WebGLRenderer: Rendering to textures with RGB format is not supported. Using RGBA format instead.")),ve){j.__webglFramebuffer=[];for(let I=0;I<6;I++)j.__webglFramebuffer[I]=r.createFramebuffer()}else if(j.__webglFramebuffer=r.createFramebuffer(),Re)if(a){j.__webglMultisampledFramebuffer=r.createFramebuffer(),j.__webglColorRenderbuffer=r.createRenderbuffer(),r.bindRenderbuffer(36161,j.__webglColorRenderbuffer);let I=s.convert(S.format),fe=s.convert(S.type),me=C(S.internalFormat,I,fe),De=v(E);r.renderbufferStorageMultisample(36161,De,me,E.width,E.height),t.bindFramebuffer(36160,j.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(36160,36064,36161,j.__webglColorRenderbuffer),r.bindRenderbuffer(36161,null),E.depthBuffer&&(j.__webglDepthRenderbuffer=r.createRenderbuffer(),$(j.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(36160,null)}else console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.");if(ve){t.bindTexture(34067,ne.__webglTexture),we(34067,S,ke);for(let I=0;I<6;I++)ee(j.__webglFramebuffer[I],E,36064,34069+I);R(S,ke)&&A(34067,S,E.width,E.height),t.bindTexture(34067,null)}else{let I=3553;Ye&&(a?I=S.isDataTexture3D?32879:35866:console.warn("THREE.DataTexture3D and THREE.DataTexture2DArray only supported with WebGL2.")),t.bindTexture(I,ne.__webglTexture),we(I,S,ke),ee(j.__webglFramebuffer,E,36064,I),R(S,ke)&&A(3553,S,E.width,E.height),t.bindTexture(3553,null)}E.depthBuffer&&Se(E)}function be(E){let S=E.texture,j=m(E)||a;if(R(S,j)){let ne=E.isWebGLCubeRenderTarget?34067:3553,ve=n.get(S).__webglTexture;t.bindTexture(ne,ve),A(ne,S,E.width,E.height),t.bindTexture(ne,null)}}function le(E){if(E.isWebGLMultisampleRenderTarget)if(a){let S=E.width,j=E.height,ne=16384;E.depthBuffer&&(ne|=256),E.stencilBuffer&&(ne|=1024);let ve=n.get(E);t.bindFramebuffer(36008,ve.__webglMultisampledFramebuffer),t.bindFramebuffer(36009,ve.__webglFramebuffer),r.blitFramebuffer(0,0,S,j,0,0,S,j,ne,9728),t.bindFramebuffer(36008,null),t.bindFramebuffer(36009,ve.__webglMultisampledFramebuffer)}else console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.")}function v(E){return a&&E.isWebGLMultisampleRenderTarget?Math.min(h,E.samples):0}function Z(E){let S=o.render.frame;d.get(E)!==S&&(d.set(E,S),E.update())}let ie=!1,ae=!1;function Ee(E,S){E&&E.isWebGLRenderTarget&&(ie===!1&&(console.warn("THREE.WebGLTextures.safeSetTexture2D: don't use render targets as textures. Use their .texture property instead."),ie=!0),E=E.texture),z(E,S)}function de(E,S){E&&E.isWebGLCubeRenderTarget&&(ae===!1&&(console.warn("THREE.WebGLTextures.safeSetTextureCube: don't use cube render targets as textures. Use their .texture property instead."),ae=!0),E=E.texture),te(E,S)}this.allocateTextureUnit=D,this.resetTextureUnits=q,this.setTexture2D=z,this.setTexture2DArray=N,this.setTexture3D=P,this.setTextureCube=te,this.setupRenderTarget=he,this.updateRenderTargetMipmap=be,this.updateMultisampleRenderTarget=le,this.safeSetTexture2D=Ee,this.safeSetTextureCube=de}function lv(r,e,t){let n=t.isWebGL2;function i(s){let o;if(s===ac)return 5121;if(s===Vd)return 32819;if(s===Wd)return 32820;if(s===qd)return 33635;if(s===kd)return 5120;if(s===Hd)return 5122;if(s===ro)return 5123;if(s===Gd)return 5124;if(s===no)return 5125;if(s===$n)return 5126;if(s===so)return n?5131:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(s===Xd)return 6406;if(s===Pn)return 6407;if(s===un)return 6408;if(s===Yd)return 6409;if(s===Zd)return 6410;if(s===Yi)return 6402;if(s===Xr)return 34041;if(s===Jd)return 6403;if(s===jd)return 36244;if(s===$d)return 33319;if(s===Kd)return 33320;if(s===Qd)return 36248;if(s===ef)return 36249;if(s===Xc||s===Yc||s===Zc||s===Jc)if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(s===Xc)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===Yc)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===Zc)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===Jc)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===jc||s===$c||s===Kc||s===Qc)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(s===jc)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===$c)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===Kc)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===Qc)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===tf)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if((s===eu||s===tu)&&(o=e.get("WEBGL_compressed_texture_etc"),o!==null)){if(s===eu)return o.COMPRESSED_RGB8_ETC2;if(s===tu)return o.COMPRESSED_RGBA8_ETC2_EAC}if(s===nf||s===rf||s===sf||s===of||s===af||s===lf||s===cf||s===uf||s===hf||s===df||s===ff||s===pf||s===mf||s===gf||s===xf||s===yf||s===_f||s===wf||s===bf||s===Mf||s===Sf||s===Tf||s===Ef||s===Af||s===Lf||s===Rf||s===Cf||s===Pf)return o=e.get("WEBGL_compressed_texture_astc"),o!==null?s:null;if(s===vf)return o=e.get("EXT_texture_compression_bptc"),o!==null?s:null;if(s===Ur)return n?34042:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null)}return{convert:i}}var xo=class extends Tt{constructor(e=[]){super(),this.cameras=e}};xo.prototype.isArrayCamera=!0;var lt=class extends nt{constructor(){super(),this.type="Group"}};lt.prototype.isGroup=!0;var cv={type:"move"},Or=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new lt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new lt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new M,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new M),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new lt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new M,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new M),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,s=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred")if(a!==null&&(i=t.getPose(e.targetRaySpace,n),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(cv))),c&&e.hand){o=!0;for(let x of e.hand.values()){let y=t.getJointPose(x,n);if(c.joints[x.jointName]===void 0){let p=new lt;p.matrixAutoUpdate=!1,p.visible=!1,c.joints[x.jointName]=p,c.add(p)}let m=c.joints[x.jointName];y!==null&&(m.matrix.fromArray(y.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.jointRadius=y.radius),m.visible=y!==null}let u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));return a!==null&&(a.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}},ja=class extends Fn{constructor(e,t){super();let n=this,i=e.state,s=null,o=1,a=null,l="local-floor",c=null,u=[],h=new Map,d=new Tt;d.layers.enable(1),d.viewport=new Je;let f=new Tt;f.layers.enable(2),f.viewport=new Je;let g=[d,f],x=new xo;x.layers.enable(1),x.layers.enable(2);let y=null,m=null;this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let D=u[q];return D===void 0&&(D=new Or,u[q]=D),D.getTargetRaySpace()},this.getControllerGrip=function(q){let D=u[q];return D===void 0&&(D=new Or,u[q]=D),D.getGripSpace()},this.getHand=function(q){let D=u[q];return D===void 0&&(D=new Or,u[q]=D),D.getHandSpace()};function p(q){let D=h.get(q.inputSource);D&&D.dispatchEvent({type:q.type,data:q.inputSource})}function R(){h.forEach(function(q,D){q.disconnect(D)}),h.clear(),y=null,m=null,i.bindXRFramebuffer(null),e.setRenderTarget(e.getRenderTarget()),K.stop(),n.isPresenting=!1,n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){o=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){l=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return a},this.getSession=function(){return s},this.setSession=async function(q){if(s=q,s!==null){s.addEventListener("select",p),s.addEventListener("selectstart",p),s.addEventListener("selectend",p),s.addEventListener("squeeze",p),s.addEventListener("squeezestart",p),s.addEventListener("squeezeend",p),s.addEventListener("end",R),s.addEventListener("inputsourceschange",A);let D=t.getContextAttributes();D.xrCompatible!==!0&&await t.makeXRCompatible();let z={antialias:D.antialias,alpha:D.alpha,depth:D.depth,stencil:D.stencil,framebufferScaleFactor:o},N=new XRWebGLLayer(s,t,z);s.updateRenderState({baseLayer:N}),a=await s.requestReferenceSpace(l),K.setContext(s),K.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}};function A(q){let D=s.inputSources;for(let z=0;z<u.length;z++)h.set(D[z],u[z]);for(let z=0;z<q.removed.length;z++){let N=q.removed[z],P=h.get(N);P&&(P.dispatchEvent({type:"disconnected",data:N}),h.delete(N))}for(let z=0;z<q.added.length;z++){let N=q.added[z],P=h.get(N);P&&P.dispatchEvent({type:"connected",data:N})}}let C=new M,w=new M;function F(q,D,z){C.setFromMatrixPosition(D.matrixWorld),w.setFromMatrixPosition(z.matrixWorld);let N=C.distanceTo(w),P=D.projectionMatrix.elements,te=z.projectionMatrix.elements,ce=P[14]/(P[10]-1),oe=P[14]/(P[10]+1),we=(P[9]+1)/P[5],pe=(P[9]-1)/P[5],Ce=(P[8]-1)/P[0],Fe=(te[8]+1)/te[0],ee=ce*Ce,$=ce*Fe,ue=N/(-Ce+Fe),Se=ue*-Ce;D.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(Se),q.translateZ(ue),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert();let he=ce+ue,be=oe+ue,le=ee-Se,v=$+(N-Se),Z=we*oe/be*he,ie=pe*oe/be*he;q.projectionMatrix.makePerspective(le,v,Z,ie,he,be)}function B(q,D){D===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(D.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.getCamera=function(q){x.near=f.near=d.near=q.near,x.far=f.far=d.far=q.far,(y!==x.near||m!==x.far)&&(s.updateRenderState({depthNear:x.near,depthFar:x.far}),y=x.near,m=x.far);let D=q.parent,z=x.cameras;B(x,D);for(let P=0;P<z.length;P++)B(z[P],D);q.matrixWorld.copy(x.matrixWorld),q.matrix.copy(x.matrix),q.matrix.decompose(q.position,q.quaternion,q.scale);let N=q.children;for(let P=0,te=N.length;P<te;P++)N[P].updateMatrixWorld(!0);return z.length===2?F(x,d,f):x.projectionMatrix.copy(d.projectionMatrix),x};let O=null;function H(q,D){if(c=D.getViewerPose(a),c!==null){let N=c.views,P=s.renderState.baseLayer;i.bindXRFramebuffer(P.framebuffer);let te=!1;N.length!==x.cameras.length&&(x.cameras.length=0,te=!0);for(let ce=0;ce<N.length;ce++){let oe=N[ce],we=P.getViewport(oe),pe=g[ce];pe.matrix.fromArray(oe.transform.matrix),pe.projectionMatrix.fromArray(oe.projectionMatrix),pe.viewport.set(we.x,we.y,we.width,we.height),ce===0&&x.matrix.copy(pe.matrix),te===!0&&x.cameras.push(pe)}}let z=s.inputSources;for(let N=0;N<u.length;N++){let P=u[N],te=z[N];P.update(te,D,a)}O&&O(q,D)}let K=new dh;K.setAnimationLoop(H),this.setAnimationLoop=function(q){O=q},this.dispose=function(){}}};function uv(r){function e(m,p){m.fogColor.value.copy(p.color),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function t(m,p,R,A){p.isMeshBasicMaterial?n(m,p):p.isMeshLambertMaterial?(n(m,p),l(m,p)):p.isMeshToonMaterial?(n(m,p),u(m,p)):p.isMeshPhongMaterial?(n(m,p),c(m,p)):p.isMeshStandardMaterial?(n(m,p),p.isMeshPhysicalMaterial?d(m,p):h(m,p)):p.isMeshMatcapMaterial?(n(m,p),f(m,p)):p.isMeshDepthMaterial?(n(m,p),g(m,p)):p.isMeshDistanceMaterial?(n(m,p),x(m,p)):p.isMeshNormalMaterial?(n(m,p),y(m,p)):p.isLineBasicMaterial?(i(m,p),p.isLineDashedMaterial&&s(m,p)):p.isPointsMaterial?o(m,p,R,A):p.isSpriteMaterial?a(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function n(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap),p.specularMap&&(m.specularMap.value=p.specularMap);let R=r.get(p).envMap;if(R){m.envMap.value=R,m.flipEnvMap.value=R.isCubeTexture&&R._needsFlipEnvMap?-1:1,m.reflectivity.value=p.reflectivity,m.refractionRatio.value=p.refractionRatio;let w=r.get(R).__maxMipLevel;w!==void 0&&(m.maxMipLevel.value=w)}p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity);let A;p.map?A=p.map:p.specularMap?A=p.specularMap:p.displacementMap?A=p.displacementMap:p.normalMap?A=p.normalMap:p.bumpMap?A=p.bumpMap:p.roughnessMap?A=p.roughnessMap:p.metalnessMap?A=p.metalnessMap:p.alphaMap?A=p.alphaMap:p.emissiveMap?A=p.emissiveMap:p.clearcoatMap?A=p.clearcoatMap:p.clearcoatNormalMap?A=p.clearcoatNormalMap:p.clearcoatRoughnessMap&&(A=p.clearcoatRoughnessMap),A!==void 0&&(A.isWebGLRenderTarget&&(A=A.texture),A.matrixAutoUpdate===!0&&A.updateMatrix(),m.uvTransform.value.copy(A.matrix));let C;p.aoMap?C=p.aoMap:p.lightMap&&(C=p.lightMap),C!==void 0&&(C.isWebGLRenderTarget&&(C=C.texture),C.matrixAutoUpdate===!0&&C.updateMatrix(),m.uv2Transform.value.copy(C.matrix))}function i(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity}function s(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function o(m,p,R,A){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*R,m.scale.value=A*.5,p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap);let C;p.map?C=p.map:p.alphaMap&&(C=p.alphaMap),C!==void 0&&(C.matrixAutoUpdate===!0&&C.updateMatrix(),m.uvTransform.value.copy(C.matrix))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map),p.alphaMap&&(m.alphaMap.value=p.alphaMap);let R;p.map?R=p.map:p.alphaMap&&(R=p.alphaMap),R!==void 0&&(R.matrixAutoUpdate===!0&&R.updateMatrix(),m.uvTransform.value.copy(R.matrix))}function l(m,p){p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap)}function c(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function h(m,p){m.roughness.value=p.roughness,m.metalness.value=p.metalness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap),p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),r.get(p).envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function d(m,p){h(m,p),m.reflectivity.value=p.reflectivity,m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.sheen&&m.sheen.value.copy(p.sheen),p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap),p.clearcoatNormalMap&&(m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),m.clearcoatNormalMap.value=p.clearcoatNormalMap,p.side===yt&&m.clearcoatNormalScale.value.negate()),m.transmission.value=p.transmission,p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap)}function f(m,p){p.matcap&&(m.matcap.value=p.matcap),p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function g(m,p){p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}function x(m,p){p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),m.referencePosition.value.copy(p.referencePosition),m.nearDistance.value=p.nearDistance,m.farDistance.value=p.farDistance}function y(m,p){p.bumpMap&&(m.bumpMap.value=p.bumpMap,m.bumpScale.value=p.bumpScale,p.side===yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,m.normalScale.value.copy(p.normalScale),p.side===yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias)}return{refreshFogUniforms:e,refreshMaterialUniforms:t}}function hv(){let r=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");return r.style.display="block",r}function it(r){r=r||{};let e=r.canvas!==void 0?r.canvas:hv(),t=r.context!==void 0?r.context:null,n=r.alpha!==void 0?r.alpha:!1,i=r.depth!==void 0?r.depth:!0,s=r.stencil!==void 0?r.stencil:!0,o=r.antialias!==void 0?r.antialias:!1,a=r.premultipliedAlpha!==void 0?r.premultipliedAlpha:!0,l=r.preserveDrawingBuffer!==void 0?r.preserveDrawingBuffer:!1,c=r.powerPreference!==void 0?r.powerPreference:"default",u=r.failIfMajorPerformanceCaveat!==void 0?r.failIfMajorPerformanceCaveat:!1,h=null,d=null,f=[],g=[];this.domElement=e,this.debug={checkShaderErrors:!0},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.gammaFactor=2,this.outputEncoding=ur,this.physicallyCorrectLights=!1,this.toneMapping=Nr,this.toneMappingExposure=1;let x=this,y=!1,m=0,p=0,R=null,A=-1,C=null,w=new Je,F=new Je,B=null,O=e.width,H=e.height,K=1,q=null,D=null,z=new Je(0,0,O,H),N=new Je(0,0,O,H),P=!1,te=new Ki,ce=!1,oe=!1,we=new Ie,pe=new M,Ce={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Fe(){return R===null?K:1}let ee=t;function $(b,X){for(let k=0;k<b.length;k++){let Q=b[k],ye=e.getContext(Q,X);if(ye!==null)return ye}return null}try{let b={alpha:n,depth:i,stencil:s,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:u};if(e.addEventListener("webglcontextlost",ze,!1),e.addEventListener("webglcontextrestored",We,!1),ee===null){let X=["webgl2","webgl","experimental-webgl"];if(x.isWebGL1Renderer===!0&&X.shift(),ee=$(X,b),ee===null)throw $(X)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}ee.getShaderPrecisionFormat===void 0&&(ee.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(b){throw console.error("THREE.WebGLRenderer: "+b.message),b}let ue,Se,he,be,le,v,Z,ie,ae,Ee,de,E,S,j,ne,ve,Re,Ye,ke,I,fe,me;function De(){ue=new Ig(ee),Se=new Pg(ee,ue,r),ue.init(Se),fe=new lv(ee,ue,Se),he=new ov(ee,ue,Se),be=new Ng(ee),le=new Z0,v=new av(ee,ue,he,le,Se,fe,be),Z=new Fg(x),ie=new op(ee,Se),me=new Rg(ee,ue,ie,Se),ae=new zg(ee,ie,be,me),Ee=new Hg(ee,ae,ie,be),Ye=new kg(ee),ne=new Dg(le),de=new Y0(x,Z,ue,Se,me,ne),E=new uv(le),S=new $0(le),j=new iv(ue,Se),Re=new Lg(x,Z,he,Ee,a),ve=new _h(x,Ee,Se),ke=new Cg(ee,ue,be,Se),I=new Bg(ee,ue,be,Se),be.programs=de.programs,x.capabilities=Se,x.extensions=ue,x.properties=le,x.renderLists=S,x.shadowMap=ve,x.state=he,x.info=be}De();let re=new ja(x,ee);this.xr=re,this.getContext=function(){return ee},this.getContextAttributes=function(){return ee.getContextAttributes()},this.forceContextLoss=function(){let b=ue.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=ue.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return K},this.setPixelRatio=function(b){b!==void 0&&(K=b,this.setSize(O,H,!1))},this.getSize=function(b){return b===void 0&&(console.warn("WebGLRenderer: .getsize() now requires a Vector2 as an argument"),b=new se),b.set(O,H)},this.setSize=function(b,X,k){if(re.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}O=b,H=X,e.width=Math.floor(b*K),e.height=Math.floor(X*K),k!==!1&&(e.style.width=b+"px",e.style.height=X+"px"),this.setViewport(0,0,b,X)},this.getDrawingBufferSize=function(b){return b===void 0&&(console.warn("WebGLRenderer: .getdrawingBufferSize() now requires a Vector2 as an argument"),b=new se),b.set(O*K,H*K).floor()},this.setDrawingBufferSize=function(b,X,k){O=b,H=X,K=k,e.width=Math.floor(b*k),e.height=Math.floor(X*k),this.setViewport(0,0,b,X)},this.getCurrentViewport=function(b){return b===void 0&&(console.warn("WebGLRenderer: .getCurrentViewport() now requires a Vector4 as an argument"),b=new Je),b.copy(w)},this.getViewport=function(b){return b.copy(z)},this.setViewport=function(b,X,k,Q){b.isVector4?z.set(b.x,b.y,b.z,b.w):z.set(b,X,k,Q),he.viewport(w.copy(z).multiplyScalar(K).floor())},this.getScissor=function(b){return b.copy(N)},this.setScissor=function(b,X,k,Q){b.isVector4?N.set(b.x,b.y,b.z,b.w):N.set(b,X,k,Q),he.scissor(F.copy(N).multiplyScalar(K).floor())},this.getScissorTest=function(){return P},this.setScissorTest=function(b){he.setScissorTest(P=b)},this.setOpaqueSort=function(b){q=b},this.setTransparentSort=function(b){D=b},this.getClearColor=function(b){return b===void 0&&(console.warn("WebGLRenderer: .getClearColor() now requires a Color as an argument"),b=new ge),b.copy(Re.getClearColor())},this.setClearColor=function(){Re.setClearColor.apply(Re,arguments)},this.getClearAlpha=function(){return Re.getClearAlpha()},this.setClearAlpha=function(){Re.setClearAlpha.apply(Re,arguments)},this.clear=function(b,X,k){let Q=0;(b===void 0||b)&&(Q|=16384),(X===void 0||X)&&(Q|=256),(k===void 0||k)&&(Q|=1024),ee.clear(Q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",ze,!1),e.removeEventListener("webglcontextrestored",We,!1),S.dispose(),j.dispose(),le.dispose(),Z.dispose(),Ee.dispose(),me.dispose(),re.dispose(),re.removeEventListener("sessionstart",ms),re.removeEventListener("sessionend",mr),Jt.stop()};function ze(b){b.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),y=!0}function We(){console.log("THREE.WebGLRenderer: Context Restored."),y=!1;let b=be.autoReset,X=ve.enabled,k=ve.autoUpdate,Q=ve.needsUpdate,ye=ve.type;De(),be.autoReset=b,ve.enabled=X,ve.autoUpdate=k,ve.needsUpdate=Q,ve.type=ye}function mt(b){let X=b.target;X.removeEventListener("dispose",mt),Sn(X)}function Sn(b){ut(b),le.remove(b)}function ut(b){let X=le.get(b).programs;X!==void 0&&X.forEach(function(k){de.releaseProgram(k)})}function tn(b,X){b.render(function(k){x.renderBufferImmediate(k,X)})}this.renderBufferImmediate=function(b,X){me.initAttributes();let k=le.get(b);b.hasPositions&&!k.position&&(k.position=ee.createBuffer()),b.hasNormals&&!k.normal&&(k.normal=ee.createBuffer()),b.hasUvs&&!k.uv&&(k.uv=ee.createBuffer()),b.hasColors&&!k.color&&(k.color=ee.createBuffer());let Q=X.getAttributes();b.hasPositions&&(ee.bindBuffer(34962,k.position),ee.bufferData(34962,b.positionArray,35048),me.enableAttribute(Q.position),ee.vertexAttribPointer(Q.position,3,5126,!1,0,0)),b.hasNormals&&(ee.bindBuffer(34962,k.normal),ee.bufferData(34962,b.normalArray,35048),me.enableAttribute(Q.normal),ee.vertexAttribPointer(Q.normal,3,5126,!1,0,0)),b.hasUvs&&(ee.bindBuffer(34962,k.uv),ee.bufferData(34962,b.uvArray,35048),me.enableAttribute(Q.uv),ee.vertexAttribPointer(Q.uv,2,5126,!1,0,0)),b.hasColors&&(ee.bindBuffer(34962,k.color),ee.bufferData(34962,b.colorArray,35048),me.enableAttribute(Q.color),ee.vertexAttribPointer(Q.color,3,5126,!1,0,0)),me.disableUnusedAttributes(),ee.drawArrays(4,0,b.count),b.count=0},this.renderBufferDirect=function(b,X,k,Q,ye,Be){X===null&&(X=Ce);let Ue=ye.isMesh&&ye.matrixWorld.determinant()<0,Oe=Un(b,X,Q,ye);he.setMaterial(Q,Ue);let et=k.index,He=k.attributes.position;if(et===null){if(He===void 0||He.count===0)return}else if(et.count===0)return;let Ze=1;Q.wireframe===!0&&(et=ae.getWireframeAttribute(k),Ze=2),(Q.morphTargets||Q.morphNormals)&&Ye.update(ye,k,Q,Oe),me.setup(ye,Q,Oe,k,et);let Ne,_=ke;et!==null&&(Ne=ie.get(et),_=I,_.setIndex(Ne));let T=et!==null?et.count:He.count,G=k.drawRange.start*Ze,U=k.drawRange.count*Ze,V=Be!==null?Be.start*Ze:0,Y=Be!==null?Be.count*Ze:1/0,W=Math.max(G,V),Me=Math.min(T,G+U,V+Y)-1,xe=Math.max(0,Me-W+1);if(xe!==0){if(ye.isMesh)Q.wireframe===!0?(he.setLineWidth(Q.wireframeLinewidth*Fe()),_.setMode(1)):_.setMode(4);else if(ye.isLine){let Ge=Q.linewidth;Ge===void 0&&(Ge=1),he.setLineWidth(Ge*Fe()),ye.isLineSegments?_.setMode(1):ye.isLineLoop?_.setMode(2):_.setMode(3)}else ye.isPoints?_.setMode(0):ye.isSprite&&_.setMode(4);if(ye.isInstancedMesh)_.renderInstances(W,xe,ye.count);else if(k.isInstancedBufferGeometry){let Ge=Math.min(k.instanceCount,k._maxInstanceCount);_.renderInstances(W,xe,Ge)}else _.render(W,xe)}},this.compile=function(b,X){d=j.get(b),d.init(),b.traverseVisible(function(k){k.isLight&&k.layers.test(X.layers)&&(d.pushLight(k),k.castShadow&&d.pushShadow(k))}),d.setupLights(),b.traverse(function(k){let Q=k.material;if(Q)if(Array.isArray(Q))for(let ye=0;ye<Q.length;ye++){let Be=Q[ye];Mi(Be,b,k)}else Mi(Q,b,k)})};let xt=null;function ai(b){xt&&xt(b)}function ms(){Jt.stop()}function mr(){Jt.start()}let Jt=new dh;Jt.setAnimationLoop(ai),typeof window!="undefined"&&Jt.setContext(window),this.setAnimationLoop=function(b){xt=b,re.setAnimationLoop(b),b===null?Jt.stop():Jt.start()},re.addEventListener("sessionstart",ms),re.addEventListener("sessionend",mr),this.render=function(b,X){let k,Q;if(arguments[2]!==void 0&&(console.warn("THREE.WebGLRenderer.render(): the renderTarget argument has been removed. Use .setRenderTarget() instead."),k=arguments[2]),arguments[3]!==void 0&&(console.warn("THREE.WebGLRenderer.render(): the forceClear argument has been removed. Use .clear() instead."),Q=arguments[3]),X!==void 0&&X.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(y===!0)return;b.autoUpdate===!0&&b.updateMatrixWorld(),X.parent===null&&X.updateMatrixWorld(),re.enabled===!0&&re.isPresenting===!0&&(X=re.getCamera(X)),b.isScene===!0&&b.onBeforeRender(x,b,X,k||R),d=j.get(b,g.length),d.init(),g.push(d),we.multiplyMatrices(X.projectionMatrix,X.matrixWorldInverse),te.setFromProjectionMatrix(we),oe=this.localClippingEnabled,ce=ne.init(this.clippingPlanes,oe,X),h=S.get(b,f.length),h.init(),f.push(h),Nn(b,X,0,x.sortObjects),h.finish(),x.sortObjects===!0&&h.sort(q,D),ce===!0&&ne.beginShadows();let ye=d.state.shadowsArray;ve.render(ye,b,X),d.setupLights(),d.setupLightsView(X),ce===!0&&ne.endShadows(),this.info.autoReset===!0&&this.info.reset(),k!==void 0&&this.setRenderTarget(k),Re.render(h,b,X,Q);let Be=h.opaque,Ue=h.transparent;Be.length>0&&gr(Be,b,X),Ue.length>0&&gr(Ue,b,X),R!==null&&(v.updateRenderTargetMipmap(R),v.updateMultisampleRenderTarget(R)),b.isScene===!0&&b.onAfterRender(x,b,X),he.buffers.depth.setTest(!0),he.buffers.depth.setMask(!0),he.buffers.color.setMask(!0),he.setPolygonOffset(!1),me.resetDefaultState(),A=-1,C=null,g.pop(),g.length>0?d=g[g.length-1]:d=null,f.pop(),f.length>0?h=f[f.length-1]:h=null};function Nn(b,X,k,Q){if(b.visible===!1)return;if(b.layers.test(X.layers)){if(b.isGroup)k=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(X);else if(b.isLight)d.pushLight(b),b.castShadow&&d.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||te.intersectsSprite(b)){Q&&pe.setFromMatrixPosition(b.matrixWorld).applyMatrix4(we);let Ue=Ee.update(b),Oe=b.material;Oe.visible&&h.push(b,Ue,Oe,k,pe.z,null)}}else if(b.isImmediateRenderObject)Q&&pe.setFromMatrixPosition(b.matrixWorld).applyMatrix4(we),h.push(b,null,b.material,k,pe.z,null);else if((b.isMesh||b.isLine||b.isPoints)&&(b.isSkinnedMesh&&b.skeleton.frame!==be.render.frame&&(b.skeleton.update(),b.skeleton.frame=be.render.frame),!b.frustumCulled||te.intersectsObject(b))){Q&&pe.setFromMatrixPosition(b.matrixWorld).applyMatrix4(we);let Ue=Ee.update(b),Oe=b.material;if(Array.isArray(Oe)){let et=Ue.groups;for(let He=0,Ze=et.length;He<Ze;He++){let Ne=et[He],_=Oe[Ne.materialIndex];_&&_.visible&&h.push(b,Ue,_,k,pe.z,Ne)}}else Oe.visible&&h.push(b,Ue,Oe,k,pe.z,null)}}let Be=b.children;for(let Ue=0,Oe=Be.length;Ue<Oe;Ue++)Nn(Be[Ue],X,k,Q)}function gr(b,X,k){let Q=X.isScene===!0?X.overrideMaterial:null;for(let ye=0,Be=b.length;ye<Be;ye++){let Ue=b[ye],Oe=Ue.object,et=Ue.geometry,He=Q===null?Ue.material:Q,Ze=Ue.group;if(k.isArrayCamera){let Ne=k.cameras;for(let _=0,T=Ne.length;_<T;_++){let G=Ne[_];Oe.layers.test(G.layers)&&(he.viewport(w.copy(G.viewport)),d.setupLightsView(G),vr(Oe,X,G,et,He,Ze))}}else vr(Oe,X,k,et,He,Ze)}}function vr(b,X,k,Q,ye,Be){if(b.onBeforeRender(x,X,k,Q,ye,Be),b.modelViewMatrix.multiplyMatrices(k.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),b.isImmediateRenderObject){let Ue=Un(k,X,ye,b);he.setMaterial(ye),me.reset(),tn(b,Ue)}else x.renderBufferDirect(k,X,Q,ye,b,Be);b.onAfterRender(x,X,k,Q,ye,Be)}function Mi(b,X,k){X.isScene!==!0&&(X=Ce);let Q=le.get(b),ye=d.state.lights,Be=d.state.shadowsArray,Ue=ye.state.version,Oe=de.getParameters(b,ye.state,Be,X,k),et=de.getProgramCacheKey(Oe),He=Q.programs;Q.environment=b.isMeshStandardMaterial?X.environment:null,Q.fog=X.fog,Q.envMap=Z.get(b.envMap||Q.environment),He===void 0&&(b.addEventListener("dispose",mt),He=new Map,Q.programs=He);let Ze=He.get(et);if(Ze!==void 0){if(Q.currentProgram===Ze&&Q.lightsStateVersion===Ue)return xr(b,Oe),Ze}else Oe.uniforms=de.getUniforms(b),b.onBuild(Oe,x),b.onBeforeCompile(Oe,x),Ze=de.acquireProgram(Oe,et),He.set(et,Ze),Q.uniforms=Oe.uniforms;let Ne=Q.uniforms;(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(Ne.clippingPlanes=ne.uniform),xr(b,Oe),Q.needsLights=yr(b),Q.lightsStateVersion=Ue,Q.needsLights&&(Ne.ambientLightColor.value=ye.state.ambient,Ne.lightProbe.value=ye.state.probe,Ne.directionalLights.value=ye.state.directional,Ne.directionalLightShadows.value=ye.state.directionalShadow,Ne.spotLights.value=ye.state.spot,Ne.spotLightShadows.value=ye.state.spotShadow,Ne.rectAreaLights.value=ye.state.rectArea,Ne.ltc_1.value=ye.state.rectAreaLTC1,Ne.ltc_2.value=ye.state.rectAreaLTC2,Ne.pointLights.value=ye.state.point,Ne.pointLightShadows.value=ye.state.pointShadow,Ne.hemisphereLights.value=ye.state.hemi,Ne.directionalShadowMap.value=ye.state.directionalShadowMap,Ne.directionalShadowMatrix.value=ye.state.directionalShadowMatrix,Ne.spotShadowMap.value=ye.state.spotShadowMap,Ne.spotShadowMatrix.value=ye.state.spotShadowMatrix,Ne.pointShadowMap.value=ye.state.pointShadowMap,Ne.pointShadowMatrix.value=ye.state.pointShadowMatrix);let _=Ze.getUniforms(),T=Kn.seqWithValue(_.seq,Ne);return Q.currentProgram=Ze,Q.uniformsList=T,Ze}function xr(b,X){let k=le.get(b);k.outputEncoding=X.outputEncoding,k.instancing=X.instancing,k.numClippingPlanes=X.numClippingPlanes,k.numIntersection=X.numClipIntersection,k.vertexAlphas=X.vertexAlphas}function Un(b,X,k,Q){X.isScene!==!0&&(X=Ce),v.resetTextureUnits();let ye=X.fog,Be=k.isMeshStandardMaterial?X.environment:null,Ue=R===null?x.outputEncoding:R.texture.encoding,Oe=Z.get(k.envMap||Be),et=k.vertexColors===!0&&Q.geometry&&Q.geometry.attributes.color&&Q.geometry.attributes.color.itemSize===4,He=le.get(k),Ze=d.state.lights;if(ce===!0&&(oe===!0||b!==C)){let W=b===C&&k.id===A;ne.setState(k,b,W)}let Ne=!1;k.version===He.__version?(He.needsLights&&He.lightsStateVersion!==Ze.state.version||He.outputEncoding!==Ue||Q.isInstancedMesh&&He.instancing===!1||!Q.isInstancedMesh&&He.instancing===!0||He.envMap!==Oe||k.fog&&He.fog!==ye||He.numClippingPlanes!==void 0&&(He.numClippingPlanes!==ne.numPlanes||He.numIntersection!==ne.numIntersection)||He.vertexAlphas!==et)&&(Ne=!0):(Ne=!0,He.__version=k.version);let _=He.currentProgram;Ne===!0&&(_=Mi(k,X,Q));let T=!1,G=!1,U=!1,V=_.getUniforms(),Y=He.uniforms;if(he.useProgram(_.program)&&(T=!0,G=!0,U=!0),k.id!==A&&(A=k.id,G=!0),T||C!==b){if(V.setValue(ee,"projectionMatrix",b.projectionMatrix),Se.logarithmicDepthBuffer&&V.setValue(ee,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),C!==b&&(C=b,G=!0,U=!0),k.isShaderMaterial||k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshStandardMaterial||k.envMap){let W=V.map.cameraPosition;W!==void 0&&W.setValue(ee,pe.setFromMatrixPosition(b.matrixWorld))}(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&V.setValue(ee,"isOrthographic",b.isOrthographicCamera===!0),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial||k.isShadowMaterial||k.skinning)&&V.setValue(ee,"viewMatrix",b.matrixWorldInverse)}if(k.skinning){V.setOptional(ee,Q,"bindMatrix"),V.setOptional(ee,Q,"bindMatrixInverse");let W=Q.skeleton;if(W){let Me=W.bones;if(Se.floatVertexTextures){if(W.boneTexture===null){let xe=Math.sqrt(Me.length*4);xe=Gf(xe),xe=Math.max(xe,4);let Ge=new Float32Array(xe*xe*4);Ge.set(W.boneMatrices);let J=new $i(Ge,xe,xe,un,$n);W.boneMatrices=Ge,W.boneTexture=J,W.boneTextureSize=xe}V.setValue(ee,"boneTexture",W.boneTexture,v),V.setValue(ee,"boneTextureSize",W.boneTextureSize)}else V.setOptional(ee,W,"boneMatrices")}}return(G||He.receiveShadow!==Q.receiveShadow)&&(He.receiveShadow=Q.receiveShadow,V.setValue(ee,"receiveShadow",Q.receiveShadow)),G&&(V.setValue(ee,"toneMappingExposure",x.toneMappingExposure),He.needsLights&&gs(Y,U),ye&&k.fog&&E.refreshFogUniforms(Y,ye),E.refreshMaterialUniforms(Y,k,K,H),Kn.upload(ee,He.uniformsList,Y,v)),k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(Kn.upload(ee,He.uniformsList,Y,v),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&V.setValue(ee,"center",Q.center),V.setValue(ee,"modelViewMatrix",Q.modelViewMatrix),V.setValue(ee,"normalMatrix",Q.normalMatrix),V.setValue(ee,"modelMatrix",Q.matrixWorld),_}function gs(b,X){b.ambientLightColor.needsUpdate=X,b.lightProbe.needsUpdate=X,b.directionalLights.needsUpdate=X,b.directionalLightShadows.needsUpdate=X,b.pointLights.needsUpdate=X,b.pointLightShadows.needsUpdate=X,b.spotLights.needsUpdate=X,b.spotLightShadows.needsUpdate=X,b.rectAreaLights.needsUpdate=X,b.hemisphereLights.needsUpdate=X}function yr(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return m},this.getActiveMipmapLevel=function(){return p},this.getRenderTarget=function(){return R},this.setRenderTarget=function(b,X=0,k=0){R=b,m=X,p=k,b&&le.get(b).__webglFramebuffer===void 0&&v.setupRenderTarget(b);let Q=null,ye=!1,Be=!1;if(b){let Ue=b.texture;(Ue.isDataTexture3D||Ue.isDataTexture2DArray)&&(Be=!0);let Oe=le.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Q=Oe[X],ye=!0):b.isWebGLMultisampleRenderTarget?Q=le.get(b).__webglMultisampledFramebuffer:Q=Oe,w.copy(b.viewport),F.copy(b.scissor),B=b.scissorTest}else w.copy(z).multiplyScalar(K).floor(),F.copy(N).multiplyScalar(K).floor(),B=P;if(he.bindFramebuffer(36160,Q),he.viewport(w),he.scissor(F),he.setScissorTest(B),ye){let Ue=le.get(b.texture);ee.framebufferTexture2D(36160,36064,34069+X,Ue.__webglTexture,k)}else if(Be){let Ue=le.get(b.texture),Oe=X||0;ee.framebufferTextureLayer(36160,36064,Ue.__webglTexture,k||0,Oe)}},this.readRenderTargetPixels=function(b,X,k,Q,ye,Be,Ue){if(!(b&&b.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Oe=le.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&Ue!==void 0&&(Oe=Oe[Ue]),Oe){he.bindFramebuffer(36160,Oe);try{let et=b.texture,He=et.format,Ze=et.type;if(He!==un&&fe.convert(He)!==ee.getParameter(35739)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}let Ne=Ze===so&&(ue.has("EXT_color_buffer_half_float")||Se.isWebGL2&&ue.has("EXT_color_buffer_float"));if(Ze!==ac&&fe.convert(Ze)!==ee.getParameter(35738)&&!(Ze===$n&&(Se.isWebGL2||ue.has("OES_texture_float")||ue.has("WEBGL_color_buffer_float")))&&!Ne){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}ee.checkFramebufferStatus(36160)===36053?X>=0&&X<=b.width-Q&&k>=0&&k<=b.height-ye&&ee.readPixels(X,k,Q,ye,fe.convert(He),fe.convert(Ze),Be):console.error("THREE.WebGLRenderer.readRenderTargetPixels: readPixels from renderTarget failed. Framebuffer not complete.")}finally{let et=R!==null?le.get(R).__webglFramebuffer:null;he.bindFramebuffer(36160,et)}}},this.copyFramebufferToTexture=function(b,X,k=0){let Q=Math.pow(2,-k),ye=Math.floor(X.image.width*Q),Be=Math.floor(X.image.height*Q),Ue=fe.convert(X.format);v.setTexture2D(X,0),ee.copyTexImage2D(3553,k,Ue,b.x,b.y,ye,Be,0),he.unbindTexture()},this.copyTextureToTexture=function(b,X,k,Q=0){let ye=X.image.width,Be=X.image.height,Ue=fe.convert(k.format),Oe=fe.convert(k.type);v.setTexture2D(k,0),ee.pixelStorei(37440,k.flipY),ee.pixelStorei(37441,k.premultiplyAlpha),ee.pixelStorei(3317,k.unpackAlignment),X.isDataTexture?ee.texSubImage2D(3553,Q,b.x,b.y,ye,Be,Ue,Oe,X.image.data):X.isCompressedTexture?ee.compressedTexSubImage2D(3553,Q,b.x,b.y,X.mipmaps[0].width,X.mipmaps[0].height,Ue,X.mipmaps[0].data):ee.texSubImage2D(3553,Q,b.x,b.y,Ue,Oe,X.image),Q===0&&k.generateMipmaps&&ee.generateMipmap(3553),he.unbindTexture()},this.copyTextureToTexture3D=function(b,X,k,Q,ye=0){if(x.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}let{width:Be,height:Ue,data:Oe}=k.image,et=fe.convert(Q.format),He=fe.convert(Q.type),Ze;if(Q.isDataTexture3D)v.setTexture3D(Q,0),Ze=32879;else if(Q.isDataTexture2DArray)v.setTexture2DArray(Q,0),Ze=35866;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}ee.pixelStorei(37440,Q.flipY),ee.pixelStorei(37441,Q.premultiplyAlpha),ee.pixelStorei(3317,Q.unpackAlignment);let Ne=ee.getParameter(3314),_=ee.getParameter(32878),T=ee.getParameter(3316),G=ee.getParameter(3315),U=ee.getParameter(32877);ee.pixelStorei(3314,Be),ee.pixelStorei(32878,Ue),ee.pixelStorei(3316,b.min.x),ee.pixelStorei(3315,b.min.y),ee.pixelStorei(32877,b.min.z),ee.texSubImage3D(Ze,ye,X.x,X.y,X.z,b.max.x-b.min.x+1,b.max.y-b.min.y+1,b.max.z-b.min.z+1,et,He,Oe),ee.pixelStorei(3314,Ne),ee.pixelStorei(32878,_),ee.pixelStorei(3316,T),ee.pixelStorei(3315,G),ee.pixelStorei(32877,U),ye===0&&Q.generateMipmaps&&ee.generateMipmap(Ze),he.unbindTexture()},this.initTexture=function(b){v.setTexture2D(b,0),he.unbindTexture()},this.resetState=function(){m=0,p=0,R=null,he.reset(),me.reset()},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}var $a=class extends it{};$a.prototype.isWebGL1Renderer=!0;var Ka=class r{constructor(e,t=25e-5){this.name="",this.color=new ge(e),this.density=t}clone(){return new r(this.color,this.density)}toJSON(){return{type:"FogExp2",color:this.color.getHex(),density:this.density}}};Ka.prototype.isFogExp2=!0;var Qa=class r{constructor(e,t=1,n=1e3){this.name="",this.color=new ge(e),this.near=t,this.far=n}clone(){return new r(this.color,this.near,this.far)}toJSON(){return{type:"Fog",color:this.color.getHex(),near:this.near,far:this.far}}};Qa.prototype.isFog=!0;var gi=class extends nt{constructor(){super(),this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.overrideMaterial=null,this.autoUpdate=!0,typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.autoUpdate=e.autoUpdate,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.background!==null&&(t.object.background=this.background.toJSON(e)),this.environment!==null&&(t.object.environment=this.environment.toJSON(e)),this.fog!==null&&(t.object.fog=this.fog.toJSON()),t}};gi.prototype.isScene=!0;var vi=class r{constructor(e,t){this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Yr,this.updateRange={offset:0,count:-1},this.version=0,this.uuid=hn(),this.onUploadCallback=function(){}}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=hn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new r(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=hn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.prototype.slice.call(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}};vi.prototype.isInterleavedBuffer=!0;var vt=new M,Kr=class r{constructor(e,t,n,i){this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i===!0}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)vt.x=this.getX(t),vt.y=this.getY(t),vt.z=this.getZ(t),vt.applyMatrix4(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)vt.x=this.getX(t),vt.y=this.getY(t),vt.z=this.getZ(t),vt.applyNormalMatrix(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)vt.x=this.getX(t),vt.y=this.getY(t),vt.z=this.getZ(t),vt.transformDirection(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}setX(e,t){return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){return this.data.array[e*this.data.stride+this.offset]}getY(e){return this.data.array[e*this.data.stride+this.offset+1]}getZ(e){return this.data.array[e*this.data.stride+this.offset+2]}getW(e){return this.data.array[e*this.data.stride+this.offset+3]}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interlaved buffer attribute will deinterleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new ct(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new r(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interlaved buffer attribute will deinterleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}};Kr.prototype.isInterleavedBufferAttribute=!0;var Qi=class extends Mt{constructor(e){super(),this.type="SpriteMaterial",this.color=new ge(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this}};Qi.prototype.isSpriteMaterial=!0;var Oi,Lr=new M,ki=new M,Hi=new M,Gi=new se,Rr=new se,wh=new Ie,Vs=new M,Cr=new M,Ws=new M,Ru=new se,Na=new se,Cu=new se,Qr=class extends nt{constructor(e){if(super(),this.type="Sprite",Oi===void 0){Oi=new $e;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new vi(t,5);Oi.setIndex([0,1,2,0,2,3]),Oi.setAttribute("position",new Kr(n,3,0,!1)),Oi.setAttribute("uv",new Kr(n,2,3,!1))}this.geometry=Oi,this.material=e!==void 0?e:new Qi,this.center=new se(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ki.setFromMatrixScale(this.matrixWorld),wh.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Hi.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ki.multiplyScalar(-Hi.z);let n=this.material.rotation,i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));let o=this.center;qs(Vs.set(-.5,-.5,0),Hi,o,ki,i,s),qs(Cr.set(.5,-.5,0),Hi,o,ki,i,s),qs(Ws.set(.5,.5,0),Hi,o,ki,i,s),Ru.set(0,0),Na.set(1,0),Cu.set(1,1);let a=e.ray.intersectTriangle(Vs,Cr,Ws,!1,Lr);if(a===null&&(qs(Cr.set(-.5,.5,0),Hi,o,ki,i,s),Na.set(0,1),a=e.ray.intersectTriangle(Vs,Ws,Cr,!1,Lr),a===null))return;let l=e.ray.origin.distanceTo(Lr);l<e.near||l>e.far||t.push({distance:l,point:Lr.clone(),uv:Ct.getUV(Lr,Vs,Cr,Ws,Ru,Na,Cu,new se),face:null,object:this})}copy(e){return super.copy(e),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};Qr.prototype.isSprite=!0;function qs(r,e,t,n,i,s){Gi.subVectors(r,t).addScalar(.5).multiply(n),i!==void 0?(Rr.x=s*Gi.x-i*Gi.y,Rr.y=i*Gi.x+s*Gi.y):Rr.copy(Gi),r.copy(e),r.x+=Rr.x,r.y+=Rr.y,r.applyMatrix4(wh)}var Pu=new M,Du=new Je,Fu=new Je,dv=new M,Iu=new Ie,yo=class extends Xe{constructor(e,t){super(e,t),this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new Ie,this.bindMatrixInverse=new Ie}copy(e){return super.copy(e),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,this}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new Je,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.x=t.getX(n),e.y=t.getY(n),e.z=t.getZ(n),e.w=t.getW(n);let s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode==="attached"?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode==="detached"?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}boneTransform(e,t){let n=this.skeleton,i=this.geometry;Du.fromBufferAttribute(i.attributes.skinIndex,e),Fu.fromBufferAttribute(i.attributes.skinWeight,e),Pu.fromBufferAttribute(i.attributes.position,e).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){let o=Fu.getComponent(s);if(o!==0){let a=Du.getComponent(s);Iu.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(dv.copy(Pu).applyMatrix4(Iu),o)}}return t.applyMatrix4(this.bindMatrixInverse)}};yo.prototype.isSkinnedMesh=!0;var el=class extends nt{constructor(){super(),this.type="Bone"}};el.prototype.isBone=!0;var zu=new Ie,Bu=new Ie,Xs=[],Pr=new Xe,tl=class extends Xe{constructor(e,t,n){super(e,t),this.instanceMatrix=new ct(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.frustumCulled=!1}copy(e){return super.copy(e),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}raycast(e,t){let n=this.matrixWorld,i=this.count;if(Pr.geometry=this.geometry,Pr.material=this.material,Pr.material!==void 0)for(let s=0;s<i;s++){this.getMatrixAt(s,zu),Bu.multiplyMatrices(n,zu),Pr.matrixWorld=Bu,Pr.raycast(e,Xs);for(let o=0,a=Xs.length;o<a;o++){let l=Xs[o];l.instanceId=s,l.object=this,t.push(l)}Xs.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new ct(new Float32Array(this.count*3),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}};tl.prototype.isInstancedMesh=!0;var xi=class extends Mt{constructor(e){super(),this.type="LineBasicMaterial",this.color=new ge(16777215),this.linewidth=1,this.linecap="round",this.linejoin="round",this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.morphTargets=e.morphTargets,this}};xi.prototype.isLineBasicMaterial=!0;var Nu=new M,Uu=new M,Ou=new Ie,Ua=new ni,Ys=new ti,es=class extends nt{constructor(e=new $e,t=new xi){super(),this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),this.material=e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.isBufferGeometry)if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)Nu.fromBufferAttribute(t,i-1),Uu.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Nu.distanceTo(Uu);e.setAttribute("lineDistance",new Ke(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else e.isGeometry&&console.error("THREE.Line.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ys.copy(n.boundingSphere),Ys.applyMatrix4(i),Ys.radius+=s,e.ray.intersectsSphere(Ys)===!1)return;Ou.copy(i).invert(),Ua.copy(e.ray).applyMatrix4(Ou);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=new M,u=new M,h=new M,d=new M,f=this.isLineSegments?2:1;if(n.isBufferGeometry){let g=n.index,y=n.attributes.position;if(g!==null){let m=Math.max(0,o.start),p=Math.min(g.count,o.start+o.count);for(let R=m,A=p-1;R<A;R+=f){let C=g.getX(R),w=g.getX(R+1);if(c.fromBufferAttribute(y,C),u.fromBufferAttribute(y,w),Ua.distanceSqToSegment(c,u,d,h)>l)continue;d.applyMatrix4(this.matrixWorld);let B=e.ray.origin.distanceTo(d);B<e.near||B>e.far||t.push({distance:B,point:h.clone().applyMatrix4(this.matrixWorld),index:R,face:null,faceIndex:null,object:this})}}else{let m=Math.max(0,o.start),p=Math.min(y.count,o.start+o.count);for(let R=m,A=p-1;R<A;R+=f){if(c.fromBufferAttribute(y,R),u.fromBufferAttribute(y,R+1),Ua.distanceSqToSegment(c,u,d,h)>l)continue;d.applyMatrix4(this.matrixWorld);let w=e.ray.origin.distanceTo(d);w<e.near||w>e.far||t.push({distance:w,point:h.clone().applyMatrix4(this.matrixWorld),index:R,face:null,faceIndex:null,object:this})}}}else n.isGeometry&&console.error("THREE.Line.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Line.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.")}}};es.prototype.isLine=!0;var ku=new M,Hu=new M,ts=class extends es{constructor(e,t){super(e,t),this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.isBufferGeometry)if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)ku.fromBufferAttribute(t,i),Hu.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+ku.distanceTo(Hu);e.setAttribute("lineDistance",new Ke(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else e.isGeometry&&console.error("THREE.LineSegments.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");return this}};ts.prototype.isLineSegments=!0;var nl=class extends es{constructor(e,t){super(e,t),this.type="LineLoop"}};nl.prototype.isLineLoop=!0;var _o=class extends Mt{constructor(e){super(),this.type="PointsMaterial",this.color=new ge(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.morphTargets=e.morphTargets,this}};_o.prototype.isPointsMaterial=!0;var Gu=new Ie,il=new ni,Zs=new ti,Js=new M,ns=class extends nt{constructor(e=new $e,t=new _o){super(),this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e){return super.copy(e),this.material=e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Zs.copy(n.boundingSphere),Zs.applyMatrix4(i),Zs.radius+=s,e.ray.intersectsSphere(Zs)===!1)return;Gu.copy(i).invert(),il.copy(e.ray).applyMatrix4(Gu);let a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a;if(n.isBufferGeometry){let c=n.index,h=n.attributes.position;if(c!==null){let d=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=d,x=f;g<x;g++){let y=c.getX(g);Js.fromBufferAttribute(h,y),Vu(Js,y,l,i,e,t,this)}}else{let d=Math.max(0,o.start),f=Math.min(h.count,o.start+o.count);for(let g=d,x=f;g<x;g++)Js.fromBufferAttribute(h,g),Vu(Js,g,l,i,e,t,this)}}else console.error("THREE.Points.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.")}updateMorphTargets(){let e=this.geometry;if(e.isBufferGeometry){let t=e.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){let a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}else{let t=e.morphTargets;t!==void 0&&t.length>0&&console.error("THREE.Points.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.")}}};ns.prototype.isPoints=!0;function Vu(r,e,t,n,i,s,o){let a=il.distanceSqToPoint(r);if(a<t){let l=new M;il.closestPointToPoint(r,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,object:o})}}var rl=class extends Pt{constructor(e,t,n,i,s,o,a,l,c){super(e,t,n,i,s,o,a,l,c),this.format=a!==void 0?a:Pn,this.minFilter=o!==void 0?o:Rt,this.magFilter=s!==void 0?s:Rt,this.generateMipmaps=!1;let u=this;function h(){u.needsUpdate=!0,e.requestVideoFrameCallback(h)}"requestVideoFrameCallback"in e&&e.requestVideoFrameCallback(h)}clone(){return new this.constructor(this.image).copy(this)}update(){let e=this.image;"requestVideoFrameCallback"in e===!1&&e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}};rl.prototype.isVideoTexture=!0;var sl=class extends Pt{constructor(e,t,n,i,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,i,s,h,d),this.image={width:t,height:n},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}};sl.prototype.isCompressedTexture=!0;var In=class extends Pt{constructor(e,t,n,i,s,o,a,l,c){super(e,t,n,i,s,o,a,l,c),this.needsUpdate=!0}};In.prototype.isCanvasTexture=!0;var ol=class extends Pt{constructor(e,t,n,i,s,o,a,l,c,u){if(u=u!==void 0?u:Yi,u!==Yi&&u!==Xr)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===Yi&&(n=ro),n===void 0&&u===Xr&&(n=Ur),super(null,i,s,o,a,l,u,n,c),this.image={width:e,height:t},this.magFilter=a!==void 0?a:It,this.minFilter=l!==void 0?l:It,this.flipY=!1,this.generateMipmaps=!1}};ol.prototype.isDepthTexture=!0;var ii=class extends $e{constructor(e=1,t=8,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let s=[],o=[],a=[],l=[],c=new M,u=new se;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){let f=n+h/t*i;c.x=e*Math.cos(f),c.y=e*Math.sin(f),o.push(c.x,c.y,c.z),a.push(0,0,1),u.x=(o[d]/e+1)/2,u.y=(o[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new Ke(o,3)),this.setAttribute("normal",new Ke(a,3)),this.setAttribute("uv",new Ke(l,2))}},Zt=class extends $e{constructor(e=1,t=1,n=1,i=8,s=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:l};let c=this;i=Math.floor(i),s=Math.floor(s);let u=[],h=[],d=[],f=[],g=0,x=[],y=n/2,m=0;p(),o===!1&&(e>0&&R(!0),t>0&&R(!1)),this.setIndex(u),this.setAttribute("position",new Ke(h,3)),this.setAttribute("normal",new Ke(d,3)),this.setAttribute("uv",new Ke(f,2));function p(){let A=new M,C=new M,w=0,F=(t-e)/n;for(let B=0;B<=s;B++){let O=[],H=B/s,K=H*(t-e)+e;for(let q=0;q<=i;q++){let D=q/i,z=D*l+a,N=Math.sin(z),P=Math.cos(z);C.x=K*N,C.y=-H*n+y,C.z=K*P,h.push(C.x,C.y,C.z),A.set(N,F,P).normalize(),d.push(A.x,A.y,A.z),f.push(D,1-H),O.push(g++)}x.push(O)}for(let B=0;B<i;B++)for(let O=0;O<s;O++){let H=x[O][B],K=x[O+1][B],q=x[O+1][B+1],D=x[O][B+1];u.push(H,K,D),u.push(K,q,D),w+=6}c.addGroup(m,w,0),m+=w}function R(A){let C=g,w=new se,F=new M,B=0,O=A===!0?e:t,H=A===!0?1:-1;for(let q=1;q<=i;q++)h.push(0,y*H,0),d.push(0,H,0),f.push(.5,.5),g++;let K=g;for(let q=0;q<=i;q++){let z=q/i*l+a,N=Math.cos(z),P=Math.sin(z);F.x=O*P,F.y=y*H,F.z=O*N,h.push(F.x,F.y,F.z),d.push(0,H,0),w.x=N*.5+.5,w.y=P*.5*H+.5,f.push(w.x,w.y),g++}for(let q=0;q<i;q++){let D=C+q,z=K+q;A===!0?u.push(z,z+1,D):u.push(z+1,z,D),B+=3}c.addGroup(m,B,A===!0?1:2),m+=B}}};var px=new M,mx=new M,gx=new M,vx=new Ct;var fv={triangulate:function(r,e,t){t=t||2;let n=e&&e.length,i=n?e[0]*t:r.length,s=bh(r,0,i,t,!0),o=[];if(!s||s.next===s.prev)return o;let a,l,c,u,h,d,f;if(n&&(s=xv(r,e,s,t)),r.length>80*t){a=c=r[0],l=u=r[1];for(let g=t;g<i;g+=t)h=r[g],d=r[g+1],h<a&&(a=h),d<l&&(l=d),h>c&&(c=h),d>u&&(u=d);f=Math.max(c-a,u-l),f=f!==0?1/f:0}return is(s,o,t,a,l,f),o}};function bh(r,e,t,n,i){let s,o;if(i===Rv(r,e,t,n)>0)for(s=e;s<t;s+=n)o=Wu(s,r[s],r[s+1],o);else for(s=t-n;s>=e;s-=n)o=Wu(s,r[s],r[s+1],o);return o&&No(o,o.next)&&(ss(o),o=o.next),o}function ri(r,e){if(!r)return r;e||(e=r);let t=r,n;do if(n=!1,!t.steiner&&(No(t,t.next)||pt(t.prev,t,t.next)===0)){if(ss(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function is(r,e,t,n,i,s,o){if(!r)return;!o&&s&&Mv(r,n,i,s);let a=r,l,c;for(;r.prev!==r.next;){if(l=r.prev,c=r.next,s?mv(r,n,i,s):pv(r)){e.push(l.i/t),e.push(r.i/t),e.push(c.i/t),ss(r),r=c.next,a=c.next;continue}if(r=c,r===a){o?o===1?(r=gv(ri(r),e,t),is(r,e,t,n,i,s,2)):o===2&&vv(r,e,t,n,i,s):is(ri(r),e,t,n,i,s,1);break}}}function pv(r){let e=r.prev,t=r,n=r.next;if(pt(e,t,n)>=0)return!1;let i=r.next.next;for(;i!==r.prev;){if(Xi(e.x,e.y,t.x,t.y,n.x,n.y,i.x,i.y)&&pt(i.prev,i,i.next)>=0)return!1;i=i.next}return!0}function mv(r,e,t,n){let i=r.prev,s=r,o=r.next;if(pt(i,s,o)>=0)return!1;let a=i.x<s.x?i.x<o.x?i.x:o.x:s.x<o.x?s.x:o.x,l=i.y<s.y?i.y<o.y?i.y:o.y:s.y<o.y?s.y:o.y,c=i.x>s.x?i.x>o.x?i.x:o.x:s.x>o.x?s.x:o.x,u=i.y>s.y?i.y>o.y?i.y:o.y:s.y>o.y?s.y:o.y,h=al(a,l,e,t,n),d=al(c,u,e,t,n),f=r.prevZ,g=r.nextZ;for(;f&&f.z>=h&&g&&g.z<=d;){if(f!==r.prev&&f!==r.next&&Xi(i.x,i.y,s.x,s.y,o.x,o.y,f.x,f.y)&&pt(f.prev,f,f.next)>=0||(f=f.prevZ,g!==r.prev&&g!==r.next&&Xi(i.x,i.y,s.x,s.y,o.x,o.y,g.x,g.y)&&pt(g.prev,g,g.next)>=0))return!1;g=g.nextZ}for(;f&&f.z>=h;){if(f!==r.prev&&f!==r.next&&Xi(i.x,i.y,s.x,s.y,o.x,o.y,f.x,f.y)&&pt(f.prev,f,f.next)>=0)return!1;f=f.prevZ}for(;g&&g.z<=d;){if(g!==r.prev&&g!==r.next&&Xi(i.x,i.y,s.x,s.y,o.x,o.y,g.x,g.y)&&pt(g.prev,g,g.next)>=0)return!1;g=g.nextZ}return!0}function gv(r,e,t){let n=r;do{let i=n.prev,s=n.next.next;!No(i,s)&&Mh(i,n,n.next,s)&&rs(i,s)&&rs(s,i)&&(e.push(i.i/t),e.push(n.i/t),e.push(s.i/t),ss(n),ss(n.next),n=r=s),n=n.next}while(n!==r);return ri(n)}function vv(r,e,t,n,i,s){let o=r;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Ev(o,a)){let l=Sh(o,a);o=ri(o,o.next),l=ri(l,l.next),is(o,e,t,n,i,s),is(l,e,t,n,i,s);return}a=a.next}o=o.next}while(o!==r)}function xv(r,e,t,n){let i=[],s,o,a,l,c;for(s=0,o=e.length;s<o;s++)a=e[s]*n,l=s<o-1?e[s+1]*n:r.length,c=bh(r,a,l,n,!1),c===c.next&&(c.steiner=!0),i.push(Tv(c));for(i.sort(yv),s=0;s<i.length;s++)_v(i[s],t),t=ri(t,t.next);return t}function yv(r,e){return r.x-e.x}function _v(r,e){if(e=wv(r,e),e){let t=Sh(e,r);ri(e,e.next),ri(t,t.next)}}function wv(r,e){let t=e,n=r.x,i=r.y,s=-1/0,o;do{if(i<=t.y&&i>=t.next.y&&t.next.y!==t.y){let d=t.x+(i-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=n&&d>s){if(s=d,d===n){if(i===t.y)return t;if(i===t.next.y)return t.next}o=t.x<t.next.x?t:t.next}}t=t.next}while(t!==e);if(!o)return null;if(n===s)return o;let a=o,l=o.x,c=o.y,u=1/0,h;t=o;do n>=t.x&&t.x>=l&&n!==t.x&&Xi(i<c?n:s,i,l,c,i<c?s:n,i,t.x,t.y)&&(h=Math.abs(i-t.y)/(n-t.x),rs(t,r)&&(h<u||h===u&&(t.x>o.x||t.x===o.x&&bv(o,t)))&&(o=t,u=h)),t=t.next;while(t!==a);return o}function bv(r,e){return pt(r.prev,r,e.prev)<0&&pt(e.next,r,r.next)<0}function Mv(r,e,t,n){let i=r;do i.z===null&&(i.z=al(i.x,i.y,e,t,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==r);i.prevZ.nextZ=null,i.prevZ=null,Sv(i)}function Sv(r){let e,t,n,i,s,o,a,l,c=1;do{for(t=r,r=null,s=null,o=0;t;){for(o++,n=t,a=0,e=0;e<c&&(a++,n=n.nextZ,!!n);e++);for(l=c;a>0||l>0&&n;)a!==0&&(l===0||!n||t.z<=n.z)?(i=t,t=t.nextZ,a--):(i=n,n=n.nextZ,l--),s?s.nextZ=i:r=i,i.prevZ=s,s=i;t=n}s.nextZ=null,c*=2}while(o>1);return r}function al(r,e,t,n,i){return r=32767*(r-t)*i,e=32767*(e-n)*i,r=(r|r<<8)&16711935,r=(r|r<<4)&252645135,r=(r|r<<2)&858993459,r=(r|r<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,r|e<<1}function Tv(r){let e=r,t=r;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==r);return t}function Xi(r,e,t,n,i,s,o,a){return(i-o)*(e-a)-(r-o)*(s-a)>=0&&(r-o)*(n-a)-(t-o)*(e-a)>=0&&(t-o)*(s-a)-(i-o)*(n-a)>=0}function Ev(r,e){return r.next.i!==e.i&&r.prev.i!==e.i&&!Av(r,e)&&(rs(r,e)&&rs(e,r)&&Lv(r,e)&&(pt(r.prev,r,e.prev)||pt(r,e.prev,e))||No(r,e)&&pt(r.prev,r,r.next)>0&&pt(e.prev,e,e.next)>0)}function pt(r,e,t){return(e.y-r.y)*(t.x-e.x)-(e.x-r.x)*(t.y-e.y)}function No(r,e){return r.x===e.x&&r.y===e.y}function Mh(r,e,t,n){let i=$s(pt(r,e,t)),s=$s(pt(r,e,n)),o=$s(pt(t,n,r)),a=$s(pt(t,n,e));return!!(i!==s&&o!==a||i===0&&js(r,t,e)||s===0&&js(r,n,e)||o===0&&js(t,r,n)||a===0&&js(t,e,n))}function js(r,e,t){return e.x<=Math.max(r.x,t.x)&&e.x>=Math.min(r.x,t.x)&&e.y<=Math.max(r.y,t.y)&&e.y>=Math.min(r.y,t.y)}function $s(r){return r>0?1:r<0?-1:0}function Av(r,e){let t=r;do{if(t.i!==r.i&&t.next.i!==r.i&&t.i!==e.i&&t.next.i!==e.i&&Mh(t,t.next,r,e))return!0;t=t.next}while(t!==r);return!1}function rs(r,e){return pt(r.prev,r,r.next)<0?pt(r,e,r.next)>=0&&pt(r,r.prev,e)>=0:pt(r,e,r.prev)<0||pt(r,r.next,e)<0}function Lv(r,e){let t=r,n=!1,i=(r.x+e.x)/2,s=(r.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&i<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==r);return n}function Sh(r,e){let t=new ll(r.i,r.x,r.y),n=new ll(e.i,e.x,e.y),i=r.next,s=e.prev;return r.next=e,e.prev=r,t.next=i,i.prev=t,n.next=t,t.prev=n,s.next=n,n.prev=s,n}function Wu(r,e,t,n){let i=new ll(r,e,t);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function ss(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function ll(r,e,t){this.i=r,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Rv(r,e,t,n){let i=0;for(let s=e,o=t-n;s<t;s+=n)i+=(r[o]-r[s])*(r[s+1]+r[o+1]),o=s;return i}var Dn=class r{static area(e){let t=e.length,n=0;for(let i=t-1,s=0;s<t;i=s++)n+=e[i].x*e[s].y-e[s].x*e[i].y;return n*.5}static isClockWise(e){return r.area(e)<0}static triangulateShape(e,t){let n=[],i=[],s=[];qu(e),Xu(n,e);let o=e.length;t.forEach(qu);for(let l=0;l<t.length;l++)i.push(o),o+=t[l].length,Xu(n,t[l]);let a=fv.triangulate(n,i);for(let l=0;l<a.length;l+=3)s.push(a.slice(l,l+3));return s}};function qu(r){let e=r.length;e>2&&r[e-1].equals(r[0])&&r.pop()}function Xu(r,e){for(let t=0;t<e.length;t++)r.push(e[t].x),r.push(e[t].y)}var er=class extends $e{constructor(e,t){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,i=[],s=[];for(let a=0,l=e.length;a<l;a++){let c=e[a];o(c)}this.setAttribute("position",new Ke(i,3)),this.setAttribute("uv",new Ke(s,2)),this.computeVertexNormals();function o(a){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,u=t.steps!==void 0?t.steps:1,h=t.depth!==void 0?t.depth:100,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:6,g=t.bevelSize!==void 0?t.bevelSize:f-2,x=t.bevelOffset!==void 0?t.bevelOffset:0,y=t.bevelSegments!==void 0?t.bevelSegments:3,m=t.extrudePath,p=t.UVGenerator!==void 0?t.UVGenerator:Cv;t.amount!==void 0&&(console.warn("THREE.ExtrudeBufferGeometry: amount has been renamed to depth."),h=t.amount);let R,A=!1,C,w,F,B;m&&(R=m.getSpacedPoints(u),A=!0,d=!1,C=m.computeFrenetFrames(u,!1),w=new M,F=new M,B=new M),d||(y=0,f=0,g=0,x=0);let O=a.extractPoints(c),H=O.shape,K=O.holes;if(!Dn.isClockWise(H)){H=H.reverse();for(let Z=0,ie=K.length;Z<ie;Z++){let ae=K[Z];Dn.isClockWise(ae)&&(K[Z]=ae.reverse())}}let D=Dn.triangulateShape(H,K),z=H;for(let Z=0,ie=K.length;Z<ie;Z++){let ae=K[Z];H=H.concat(ae)}function N(Z,ie,ae){return ie||console.error("THREE.ExtrudeGeometry: vec does not exist"),ie.clone().multiplyScalar(ae).add(Z)}let P=H.length,te=D.length;function ce(Z,ie,ae){let Ee,de,E,S=Z.x-ie.x,j=Z.y-ie.y,ne=ae.x-Z.x,ve=ae.y-Z.y,Re=S*S+j*j,Ye=S*ve-j*ne;if(Math.abs(Ye)>Number.EPSILON){let ke=Math.sqrt(Re),I=Math.sqrt(ne*ne+ve*ve),fe=ie.x-j/ke,me=ie.y+S/ke,De=ae.x-ve/I,re=ae.y+ne/I,ze=((De-fe)*ve-(re-me)*ne)/(S*ve-j*ne);Ee=fe+S*ze-Z.x,de=me+j*ze-Z.y;let We=Ee*Ee+de*de;if(We<=2)return new se(Ee,de);E=Math.sqrt(We/2)}else{let ke=!1;S>Number.EPSILON?ne>Number.EPSILON&&(ke=!0):S<-Number.EPSILON?ne<-Number.EPSILON&&(ke=!0):Math.sign(j)===Math.sign(ve)&&(ke=!0),ke?(Ee=-j,de=S,E=Math.sqrt(Re)):(Ee=S,de=j,E=Math.sqrt(Re/2))}return new se(Ee/E,de/E)}let oe=[];for(let Z=0,ie=z.length,ae=ie-1,Ee=Z+1;Z<ie;Z++,ae++,Ee++)ae===ie&&(ae=0),Ee===ie&&(Ee=0),oe[Z]=ce(z[Z],z[ae],z[Ee]);let we=[],pe,Ce=oe.concat();for(let Z=0,ie=K.length;Z<ie;Z++){let ae=K[Z];pe=[];for(let Ee=0,de=ae.length,E=de-1,S=Ee+1;Ee<de;Ee++,E++,S++)E===de&&(E=0),S===de&&(S=0),pe[Ee]=ce(ae[Ee],ae[E],ae[S]);we.push(pe),Ce=Ce.concat(pe)}for(let Z=0;Z<y;Z++){let ie=Z/y,ae=f*Math.cos(ie*Math.PI/2),Ee=g*Math.sin(ie*Math.PI/2)+x;for(let de=0,E=z.length;de<E;de++){let S=N(z[de],oe[de],Ee);Se(S.x,S.y,-ae)}for(let de=0,E=K.length;de<E;de++){let S=K[de];pe=we[de];for(let j=0,ne=S.length;j<ne;j++){let ve=N(S[j],pe[j],Ee);Se(ve.x,ve.y,-ae)}}}let Fe=g+x;for(let Z=0;Z<P;Z++){let ie=d?N(H[Z],Ce[Z],Fe):H[Z];A?(F.copy(C.normals[0]).multiplyScalar(ie.x),w.copy(C.binormals[0]).multiplyScalar(ie.y),B.copy(R[0]).add(F).add(w),Se(B.x,B.y,B.z)):Se(ie.x,ie.y,0)}for(let Z=1;Z<=u;Z++)for(let ie=0;ie<P;ie++){let ae=d?N(H[ie],Ce[ie],Fe):H[ie];A?(F.copy(C.normals[Z]).multiplyScalar(ae.x),w.copy(C.binormals[Z]).multiplyScalar(ae.y),B.copy(R[Z]).add(F).add(w),Se(B.x,B.y,B.z)):Se(ae.x,ae.y,h/u*Z)}for(let Z=y-1;Z>=0;Z--){let ie=Z/y,ae=f*Math.cos(ie*Math.PI/2),Ee=g*Math.sin(ie*Math.PI/2)+x;for(let de=0,E=z.length;de<E;de++){let S=N(z[de],oe[de],Ee);Se(S.x,S.y,h+ae)}for(let de=0,E=K.length;de<E;de++){let S=K[de];pe=we[de];for(let j=0,ne=S.length;j<ne;j++){let ve=N(S[j],pe[j],Ee);A?Se(ve.x,ve.y+R[u-1].y,R[u-1].x+ae):Se(ve.x,ve.y,h+ae)}}}ee(),$();function ee(){let Z=i.length/3;if(d){let ie=0,ae=P*ie;for(let Ee=0;Ee<te;Ee++){let de=D[Ee];he(de[2]+ae,de[1]+ae,de[0]+ae)}ie=u+y*2,ae=P*ie;for(let Ee=0;Ee<te;Ee++){let de=D[Ee];he(de[0]+ae,de[1]+ae,de[2]+ae)}}else{for(let ie=0;ie<te;ie++){let ae=D[ie];he(ae[2],ae[1],ae[0])}for(let ie=0;ie<te;ie++){let ae=D[ie];he(ae[0]+P*u,ae[1]+P*u,ae[2]+P*u)}}n.addGroup(Z,i.length/3-Z,0)}function $(){let Z=i.length/3,ie=0;ue(z,ie),ie+=z.length;for(let ae=0,Ee=K.length;ae<Ee;ae++){let de=K[ae];ue(de,ie),ie+=de.length}n.addGroup(Z,i.length/3-Z,1)}function ue(Z,ie){let ae=Z.length;for(;--ae>=0;){let Ee=ae,de=ae-1;de<0&&(de=Z.length-1);for(let E=0,S=u+y*2;E<S;E++){let j=P*E,ne=P*(E+1),ve=ie+Ee+j,Re=ie+de+j,Ye=ie+de+ne,ke=ie+Ee+ne;be(ve,Re,Ye,ke)}}}function Se(Z,ie,ae){l.push(Z),l.push(ie),l.push(ae)}function he(Z,ie,ae){le(Z),le(ie),le(ae);let Ee=i.length/3,de=p.generateTopUV(n,i,Ee-3,Ee-2,Ee-1);v(de[0]),v(de[1]),v(de[2])}function be(Z,ie,ae,Ee){le(Z),le(ie),le(Ee),le(ie),le(ae),le(Ee);let de=i.length/3,E=p.generateSideWallUV(n,i,de-6,de-3,de-2,de-1);v(E[0]),v(E[1]),v(E[3]),v(E[1]),v(E[2]),v(E[3])}function le(Z){i.push(l[Z*3+0]),i.push(l[Z*3+1]),i.push(l[Z*3+2])}function v(Z){s.push(Z.x),s.push(Z.y)}}}toJSON(){let e=$e.prototype.toJSON.call(this),t=this.parameters.shapes,n=this.parameters.options;return Pv(t,n,e)}},Cv={generateTopUV:function(r,e,t,n,i){let s=e[t*3],o=e[t*3+1],a=e[n*3],l=e[n*3+1],c=e[i*3],u=e[i*3+1];return[new se(s,o),new se(a,l),new se(c,u)]},generateSideWallUV:function(r,e,t,n,i,s){let o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[n*3],u=e[n*3+1],h=e[n*3+2],d=e[i*3],f=e[i*3+1],g=e[i*3+2],x=e[s*3],y=e[s*3+1],m=e[s*3+2];return Math.abs(a-u)<.01?[new se(o,1-l),new se(c,1-h),new se(d,1-g),new se(x,1-m)]:[new se(a,1-l),new se(u,1-h),new se(f,1-g),new se(y,1-m)]}};function Pv(r,e,t){if(t.shapes=[],Array.isArray(r))for(let n=0,i=r.length;n<i;n++){let s=r[n];t.shapes.push(s.uuid)}else t.shapes.push(r.uuid);return e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var wo=class extends $e{constructor(e,t=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:i},t=Math.floor(t),i=Ft(i,0,Math.PI*2);let s=[],o=[],a=[],l=1/t,c=new M,u=new se;for(let h=0;h<=t;h++){let d=n+h*l*i,f=Math.sin(d),g=Math.cos(d);for(let x=0;x<=e.length-1;x++)c.x=e[x].x*f,c.y=e[x].y,c.z=e[x].x*g,o.push(c.x,c.y,c.z),u.x=h/t,u.y=x/(e.length-1),a.push(u.x,u.y)}for(let h=0;h<t;h++)for(let d=0;d<e.length-1;d++){let f=d+h*e.length,g=f,x=f+e.length,y=f+e.length+1,m=f+1;s.push(g,x,m),s.push(x,y,m)}if(this.setIndex(s),this.setAttribute("position",new Ke(o,3)),this.setAttribute("uv",new Ke(a,2)),this.computeVertexNormals(),i===Math.PI*2){let h=this.attributes.normal.array,d=new M,f=new M,g=new M,x=t*e.length*3;for(let y=0,m=0;y<e.length;y++,m+=3)d.x=h[m+0],d.y=h[m+1],d.z=h[m+2],f.x=h[x+m+0],f.y=h[x+m+1],f.z=h[x+m+2],g.addVectors(d,f).normalize(),h[m+0]=h[x+m+0]=g.x,h[m+1]=h[x+m+1]=g.y,h[m+2]=h[x+m+2]=g.z}}};var os=class extends $e{constructor(e=.5,t=1,n=8,i=1,s=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:o},n=Math.max(3,n),i=Math.max(1,i);let a=[],l=[],c=[],u=[],h=e,d=(t-e)/i,f=new M,g=new se;for(let x=0;x<=i;x++){for(let y=0;y<=n;y++){let m=s+y/n*o;f.x=h*Math.cos(m),f.y=h*Math.sin(m),l.push(f.x,f.y,f.z),c.push(0,0,1),g.x=(f.x/t+1)/2,g.y=(f.y/t+1)/2,u.push(g.x,g.y)}h+=d}for(let x=0;x<i;x++){let y=x*(n+1);for(let m=0;m<n;m++){let p=m+y,R=p,A=p+n+1,C=p+n+2,w=p+1;a.push(R,A,w),a.push(A,C,w)}}this.setIndex(a),this.setAttribute("position",new Ke(l,3)),this.setAttribute("normal",new Ke(c,3)),this.setAttribute("uv",new Ke(u,2))}},cl=class extends $e{constructor(e,t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],i=[],s=[],o=[],a=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let u=0;u<e.length;u++)c(e[u]),this.addGroup(a,l,u),a+=l,l=0;this.setIndex(n),this.setAttribute("position",new Ke(i,3)),this.setAttribute("normal",new Ke(s,3)),this.setAttribute("uv",new Ke(o,2));function c(u){let h=i.length/3,d=u.extractPoints(t),f=d.shape,g=d.holes;Dn.isClockWise(f)===!1&&(f=f.reverse());for(let y=0,m=g.length;y<m;y++){let p=g[y];Dn.isClockWise(p)===!0&&(g[y]=p.reverse())}let x=Dn.triangulateShape(f,g);for(let y=0,m=g.length;y<m;y++){let p=g[y];f=f.concat(p)}for(let y=0,m=f.length;y<m;y++){let p=f[y];i.push(p.x,p.y,0),s.push(0,0,1),o.push(p.x,p.y)}for(let y=0,m=x.length;y<m;y++){let p=x[y],R=p[0]+h,A=p[1]+h,C=p[2]+h;n.push(R,A,C),l+=3}}}toJSON(){let e=$e.prototype.toJSON.call(this),t=this.parameters.shapes;return Dv(t,e)}};function Dv(r,e){if(e.shapes=[],Array.isArray(r))for(let t=0,n=r.length;t<n;t++){let i=r[t];e.shapes.push(i.uuid)}else e.shapes.push(r.uuid);return e}var ul=class extends Mt{constructor(e){super(),this.type="ShadowMaterial",this.color=new ge(0),this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this}};ul.prototype.isShadowMaterial=!0;var hl=class extends tt{constructor(e){super(e),this.type="RawShaderMaterial"}};hl.prototype.isRawShaderMaterial=!0;var bo=class extends Mt{constructor(e){super(),this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new ge(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ge(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=hr,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.vertexTangents=!1,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this.vertexTangents=e.vertexTangents,this}};bo.prototype.isMeshStandardMaterial=!0;var dl=class extends bo{constructor(e){super(),this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.clearcoat=0,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new se(1,1),this.clearcoatNormalMap=null,this.reflectivity=.5,Object.defineProperty(this,"ior",{get:function(){return(1+.4*this.reflectivity)/(1-.4*this.reflectivity)},set:function(t){this.reflectivity=Ft(2.5*(t-1)/(t+1),0,1)}}),this.sheen=null,this.transmission=0,this.transmissionMap=null,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.reflectivity=e.reflectivity,e.sheen?this.sheen=(this.sheen||new ge).copy(e.sheen):this.sheen=null,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this}};dl.prototype.isMeshPhysicalMaterial=!0;var fl=class extends Mt{constructor(e){super(),this.type="MeshPhongMaterial",this.color=new ge(16777215),this.specular=new ge(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ge(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=hr,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Bo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};fl.prototype.isMeshPhongMaterial=!0;var pl=class extends Mt{constructor(e){super(),this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new ge(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ge(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=hr,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}};pl.prototype.isMeshToonMaterial=!0;var ml=class extends Mt{constructor(e){super(),this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=hr,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};ml.prototype.isMeshNormalMaterial=!0;var gl=class extends Mt{constructor(e){super(),this.type="MeshLambertMaterial",this.color=new ge(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ge(0),this.emissiveIntensity=1,this.emissiveMap=null,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Bo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}};gl.prototype.isMeshLambertMaterial=!0;var vl=class extends Mt{constructor(e){super(),this.defines={MATCAP:""},this.type="MeshMatcapMaterial",this.color=new ge(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=hr,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}};vl.prototype.isMeshMatcapMaterial=!0;var xl=class extends xi{constructor(e){super(),this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}};xl.prototype.isLineDashedMaterial=!0;var dt={arraySlice:function(r,e,t){return dt.isTypedArray(r)?new r.constructor(r.subarray(e,t!==void 0?t:r.length)):r.slice(e,t)},convertArray:function(r,e,t){return!r||!t&&r.constructor===e?r:typeof e.BYTES_PER_ELEMENT=="number"?new e(r):Array.prototype.slice.call(r)},isTypedArray:function(r){return ArrayBuffer.isView(r)&&!(r instanceof DataView)},getKeyframeOrder:function(r){function e(i,s){return r[i]-r[s]}let t=r.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n},sortedArray:function(r,e,t){let n=r.length,i=new r.constructor(n);for(let s=0,o=0;o!==n;++s){let a=t[s]*e;for(let l=0;l!==e;++l)i[o++]=r[a+l]}return i},flattenJSON:function(r,e,t,n){let i=1,s=r[0];for(;s!==void 0&&s[n]===void 0;)s=r[i++];if(s===void 0)return;let o=s[n];if(o!==void 0)if(Array.isArray(o))do o=s[n],o!==void 0&&(e.push(s.time),t.push.apply(t,o)),s=r[i++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[n],o!==void 0&&(e.push(s.time),o.toArray(t,t.length)),s=r[i++];while(s!==void 0);else do o=s[n],o!==void 0&&(e.push(s.time),t.push(o)),s=r[i++];while(s!==void 0)},subclip:function(r,e,t,n,i=30){let s=r.clone();s.name=e;let o=[];for(let l=0;l<s.tracks.length;++l){let c=s.tracks[l],u=c.getValueSize(),h=[],d=[];for(let f=0;f<c.times.length;++f){let g=c.times[f]*i;if(!(g<t||g>=n)){h.push(c.times[f]);for(let x=0;x<u;++x)d.push(c.values[f*u+x])}}h.length!==0&&(c.times=dt.convertArray(h,c.times.constructor),c.values=dt.convertArray(d,c.values.constructor),o.push(c))}s.tracks=o;let a=1/0;for(let l=0;l<s.tracks.length;++l)a>s.tracks[l].times[0]&&(a=s.tracks[l].times[0]);for(let l=0;l<s.tracks.length;++l)s.tracks[l].shift(-1*a);return s.resetDuration(),s},makeClipAdditive:function(r,e=0,t=r,n=30){n<=0&&(n=30);let i=t.tracks.length,s=e/n;for(let o=0;o<i;++o){let a=t.tracks[o],l=a.ValueTypeName;if(l==="bool"||l==="string")continue;let c=r.tracks.find(function(m){return m.name===a.name&&m.ValueTypeName===l});if(c===void 0)continue;let u=0,h=a.getValueSize();a.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(u=h/3);let d=0,f=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=f/3);let g=a.times.length-1,x;if(s<=a.times[0]){let m=u,p=h-u;x=dt.arraySlice(a.values,m,p)}else if(s>=a.times[g]){let m=g*h+u,p=m+h-u;x=dt.arraySlice(a.values,m,p)}else{let m=a.createInterpolant(),p=u,R=h-u;m.evaluate(s),x=dt.arraySlice(m.resultBuffer,p,R)}l==="quaternion"&&new Et().fromArray(x).normalize().conjugate().toArray(x);let y=c.times.length;for(let m=0;m<y;++m){let p=m*f+d;if(l==="quaternion")Et.multiplyQuaternionsFlat(c.values,p,x,0,c.values,p);else{let R=f-d*2;for(let A=0;A<R;++A)c.values[p+A]-=x[A]}}}return r.blendMode=rh,r}},_n=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],s=t[n-1];e:{t:{let o;n:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.afterEnd_(n-1,e,s)}if(n===a)break;if(s=i,i=t[++n],e<i)break t}o=t.length;break n}if(!(e>=s)){let a=t[1];e<a&&(n=2,s=a);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.beforeStart_(0,e,i);if(n===l)break;if(i=s,s=t[--n-1],e>=s)break t}o=n,n=0;break n}break e}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.beforeStart_(0,e,i);if(i===void 0)return n=t.length,this._cachedIndex=n,this.afterEnd_(n-1,s,e)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let o=0;o!==i;++o)t[o]=n[s+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}};_n.prototype.beforeStart_=_n.prototype.copySampleValue_;_n.prototype.afterEnd_=_n.prototype.copySampleValue_;var yl=class extends _n{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Wi,endingEnd:Wi}}intervalChanged_(e,t,n){let i=this.parameterPositions,s=e-2,o=e+1,a=i[s],l=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case qi:s=e,a=2*t-n;break;case lo:s=i.length-2,a=t+i[s]-i[s+1];break;default:s=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case qi:o=e,l=2*n-t;break;case lo:o=1,l=n+i[1]-i[0];break;default:o=e-1,l=t}let c=(n-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-n),this._offsetPrev=s*u,this._offsetNext=o*u}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,f=this._weightNext,g=(n-t)/(i-t),x=g*g,y=x*g,m=-d*y+2*d*x-d*g,p=(1+d)*y+(-1.5-2*d)*x+(-.5+d)*g+1,R=(-1-f)*y+(1.5+f)*x+.5*g,A=f*y-f*x;for(let C=0;C!==a;++C)s[C]=m*o[u+C]+p*o[c+C]+R*o[l+C]+A*o[h+C];return s}},Mo=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(n-t)/(i-t),h=1-u;for(let d=0;d!==a;++d)s[d]=o[c+d]*h+o[l+d]*u;return s}},_l=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},Kt=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=dt.convertArray(t,this.TimeBufferType),this.values=dt.convertArray(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:dt.convertArray(e.times,Array),values:dt.convertArray(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new _l(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Mo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new yl(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case oo:t=this.InterpolantFactoryMethodDiscrete;break;case ao:t=this.InterpolantFactoryMethodLinear;break;case ca:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return oo;case this.InterpolantFactoryMethodLinear:return ao;case this.InterpolantFactoryMethodSmooth:return ca}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,s=0,o=i-1;for(;s!==i&&n[s]<e;)++s;for(;o!==-1&&n[o]>t;)--o;if(++o,s!==0||o!==i){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=dt.arraySlice(n,s,o),this.values=dt.arraySlice(this.values,s*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,s=n.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(i!==void 0&&dt.isTypedArray(i))for(let a=0,l=i.length;a!==l;++a){let c=i[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=dt.arraySlice(this.times),t=dt.arraySlice(this.values),n=this.getValueSize(),i=this.getInterpolation()===ca,s=e.length-1,o=1;for(let a=1;a<s;++a){let l=!1,c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(i)l=!0;else{let h=a*n,d=h-n,f=h+n;for(let g=0;g!==n;++g){let x=t[h+g];if(x!==t[d+g]||x!==t[f+g]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let h=a*n,d=o*n;for(let f=0;f!==n;++f)t[d+f]=t[h+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*n,l=o*n,c=0;c!==n;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=dt.arraySlice(e,0,o),this.values=dt.arraySlice(t,0,o*n)):(this.times=e,this.values=t),this}clone(){let e=dt.arraySlice(this.times,0),t=dt.arraySlice(this.values,0),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};Kt.prototype.TimeBufferType=Float32Array;Kt.prototype.ValueBufferType=Float32Array;Kt.prototype.DefaultInterpolation=ao;var si=class extends Kt{};si.prototype.ValueTypeName="bool";si.prototype.ValueBufferType=Array;si.prototype.DefaultInterpolation=oo;si.prototype.InterpolantFactoryMethodLinear=void 0;si.prototype.InterpolantFactoryMethodSmooth=void 0;var So=class extends Kt{};So.prototype.ValueTypeName="color";var tr=class extends Kt{};tr.prototype.ValueTypeName="number";var wl=class extends _n{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(i-t),c=e*a;for(let u=c+a;c!==u;c+=4)Et.slerpFlat(s,0,o,c-a,o,c,l);return s}},yi=class extends Kt{InterpolantFactoryMethodLinear(e){return new wl(this.times,this.values,this.getValueSize(),e)}};yi.prototype.ValueTypeName="quaternion";yi.prototype.DefaultInterpolation=ao;yi.prototype.InterpolantFactoryMethodSmooth=void 0;var oi=class extends Kt{};oi.prototype.ValueTypeName="string";oi.prototype.ValueBufferType=Array;oi.prototype.DefaultInterpolation=oo;oi.prototype.InterpolantFactoryMethodLinear=void 0;oi.prototype.InterpolantFactoryMethodSmooth=void 0;var nr=class extends Kt{};nr.prototype.ValueTypeName="vector";var To=class{constructor(e,t=-1,n,i=lc){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=hn(),this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(Iv(n[o]).scale(i));let s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,o=n.length;s!==o;++s)t.push(Kt.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let s=t.length,o=[];for(let a=0;a<s;a++){let l=[],c=[];l.push((a+s-1)%s,a,(a+1)%s),c.push(0,1,0);let u=dt.getKeyframeOrder(l);l=dt.sortedArray(l,1,u),c=dt.sortedArray(c,1,u),!i&&l[0]===0&&(l.push(s),c.push(c[0])),o.push(new tr(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],u=c.name.match(s);if(u&&u.length>1){let h=u[1],d=i[h];d||(i[h]=d=[]),d.push(c)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let n=function(h,d,f,g,x){if(f.length!==0){let y=[],m=[];dt.flattenJSON(f,y,m,g),y.length!==0&&x.push(new h(d,y,m))}},i=[],s=e.name||"default",o=e.fps||30,a=e.blendMode,l=e.length||-1,c=e.hierarchy||[];for(let h=0;h<c.length;h++){let d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){let f={},g;for(g=0;g<d.length;g++)if(d[g].morphTargets)for(let x=0;x<d[g].morphTargets.length;x++)f[d[g].morphTargets[x]]=-1;for(let x in f){let y=[],m=[];for(let p=0;p!==d[g].morphTargets.length;++p){let R=d[g];y.push(R.time),m.push(R.morphTarget===x?1:0)}i.push(new tr(".morphTargetInfluence["+x+"]",y,m))}l=f.length*(o||1)}else{let f=".bones["+t[h].name+"]";n(nr,f+".position",d,"pos",i),n(yi,f+".quaternion",d,"rot",i),n(nr,f+".scale",d,"scl",i)}}return i.length===0?null:new this(s,l,i,a)}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let s=this.tracks[n];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}};function Fv(r){switch(r.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return tr;case"vector":case"vector2":case"vector3":case"vector4":return nr;case"color":return So;case"quaternion":return yi;case"bool":case"boolean":return si;case"string":return oi}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+r)}function Iv(r){if(r.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=Fv(r.type);if(r.times===void 0){let t=[],n=[];dt.flattenJSON(r.keys,t,n,"value"),r.times=t,r.values=n}return e.parse!==void 0?e.parse(r):new e(r.name,r.times,r.values,r.interpolation)}var ir={enabled:!1,files:{},add:function(r,e){this.enabled!==!1&&(this.files[r]=e)},get:function(r){if(this.enabled!==!1)return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}},bl=class{constructor(e,t,n){let i=this,s=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(u){a++,s===!1&&i.onStart!==void 0&&i.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,i.onProgress!==void 0&&i.onProgress(u,o,a),o===a&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(u){i.onError!==void 0&&i.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){let h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){let f=c[h],g=c[h+1];if(f.global&&(f.lastIndex=0),f.test(u))return g}return null}}},zv=new bl,wn=class{constructor(e){this.manager=e!==void 0?e:zv,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,s){n.load(e,i,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}},an={},Ml=class extends wn{constructor(e){super(e)}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=ir.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;if(an[e]!==void 0){an[e].push({onLoad:t,onProgress:n,onError:i});return}let a=/^data:(.*?)(;base64)?,(.*)$/,l=e.match(a),c;if(l){let u=l[1],h=!!l[2],d=l[3];d=decodeURIComponent(d),h&&(d=atob(d));try{let f,g=(this.responseType||"").toLowerCase();switch(g){case"arraybuffer":case"blob":let x=new Uint8Array(d.length);for(let m=0;m<d.length;m++)x[m]=d.charCodeAt(m);g==="blob"?f=new Blob([x.buffer],{type:u}):f=x.buffer;break;case"document":f=new DOMParser().parseFromString(d,u);break;case"json":f=JSON.parse(d);break;default:f=d;break}setTimeout(function(){t&&t(f),s.manager.itemEnd(e)},0)}catch(f){setTimeout(function(){i&&i(f),s.manager.itemError(e),s.manager.itemEnd(e)},0)}}else{an[e]=[],an[e].push({onLoad:t,onProgress:n,onError:i}),c=new XMLHttpRequest,c.open("GET",e,!0),c.addEventListener("load",function(u){let h=this.response,d=an[e];if(delete an[e],this.status===200||this.status===0){this.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),ir.add(e,h);for(let f=0,g=d.length;f<g;f++){let x=d[f];x.onLoad&&x.onLoad(h)}s.manager.itemEnd(e)}else{for(let f=0,g=d.length;f<g;f++){let x=d[f];x.onError&&x.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)}},!1),c.addEventListener("progress",function(u){let h=an[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onProgress&&g.onProgress(u)}},!1),c.addEventListener("error",function(u){let h=an[e];delete an[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onError&&g.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)},!1),c.addEventListener("abort",function(u){let h=an[e];delete an[e];for(let d=0,f=h.length;d<f;d++){let g=h[d];g.onError&&g.onError(u)}s.manager.itemError(e),s.manager.itemEnd(e)},!1),this.responseType!==void 0&&(c.responseType=this.responseType),this.withCredentials!==void 0&&(c.withCredentials=this.withCredentials),c.overrideMimeType&&c.overrideMimeType(this.mimeType!==void 0?this.mimeType:"text/plain");for(let u in this.requestHeader)c.setRequestHeader(u,this.requestHeader[u]);c.send(null)}return s.manager.itemStart(e),c}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}};var Eo=class extends wn{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=ir.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;let a=document.createElementNS("http://www.w3.org/1999/xhtml","img");function l(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),ir.add(e,this),t&&t(this),s.manager.itemEnd(e)}function c(u){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),i&&i(u),s.manager.itemError(e),s.manager.itemEnd(e)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.substr(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}},Sl=class extends wn{constructor(e){super(e)}load(e,t,n,i){let s=new ji,o=new Eo(this.manager);o.setCrossOrigin(this.crossOrigin),o.setPath(this.path);let a=0;function l(c){o.load(e[c],function(u){s.images[c]=u,a++,a===6&&(s.needsUpdate=!0,t&&t(s))},void 0,i)}for(let c=0;c<e.length;++c)l(c);return s}};var as=class extends wn{constructor(e){super(e)}load(e,t,n,i){let s=new Pt,o=new Eo(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){s.image=a;let l=e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0;s.format=l?Pn:un,s.needsUpdate=!0,t!==void 0&&t(s)},n,i),s}},kt=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),s=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),s+=n.distanceTo(i),t.push(s),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){let n=this.getLengths(),i=0,s=n.length,o;t?o=t:o=e*n[s-1];let a=0,l=s-1,c;for(;a<=l;)if(i=Math.floor(a+(l-a)/2),c=n[i]-o,c<0)a=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===o)return i/(s-1);let u=n[i],d=n[i+1]-u,f=(o-u)/d;return(i+f)/(s-1)}getTangent(e,t){let i=e-1e-4,s=e+1e-4;i<0&&(i=0),s>1&&(s=1);let o=this.getPoint(i),a=this.getPoint(s),l=t||(o.isVector2?new se:new M);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){let n=new M,i=[],s=[],o=[],a=new M,l=new Ie;for(let f=0;f<=e;f++){let g=f/e;i[f]=this.getTangentAt(g,new M),i[f].normalize()}s[0]=new M,o[0]=new M;let c=Number.MAX_VALUE,u=Math.abs(i[0].x),h=Math.abs(i[0].y),d=Math.abs(i[0].z);u<=c&&(c=u,n.set(1,0,0)),h<=c&&(c=h,n.set(0,1,0)),d<=c&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),s[0].crossVectors(i[0],a),o[0].crossVectors(i[0],s[0]);for(let f=1;f<=e;f++){if(s[f]=s[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(i[f-1],i[f]),a.length()>Number.EPSILON){a.normalize();let g=Math.acos(Ft(i[f-1].dot(i[f]),-1,1));s[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(i[f],s[f])}if(t===!0){let f=Math.acos(Ft(s[0].dot(s[e]),-1,1));f/=e,i[0].dot(a.crossVectors(s[0],s[e]))>0&&(f=-f);for(let g=1;g<=e;g++)s[g].applyMatrix4(l.makeRotationAxis(i[g],f*g)),o[g].crossVectors(i[g],s[g])}return{tangents:i,normals:s,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.5,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},rr=class extends kt{constructor(e=0,t=0,n=1,i=1,s=0,o=Math.PI*2,a=!1,l=0){super(),this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=s,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t){let n=t||new se,i=Math.PI*2,s=this.aEndAngle-this.aStartAngle,o=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=i;for(;s>i;)s-=i;s<Number.EPSILON&&(o?s=0:s=i),this.aClockwise===!0&&!o&&(s===i?s=-i:s=s-i);let a=this.aStartAngle+e*s,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let u=Math.cos(this.aRotation),h=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*u-f*h+this.aX,c=d*h+f*u+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}};rr.prototype.isEllipseCurve=!0;var Ao=class extends rr{constructor(e,t,n,i,s,o){super(e,t,n,n,i,s,o),this.type="ArcCurve"}};Ao.prototype.isArcCurve=!0;function uc(){let r=0,e=0,t=0,n=0;function i(s,o,a,l){r=s,e=a,t=-3*s+3*o-2*a-l,n=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){i(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,u,h){let d=(o-s)/c-(a-s)/(c+u)+(a-o)/u,f=(a-o)/u-(l-o)/(u+h)+(l-a)/h;d*=u,f*=u,i(o,a,d,f)},calc:function(s){let o=s*s,a=o*s;return r+e*s+t*o+n*a}}}var Ks=new M,Oa=new uc,ka=new uc,Ha=new uc,Lo=class extends kt{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new M){let n=t,i=this.points,s=i.length,o=(s-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/s)+1)*s:l===0&&a===s-1&&(a=s-2,l=1);let c,u;this.closed||a>0?c=i[(a-1)%s]:(Ks.subVectors(i[0],i[1]).add(i[0]),c=Ks);let h=i[a%s],d=i[(a+1)%s];if(this.closed||a+2<s?u=i[(a+2)%s]:(Ks.subVectors(i[s-1],i[s-2]).add(i[s-1]),u=Ks),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(h),f),x=Math.pow(h.distanceToSquared(d),f),y=Math.pow(d.distanceToSquared(u),f);x<1e-4&&(x=1),g<1e-4&&(g=x),y<1e-4&&(y=x),Oa.initNonuniformCatmullRom(c.x,h.x,d.x,u.x,g,x,y),ka.initNonuniformCatmullRom(c.y,h.y,d.y,u.y,g,x,y),Ha.initNonuniformCatmullRom(c.z,h.z,d.z,u.z,g,x,y)}else this.curveType==="catmullrom"&&(Oa.initCatmullRom(c.x,h.x,d.x,u.x,this.tension),ka.initCatmullRom(c.y,h.y,d.y,u.y,this.tension),Ha.initCatmullRom(c.z,h.z,d.z,u.z,this.tension));return n.set(Oa.calc(l),ka.calc(l),Ha.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new M().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};Lo.prototype.isCatmullRomCurve3=!0;function Yu(r,e,t,n,i){let s=(n-e)*.5,o=(i-t)*.5,a=r*r,l=r*a;return(2*t-2*n+s+o)*l+(-3*t+3*n-2*s-o)*a+s*r+t}function Bv(r,e){let t=1-r;return t*t*e}function Nv(r,e){return 2*(1-r)*r*e}function Uv(r,e){return r*r*e}function kr(r,e,t,n){return Bv(r,e)+Nv(r,t)+Uv(r,n)}function Ov(r,e){let t=1-r;return t*t*t*e}function kv(r,e){let t=1-r;return 3*t*t*r*e}function Hv(r,e){return 3*(1-r)*r*r*e}function Gv(r,e){return r*r*r*e}function Hr(r,e,t,n,i){return Ov(r,e)+kv(r,t)+Hv(r,n)+Gv(r,i)}var ls=class extends kt{constructor(e=new se,t=new se,n=new se,i=new se){super(),this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new se){let n=t,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(Hr(e,i.x,s.x,o.x,a.x),Hr(e,i.y,s.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}};ls.prototype.isCubicBezierCurve=!0;var Ro=class extends kt{constructor(e=new M,t=new M,n=new M,i=new M){super(),this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new M){let n=t,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(Hr(e,i.x,s.x,o.x,a.x),Hr(e,i.y,s.y,o.y,a.y),Hr(e,i.z,s.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}};Ro.prototype.isCubicBezierCurve3=!0;var sr=class extends kt{constructor(e=new se,t=new se){super(),this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new se){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t){let n=t||new se;return n.copy(this.v2).sub(this.v1).normalize(),n}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};sr.prototype.isLineCurve=!0;var Tl=class extends kt{constructor(e=new M,t=new M){super(),this.type="LineCurve3",this.isLineCurve3=!0,this.v1=e,this.v2=t}getPoint(e,t=new M){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},cs=class extends kt{constructor(e=new se,t=new se,n=new se){super(),this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new se){let n=t,i=this.v0,s=this.v1,o=this.v2;return n.set(kr(e,i.x,s.x,o.x),kr(e,i.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};cs.prototype.isQuadraticBezierCurve=!0;var Co=class extends kt{constructor(e=new M,t=new M,n=new M){super(),this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new M){let n=t,i=this.v0,s=this.v1,o=this.v2;return n.set(kr(e,i.x,s.x,o.x),kr(e,i.y,s.y,o.y),kr(e,i.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}};Co.prototype.isQuadraticBezierCurve3=!0;var us=class extends kt{constructor(e=[]){super(),this.type="SplineCurve",this.points=e}getPoint(e,t=new se){let n=t,i=this.points,s=(i.length-1)*e,o=Math.floor(s),a=s-o,l=i[o===0?o:o-1],c=i[o],u=i[o>i.length-2?i.length-1:o+1],h=i[o>i.length-3?i.length-1:o+2];return n.set(Yu(a,l.x,c.x,u.x,h.x),Yu(a,l.y,c.y,u.y,h.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new se().fromArray(i))}return this}};us.prototype.isSplineCurve=!0;var Vv=Object.freeze({__proto__:null,ArcCurve:Ao,CatmullRomCurve3:Lo,CubicBezierCurve:ls,CubicBezierCurve3:Ro,EllipseCurve:rr,LineCurve:sr,LineCurve3:Tl,QuadraticBezierCurve:cs,QuadraticBezierCurve3:Co,SplineCurve:us}),El=class extends kt{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);e.equals(t)||this.curves.push(new sr(t,e))}getPoint(e){let t=e*this.getLength(),n=this.getCurveLengths(),i=0;for(;i<n.length;){if(n[i]>=t){let s=n[i]-t,o=this.curves[i],a=o.getLength(),l=a===0?0:1-s/a;return o.getPointAt(l)}i++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let i=0,s=this.curves;i<s.length;i++){let o=s[i],a=o&&o.isEllipseCurve?e*2:o&&(o.isLineCurve||o.isLineCurve3)?1:o&&o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){let u=l[c];n&&n.equals(u)||(t.push(u),n=u)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(new Vv[i.type]().fromJSON(i))}return this}},or=class extends El{constructor(e){super(),this.type="Path",this.currentPoint=new se,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new sr(this.currentPoint.clone(),new se(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){let s=new cs(this.currentPoint.clone(),new se(e,t),new se(n,i));return this.curves.push(s),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,s,o){let a=new ls(this.currentPoint.clone(),new se(e,t),new se(n,i),new se(s,o));return this.curves.push(a),this.currentPoint.set(s,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new us(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,s,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,n,i,s,o),this}absarc(e,t,n,i,s,o){return this.absellipse(e,t,n,n,i,s,o),this}ellipse(e,t,n,i,s,o,a,l){let c=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(e+c,t+u,n,i,s,o,a,l),this}absellipse(e,t,n,i,s,o,a,l){let c=new rr(e,t,n,i,s,o,a,l);if(this.curves.length>0){let h=c.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(c);let u=c.getPoint(1);return this.currentPoint.copy(u),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},Qn=class extends or{constructor(e){super(e),this.uuid=hn(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(new or().fromJSON(i))}return this}},Qt=class extends nt{constructor(e,t=1){super(),this.type="Light",this.color=new ge(e),this.intensity=t}dispose(){}copy(e){return super.copy(e),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}};Qt.prototype.isLight=!0;var Al=class extends Qt{constructor(e,t,n){super(e,n),this.type="HemisphereLight",this.position.copy(nt.DefaultUp),this.updateMatrix(),this.groundColor=new ge(t)}copy(e){return Qt.prototype.copy.call(this,e),this.groundColor.copy(e.groundColor),this}};Al.prototype.isHemisphereLight=!0;var Zu=new Ie,Ju=new M,ju=new M,hs=class{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.mapSize=new se(512,512),this.map=null,this.mapPass=null,this.matrix=new Ie,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ki,this._frameExtents=new se(1,1),this._viewportCount=1,this._viewports=[new Je(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Ju.setFromMatrixPosition(e.matrixWorld),t.position.copy(Ju),ju.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(ju),t.updateMatrixWorld(),Zu.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Zu),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(t.projectionMatrix),n.multiply(t.matrixWorldInverse)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Po=class extends hs{constructor(){super(new Tt(50,1,.5,500)),this.focus=1}updateMatrices(e){let t=this.camera,n=qa*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;(n!==t.fov||i!==t.aspect||s!==t.far)&&(t.fov=n,t.aspect=i,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}};Po.prototype.isSpotLightShadow=!0;var Ll=class extends Qt{constructor(e,t,n=0,i=Math.PI/3,s=0,o=1){super(e,t),this.type="SpotLight",this.position.copy(nt.DefaultUp),this.updateMatrix(),this.target=new nt,this.distance=n,this.angle=i,this.penumbra=s,this.decay=o,this.shadow=new Po}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};Ll.prototype.isSpotLight=!0;var $u=new Ie,Dr=new M,Ga=new M,Do=class extends hs{constructor(){super(new Tt(90,1,.5,500)),this._frameExtents=new se(4,2),this._viewportCount=6,this._viewports=[new Je(2,1,1,1),new Je(0,1,1,1),new Je(3,1,1,1),new Je(1,1,1,1),new Je(3,0,1,1),new Je(1,0,1,1)],this._cubeDirections=[new M(1,0,0),new M(-1,0,0),new M(0,0,1),new M(0,0,-1),new M(0,1,0),new M(0,-1,0)],this._cubeUps=[new M(0,1,0),new M(0,1,0),new M(0,1,0),new M(0,1,0),new M(0,0,1),new M(0,0,-1)]}updateMatrices(e,t=0){let n=this.camera,i=this.matrix,s=e.distance||n.far;s!==n.far&&(n.far=s,n.updateProjectionMatrix()),Dr.setFromMatrixPosition(e.matrixWorld),n.position.copy(Dr),Ga.copy(n.position),Ga.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(Ga),n.updateMatrixWorld(),i.makeTranslation(-Dr.x,-Dr.y,-Dr.z),$u.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix($u)}};Do.prototype.isPointLightShadow=!0;var Rl=class extends Qt{constructor(e,t,n=0,i=1){super(e,t),this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Do}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}};Rl.prototype.isPointLight=!0;var ar=class extends jr{constructor(e=-1,t=1,n=1,i=-1,s=.1,o=2e3){super(),this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,s=n-e,o=n+e,a=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};ar.prototype.isOrthographicCamera=!0;var Fo=class extends hs{constructor(){super(new ar(-5,5,5,-5,.5,500))}};Fo.prototype.isDirectionalLightShadow=!0;var Cl=class extends Qt{constructor(e,t){super(e,t),this.type="DirectionalLight",this.position.copy(nt.DefaultUp),this.updateMatrix(),this.target=new nt,this.shadow=new Fo}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};Cl.prototype.isDirectionalLight=!0;var Pl=class extends Qt{constructor(e,t){super(e,t),this.type="AmbientLight"}};Pl.prototype.isAmbientLight=!0;var Dl=class extends Qt{constructor(e,t,n=10,i=10){super(e,t),this.type="RectAreaLight",this.width=n,this.height=i}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){let t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}};Dl.prototype.isRectAreaLight=!0;var Io=class{constructor(){this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new M)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){let n=e.x,i=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.282095),t.addScaledVector(o[1],.488603*i),t.addScaledVector(o[2],.488603*s),t.addScaledVector(o[3],.488603*n),t.addScaledVector(o[4],1.092548*(n*i)),t.addScaledVector(o[5],1.092548*(i*s)),t.addScaledVector(o[6],.315392*(3*s*s-1)),t.addScaledVector(o[7],1.092548*(n*s)),t.addScaledVector(o[8],.546274*(n*n-i*i)),t}getIrradianceAt(e,t){let n=e.x,i=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.886227),t.addScaledVector(o[1],2*.511664*i),t.addScaledVector(o[2],2*.511664*s),t.addScaledVector(o[3],2*.511664*n),t.addScaledVector(o[4],2*.429043*n*i),t.addScaledVector(o[5],2*.429043*i*s),t.addScaledVector(o[6],.743125*s*s-.247708),t.addScaledVector(o[7],2*.429043*n*s),t.addScaledVector(o[8],.429043*(n*n-i*i)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(e.coefficients[n],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let n=0;n<9;n++)this.coefficients[n].lerp(e.coefficients[n],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].fromArray(e,t+i*3);return this}toArray(e=[],t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].toArray(e,t+i*3);return e}static getBasisAt(e,t){let n=e.x,i=e.y,s=e.z;t[0]=.282095,t[1]=.488603*i,t[2]=.488603*s,t[3]=.488603*n,t[4]=1.092548*n*i,t[5]=1.092548*i*s,t[6]=.315392*(3*s*s-1),t[7]=1.092548*n*s,t[8]=.546274*(n*n-i*i)}};Io.prototype.isSphericalHarmonics3=!0;var ds=class extends Qt{constructor(e=new Io,t=1){super(void 0,t),this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){let t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}};ds.prototype.isLightProbe=!0;var Fl=class{static decodeText(e){if(typeof TextDecoder!="undefined")return new TextDecoder().decode(e);let t="";for(let n=0,i=e.length;n<i;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.substr(0,t+1)}},Il=class extends $e{constructor(){super(),this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}clone(){return new this.constructor().copy(this)}toJSON(){let e=super.toJSON(this);return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}};Il.prototype.isInstancedBufferGeometry=!0;var zl=class extends ct{constructor(e,t,n,i){typeof n=="number"&&(i=n,n=!1,console.error("THREE.InstancedBufferAttribute: The constructor now expects normalized as the third argument.")),super(e,t,n),this.meshPerAttribute=i||1}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}};zl.prototype.isInstancedBufferAttribute=!0;var Bl=class extends wn{constructor(e){super(e),typeof createImageBitmap=="undefined"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch=="undefined"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,o=ir.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,fetch(e,a).then(function(l){return l.blob()}).then(function(l){return createImageBitmap(l,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(l){ir.add(e,l),t&&t(l),s.manager.itemEnd(e)}).catch(function(l){i&&i(l),s.manager.itemError(e),s.manager.itemEnd(e)}),s.manager.itemStart(e)}};Bl.prototype.isImageBitmapLoader=!0;var Nl=class{constructor(){this.type="ShapePath",this.color=new ge,this.subPaths=[],this.currentPath=null}moveTo(e,t){return this.currentPath=new or,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t),this}lineTo(e,t){return this.currentPath.lineTo(e,t),this}quadraticCurveTo(e,t,n,i){return this.currentPath.quadraticCurveTo(e,t,n,i),this}bezierCurveTo(e,t,n,i,s,o){return this.currentPath.bezierCurveTo(e,t,n,i,s,o),this}splineThru(e){return this.currentPath.splineThru(e),this}toShapes(e,t){function n(p){let R=[];for(let A=0,C=p.length;A<C;A++){let w=p[A],F=new Qn;F.curves=w.curves,R.push(F)}return R}function i(p,R){let A=R.length,C=!1;for(let w=A-1,F=0;F<A;w=F++){let B=R[w],O=R[F],H=O.x-B.x,K=O.y-B.y;if(Math.abs(K)>Number.EPSILON){if(K<0&&(B=R[F],H=-H,O=R[w],K=-K),p.y<B.y||p.y>O.y)continue;if(p.y===B.y){if(p.x===B.x)return!0}else{let q=K*(p.x-B.x)-H*(p.y-B.y);if(q===0)return!0;if(q<0)continue;C=!C}}else{if(p.y!==B.y)continue;if(O.x<=p.x&&p.x<=B.x||B.x<=p.x&&p.x<=O.x)return!0}}return C}let s=Dn.isClockWise,o=this.subPaths;if(o.length===0)return[];if(t===!0)return n(o);let a,l,c,u=[];if(o.length===1)return l=o[0],c=new Qn,c.curves=l.curves,u.push(c),u;let h=!s(o[0].getPoints());h=e?!h:h;let d=[],f=[],g=[],x=0,y;f[x]=void 0,g[x]=[];for(let p=0,R=o.length;p<R;p++)l=o[p],y=l.getPoints(),a=s(y),a=e?!a:a,a?(!h&&f[x]&&x++,f[x]={s:new Qn,p:y},f[x].s.curves=l.curves,h&&x++,g[x]=[]):g[x].push({h:l,p:y[0]});if(!f[0])return n(o);if(f.length>1){let p=!1,R=[];for(let A=0,C=f.length;A<C;A++)d[A]=[];for(let A=0,C=f.length;A<C;A++){let w=g[A];for(let F=0;F<w.length;F++){let B=w[F],O=!0;for(let H=0;H<f.length;H++)i(B.p,f[H].p)&&(A!==H&&R.push({froms:A,tos:H,hole:F}),O?(O=!1,d[H].push(B)):p=!0);O&&d[A].push(B)}}R.length>0&&(p||(g=d))}let m;for(let p=0,R=f.length;p<R;p++){c=f[p].s,u.push(c),m=g[p];for(let A=0,C=m.length;A<C;A++)c.holes.push(m[A].h)}return u}},Ul=class{constructor(e){this.type="Font",this.data=e}generateShapes(e,t=100){let n=[],i=Wv(e,t,this.data);for(let s=0,o=i.length;s<o;s++)Array.prototype.push.apply(n,i[s].toShapes());return n}};function Wv(r,e,t){let n=Array.from(r),i=e/t.resolution,s=(t.boundingBox.yMax-t.boundingBox.yMin+t.underlineThickness)*i,o=[],a=0,l=0;for(let c=0;c<n.length;c++){let u=n[c];if(u===`
`)a=0,l-=s;else{let h=qv(u,i,a,l,t);a+=h.offsetX,o.push(h.path)}}return o}function qv(r,e,t,n,i){let s=i.glyphs[r]||i.glyphs["?"];if(!s){console.error('THREE.Font: character "'+r+'" does not exists in font family '+i.familyName+".");return}let o=new Nl,a,l,c,u,h,d,f,g;if(s.o){let x=s._cachedOutline||(s._cachedOutline=s.o.split(" "));for(let y=0,m=x.length;y<m;)switch(x[y++]){case"m":a=x[y++]*e+t,l=x[y++]*e+n,o.moveTo(a,l);break;case"l":a=x[y++]*e+t,l=x[y++]*e+n,o.lineTo(a,l);break;case"q":c=x[y++]*e+t,u=x[y++]*e+n,h=x[y++]*e+t,d=x[y++]*e+n,o.quadraticCurveTo(h,d,c,u);break;case"b":c=x[y++]*e+t,u=x[y++]*e+n,h=x[y++]*e+t,d=x[y++]*e+n,f=x[y++]*e+t,g=x[y++]*e+n,o.bezierCurveTo(h,d,f,g,c,u);break}}return{offsetX:s.ha*e,path:o}}Ul.prototype.isFont=!0;var Qs,Xv={getContext:function(){return Qs===void 0&&(Qs=new(window.AudioContext||window.webkitAudioContext)),Qs},setContext:function(r){Qs=r}},Ol=class extends wn{constructor(e){super(e)}load(e,t,n,i){let s=this,o=new Ml(this.manager);o.setResponseType("arraybuffer"),o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(a){try{let l=a.slice(0);Xv.getContext().decodeAudioData(l,function(u){t(u)})}catch(l){i?i(l):console.error(l),s.manager.itemError(e)}},n,i)}},kl=class extends ds{constructor(e,t,n=1){super(void 0,n);let i=new ge().set(e),s=new ge().set(t),o=new M(i.r,i.g,i.b),a=new M(s.r,s.g,s.b),l=Math.sqrt(Math.PI),c=l*Math.sqrt(.75);this.sh.coefficients[0].copy(o).add(a).multiplyScalar(l),this.sh.coefficients[1].copy(o).sub(a).multiplyScalar(c)}};kl.prototype.isHemisphereLightProbe=!0;var Hl=class extends ds{constructor(e,t=1){super(void 0,t);let n=new ge().set(e);this.sh.coefficients[0].set(n.r,n.g,n.b).multiplyScalar(2*Math.sqrt(Math.PI))}};Hl.prototype.isAmbientLightProbe=!0;var Gl=class extends nt{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0){console.warn("THREE.Audio: Audio is already playing.");return}if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}this._startedAt=this.context.currentTime+e;let t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this._progress=0,this.source.stop(),this.source.onended=null,this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){if(this.detune=e,this.source.detune!==void 0)return this.isPlaying===!0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}};var Vl=class{constructor(e,t=2048){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=t,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let e=0,t=this.getFrequencyData();for(let n=0;n<t.length;n++)e+=t[n];return e/t.length}},Wl=class{constructor(e,t,n){this.binding=e,this.valueSize=n;let i,s,o;switch(t){case"quaternion":i=this._slerp,s=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":i=this._select,s=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:i=this._lerp,s=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=s,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){let n=this.buffer,i=this.valueSize,s=e*i+i,o=this.cumulativeWeight;if(o===0){for(let a=0;a!==i;++a)n[s+a]=n[a];o=t}else{o+=t;let a=t/o;this._mixBufferRegion(n,s,0,a,i)}this.cumulativeWeight=o}accumulateAdditive(e){let t=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,i,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){let t=this.valueSize,n=this.buffer,i=e*t+t,s=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){let l=t*this._origIndex;this._mixBufferRegion(n,i,l,1-s,t)}o>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(n[l]!==n[l+t]){a.setValue(n,i);break}}saveOriginalState(){let e=this.binding,t=this.buffer,n=this.valueSize,i=n*this._origIndex;e.getValue(t,i);for(let s=n,o=i;s!==o;++s)t[s]=t[i+s%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){let e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){let e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){let e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,i,s){if(i>=.5)for(let o=0;o!==s;++o)e[t+o]=e[n+o]}_slerp(e,t,n,i){Et.slerpFlat(e,t,e,t,e,n,i)}_slerpAdditive(e,t,n,i,s){let o=this._workIndex*s;Et.multiplyQuaternionsFlat(e,o,e,t,e,n),Et.slerpFlat(e,t,e,t,e,o,i)}_lerp(e,t,n,i,s){let o=1-i;for(let a=0;a!==s;++a){let l=t+a;e[l]=e[l]*o+e[n+a]*i}}_lerpAdditive(e,t,n,i,s){for(let o=0;o!==s;++o){let a=t+o;e[a]=e[a]+e[n+o]*i}}},hc="\\[\\]\\.:\\/",Yv=new RegExp("["+hc+"]","g"),dc="[^"+hc+"]",Zv="[^"+hc.replace("\\.","")+"]",Jv=/((?:WC+[\/:])*)/.source.replace("WC",dc),jv=/(WCOD+)?/.source.replace("WCOD",Zv),$v=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",dc),Kv=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",dc),Qv=new RegExp("^"+Jv+jv+$v+Kv+"$"),ex=["material","materials","bones"],ql=class{constructor(e,t,n){let i=n||rt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},rt=class r{constructor(e,t,n){this.path=t,this.parsedPath=n||r.parseTrackName(t),this.node=r.findNode(e,this.parsedPath.nodeName)||e,this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new r.Composite(e,t,n):new r(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Yv,"")}static parseTrackName(e){let t=Qv.exec(e);if(!t)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let s=n.nodeName.substring(i+1);ex.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(!t||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.node[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,s=t.propertyIndex;if(e||(e=r.findNode(this.rootNode,t.nodeName)||this.rootNode,this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.error("THREE.PropertyBinding: Trying to update node for track: "+this.path+" but it wasn't found.");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[i];if(o===void 0){let c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(e.geometry.isBufferGeometry){if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}else{console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences on THREE.Geometry. Use THREE.BufferGeometry instead.",this);return}}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};rt.Composite=ql;rt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};rt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};rt.prototype.GetterByBindingType=[rt.prototype._getValue_direct,rt.prototype._getValue_array,rt.prototype._getValue_arrayElement,rt.prototype._getValue_toArray];rt.prototype.SetterByBindingTypeAndVersioning=[[rt.prototype._setValue_direct,rt.prototype._setValue_direct_setNeedsUpdate,rt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_array,rt.prototype._setValue_array_setNeedsUpdate,rt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_arrayElement,rt.prototype._setValue_arrayElement_setNeedsUpdate,rt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_fromArray,rt.prototype._setValue_fromArray_setNeedsUpdate,rt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Xl=class{constructor(){this.uuid=hn(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;let e={};this._indicesByUUID=e;for(let n=0,i=arguments.length;n!==i;++n)e[arguments[n].uuid]=n;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};let t=this;this.stats={objects:{get total(){return t._objects.length},get inUse(){return this.total-t.nCachedObjects_}},get bindingsPerObject(){return t._bindings.length}}}add(){let e=this._objects,t=this._indicesByUUID,n=this._paths,i=this._parsedPaths,s=this._bindings,o=s.length,a,l=e.length,c=this.nCachedObjects_;for(let u=0,h=arguments.length;u!==h;++u){let d=arguments[u],f=d.uuid,g=t[f];if(g===void 0){g=l++,t[f]=g,e.push(d);for(let x=0,y=o;x!==y;++x)s[x].push(new rt(d,n[x],i[x]))}else if(g<c){a=e[g];let x=--c,y=e[x];t[y.uuid]=g,e[g]=y,t[f]=x,e[x]=d;for(let m=0,p=o;m!==p;++m){let R=s[m],A=R[x],C=R[g];R[g]=A,C===void 0&&(C=new rt(d,n[m],i[m])),R[x]=C}}else e[g]!==a&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=c}remove(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,s=this.nCachedObjects_;for(let o=0,a=arguments.length;o!==a;++o){let l=arguments[o],c=l.uuid,u=t[c];if(u!==void 0&&u>=s){let h=s++,d=e[h];t[d.uuid]=u,e[u]=d,t[c]=h,e[h]=l;for(let f=0,g=i;f!==g;++f){let x=n[f],y=x[h],m=x[u];x[u]=y,x[h]=m}}}this.nCachedObjects_=s}uncache(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,s=this.nCachedObjects_,o=e.length;for(let a=0,l=arguments.length;a!==l;++a){let c=arguments[a],u=c.uuid,h=t[u];if(h!==void 0)if(delete t[u],h<s){let d=--s,f=e[d],g=--o,x=e[g];t[f.uuid]=h,e[h]=f,t[x.uuid]=d,e[d]=x,e.pop();for(let y=0,m=i;y!==m;++y){let p=n[y],R=p[d],A=p[g];p[h]=R,p[d]=A,p.pop()}}else{let d=--o,f=e[d];d>0&&(t[f.uuid]=h),e[h]=f,e.pop();for(let g=0,x=i;g!==x;++g){let y=n[g];y[h]=y[d],y.pop()}}}this.nCachedObjects_=s}subscribe_(e,t){let n=this._bindingsIndicesByPath,i=n[e],s=this._bindings;if(i!==void 0)return s[i];let o=this._paths,a=this._parsedPaths,l=this._objects,c=l.length,u=this.nCachedObjects_,h=new Array(c);i=s.length,n[e]=i,o.push(e),a.push(t),s.push(h);for(let d=u,f=l.length;d!==f;++d){let g=l[d];h[d]=new rt(g,e,t)}return h}unsubscribe_(e){let t=this._bindingsIndicesByPath,n=t[e];if(n!==void 0){let i=this._paths,s=this._parsedPaths,o=this._bindings,a=o.length-1,l=o[a],c=e[a];t[c]=n,o[n]=l,o.pop(),s[n]=s[a],s.pop(),i[n]=i[a],i.pop()}}};Xl.prototype.isAnimationObjectGroup=!0;var Yl=class{constructor(e,t,n=null,i=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=i;let s=t.tracks,o=s.length,a=new Array(o),l={endingStart:Wi,endingEnd:Wi};for(let c=0;c!==o;++c){let u=s[c].createInterpolant(null);a[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=Ff,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n){if(e.fadeOut(t),this.fadeIn(t),n){let i=this._clip.duration,s=e._clip.duration,o=s/i,a=i/s;e.warp(1,o,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,n){return e.crossFadeFrom(this,t,n)}stopFading(){let e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){let i=this._mixer,s=i.time,o=this.timeScale,a=this._timeScaleInterpolant;a===null&&(a=i._lendControlInterpolant(),this._timeScaleInterpolant=a);let l=a.parameterPositions,c=a.sampleValues;return l[0]=s,l[1]=s+n,c[0]=e/o,c[1]=t/o,this}stopWarping(){let e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,i){if(!this.enabled){this._updateWeight(e);return}let s=this._startTime;if(s!==null){let l=(e-s)*n;if(l<0||n===0)return;this._startTime=null,t=n*l}t*=this._updateTimeScale(e);let o=this._updateTime(t),a=this._updateWeight(e);if(a>0){let l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case rh:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulateAdditive(a);break;case lc:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulate(i,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;let n=this._weightInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;let n=this._timeScaleInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){let t=this._clip.duration,n=this.loop,i=this.time+e,s=this._loopCount,o=n===If;if(e===0)return s===-1?i:o&&(s&1)===1?t-i:i;if(n===Df){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i>=t)i=t;else if(i<0)i=0;else{this.time=i;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),i>=t||i<0){let a=Math.floor(i/t);i-=t*a,s+=Math.abs(a);let l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=e>0?t:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){let c=e<0;this._setEndings(c,!c,o)}else this._setEndings(!1,!1,o);this._loopCount=s,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=i;if(o&&(s&1)===1)return t-i}return i}_setEndings(e,t,n){let i=this._interpolantSettings;n?(i.endingStart=qi,i.endingEnd=qi):(e?i.endingStart=this.zeroSlopeAtStart?qi:Wi:i.endingStart=lo,t?i.endingEnd=this.zeroSlopeAtEnd?qi:Wi:i.endingEnd=lo)}_scheduleFading(e,t,n){let i=this._mixer,s=i.time,o=this._weightInterpolant;o===null&&(o=i._lendControlInterpolant(),this._weightInterpolant=o);let a=o.parameterPositions,l=o.sampleValues;return a[0]=s,l[0]=t,a[1]=s+e,l[1]=n,this}},Zl=class extends Fn{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){let n=e._localRoot||this._root,i=e._clip.tracks,s=i.length,o=e._propertyBindings,a=e._interpolants,l=n.uuid,c=this._bindingsByRootAndName,u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){let d=i[h],f=d.name,g=u[f];if(g!==void 0)o[h]=g;else{if(g=o[h],g!==void 0){g._cacheIndex===null&&(++g.referenceCount,this._addInactiveBinding(g,l,f));continue}let x=t&&t._propertyBindings[h].binding.parsedPath;g=new Wl(rt.create(n,f,x),d.ValueTypeName,d.getValueSize()),++g.referenceCount,this._addInactiveBinding(g,l,f),o[h]=g}a[h].resultBuffer=g.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){let n=(e._localRoot||this._root).uuid,i=e._clip.uuid,s=this._actionsByClip[i];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,i,n)}let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;let e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){let t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,n){let i=this._actions,s=this._actionsByClip,o=s[t];if(o===void 0)o={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=o;else{let a=o.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=i.length,i.push(e),o.actionByRoot[n]=e}_removeInactiveAction(e){let t=this._actions,n=t[t.length-1],i=e._cacheIndex;n._cacheIndex=i,t[i]=n,t.pop(),e._cacheIndex=null;let s=e._clip.uuid,o=this._actionsByClip,a=o[s],l=a.knownActions,c=l[l.length-1],u=e._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),e._byClipCacheIndex=null;let h=a.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],l.length===0&&delete o[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let s=t[n];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){let t=this._actions,n=e._cacheIndex,i=this._nActiveActions++,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_takeBackAction(e){let t=this._actions,n=e._cacheIndex,i=--this._nActiveActions,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_addInactiveBinding(e,t,n){let i=this._bindingsByRootAndName,s=this._bindings,o=i[t];o===void 0&&(o={},i[t]=o),o[n]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){let t=this._bindings,n=e.binding,i=n.rootNode.uuid,s=n.path,o=this._bindingsByRootAndName,a=o[i],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete a[s],Object.keys(a).length===0&&delete o[i]}_lendBinding(e){let t=this._bindings,n=e._cacheIndex,i=this._nActiveBindings++,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_takeBackBinding(e){let t=this._bindings,n=e._cacheIndex,i=--this._nActiveBindings,s=t[i];e._cacheIndex=i,t[i]=e,s._cacheIndex=n,t[n]=s}_lendControlInterpolant(){let e=this._controlInterpolants,t=this._nActiveControlInterpolants++,n=e[t];return n===void 0&&(n=new Mo(new Float32Array(2),new Float32Array(2),1,this._controlInterpolantsResultBuffer),n.__cacheIndex=t,e[t]=n),n}_takeBackControlInterpolant(e){let t=this._controlInterpolants,n=e.__cacheIndex,i=--this._nActiveControlInterpolants,s=t[i];e.__cacheIndex=i,t[i]=e,s.__cacheIndex=n,t[n]=s}clipAction(e,t,n){let i=t||this._root,s=i.uuid,o=typeof e=="string"?To.findByName(i,e):e,a=o!==null?o.uuid:e,l=this._actionsByClip[a],c=null;if(n===void 0&&(o!==null?n=o.blendMode:n=lc),l!==void 0){let h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===n)return h;c=l.knownActions[0],o===null&&(o=c._clip)}if(o===null)return null;let u=new Yl(this,o,t,n);return this._bindAction(u,c),this._addInactiveAction(u,a,s),u}existingAction(e,t){let n=t||this._root,i=n.uuid,s=typeof e=="string"?To.findByName(n,e):e,o=s?s.uuid:e,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[i]||null}stopAllAction(){let e=this._actions,t=this._nActiveActions;for(let n=t-1;n>=0;--n)e[n].stop();return this}update(e){e*=this.timeScale;let t=this._actions,n=this._nActiveActions,i=this.time+=e,s=Math.sign(e),o=this._accuIndex^=1;for(let c=0;c!==n;++c)t[c]._update(i,e,s,o);let a=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)a[c].apply(o);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){let t=this._actions,n=e.uuid,i=this._actionsByClip,s=i[n];if(s!==void 0){let o=s.knownActions;for(let a=0,l=o.length;a!==l;++a){let c=o[a];this._deactivateAction(c);let u=c._cacheIndex,h=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(c)}delete i[n]}}uncacheRoot(e){let t=e.uuid,n=this._actionsByClip;for(let o in n){let a=n[o].actionByRoot,l=a[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}let i=this._bindingsByRootAndName,s=i[t];if(s!==void 0)for(let o in s){let a=s[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(e,t){let n=this.existingAction(e,t);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}};Zl.prototype._controlInterpolantsResultBuffer=new Float32Array(1);var Jl=class r{constructor(e){typeof e=="string"&&(console.warn("THREE.Uniform: Type parameter is no longer needed."),e=arguments[1]),this.value=e}clone(){return new r(this.value.clone===void 0?this.value:this.value.clone())}},jl=class extends vi{constructor(e,t,n=1){super(e,t),this.meshPerAttribute=n||1}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}};jl.prototype.isInstancedInterleavedBuffer=!0;var $l=class{constructor(e,t,n,i,s){this.buffer=e,this.type=t,this.itemSize=n,this.elementSize=i,this.count=s,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}};$l.prototype.isGLBufferAttribute=!0;var Ku=new se,_i=class{constructor(e=new se(1/0,1/0),t=new se(-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Ku.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return e===void 0&&(console.warn("THREE.Box2: .getCenter() target is now required"),e=new se),this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(console.warn("THREE.Box2: .getSize() target is now required"),e=new se),this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t===void 0&&(console.warn("THREE.Box2: .getParameter() target is now required"),t=new se),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y)}clampPoint(e,t){return t===void 0&&(console.warn("THREE.Box2: .clampPoint() target is now required"),t=new se),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return Ku.copy(e).clamp(this.min,this.max).sub(e).length()}intersect(e){return this.min.max(e.min),this.max.min(e.max),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}};_i.prototype.isBox2=!0;var Qu=new M,eo=new M,Kl=class{constructor(e=new M,t=new M){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e===void 0&&(console.warn("THREE.Line3: .getCenter() target is now required"),e=new M),e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e===void 0&&(console.warn("THREE.Line3: .delta() target is now required"),e=new M),e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return t===void 0&&(console.warn("THREE.Line3: .at() target is now required"),t=new M),this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){Qu.subVectors(e,this.start),eo.subVectors(this.end,this.start);let n=eo.dot(eo),s=eo.dot(Qu)/n;return t&&(s=Ft(s,0,1)),s}closestPointToPoint(e,t,n){let i=this.closestPointToPointParameter(e,t);return n===void 0&&(console.warn("THREE.Line3: .closestPointToPoint() target is now required"),n=new M),this.delta(n).multiplyScalar(i).add(this.start)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}},Ql=class extends nt{constructor(e){super(),this.material=e,this.render=function(){},this.hasPositions=!1,this.hasNormals=!1,this.hasColors=!1,this.hasUvs=!1,this.positionArray=null,this.normalArray=null,this.colorArray=null,this.uvArray=null,this.count=0}};Ql.prototype.isImmediateRenderObject=!0;var jn=new M,to=new Ie,Va=new Ie,ec=class extends ts{constructor(e){let t=Th(e),n=new $e,i=[],s=[],o=new ge(0,0,1),a=new ge(0,1,0);for(let c=0;c<t.length;c++){let u=t[c];u.parent&&u.parent.isBone&&(i.push(0,0,0),i.push(0,0,0),s.push(o.r,o.g,o.b),s.push(a.r,a.g,a.b))}n.setAttribute("position",new Ke(i,3)),n.setAttribute("color",new Ke(s,3));let l=new xi({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(n,l),this.type="SkeletonHelper",this.isSkeletonHelper=!0,this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(e){let t=this.bones,n=this.geometry,i=n.getAttribute("position");Va.copy(this.root.matrixWorld).invert();for(let s=0,o=0;s<t.length;s++){let a=t[s];a.parent&&a.parent.isBone&&(to.multiplyMatrices(Va,a.matrixWorld),jn.setFromMatrixPosition(to),i.setXYZ(o,jn.x,jn.y,jn.z),to.multiplyMatrices(Va,a.parent.matrixWorld),jn.setFromMatrixPosition(to),i.setXYZ(o+1,jn.x,jn.y,jn.z),o+=2)}n.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(e)}};function Th(r){let e=[];r&&r.isBone&&e.push(r);for(let t=0;t<r.children.length;t++)e.push.apply(e,Th(r.children[t]));return e}var tc=class extends ts{constructor(e=10,t=10,n=4473924,i=8947848){n=new ge(n),i=new ge(i);let s=t/2,o=e/t,a=e/2,l=[],c=[];for(let d=0,f=0,g=-a;d<=t;d++,g+=o){l.push(-a,0,g,a,0,g),l.push(g,0,-a,g,0,a);let x=d===s?n:i;x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3}let u=new $e;u.setAttribute("position",new Ke(l,3)),u.setAttribute("color",new Ke(c,3));let h=new xi({vertexColors:!0,toneMapped:!1});super(u,h),this.type="GridHelper"}};var tx=new Float32Array(1),xx=new Int32Array(tx.buffer);var io=4,Gr=8,yx=Math.pow(2,Gr),Eh=[.125,.215,.35,.446,.526,.582],nx=Gr-io+1+Eh.length;var _x={[ur]:0,[cc]:1,[oh]:2,[ah]:3,[lh]:4,[ch]:5,[sh]:6},ix=new Zr({side:yt,depthWrite:!1,depthTest:!1}),wx=new Xe(new Jr,ix);var{_lodPlanes:bx,_sizeLods:Mx,_sigmas:Sx}=rx();var mi=(1+Math.sqrt(5))/2,Vi=1/mi,Tx=[new M(1,1,1),new M(-1,1,1),new M(1,1,-1),new M(-1,1,-1),new M(0,mi,Vi),new M(0,mi,-Vi),new M(Vi,0,mi),new M(-Vi,0,mi),new M(mi,Vi,0),new M(-mi,Vi,0)];function rx(){let r=[],e=[],t=[],n=Gr;for(let i=0;i<nx;i++){let s=Math.pow(2,n);e.push(s);let o=1/s;i>Gr-io?o=Eh[i-Gr+io-1]:i==0&&(o=0),t.push(o);let a=1/(s-1),l=-a/2,c=1+a/2,u=[l,l,c,l,c,c,l,l,c,c,l,c],h=6,d=6,f=3,g=2,x=1,y=new Float32Array(f*d*h),m=new Float32Array(g*d*h),p=new Float32Array(x*d*h);for(let A=0;A<h;A++){let C=A%3*2/3-1,w=A>2?0:-1,F=[C,w,0,C+2/3,w,0,C+2/3,w+1,0,C,w,0,C+2/3,w+1,0,C,w+1,0];y.set(F,f*d*A),m.set(u,g*d*A);let B=[A,A,A,A,A,A];p.set(B,x*d*A)}let R=new $e;R.setAttribute("position",new ct(y,f)),R.setAttribute("uv",new ct(m,g)),R.setAttribute("faceIndex",new ct(p,x)),r.push(R),n>io&&n--}return{_lodPlanes:r,_sizeLods:e,_sigmas:t}}kt.create=function(r,e){return console.log("THREE.Curve.create() has been deprecated"),r.prototype=Object.create(kt.prototype),r.prototype.constructor=r,r.prototype.getPoint=e,r};or.prototype.fromPoints=function(r){return console.warn("THREE.Path: .fromPoints() has been renamed to .setFromPoints()."),this.setFromPoints(r)};tc.prototype.setColors=function(){console.error("THREE.GridHelper: setColors() has been deprecated, pass them in the constructor instead.")};ec.prototype.update=function(){console.error("THREE.SkeletonHelper: update() no longer needs to be called.")};wn.prototype.extractUrlBase=function(r){return console.warn("THREE.Loader: .extractUrlBase() has been deprecated. Use THREE.LoaderUtils.extractUrlBase() instead."),Fl.extractUrlBase(r)};wn.Handlers={add:function(){console.error("THREE.Loader: Handlers.add() has been removed. Use LoadingManager.addHandler() instead.")},get:function(){console.error("THREE.Loader: Handlers.get() has been removed. Use LoadingManager.getHandler() instead.")}};_i.prototype.center=function(r){return console.warn("THREE.Box2: .center() has been renamed to .getCenter()."),this.getCenter(r)};_i.prototype.empty=function(){return console.warn("THREE.Box2: .empty() has been renamed to .isEmpty()."),this.isEmpty()};_i.prototype.isIntersectionBox=function(r){return console.warn("THREE.Box2: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};_i.prototype.size=function(r){return console.warn("THREE.Box2: .size() has been renamed to .getSize()."),this.getSize(r)};Ot.prototype.center=function(r){return console.warn("THREE.Box3: .center() has been renamed to .getCenter()."),this.getCenter(r)};Ot.prototype.empty=function(){return console.warn("THREE.Box3: .empty() has been renamed to .isEmpty()."),this.isEmpty()};Ot.prototype.isIntersectionBox=function(r){return console.warn("THREE.Box3: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};Ot.prototype.isIntersectionSphere=function(r){return console.warn("THREE.Box3: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(r)};Ot.prototype.size=function(r){return console.warn("THREE.Box3: .size() has been renamed to .getSize()."),this.getSize(r)};ti.prototype.empty=function(){return console.warn("THREE.Sphere: .empty() has been renamed to .isEmpty()."),this.isEmpty()};Ki.prototype.setFromMatrix=function(r){return console.warn("THREE.Frustum: .setFromMatrix() has been renamed to .setFromProjectionMatrix()."),this.setFromProjectionMatrix(r)};Kl.prototype.center=function(r){return console.warn("THREE.Line3: .center() has been renamed to .getCenter()."),this.getCenter(r)};_t.prototype.flattenToArrayOffset=function(r,e){return console.warn("THREE.Matrix3: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(r,e)};_t.prototype.multiplyVector3=function(r){return console.warn("THREE.Matrix3: .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead."),r.applyMatrix3(this)};_t.prototype.multiplyVector3Array=function(){console.error("THREE.Matrix3: .multiplyVector3Array() has been removed.")};_t.prototype.applyToBufferAttribute=function(r){return console.warn("THREE.Matrix3: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix3( matrix ) instead."),r.applyMatrix3(this)};_t.prototype.applyToVector3Array=function(){console.error("THREE.Matrix3: .applyToVector3Array() has been removed.")};_t.prototype.getInverse=function(r){return console.warn("THREE.Matrix3: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead."),this.copy(r).invert()};Ie.prototype.extractPosition=function(r){return console.warn("THREE.Matrix4: .extractPosition() has been renamed to .copyPosition()."),this.copyPosition(r)};Ie.prototype.flattenToArrayOffset=function(r,e){return console.warn("THREE.Matrix4: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(r,e)};Ie.prototype.getPosition=function(){return console.warn("THREE.Matrix4: .getPosition() has been removed. Use Vector3.setFromMatrixPosition( matrix ) instead."),new M().setFromMatrixColumn(this,3)};Ie.prototype.setRotationFromQuaternion=function(r){return console.warn("THREE.Matrix4: .setRotationFromQuaternion() has been renamed to .makeRotationFromQuaternion()."),this.makeRotationFromQuaternion(r)};Ie.prototype.multiplyToArray=function(){console.warn("THREE.Matrix4: .multiplyToArray() has been removed.")};Ie.prototype.multiplyVector3=function(r){return console.warn("THREE.Matrix4: .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};Ie.prototype.multiplyVector4=function(r){return console.warn("THREE.Matrix4: .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};Ie.prototype.multiplyVector3Array=function(){console.error("THREE.Matrix4: .multiplyVector3Array() has been removed.")};Ie.prototype.rotateAxis=function(r){console.warn("THREE.Matrix4: .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead."),r.transformDirection(this)};Ie.prototype.crossVector=function(r){return console.warn("THREE.Matrix4: .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};Ie.prototype.translate=function(){console.error("THREE.Matrix4: .translate() has been removed.")};Ie.prototype.rotateX=function(){console.error("THREE.Matrix4: .rotateX() has been removed.")};Ie.prototype.rotateY=function(){console.error("THREE.Matrix4: .rotateY() has been removed.")};Ie.prototype.rotateZ=function(){console.error("THREE.Matrix4: .rotateZ() has been removed.")};Ie.prototype.rotateByAxis=function(){console.error("THREE.Matrix4: .rotateByAxis() has been removed.")};Ie.prototype.applyToBufferAttribute=function(r){return console.warn("THREE.Matrix4: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix4( matrix ) instead."),r.applyMatrix4(this)};Ie.prototype.applyToVector3Array=function(){console.error("THREE.Matrix4: .applyToVector3Array() has been removed.")};Ie.prototype.makeFrustum=function(r,e,t,n,i,s){return console.warn("THREE.Matrix4: .makeFrustum() has been removed. Use .makePerspective( left, right, top, bottom, near, far ) instead."),this.makePerspective(r,e,n,t,i,s)};Ie.prototype.getInverse=function(r){return console.warn("THREE.Matrix4: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead."),this.copy(r).invert()};$t.prototype.isIntersectionLine=function(r){return console.warn("THREE.Plane: .isIntersectionLine() has been renamed to .intersectsLine()."),this.intersectsLine(r)};Et.prototype.multiplyVector3=function(r){return console.warn("THREE.Quaternion: .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead."),r.applyQuaternion(this)};Et.prototype.inverse=function(){return console.warn("THREE.Quaternion: .inverse() has been renamed to invert()."),this.invert()};ni.prototype.isIntersectionBox=function(r){return console.warn("THREE.Ray: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(r)};ni.prototype.isIntersectionPlane=function(r){return console.warn("THREE.Ray: .isIntersectionPlane() has been renamed to .intersectsPlane()."),this.intersectsPlane(r)};ni.prototype.isIntersectionSphere=function(r){return console.warn("THREE.Ray: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(r)};Ct.prototype.area=function(){return console.warn("THREE.Triangle: .area() has been renamed to .getArea()."),this.getArea()};Ct.prototype.barycoordFromPoint=function(r,e){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),this.getBarycoord(r,e)};Ct.prototype.midpoint=function(r){return console.warn("THREE.Triangle: .midpoint() has been renamed to .getMidpoint()."),this.getMidpoint(r)};Ct.prototypenormal=function(r){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),this.getNormal(r)};Ct.prototype.plane=function(r){return console.warn("THREE.Triangle: .plane() has been renamed to .getPlane()."),this.getPlane(r)};Ct.barycoordFromPoint=function(r,e,t,n,i){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),Ct.getBarycoord(r,e,t,n,i)};Ct.normal=function(r,e,t,n){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),Ct.getNormal(r,e,t,n)};Qn.prototype.extractAllPoints=function(r){return console.warn("THREE.Shape: .extractAllPoints() has been removed. Use .extractPoints() instead."),this.extractPoints(r)};Qn.prototype.extrude=function(r){return console.warn("THREE.Shape: .extrude() has been removed. Use ExtrudeGeometry() instead."),new er(this,r)};Qn.prototype.makeGeometry=function(r){return console.warn("THREE.Shape: .makeGeometry() has been removed. Use ShapeGeometry() instead."),new cl(this,r)};se.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector2: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};se.prototype.distanceToManhattan=function(r){return console.warn("THREE.Vector2: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(r)};se.prototype.lengthManhattan=function(){return console.warn("THREE.Vector2: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};M.prototype.setEulerFromRotationMatrix=function(){console.error("THREE.Vector3: .setEulerFromRotationMatrix() has been removed. Use Euler.setFromRotationMatrix() instead.")};M.prototype.setEulerFromQuaternion=function(){console.error("THREE.Vector3: .setEulerFromQuaternion() has been removed. Use Euler.setFromQuaternion() instead.")};M.prototype.getPositionFromMatrix=function(r){return console.warn("THREE.Vector3: .getPositionFromMatrix() has been renamed to .setFromMatrixPosition()."),this.setFromMatrixPosition(r)};M.prototype.getScaleFromMatrix=function(r){return console.warn("THREE.Vector3: .getScaleFromMatrix() has been renamed to .setFromMatrixScale()."),this.setFromMatrixScale(r)};M.prototype.getColumnFromMatrix=function(r,e){return console.warn("THREE.Vector3: .getColumnFromMatrix() has been renamed to .setFromMatrixColumn()."),this.setFromMatrixColumn(e,r)};M.prototype.applyProjection=function(r){return console.warn("THREE.Vector3: .applyProjection() has been removed. Use .applyMatrix4( m ) instead."),this.applyMatrix4(r)};M.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector3: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};M.prototype.distanceToManhattan=function(r){return console.warn("THREE.Vector3: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(r)};M.prototype.lengthManhattan=function(){return console.warn("THREE.Vector3: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};Je.prototype.fromAttribute=function(r,e,t){return console.warn("THREE.Vector4: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(r,e,t)};Je.prototype.lengthManhattan=function(){return console.warn("THREE.Vector4: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()};nt.prototype.getChildByName=function(r){return console.warn("THREE.Object3D: .getChildByName() has been renamed to .getObjectByName()."),this.getObjectByName(r)};nt.prototype.renderDepth=function(){console.warn("THREE.Object3D: .renderDepth has been removed. Use .renderOrder, instead.")};nt.prototype.translate=function(r,e){return console.warn("THREE.Object3D: .translate() has been removed. Use .translateOnAxis( axis, distance ) instead."),this.translateOnAxis(e,r)};nt.prototype.getWorldRotation=function(){console.error("THREE.Object3D: .getWorldRotation() has been removed. Use THREE.Object3D.getWorldQuaternion( target ) instead.")};nt.prototype.applyMatrix=function(r){return console.warn("THREE.Object3D: .applyMatrix() has been renamed to .applyMatrix4()."),this.applyMatrix4(r)};Object.defineProperties(nt.prototype,{eulerOrder:{get:function(){return console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order},set:function(r){console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order=r}},useQuaternion:{get:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")},set:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")}}});Xe.prototype.setDrawMode=function(){console.error("THREE.Mesh: .setDrawMode() has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.")};Object.defineProperties(Xe.prototype,{drawMode:{get:function(){return console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode."),zf},set:function(){console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.")}}});yo.prototype.initBones=function(){console.error("THREE.SkinnedMesh: initBones() has been removed.")};Tt.prototype.setLens=function(r,e){console.warn("THREE.PerspectiveCamera.setLens is deprecated. Use .setFocalLength and .filmGauge for a photographic setup."),e!==void 0&&(this.filmGauge=e),this.setFocalLength(r)};Object.defineProperties(Qt.prototype,{onlyShadow:{set:function(){console.warn("THREE.Light: .onlyShadow has been removed.")}},shadowCameraFov:{set:function(r){console.warn("THREE.Light: .shadowCameraFov is now .shadow.camera.fov."),this.shadow.camera.fov=r}},shadowCameraLeft:{set:function(r){console.warn("THREE.Light: .shadowCameraLeft is now .shadow.camera.left."),this.shadow.camera.left=r}},shadowCameraRight:{set:function(r){console.warn("THREE.Light: .shadowCameraRight is now .shadow.camera.right."),this.shadow.camera.right=r}},shadowCameraTop:{set:function(r){console.warn("THREE.Light: .shadowCameraTop is now .shadow.camera.top."),this.shadow.camera.top=r}},shadowCameraBottom:{set:function(r){console.warn("THREE.Light: .shadowCameraBottom is now .shadow.camera.bottom."),this.shadow.camera.bottom=r}},shadowCameraNear:{set:function(r){console.warn("THREE.Light: .shadowCameraNear is now .shadow.camera.near."),this.shadow.camera.near=r}},shadowCameraFar:{set:function(r){console.warn("THREE.Light: .shadowCameraFar is now .shadow.camera.far."),this.shadow.camera.far=r}},shadowCameraVisible:{set:function(){console.warn("THREE.Light: .shadowCameraVisible has been removed. Use new THREE.CameraHelper( light.shadow.camera ) instead.")}},shadowBias:{set:function(r){console.warn("THREE.Light: .shadowBias is now .shadow.bias."),this.shadow.bias=r}},shadowDarkness:{set:function(){console.warn("THREE.Light: .shadowDarkness has been removed.")}},shadowMapWidth:{set:function(r){console.warn("THREE.Light: .shadowMapWidth is now .shadow.mapSize.width."),this.shadow.mapSize.width=r}},shadowMapHeight:{set:function(r){console.warn("THREE.Light: .shadowMapHeight is now .shadow.mapSize.height."),this.shadow.mapSize.height=r}}});Object.defineProperties(ct.prototype,{length:{get:function(){return console.warn("THREE.BufferAttribute: .length has been deprecated. Use .count instead."),this.array.length}},dynamic:{get:function(){return console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead."),this.usage===co},set:function(){console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead."),this.setUsage(co)}}});ct.prototype.setDynamic=function(r){return console.warn("THREE.BufferAttribute: .setDynamic() has been deprecated. Use .setUsage() instead."),this.setUsage(r===!0?co:Yr),this};ct.prototype.copyIndicesArray=function(){console.error("THREE.BufferAttribute: .copyIndicesArray() has been removed.")},ct.prototype.setArray=function(){console.error("THREE.BufferAttribute: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers")};$e.prototype.addIndex=function(r){console.warn("THREE.BufferGeometry: .addIndex() has been renamed to .setIndex()."),this.setIndex(r)};$e.prototype.addAttribute=function(r,e){return console.warn("THREE.BufferGeometry: .addAttribute() has been renamed to .setAttribute()."),!(e&&e.isBufferAttribute)&&!(e&&e.isInterleavedBufferAttribute)?(console.warn("THREE.BufferGeometry: .addAttribute() now expects ( name, attribute )."),this.setAttribute(r,new ct(arguments[1],arguments[2]))):r==="index"?(console.warn("THREE.BufferGeometry.addAttribute: Use .setIndex() for index attribute."),this.setIndex(e),this):this.setAttribute(r,e)};$e.prototype.addDrawCall=function(r,e,t){t!==void 0&&console.warn("THREE.BufferGeometry: .addDrawCall() no longer supports indexOffset."),console.warn("THREE.BufferGeometry: .addDrawCall() is now .addGroup()."),this.addGroup(r,e)};$e.prototype.clearDrawCalls=function(){console.warn("THREE.BufferGeometry: .clearDrawCalls() is now .clearGroups()."),this.clearGroups()};$e.prototype.computeOffsets=function(){console.warn("THREE.BufferGeometry: .computeOffsets() has been removed.")};$e.prototype.removeAttribute=function(r){return console.warn("THREE.BufferGeometry: .removeAttribute() has been renamed to .deleteAttribute()."),this.deleteAttribute(r)};$e.prototype.applyMatrix=function(r){return console.warn("THREE.BufferGeometry: .applyMatrix() has been renamed to .applyMatrix4()."),this.applyMatrix4(r)};Object.defineProperties($e.prototype,{drawcalls:{get:function(){return console.error("THREE.BufferGeometry: .drawcalls has been renamed to .groups."),this.groups}},offsets:{get:function(){return console.warn("THREE.BufferGeometry: .offsets has been renamed to .groups."),this.groups}}});vi.prototype.setDynamic=function(r){return console.warn("THREE.InterleavedBuffer: .setDynamic() has been deprecated. Use .setUsage() instead."),this.setUsage(r===!0?co:Yr),this};vi.prototype.setArray=function(){console.error("THREE.InterleavedBuffer: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers")};er.prototype.getArrays=function(){console.error("THREE.ExtrudeGeometry: .getArrays() has been removed.")};er.prototype.addShapeList=function(){console.error("THREE.ExtrudeGeometry: .addShapeList() has been removed.")};er.prototype.addShape=function(){console.error("THREE.ExtrudeGeometry: .addShape() has been removed.")};gi.prototype.dispose=function(){console.error("THREE.Scene: .dispose() has been removed.")};Jl.prototype.onUpdate=function(){return console.warn("THREE.Uniform: .onUpdate() has been removed. Use object.onBeforeRender() instead."),this};Object.defineProperties(Mt.prototype,{wrapAround:{get:function(){console.warn("THREE.Material: .wrapAround has been removed.")},set:function(){console.warn("THREE.Material: .wrapAround has been removed.")}},overdraw:{get:function(){console.warn("THREE.Material: .overdraw has been removed.")},set:function(){console.warn("THREE.Material: .overdraw has been removed.")}},wrapRGB:{get:function(){return console.warn("THREE.Material: .wrapRGB has been removed."),new ge}},shading:{get:function(){console.error("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead.")},set:function(r){console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=r===th}},stencilMask:{get:function(){return console.warn("THREE."+this.type+": .stencilMask has been removed. Use .stencilFuncMask instead."),this.stencilFuncMask},set:function(r){console.warn("THREE."+this.type+": .stencilMask has been removed. Use .stencilFuncMask instead."),this.stencilFuncMask=r}}});Object.defineProperties(tt.prototype,{derivatives:{get:function(){return console.warn("THREE.ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives},set:function(r){console.warn("THREE. ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives=r}}});it.prototype.clearTarget=function(r,e,t,n){console.warn("THREE.WebGLRenderer: .clearTarget() has been deprecated. Use .setRenderTarget() and .clear() instead."),this.setRenderTarget(r),this.clear(e,t,n)};it.prototype.animate=function(r){console.warn("THREE.WebGLRenderer: .animate() is now .setAnimationLoop()."),this.setAnimationLoop(r)};it.prototype.getCurrentRenderTarget=function(){return console.warn("THREE.WebGLRenderer: .getCurrentRenderTarget() is now .getRenderTarget()."),this.getRenderTarget()};it.prototype.getMaxAnisotropy=function(){return console.warn("THREE.WebGLRenderer: .getMaxAnisotropy() is now .capabilities.getMaxAnisotropy()."),this.capabilities.getMaxAnisotropy()};it.prototype.getPrecision=function(){return console.warn("THREE.WebGLRenderer: .getPrecision() is now .capabilities.precision."),this.capabilities.precision};it.prototype.resetGLState=function(){return console.warn("THREE.WebGLRenderer: .resetGLState() is now .state.reset()."),this.state.reset()};it.prototype.supportsFloatTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsFloatTextures() is now .extensions.get( 'OES_texture_float' )."),this.extensions.get("OES_texture_float")};it.prototype.supportsHalfFloatTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsHalfFloatTextures() is now .extensions.get( 'OES_texture_half_float' )."),this.extensions.get("OES_texture_half_float")};it.prototype.supportsStandardDerivatives=function(){return console.warn("THREE.WebGLRenderer: .supportsStandardDerivatives() is now .extensions.get( 'OES_standard_derivatives' )."),this.extensions.get("OES_standard_derivatives")};it.prototype.supportsCompressedTextureS3TC=function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTextureS3TC() is now .extensions.get( 'WEBGL_compressed_texture_s3tc' )."),this.extensions.get("WEBGL_compressed_texture_s3tc")};it.prototype.supportsCompressedTexturePVRTC=function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTexturePVRTC() is now .extensions.get( 'WEBGL_compressed_texture_pvrtc' )."),this.extensions.get("WEBGL_compressed_texture_pvrtc")};it.prototype.supportsBlendMinMax=function(){return console.warn("THREE.WebGLRenderer: .supportsBlendMinMax() is now .extensions.get( 'EXT_blend_minmax' )."),this.extensions.get("EXT_blend_minmax")};it.prototype.supportsVertexTextures=function(){return console.warn("THREE.WebGLRenderer: .supportsVertexTextures() is now .capabilities.vertexTextures."),this.capabilities.vertexTextures};it.prototype.supportsInstancedArrays=function(){return console.warn("THREE.WebGLRenderer: .supportsInstancedArrays() is now .extensions.get( 'ANGLE_instanced_arrays' )."),this.extensions.get("ANGLE_instanced_arrays")};it.prototype.enableScissorTest=function(r){console.warn("THREE.WebGLRenderer: .enableScissorTest() is now .setScissorTest()."),this.setScissorTest(r)};it.prototype.initMaterial=function(){console.warn("THREE.WebGLRenderer: .initMaterial() has been removed.")};it.prototype.addPrePlugin=function(){console.warn("THREE.WebGLRenderer: .addPrePlugin() has been removed.")};it.prototype.addPostPlugin=function(){console.warn("THREE.WebGLRenderer: .addPostPlugin() has been removed.")};it.prototype.updateShadowMap=function(){console.warn("THREE.WebGLRenderer: .updateShadowMap() has been removed.")};it.prototype.setFaceCulling=function(){console.warn("THREE.WebGLRenderer: .setFaceCulling() has been removed.")};it.prototype.allocTextureUnit=function(){console.warn("THREE.WebGLRenderer: .allocTextureUnit() has been removed.")};it.prototype.setTexture=function(){console.warn("THREE.WebGLRenderer: .setTexture() has been removed.")};it.prototype.setTexture2D=function(){console.warn("THREE.WebGLRenderer: .setTexture2D() has been removed.")};it.prototype.setTextureCube=function(){console.warn("THREE.WebGLRenderer: .setTextureCube() has been removed.")};it.prototype.getActiveMipMapLevel=function(){return console.warn("THREE.WebGLRenderer: .getActiveMipMapLevel() is now .getActiveMipmapLevel()."),this.getActiveMipmapLevel()};Object.defineProperties(it.prototype,{shadowMapEnabled:{get:function(){return this.shadowMap.enabled},set:function(r){console.warn("THREE.WebGLRenderer: .shadowMapEnabled is now .shadowMap.enabled."),this.shadowMap.enabled=r}},shadowMapType:{get:function(){return this.shadowMap.type},set:function(r){console.warn("THREE.WebGLRenderer: .shadowMapType is now .shadowMap.type."),this.shadowMap.type=r}},shadowMapCullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")}},context:{get:function(){return console.warn("THREE.WebGLRenderer: .context has been removed. Use .getContext() instead."),this.getContext()}},vr:{get:function(){return console.warn("THREE.WebGLRenderer: .vr has been renamed to .xr"),this.xr}},gammaInput:{get:function(){return console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead."),!1},set:function(){console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead.")}},gammaOutput:{get:function(){return console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead."),!1},set:function(r){console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead."),this.outputEncoding=r===!0?cc:ur}},toneMappingWhitePoint:{get:function(){return console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed."),1},set:function(){console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed.")}}});Object.defineProperties(_h.prototype,{cullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")}},renderReverseSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")}},renderSingleSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")}}});Object.defineProperties(dn.prototype,{wrapS:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS},set:function(r){console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS=r}},wrapT:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT},set:function(r){console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT=r}},magFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter},set:function(r){console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter=r}},minFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter},set:function(r){console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter=r}},anisotropy:{get:function(){return console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy},set:function(r){console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy=r}},offset:{get:function(){return console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset},set:function(r){console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset=r}},repeat:{get:function(){return console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat},set:function(r){console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat=r}},format:{get:function(){return console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format},set:function(r){console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format=r}},type:{get:function(){return console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type},set:function(r){console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type=r}},generateMipmaps:{get:function(){return console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps},set:function(r){console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps=r}}});Gl.prototype.load=function(r){console.warn("THREE.Audio: .load has been deprecated. Use THREE.AudioLoader instead.");let e=this;return new Ol().load(r,function(n){e.setBuffer(n)}),this};Vl.prototype.getData=function(){return console.warn("THREE.AudioAnalyser: .getData() is now .getFrequencyData()."),this.getFrequencyData()};$r.prototype.updateCubeMap=function(r,e){return console.warn("THREE.CubeCamera: .updateCubeMap() is now .update()."),this.update(r,e)};$r.prototype.clear=function(r,e,t,n){return console.warn("THREE.CubeCamera: .clear() is now .renderTarget.clear()."),this.renderTarget.clear(r,e,t,n)};ei.crossOrigin=void 0;ei.loadTexture=function(r,e,t,n){console.warn("THREE.ImageUtils.loadTexture has been deprecated. Use THREE.TextureLoader() instead.");let i=new as;i.setCrossOrigin(this.crossOrigin);let s=i.load(r,t,void 0,n);return e&&(s.mapping=e),s};ei.loadTextureCube=function(r,e,t,n){console.warn("THREE.ImageUtils.loadTextureCube has been deprecated. Use THREE.CubeTextureLoader() instead.");let i=new Sl;i.setCrossOrigin(this.crossOrigin);let s=i.load(r,t,void 0,n);return e&&(s.mapping=e),s};ei.loadCompressedTexture=function(){console.error("THREE.ImageUtils.loadCompressedTexture has been removed. Use THREE.DDSLoader instead.")};ei.loadCompressedTextureCube=function(){console.error("THREE.ImageUtils.loadCompressedTextureCube has been removed. Use THREE.DDSLoader instead.")};typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"128"}}));typeof window!="undefined"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="128");var Ah=`
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
}`,Lh=`
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
}`,Rh=`
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
}`,Ch=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.016, 0.0, abs(r - 0.93)) * 1.2 + 0.5 * smoothstep(0.01, 0.0, abs(r - 0.80));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.865));
  float glow = pow(max(0.0, 1.0 - r), 1.5) * 0.5;
  float a = (ring + dash * 0.8 + glow) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  gl_FragColor = vec4(uAccent * a, a);
}`,Ph=`
uniform vec3 uAccent; uniform float uOn;
varying vec2 vUv;
void main(){
  float lip = smoothstep(0.7, 0.98, vUv.y);
  vec3 body = vec3(0.02, 0.03, 0.045) + uAccent * 0.05;
  gl_FragColor = vec4(body + uAccent * lip * mix(0.35, 1.0, uOn), 1.0);
}`,Dh=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.72 + 0.28 * sin(vUv.x * 190.0 + sin(vUv.x * 37.0) * 4.0);
  float rise = 0.85 + 0.15 * sin(vUv.y * 26.0 - uTime * 3.0);
  float a = pow(1.0 - vUv.y, 1.6) * 0.42 * streak * rise * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`,Fh=`
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.6 + 0.4 * sin(vUv.x * 120.0 + sin(vUv.x * 23.0 + uTime * 0.3) * 5.0);
  float a = pow(1.0 - vUv.y, 2.4) * 0.2 * streak * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`,fc=`
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
}`,Ih=`
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
}`,zh=`
uniform float uE; uniform vec2 uO; uniform float uLen; uniform vec2 uCast;   // [view] uCast: pushed away from wherever the lamp is
varying vec2 vUv;
void main(){
  vUv = (uv - 0.5) * 1.3 + 0.5;                                              // [view] the shadow has room beyond the picture's own edge: it is soft, and a plate fills its picture
  vec2 q = position.xy * 1.3 - uO;
  vec3 p = vec3(q.x * 1.02, 0.0, -q.y / sin(uE) * uLen * 1.02 - 0.02) + vec3(uCast.x, 0.0, uCast.y);         // the dish's outline on the table, pushed a little away from the lamp
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,Bh=`
uniform sampler2D aux; uniform float uK; uniform float uSoft; uniform vec2 uCast; uniform float uE; uniform float uLen;
varying vec2 vUv;
float m(vec2 o, float lod){ return texture2D(aux, clamp(vUv + o, 0.0, 1.0), lod).g; }
void main(){
  vec2 home = vec2(uCast.x, -uCast.y * sin(uE) / uLen) / 1.02;               // the quad was pushed away from the lamp: this is where the dish itself stands
  float sit = m(home, 3.1) * max(0.0, 1.0 - uSoft * 0.5);
  float near = (m(vec2(0.010, 0.006), 3.6 + uSoft) + m(vec2(-0.010, -0.006), 3.6 + uSoft)) * 0.5;
  float wide = (m(vec2(0.022, -0.022), 5.2) + m(vec2(-0.022, 0.022), 5.2)) * 0.5;
  float a = max(sit * 0.9, near * 0.56 + wide * 0.44);
  a *= 1.0 - smoothstep(0.0, 0.145, length(max(abs(vUv - 0.5) - 0.5, 0.0)));      // past the picture's edge there is nothing new to read: it only thins out
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * (3.0 - 2.0 * a) * uK);
}`;var Nh=`
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tex, vUv) * 0.227027;
  s += (texture2D(tex, vUv + dir * 1.384615) + texture2D(tex, vUv - dir * 1.384615)) * 0.316216;
  s += (texture2D(tex, vUv + dir * 3.230769) + texture2D(tex, vUv - dir * 3.230769)) * 0.070270;
  gl_FragColor = s;
}`,Uh=`
uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.95) * k;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
}`,Oh="uniform sampler2D map; uniform float uGlow; uniform float uK; uniform float uLight; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, t.a * uK); return; } gl_FragColor = vec4(t.rgb * uLight, t.a * uK); }",en="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",pc="varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fs="varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }";var mc="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",kh=`
uniform vec4 uLane; uniform vec2 uLanes; uniform vec3 uEdge;
/* [view] where this room gives way to the other one: uEdge = a line across the walk (its z), which side of it is ours (+1 or -1;
   0 = there is no such line) and how wide the dark is on our side of it. Beyond the line the other room is drawn. */
float ours(vec3 w){ return uEdge.y == 0.0 ? 1.0e3 : uEdge.y * (w.z - uEdge.x); }
float laneEdge(vec3 w, out float j){ j = clamp(floor((w.x - uLane.x) / uLane.z + 0.5), -uLanes.x, uLanes.y); return uLane.y - abs(w.x - uLane.x - j * uLane.z); }`,Hh=`
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam;
uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
varying vec3 vW;
${kh}
void main(){
  float mine = ours(vW); if (mine < 0.0) discard;
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
  float pool = uDim / pow(1.0 + d * d / uPool.z, 2.2);                              // a shaded lamp over the table: its light stays on the dish under it and lets the rest of the table go
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 hv = normalize(l + normalize(uCam - vW));
  float sp = pow(max(dot(n, hv), 0.0), uShin) * uSpec * pool;
  vec3 amb = vec3(0.052, 0.045, 0.040) * (0.45 + 0.55 * uDim);                     // the room is dim, never black: the table shows its own wood to every edge of the screen
  vec3 col = alb * (amb + uLamp * dif * 1.18) + uLamp * sp;
  col = mix(col, alb * amb * 0.85, 0.9 * smoothstep(uFar.x, uFar.y, abs(vW.z - uPool.y)));     // far along it: the same wood, in shadow
  col *= 0.7 + 0.3 * smoothstep(0.0, 0.34, edge);                                   // the top darkens a little towards its long edges,
  col += uLamp * alb * 0.5 * pool * smoothstep(0.05, 0.0, abs(edge - 0.035));       // which catch a line of light
  col *= smoothstep(0.0, 0.02, edge);                                              // beside the table: the dark of the room
  gl_FragColor = vec4(sqrt(col) * uFade * smoothstep(0.0, uEdge.z, mine), 1.0);
}`,Gh=`
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
}`,Uo=`
uniform float uK; varying vec2 vUv;
void main(){ vec2 p = (vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.25, length(p * vec2(1.0, 1.0))); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uK); }`,Vh=`
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
}`,Wh=`
uniform float uFade; uniform float uGlow;
varying vec3 vW;
${Vh}
void main(){
  vec3 c = backbar(vW.xy);
  if (uGlow > 0.5) { gl_FragColor = vec4(max(c - 0.22, 0.0) * 0.5 * uFade, 1.0); return; }
  gl_FragColor = vec4(c * uFade, 1.0);
}`,qh=`
uniform sampler2D map; uniform sampler2D hmap; uniform float uSize; uniform float uSpec; uniform float uShin; uniform float uBump;
uniform float uGlow; uniform float uFade; uniform vec3 uLamp; uniform vec3 uCam; uniform vec3 uLampPos; uniform vec3 uPool; uniform float uDim; uniform vec2 uFar;
uniform float uBack; uniform float uGloss;
varying vec3 vW;
${kh}
${Vh}
void main(){
  float mine = ours(vW); if (mine < 0.0) discard;
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
  gl_FragColor = vec4(col * uFade * smoothstep(0.0, uEdge.z, mine), 1.0);
}`,sx=`
vec3 env(vec3 d){
  vec3 c = vec3(0.022, 0.019, 0.017);
  c += vec3(1.0, 0.60, 0.26) * smoothstep(0.15, -0.85, d.z) * smoothstep(-0.30, 0.10, d.y) * smoothstep(0.80, 0.25, d.y) * 0.50;
  c += vec3(1.0, 0.96, 0.90) * smoothstep(0.90, 0.985, dot(d, normalize(vec3(-0.45, 0.72, 0.52)))) * 1.9;
  float az = atan(d.x, d.z);
  c += vec3(0.92, 0.96, 1.0) * smoothstep(0.085, 0.03, abs(az - 0.95)) * smoothstep(-0.15, 0.15, d.y) * smoothstep(0.92, 0.62, d.y) * 1.1;
  c += vec3(1.0, 0.94, 0.86) * smoothstep(0.05, 0.015, abs(az + 1.25)) * smoothstep(-0.05, 0.2, d.y) * smoothstep(0.8, 0.5, d.y) * 0.5;
  c += vec3(0.10, 0.09, 0.085) * smoothstep(0.0, -0.7, d.y);
  return c;
}`,Xh=`
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
void main(){
  vUv = uv; vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,Oo=`
uniform vec3 uCam; uniform float uReveal; uniform float uLight; uniform float uSat; uniform float uGlow; uniform float uMirror; uniform float uRefl;
varying vec3 vN; varying vec3 vW; varying vec3 vL; varying vec2 vUv;
${sx}
vec3 grey(vec3 c){ return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat); }
float mirrorFade(){ return uMirror > 0.5 ? uRefl * exp(vW.y * 1.5) * 0.9 : 1.0; }      // below the counter: the reflection, fading with depth
`,gc=`
uniform vec3 uTint; uniform float uDark; uniform vec3 uInside; uniform float uHasFill; uniform vec3 uUp; uniform float uFillD;
${Oo}
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
}`,pn=`
uniform sampler2D map; uniform float uUseMap; uniform vec3 uTint; uniform float uMetal; uniform vec3 uLampPos;
${Oo}
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
}`,Yh=`
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uLevel; uniform float uFoam; uniform vec2 uWob; uniform vec3 uAt; uniform float uAlpha; uniform float uTime;
${Oo}
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
}`,Zh=`
uniform vec3 uDeep; uniform vec3 uEdge; uniform vec3 uFoamCol; uniform float uFoamy; uniform float uAlpha;
${Oo}
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
}`,Jh=`
uniform vec3 uA; uniform vec3 uB; uniform float uR;
varying float vU; varying float vS;
void main(){
  float u = position.y + 0.5; vU = u; vS = position.x;
  vec3 c = vec3(mix(uA.x, uB.x, sqrt(u)), mix(uA.y, uB.y, u), mix(uA.z, uB.z, sqrt(u)));       // sideways speed constant, falling faster
  float r = uR * mix(1.0, 0.5, u);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + vec3(position.x, 0.0, position.z) * r, 1.0);
}`,jh=`
uniform vec3 uEdge; uniform vec3 uDeep; uniform float uHead; uniform float uTail; uniform float uReveal; uniform float uLight; uniform float uGlow; uniform float uTime;
varying float vU; varying float vS;
void main(){
  if (vU > uHead || vU < uTail) discard;
  float core = 1.0 - abs(vS);
  vec3 col = mix(uDeep, uEdge, 0.55 + 0.45 * core) * (0.55 + 0.45 * uLight) + vec3(1.0, 0.97, 0.9) * smoothstep(0.55, 0.9, core) * (0.20 + 0.10 * sin(vU * 40.0 - uTime * 30.0));
  float a = 0.9 * uReveal * smoothstep(uTail, uTail + 0.04, vU);
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  gl_FragColor = vec4(col, a);
}`,$h=`
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
}`,Kh="uniform vec3 uCol; uniform float uGlow; varying float vA; void main(){ if (vA < 0.004) discard; float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, d) * vA; gl_FragColor = vec4(uCol * a * (uGlow > 0.5 ? 0.0 : 1.0), 0.0); }",Qh=`
uniform vec3 uCol; uniform float uK; uniform float uGlow; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
  float a = smoothstep(1.0, 0.1, r) * (0.55 + 0.45 * smoothstep(0.9, 0.2, abs(r - 0.45) * 2.2)) * uK * (uGlow > 0.5 ? 0.0 : 1.0);
  gl_FragColor = vec4(uCol * a, 0.0);
}`;var ko='"Frank Ruhl Libre","Times New Roman",serif',bi='"IBM Plex Sans Hebrew",Arial,sans-serif',vc=r=>typeof r=="string"?r:"rgb("+r.map(e=>Math.round(Math.min(1,Math.max(0,e))*255)).join(",")+")";function ox(r,e){try{r.direction=Ms(e)?"rtl":"ltr"}catch{}}function Ho(r,e,t){try{r.letterSpacing=Ms(e)?"0px":t+"px"}catch{}}function mn(r,e,t,n,i,s,o,a,l=1,c=!1){if(e=String(e||"").trim(),!e)return 0;c&&!Ms(e)&&(e=e.toUpperCase()),ox(r,e);let u=e.split(/\s+/),h=[e],d=o,f=()=>Math.max.apply(null,h.map(y=>r.measureText(y).width)),g=()=>{for(d=o,r.font=s(d);f()>i&&d>a;)d-=2,r.font=s(d)};if(g(),l>1&&u.length>1&&d<o*.72){let y=1,m=1e9;for(let p=1;p<u.length;p++){let R=Math.abs(u.slice(0,p).join(" ").length-u.slice(p).join(" ").length);R<m&&(m=R,y=p)}h=[u.slice(0,y).join(" "),u.slice(y).join(" ")],g()}f()>i&&(h=h.map(y=>{for(;r.measureText(y+"\u2026").width>i&&y.length>3;)y=y.slice(0,-1);return y===e?y:y+"\u2026"}));let x=d*1.08;return h.forEach((y,m)=>r.fillText(y,t,n+m*x+d*.5)),h.length*x}function td(r,e,t){let n=t.style,i=r.width,s=r.height,o=r.getContext("2d"),a=vc(t.ink),l=vc(t.paper);if(o.clearRect(0,0,i,s),o.textAlign="center",o.textBaseline="middle",n==="can"){o.fillStyle=vc(t.wrap),o.fillRect(0,0,i,s),o.fillStyle=a,o.globalAlpha=.9,o.fillRect(0,s*.1,i,s*.012),o.fillRect(0,s*.888,i,s*.012),o.globalAlpha=1;let x=i/2,y=i*.3,m=s*.2;Ho(o,e.top,3),m+=mn(o,e.top,x,m,y,p=>"600 "+p+"px "+bi,30,16,1,!0)+s*.05,Ho(o,"",0),m+=mn(o,e.title,x,m,y,p=>"700 "+p+"px "+ko,104,40,2)+s*.03,o.fillRect(x-34,m,68,3),m+=s*.045,m+=mn(o,e.mid,x,m,y,p=>"500 "+p+"px "+bi,34,18,2)+s*.02,mn(o,e.foot,x,s*.8,y,p=>"500 "+p+"px "+bi,30,16);return}if(o.fillStyle=l,o.fillRect(0,0,i,s),n==="back"){o.fillStyle=a;let x=s*.2;(e.back||[]).slice(0,3).forEach(y=>{x+=mn(o,y,i/2,x,i*.8,m=>"400 "+m+"px "+bi,34,18,2)+s*.07});return}let c=n==="badge"?i*.07:i*.055;o.strokeStyle=a,o.fillStyle=a,o.globalAlpha=.85,o.lineWidth=Math.max(2,i*.008),o.strokeRect(c,c,i-2*c,s-2*c),o.globalAlpha=.5,o.lineWidth=Math.max(1,i*.003),o.strokeRect(c+i*.022,c+i*.022,i-2*c-i*.044,s-2*c-i*.044),o.globalAlpha=1;let u=i/2,h=i-2*c-i*.11;if(n==="badge"){let x=s*.2;x+=mn(o,e.top,u,x,h,y=>"600 "+y+"px "+bi,26,14,1,!0)+s*.06,mn(o,e.title,u,x,h,y=>"700 "+y+"px "+ko,76,26,2);return}let d=s*(n==="beer"?.3:.34),f=s*.15;Ho(o,e.top,i*.008),f+=mn(o,e.top,u,f,h,x=>"600 "+x+"px "+bi,i*.062,i*.034,2,!0),Ho(o,"",0),f=Math.max(f+s*.03,s*.26),o.globalAlpha=.7,o.fillRect(u-i*.09,f,i*.18,Math.max(2,s*.005)),o.globalAlpha=1,o.save(),o.translate(u,f+Math.max(2,s*.005)/2),o.rotate(Math.PI/4),o.fillRect(-i*.012,-i*.012,i*.024,i*.024),o.restore(),f+=s*.06;let g=mn(o,e.title,u,f+(d-Math.min(d,i*.21))*.25,h,x=>"700 "+x+"px "+ko,i*.21,i*.075,2);f+=Math.max(g,d*.7)+s*.04,f+=mn(o,e.mid,u,f,h,x=>"italic 400 "+x+"px "+ko,i*.068,i*.04,2),mn(o,e.foot,u,s*.835,h,x=>"500 "+x+"px "+bi,i*.056,i*.032)}var zn=Math.PI,nd={transparent:!0,depthWrite:!1,blending:lr,blendEquation:ln,blendSrc:fn,blendDst:fn,blendSrcAlpha:nc,blendDstAlpha:fn};function id(r){let e=new Map,t=0,n=(l,c)=>{let u=e.get(l);return u||(u={g:c(),refs:0},e.set(l,u)),u.refs++,u.g},i=l=>{let c=e.get(l);c&&--c.refs<=0&&(c.g.dispose(),e.delete(l))},s=(l,c)=>new wo(l.map(u=>new se(Math.max(u[0],5e-4)*.075,u[1]*.075)),c),o=(l,c,u,h)=>{let d=[];for(let f=0;f<=h;f++){let g=c[0]+(c[1]-c[0])*f/h;d.push([bs(l.p,Math.min(g,l.h-.01))+u,g])}return d.push([0,c[1]]),d};function a(l,c){t++;let u=new lt,h=[],d=[],f=[],g={uCam:{value:r.cam},uReveal:{value:0},uLight:{value:1},uSat:{value:1},uGlow:r.U.glow,uMirror:{value:0},uRefl:r.U.refl,uLampPos:r.lampPos,uTime:r.U.time},x=($,ue)=>(h.push($),n($,ue)),y=($,ue,Se)=>new tt(Object.assign({uniforms:Object.assign({},g,ue),vertexShader:Xh,fragmentShader:$,transparent:!0,side:Ht},Se||{})),m=($,ue,Se,he)=>{let be=new Xe(ue,Se);return be.renderOrder=he||0,be.frustumCulled=!1,$.add(be),be},p=new lt;p.scale.y=-1,u.add(p);let R=($,ue)=>{let Se=ue.material,he=new Xe(ue.geometry,new tt({uniforms:Object.assign({},Se.uniforms,{uMirror:{value:1}}),vertexShader:Se.vertexShader,fragmentShader:Se.fragmentShader,transparent:!0,side:Ht,depthTest:!1,depthWrite:!1}));return he.position.copy(ue.position),he.rotation.copy(ue.rotation),he.renderOrder=-1.5,he.frustumCulled=!1,$.add(he),he},A=$=>{let ue=m(u,x("quad",()=>new zt(1,1)),new tt({uniforms:{uK:{value:0}},vertexShader:en,fragmentShader:Uo,transparent:!0,depthWrite:!1}),-2);return ue.rotation.x=-zn/2,ue.position.y=.006,ue.scale.set($*2.9,$*2.5,1),ue},C=($,ue,Se)=>{let he=document.createElement("canvas");he.width=$,he.height=ue;let be=new In(he);return be.anisotropy=r.maxAniso,be.minFilter=wi,f.push({cv:he,t:be,style:Se}),d.push(be),be},w={ink:l.ink,paper:l.paper,wrap:l.wrap},F=null;if(l.bottle){let $=Lc[l.vessel],ue=$.h*.075/2,Se=new lt,he=new lt,be=new lt,le=new lt,v=new lt;if(Se.add(he),he.add(be),be.add(le),le.position.y=-ue,u.add(Se),p.add(v),F={V:$,half:ue,pos:Se,tilt:he,yaw:be,mYaw:v,kind:l.vessel,shadow:A($.r*.075)},l.vessel==="tap"){let Z={uUseMap:{value:0},map:{value:r.blank},uTint:{value:new ge(.74,.56,.3)},uMetal:{value:1}};m(le,x("tap:column",()=>s($.p,32)),y(pn,Z,{depthWrite:!0}));let ie=$.spout[0]*.075,ae=$.spout[1]*.075,Ee=m(le,x("tap:arm",()=>new Zt(.062,.075,1,16)),y(pn,Z,{depthWrite:!0}));Ee.rotation.z=zn/2,Ee.scale.y=ie,Ee.position.set(ie/2,ae,0),m(le,x("tap:noz",()=>new Zt(.05,.04,.2,14)),y(pn,Z,{depthWrite:!0})).position.set(ie,ae-.11,0),F.handle=new lt,F.handle.position.set(ie*.78,ae+.05,0),le.add(F.handle),m(F.handle,x("tap:handle",()=>s([[0,0],[.5,0],[.55,.5],[.8,2.6],[1.15,6.6],[1.2,8.2],[.9,8.9],[0,9.1]],20)),y(pn,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new ge(.07,.06,.055)},uMetal:{value:.22}},{depthWrite:!0})),m(le,x("tap:plate",()=>new zt(.36,.36)),y(pn,{uUseMap:{value:1},map:{value:C(256,256,"badge")},uTint:{value:new ge(1,1,1)},uMetal:{value:0}},{depthWrite:!0}),1).position.set(0,11.6*.075,$.p[5][0]*.075+.012),F.spoutAt=[ie,ae-.2]}else if(l.vessel==="can"){let Z=m(le,x("can:body",()=>s($.p,40)),y(pn,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new ge(.8,.81,.82)},uMetal:{value:1}},{depthWrite:!0})),ie=m(le,x("can:wrap",()=>new Zt($.r*.075*1.004,$.r*.075*1.004,($.label[1]-$.label[0])*.075,40,1,!0,-zn,2*zn)),y(pn,{uUseMap:{value:1},map:{value:C(1024,448,"can")},uTint:{value:new ge(1,1,1)},uMetal:{value:.16}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);ie.position.y=($.label[0]+$.label[1])/2*.075,R(v,Z),R(v,ie)}else{let Z=!l.dark&&l.liquid;F.glassU={uTint:{value:new ge().fromArray(l.glassTint)},uDark:{value:l.dark},uInside:{value:new ge().fromArray(l.liquid?l.liquid.deep.map((S,j)=>S*.55+l.liquid.edge[j]*.45):[0,0,0])},uHasFill:{value:Z?1:0},uUp:{value:new M(0,1,0)},uFillD:{value:$.fill*.075}};let ie=m(le,x("bottle:"+l.vessel,()=>s($.p,40)),y(gc,F.glassU,{depthWrite:!0})),ae=$.label[2]*zn/180,Ee=($.label[1]-$.label[0])*.075,de=$.r*.075*1.006,E=m(le,x("label:"+l.vessel,()=>new Zt(de,de,Ee,28,1,!0,-ae,2*ae)),y(pn,{uUseMap:{value:1},map:{value:C(512,Math.round(512*Ee/(2*ae*de)),l.beer?"beer":"wine")},uTint:{value:new ge(1,1,1)},uMetal:{value:0}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);if(E.position.y=($.label[0]+$.label[1])/2*.075,R(v,ie),R(v,E),$.back&&c.back&&c.back.length){let S=$.back[2]*zn/180,j=($.back[1]-$.back[0])*.075,ne=m(le,x("back:"+l.vessel,()=>new Zt(de,de,j,16,1,!0,zn-S,2*S)),y(pn,{uUseMap:{value:1},map:{value:C(256,Math.round(256*j/(2*S*de)),"back")},uTint:{value:new ge(1,1,1)},uMetal:{value:0}},{depthWrite:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),1);ne.position.y=($.back[0]+$.back[1])/2*.075}if($.capsule&&l.foil){let S=m(le,x("cap:"+l.vessel,()=>s(o($,$.capsule,.05,10),28)),y(pn,{uUseMap:{value:0},map:{value:r.blank},uTint:{value:new ge().fromArray(l.foil)},uMetal:{value:l.vessel==="longneck"?.95:.7}},{depthWrite:!0}),1);R(v,S)}}}let B=Rc[l.glass],O=new lt,H=new lt,K=B.inner[0][1],q=l.beer?B.head:l.sparkling?1.3:0;O.position.set(l.glassAt[0],0,l.glassAt[1]),H.position.copy(O.position),u.add(O),p.add(H);let D=Math.max.apply(null,B.outer.map($=>$[0]))*.075,z=A(D*.8);z.position.x=l.glassAt[0],z.position.z=l.glassAt[1];let N=null,P=null,te=null,ce=null,oe=null;if(l.liquid){let $={uDeep:{value:new ge().fromArray(l.liquid.deep)},uEdge:{value:new ge().fromArray(l.liquid.edge)},uFoamCol:{value:new ge().fromArray(l.liquid.foam)},uLevel:{value:0},uFoam:{value:0},uWob:{value:new se},uAt:{value:new M},uAlpha:{value:1},uFoamy:{value:0}};if(N=m(O,x("liquid:"+l.glass,()=>s(B.inner.map(ue=>[ue[0]*.982,ue[1]]),44)),y(Yh,$,{depthWrite:!0}),2),P=m(O,x("disc",()=>new ii(1,40).rotateX(-zn/2)),y(Zh,$,{depthWrite:!0}),2.2),R(H,N),r.motion){let ue=l.beer?44:l.sparkling?52:18;te=new ns(x("bubbles:"+ue,()=>{let Se=new Float32Array(ue*3),he=new Float32Array(ue);for(let le=0;le<ue;le++){let v=le*2.39996,Z=Math.sqrt((le+.5)/ue);Se[le*3]=Math.cos(v)*Z,Se[le*3+2]=Math.sin(v)*Z,he[le]=le*.6180339%1}let be=new $e;return be.setAttribute("position",new ct(Se,3)),be.setAttribute("aSeed",new ct(he,1)),be}),new tt(Object.assign({uniforms:{uTime:r.U.time,uPx:r.U.px,uOn:{value:0},uBase:{value:0},uTop:{value:1},uR:{value:.2},uSize:{value:l.sparkling?5:7},uCol:{value:new ge(1,.96,.86)},uGlow:r.U.glow},vertexShader:$h,fragmentShader:Kh,depthTest:!1},nd))),te.frustumCulled=!1,te.renderOrder=3,te.visible=!1,O.add(te),ce=m(u,x("stream",()=>new Zt(1,1,1,8,16,!0)),new tt({uniforms:{uA:{value:new M},uB:{value:new M},uR:{value:l.beer?.042:.028},uEdge:$.uEdge,uDeep:$.uDeep,uHead:{value:0},uTail:{value:1},uReveal:g.uReveal,uLight:g.uLight,uGlow:r.U.glow,uTime:r.U.time},vertexShader:Jh,fragmentShader:jh,transparent:!0,depthWrite:!1,side:Ht}),3),ce.visible=!1}oe=m(u,x("quad",()=>new zt(1,1)),new tt(Object.assign({uniforms:{uCol:$.uEdge,uK:{value:0},uGlow:r.U.glow},vertexShader:en,fragmentShader:Qh},nd)),-1),oe.rotation.x=-zn/2,oe.scale.set(D*2.4,D*1.8,1),N.userData.u=$}let we=m(O,x("glass:"+l.glass,()=>s(B.outer.concat(B.inner.slice().reverse()),44)),y(gc,{uTint:{value:new ge(.9,.95,.92)},uDark:{value:0},uInside:{value:new ge},uHasFill:{value:0},uUp:{value:new M(0,1,0)},uFillD:{value:0}},{depthWrite:!1}),5);R(H,we);function pe($){f.forEach(ue=>{td(ue.cv,$,Object.assign({style:ue.style},w)),ue.t.needsUpdate=!0})}pe(c);let Ce=0;u.traverse($=>{$.isMesh&&(Ce+=($.geometry.index?$.geometry.index.count:$.geometry.attributes.position.count)/3)});function Fe($,ue){let Se=ue.refl>.02&&!ue.holo;if(u.position.y=ue.baseY,F){let he=l.bottle[0],be=l.bottle[1];if(F.kind==="tap")F.pos.position.set(he,F.half,be),F.handle.rotation.z=-$.tilt*.55,F.yaw.rotation.y=0;else{let le=l.source==="bottle"?Cc(l,$.tilt):{x:he,y:F.half,z:be,angle:0};F.pos.position.set(le.x,le.y,le.z),F.tilt.rotation.z=-le.angle,he=le.x,be=le.z,F.mouth=le.mouth;let v=Math.atan2(ue.cx-(ue.wx+he),ue.cz-(ue.wz+be))*(1-$.tilt)+ue.yaw;if(F.yaw.rotation.y=v,F.glassU){let Z=Math.sin(le.angle),ie=Math.cos(le.angle),ae=F.V;F.glassU.uUp.value.set(-Z*Math.cos(v),ie,-Z*Math.sin(v)),F.glassU.uFillD.value=ae.fill*.075/2*ie+ae.r*.075*.45*(1-ie*ie)+ae.fill*.075/2*ie*ie}F.mYaw.position.set(l.bottle[0],0,l.bottle[1]),F.mYaw.rotation.y=v}F.mYaw.visible=Se&&$.tilt<.03,F.shadow.position.x=he,F.shadow.position.z=be,F.shadow.material.uniforms.uK.value=(ue.holo?0:.5)*g.uReveal.value*(1-.65*$.tilt)}if(H.visible=Se,z.material.uniforms.uK.value=(ue.holo?0:.34)*g.uReveal.value,N){let he=N.userData.u,be=K+(B.fill-K)*$.level,le=q*$.foam,v=$.fade>.01&&($.level>.004||le>.02);if(he.uLevel.value=ue.baseY+be*.075,he.uFoam.value=le*.075,he.uWob.value.set($.wobble*.05,$.wobble*.02),he.uAt.value.set(ue.wx+l.glassAt[0],0,ue.wz+l.glassAt[1]),he.uAlpha.value=$.fade,he.uFoamy.value=Math.min(1,le/.25),N.visible=v,P.visible=v,P.position.y=(be+le)*.075,P.scale.setScalar(bs(B.inner,be+le)*.075*.98),P.rotation.z=-$.wobble*.05,P.rotation.x=$.wobble*.02,te){let Z=$.bubbles*$.fade;te.visible=Z>.01&&$.level>.05,te.material.uniforms.uOn.value=Z,te.material.uniforms.uBase.value=(K+.3)*.075,te.material.uniforms.uTop.value=be*.075,te.material.uniforms.uR.value=bs(B.inner,be)*.075*.8}if(ce){let Z=ce.material.uniforms,ie=$.head>0&&$.tail<1;ce.visible=ie,ie&&(l.source==="tap"?Z.uA.value.set(l.bottle[0]+F.spoutAt[0],F.spoutAt[1],l.bottle[1]):l.source==="bottle"&&F&&F.mouth?Z.uA.value.set(F.mouth[0],F.mouth[1]-.02,F.mouth[2]):Z.uA.value.set(l.glassAt[0],B.h*.075+4.4,l.glassAt[1]),Z.uB.value.set(l.glassAt[0]+(l.source==="bottle"?.03:0),Math.max(be,K+.2)*.075,l.glassAt[1]),Z.uHead.value=$.head,Z.uTail.value=$.tail)}oe.position.set(l.glassAt[0]+D*.55,.008,l.glassAt[1]-D*.35),oe.material.uniforms.uK.value=(ue.holo?0:.07)*$.level*$.fade*g.uReveal.value*g.uLight.value}}function ee(){t--,d.forEach($=>$.dispose()),h.forEach(i),h.length=0}return{group:u,shared:g,update:Fe,paint:pe,tris:Math.round(Ce),dispose:ee,spec:l}}return{build:a,stats:()=>({drinks:t,geometries:e.size})}}var ps=r=>Math.min(1,Math.max(0,r)),Bn=r=>(r=ps(r),r*r*(3-2*r)),ax=r=>(r=ps(r),r*r*r*(r*(r*6-15)+10));function lx(r={}){let e=r.source==="above"||r.source==="tap",t=e?.3:.5,n=r.beer?2.1:1.9,i=e?.3:.55,s=t,o=s+n,a=o+.17,l=a+i,c=r.beer?5.5:r.sparkling?6:.7,u=r.beer?3.2:.9;return{t0:s,t1:o,tb:a,t2:l,fizz:c,settle:u,beer:!!r.beer,sparkling:!!r.sparkling,action:l,end:Math.max(l+.25,o+u,o+c)}}var fr=(r={})=>({fade:1,tilt:0,head:0,tail:1,level:1,wobble:0,foam:r.beer?1:0,bubbles:0,cam:0,done:!0});function xc(r,e={}){let t=lx(e);if(r>=t.end)return fr(e);if(r<0)return Object.assign(fr(e),{fade:1-Bn((r+.5)/(.5*.7)),cam:Bn((r+.5)/.5),done:!1});let n=r<t.t0?Bn(r/t.t0):r<t.tb?1:1-Bn((r-t.tb)/(t.t2-t.tb)),i=ps((r-(t.t0-.06))/.2),s=ps((r-t.t1)/.16),o=ax((r-t.t0-.12)/(t.t1-t.t0-.04)),a=r<t.t0?0:r<t.t1?.9*ps((r-t.t0)/.3):.9*Math.exp(-(r-t.t1)*4.2),l=a<.004?0:a*Math.sin(r*12.5),c=0,u=0;t.beer?(c=r<t.t1?1.55*Math.pow(o,.7):1+.55*Math.exp(-(r-t.t1)/.75),r>=t.t1&&c<1.004&&(c=1),u=r<t.t0?0:r<t.t1?1:1-Bn((r-t.t1)/t.fizz)):t.sparkling?(c=r<t.t1?.55*Math.pow(o,.7):.55*(1-Bn((r-t.t1)/1.3)),u=r<t.t0?0:r<t.t1?1:1-Bn((r-t.t1)/t.fizz)):u=r<t.t0?0:r<t.t1?.7:.7*(1-Bn((r-t.t1)/t.fizz));let h=r<t.tb?1:1-Bn((r-t.tb)/(t.t2-t.tb+.25));return{fade:1,tilt:n,head:i,tail:s,level:o,wobble:l,foam:c,bubbles:u,cam:h,done:!1}}var Mn=Math.PI,Wx=Mn*2,bn=.07,Go=.5,sd=Ti("bar"),Yo=r=>(r=At(r),r*r*(3-2*r)),Nt=(r,e)=>1-Math.exp(-r*e),Vo=3,Wo=3,yc=3.6,od=10,qo=.62,cx=45,ad=["table","bar"],ux=1.3,_c=1.5,hx=1.45,ld=16,pr=[1.5,.95],Xo=28*Ts,dx=.075,Zo=[.5,2.6],fx=.022,cd=r=>r.mode==="settle"?1-Yo((Math.abs(r.v)-Zo[0])/(Zo[1]-Zo[0])):1;function qx(r){let e=r.canvas,t=!!r.reduce,n=r.themes||"themes/",i=r.glide,s=r.theme||{},o;try{o=new it({canvas:e,antialias:!0,alpha:!0,powerPreference:"high-performance"})}catch{return null}if(!o.getContext())return null;let l=o.capabilities.getMaxAnisotropy(),c=r.pixelRatio||Math.min(window.devicePixelRatio||1,2);o.setPixelRatio(c),o.setClearColor(0,0),o.info.autoReset=!1;let u={time:{value:0},accent:{value:new ge(s.accent||"#5fd0ff")},px:{value:c},hub:{value:new se},glow:{value:0},pulse:{value:9},refl:{value:0},mask:{value:new Je(0,2,0,0)},at:{value:new se}},h=new gi,d=new Tt(30,1,.1,160),f=new as;d.layers.enable(1);let g=Math.min(window.innerWidth,window.innerHeight)<600,x=new zt(1,1,g?220:300,g?220:300),y=new zt(1,1,96,96),m=new zt(1,1),p=(_,T,G)=>{let U=new $i(new Uint8Array([_,T,G]),1,1,Pn);return U.needsUpdate=!0,U},R=p(128,128,128),A=p(18,16,14),C=(_,T,G,U)=>new tt(Object.assign({uniforms:T,vertexShader:G||en,fragmentShader:_,transparent:!0,depthWrite:!1,blending:Vr},U||{})),w={uGlow:u.glow,uCam:{value:d.position},uLampPos:{value:new M(.5,3.6,1.5)},uPool:{value:new M(0,.1,9.5)},uDim:{value:1},uLane:{value:new Je(0,2.1,sa,0)},uLanes:{value:new se(0,0)}},F=()=>Object.assign({map:{value:A},hmap:{value:R},uSize:{value:6},uSpec:{value:.1},uShin:{value:20},uBump:{value:0},uFade:{value:0},uLamp:{value:new ge(1,.95,.86)},uFar:{value:new se(5.5,13)},uEdge:{value:new M(0,0,1)}},w),B=F(),O=new zt(1,1).rotateX(-Mn/2),H=new Xe(O,new tt({uniforms:B,vertexShader:fs,fragmentShader:Hh}));H.frustumCulled=!1,H.scale.set(260,1,260),h.add(H);let K=new lt;h.add(K);let q=id({U:u,cam:d.position,lampPos:w.uLampPos,maxAniso:l,blank:R,motion:!t}),D={table:{u:B,far:Ti("table").far,s:null,want:null,live:!1,fade:0},bar:{u:null,far:null,s:null,want:null,live:!1,fade:0}},z=null;function N(){if(z)return z;let _=Object.assign(F(),{uBack:{value:-12},uGloss:{value:1}}),T=new lt,G=new Xe(O,new tt({uniforms:_,vertexShader:fs,fragmentShader:qh}));G.frustumCulled=!1,G.scale.set(260,1,260),T.add(G);let U=new Xe(new zt(160,30),new tt({uniforms:{uFade:_.uFade,uGlow:u.glow},vertexShader:fs,fragmentShader:Wh}));return U.frustumCulled=!1,T.add(U),T.visible=!1,h.add(T),z={g:T,counter:G,wall:U,cu:_},D.bar.u=_,D.bar.far=sd.far,z}let P=null;function te(){if(P)return P;let _=(()=>{let V=document.createElement("canvas");V.width=V.height=128;let Y=V.getContext("2d"),W=Y.createRadialGradient(64,64,0,64,64,64);return W.addColorStop(0,"rgba(255,255,255,1)"),W.addColorStop(.3,"rgba(255,255,255,.5)"),W.addColorStop(1,"rgba(255,255,255,0)"),Y.fillStyle=W,Y.fillRect(0,0,128,128),new In(V)})(),T={g:new lt,fxU:{uAccent:u.accent,uTime:u.time,uOn:{value:0}},fxOn:0,scanAt:2.2,softTex:_};T.geoBase=new ii(1.36,72).rotateX(-Mn/2).translate(0,bn,0),T.geoSide=new Zt(1.36,1.4,bn+.03,72,1,!0).translate(0,(bn-.03)/2,0),T.geoCone=new Zt(1.2,.42,Go-bn+.05,64,1,!0).translate(0,bn+(Go-bn+.05)/2,0),T.geoRing=new ii(1.3,72).rotateX(-Mn/2).translate(0,.012,0),T.floor=new Xe(new ii(40,64).rotateX(-Mn/2),C(Ih,{uAccent:u.accent,uTime:u.time,uHub:u.hub,uPulse:u.pulse,uGlow:u.glow,uAt:u.at},fs)),T.floor.position.y=-.02,T.floor.renderOrder=-6,T.floor.frustumCulled=!1,T.g.add(T.floor),T.halo=new Qr(new Qi({map:_,color:u.accent.value,blending:Vr,depthWrite:!1,transparent:!0,opacity:.16})),T.halo.scale.set(9,6,1),T.halo.renderOrder=-4,T.g.add(T.halo),T.fx=new lt,T.g.add(T.fx);let G=new Xe(new Zt(1.5,1.36,2.7,64,1,!0).translate(0,bn+1.35,0),C(Fh,T.fxU,en,{side:yt}));G.renderOrder=-1,T.fx.add(G);let U=new Xe(new os(1.44,1.74,128).rotateX(-Mn/2),C(fc,Object.assign({uKind:{value:0}},T.fxU),pc,{side:Ht}));return U.position.y=.012,U.renderOrder=-2,T.fx.add(U),T.hoop=new Xe(new os(1.1,1.5,96).rotateX(-Mn/2),C(fc,{uAccent:u.accent,uTime:u.time,uOn:{value:0},uKind:{value:2}},pc,{side:Ht})),T.hoop.renderOrder=5,T.fx.add(T.hoop),T.g.visible=!1,h.add(T.g),P=T,T}let ce=_=>new dn(4,4,{minFilter:Rt,magFilter:Rt,depthBuffer:_,stencilBuffer:!1}),oe=ce(!0),we=ce(!1),pe=ce(!1),Ce=ce(!1),Fe=ce(!1),ee=new ar(-1,1,1,-1,0,1),$=new gi,ue=new tt({uniforms:{tex:{value:null},dir:{value:new se}},vertexShader:mc,fragmentShader:Nh,depthTest:!1,depthWrite:!1}),Se=new tt({uniforms:{a:{value:pe.texture},b:{value:Fe.texture},k:{value:.75}},vertexShader:mc,fragmentShader:Uh,depthTest:!1,depthWrite:!1,transparent:!0,blending:lr,blendEquation:ln,blendSrc:fn,blendDst:fn,blendSrcAlpha:fn,blendDstAlpha:cr}),he=new Xe(new zt(2,2),ue);he.frustumCulled=!1,$.add(he);let be=(_,T,G,U)=>{he.material=ue,ue.uniforms.tex.value=_.texture,ue.uniforms.dir.value.set(G,U),o.setRenderTarget(T),o.render($,ee)},le=_=>({x:_,v:0}),v={w:0,h:0,frame:null,view:null,preset:null,walk:r.walk===-1?-1:1,first:!0,clock:0,lane:{x:0,z:0,places:[],n:0,cat:null,kind:"food"},guests:{prev:null,next:null},mounts:0,actors:new Map,dev:le(0),E:le(45),zoom:le(1),cy:le(300),lookY:le(0),offX:le(0),lift:le(0),pool:le(8.5),lampK:1,room:"table",edge:null,fov:le(30),D:le(10),lens:{W:0,H:0,D:10,fov:30},devZ:{x:0,v:0},titles:[],dragX:{dx:0,active:!1},touchAt:0,sway:0,tilt:[0,0],tiltT:[0,0],ptr:[0,0],ptrT:[0,0],turning:!1,bump:0,swayK:0,hot:[],bloom:r.bloom!==!1,tier:0,slow:0,lost:!1,auto:r.auto!==!1,moving:!0,frames:0,disposed:!1,pours:0,hush:!1,heroReady:null,stats:{calls:0,triangles:0},base:new M,focus:new M,intro:0},Z=new Map,ie=0,ae=0,Ee=[],de=_=>{let T=ie;ie+=_,r.onBusy&&T===0!=(ie===0)&&r.onBusy(ie>0),ie===0&&Ee.splice(0).forEach(G=>G())};function E(_,T,G,U){let V=Z.get(_);return V?(V.refs++,V.last=++ae,V.ready?G(V.tex):V.wait.push(G),V):(V={tex:null,refs:1,ready:!1,failed:!1,wait:[G],url:_,last:++ae},Z.set(_,V),de(1),V.tex=f.load(_,Y=>{if(!Z.has(_)||Z.get(_)!==V){Y.dispose(),de(-1);return}Y.generateMipmaps=T,Y.minFilter=T?wi:Rt,Y.anisotropy=T&&!U?l:1,Y.needsUpdate=!0,V.ready=!0,V.wait.splice(0).forEach(W=>W(Y)),de(-1),Be()},void 0,()=>{V.failed=!0,V.wait.length=0,r.onAssetError&&r.onAssetError(_),de(-1),Be()}),V)}function S(){let _=[];Z.forEach(T=>{T.refs<=0&&_.push(T)}),!(_.length<=od)&&_.sort((T,G)=>G.last-T.last).slice(od).forEach(T=>{T.tex&&T.tex.dispose(),Z.delete(T.url)})}let j={texs:new Map};function ne(_){let T=j.texs.get(_.id+(_.img||""));if(T)return T;T={map:null,h:null,ready:!1,def:_},j.texs.set(_.id+(_.img||""),T);let G=U=>(U.wrapS=U.wrapT=_.mirror?qr:Wr,U.anisotropy=l,U.needsUpdate=!0,U);return de(1),T.map=f.load(_.img||n+_.id+".jpg",U=>{G(U),T.ready=!0,de(-1),Be()},void 0,()=>{T.map=A,T.ready=!0,de(-1),Be()}),_.img||(T.h=f.load(n+_.id+"_h.jpg",U=>{G(U),Be()})),T}let ve=_=>_.holo?null:D[_.kind]||D.table,Re=_=>D.table.s===_||D.table.want===_||D.bar.s===_||D.bar.want===_;function Ye(_){if(_.id==="holo"){v.room="holo",u.refl.value=0,te(),Se.uniforms.k.value=1;return}Se.uniforms.k.value=.75;let T=_.kind||"table";T==="bar"&&N();let G=D[T],U=ne(_);v.room=T,G.s===U?G.want=null:G.s?G.want=U:(G.s=U,G.live=!1),j.texs.size>3&&j.texs.forEach((V,Y)=>{Re(V)||(V.map&&V.map!==A&&V.map.dispose(),V.h&&V.h.dispose(),j.texs.delete(Y))})}function ke(_){let T=_.s,G=T.def,U=_.u,V=G.tint||[1,.95,.86];U.map.value=T.map,U.hmap.value=T.h||R,U.uSize.value=G.size,U.uSpec.value=G.spec,U.uShin.value=G.shin,U.uBump.value=G.bump,U.uLamp.value.setRGB(V[0],V[1],V[2]),U.uFar.value.set(_.far[0],_.far[1]),U.uGloss&&(U.uGloss.value=G.gloss==null?1:G.gloss),_.live=!0}function I(_){let T=!1;for(let U=0;U<ad.length;U++){let V=ad[U],Y=D[V];if(!Y.u)continue;Y.want&&Y.want.ready&&(Y.fade<.04||t)&&(Y.s=Y.want,Y.want=null,Y.live=!1),Y.s&&Y.s.ready&&!Y.live&&ke(Y);let W=v.room===V&&Y.live&&!Y.want?1:0,Me=Y.fade;Y.fade=t?W:Me+(W-Me)*Nt(_,Y.want?12:W?5.5:4.2),Math.abs(Y.fade-W)>.004?T=!0:Y.fade=W,Y.u.uFade.value=Y.fade;let xe=v.edge;xe?Y.u.uEdge.value.set(xe.z,V===xe.to?xe.s:-xe.s,xe.w):Y.u.uEdge.value.set(0,0,1)}H.visible=D.table.fade>.002,z&&(z.g.visible=D.bar.fade>.002),P&&(P.g.visible=v.room==="holo");let G=D[v.room];return u.refl.value=G&&G.live?G.s.def.refl*G.fade:0,T}function fe(_){let T=r.cardInfo?r.cardInfo(_.item):{title:"",price:"",rtl:!1},G=_.canvas||(_.canvas=document.createElement("canvas"));G.width=760,G.height=480;let U=G.getContext("2d"),V=G.width,Y=G.height;U.fillStyle="#f4efe5",U.fillRect(0,0,V,Y),U.strokeStyle="rgba(60,44,28,.6)",U.lineWidth=4,U.strokeRect(24,24,V-48,Y-48),U.lineWidth=1.5,U.strokeRect(36,36,V-72,Y-72);try{U.direction=T.rtl?"rtl":"ltr"}catch{}U.textAlign="center",U.textBaseline="middle",U.fillStyle="#2a1e12";let W=String(T.title||"").split(/\s+/).filter(Boolean),Me=V-120,xe=[W.join(" ")],Ge=0,J=Le=>{Ge=Le;do Ge-=4,U.font="700 "+Ge+'px "Frank Ruhl Libre","Times New Roman",serif';while(Math.max.apply(null,xe.map(je=>U.measureText(je).width))>Me&&Ge>34)};if(J(150),Ge<96&&W.length>1){let Le=1,je=1e9;for(let ot=1;ot<W.length;ot++){let gt=Math.abs(W.slice(0,ot).join(" ").length-W.slice(ot).join(" ").length);gt<je&&(je=gt,Le=ot)}xe=[W.slice(0,Le).join(" "),W.slice(Le).join(" ")],J(128)}let Te=Ge*1.04,Ae=!!T.price,Pe=xe.length*Te+(Ae?96:0),Ve=Y/2-Pe/2+Te/2+4;if(xe.forEach((Le,je)=>U.fillText(Le,V/2,Ve+je*Te)),Ae){let Le=Ve+(xe.length-1)*Te+Te/2;U.fillStyle="rgba(60,44,28,.55)",U.fillRect(V/2-34,Le+16,68,3),U.font='500 62px "Frank Ruhl Libre","Times New Roman",serif',U.fillStyle="#2a1e12";try{U.direction="ltr"}catch{}U.fillText(String(T.price),V/2,Le+62)}_.cardTex?_.cardTex.needsUpdate=!0:(_.cardTex=new In(G),_.cardTex.anisotropy=l),_.um.map.value=_.cardTex,_.ready=!0}function me(_,T,G){let U=v.view,V=v.preset,Y=G.kind,W=Dc(_,Y),Me=_.asset,xe=new lt,Ge=G.places[T],J={id:_.id,item:_,i:T,cat:G.cat,kind:Y,shape:W,type:W.type,g:xe,x:G.x+Ge.dx,z:xt(G,T)+Ge.dz,spin:Ge.spin,guest:G!==v.lane,seen:0,room:ve(V),vis:0,visT:1,light:1,turn:{x:0,v:0},lift:0,near:0,ready:!1,leaving:!1,tex:[],sat:1,pour:null,pose:null,holo:!!(V.holo||W.holo),stock:!!W.holo};if(W.type==="relief"||W.type==="stand"){let Te=J.um={map:{value:A},aux:{value:R},uH:{value:Me.h},uE:{value:Me.e*Ts},uFocus:{value:0},uReveal:{value:0},uTime:u.time,uScan:{value:-9},uGlitch:{value:0},uGlow:u.glow,uMirror:{value:0},uAccent:u.accent,uCenter:{value:xe.position},uHolo:{value:J.holo?1:0},uLight:{value:1},uRefl:u.refl,uMask:u.mask,uSat:{value:1},uO:{value:new se(Me.o?Me.o[0]:0,Me.o?Me.o[1]:0)}},Ae=Le=>new tt({uniforms:Le?Object.assign({},Te,{uMirror:{value:1}}):Te,vertexShader:Ah,fragmentShader:Lh,transparent:!0,side:Ht,depthWrite:!Le});J.mesh=new Xe(y,Ae(!1)),J.mesh.frustumCulled=!1,J.mesh.rotation.order="YXZ",J.mesh.visible=!1,xe.add(J.mesh),J.mir=new lt,J.mir.scale.y=-1,xe.add(J.mir),J.refl=new Xe(y,Ae(!0)),J.refl.frustumCulled=!1,J.refl.rotation.order="YXZ",J.refl.renderOrder=-1.5,J.refl.visible=!1,J.mir.add(J.refl),J.shadow=new Xe(m,new tt({uniforms:{aux:Te.aux,uE:Te.uE,uO:Te.uO,uLen:{value:Me.o?.5:1},uK:{value:0},uCast:{value:new se},uSoft:{value:0}},vertexShader:zh,fragmentShader:Bh,transparent:!0,depthWrite:!1})),J.shadow.frustumCulled=!1,J.shadow.renderOrder=-2,J.shadow.position.y=.006,J.shadow.visible=!1,xe.add(J.shadow),W.reliefX&&(J.mesh.position.x=J.refl.position.x=J.shadow.position.x=W.reliefX);let Pe=0,Ve=()=>{++Pe>=2&&(J.ready=!0,J.mesh.visible=!0)};J.tex.push(E(Me.color,!0,Le=>{Te.map.value=Le,Ve()}),E(Me.aux,!0,Le=>{Te.aux.value=Le,Ve()},!0))}else if(W.type==="drink")J.ready=!0;else{let Te=W.type==="photo",Ae=Te?1.9:pr[0],Pe=Te?1.9:pr[1];J.cardSize=[Ae,Pe];let Ve=J.um={map:{value:A},uLight:{value:1},uReveal:{value:0},uGlow:u.glow,uSat:{value:1},uSize:{value:new se(Ae,Pe)},uBorder:{value:Te?.07:0},uFit:{value:new Je(1,1,0,0)},uTint:{value:new ge(1,1,1)},uBlank:{value:0}},Le=je=>new tt({uniforms:je?Object.assign({},Ve,je):Ve,vertexShader:en,fragmentShader:Gh,transparent:!0,side:Ht});if(J.mesh=new Xe(new zt(Ae,Pe),Le()),J.mesh.rotation.order="YXZ",J.mesh.frustumCulled=!1,J.shadow=new Xe(m,new tt({uniforms:{uK:{value:0}},vertexShader:en,fragmentShader:Uo,transparent:!0,depthWrite:!1})),J.shadow.rotation.x=-Mn/2,J.shadow.position.y=.006,J.shadow.renderOrder=-2,xe.add(J.shadow),Te)xe.add(J.mesh),J.tex.push(E(Me.color,!0,je=>{Ve.map.value=je;let ot=je.image,gt=ot&&ot.width&&ot.height?ot.width/ot.height:1;Ve.uFit.value.set(gt>1?1/gt:1,gt>1?1:gt,0,0),J.ready=!0}));else{J.tent=new lt,J.tent.rotation.order="YXZ",xe.add(J.tent);let je=Math.sin(Xo)*Pe,ot=Math.cos(Xo)*Pe;J.mesh.rotation.x=-Xo,J.mesh.position.set(0,ot/2,je/2),J.tent.add(J.mesh),J.back=new Xe(J.mesh.geometry,Le({uBlank:{value:1},uTint:{value:new ge(.62,.6,.58)}})),J.back.frustumCulled=!1,J.back.rotation.x=Xo,J.back.position.set(0,ot/2,-je/2),J.tent.add(J.back),fe(J)}}if(W.drink&&(J.drink=q.build(W.drink,ia(_,Y,U.lang)),J.drink.group.position.set(W.drinkX,0,W.drinkZ),xe.add(J.drink.group),J.pose=fr(W.drink),W.type==="drink"&&(J.um=J.drink.shared)),J.holo){let Te=te();J.ub={uAccent:u.accent,uTime:u.time,uOn:{value:0}};let Ae=W.type==="stand"?.62:W.type==="text"||W.type==="photo"?.8:1;if(V.holo){let Pe=new Xe(Te.geoSide,new tt({uniforms:J.ub,vertexShader:en,fragmentShader:Ph}));Pe.renderOrder=-3;let Ve=new Xe(Te.geoBase,new tt({uniforms:J.ub,vertexShader:en,fragmentShader:Rh,transparent:!0,depthWrite:!1,blending:lr,blendEquation:ln,blendSrc:fn,blendDst:cr,blendSrcAlpha:fn,blendDstAlpha:cr}));if(Ve.renderOrder=-2.5,J.kit=[Pe,Ve],J.float=W.type==="stand"?bn+.1:Go,W.type==="relief"){let Le=new Xe(Te.geoCone,C(Dh,J.ub,en,{side:Ht}));Le.renderOrder=-1,J.kit.push(Le)}J.kit.forEach(Le=>{Le.scale.set(Ae*.8,1,Ae*.8),Le.frustumCulled=!1,xe.add(Le)})}else{let Pe=new Xe(Te.geoRing,C(Ch,J.ub));Pe.renderOrder=-2.5,Pe.scale.set(Ae*.92,1,Ae*.92),Pe.frustumCulled=!1,xe.add(Pe),J.kit=[Pe],J.float=W.type==="stand"?.03:.15}}return J.room===D.table&&xe.traverse(De),xe.position.set(J.x,0,J.z),K.add(xe),J}let De=_=>{_.layers.set(1)};function re(_){K.remove(_.g),_.tex.forEach(T=>{T.refs--,T.last=++ae}),_.g.traverse(T=>{T.material&&T.material.dispose()}),_.drink&&_.drink.dispose(),_.cardTex&&_.cardTex.dispose(),(_.type==="photo"||_.type==="text")&&_.mesh.geometry.dispose(),v.actors.delete(_.id)}function ze(){let _=v.view;if(!_)return;let T=_.items.length,G=i.state.p,U=At(Math.round(G),0,T-1),V=Math.max(0,U-Vo),Y=Math.min(T-1,U+Wo),W=At(_.index,0,T-1),Me=!1,xe=J=>{let Te=_.items[J],Ae=v.actors.get(Te.id);if(Ae&&Ae.leaving){let Pe=v.lane.places[J];if(Ae.visT>0&&Math.abs(Ae.z-(xt(v.lane,J)+Pe.dz))<.03&&Math.abs(Ae.x-(v.lane.x+Pe.dx))<.03){Ae.leaving=!1,Ae.guest=!1,Ae.i=J,Ae.cat=_.catId;return}re(Ae),Ae=null}Ae||v.actors.set(Te.id,me(Te,J,v.lane))};v.actors.forEach(J=>{!J.leaving&&!J.guest&&J.cat===_.catId&&Math.abs(J.i-G)>yc&&Math.abs(J.i-W)>1&&(re(J),Me=!0)});for(let J=V;J<=Y;J++)xe(J);for(let J=Math.max(0,W-1);J<=Math.min(T-1,W+1);J++)xe(J);let Ge=++v.mounts;ut(v.guests.next,1,U+Wo-(T-1),Ge),ut(v.guests.prev,-1,Vo-U,Ge),v.actors.forEach(mt),Me&&S()}let We={L:null,end:0,way:0,free:!0},mt=_=>{_.guest&&!_.leaving&&_.seen!==v.mounts&&(_.leaving=!0,_.visT=0)},Sn=_=>{let T=We.L;_.leaving&&_.visT>0&&(_.z-We.end)*We.way>.4*v.preset.S&&!(_.cat===T.cat&&_.i<T.n&&Math.abs(_.z-(xt(T,_.i)+T.places[_.i].dz))<.03)&&(We.free=!1)};function ut(_,T,G,U){if(!_||G<=0||!v.view)return;let V=_.items.length,Y=v.lane,W=xt(Y,T>0?Y.n-1:0),Me=-v.walk*T;if(We.L=_,We.end=W,We.way=Me,We.free=!0,v.actors.forEach(Sn),!!We.free){for(let xe=0;xe<Math.min(G,V);xe++){let Ge=T>0?xe:V-1-xe,J=_.items[Ge],Te=v.actors.get(J.id);Te&&Te.leaving&&(Te.visT>0&&Math.abs(Te.z-(xt(_,Ge)+_.places[Ge].dz))<.03?(Te.leaving=!1,Te.guest=!0,Te.i=Ge,Te.cat=_.cat):(re(Te),Te=null)),Te||(Te=me(J,Ge,_),v.actors.set(J.id,Te)),Te.seen=U}mr(_.title,Y.x,W+Me*(1+qo)/2*v.preset.S,v.view.rtl)}}function tn(_){let T=v.preset,G=v.lane,U=(1+qo)*T.S,V=(Y,W)=>{if(!Y||!Y.items.length||Ti(Y.scene).id!==T.id||!G.n)return null;let Me=oa(T,Y.items,Y.kind,_.rtl),xe=W>0?xt(G,G.n-1)-v.walk*U:xt(G,0)+v.walk*U;return{x:G.x,z:xe+v.walk*Me[W>0?0:Me.length-1].z,places:Me,n:Me.length,cat:Y.id,kind:Y.kind,items:Y.items,title:W>0?Y.name:_.catName}};v.guests.next=V(_.next,1),v.guests.prev=V(_.prev,-1);for(let Y=0;Y<2;Y++){let W=Y?_.next:_.prev,Me=W?Ti(W.scene):null;Me&&Me.id!==T.id&&!Me.holo&&!T.holo&&ne(Me.surface(s))}}let xt=(_,T)=>_.z-v.walk*_.places[T].z;function ai(_){let T=v.preset,G=v.lane;return[G.x+zc(G.places,_),G.z-v.walk*aa(G.places,_,T.S)]}function ms(_){if(v.lost||v.disposed){v.view=_;return}let T=v.view,G=Ti(_.scene),U=!v.preset||v.preset.id!==G.id,V=v.preset,Y=!T||T.catId!==_.catId||U||T.rtl!==_.rtl||T.rev!==_.rev,W=T&&V&&v.lane.cat!=null?ai(v.lastP==null?i.state.p:v.lastP):[0,0];if(t&&T&&!v.first&&r.onCut&&(T.catId!==_.catId||U)&&v.w&&(X(),r.onCut(e)),v.view=_,v.preset=G,(U||!T)&&Ye(G.surface(s)),(!v.frame||U||T&&T.rtl!==_.rtl)&&vr(),Y){let Ae=T&&_.nav&&_.nav.kind==="category"?_.nav.dir||1:0,Pe=G,Ve=_.items.length,Le=At(_.index,0,Ve-1),je=W[0]+v.dev.x,ot=W[1]+v.devZ.x,gt=-v.walk,On=gt*Pe.S,Gt=oa(Pe,_.items,_.kind,_.rtl),_r=!!T&&T.rtl===_.rtl&&T.rev===_.rev&&!!Ae&&!v.first,Jo=_r&&!U,jo=_r&&U&&!t&&!!V&&!!ve(V)&&!!ve(Pe)&&ve(V)!==ve(Pe);if(Jo){let ht=Ae>0?v.guests.next:v.guests.prev,kn=v.lastP==null?i.state.p:v.lastP,nn=v.actors.get(_.itemId);if(ht&&ht.cat===_.catId&&!t&&nn&&nn.guest&&!nn.leaving&&(Ae>0?kn>v.lane.n-2.4:kn<1.4))v.actors.forEach(wt=>{wt.guest&&wt.cat===_.catId&&!wt.leaving?wt.guest=!1:wt.leaving||(wt.leaving=!0,wt.guest=!1)}),v.lane={x:ht.x,z:ht.z,cat:_.catId,kind:_.kind,n:Ve,places:ht.places},v.lastP=Le,v.devZ.x=ot-xt(v.lane,Le),v.dev.x=je-ai(Le)[0];else{let wt=Ae>0?Math.min(Vo,Le):Math.min(Wo,Ve-1-Le),Vt=Math.abs(Gt[Le].z-Gt[Le-Ae*wt].z),Ut=Vt+(1+qo)*Pe.S,Wt=ot+Ae*gt*Ut;v.actors.forEach(st=>{let li=(st.z-ot)/On*Ae;st.leaving=!0,st.guest=!1,st.visT=st.visT>0&&li<.5?1:0}),v.lane={x:v.lane.x,z:Wt+v.walk*Gt[Le].z,cat:_.catId,kind:_.kind,n:Ve,places:Gt},v.lastP=Le,t?(v.devZ.x=0,v.dev.x=0,v.actors.forEach(st=>{st.visT=0}),Nn()):(v.devZ.x=ot-Wt,v.dev.x=je-ai(Le)[0],mr(Ae>0?_.catName:T.catName,v.lane.x,Wt-Ae*gt*(Vt+(1+qo)/2*Pe.S),_.rtl))}}else if(jo){let ht=Ae*gt,kn=Ae>0?Math.min(Vo,Le):Math.min(Wo,Ve-1-Le),nn=Math.abs(Gt[Le].z-Gt[Le-Ae*kn].z),wt=v.edge,Vt=!!wt&&wt.s===-ht,Ut=Vt&&!wt.away?wt.zTo:ot+ht*(ux+_c),Wt=Ut+ht*(_c+hx+nn);v.actors.forEach(st=>{let li=(st.z-ot)*ht/V.S;st.leaving=!0,st.guest=!1,st.visT=st.visT>0&&li<.5?1:0}),Nn(),v.edge={z:Vt&&(wt.z-Ut)*ht<ld?wt.z:Ut+ht*ld,zTo:Ut,to:Pe.kind,s:ht,w:_c,away:0},v.lane={x:v.lane.x,z:Wt+v.walk*Gt[Le].z,cat:_.catId,kind:_.kind,n:Ve,places:Gt},v.lastP=Le,v.devZ.x=ot-Wt,v.dev.x=je-ai(Le)[0]}else v.actors.forEach(ht=>{ht.leaving=!0,ht.guest=!1,ht.visT=0}),Nn(),v.edge=null,v.lane={x:T?v.lane.x:0,z:W[1]+v.walk*Gt[Le].z,cat:_.catId,kind:_.kind,n:Ve,places:Gt},v.lastP=Le,v.dev.x=0,v.dev.v=0,v.devZ.x=0,v.devZ.v=0;tn(_),v.heroReady=null}ze();let Me=v.actors.get(_.itemId),xe=!!_.lifted,Ge=xe&&Me&&(!T||!T.lifted||T.itemId!==_.itemId),J=!!T&&T.pourSeq!==_.pourSeq;v.actors.forEach(Ae=>{(Ae!==Me||!xe)&&(Ae.pour=null)});let Te=v.hush;v.hush=!1,xe&&Me&&Me.drink&&Me.drink.spec.pourable&&!t&&!Te&&(Ge||J)&&(Me.pour={t:-.5},Me.pose=xc(-.5,Me.drink.spec),v.pours++),_.nav&&_.nav.kind==="edge"&&_.nav.seq!==v.navSeq&&!t&&(v.bump=-(_.nav.axis==="x"?_.rtl?-1:1:0)*_.nav.dir*.5),_.nav&&(v.navSeq=_.nav.seq),T&&T.lang!==_.lang&&gr(),v.first&&(v.first=!1,v.intro=t||!r.intro?0:1,xr()),Un(),Be()}function mr(_,T,G,U){if(!_)return;for(let Ve=0;Ve<v.titles.length;Ve++)if(Math.abs(v.titles[Ve].z-G)<.3){if(v.titles[Ve].text===_)return;Jt(v.titles[Ve]);break}for(;v.titles.length>2;)Jt(v.titles[0]);let V=document.createElement("canvas");V.width=1024,V.height=256;let Y=V.getContext("2d"),W=Ve=>"700 "+Ve+'px "Frank Ruhl Libre","Times New Roman",serif',Me=132;Y.font=W(Me);let xe=Y.measureText(_).width;xe>900&&(Me=Math.max(40,Math.floor(Me*900/xe)),Y.font=W(Me));try{Y.direction=U?"rtl":"ltr"}catch{}Y.textAlign="center",Y.textBaseline="middle",Y.shadowColor="rgba(0,0,0,.6)",Y.shadowBlur=26,Y.fillStyle="rgba(250,243,230,.95)",Y.fillText(_,512,132),Y.shadowBlur=8,Y.fillText(_,512,132);let Ge=new In(V);Ge.anisotropy=l;let J=Math.min(v.frame?v.frame.W/v.frame.ppu*.9:2.2,3),Te=Math.min(J,1024/Math.max(260,Math.min(900,xe))*1.15),Ae={map:{value:Ge},uGlow:u.glow,uK:{value:0},uLight:{value:1}},Pe=new Xe(O,new tt({uniforms:Ae,vertexShader:en,fragmentShader:Oh,transparent:!0,depthWrite:!1}));Pe.frustumCulled=!1,Pe.renderOrder=-4,Pe.scale.set(Te,1,Te/4),Pe.position.set(T,.012,G),h.add(Pe),v.titles.push({m:Pe,u:Ae,tex:Ge,x:T,z:G,k:0,text:_})}function Jt(_){h.remove(_.m),_.tex.dispose(),_.m.material.dispose();let T=v.titles.indexOf(_);T>=0&&v.titles.splice(T,1)}function Nn(){v.titles.slice().forEach(Jt)}function gr(){v.actors.forEach(_=>{_.type==="text"&&fe(_),_.drink&&v.view&&_.drink.paint(ia(_.item,_.kind,v.view.lang))}),Be()}function vr(){!v.w||!v.preset||!v.view||(v.frame=Fc(v.preset,v.w,v.h,!!v.view.rtl),r.onFrame&&r.onFrame(v.frame))}function Mi(){let _=v.preset,T=v.frame,G=v.view,U=v.actors.get(G.itemId),V=!!G.lifted,Y=_.E,W=1,Me=T.cy,xe=0,Ge=0;if(!V&&i.state.mode==="settle"&&(W=1-fx*Yo((Math.abs(i.state.v)-Zo[0])/5)),V){let J=U&&U.type==="drink",Te=U&&U.type==="stand",Ae=T.wide?T.sheetH:At(r.sheet&&r.sheet()||T.sheetH,T.cardH,T.sheetH);if(Y=_.kind==="bar"?J?_.liftE:Te?_.liftEStand:38:_.liftE,W=T.liftZoom,Me=T.wide?T.liftCy:Ic(T.H,Ae,T.standing),xe=_.liftY+(U?(U.float||0)+Math.min(.5,U.shape.top*.4):0),_.kind==="bar"&&U){let Pe=U.shape,Ve=U.pose&&U.pour?U.pose.cam:0,Le=Pe.drink?{r:Pe.drink.rest.r+(Pe.drink.pour.r-Pe.drink.rest.r)*Ve,cx:Pe.drink.rest.cx+(Pe.drink.pour.cx-Pe.drink.rest.cx)*Ve,top:Pe.drink.rest.top+(Pe.drink.pour.top-Pe.drink.rest.top)*Ve}:{r:Pe.r,cx:0,top:Pe.top},je=T.wide?(T.W-T.cardW)*.56:T.W*.86,ot=T.wide?T.H-T.top-40:T.H-Ae-64,gt=Y*Ts,On=Math.min(je/(2*Le.r+.1),ot/(Le.top*Math.cos(gt)+Le.r*1.2*Math.sin(gt)+.1));W=At(On/T.ppu,.45,1.5),Ge=Le.cx+(Pe.drinkX||0)*0,xe=0,Me=T.wide?T.top+(T.H-T.top)*.86:T.H-Ae-14-Le.r*.6*Math.sin(gt)*On}}return{E:Y,zoom:W,cy:Me,lookY:xe,offX:Ge}}function xr(){let _=Mi();v.fov.x=v.frame.fov,v.D.x=v.frame.D,v.fov.v=v.D.v=0,v.E.x=_.E,v.zoom.x=_.zoom,v.cy.x=_.cy,v.lookY.x=_.lookY,v.offX.x=_.offX,v.E.v=v.zoom.v=v.cy.v=v.lookY.v=v.offX.v=0,v.lift.x=v.view&&v.view.lifted?1:0,v.lift.v=0,v.pool.x=v.preset.pool}function Un(){v.touchAt=v.clock}let gs=new M,yr=new M;function b(_){v.clock+=_;let T=v.clock;u.time.value=T,u.pulse.value+=_;let G=v.view;if(!G||!v.frame||v.lost)return!1;let U=I(_),V=v.preset,Y=v.frame,W=i.state,Me=W.p,xe=!!G.lifted,Ge=!!V.holo,J=V.kind==="bar";v.lastP=Me,ze();let Te=v.actors.get(G.itemId)||null,Ae=(L,ft,ea)=>{if(t){L.x=ft,L.v=0;return}Pc(L,ft,ea,_),Math.abs(L.x-ft)>.001||Math.abs(L.v)>.01?U=!0:(L.x=ft,L.v=0)},Pe=Mi();Ae(v.E,Pe.E,v.edge?6.5:9),Ae(v.fov,Y.fov,6.5),Ae(v.D,Y.D,6.5),Ae(v.zoom,Pe.zoom,10),Ae(v.cy,Pe.cy,v.edge&&!xe?6.5:11),Ae(v.lookY,Pe.lookY,11),Ae(v.offX,Pe.offX,9),Ae(v.lift,xe?1:0,12),Ae(v.pool,xe?V.pool*(V.open?.8:.46):V.pool*(1+(t?0:V.open||0)*(W.mode==="drag"||W.mode==="wheel"?1:1-cd(W))),xe?7:4.2),r.onLift&&r.onLift(At(v.lift.x,0,1.2)),v.dragX.active?(v.dev.x=-v.dragX.dx/Y.ppu*.3,v.dev.v=0,U=!0):Ae(v.dev,0,12),Ae(v.devZ,0,5.6),Math.abs(v.bump)>.002?(U=!0,v.bump*=Math.exp(-_*8)):v.bump=0,v.intro>.002?(v.intro*=Math.exp(-_*3.2),U=!0):v.intro=0;let Ve=ai(Me),Le=Ve[0]+v.dev.x+v.bump+v.offX.x,je=Ve[1]+v.devZ.x+v.walk*v.intro*1.1,ot=T-v.touchAt,gt=t||ot>cx?0:W.mode==="rest"&&!v.dragX.active&&!v.turning?1:.25;v.swayK+=(gt-v.swayK)*Nt(_,2.2),Math.abs(gt-v.swayK)<.002&&(v.swayK=gt);let On=v.swayK,Gt=On>0||gt>0,_r=Nt(_,5);for(let L=0;L<2;L++)v.tilt[L]+=(v.tiltT[L]-v.tilt[L])*_r,v.ptr[L]+=(v.ptrT[L]-v.ptr[L])*_r,Math.abs(v.tiltT[L]-v.tilt[L])+Math.abs(v.ptrT[L]-v.ptr[L])>.002&&(U=!0);let Jo=t?0:Math.sin(T*.52)*.06*On+v.tilt[0]*.13+v.ptr[0]*-.075,jo=t?0:Math.sin(T*.37+1)*.7*On+v.tilt[1]*3+v.ptr[1]*1.6;Gt&&(U=U||"slow");let ht=v.lens;ht.W=Y.W,ht.H=Y.H,ht.D=v.D.x,ht.fov=v.fov.x;let kn=[Le,v.lookY.x,je],nn=la(ht,kn,v.E.x+jo,v.zoom.x,Jo,Y.cx,v.cy.x),wt=la(ht,kn,v.E.x,v.zoom.x,0,Y.cx,v.cy.x);d.position.fromArray(nn.pos),gs.fromArray(kn),d.lookAt(gs),(Math.abs(d.fov-nn.fov)>1e-4||d.aspect!==v.w/v.h)&&(d.fov=nn.fov,d.aspect=v.w/v.h),d.setViewOffset(v.w,v.h,nn.offset[0],nn.offset[1],v.w,v.h),d.updateMatrixWorld(),v.base.fromArray(wt.pos),v.focus.set(Ve[0],0,Ve[1]),v.lampK=1;let Vt=Ve[0]+v.offX.x,Ut=Ve[1]+v.devZ.x;w.uPool.value.set(Vt,Ut+.1,v.pool.x),w.uLampPos.value.set(Vt+.5,3.6,Ut+1.5),w.uDim.value=v.lampK,w.uLane.value.set(v.lane.x,V.width/2,sa,0),u.mask.value.set(v.lane.x,V.width/2,0,0);let Wt=ve(V),st=v.edge;st&&(U=!0,st.away||(st.z+=(st.zTo-st.z)*Nt(_,9)),(st.away||(je-st.zTo)*st.s>0)&&(st.away+=_,st.z-=st.s*_*(4+90*st.away),Math.abs(st.z-je)>34&&(v.edge=null))),H.position.set(Le,0,je),z&&(z.counter.position.set(Le,0,je),z.cu.uBack.value=je-sd.wall,z.wall.position.set(Le,9,z.cu.uBack.value)),u.hub.value.set(v.lane.x,je),u.at.value.set(Vt,Ut);let li=d.position,Si=v.base,wc=t?1:Nt(_,7),ud=cd(W),bc=V.rim!=null,wr=-9;if(P){let L=T-P.scanAt;L>0&&L<1.6&&!t&&(wr=-.06+L/1.6),L>7&&(P.scanAt=T)}let $o=[],Ko=!1;if(v.glowing=!1,v.titles.slice().forEach(L=>{if(Math.abs(L.z-je)>(yc+1.4)*V.S){Jt(L);return}L.k<1&&(L.k=t?1:Math.min(1,L.k+_*5),U=!0);let ft=Math.hypot(L.x-Vt,L.z-Ut);L.u.uK.value=L.k*(Wt?Wt.fade:1)*(xe?.45:1),L.u.uLight.value=(.34+.66/Math.pow(1+ft*ft/v.pool.x,1.5))*(.25+.75*v.lampK)}),v.actors.forEach(L=>{let ft=L===Te&&!L.leaving,ea=L.g.position,hd=xe&&J&&!ft&&Te&&(Te.type==="drink"||Te.type==="stand");L.leaving&&L.visT>0&&L.room&&L.room!==Wt&&L.room.fade<.2&&(L.visT=0);let Mc=L.ready?hd?0:L.visT:0;if(L.vis+=(Mc-L.vis)*(L.leaving&&!t?Nt(_,11):wc),(Math.abs(Mc-L.vis)>.004||!L.ready&&!L.leaving)&&(U=!0),L.leaving&&L.visT>0&&Math.abs(L.z-je)>(yc+.8)*V.S&&(L.visT=0),L.leaving&&L.visT===0&&!L.ghost&&(L.ghost=!0,L.g.traverse(gn=>{gn.material&&(gn.material.depthWrite=!1)})),L.leaving&&L.vis<.012){$o.push(L);return}L.g.visible=L.vis>.004;let ci=L.x,ui=L.z,Tn=t?L.vis>.5?1:0:Yo(L.vis),Sc=Math.hypot(ci-Vt,ui-Ut),Tc=1/Math.pow(1+Sc*Sc/v.pool.x,1.5),ta=(bc?Math.sqrt((.2+Tc)/1.2):.16+.84*Tc)*(.25+.75*v.lampK)*(L.room?L.room.fade:1),Ec=L.item.available===!1;Ec&&!ft&&(ta*=.86),L.light+=(ta-L.light)*(t?1:Nt(_,9)),Math.abs(ta-L.light)>.004&&(U=!0);let Ac=Ec?ft?.12:.08:1;L.sat+=(Ac-L.sat)*wc,Math.abs(Ac-L.sat)>.01&&(U=!0);let dd=ft?v.lift.x:0;L.lift=ft?dd:L.lift+(0-L.lift)*(t?1:Nt(_,10)),L.lift>.002&&!ft&&(U=!0);let vs=L.leaving||L.guest||L.cat!==G.catId||t||!bc?0:Yo(1-Math.abs(L.i-Me)*2.2)*ud;L.near+=(vs-L.near)*Nt(_,vs>L.near?6.5:10),Math.abs(vs-L.near)>.003?U=!0:L.near=vs;let xs=L.type==="drink"?L.drink.spec.turns?1/0:0:L.type==="stand"?.95:L.type==="relief"?.45:L.type==="photo"?.3:.5;ft&&xe?v.turning||(xs===0?(L.turn.x=0,L.turn.v=0):ra(L.turn,xs,t?0:_)):isFinite(xs)?ra(L.turn,Math.max(xs,.01),t?0:_):(L.turn.v=0,L.turn.x=Math.atan2(Math.sin(L.turn.x),Math.cos(L.turn.x)),L.turn.x*=t?0:Math.exp(-_*9),Math.abs(L.turn.x)<.002&&(L.turn.x=0)),t&&!(ft&&xe)&&(L.turn.x=0,L.turn.v=0),(Math.abs(L.turn.x)>.0015||Math.abs(L.turn.v)>.01)&&(U=!0);let hi=L.near*(1-L.lift),ys=L.turn.x,_s=L.lift*V.liftY+hi*dx;ea.set(ci,0,ui);let na=Math.atan2(Si.x-ci,Si.z-ui)*.85+(L.holo?0:L.spin*(1-.6*L.near))+ys;if(L.um.uReveal.value=Tn,L.um.uLight.value=L.light,L.um.uSat.value=L.sat,L.drink){let gn=L.drink.spec;if(L.pour)L.pour.t+=_,L.pose=xc(L.pour.t,gn),L.pose.done&&(L.pour=null),U=!0;else if(!L.pose.done){let qt=fr(gn),Hn=t?1:Nt(_,9),jt=L.pose,Gn=0;["fade","tilt","level","wobble","foam","bubbles","cam"].forEach(vn=>{jt[vn]+=(qt[vn]-jt[vn])*Hn,Gn=Math.max(Gn,Math.abs(qt[vn]-jt[vn]))}),jt.head=0,jt.tail=1,Gn<.004?L.pose=qt:U=!0}if(L.type!=="drink"){let qt=L.drink.shared;qt.uReveal.value=Tn,qt.uLight.value=L.light,qt.uSat.value=L.sat}L.drink.update(L.pose,{cx:Si.x,cz:Si.z,wx:ci+L.shape.drinkX,wz:ui+L.shape.drinkZ,baseY:L.holo&&L.type==="drink"?bn:0,yaw:L.type==="drink"?ys:0,refl:u.refl.value,holo:L.holo})}if(L.type==="relief"||L.type==="stand"){let gn=ft?x:y;L.mesh.geometry!==gn&&(L.mesh.geometry=gn);let qt=L.shape.s||1;if(L.holo){Ko=!0;let Hn=Ge&&!L.stock&&ft?1:0;L.um.uFocus.value+=(Hn-L.um.uFocus.value)*Nt(_,6),L.ub.uOn.value+=((ft?1:.4)*Tn-L.ub.uOn.value)*Nt(_,5),L.um.uGlitch.value*=Math.exp(-_*7),L.um.uGlitch.value<.004?L.um.uGlitch.value=0:U=!0,L.um.uScan.value=ft?wr/(Ss*qt):-9;let jt=L.float+_s+(t?0:Math.sin(T*1.1+L.x*2.1)*.018),Gn=Math.atan2(li.y-jt,Math.hypot(li.x-ci,li.z-ui)),vn=At(L.um.uE.value-Gn,-.4,.4),br=Ss*qt*(ft?1.04:1);[L.mesh,L.refl].forEach(di=>{di.position.y=jt,di.rotation.y=na,di.rotation.x=vn,di.scale.setScalar(br)}),L.mir.position.y=2*bn,L.refl.material.depthTest=!0,L.refl.visible=L.ready&&Ge,L.shadow.visible=!1,Gt&&(U=U||"slow")}else{let Hn=Ss*qt*(.96+.04*Tn)*(1+.035*L.lift+.012*hi);[L.mesh,L.refl].forEach(ws=>{ws.position.y=.016+_s,ws.rotation.y=na,ws.rotation.x=0,ws.scale.setScalar(Hn)}),L.mir.position.y=0,L.refl.material.depthTest=!1,L.refl.visible=L.ready&&L.lift<.02&&L.room===Wt&&u.refl.value>.02&&(L.type==="stand"||L.shape.top>.5);let jt=L.shadow.material.uniforms;L.shadow.visible=L.ready,L.shadow.rotation.y=na,L.shadow.scale.setScalar(Hn*(1+.16*L.lift+.03*hi)),jt.uK.value=(L.type==="stand"?.5:.74)*Tn*(1-.42*L.lift-.1*hi),jt.uSoft.value=1.6*L.lift+.7*hi;let Gn=ci-(Vt+.5),vn=ui-(Ut+1.5),br=Math.hypot(Gn,vn)||1,di=(Math.min(.1,.035+br*.016)+.22*L.lift+.05*hi)/Hn;jt.uCast.value.set(Gn/br*di,vn/br*di-(.1*L.lift+.02*hi)/Hn)}}else if(L.type==="drink")L.holo&&(Ko=!0,L.ub.uOn.value+=((ft?1:.4)*Tn-L.ub.uOn.value)*Nt(_,5));else if(L.type==="photo"){let gn=L.cardSize[0],qt=L.cardSize[1];L.mesh.position.y=.014+_s,L.mesh.rotation.y=L.spin*1.6+ys,L.mesh.rotation.x=-Mn/2,L.shadow.rotation.z=L.spin*1.6,L.shadow.position.set(.03+.2*L.lift,.006,.05+.16*L.lift),L.shadow.scale.set(gn*1.22,qt*1.3,1),L.shadow.material.uniforms.uK.value=.55*Tn*(1-.4*L.lift)}else L.tent.position.y=_s,L.tent.rotation.y=Math.atan2(Si.x-ci,Si.z-ui)*.5+L.spin+ys,L.shadow.position.set(.04,.006,0),L.shadow.scale.set(pr[0]*1.3,pr[1]*1.5,1),L.shadow.material.uniforms.uK.value=.5*Tn*(1-.5*L.lift),L.holo&&(L.ub.uOn.value+=((ft?1:.4)*Tn-L.ub.uOn.value)*Nt(_,5))}),$o.forEach(re),$o.length&&S(),v.glowing=Ko,P&&P.g.visible){let L=Te&&Te.ready?1:0;P.fxOn+=(L-P.fxOn)*Nt(_,6),P.fxU.uOn.value=P.fxOn,Te&&P.fx.position.copy(Te.g.position),P.hoop.position.y=Go+Math.max(wr,0)*.92,P.hoop.material.uniforms.uOn.value=wr>-1?P.fxOn*Math.sin(At((wr+.06)/1)*Mn):0,P.halo.position.set(Vt,.8,Ut-1.4),P.halo.material.opacity=.14+(t?0:Math.sin(T*.9)*.02),P.floor.position.set(Le,-.02,je)}let Qo=!!(Te&&Te.ready&&Te.vis>.9&&Wt&&Wt.fade>.85||Te&&Te.ready&&Ge);return Qo!==v.heroReady&&(v.heroReady=Qo,r.onHero&&r.onHero(Qo,Te?Te.id:null)),(v.dragX.active||v.turning||i.busy())&&(U=!0),v.moving=U,U}function X(){if(v.lost||!v.w||!v.view)return;let _=v.bloom&&(v.glowing||v.room==="holo"||D.bar.fade>.01);if(o.info.reset(),_){let T=P?P.halo.visible:!1,G=!v.glowing&&v.room!=="holo";u.glow.value=1,P&&(P.halo.visible=!1),G&&d.layers.disable(1),o.setRenderTarget(oe),o.render(h,d),u.glow.value=0,P&&(P.halo.visible=T),G&&d.layers.enable(1),be(oe,we,2/oe.width,0),be(we,pe,0,1.5/we.height),be(pe,Ce,2/pe.width,0),be(Ce,Fe,0,2/Ce.height)}o.setRenderTarget(null),o.render(h,d),_&&(he.material=Se,o.autoClear=!1,o.render($,ee),o.autoClear=!0),v.frames++,v.stats.calls=o.info.render.calls,v.stats.triangles=o.info.render.triangles,Q(),!v.full&&r.onFull&&v.heroReady&&(v.full=!0,r.onFull())}let k=(_,T,G)=>(yr.set(_,T,G).project(d),[(yr.x*.5+.5)*v.w,(.5-yr.y*.5)*v.h]);function Q(){let _=[];v.actors.forEach(T=>{if(T.leaving||!T.ready||T.vis<.5)return;let G=T.type==="stand"||T.type==="drink"||T.type==="text",U=T.x,V=T.z,Y=T.type==="text"?pr[0]/2:T.shape.r,W=T.lift*v.preset.liftY+(T.holo?(T.float||0)*.8:0),Me=T.type==="text"?pr[1]*.9:G?T.shape.top:T.shape.top*.5,xe=k(U-Y,W,V),Ge=k(U+Y,W,V),J=k(U,W,V+(G?Y*.5:Y)),Te=k(U,W+Me,G?V:V-Y);_.push({id:T.id,i:T.i,cx:(xe[0]+Ge[0])/2,cy:(J[1]+Te[1])/2,rx:Math.abs(Ge[0]-xe[0])/2,ry:Math.abs(J[1]-Te[1])/2,z:T.z})}),v.hot=_}function ye(_,T){let G=null,U=v.view?v.view.itemId:null;return v.hot.forEach(V=>{let Y=(_-V.cx)/(V.rx*1.04),W=(T-V.cy)/(V.ry*1.06);Y*Y+W*W<=1&&(!G||V.id===U||G.id!==U&&V.z>G.z)&&(G=V)}),G?G.id:null}function Be(){v.disposed||v.lost||r.wake&&r.wake()}function Ue(_){v.slow=_>.045?v.slow+(_>.12?3:1):Math.max(0,v.slow-2),v.slow>45&&(v.slow=0,v.tier++,v.tier===1?v.bloom=!1:v.tier===2?(c=1,o.setPixelRatio(1),u.px.value=1,Oe(!0)):v.tier===3&&(c=.7,o.setPixelRatio(c),Oe(!0)),r.onTier&&r.onTier(v.tier))}function Oe(_){let T=e.clientWidth,G=e.clientHeight;if(!T||!G||!_&&T===v.w&&G===v.h)return;v.w=T,v.h=G,o.setSize(T,G,!1),d.aspect=T/G;let U=o.domElement.width,V=o.domElement.height,Y=W=>Math.max(2,Math.round(W));oe.setSize(Y(U/2),Y(V/2)),we.setSize(Y(U/4),Y(V/4)),pe.setSize(Y(U/4),Y(V/4)),Ce.setSize(Y(U/8),Y(V/8)),Fe.setSize(Y(U/8),Y(V/8)),v.view&&v.preset&&(vr(),xr()),Be()}let et=_=>{_.preventDefault(),v.actors.forEach(T=>{T.pour=null,T.drink&&(T.pose=fr(T.drink.spec))}),v.lost=!0,r.onLost&&r.onLost(!0)},He=()=>{v.lost=!1,v.w=0,Ne(),Oe(!0),r.onLost&&r.onLost(!1),Be()};e.addEventListener("webglcontextlost",et,!1),e.addEventListener("webglcontextrestored",He,!1);function Ze(){let _=(W,Me)=>W&&W.width?W.width*W.height*4*(Me?1.33:1):0,T=0,G=0,U=0;Z.forEach(W=>{W.ready&&(T+=_(W.tex.image,W.tex.generateMipmaps))}),j.texs.forEach(W=>{W.map&&W.map.image&&(U+=_(W.map.image,!0)),W.h&&W.h.image&&(U+=_(W.h.image,!0))}),K.traverse(W=>{let Me=W.material&&W.material.uniforms&&W.material.uniforms.map;Me&&Me.value&&Me.value.isCanvasTexture&&!(W.material.uniforms.uMirror&&W.material.uniforms.uMirror.value)&&!(W.material.uniforms.uBlank&&W.material.uniforms.uBlank.value)&&(G+=_(Me.value.image,!0))});let V=[oe,we,pe,Ce,Fe].reduce((W,Me)=>W+Me.width*Me.height*4,0)+oe.width*oe.height*4,Y=W=>+(W/1048576).toFixed(1);return{pictures:Y(T),labels:Y(G),surfaces:Y(U),targets:Y(V),total:Y(T+G+U+V)}}function Ne(){Nn(),v.devZ.x=0,v.devZ.v=0,[...v.actors.values()].forEach(re),v.view=null,v.first=!0,v.hot=[],v.heroReady=null,v.lane={x:0,z:0,places:[],n:0,cat:null,kind:"food"},v.guests.prev=v.guests.next=null,v.lastP=null,v.dev.x=0,v.dev.v=0,v.lampK=1,v.edge=null,v.full=!1}return{sync:ms,size:Oe,hit:ye,repaintCards:gr,step:b,draw:X,perf:Ue,touch:Un,dragX(_,T){v.dragX.active=!!T,v.dragX.dx=T?_:0,Un(),Be()},turn(_,T,G){let U=v.view;if(!U||!U.lifted){v.turning=!1;return}let V=v.actors.get(U.itemId);if(!V)return;let Y=V.type==="drink"?V.drink.spec.turns?1/0:0:V.type==="stand"?.95:V.type==="relief"?.45:V.type==="photo"?.3:.5;if(T){v.turning=!0,V.pour=null;let W=V.turn.x+_*.0085;V.turn.x=isFinite(Y)?At(W,-Y,Y):W,V.turn.v=0}else v.turning=!1,V.turn.v=t||Y===0?0:At((G||0)*.0085,-9,9);Un(),Be()},turnBy(_){let T=v.view;if(!T||!T.lifted)return;let G=v.actors.get(T.itemId);G&&(t?G.turn.x+=_:G.turn.v+=_*6,Un(),Be())},setPointer(_,T){v.ptrT[0]=At(_,-1,1),v.ptrT[1]=At(T,-1,1),Be()},setTilt(_,T){v.tiltT[0]=At(_,-1,1),v.tiltT[1]=At(T,-1,1),Be()},feedFrameTime(_){v.frames=99,Ue(_)},metrics:()=>v.frame?v.frame:null,along:_=>v.preset&&v.lane.n?aa(v.lane.places,_,v.preset.S)/v.preset.S:_,dish:_=>v.preset&&v.lane.n?Bc(v.lane.places,_*v.preset.S,v.preset.S):_,pending:()=>ie,loaded:(_=8e3)=>ie===0?Promise.resolve():new Promise(T=>{Ee.push(T),setTimeout(T,_)}),info:()=>({moving:v.moving,tier:v.tier,bloom:v.bloom,pixelRatio:c,frames:v.frames,p:+i.state.p.toFixed(4),mode:i.state.mode,lampK:+v.lampK.toFixed(3),lift:+v.lift.x.toFixed(3),fade:+(v.room==="holo"?1:D[v.room].fade).toFixed(3),rooms:{table:+D.table.fade.toFixed(3),bar:+D.bar.fade.toFixed(3)},edge:v.edge?{z:+v.edge.z.toFixed(2),at:+v.edge.zTo.toFixed(3),to:v.edge.to,s:v.edge.s,away:+v.edge.away.toFixed(2)}:null,heroReady:!!v.heroReady,actors:[...v.actors.values()].map(_=>({id:_.id,i:_.i,type:_.type,holo:_.holo,ready:_.ready,leaving:_.leaving,left:_.leaving&&_.visT>0,guest:_.guest,cat:_.cat,vis:+_.vis.toFixed(3),yaw:+_.turn.x.toFixed(3),lift:+_.lift.toFixed(3),near:+_.near.toFixed(3),light:+_.light.toFixed(3),sat:+_.sat.toFixed(2),x:+_.x.toFixed(2),z:+_.z.toFixed(2),pouring:!!_.pour,pose:_.pose?{tilt:+_.pose.tilt.toFixed(3),level:+_.pose.level.toFixed(3),foam:+_.pose.foam.toFixed(3),fade:+_.pose.fade.toFixed(3),t:_.pour?+_.pour.t.toFixed(2):null}:null,tris:_.drink?_.drink.tris:void 0})),hot:v.hot.map(_=>({id:_.id,cx:Math.round(_.cx),cy:Math.round(_.cy),rx:Math.round(_.rx),ry:Math.round(_.ry)})),pours:v.pours,drinks:q.stats(),stats:{calls:v.stats.calls,triangles:v.stats.triangles},memory:Ze(),lane:{x:+v.lane.x.toFixed(2),z:+v.lane.z.toFixed(2)},walkOn:+v.devZ.x.toFixed(3),titles:v.titles.map(_=>({text:_.text,z:+_.z.toFixed(2),k:+_.k.toFixed(2)})),textures:Z.size,surfaces:j.texs.size,scene:v.preset?v.preset.id:null,lost:v.lost,frame:v.frame,cam:{pos:d.position.toArray(),line:+v.focus.x.toFixed(4),E:+v.E.x.toFixed(2),zoom:+v.zoom.x.toFixed(3),cy:+v.cy.x.toFixed(1),fov:d.fov},gl:{geometries:o.info.memory.geometries,textures:o.info.memory.textures}}),sleep(){Ne(),Z.forEach(_=>_.tex&&_.tex.dispose()),Z.clear(),o.setRenderTarget(null),o.clear()},reset:Ne,isLost:()=>v.lost,rewind(){v.clock=0,v.touchAt=0,v.swayK=0,v.intro=0,v.tilt=[0,0],v.tiltT=[0,0],v.ptr=[0,0],v.ptrT=[0,0],u.pulse.value=9,P&&(P.scanAt=2.2)},hush(){v.hush=!0},setWalk(_){v.walk=_===-1?-1:1},setTheme(_){_&&(s=_,_.accent&&u.accent.value.set(_.accent),v.preset=null)},resetPerf(){v.tier=0,v.slow=0,v.bloom=!0,c=r.pixelRatio||Math.min(window.devicePixelRatio||1,2),o.setPixelRatio(c),u.px.value=c,v.w=0},dispose(){v.disposed=!0,Nn(),e.removeEventListener("webglcontextlost",et),e.removeEventListener("webglcontextrestored",He),[...v.actors.values()].forEach(re),Z.forEach(_=>_.tex&&_.tex.dispose()),Z.clear(),j.texs.forEach(_=>{_.map&&_.map.dispose(),_.h&&_.h.dispose()}),o.dispose()}}}export{qx as createStage};

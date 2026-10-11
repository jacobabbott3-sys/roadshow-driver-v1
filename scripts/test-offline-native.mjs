import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=mkdtempSync(join(tmpdir(),'roadshow-offline-'));
const env={...process.env,DEVELOPER_DIR:process.env.DEVELOPER_DIR||'/Users/jacoba/Downloads/Xcode-beta.app/Contents/Developer'};
try {
 for(const name of ['OfflineStoreTests','OfflineFileStoreTests']){
  const binary=join(temp,name);
  for(const [cmd,args] of [['xcrun',['swiftc','ios/App/App/Offline/OfflineModels.swift','ios/App/App/Offline/OfflineStore.swift','ios/App/App/Offline/OfflineFileStore.swift',`ios/App/AppTests/${name}.swift`,'-o',binary]],[binary,[]]]){
   const result=spawnSync(cmd,args,{env,stdio:'inherit'});if(result.status!==0)process.exitCode=1;
   if(result.status!==0)break;
  }
 }
}finally{rmSync(temp,{recursive:true,force:true});}

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=mkdtempSync(join(tmpdir(),'roadshow-watch-'));
try {
 const binary=join(temp,'WatchSnapshotTests');
 for(const [command,args] of [['xcrun',['swiftc','ios/App/WatchShared/WatchSnapshot.swift','ios/App/AppTests/WatchSnapshotTests.swift','-o',binary]],[binary,[]]]){
  const result=spawnSync(command,args,{stdio:'inherit'});
  if(result.status!==0){process.exitCode=1;break;}
 }
} finally {rmSync(temp,{recursive:true,force:true});}

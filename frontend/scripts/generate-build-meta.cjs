#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function safe(cmd, fallback){
  try { return execSync(cmd,{stdio:['ignore','pipe','ignore']}).toString().trim(); } catch { return fallback; }
}
const gitSha = safe('git rev-parse --short HEAD','dev');
const buildTime = new Date().toISOString();
// For Next.js, write an env file that can be sourced or read
const outPath = path.resolve(__dirname,'..','.env.build');
fs.writeFileSync(outPath, `NEXT_PUBLIC_GIT_SHA=${gitSha}\nNEXT_PUBLIC_BUILD_TIME=${buildTime}\n`);
console.log('[frontend build-meta] wrote', outPath, gitSha, buildTime);
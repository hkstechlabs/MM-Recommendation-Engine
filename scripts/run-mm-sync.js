#!/usr/bin/env node

// Simple Node.js runner for the MM sync script
const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 Starting MM Sync...')

// Run the TypeScript file using tsx
const child = spawn('npx', ['tsx', path.join(__dirname, 'mm-sync.ts')], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ MM Sync completed successfully')
  } else {
    console.error(`❌ MM Sync failed with exit code ${code}`)
    process.exit(code)
  }
})

child.on('error', (error) => {
  console.error('❌ Failed to start MM Sync:', error.message)
  process.exit(1)
})
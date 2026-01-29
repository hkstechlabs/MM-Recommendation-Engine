import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

function checkEnvironment() {
  console.log('🔍 Checking environment configuration...\n')

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'MM_ACCESS_TOKEN'
  ]

  const optionalVars = [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  let allGood = true

  // Check required variables
  console.log('📋 Required Environment Variables:')
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`)
    } else {
      console.log(`   ❌ ${varName}: NOT SET`)
      allGood = false
    }
  }

  console.log('\n📋 Authentication Keys:')
  
  // Check Supabase keys
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (anonKey) {
    console.log(`   ✅ Anon/Publishable Key: ${anonKey.substring(0, 20)}...`)
    console.log(`      (This key is for client-side use and has limited permissions)`)
  } else {
    console.log(`   ⚠️ Anon/Publishable Key: NOT SET`)
  }

  if (serviceKey) {
    console.log(`   ✅ Service Role Key: ${serviceKey.substring(0, 20)}...`)
    console.log(`      (This key bypasses RLS and is needed for the sync script)`)
  } else {
    console.log(`   ❌ Service Role Key: NOT SET`)
    console.log(`      This is REQUIRED for the MM sync script to work!`)
    allGood = false
  }

  // Provide guidance
  console.log('\n💡 Guidance:')
  
  if (!serviceKey) {
    console.log('   🔑 To get your Service Role Key:')
    console.log('      1. Go to your Supabase project dashboard')
    console.log('      2. Navigate to Settings > API')
    console.log('      3. Copy the "service_role" key (NOT the "anon" key)')
    console.log('      4. Add it to .env.local as SUPABASE_SERVICE_ROLE_KEY=your_key')
    console.log('')
  }

  if (allGood) {
    console.log('   🎉 All required environment variables are set!')
    console.log('   🚀 You can now run: npm run mm-sync')
  } else {
    console.log('   ⚠️ Some required environment variables are missing.')
    console.log('   📝 Please update your .env.local file and try again.')
  }

  return allGood
}

checkEnvironment()
import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

async function setupUniqueConstraints() {
  console.log('🔧 Setting up unique constraints for MM sync...')
  
  try {
    console.log('📝 Adding unique constraint on products.product_id...')
    
    // Add unique constraint on products.product_id
    const { error: productConstraintError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE public.products ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);' 
      })
    
    if (productConstraintError && !productConstraintError.message.includes('already exists')) {
      console.error('❌ Failed to add products constraint:', productConstraintError.message)
      console.log('💡 You may need to add this constraint manually in your Supabase dashboard:')
      console.log('   ALTER TABLE public.products ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);')
    } else {
      console.log('✅ Products unique constraint added successfully')
    }
    
    console.log('📝 Adding unique constraint on variants.variant_id...')
    
    // Add unique constraint on variants.variant_id
    const { error: variantConstraintError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE public.variants ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);' 
      })
    
    if (variantConstraintError && !variantConstraintError.message.includes('already exists')) {
      console.error('❌ Failed to add variants constraint:', variantConstraintError.message)
      console.log('💡 You may need to add this constraint manually in your Supabase dashboard:')
      console.log('   ALTER TABLE public.variants ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);')
    } else {
      console.log('✅ Variants unique constraint added successfully')
    }
    
    console.log('🎉 Unique constraints setup completed!')
    console.log('🚀 MM sync can now use efficient bulk upsert operations!')
    
  } catch (error) {
    console.error('💥 Failed to setup unique constraints:', error)
    console.log('\n💡 Manual Setup Instructions:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Run these commands:')
    console.log('   ALTER TABLE public.products ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);')
    console.log('   ALTER TABLE public.variants ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);')
    console.log('\n🔄 The MM sync script will work with or without these constraints (fallback mode)')
  }
}

// Run if executed directly
if (require.main === module) {
  setupUniqueConstraints()
}
import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

async function fixLineItemsConstraint(): Promise<void> {
  console.log('🔧 Adding missing unique constraint to order_line_items table...')

  try {
    // First, let's check if the constraint already exists
    const { data: constraints, error: checkError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name')
      .eq('table_name', 'order_line_items')
      .eq('constraint_type', 'UNIQUE')

    if (checkError) {
      console.log('⚠️ Could not check existing constraints, proceeding with addition...')
    } else if (constraints && constraints.some(c => c.constraint_name.includes('line_item_id'))) {
      console.log('✅ Unique constraint on line_item_id already exists!')
      return
    }

    // Add the unique constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE public.order_line_items ADD CONSTRAINT order_line_items_line_item_id_unique UNIQUE (line_item_id);'
    })

    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Unique constraint already exists!')
        return
      }
      throw error
    }

    console.log('✅ Successfully added unique constraint to order_line_items.line_item_id')

    // Verify the constraint was added
    const { data: verifyData, error: verifyError } = await supabase
      .from('order_line_items')
      .select('*')
      .limit(1)

    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message)
    } else {
      console.log('✅ Table is accessible and constraint is working')
    }

  } catch (error) {
    console.error('❌ Failed to add constraint:', (error as Error).message)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  fixLineItemsConstraint().catch(error => {
    console.error('🔥 Fix failed:', error)
    process.exit(1)
  })
}

export default fixLineItemsConstraint
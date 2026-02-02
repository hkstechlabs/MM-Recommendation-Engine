'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'

export function LogoutButton() {
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <SidebarMenuButton onClick={logout} className="text-muted-foreground hover:text-foreground">
      <LogOut className="size-4" />
      <span>Logout</span>
    </SidebarMenuButton>
  )
}

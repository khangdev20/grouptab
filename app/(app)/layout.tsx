import BottomNav from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

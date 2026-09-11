import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Users, ChevronDown } from 'lucide-react';

export default function EmployeeStatsCard() {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-stats'],
    queryFn: () => api.entities.Employee.list('-created_date')
  });

  const total = employees.length;

  return (
    <div className="bg-white dark:bg-[#1f2229] rounded-[2rem] p-6 h-[160px] flex flex-col shadow-sm border border-border/50 relative overflow-hidden">
      <div className="flex items-start justify-between relative z-10">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Users className="w-5 h-5 text-foreground" />
        </div>
        

        
      </div>

      <div className="mt-4 relative z-10">
        <p className="text-xs text-muted-foreground mb-1">员工总数</p>
        <div className="text-3xl font-bold tracking-tight text-foreground">{total}</div>
      </div>

      {/* Circular Gauge */}
      <div className="absolute -bottom-8 -right-8 w-44 h-44">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="#1f2229" className="dark:fill-[#14161a]" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2e37" className="dark:stroke-[#20232a]" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f26457" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset={251.2 * 0.88} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pr-4 pb-4">
          <span className="text-white text-xl font-bold tracking-tight">12%</span>
          <span className="text-white/60 text-[10px]">增长率</span>
        </div>
      </div>
    </div>);

}
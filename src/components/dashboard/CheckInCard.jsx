import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { CalendarCheck, Trophy, Sparkles } from 'lucide-react';

export default function CheckInCard() {
  const qc = useQueryClient();
  const [currentUser] = useState(() => {
    const s = localStorage.getItem('feishu_user');
    if (s) { try { return JSON.parse(s)?.name || 'User'; } catch {} }
    return 'User';
  });

  const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  const { data: checkIns = [], isLoading } = useQuery({
    queryKey: ['checkIns', currentUser],
    queryFn: () => api.entities.CheckIn.filter({ user_id: currentUser }),
  });

  const checkInMut = useMutation({
    mutationFn: () => api.entities.CheckIn.create({ user_id: currentUser, date: todayStr }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkIns', currentUser] }),
  });

  const hasCheckedInToday = checkIns.some(c => c.date === todayStr);
  const totalCount = checkIns.length;

  if (isLoading) {
    return <div className="bg-white rounded-[2rem] p-5 h-[140px] border border-border/50 animate-pulse"></div>;
  }

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-5 h-[140px] flex flex-col justify-between shadow-md relative overflow-hidden group text-white border-0">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">每日签到</h3>
            <p className="text-white/80 text-xs mt-0.5">坚持打卡好习惯</p>
          </div>
        </div>
        <button
          onClick={() => !hasCheckedInToday && checkInMut.mutate()}
          disabled={hasCheckedInToday || checkInMut.isPending}
          className={`relative z-10 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            hasCheckedInToday 
              ? 'bg-white/20 text-white/70 cursor-not-allowed' 
              : 'bg-white text-indigo-600 hover:bg-white/90 hover:shadow-lg hover:-translate-y-0.5'
          }`}
        >
          {checkInMut.isPending ? (
            <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
          ) : hasCheckedInToday ? (
            <>
              <CalendarCheck className="w-3.5 h-3.5" />已签到
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />立即打卡
            </>
          )}
        </button>
      </div>

      {/* Vector Graphics */}
      <div className="absolute -right-6 -top-6 w-40 h-40 pointer-events-none opacity-20">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white fill-current">
          <path d="M42.7,-64C56.6,-57.4,69.9,-47.5,76.5,-34C83.1,-20.5,83,0,76.6,18.4C70.2,36.8,57.5,53.1,41.9,62.8C26.3,72.5,7.8,75.6,-8.7,72C-25.2,68.4,-39.7,58.1,-52.3,45.3C-64.9,32.5,-75.6,17.2,-78.9,0.3C-82.2,-16.6,-78.1,-35,-67.2,-48.5C-56.3,-62,-38.6,-70.6,-22.4,-74.6C-6.2,-78.6,8.5,-78,22.8,-74C37.1,-70,51.1,-60.6,42.7,-64Z" transform="translate(100 100)" />
        </svg>
      </div>
      <div className="absolute -left-8 -bottom-8 w-32 h-32 pointer-events-none opacity-10">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white fill-current">
          <path d="M45.7,-76.4C58.9,-69.3,69.2,-55.4,75.2,-40.7C81.2,-26,82.9,-10.5,80.7,4.3C78.5,19,72.4,32.9,63.1,44.4C53.8,55.9,41.2,65,26.9,71.7C12.6,78.4,-3.4,82.7,-18.3,79.5C-33.2,76.3,-47.4,65.6,-59.6,53.2C-71.8,40.8,-82,26.7,-85.4,11.3C-88.8,-4.1,-85.4,-20.8,-76.9,-33.6C-68.4,-46.4,-54.8,-55.3,-41.6,-62.4C-28.4,-69.5,-15.6,-74.8,0.3,-75.3C16.2,-75.8,32.5,-83.5,45.7,-76.4Z" transform="translate(100 100)" />
        </svg>
      </div>

      <div className="flex items-end gap-2 px-2 mt-4 relative z-10 pointer-events-none">
        <p className="text-white/80 text-xs mb-1">累计签到</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-white leading-none">{totalCount}</span>
          <span className="text-xs font-medium text-white/80">天</span>
        </div>
      </div>
    </div>
  );
}
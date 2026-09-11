import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const STATUS_COLORS = { '执行中': '#e26b58', '完成审批中': '#c084fc', '已完成': '#10b981', '已归档': '#94a3b8' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value > 100 ? `¥${p.value}万` : p.value}</p>)}
    </div>
  );
};

export default function ProjectStats() {
  const { data: allProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });
  const { data: allApprovals = [], isLoading: loadingApprovals } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list(),
  });

  if (loadingProjects || loadingApprovals) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>;
  }

  // 排除已删除项目及其关联审批
  const projects = allProjects.filter(p => !p.is_deleted);
  const deletedIds = new Set(allProjects.filter(p => p.is_deleted).map(p => p.id));
  const approvals = allApprovals.filter(a => !a.project_id || !deletedIds.has(a.project_id));

  const statusDist = Object.entries(
    projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#d1d5db' }));

  const totalContract = projects.reduce((s, p) => s + (p.contract_amount || 0), 0);
  const totalBudget = projects.reduce((s, p) => s + (p.budget_cost || 0), 0);
  const totalIncome = approvals.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);
  const totalExpense = approvals.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);

  const projectFinance = projects.map(p => {
    const pa = approvals.filter(a => a.project_id === p.id);
    return {
      name: p.name?.length > 8 ? p.name.slice(0, 8) + '…' : p.name,
      合同额: Math.round((p.contract_amount || 0) / 10000),
      预算: Math.round((p.budget_cost || 0) / 10000),
      已收款: Math.round(pa.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0) / 10000),
      已支出: Math.round(pa.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0) / 10000),
    };
  });

  const STATS = [
    { label: '项目总数', value: `${projects.length}个`, sub: '已创建', color: 'text-foreground' },
    { label: '合同总额', value: `¥${(totalContract / 10000).toFixed(0)}万`, sub: '已签约', color: 'text-primary' },
    { label: '已收款', value: `¥${(totalIncome / 10000).toFixed(1)}万`, sub: totalContract ? `收款率 ${((totalIncome / totalContract) * 100).toFixed(1)}%` : '-', color: 'text-green-600' },
    { label: '已支出', value: `¥${(totalExpense / 10000).toFixed(1)}万`, sub: totalBudget ? `预算使用 ${((totalExpense / totalBudget) * 100).toFixed(1)}%` : '-', color: 'text-orange-600' },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto gap-3">
      <div className="grid grid-cols-4 gap-6">
        {STATS.map(s => (
          <div key={s.label} className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
            <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-3xl font-bold tracking-tight mb-2 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full w-fit">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-3">
        <div className="col-span-2 bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">各项目财务情况（万元）</h3>
          {projectFinance.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={projectFinance} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="合同额" fill="#e26b58" radius={[4,4,0,0]} />
                <Bar dataKey="预算" fill="#fca5a5" radius={[4,4,0,0]} />
                <Bar dataKey="已收款" fill="#34d399" radius={[4,4,0,0]} />
                <Bar dataKey="已支出" fill="#94a3b8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">暂无项目数据</p>}
        </div>

        <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">项目状态分布</h3>
          {statusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {statusDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}个`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                {statusDist.map(d => (
                  <div key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} {d.value}
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground text-center py-16">暂无数据</p>}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50 mt-3">
        <h3 className="font-semibold text-base mb-6">各项目收支明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50">
                {['项目名称', '客户', '合同金额', '成本预算', '已收款', '已支出', '毛利润', '状态'].map((h, i) => (
                  <th key={h} className={`text-left font-medium pb-3 ${i === 0 ? 'pl-2' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">暂无项目</td></tr>
              )}
              {projects.map(p => {
              const pa = approvals.filter(a => a.project_id === p.id);
              const income = pa.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);
              const expense = pa.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);
              const profit = income - expense;
              return (
                <tr key={p.id} className="group border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="py-4 pl-2 font-medium">{p.name}</td>
                  <td className="py-4 text-xs text-muted-foreground">{p.customer}</td>
                  <td className="py-4 font-medium">¥{((p.contract_amount || 0) / 10000).toFixed(0)}万</td>
                  <td className="py-4 text-muted-foreground">¥{((p.budget_cost || 0) / 10000).toFixed(0)}万</td>
                  <td className="py-4 text-green-600 font-semibold">+¥{(income / 10000).toFixed(1)}万</td>
                  <td className="py-4 text-red-600 font-semibold">-¥{(expense / 10000).toFixed(1)}万</td>
                  <td className="py-4">
                    <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profit >= 0 ? '+' : ''}¥{(profit / 10000).toFixed(1)}万
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: (STATUS_COLORS[p.status] || '#d1d5db') + '25', color: STATUS_COLORS[p.status] || '#888' }}>{p.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const monthlyBids = [
  { month: '1月', 投标: 2, 中标: 1 },
  { month: '2月', 投标: 3, 中标: 2 },
  { month: '3月', 投标: 4, 中标: 1 },
  { month: '4月', 投标: 5, 中标: 3 },
  { month: '5月', 投标: 3, 中标: 2 },
  { month: '6月', 投标: 6, 中标: 4 },
];

const resultData = [
  { name: '中标', value: 13, color: '#10b981' },
  { name: '未中标', value: 7, color: '#fca5a5' },
  { name: '流标', value: 3, color: '#94a3b8' },
  { name: '弃标', value: 5, color: '#93c5fd' },
];

const amountTrend = [
  { month: '1月', 金额: 180 },
  { month: '2月', 金额: 320 },
  { month: '3月', 金额: 450 },
  { month: '4月', 金额: 280 },
  { month: '5月', 金额: 520 },
  { month: '6月', 金额: 680 },
];

const deptBids = [
  { dept: '技术部', 项目数: 8, 中标数: 5 },
  { dept: '产品部', 项目数: 5, 中标数: 3 },
  { dept: '运营部', 项目数: 4, 中标数: 2 },
  { dept: '市场部', 项目数: 6, 中标数: 4 },
  { dept: '财务部', 项目数: 2, 中标数: 1 },
];

const STATS = [
  { label: '总投标项目', value: '28', sub: '本年度', color: 'text-foreground' },
  { label: '中标项目', value: '13', sub: '中标率 46.4%', color: 'text-green-600' },
  { label: '投标总金额', value: '¥2,430万', sub: '本年度', color: 'text-primary' },
  { label: '中标金额', value: '¥1,120万', sub: '转化率 46.1%', color: 'text-orange-600' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name === '金额' ? '万' : '个'}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function BusinessStats() {
  return (
    <div className="flex flex-col h-full overflow-auto gap-3">
      {/* KPI Cards */}
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
        {/* Monthly bid vs win bar chart */}
        <div className="col-span-2 bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">月度投标 vs 中标数量</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyBids} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="投标" fill="#e26b58" radius={[4, 4, 0, 0]} />
              <Bar dataKey="中标" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Result pie chart */}
        <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">竞标结果分布</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={resultData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                dataKey="value" paddingAngle={3}>
                {resultData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val, name) => [`${val}个`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
            {resultData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name} {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-3">
        {/* Amount trend */}
        <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">月度投标金额趋势（万元）</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={amountTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="金额" stroke="#e26b58" strokeWidth={3} dot={{ r: 4, fill: '#e26b58', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#e26b58', stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dept performance */}
        <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-border/50">
          <h3 className="font-semibold text-base mb-6">各部门竞标情况</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={deptBids} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="dept" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="项目数" fill="#e26b58" radius={[0, 4, 4, 0]} />
              <Bar dataKey="中标数" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
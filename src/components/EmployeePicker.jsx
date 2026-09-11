/**
 * EmployeePicker - 从飞书同步的员工数据中，按部门二级展示人员选择器
 * 
 * Props:
 *   value: string | string[]        - 当前选中值（单选为 string，多选为 string[]）
 *   onChange: (val) => void          - 选中回调
 *   multiple?: boolean               - 多选模式，默认 false
 *   placeholder?: string
 *   className?: string
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ChevronDown, X, Search, User } from 'lucide-react';

function useEmployeesByDept() {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-picker'],
    queryFn: () => api.entities.Employee.list('-created_date'),
    staleTime: 5 * 60 * 1000,
  });

  // Group by department
  const grouped = {};
  employees.forEach(emp => {
    const dept = emp.department || '未分配';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(emp);
  });

  return { grouped, allEmployees: employees };
}

export default function EmployeePicker({
  value,
  onChange,
  multiple = false,
  placeholder = '请选择人员...',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedDepts, setExpandedDepts] = useState({});
  const ref = useRef(null);
  const { grouped, allEmployees } = useEmployeesByDept();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedArr = multiple
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const isSelected = (name) => selectedArr.includes(name);

  const toggleEmployee = (name) => {
    if (multiple) {
      const next = isSelected(name)
        ? selectedArr.filter(x => x !== name)
        : [...selectedArr, name];
      onChange(next);
    } else {
      onChange(isSelected(name) ? '' : name);
      setOpen(false);
    }
  };

  const removeEmployee = (name, e) => {
    e.stopPropagation();
    if (multiple) {
      onChange(selectedArr.filter(x => x !== name));
    } else {
      onChange('');
    }
  };

  const toggleDept = (dept) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  // Filter by search
  const filteredGrouped = {};
  const searchLower = search.toLowerCase();
  Object.entries(grouped).forEach(([dept, emps]) => {
    const matched = emps.filter(e =>
      !search || e.name.toLowerCase().includes(searchLower) || dept.includes(search)
    );
    if (matched.length > 0) filteredGrouped[dept] = matched;
  });

  // Auto-expand depts when searching
  useEffect(() => {
    if (search) {
      const expanded = {};
      Object.keys(filteredGrouped).forEach(d => { expanded[d] = true; });
      setExpandedDepts(expanded);
    }
  }, [search]);

  const displayNames = selectedArr.length > 0
    ? selectedArr
    : null;

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(v => !v)}
        className="w-full min-h-[36px] px-3 py-1.5 bg-secondary rounded-xl text-sm border-0 focus-within:ring-2 focus-within:ring-lime-400 cursor-pointer flex items-center gap-1 flex-wrap"
      >
        {displayNames ? (
          displayNames.map(name => (
            <span key={name} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${multiple ? 'bg-lime-400/20 text-lime-800' : 'text-foreground'}`}>
              <User className="w-3 h-3 opacity-60" />
              {name}
              <button
                type="button"
                onMouseDown={e => removeEmployee(name, e)}
                className="hover:text-red-500 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden animate-fade-in">
          {/* Search */}
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索姓名或部门..."
                className="w-full pl-8 pr-3 py-1.5 bg-secondary rounded-lg text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400"
              />
            </div>
          </div>

          {/* Employee list grouped by dept */}
          <div className="max-h-64 overflow-auto py-1">
            {Object.keys(filteredGrouped).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">无匹配人员</p>
            ) : (
              Object.entries(filteredGrouped).map(([dept, emps]) => (
                <div key={dept}>
                  {/* Dept header */}
                  <button
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{dept}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground/60">{emps.length}人</span>
                      <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expandedDepts[dept] !== false ? '' : '-rotate-90'}`} />
                    </div>
                  </button>

                  {/* Employees under dept */}
                  {expandedDepts[dept] !== false && emps.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.name)}
                      className={`w-full flex items-center gap-2 px-5 py-1.5 hover:bg-secondary/50 transition-colors ${isSelected(emp.name) ? 'bg-lime-400/10' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${isSelected(emp.name) ? 'bg-lime-400 text-white' : 'bg-secondary text-muted-foreground'}`}>
                        {emp.name[0]}
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`text-xs ${isSelected(emp.name) ? 'font-semibold text-foreground' : 'text-foreground'}`}>{emp.name}</span>
                        {emp.position && <span className="text-[10px] text-muted-foreground ml-1.5">{emp.position}</span>}
                      </div>
                      {isSelected(emp.name) && (
                        <span className="text-lime-600 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Multi-select footer */}
          {multiple && selectedArr.length > 0 && (
            <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">已选 {selectedArr.length} 人</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                清空
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
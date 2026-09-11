import { useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import MemoBoard from '../components/dashboard/MemoBoard';
import EmployeeStatsCard from '../components/dashboard/EmployeeStatsCard';
import MyNotificationsWidget from '../components/dashboard/MyNotificationsWidget';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function GreetingCard({ today, day, weekday }) {
  return (
    <div className="h-48 flex flex-col justify-center px-8 relative bg-white dark:bg-[#1f2229] rounded-[2rem] shadow-sm border border-border/50 overflow-hidden group">
      <div className="absolute right-0 top-0 w-40 h-40 transform translate-x-8 -translate-y-8 opacity-5 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-primary fill-current">
          <path d="M45.7,-76.4C58.9,-69.3,69.2,-55.4,75.2,-40.7C81.2,-26,82.9,-10.5,80.7,4.3C78.5,19,72.4,32.9,63.1,44.4C53.8,55.9,41.2,65,26.9,71.7C12.6,78.4,-3.4,82.7,-18.3,79.5C-33.2,76.3,-47.4,65.6,-59.6,53.2C-71.8,40.8,-82,26.7,-85.4,11.3C-88.8,-4.1,-85.4,-20.8,-76.9,-33.6C-68.4,-46.4,-54.8,-55.3,-41.6,-62.4C-28.4,-69.5,-15.6,-74.8,0.3,-75.3C16.2,-75.8,32.5,-83.5,45.7,-76.4Z" transform="translate(100 100)" />
        </svg>
      </div>
      <div className="absolute left-0 bottom-0 w-32 h-32 transform -translate-x-10 translate-y-10 opacity-5 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-lime-500 fill-current">
          <path d="M39.9,-65.4C51.9,-58.5,61.9,-46.5,70.5,-32.8C79.1,-19.1,86.3,-4.5,83.9,8.7C81.5,21.9,69.5,33.7,57.1,43.2C44.7,52.7,31.9,59.9,18,65.3C4.1,70.7,-10.9,74.3,-24.5,71.2C-38.1,68.1,-50.3,58.3,-60.2,46.2C-70.1,34.1,-77.7,19.7,-79.8,4.7C-81.9,-10.3,-78.5,-25.9,-69.9,-38.3C-61.3,-50.7,-47.5,-59.9,-33.9,-66.1C-20.3,-72.3,-6.9,-75.5,4.7,-81.4C16.3,-87.3,27.9,-72.3,39.9,-65.4Z" transform="translate(100 100)" />
        </svg>
      </div>
      <div className="relative z-10 pointer-events-none">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">早上好，工作愉快！</h2>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]"></span>
          {today.getFullYear()}年{today.getMonth()+1}月{day}日 · 星期{weekday}
        </p>
      </div>
    </div>
  );
}

function DraggableWidget({ id, index, children }) {
  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`relative group ${snapshot.isDragging ? 'z-50' : ''}`}
        >
          <div 
            {...provided.dragHandleProps}
            className={`absolute top-4 right-4 z-50 p-1.5 rounded-lg text-muted-foreground transition-all cursor-grab active:cursor-grabbing backdrop-blur-sm ${snapshot.isDragging ? 'bg-black/10 opacity-100' : 'bg-black/5 opacity-0 group-hover:opacity-100 hover:bg-black/10'}`}
          >
            <GripHorizontal className="w-4 h-4" />
          </div>
          {children}
        </div>
      )}
    </Draggable>
  );
}

export default function Dashboard() {
  const KNOWN_WIDGETS = new Set(['memo', 'notifications', 'greeting', 'employee']);
  const DEFAULT_LAYOUT = { left: ['memo', 'notifications'], right: ['greeting', 'employee'] };

  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const left = (parsed.left || []).filter(id => KNOWN_WIDGETS.has(id));
        const right = (parsed.right || []).filter(id => KNOWN_WIDGETS.has(id));
        const has = new Set([...left, ...right]);
        DEFAULT_LAYOUT.left.forEach(id => { if (!has.has(id)) left.unshift(id); });
        DEFAULT_LAYOUT.right.forEach(id => { if (!has.has(id)) right.push(id); });
        if (left.length || right.length) return { left, right };
      } catch {}
    }
    return DEFAULT_LAYOUT;
  });

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newLayout = { ...layout };
    const sourceList = [...newLayout[source.droppableId]];
    const destList = source.droppableId === destination.droppableId ? sourceList : [...newLayout[destination.droppableId]];

    const [removed] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, removed);

    newLayout[source.droppableId] = sourceList;
    newLayout[destination.droppableId] = destList;

    setLayout(newLayout);
    localStorage.setItem('dashboard_layout', JSON.stringify(newLayout));
  };

  const WIDGETS = {
    memo: <MemoBoard />,
    notifications: <MyNotificationsWidget />,
    greeting: <GreetingCard today={new Date()} day={new Date().getDate()} weekday={WEEKDAYS[new Date().getDay()]} />,
    employee: <EmployeeStatsCard />,
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-6 items-start">
          <Droppable droppableId="left">
            {(provided) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className="col-span-12 lg:col-span-8 flex flex-col gap-6"
              >
                {layout.left.map((id, idx) => (
                  <DraggableWidget key={id} id={id} index={idx}>
                    {WIDGETS[id]}
                  </DraggableWidget>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <Droppable droppableId="right">
            {(provided) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className="col-span-12 lg:col-span-4 flex flex-col gap-6"
              >
                {layout.right.map((id, idx) => (
                  <DraggableWidget key={id} id={id} index={idx}>
                    {WIDGETS[id]}
                  </DraggableWidget>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}

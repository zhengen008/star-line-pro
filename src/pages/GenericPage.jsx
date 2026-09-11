export default function GenericPage({ title = '功能开发中' }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-lime-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">此功能正在开发中，敬请期待</p>
      </div>
    </div>
  );
}
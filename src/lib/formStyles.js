/** 与项目立项弹窗一致的表单样式 */
export const formLabelClass = 'text-xs text-muted-foreground';

export const formInputClass =
  'mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400';

export const formTextareaClass = `${formInputClass} resize-none`;

export const formSelectClass = `${formInputClass} cursor-pointer`;

export const formModalOverlayClass =
  'fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50';

/** 视觉壳：圆角白底阴影（可与 Dialog 组合） */
export const formModalShellClass =
  'bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-0';

/** 完整自定义弹窗面板（对齐项目立项 InitiateModal） */
export const formModalPanelClass =
  `${formModalShellClass} w-[560px] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col animate-fade-in`;

export const formModalHeaderClass =
  'flex items-center justify-between shrink-0 px-6 py-4 border-b border-border';

export const formModalBodyClass = 'flex-1 overflow-auto p-6 space-y-4';

export const formModalFooterClass = 'flex gap-2 px-6 py-4 border-t border-border shrink-0';

export const formCancelBtnClass =
  'flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors';

export const formSubmitBtnClass =
  'flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40';

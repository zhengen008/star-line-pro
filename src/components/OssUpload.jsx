import { useState, useRef } from 'react';
import { api, fileUrl } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Paperclip, X, Loader2, CheckCircle2, AlertCircle, Eye, Download } from 'lucide-react';

/**
 * OssUpload – reusable file uploader to Aliyun OSS
 *
 * Props:
 *   fileType   – 'contract' | 'tender' | 'reimbursement' | 'purchase' | 'invoice' | 'seal' | 'project' | 'other'
 *   value      – array of { url, name, size }
 *   onChange   – called with updated array
 *   multiple   – allow multiple files (default false)
 *   label      – button label (optional)
 */
export default function OssUpload({ fileType = 'other', value = [], onChange, multiple = false, label = '上传附件', onUploadingChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { url, name }
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');

    for (const file of Array.from(files)) {
      if (file.size > 100 * 1024 * 1024) {
        setError(`文件 "${file.name}" 超过100MB限制`);
        return;
      }
    }

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const { file_url } = await api.integrations.Core.UploadFile({ file, fileType });
        uploaded.push({ url: file_url, name: file.name, size: file.size });
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded);
    } catch (e) {
      setError(e?.data?.error || e.message || '上传失败');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeFile = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const isImage = (name) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name || '');

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-xl text-xs text-muted-foreground hover:bg-border transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
        {uploading ? '上传中...' : label}
        <span className="text-muted-foreground/60">（最大100MB）</span>
      </button>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/60 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-xs flex-1 truncate">{f.name}</span>
              {f.size && <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>}
              {/* 内嵌预览（PDF / 图片） */}
              <button type="button" onClick={() => setPreview(f)} title="预览"
                className="text-muted-foreground hover:text-primary shrink-0">
                <Eye className="w-3.5 h-3.5" />
              </button>
              {/* 新窗口打开 / 下载 */}
              <a href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer" title="在新窗口打开"
                className="text-muted-foreground hover:text-primary shrink-0">
                <Download className="w-3.5 h-3.5" />
              </a>
              <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 文件预览弹框 */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-6 py-4 border-b border-border/50">
            <DialogTitle className="truncate text-sm font-medium">{preview?.name || '预览'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/50">
            {preview && (isImage(preview.name) ? (
              <img src={fileUrl(preview.url)} alt={preview.name} className="w-full h-full object-contain" />
            ) : (
              <iframe src={fileUrl(preview.url)} title={preview.name} className="w-full h-full" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

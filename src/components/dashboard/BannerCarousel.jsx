import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fileUrl } from '@/api/client';
import { Plus, Trash2, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

export default function BannerCarousel({ isAdmin }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      return api.entities.Banner.list('-order');
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file) => {
      if (banners.length >= 3) throw new Error('最多只能上传3张图片');
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      return api.entities.Banner.create({ image_url: file_url, title: 'Banner', order: banners.length });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setUploading(false);
    },
    onError: (err) => {
      alert(err.message);
      setUploading(false);
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.entities.Banner.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      if (currentIndex >= banners.length - 1) {
        setCurrentIndex(Math.max(0, banners.length - 2));
      }
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadMut.mutate(file);
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (banners.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [banners.length]);

  if (isLoading) {
    return <div className="h-48 bg-white rounded-[2rem] border border-border/50 animate-pulse"></div>;
  }

  return (
    <div className="relative h-48 bg-white rounded-[2rem] border border-border/50 overflow-hidden group shadow-sm">
      {banners.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-secondary/30">
          <ImageIcon className="w-10 h-10 opacity-20 mb-2" />
          <p className="text-sm">暂无展示内容</p>
          {isAdmin && (
            <button onClick={() => fileInputRef.current?.click()} className="mt-3 px-4 py-1.5 bg-primary text-white text-xs rounded-full hover:bg-primary/90 transition-colors">
              添加图片
            </button>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center py-4 px-12">
          <div className="relative w-full h-full max-w-[500px]">
            {banners.map((b, i) => {
              const diff = (i - currentIndex + banners.length) % banners.length;
              let tx = 0, scale = 1, zIndex = 30, opacity = 1;
              if (diff === 0) { // Active
                tx = 0; scale = 1; zIndex = 30; opacity = 1;
              } else if (diff === 1) { // Next
                tx = 30; scale = 0.9; zIndex = 20; opacity = 0.8;
              } else if (diff === 2) { // Third
                tx = 60; scale = 0.8; zIndex = 10; opacity = 0.5;
              } else {
                tx = 0; scale = 0; zIndex = 0; opacity = 0;
              }
              
              return (
                <div 
                  key={b.id} 
                  className="absolute inset-y-0 right-10 left-0 transition-all duration-500 ease-out origin-right"
                  style={{ transform: `translateX(${tx}px) scale(${scale})`, zIndex, opacity }}
                >
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-muted">
                    <img src={fileUrl(b.image_url)} alt="Banner" className="w-full h-full object-cover" />
                    {isAdmin && diff === 0 && (
                      <button onClick={() => deleteMut.mutate(b.id)} className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-500 text-white rounded-xl backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {banners.length > 1 && (
            <>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-40 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
                {banners.map((_, i) => (
                  <button key={i} onClick={() => setCurrentIndex(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'}`} />
                ))}
              </div>
              <button onClick={() => setCurrentIndex((currentIndex - 1 + banners.length) % banners.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/30 hover:bg-white/70 text-black backdrop-blur-sm z-40 opacity-0 group-hover:opacity-100 transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setCurrentIndex((currentIndex + 1) % banners.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/30 hover:bg-white/70 text-black backdrop-blur-sm z-40 opacity-0 group-hover:opacity-100 transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {isAdmin && banners.length < 3 && (
             <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-xl backdrop-blur-sm transition-colors z-40 opacity-0 group-hover:opacity-100">
               {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
             </button>
          )}
        </div>
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );
}
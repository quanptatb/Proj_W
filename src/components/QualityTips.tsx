import React from 'react';
import { ShieldCheck, Zap, Sparkles, Layers, Sliders } from 'lucide-react';

export function QualityTips() {
  return (
    <section className="w-full max-w-5xl mx-auto my-16 px-4">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Bí Quyết Tải Ảnh Siêu Nét Không Bị Nén Vỡ
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          UltraPic kết hợp bóc tách link gốc CDN của các nền tảng và thuật toán phục hồi pixel thông minh.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tip 1 */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400 mb-3.5">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1.5">
            Pinterest Originals Engine
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Khi xem trên web Pinterest, bạn chỉ thấy bản thu nhỏ 236x hoặc 736x. Hệ thống của chúng tôi tự động truy xuất thẳng vào thư mục CDN <code className="text-red-300 font-mono">/originals/</code> để lấy file ảnh gốc không nén.
          </p>
        </div>

        {/* Tip 2 */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 mb-3.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1.5">
            Vượt Nén Facebook CDN
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Facebook tự động nén kích thước xuống 720p/960p kèm giảm bitrate. UltraPic phân tích cấu trúc luồng CDN và bộ lọc metadata OpenGraph để tìm luồng ảnh kích thước tối đa 2048px khả dụng.
          </p>
        </div>

        {/* Tip 3 */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-3.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 mb-1.5">
            Hybrid AI Phục Hồi Nét Căng
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Nếu ảnh nguồn vốn dĩ đã bị người đăng tải nén mờ, bộ xử lý AI Upscaler cục bộ (Unsharp Mask & Denoise) và Cloud AI (Real-ESRGAN) sẽ tái tạo cạnh sắc nét và loại bỏ hiện tượng vỡ hạt ô vuông.
          </p>
        </div>
      </div>
    </section>
  );
}

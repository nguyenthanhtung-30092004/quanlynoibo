/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Giao diện XVIP: nền xám xanh nhạt, sidebar navy, điểm nhấn xanh dương
        canvas: '#F1F5F9',
        surface: { DEFAULT: '#FFFFFF', 2: '#F8FAFC' },
        line: { DEFAULT: '#E2E8F0', strong: '#CBD5E1' },
        ink: { DEFAULT: '#0F172A', 2: '#475569', 3: '#64748B' },
        rail: { DEFAULT: '#0B1A33', 2: '#14284B', text: '#B4C0D4', line: '#22385E' },
        // Màu chủ đạo (nút chính, mục đang chọn, focus)
        accent: { DEFAULT: '#2563EB', hover: '#1D4ED8', ink: '#FFFFFF', soft: '#E8F0FE' },
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Chỉ dùng cho mã đơn (dữ liệu), không dùng làm "phong cách kỹ thuật"
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Thang chữ cố định (rem), bước nhỏ ~1.15 cho giao diện làm việc
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      borderRadius: { lg: '8px', xl: '12px', '2xl': '16px' },
      boxShadow: {
        // Phẳng, chỉ một lớp nổi rất nhẹ
        '3d-sm': 'none',
        '3d': '0 1px 2px rgba(15,23,42,0.05)',
        '3d-card': '0 1px 2px rgba(15,23,42,0.05)',
        '3d-hover': '0 4px 12px rgba(15,23,42,0.08)',
        '3d-primary': 'none',
        '3d-primary-hover': 'none',
        '3d-primary-active': 'none',
        '3d-secondary': 'none',
        '3d-danger': 'none',
        '3d-inset': 'none',
        '3d-rail-item': 'none',
        '3d-badge': 'none',
      },
    },
  },
  plugins: [],
};

'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider, type ThemeConfig } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { ApiError } from '@/lib/api-client';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Không thử lại khi lỗi do client (401/403/404...)
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

const FONT_FAMILY = 'var(--font-sans), system-ui, sans-serif';

/** Cấu hình giao diện antd phong cách 3D hiện đại */
const THEME: ThemeConfig = {
  token: {
    colorPrimary: '#2563EB',
    colorTextLightSolid: '#FFFFFF',
    colorLink: '#2563EB',
    colorError: '#DC2626',
    colorSuccess: '#16803C',
    colorWarning: '#B7791F',
    colorInfo: '#2563EB',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorTextPlaceholder: '#94A3B8',
    colorBgLayout: '#F1F5F9',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#CBD5E1',
    colorBorderSecondary: '#E2E8F0',
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    controlHeight: 38,
    motionDurationMid: '0.15s',
  },
  components: {
    Button: {
      fontWeight: 600,
      borderRadius: 8,
      controlHeight: 38,
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: '#475569',
      headerSplitColor: 'transparent',
      rowHoverBg: 'rgba(242, 169, 0, 0.04)',
      borderColor: '#E2E8F0',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Input: {
      borderRadius: 8,
      colorBorder: '#CBD5E1',
    },
    Select: {
      borderRadius: 8,
      colorBorder: '#CBD5E1',
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Drawer: {
      colorBgElevated: '#14202B',
    },
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AntdRegistry>
        <ConfigProvider locale={viVN} theme={THEME}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </AntdRegistry>
    </QueryClientProvider>
  );
}

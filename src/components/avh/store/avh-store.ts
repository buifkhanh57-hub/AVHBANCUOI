import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AvhState {
  userPlan: 'free' | 'premium';
  premiumFeatures: Array<{
    id: number;
    title: string;
    description: string;
    icon: string;
  }>;
  upgradeToPremium: () => void;
}

export const useAvhStore = create<AvhState>()(
  persist(
    (set) => ({
      userPlan: 'free',
      premiumFeatures: [
        {
          id: 1,
          title: 'AI Assistant',
          description: 'Trợ lý AI thông minh giúp bạn tối ưu công việc',
          icon: '🤖'
        },
        {
          id: 2,
          title: 'Data Analytics',
          description: 'Phân tích dữ liệu chi tiết với công nghệ AI',
          icon: '📊'
        },
        {
          id: 3,
          title: 'Workflow Automation',
          description: 'Tự động hóa quy trình làm việc',
          icon: '⚙️'
        }
      ],
      upgradeToPremium: () => set({ userPlan: 'premium' })
    }),
    {
      name: 'avh-storage'
    }
  )
);

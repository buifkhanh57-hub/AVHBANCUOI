import React from 'react';
import { Button } from '@/components/ui/button';
import { useAvhStore } from '@/components/avh/store/avh-store';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export const AvhPremiumCard: React.FC = () => {
  const { userPlan, upgradeToPremium } = useAvhStore();

  if (userPlan === 'premium') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-green-600">Bạn đang sử dụng Premium</CardTitle>
          <CardDescription className="text-center">
            Cảm ơn bạn đã sử dụng phiên bản Premium của AVH
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Nâng cấp lên Premium ngay hôm nay!</CardTitle>
        <CardDescription className="text-center">
          Trải nghiệm đầy đủ tính năng cao cấp của AVH
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {[
            'Truy cập không giới hạn',
            'Tính năng AI nâng cao',
            'Hỗ trợ 24/7',
            'Bản cập nhật sớm',
            'Dung lượng lưu trữ không giới hạn'
          ].map((feature, index) => (
            <li key={index} className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button onClick={upgradeToPremium} size="lg" className="w-full">
          Nâng cấp ngay
        </Button>
      </CardFooter>
    </Card>
  );
};

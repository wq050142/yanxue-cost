"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { MapPin } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => { router.push("/"); }, 2000);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-indigo-600" />
            <span className="text-lg font-bold text-indigo-600">研学成本核算</span>
          </div>
          <p className="text-gray-600">注册成功！正在跳转到首页...</p>
        </CardContent>
      </Card>
    </div>
  );
}

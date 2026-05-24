'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, UserPlus, Mail, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('密码重置邮件已发送，请检查您的邮箱');
        setTimeout(() => {
          setMode('login');
          setError('');
          setSuccess('');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (mode === 'forgot') {
      return handleForgotPassword(e);
    }
    
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    
    if (!password) {
      setError('请输入密码');
      return;
    }
    
    if (mode === 'register') {
      if (password.length < 6) {
        setError('密码至少需要6个字符');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }
    
    setLoading(true);
    
    try {
      if (mode === 'register') {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          setError(error.message);
        } else {
          onOpenChange(false);
          resetForm();
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setError(error.message);
        } else {
          onOpenChange(false);
          resetForm();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setError('');
    setSuccess('');
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return '登录';
      case 'register': return '注册账号';
      case 'forgot': return '找回密码';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'login': return <LogIn className="w-5 h-5" />;
      case 'register': return <UserPlus className="w-5 h-5" />;
      case 'forgot': return <Mail className="w-5 h-5" />;
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login': return '登录后可管理您的研学项目';
      case 'register': return '创建账号，开始您的研学项目管理之旅';
      case 'forgot': return '输入您的邮箱，我们将发送密码重置链接';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'forgot' && (
              <button onClick={() => handleModeChange('login')} className="mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          
          {mode !== 'forgot' && (
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === 'register' ? '至少6个字符' : '请输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          )}
          
          {mode === 'register' && (
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          )}
          
          {error && (
            <div className="text-sm p-2 rounded text-red-500">
              {error}
            </div>
          )}
          
          {success && (
            <div className="text-sm p-2 rounded bg-green-50 text-green-700 border border-green-200">
              {success}
            </div>
          )}
          
          <Button type="submit" disabled={loading}>
            {loading ? '处理中...' : mode === 'forgot' ? '发送重置邮件' : mode === 'login' ? '登录' : '注册'}
          </Button>
          
          {mode === 'login' && (
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() => handleModeChange('forgot')}
              >
                忘记密码？
              </button>
            </div>
          )}
          
          <div className="text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => handleModeChange('register')}
                >
                  立即注册
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                已有账号？{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => handleModeChange('login')}
                >
                  立即登录
                </button>
              </>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

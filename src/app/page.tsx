'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Calendar, MoreVertical, Trash2, Copy, Pencil, LogOut, User, LogIn, 
  X, ChevronRight, Home as HomeIcon, Calculator, FileText, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Project, ProjectType, PROJECT_TYPE_LABELS } from '@/types';
import { 
  getProjects, createProject, deleteProject, copyProject, updateProjectName
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  
  // 项目状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  
  // 对话框状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  
  // 表单状态
  const [newProject, setNewProject] = useState({ name: '', type: '' as ProjectType | '', remark: '' });
  const [renameProjectId, setRenameProjectId] = useState<string>('');
  const [renameProjectName, setRenameProjectName] = useState('');

  // 处理 Supabase 回调（邮箱验证、密码重置等）
  useEffect(() => {
    const handleCallback = () => {
      const hash = window.location.hash.substring(1);
      if (!hash) return;
      
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      if (accessToken && type) {
        console.log('Detected Supabase callback:', { type });
        
        // 根据类型跳转到对应页面
        if (type === 'signup' || type === 'email_change') {
          // 邮箱验证，跳转到验证页面
          router.push(`/auth/verify-email${window.location.hash}`);
        } else if (type === 'recovery') {
          // 密码重置，跳转到重置密码页面
          router.push(`/auth/reset-password${window.location.hash}`);
        }
      }
    };
    
    handleCallback();
  }, [router]);

  // 加载数据
  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      setProjectsLoading(false);
    }
  }, [user, authLoading]);

  const loadData = async () => {
    setProjectsLoading(true);
    const projectList = await getProjects();
    setProjects(projectList);
    setProjectsLoading(false);
  };

  // 生成临时项目ID
  const generateTempId = () => {
    return 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  };
  
  // 创建项目 - 支持未登录用户直接创建
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称');
      return;
    }
    if (!newProject.type) {
      alert('请选择项目类型');
      return;
    }
    
    // 关闭对话框
    setIsDialogOpen(false);
    setNewProject({ name: '', type: '', remark: '' });
    
    // 跳转到临时项目
    const tempId = generateTempId();
    const tempProjectData: any = {
      project: {
        id: tempId,
        name: newProject.name,
        type: newProject.type,
        remark: newProject.remark || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      coreConfig: {
        studentCount: 0,
        parentCount: 0,
        teacherCount: 0,
        staffMembers: [
          { id: 'guide', name: '导游', count: 0, dailyFee: 0 },
          { id: 'photographer', name: '摄影', count: 0, dailyFee: 0 },
          { id: 'videographer', name: '摄像', count: 0, dailyFee: 0 },
          { id: 'driver', name: '司机', count: 0, dailyFee: 0 },
        ],
        tripDays: 1,
        accommodationDays: 0,
        accommodationType: '3-diamond',
        twinRoom: {
          price: 0,
          countClient: 0,
          countStaff: 0,
        },
        kingRoom: {
          price: 0,
          countClient: 0,
          countStaff: 0,
        },
        staffAccommodation: false,
        staffAccommodationNights: 0,
        staffRoomType: 'twin',
        staffRoomPrice: 0,
        mealStandardClient: 0,
        mealStandardStaff: 0,
        busFee: 0,
        otherTransports: [],
      },
      dailyExpenses: [
        {
          day: 1,
          accommodationAmount: 0,
          staffAccommodationAmount: 0,
          lunch: {
            enabled: true,
            clientMealType: 'table',
            tableCount: 0,
            clientCount: 0,
            pricePerPerson: 0,
            staffMealType: 'with-group',
            amount: 0,
            restaurantName: '',
          },
          dinner: {
            enabled: true,
            clientMealType: 'table',
            tableCount: 0,
            clientCount: 0,
            pricePerPerson: 0,
            staffMealType: 'with-group',
            amount: 0,
            restaurantName: '',
          },
          staffFees: {},
          singleItems: [],
        },
      ],
      otherExpenses: {
        insurance: {
          pricePerPerson: 0,
          days: 1,
          totalAmount: 0,
        },
        serviceFeeMode: 'percent',
        serviceFeePercent: 10,
        serviceFeePerPerson: 0,
        serviceFeeDays: 1,
        taxPercent: 1,
        reserveFund: 0,
        materials: [],
        otherExpenses: [],
      },
    };
    
    // 保存到 localStorage
    localStorage.setItem(`temp_project_${tempId}`, JSON.stringify(tempProjectData));
    
    // 跳转到项目页面
    router.push(`/project/${tempId}`);
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    if (confirm('确定要删除这个项目吗？删除后可在回收站找回。')) {
      const success = await deleteProject(projectId);
      if (success) loadData();
      else alert('删除项目失败，请重试');
    }
  };

  // 复制项目
  const handleCopyProject = async (projectId: string) => {
    const newProject = await copyProject(projectId);
    if (newProject) loadData();
    else alert('复制项目失败，请重试');
  };

  // 重命名项目
  const handleRenameProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setRenameProjectId(projectId);
      setRenameProjectName(project.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }
    const success = await updateProjectName(renameProjectId, renameProjectName.trim());
    if (success) {
      setIsRenameDialogOpen(false);
      loadData();
    } else {
      alert('重命名失败，请重试');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setProjects([]);
  };

  const projectTypes = [
    { value: 'half-day' as ProjectType, label: '半日', description: '半天活动，不含住宿' },
    { value: 'one-day' as ProjectType, label: '一日', description: '单日活动，不含住宿' },
    { value: 'multi-day' as ProjectType, label: '多日', description: '多日活动，含住宿安排' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header - Apple Style */}
      <header className="border-b border-slate-200/50 bg-white/85 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">研学报价工作台</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* 桌面端：用户菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-10 px-4 rounded-xl hover:bg-slate-100">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mr-2">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm text-slate-700">
                          {user.email?.split('@')[0]}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200">
                      <div className="px-3 py-2 text-sm text-slate-600 border-b border-slate-100">{user.email}</div>
                      <DropdownMenuItem onClick={handleSignOut} className="rounded-lg text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button 
                  className="gap-2 px-5 h-10 rounded-xl bg-black text-white hover:bg-slate-800 transition-all duration-200 shadow-sm" 
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  <LogIn className="w-4 h-4" />
                  <span>登录 / 注册</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />

      {/* Main Content */}
      <main className="min-h-screen">
        {!user ? (
          /* 未登录状态 - 营销页面 */
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
            <div className="max-w-6xl mx-auto px-6 py-20">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <div className="relative inline-block mb-8">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-20"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl">
                    <Calculator className="w-12 h-12 text-white" />
                  </div>
                </div>
                
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 tracking-tight">
                  把研学方案
                  <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    快速变成报价
                  </span>
                </h1>
                
                <p className="text-xl md:text-2xl text-slate-500 max-w-3xl mx-auto mb-10 leading-relaxed">
                  行程设计 · 成本核算 · 报价生成 · 方案管理
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                  <Button 
                    className="gap-3 px-8 py-7 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Plus className="w-6 h-6" />
                    开始创建报价
                  </Button>
                </div>
                
                <p className="text-slate-400">无需登录，免费使用</p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mb-6">
                    <MapPin className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">行程设计</h3>
                  <p className="text-slate-500 leading-relaxed">拖拽式行程编辑，轻松规划研学活动</p>
                </div>
                
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl flex items-center justify-center mb-6">
                    <Calculator className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">成本核算</h3>
                  <p className="text-slate-500 leading-relaxed">自动计算成本，清晰掌握每一项支出</p>
                </div>
                
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-7 h-7 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">报价生成</h3>
                  <p className="text-slate-500 leading-relaxed">一键生成专业报价单，支持多种报价模式</p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-white/50 backdrop-blur border-t border-slate-100">
              <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="text-center">
                  <p className="text-slate-500 mb-2">已有账号？<button onClick={() => setIsAuthModalOpen(true)} className="text-purple-600 font-medium hover:text-purple-700 transition-colors">登录</button></p>
                  <p className="text-slate-400 text-sm">© 2024 研学报价工作台</p>
                </div>
              </div>
            </div>
          </div>
        ) : projectsLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          /* 登录后 - 工作台页面 */
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Welcome Section */}
            <div className="mb-10">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3 tracking-tight">
                上午好
              </h1>
              <p className="text-xl text-slate-500">
                今天准备做哪个项目？
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-10">
              <Button 
                onClick={() => setIsDialogOpen(true)} 
                className="gap-3 px-7 py-6 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                新建报价
              </Button>
            </div>

            {/* Recent Projects */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-slate-900">最近项目</h2>
                <Button 
                  variant="ghost" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
                >
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              {projects.length > 0 ? (
                <div className="space-y-3">
                  {[...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5).map((project, idx) => (
                    <div 
                      key={project.id}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/project/${project.id}`)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            idx === 0 ? 'bg-gradient-to-br from-purple-50 to-purple-100' :
                            idx === 1 ? 'bg-gradient-to-br from-green-50 to-green-100' :
                            idx === 2 ? 'bg-gradient-to-br from-amber-50 to-amber-100' :
                            'bg-gradient-to-br from-slate-50 to-slate-100'
                          }`}>
                            <HomeIcon className={`w-6 h-6 ${
                              idx === 0 ? 'text-purple-600' :
                              idx === 1 ? 'text-green-600' :
                              idx === 2 ? 'text-amber-600' :
                              'text-slate-600'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-lg font-medium text-slate-900 truncate" title={project.name}>{project.name}</div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                                project.type === 'half-day' ? 'bg-green-100 text-green-700' :
                                project.type === 'one-day' ? 'bg-blue-100 text-blue-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>
                                {PROJECT_TYPE_LABELS[project.type]}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(project.updatedAt).toLocaleDateString()} 编辑
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-100 rounded-xl">
                              <MoreVertical className="w-5 h-5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameProject(project.id); }}>
                              <Pencil className="w-4 h-4 mr-2" />重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyProject(project.id); }}>
                              <Copy className="w-4 h-4 mr-2" />复制项目
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}>
                              <Trash2 className="w-4 h-4 mr-2" />删除项目
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 border-dashed">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                    <Calendar className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-700 mb-2">没有项目</h3>
                  <p className="text-slate-400 mb-5">点击上方按钮开始创建</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* 新建项目对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新建研学项目</DialogTitle>
            <DialogDescription>创建一个新的研学项目，开始进行成本核算</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">项目名称 <span className="text-red-500">*</span></Label>
              <Input id="name" placeholder="例如：北京科技研学之旅" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>项目类型 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {projectTypes.map((type) => (
                  <button key={type.value} type="button" onClick={() => setNewProject({ ...newProject, type: type.value })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${newProject.type === type.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remark">项目备注</Label>
              <Textarea id="remark" placeholder="记录项目的特殊说明或要求..." value={newProject.remark} onChange={(e) => setNewProject({ ...newProject, remark: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateProject}>创建项目</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名项目对话框 */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="renameName">项目名称</Label>
              <Input id="renameName" placeholder="输入新名称" value={renameProjectName} 
                onChange={(e) => setRenameProjectName(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmRename}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}

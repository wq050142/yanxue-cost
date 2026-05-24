'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Calendar, Users, MapPin, MoreVertical, Trash2, Copy, Pencil, LogOut, User, LogIn, 
  Archive, RotateCcw, Trash, LayoutGrid, List, Folder as FolderIcon, FolderPlus, CheckSquare,
  X, Check, ChevronRight, Home as HomeIcon, Move, Key, Calculator, FileText, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Project, ProjectType, PROJECT_TYPE_LABELS, Folder } from '@/types';
import { 
  getProjects, createProject, deleteProject, copyProject, updateProjectName, 
  getTrashProjects, restoreProject, permanentDeleteProject, getFolders, createFolder, 
  updateFolder, deleteFolder, batchOperateProjects, batchRestoreProjects, batchDeleteProjects
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  
  // 项目和文件夹状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // 显示模式：card | list
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  // 多选模式
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  
  // 对话框状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  // 表单状态
  const [newProject, setNewProject] = useState({ name: '', type: '' as ProjectType | '', remark: '' });
  const [renameProjectId, setRenameProjectId] = useState<string>('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFolderId, setRenameFolderId] = useState<string>('');
  const [renameFolderName, setRenameFolderName] = useState('');
  
  // 回收站状态
  const [trashProjects, setTrashProjects] = useState<Project[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [isTrashSelectMode, setIsTrashSelectMode] = useState(false);

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
  }, [user, authLoading, currentFolderId]);

  const loadData = async () => {
    setProjectsLoading(true);
    const [projectList, folderList] = await Promise.all([
      getProjects(currentFolderId),
      getFolders()
    ]);
    setProjects(projectList);
    setFolders(folderList);
    setProjectsLoading(false);
  };

  // 获取当前文件夹路径
  const getCurrentPath = () => {
    const path: Folder[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        path.unshift(folder);
        folderId = folder.parentId || null;
      } else {
        break;
      }
    }
    return path;
  };

  // 获取当前文件夹的子文件夹
  const getChildFolders = () => {
    return folders.filter(f => f.parentId === currentFolderId);
  };

  // 创建项目
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称');
      return;
    }
    if (!newProject.type) {
      alert('请选择项目类型');
      return;
    }
    const result = await createProject(newProject.name, newProject.type, newProject.remark);
    if (result) {
      setIsDialogOpen(false);
      setNewProject({ name: '', type: '', remark: '' });
      router.push(`/project/${result.project.id}`);
    } else {
      alert('创建项目失败，请重试');
    }
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

  // 文件夹操作
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('请输入文件夹名称');
      return;
    }
    const result = await createFolder(newFolderName.trim(), currentFolderId || undefined);
    if (result) {
      setIsFolderDialogOpen(false);
      setNewFolderName('');
      loadData();
    } else {
      alert('创建文件夹失败，请重试');
    }
  };

  const handleRenameFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setRenameFolderId(folderId);
      setRenameFolderName(folder.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleConfirmRenameFolder = async () => {
    if (!renameFolderName.trim()) {
      alert('请输入文件夹名称');
      return;
    }
    const success = await updateFolder(renameFolderId, renameFolderName.trim());
    if (success) {
      setIsRenameDialogOpen(false);
      loadData();
    } else {
      alert('重命名失败，请重试');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('确定要删除这个文件夹吗？文件夹内的项目将移到根目录。')) {
      const success = await deleteFolder(folderId);
      if (success) loadData();
      else alert('删除文件夹失败，请重试');
    }
  };

  // 多选操作
  const toggleProjectSelection = (projectId: string) => {
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjectIds(newSelected);
  };

  const toggleFolderSelection = (folderId: string) => {
    const newSelected = new Set(selectedFolderIds);
    if (newSelected.has(folderId)) {
      newSelected.delete(folderId);
    } else {
      newSelected.add(folderId);
    }
    setSelectedFolderIds(newSelected);
  };

  const toggleSelectAll = () => {
    const allProjectIds = projects.map(p => p.id);
    const allFolderIds = getChildFolders().map(f => f.id);
    
    if (selectedProjectIds.size === allProjectIds.length && selectedFolderIds.size === allFolderIds.length) {
      setSelectedProjectIds(new Set());
      setSelectedFolderIds(new Set());
    } else {
      setSelectedProjectIds(new Set(allProjectIds));
      setSelectedFolderIds(new Set(allFolderIds));
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedProjectIds(new Set());
    setSelectedFolderIds(new Set());
  };

  // 批量操作
  const handleBatchDelete = async () => {
    const total = selectedProjectIds.size + selectedFolderIds.size;
    if (total === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedProjectIds.size} 个项目和 ${selectedFolderIds.size} 个文件夹吗？`)) {
      // 删除项目
      if (selectedProjectIds.size > 0) {
        await batchOperateProjects('delete', Array.from(selectedProjectIds));
      }
      // 删除文件夹
      for (const folderId of selectedFolderIds) {
        await deleteFolder(folderId);
      }
      exitSelectMode();
      loadData();
    }
  };

  const handleBatchMove = async (targetFolderId: string | null) => {
    if (selectedProjectIds.size === 0) return;
    
    const result = await batchOperateProjects('move', Array.from(selectedProjectIds), targetFolderId);
    if (result.success) {
      setIsMoveDialogOpen(false);
      exitSelectMode();
      loadData();
    } else {
      alert('移动失败，请重试');
    }
  };

  const handleBatchCopy = async (targetFolderId: string | null) => {
    if (selectedProjectIds.size === 0) return;
    
    const result = await batchOperateProjects('copy', Array.from(selectedProjectIds), targetFolderId);
    if (result.success) {
      exitSelectMode();
      loadData();
    } else {
      alert('复制失败，请重试');
    }
  };

  // 回收站操作
  const loadTrashProjects = async () => {
    setTrashLoading(true);
    const projects = await getTrashProjects();
    setTrashProjects(projects);
    setTrashLoading(false);
  };

  const handleOpenTrash = () => {
    setIsTrashDialogOpen(true);
    loadTrashProjects();
    setIsTrashSelectMode(false);
    setSelectedTrashIds(new Set());
  };

  const toggleTrashSelection = (projectId: string) => {
    const newSelected = new Set(selectedTrashIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedTrashIds(newSelected);
  };

  const toggleTrashSelectAll = () => {
    if (selectedTrashIds.size === trashProjects.length) {
      setSelectedTrashIds(new Set());
    } else {
      setSelectedTrashIds(new Set(trashProjects.map(p => p.id)));
    }
  };

  const handleBatchRestore = async () => {
    if (selectedTrashIds.size === 0) return;
    
    const result = await batchRestoreProjects(Array.from(selectedTrashIds));
    if (result.success) {
      loadTrashProjects();
      loadData();
      setSelectedTrashIds(new Set());
      setIsTrashSelectMode(false);
    } else {
      alert('恢复失败，请重试');
    }
  };

  const handleBatchPermanentDelete = async (projectIds?: string[]) => {
    const idsToDelete = projectIds || Array.from(selectedTrashIds);
    if (idsToDelete.length === 0) return;
    
    if (confirm(`确定要永久删除选中的 ${idsToDelete.length} 个项目吗？此操作不可恢复。`)) {
      const result = await batchDeleteProjects(idsToDelete);
      if (result.success) {
        loadTrashProjects();
        setSelectedTrashIds(new Set());
        setIsTrashSelectMode(false);
      } else {
        alert('删除失败，请重试');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setProjects([]);
    setFolders([]);
  };

  const projectTypes = [
    { value: 'half-day' as ProjectType, label: '半日', description: '半天活动，不含住宿' },
    { value: 'one-day' as ProjectType, label: '一日', description: '单日活动，不含住宿' },
    { value: 'multi-day' as ProjectType, label: '多日', description: '多日活动，含住宿安排' },
  ];

  const currentPath = getCurrentPath();
  const childFolders = getChildFolders();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-lg" />
              <div>
                <h1 className="text-base md:text-xl font-bold text-gray-900">研学旅行成本核算</h1>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">快速核算，精准报价</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              {user ? (
                <>
                  {/* 移动端：主要操作按钮 */}
                  <Button className="gap-1 md:gap-2 h-9 md:h-10 px-3 md:px-4" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">新建项目</span>
                  </Button>
                  
                  {/* 移动端：更多操作下拉菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 md:hidden">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsFolderDialogOpen(true)}>
                        <FolderPlus className="w-4 h-4 mr-2" />新建文件夹
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenTrash}>
                        <Archive className="w-4 h-4 mr-2" />回收站
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                        <Key className="w-4 h-4 mr-2" />修改密码
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />退出登录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* 桌面端：完整按钮组 */}
                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setIsFolderDialogOpen(true)} title="新建文件夹">
                      <FolderPlus className="w-4 h-4" />
                    </Button>
                    
                    <Button variant="outline" size="icon" onClick={handleOpenTrash} title="回收站">
                      <Archive className="w-4 h-4" />
                    </Button>
                    
                    <div className="border-l h-6 mx-1"></div>
                    
                    {/* 视图切换 */}
                    <Button 
                      variant={viewMode === 'card' ? 'default' : 'outline'} 
                      size="icon" 
                      onClick={() => setViewMode('card')}
                      title="卡片视图"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant={viewMode === 'list' ? 'default' : 'outline'} 
                      size="icon" 
                      onClick={() => setViewMode('list')}
                      title="列表视图"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    
                    <div className="border-l h-6 mx-1"></div>
                    
                    {/* 多选模式 */}
                    {isSelectMode ? (
                      <>
                        <span className="text-sm text-gray-500">
                          已选 {selectedProjectIds.size + selectedFolderIds.size} 项
                        </span>
                        <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                          全选
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(true)} disabled={selectedProjectIds.size === 0}>
                          <Move className="w-4 h-4 mr-1" />
                          移动
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleBatchCopy(null)} disabled={selectedProjectIds.size === 0}>
                          <Copy className="w-4 h-4 mr-1" />
                          复制
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleBatchDelete} disabled={selectedProjectIds.size + selectedFolderIds.size === 0}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                        <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setIsSelectMode(true)}>
                        <CheckSquare className="w-4 h-4 mr-1" />
                        多选
                      </Button>
                    )}
                  </div>
                  
                  {/* 桌面端：用户菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hidden md:flex">
                        <User className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm text-gray-600">{user.email}</div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                        <Key className="w-4 h-4 mr-2" />
                        修改密码
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button className="gap-2" onClick={() => setIsAuthModalOpen(true)}>
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">登录 / 注册</span>
                  <span className="sm:hidden">登录</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />

      {/* Change Password Modal */}
      <ChangePasswordModal open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-8 md:py-12">
            {/* Hero Section */}
            <img src="/logo.png" alt="Logo" className="w-20 h-20 md:w-28 md:h-28 rounded-2xl mb-6 md:mb-8 shadow-lg shadow-blue-500/20" />
            
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 md:mb-3 text-center px-4">
              研学旅行成本核算工具
            </h2>
            <p className="text-sm md:text-base text-gray-500 mb-6 md:mb-8 text-center max-w-md px-4">
              专业的研学旅行成本核算与报价管理平台，助您高效管理项目、精准核算成本
            </p>
            
            <Button 
              onClick={() => setIsAuthModalOpen(true)} 
              className="gap-2 px-6 md:px-8 py-5 md:py-6 text-base md:text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/30"
            >
              <LogIn className="w-5 h-5" />
              登录 / 注册
            </Button>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-10 md:mt-16 w-full max-w-4xl">
              <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-3 md:mb-4">
                  <Calculator className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">成本核算</h3>
                <p className="text-xs md:text-sm text-gray-500">支持半日、一日、多日研学项目，自动计算各项费用</p>
              </div>
              
              <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-3 md:mb-4">
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">报价管理</h3>
                <p className="text-xs md:text-sm text-gray-500">灵活设置报价策略，实时查看利润分析</p>
              </div>
              
              <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-100 flex items-center justify-center mb-3 md:mb-4">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">数据分析</h3>
                <p className="text-xs md:text-sm text-gray-500">清晰的数据展示，支持导出报价单截图</p>
              </div>
            </div>

            {/* Contact Developer */}
            <p className="mt-8 md:mt-12 text-xs md:text-sm text-gray-400">
              联系开发者：17682312594（同微信）
            </p>
          </div>
        ) : projectsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* 面包屑导航 */}
            <div className="flex items-center gap-1 md:gap-2 mb-4 text-sm overflow-x-auto pb-2">
              <button 
                onClick={() => setCurrentFolderId(null)} 
                className={`flex items-center gap-1 hover:text-blue-600 flex-shrink-0 ${!currentFolderId ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
              >
                <HomeIcon className="w-4 h-4" />
                全部项目
              </button>
              {currentPath.map((folder, idx) => (
                <div key={folder.id} className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <button 
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`hover:text-blue-600 whitespace-nowrap ${idx === currentPath.length - 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            {projects.length === 0 && childFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 md:py-16">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-4 md:mb-6">
                  <Calendar className="w-10 h-10 md:w-12 md:h-12 text-blue-500" />
                </div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-700 mb-1 md:mb-2">
                  {currentFolderId ? '这个文件夹是空的' : '还没有项目'}
                </h2>
                <p className="text-sm md:text-base text-gray-500 mb-4 md:mb-6">点击上方"新建项目"开始创建</p>
                <div className="flex gap-2 md:gap-3">
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    <Plus className="w-4 h-4" />
                    创建项目
                  </Button>
                  <Button variant="outline" onClick={() => setIsFolderDialogOpen(true)} className="gap-2">
                    <FolderPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">新建文件夹</span>
                    <span className="sm:hidden">文件夹</span>
                  </Button>
                </div>
              </div>
            ) : viewMode === 'card' ? (
              /* 卡片视图 */
              <div className="space-y-4">
                {/* 文件夹 */}
                {childFolders.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {childFolders.map((folder) => (
                      <Card 
                        key={folder.id} 
                        className={`cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 relative ${
                          isSelectMode && selectedFolderIds.has(folder.id) ? 'ring-2 ring-blue-500 border-blue-300' : ''
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleFolderSelection(folder.id);
                          } else {
                            setCurrentFolderId(folder.id);
                          }
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FolderIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                              <span className="font-medium truncate" title={folder.name}>{folder.name}</span>
                            </div>
                            {!isSelectMode && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mr-2">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id); }}>
                                    <Pencil className="w-4 h-4 mr-2" />重命名
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                                    <Trash2 className="w-4 h-4 mr-2" />删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          {isSelectMode && (
                            <div className="absolute top-3 left-3">
                              <Checkbox checked={selectedFolderIds.has(folder.id)} />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* 项目 */}
                {projects.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {projects.map((project) => (
                      <Card 
                        key={project.id} 
                        className={`cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 ${
                          isSelectMode && selectedProjectIds.has(project.id) ? 'ring-2 ring-blue-500 border-blue-300' : ''
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleProjectSelection(project.id);
                          } else {
                            router.push(`/project/${project.id}`);
                          }
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* 项目名称 */}
                              <div className="font-medium text-base truncate" title={project.name}>{project.name}</div>
                              {/* 项目类型 */}
                              <div className="mt-1">
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                  {PROJECT_TYPE_LABELS[project.type]}
                                </span>
                              </div>
                              {/* 备注 */}
                              {project.remark && (
                                <p className="mt-2 text-xs text-gray-500 line-clamp-2">{project.remark}</p>
                              )}
                              {/* 时间信息 */}
                              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                                <span>创建 {new Date(project.createdAt).toLocaleDateString()}</span>
                                <span>更新 {new Date(project.updatedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {/* 操作按钮 */}
                            {!isSelectMode && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mt-1 -mr-2">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                            )}
                          </div>
                          {isSelectMode && (
                            <div className="absolute top-3 left-3">
                              <Checkbox checked={selectedProjectIds.has(project.id)} />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* 列表视图 */
              <div className="bg-white rounded-lg border">
                {/* 桌面端表头 */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-3 border-b bg-gray-50 text-sm font-medium text-gray-500">
                  <div className="col-span-5">名称</div>
                  <div className="col-span-2">类型</div>
                  <div className="col-span-2">创建时间</div>
                  <div className="col-span-2">更新时间</div>
                  <div className="col-span-1">操作</div>
                </div>
                
                {/* 文件夹 */}
                {childFolders.map((folder) => (
                  <div 
                    key={folder.id}
                    className={`grid grid-cols-12 gap-4 p-3 border-b hover:bg-gray-50 cursor-pointer items-center ${
                      isSelectMode && selectedFolderIds.has(folder.id) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleFolderSelection(folder.id);
                      } else {
                        setCurrentFolderId(folder.id);
                      }
                    }}
                  >
                    <div className="col-span-11 md:col-span-5 flex items-center gap-2">
                      {isSelectMode && <Checkbox checked={selectedFolderIds.has(folder.id)} />}
                      <FolderIcon className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">{folder.name}</span>
                      <span className="md:hidden text-xs text-gray-400 ml-2">文件夹</span>
                    </div>
                    <div className="hidden md:block col-span-2 text-sm text-gray-500">文件夹</div>
                    <div className="hidden md:block col-span-2 text-sm text-gray-500">{new Date(folder.createdAt).toLocaleDateString()}</div>
                    <div className="hidden md:block col-span-2 text-sm text-gray-500">{new Date(folder.updatedAt).toLocaleDateString()}</div>
                    <div className="col-span-1">
                      {!isSelectMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id); }}>
                              <Pencil className="w-4 h-4 mr-2" />重命名
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                              <Trash2 className="w-4 h-4 mr-2" />删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* 项目 */}
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className={`grid grid-cols-12 gap-4 p-3 border-b hover:bg-gray-50 cursor-pointer items-center ${
                      isSelectMode && selectedProjectIds.has(project.id) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleProjectSelection(project.id);
                      } else {
                        router.push(`/project/${project.id}`);
                      }
                    }}
                  >
                    <div className="col-span-11 md:col-span-5 flex items-center gap-2">
                      {isSelectMode && <Checkbox checked={selectedProjectIds.has(project.id)} />}
                      <span className="font-medium">{project.name}</span>
                      <span className="md:hidden px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    <div className="hidden md:block col-span-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    <div className="hidden md:block col-span-2 text-sm text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</div>
                    <div className="hidden md:block col-span-2 text-sm text-gray-500">{new Date(project.updatedAt).toLocaleDateString()}</div>
                    <div className="col-span-1">
                      {!isSelectMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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

      {/* 新建文件夹对话框 */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>创建一个文件夹来组织您的项目</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folderName">文件夹名称</Label>
              <Input id="folderName" placeholder="请输入文件夹名称" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{renameFolderId ? '重命名文件夹' : '重命名项目'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="renameName">名称</Label>
              <Input id="renameName" placeholder="输入新名称" value={renameFolderId ? renameFolderName : renameProjectName} 
                onChange={(e) => renameFolderId ? setRenameFolderName(e.target.value) : setRenameProjectName(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && (renameFolderId ? handleConfirmRenameFolder() : handleConfirmRename())} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRenameDialogOpen(false); setRenameFolderId(''); }}>取消</Button>
            <Button onClick={renameFolderId ? handleConfirmRenameFolder : handleConfirmRename}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动对话框 */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>移动到文件夹</DialogTitle>
            <DialogDescription>选择目标文件夹</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[300px] overflow-y-auto">
            <div 
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => handleBatchMove(null)}
            >
              <HomeIcon className="w-5 h-5 text-gray-500" />
              <span>根目录</span>
            </div>
            {folders.filter(f => !f.parentId).map(folder => (
              <div 
                key={folder.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                onClick={() => handleBatchMove(folder.id)}
              >
                <FolderIcon className="w-5 h-5 text-blue-500" />
                <span>{folder.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 回收站对话框 */}
      <Dialog open={isTrashDialogOpen} onOpenChange={setIsTrashDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  回收站
                </DialogTitle>
                <DialogDescription>已删除的项目将在回收站保留</DialogDescription>
              </div>
              {trashProjects.length > 0 && (
                <div className="flex items-center gap-2">
                  {isTrashSelectMode ? (
                    <>
                      <span className="text-sm text-gray-500">已选 {selectedTrashIds.size} 项</span>
                      <Button variant="outline" size="sm" onClick={toggleTrashSelectAll}>全选</Button>
                      <Button variant="outline" size="sm" onClick={handleBatchRestore} disabled={selectedTrashIds.size === 0}>
                        <RotateCcw className="w-4 h-4 mr-1" />恢复
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleBatchPermanentDelete()} disabled={selectedTrashIds.size === 0}>
                        <Trash className="w-4 h-4 mr-1" />永久删除
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setIsTrashSelectMode(false); setSelectedTrashIds(new Set()); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setIsTrashSelectMode(true)}>
                      <CheckSquare className="w-4 h-4 mr-1" />多选
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {trashLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : trashProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>回收站是空的</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trashProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isTrashSelectMode && selectedTrashIds.has(project.id) ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50'
                    }`}
                    onClick={() => isTrashSelectMode && toggleTrashSelection(project.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isTrashSelectMode && <Checkbox checked={selectedTrashIds.has(project.id)} />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                            {PROJECT_TYPE_LABELS[project.type]}
                          </span>
                          <span className="font-medium">{project.name}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          删除于 {project.deletedAt ? new Date(project.deletedAt).toLocaleString() : '-'}
                        </div>
                      </div>
                    </div>
                    {!isTrashSelectMode && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { restoreProject(project.id); loadTrashProjects(); loadData(); }} className="gap-1">
                          <RotateCcw className="w-3 h-3" />恢复
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleBatchPermanentDelete([project.id])} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash className="w-3 h-3" />永久删除
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

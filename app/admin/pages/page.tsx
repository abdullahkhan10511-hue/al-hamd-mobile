'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CustomPage,
  PageBlock,
  BlockType,
  PageStatus,
} from '@/types/admin';
import {
  getPages,
  savePage,
  duplicatePage,
  deletePage,
  reorderPages,
  isSlugUnique,
} from '@/lib/db/pages';
import { useAdminAuth } from '@/context/AdminAuthContext';
import PageRenderer from '@/components/ui/PageRenderer';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  Save,
  ExternalLink,
  Globe,
  Search,
  Filter,
  AlertTriangle,
  X,
  Heading,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Minus,
  HelpCircle,
  Phone,
  Image as ImageIcon,
  Link as LinkIcon,
  CheckCircle2,
  ShieldAlert,
  Monitor,
  Smartphone,
  Sparkles,
  FileText,
  ArrowLeft,
  Settings,
} from 'lucide-react';

export default function AdminPagesManager() {
  const { admin, hasPermission, isSuperAdmin } = useAdminAuth();

  const isOwner = admin?.isOwner || isSuperAdmin || admin?.role === 'SUPER_ADMIN';
  const canCreate = isOwner || hasPermission('pages.create');
  const canEdit = isOwner || hasPermission('pages.edit');
  const canDelete = isOwner || hasPermission('pages.delete');
  const canPublish = isOwner || hasPermission('pages.publish');
  const canManageNav = isOwner || hasPermission('pages.manage_nav');

  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PageStatus>('All');

  // Edit / Create view state
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'blocks' | 'seo' | 'navigation'>('blocks');

  // Preview Modal
  const [previewPage, setPreviewPage] = useState<CustomPage | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Delete Confirmation Modal
  const [pageToDelete, setPageToDelete] = useState<CustomPage | null>(null);

  // Status & Notifications
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [slugError, setSlugError] = useState('');

  // Active expanded block in editor
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);

  // Load pages data
  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getPages();
      setPages(list);
    } catch (e) {
      console.error('Failed to load pages:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  // Filtered pages
  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pages, searchQuery, statusFilter]);

  // Start creating new page
  const handleStartCreate = () => {
    const newPage: CustomPage = {
      id: `page-${Date.now()}`,
      title: '',
      slug: '',
      status: 'Draft',
      showInHeader: false,
      showInFooter: true,
      showInMobile: true,
      footerCategory: 'customer_service',
      seoTitle: '',
      seoDescription: '',
      targetKeywords: [],
      seoImage: '',
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'heading',
          order: 1,
          headingLevel: 'h1',
          headingAlign: 'left',
          headingText: '',
        },
        {
          id: `blk-${Date.now()}-2`,
          type: 'paragraph',
          order: 2,
          paragraphAlign: 'left',
          paragraphText: '',
        },
      ],
      order: pages.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: false,
    };
    setEditingPage(newPage);
    setIsCreating(true);
    setActiveTab('blocks');
    setExpandedBlockId(newPage.blocks[0].id);
    setSlugError('');
  };

  // Start editing existing page
  const handleStartEdit = (page: CustomPage) => {
    setEditingPage(JSON.parse(JSON.stringify(page)));
    setIsCreating(false);
    setActiveTab('blocks');
    setExpandedBlockId(page.blocks[0]?.id || null);
    setSlugError('');
  };

  // Quick toggle publish/unpublish
  const handleTogglePublish = async (page: CustomPage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canPublish) {
      alert('You do not have permission to publish or unpublish pages.');
      return;
    }

    const nextStatus: PageStatus = page.status === 'Published' ? 'Draft' : 'Published';
    try {
      setSaveStatus('saving');
      const updated = await savePage(
        { ...page, status: nextStatus },
        admin?.email || 'admin@alhamd.com'
      );
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (editingPage?.id === page.id) {
        setEditingPage(updated);
      }
      setSaveStatus('saved');
      setStatusMessage(`Page "${page.title}" marked as ${nextStatus}.`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setStatusMessage(err?.message || 'Failed to update page status.');
    }
  };

  // Duplicate page
  const handleDuplicate = async (page: CustomPage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canCreate) {
      alert('You do not have permission to create or duplicate pages.');
      return;
    }

    try {
      setSaveStatus('saving');
      const copy = await duplicatePage(page.id, admin?.email || 'admin@alhamd.com');
      await loadData();
      setSaveStatus('saved');
      setStatusMessage(`Duplicated page: "${copy.title}"`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setStatusMessage(err?.message || 'Failed to duplicate page.');
    }
  };

  // Reorder page up / down
  const handleMovePage = async (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= filteredPages.length) return;

    const newPages = [...filteredPages];
    const temp = newPages[index];
    newPages[index] = newPages[targetIdx];
    newPages[targetIdx] = temp;

    const orderedIds = newPages.map((p) => p.id);
    try {
      const updated = await reorderPages(orderedIds, admin?.email || 'admin@alhamd.com');
      setPages(updated);
    } catch (err: any) {
      console.error('Reorder error:', err);
    }
  };

  // Delete page
  const handleConfirmDelete = async () => {
    if (!pageToDelete) return;
    if (!canDelete) {
      alert('You do not have permission to delete pages.');
      return;
    }

    try {
      setSaveStatus('saving');
      await deletePage(pageToDelete.id, admin?.email || 'admin@alhamd.com');
      setPages((prev) => prev.filter((p) => p.id !== pageToDelete.id));
      if (editingPage?.id === pageToDelete.id) {
        setEditingPage(null);
      }
      setPageToDelete(null);
      setSaveStatus('saved');
      setStatusMessage(`Permanently deleted page "${pageToDelete.title}".`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setStatusMessage(err?.message || 'Failed to delete page.');
    }
  };

  // Save changes to editingPage
  const handleSavePage = async (overrideStatus?: PageStatus) => {
    if (!editingPage) return;
    if (isCreating && !canCreate) {
      alert('You do not have permission to create pages.');
      return;
    }
    if (!isCreating && !canEdit) {
      alert('You do not have permission to edit pages.');
      return;
    }

    if (!editingPage.title.trim()) {
      alert('Please provide a Page Title.');
      return;
    }

    const cleanSlug = (editingPage.slug || editingPage.title)
      .toLowerCase()
      .trim()
      .replace(/^\//, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      alert('Please provide a valid URL slug.');
      return;
    }

    // Verify slug uniqueness
    const unique = await isSlugUnique(cleanSlug, editingPage.id);
    if (!unique) {
      setSlugError(`The slug "/${cleanSlug}" is already in use by another page.`);
      return;
    }
    setSlugError('');

    const pageToSave: CustomPage = {
      ...editingPage,
      title: editingPage.title.trim(),
      slug: cleanSlug,
      status: overrideStatus || editingPage.status,
      seoTitle: editingPage.seoTitle || `${editingPage.title} | AL-HAMD Mobile`,
      seoDescription:
        editingPage.seoDescription ||
        editingPage.blocks.find((b) => b.type === 'paragraph')?.paragraphText?.slice(0, 150) ||
        '',
    };

    try {
      setSaveStatus('saving');
      const saved = await savePage(pageToSave, admin?.email || 'admin@alhamd.com');
      setEditingPage(saved);
      setIsCreating(false);
      await loadData();
      setSaveStatus('saved');
      setStatusMessage(`Page "${saved.title}" saved successfully.`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setStatusMessage(err?.message || 'Failed to save page.');
    }
  };

  // Block management helpers
  const handleAddBlock = (type: BlockType) => {
    if (!editingPage) return;
    const newBlock: PageBlock = {
      id: `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      order: editingPage.blocks.length + 1,
    };

    switch (type) {
      case 'heading':
        newBlock.headingLevel = 'h2';
        newBlock.headingAlign = 'left';
        newBlock.headingText = '';
        break;
      case 'subheading':
        newBlock.subheadingAlign = 'left';
        newBlock.subheadingText = '';
        break;
      case 'paragraph':
        newBlock.paragraphAlign = 'left';
        newBlock.paragraphText = '';
        break;
      case 'rich_text':
        newBlock.richTextHtml = '<p>Enter formatted content here...</p>';
        break;
      case 'image':
        newBlock.imageUrl = '';
        newBlock.imageAlt = '';
        newBlock.imageCaption = '';
        newBlock.imageAlign = 'center';
        break;
      case 'button':
        newBlock.buttonText = 'Learn More';
        newBlock.buttonLink = '/shop';
        newBlock.buttonVariant = 'primary';
        newBlock.buttonAlign = 'left';
        break;
      case 'bullet_list':
      case 'numbered_list':
        newBlock.listItems = ['First item', 'Second item'];
        break;
      case 'divider':
        newBlock.dividerStyle = 'solid';
        newBlock.dividerSpacing = 'md';
        break;
      case 'faq':
        newBlock.faqQuestion = 'What is your question?';
        newBlock.faqAnswer = 'Detailed answer goes here.';
        break;
      case 'contact_info':
        newBlock.contactEmail = 'support@alhamd-mobile.com';
        newBlock.contactPhone = '+92 300 1234567';
        newBlock.contactAddress = 'Shop # 12, MM Alam Road, Lahore, Pakistan';
        newBlock.contactHours = 'Mon - Sat: 10am - 9pm PKT';
        newBlock.contactWhatsapp = '+92 300 1234567';
        break;
    }

    const updatedBlocks = [...editingPage.blocks, newBlock];
    setEditingPage({ ...editingPage, blocks: updatedBlocks });
    setExpandedBlockId(newBlock.id);
    setShowAddBlockMenu(false);
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<PageBlock>) => {
    if (!editingPage) return;
    const updatedBlocks = editingPage.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b));
    setEditingPage({ ...editingPage, blocks: updatedBlocks });
  };

  const handleDuplicateBlock = (blockId: string) => {
    if (!editingPage) return;
    const idx = editingPage.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;

    const source = editingPage.blocks[idx];
    const clone: PageBlock = {
      ...JSON.parse(JSON.stringify(source)),
      id: `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order: source.order + 1,
    };

    const newBlocks = [...editingPage.blocks];
    newBlocks.splice(idx + 1, 0, clone);
    // Re-index
    newBlocks.forEach((b, i) => (b.order = i + 1));
    setEditingPage({ ...editingPage, blocks: newBlocks });
    setExpandedBlockId(clone.id);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!editingPage) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= editingPage.blocks.length) return;

    const newBlocks = [...editingPage.blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIdx];
    newBlocks[targetIdx] = temp;
    newBlocks.forEach((b, i) => (b.order = i + 1));
    setEditingPage({ ...editingPage, blocks: newBlocks });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!editingPage) return;
    if (editingPage.blocks.length <= 1) {
      alert('A page must contain at least one content block.');
      return;
    }
    const newBlocks = editingPage.blocks
      .filter((b) => b.id !== blockId)
      .map((b, i) => ({ ...b, order: i + 1 }));
    setEditingPage({ ...editingPage, blocks: newBlocks });
    if (expandedBlockId === blockId) {
      setExpandedBlockId(newBlocks[0]?.id || null);
    }
  };

  // Render Editor Mode
  if (editingPage) {
    return (
      <div className="space-y-6 pb-20">
        {/* Top Sticky Bar */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-4 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingPage(null);
                setIsCreating(false);
              }}
              className="p-2 text-neutral-500 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Return to Pages List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-neutral-900">
                  {isCreating ? 'Create New Page' : editingPage.title || 'Untitled Page'}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    editingPage.status === 'Published'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : editingPage.status === 'Draft'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}
                >
                  {editingPage.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-mono">
                URL: /{editingPage.slug || 'page-slug'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Notifications */}
            {saveStatus === 'saving' && (
              <span className="text-xs font-semibold text-neutral-500 animate-pulse flex items-center gap-1 mr-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Saving changes...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mr-2">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1 mr-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Save Error
              </span>
            )}

            {/* Live Preview Button */}
            <button
              type="button"
              onClick={() => setPreviewPage(editingPage)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-neutral-600" />
              <span>Preview Live</span>
            </button>

            {/* Save Draft */}
            <button
              type="button"
              onClick={() => handleSavePage('Draft')}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4 text-neutral-600" />
              <span>Save Draft</span>
            </button>

            {/* Publish / Update Button */}
            {canPublish && (
              <button
                type="button"
                onClick={() => handleSavePage('Published')}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{editingPage.status === 'Published' ? 'Update & Keep Published' : 'Publish Live'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Validation error notice */}
        {slugError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{slugError}</span>
          </div>
        )}

        {/* Tabs: Content Blocks, SEO & Metadata, Navigation Visibility */}
        <div className="flex border-b border-neutral-200 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('blocks')}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'blocks'
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Page Content Blocks ({editingPage.blocks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('navigation')}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'navigation'
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Navigation & Placement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seo')}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'seo'
                ? 'border-neutral-950 text-neutral-950'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>SEO & SERP Preview</span>
          </button>
        </div>

        {/* TAB 1: Content Blocks */}
        {activeTab === 'blocks' && (
          <div className="space-y-6">
            {/* Basic Page Properties Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="md:col-span-1">
                <label className="block font-bold text-neutral-700 mb-1">Page Name / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Return & Refund Policy"
                  value={editingPage.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const autoSlug = isCreating
                      ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                      : editingPage.slug;
                    setEditingPage({
                      ...editingPage,
                      title,
                      slug: isCreating ? autoSlug : editingPage.slug,
                    });
                  }}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block font-bold text-neutral-700 mb-1">URL Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-xl text-neutral-500 font-mono text-xs">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="return-refund-policy"
                    value={editingPage.slug}
                    onChange={(e) => {
                      const clean = e.target.value
                        .toLowerCase()
                        .replace(/^\//, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                      setEditingPage({ ...editingPage, slug: clean });
                      setSlugError('');
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-r-xl text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block font-bold text-neutral-700 mb-1">Publishing Status</label>
                <select
                  value={editingPage.status}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, status: e.target.value as PageStatus })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold focus:ring-2 focus:ring-neutral-900"
                >
                  <option value="Published">Published (Publicly visible)</option>
                  <option value="Draft">Draft (Store admin only)</option>
                  <option value="Hidden">Hidden (Temporarily offline)</option>
                </select>
              </div>
            </div>

            {/* List of Content Blocks */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">
                    Element-by-Element Content Blocks
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Edit, reorder, or duplicate individual sections without affecting the rest of the page.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddBlockMenu(!showAddBlockMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Block</span>
                </button>
              </div>

              {/* Add Block Dropdown / Grid */}
              {showAddBlockMenu && (
                <div className="p-4 bg-neutral-900 text-white rounded-2xl shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Choose Content Block Type
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddBlockMenu(false)}
                      className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    <AddBlockButton
                      icon={<Heading className="w-4 h-4 text-amber-400" />}
                      label="Heading"
                      onClick={() => handleAddBlock('heading')}
                    />
                    <AddBlockButton
                      icon={<Type className="w-4 h-4 text-neutral-300" />}
                      label="Subheading"
                      onClick={() => handleAddBlock('subheading')}
                    />
                    <AddBlockButton
                      icon={<AlignLeft className="w-4 h-4 text-blue-400" />}
                      label="Paragraph"
                      onClick={() => handleAddBlock('paragraph')}
                    />
                    <AddBlockButton
                      icon={<Bold className="w-4 h-4 text-purple-400" />}
                      label="Rich Text"
                      onClick={() => handleAddBlock('rich_text')}
                    />
                    <AddBlockButton
                      icon={<ImageIcon className="w-4 h-4 text-emerald-400" />}
                      label="Image"
                      onClick={() => handleAddBlock('image')}
                    />
                    <AddBlockButton
                      icon={<LinkIcon className="w-4 h-4 text-amber-300" />}
                      label="Button / Link"
                      onClick={() => handleAddBlock('button')}
                    />
                    <AddBlockButton
                      icon={<List className="w-4 h-4 text-teal-400" />}
                      label="Bullet List"
                      onClick={() => handleAddBlock('bullet_list')}
                    />
                    <AddBlockButton
                      icon={<ListOrdered className="w-4 h-4 text-cyan-400" />}
                      label="Numbered List"
                      onClick={() => handleAddBlock('numbered_list')}
                    />
                    <AddBlockButton
                      icon={<Minus className="w-4 h-4 text-neutral-400" />}
                      label="Divider"
                      onClick={() => handleAddBlock('divider')}
                    />
                    <AddBlockButton
                      icon={<HelpCircle className="w-4 h-4 text-orange-400" />}
                      label="FAQ Item"
                      onClick={() => handleAddBlock('faq')}
                    />
                    <AddBlockButton
                      icon={<Phone className="w-4 h-4 text-rose-400" />}
                      label="Contact Details"
                      onClick={() => handleAddBlock('contact_info')}
                    />
                  </div>
                </div>
              )}

              {/* Blocks Stream */}
              <div className="space-y-3">
                {editingPage.blocks.map((block, idx) => {
                  const isExpanded = expandedBlockId === block.id;

                  return (
                    <div
                      key={block.id}
                      className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                        isExpanded
                          ? 'border-neutral-900 shadow-md ring-1 ring-neutral-900'
                          : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      {/* Block Header Toolbar */}
                      <div
                        onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer bg-neutral-50/60 hover:bg-neutral-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-neutral-200/80 text-neutral-700 font-mono text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 text-[10px] font-bold uppercase tracking-wider">
                            {block.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-semibold text-neutral-800 truncate max-w-[200px] sm:max-w-md">
                            {getBlockSummary(block)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Move Up */}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveBlock(idx, 'up')}
                            className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 rounded-md hover:bg-neutral-200/60 transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            type="button"
                            disabled={idx === editingPage.blocks.length - 1}
                            onClick={() => handleMoveBlock(idx, 'down')}
                            className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 rounded-md hover:bg-neutral-200/60 transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(block.id)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-200/60 transition-colors cursor-pointer"
                            title="Duplicate Block"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1 text-neutral-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-[1px] h-4 bg-neutral-300 mx-1" />

                          {/* Expand / Collapse Chevron */}
                          <button
                            type="button"
                            onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                            className="p-1 text-neutral-500 hover:text-neutral-900"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-neutral-900' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Block Detailed Form Body */}
                      {isExpanded && (
                        <div className="p-4 border-t border-neutral-100 space-y-3 text-xs bg-white">
                          <BlockEditor
                            block={block}
                            onChange={(updates) => handleUpdateBlock(block.id, updates)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick Add Bar */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAddBlockMenu(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Another Content Block</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Navigation Placement */}
        {activeTab === 'navigation' && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 text-xs max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Navigation & Visibility</h3>
              <p className="text-neutral-500 mt-0.5">
                Control where this page is linked across header, footer columns, and mobile drawers.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Header Nav Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                <div>
                  <span className="font-bold text-neutral-900 block text-sm">
                    Show in Desktop Header Menu
                  </span>
                  <span className="text-neutral-500">
                    Displays link in top navigation bar if page is Published.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!canManageNav}
                  checked={editingPage.showInHeader}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, showInHeader: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                />
              </div>

              {/* Footer Nav Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                <div>
                  <span className="font-bold text-neutral-900 block text-sm">
                    Show in Storefront Footer
                  </span>
                  <span className="text-neutral-500">
                    Displays link under the selected footer column if page is Published.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!canManageNav}
                  checked={editingPage.showInFooter}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, showInFooter: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                />
              </div>

              {/* Footer Category Selector */}
              {editingPage.showInFooter && (
                <div className="p-4 rounded-xl border border-neutral-200 bg-white ml-4 space-y-2">
                  <label className="block font-bold text-neutral-800">Footer Column / Category</label>
                  <select
                    disabled={!canManageNav}
                    value={editingPage.footerCategory || 'customer_service'}
                    onChange={(e) =>
                      setEditingPage({
                        ...editingPage,
                        footerCategory: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
                  >
                    <option value="customer_service">Customer Care / Services</option>
                    <option value="legal">House & Legal Policies</option>
                    <option value="about">About & Heritage</option>
                  </select>
                </div>
              )}

              {/* Mobile Drawer Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                <div>
                  <span className="font-bold text-neutral-900 block text-sm">
                    Show in Mobile Menu Drawer
                  </span>
                  <span className="text-neutral-500">
                    Displays link inside mobile navigation slider if page is Published.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={!canManageNav}
                  checked={editingPage.showInMobile}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, showInMobile: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SEO & SERP */}
        {activeTab === 'seo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* SEO Inputs */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Search Engine Optimization</h3>
                <p className="text-neutral-500 mt-0.5">
                  Optimize title, meta tags, and indexing keywords for Google search crawlers.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-neutral-700">SEO Meta Title</label>
                  <span className="text-[11px] text-neutral-400">
                    {(editingPage.seoTitle || '').length} / 60 chars
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Return & Refund Policy | AL-HAMD Mobile Pakistan"
                  value={editingPage.seoTitle || ''}
                  onChange={(e) => setEditingPage({ ...editingPage, seoTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-neutral-700">SEO Meta Description</label>
                  <span className="text-[11px] text-neutral-400">
                    {(editingPage.seoDescription || '').length} / 160 chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Briefly describe what this page covers for prospective clients search snippets."
                  value={editingPage.seoDescription || ''}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, seoDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 leading-relaxed focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">
                  Target Search Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. returns, refund guarantee, 7 day warranty, shipping pakistan"
                  value={(editingPage.targetKeywords || []).join(', ')}
                  onChange={(e) =>
                    setEditingPage({
                      ...editingPage,
                      targetKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">
                  Social Sharing Image URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={editingPage.seoImage || ''}
                  onChange={(e) => setEditingPage({ ...editingPage, seoImage: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            {/* Google SERP Snippet Preview */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Google SERP Snippet Preview</h3>
                <p className="text-neutral-500 mt-0.5">
                  How this page will typically appear in Google search results:
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="font-semibold text-neutral-700">alhamd-mobile.com</span>
                  <span>›</span>
                  <span className="text-neutral-500 font-mono">/{editingPage.slug || 'page'}</span>
                </div>
                <h4 className="text-base font-semibold text-blue-800 hover:underline cursor-pointer truncate">
                  {editingPage.seoTitle || editingPage.title || 'Page Title'}
                </h4>
                <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                  {editingPage.seoDescription ||
                    'Visit AL-HAMD Mobile Accessories for official store policies, charging essentials, and verified customer services across Pakistan.'}
                </p>
              </div>

              {/* Keywords Preview */}
              {editingPage.targetKeywords && editingPage.targetKeywords.length > 0 && (
                <div className="pt-2">
                  <span className="font-bold text-neutral-700 block mb-2">Target Keywords Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {editingPage.targetKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 font-mono text-[11px]"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Preview Modal */}
        {previewPage && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              {/* Modal Top Bar */}
              <div className="px-6 py-3.5 bg-neutral-950 text-white flex items-center justify-between border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">Storefront Live Preview</span>
                  <span className="font-mono text-xs text-neutral-400">/{previewPage.slug}</span>
                </div>

                {/* Viewport switcher */}
                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      previewViewport === 'desktop'
                        ? 'bg-white text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      previewViewport === 'mobile'
                        ? 'bg-white text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewPage(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Preview */}
              <div className="flex-1 overflow-y-auto bg-neutral-100 p-4 sm:p-8 flex justify-center">
                <div
                  className={`bg-white rounded-2xl shadow-md transition-all duration-300 p-6 sm:p-10 ${
                    previewViewport === 'desktop' ? 'w-full max-w-4xl' : 'w-full max-w-[390px]'
                  }`}
                >
                  <div className="space-y-3 mb-8 pb-4 border-b border-neutral-100">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                      {previewPage.footerCategory === 'legal' ? 'Legal & Compliance' : 'Store Information'}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">
                      {previewPage.title || 'Page Title'}
                    </h1>
                  </div>

                  <PageRenderer page={previewPage} isPreview={true} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Pages List Mode
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Pages & Legal</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Build and manage institutional, policy, and custom pages with word-by-word content blocks.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Page</span>
          </button>
        )}
      </div>

      {/* Status notification */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pages by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 self-stretch sm:self-auto overflow-x-auto">
          {(['All', 'Published', 'Draft', 'Hidden'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === st
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {st} {st !== 'All' ? `(${pages.filter((p) => p.status === st).length})` : `(${pages.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Pages List */}
      {loading ? (
        <div className="p-12 text-center text-neutral-400 font-medium">Loading pages...</div>
      ) : filteredPages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400 space-y-3">
          <FileText className="w-12 h-12 mx-auto text-neutral-300" />
          <h3 className="font-bold text-sm text-neutral-700">No pages found</h3>
          <p className="text-xs text-neutral-400">
            {searchQuery
              ? 'No pages match your search query.'
              : 'You have not created any custom pages yet.'}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Page</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPages.map((page, idx) => (
            <div
              key={page.id}
              className="bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Left Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base text-neutral-900">{page.title}</h3>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      page.status === 'Published'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : page.status === 'Draft'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    {page.status === 'Published' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : page.status === 'Draft' ? (
                      <EyeOff className="w-3 h-3 text-amber-600" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-neutral-500" />
                    )}
                    {page.status}
                  </span>

                  {/* Navigation badges */}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 ml-1">
                    <span
                      title="Header Navigation"
                      className={`px-1.5 py-0.5 rounded ${
                        page.showInHeader
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      Header {page.showInHeader ? '✓' : '✗'}
                    </span>
                    <span
                      title="Footer Placement"
                      className={`px-1.5 py-0.5 rounded ${
                        page.showInFooter
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      Footer {page.showInFooter ? '✓' : '✗'}
                    </span>
                    <span
                      title="Mobile Drawer"
                      className={`px-1.5 py-0.5 rounded ${
                        page.showInMobile
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      Mobile {page.showInMobile ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 font-mono">
                  <span>/{page.slug}</span>
                  <span>•</span>
                  <span>{page.blocks?.length || 0} content blocks</span>
                  <span>•</span>
                  <span>
                    Updated{' '}
                    {new Date(page.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
                {/* Reorder Buttons */}
                {canEdit && (
                  <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePage(idx, 'up')}
                      className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === filteredPages.length - 1}
                      onClick={() => handleMovePage(idx, 'down')}
                      className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 disabled:opacity-30 transition-colors cursor-pointer border-l border-neutral-200"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Live Preview */}
                <button
                  type="button"
                  onClick={() => setPreviewPage(page)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Preview</span>
                </button>

                {/* Edit */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(page)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Edit</span>
                  </button>
                )}

                {/* Duplicate */}
                {canCreate && (
                  <button
                    type="button"
                    onClick={(e) => handleDuplicate(page, e)}
                    className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                    title="Duplicate Page"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}

                {/* Publish / Unpublish Toggle */}
                {canPublish && (
                  <button
                    type="button"
                    onClick={(e) => handleTogglePublish(page, e)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      page.status === 'Published'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                    }`}
                    title={page.status === 'Published' ? 'Unpublish (Make Draft)' : 'Publish Page'}
                  >
                    {page.status === 'Published' ? (
                      <Eye className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                )}

                {/* Delete */}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setPageToDelete(page)}
                    className="p-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                    title="Delete Page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pageToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-lg text-neutral-900">Delete Page?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-neutral-800">&quot;{pageToDelete.title}&quot;</strong> (/{pageToDelete.slug})?
                This action cannot be undone. Customer data, products, and orders will not be affected.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPageToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal from list */}
      {previewPage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Top Bar */}
            <div className="px-6 py-3.5 bg-neutral-950 text-white flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">Storefront Live Preview</span>
                <span className="font-mono text-xs text-neutral-400">/{previewPage.slug}</span>
              </div>

              {/* Viewport switcher */}
              <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    previewViewport === 'desktop'
                      ? 'bg-white text-neutral-950'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    previewViewport === 'mobile'
                      ? 'bg-white text-neutral-950'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewPage(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Preview */}
            <div className="flex-1 overflow-y-auto bg-neutral-100 p-4 sm:p-8 flex justify-center">
              <div
                className={`bg-white rounded-2xl shadow-md transition-all duration-300 p-6 sm:p-10 ${
                  previewViewport === 'desktop' ? 'w-full max-w-4xl' : 'w-full max-w-[390px]'
                }`}
              >
                <div className="space-y-3 mb-8 pb-4 border-b border-neutral-100">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                    {previewPage.footerCategory === 'legal' ? 'Legal & Compliance' : 'Store Information'}
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950">
                    {previewPage.title || 'Page Title'}
                  </h1>
                </div>

                <PageRenderer page={previewPage} isPreview={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: summarize block in header
function getBlockSummary(block: PageBlock): string {
  switch (block.type) {
    case 'heading':
      return block.headingText ? `(${block.headingLevel?.toUpperCase()}): "${block.headingText}"` : 'Heading';
    case 'subheading':
      return block.subheadingText ? `"${block.subheadingText}"` : 'Subheading';
    case 'paragraph':
      return block.paragraphText ? block.paragraphText.slice(0, 60) + '...' : 'Empty paragraph';
    case 'rich_text':
      return 'Rich formatted text block';
    case 'button':
      return block.buttonText ? `Button: "${block.buttonText}" → ${block.buttonLink}` : 'Button';
    case 'bullet_list':
      return `${block.listItems?.length || 0} bullet items`;
    case 'numbered_list':
      return `${block.listItems?.length || 0} numbered items`;
    case 'image':
      return block.imageAlt ? `Image: ${block.imageAlt}` : 'Image block';
    case 'divider':
      return 'Divider line';
    case 'faq':
      return block.faqQuestion ? `FAQ: ${block.faqQuestion}` : 'FAQ question & answer';
    case 'contact_info':
      return 'Contact details & hours';
    default:
      return 'Content block';
  }
}

// Add Block Button
function AddBlockButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-3 bg-neutral-800 hover:bg-neutral-700 text-left rounded-xl transition-colors cursor-pointer flex flex-col items-start gap-1.5"
    >
      <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs font-semibold text-neutral-200">{label}</span>
    </button>
  );
}

// Individual block editor form
function BlockEditor({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (updates: Partial<PageBlock>) => void;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Heading Level</label>
              <select
                value={block.headingLevel || 'h2'}
                onChange={(e) => onChange({ headingLevel: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
              >
                <option value="h1">Heading 1 (Main page heading)</option>
                <option value="h2">Heading 2 (Section title)</option>
                <option value="h3">Heading 3 (Sub-section title)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Text Alignment</label>
              <select
                value={block.headingAlign || 'left'}
                onChange={(e) => onChange({ headingAlign: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
              >
                <option value="left">Left Aligned</option>
                <option value="center">Center Aligned</option>
                <option value="right">Right Aligned</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Heading Text</label>
            <input
              type="text"
              placeholder="e.g. 7-Day Return & Replacement Policy"
              value={block.headingText || ''}
              onChange={(e) => onChange({ headingText: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-neutral-900"
            />
          </div>
        </div>
      );

    case 'subheading':
      return (
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Alignment</label>
            <select
              value={block.subheadingAlign || 'left'}
              onChange={(e) => onChange({ subheadingAlign: e.target.value as any })}
              className="w-full max-w-xs px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
            >
              <option value="left">Left Aligned</option>
              <option value="center">Center Aligned</option>
              <option value="right">Right Aligned</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Subheading Text</label>
            <input
              type="text"
              placeholder="Subheading explanation text"
              value={block.subheadingText || ''}
              onChange={(e) => onChange({ subheadingText: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800"
            />
          </div>
        </div>
      );

    case 'paragraph':
      return (
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Alignment</label>
            <select
              value={block.paragraphAlign || 'left'}
              onChange={(e) => onChange({ paragraphAlign: e.target.value as any })}
              className="w-full max-w-xs px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
            >
              <option value="left">Left Aligned</option>
              <option value="center">Center Aligned</option>
              <option value="right">Right Aligned</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Paragraph Text</label>
            <textarea
              rows={5}
              placeholder="Write your paragraph copy here. Line breaks are preserved."
              value={block.paragraphText || ''}
              onChange={(e) => onChange({ paragraphText: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800 leading-relaxed font-sans"
            />
          </div>
        </div>
      );

    case 'rich_text':
      return (
        <div className="space-y-2">
          <label className="block font-bold text-neutral-700">Rich Text HTML / Formatted Content</label>
          <div className="flex flex-wrap gap-1 p-2 bg-neutral-100 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => {
                const cur = block.richTextHtml || '';
                onChange({ richTextHtml: `${cur}<strong>Bold Text</strong>` });
              }}
              className="p-1.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50 font-bold text-xs"
              title="Add Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = block.richTextHtml || '';
                onChange({ richTextHtml: `${cur}<em>Italic Text</em>` });
              }}
              className="p-1.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50 italic text-xs"
              title="Add Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = block.richTextHtml || '';
                onChange({ richTextHtml: `${cur}<u>Underlined Text</u>` });
              }}
              className="p-1.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50 underline text-xs"
              title="Add Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = block.richTextHtml || '';
                onChange({ richTextHtml: `${cur}<h3>Subheading</h3>` });
              }}
              className="p-1.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50 font-bold text-xs"
              title="Add H3 Heading"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = block.richTextHtml || '';
                onChange({ richTextHtml: `${cur}<p><a href="/shop" class="text-neutral-900 underline font-bold">Link Text</a></p>` });
              }}
              className="p-1.5 bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-xs"
              title="Add Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            rows={6}
            value={block.richTextHtml || ''}
            onChange={(e) => onChange({ richTextHtml: e.target.value })}
            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800 font-mono text-xs leading-relaxed"
          />
        </div>
      );

    case 'image':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={block.imageUrl || ''}
                onChange={(e) => onChange({ imageUrl: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Alignment</label>
              <select
                value={block.imageAlign || 'center'}
                onChange={(e) => onChange({ imageAlign: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
              >
                <option value="center">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Alt Text</label>
              <input
                type="text"
                placeholder="Description of image"
                value={block.imageAlt || ''}
                onChange={(e) => onChange({ imageAlt: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Caption (Optional)</label>
              <input
                type="text"
                placeholder="Caption displayed below image"
                value={block.imageCaption || ''}
                onChange={(e) => onChange({ imageCaption: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
          </div>

          {block.imageUrl && (
            <div className="p-2 border border-neutral-200 rounded-xl max-w-xs">
              <img
                src={block.imageUrl}
                alt={block.imageAlt || 'Preview'}
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}
        </div>
      );

    case 'button':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Button Label</label>
              <input
                type="text"
                placeholder="e.g. Contact Us on WhatsApp"
                value={block.buttonText || ''}
                onChange={(e) => onChange({ buttonText: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Link URL</label>
              <input
                type="text"
                placeholder="e.g. /contact or https://wa.me/..."
                value={block.buttonLink || ''}
                onChange={(e) => onChange({ buttonLink: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Button Style</label>
              <select
                value={block.buttonVariant || 'primary'}
                onChange={(e) => onChange({ buttonVariant: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
              >
                <option value="primary">Solid Dark (Primary)</option>
                <option value="outline">Outline Border</option>
                <option value="secondary">Light Gray (Secondary)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Alignment</label>
              <select
                value={block.buttonAlign || 'left'}
                onChange={(e) => onChange({ buttonAlign: e.target.value as any })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
              >
                <option value="left">Left Aligned</option>
                <option value="center">Center Aligned</option>
                <option value="right">Right Aligned</option>
              </select>
            </div>
          </div>
        </div>
      );

    case 'bullet_list':
    case 'numbered_list': {
      const items = block.listItems || [];
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-neutral-700">
              {block.type === 'bullet_list' ? 'Bullet List Items' : 'Numbered List Steps'}
            </label>
            <button
              type="button"
              onClick={() => onChange({ listItems: [...items, 'New item'] })}
              className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 text-neutral-400 font-mono text-center font-bold">
                  {block.type === 'bullet_list' ? '•' : `${idx + 1}.`}
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[idx] = e.target.value;
                    onChange({ listItems: copy });
                  }}
                  className="flex-1 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    const copy = items.filter((_, i) => i !== idx);
                    onChange({ listItems: copy });
                  }}
                  className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg"
                  title="Remove Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'divider':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Divider Style</label>
            <select
              value={block.dividerStyle || 'solid'}
              onChange={(e) => onChange({ dividerStyle: e.target.value as any })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
            >
              <option value="solid">Solid Line</option>
              <option value="dashed">Dashed Line</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1">Spacing</label>
            <select
              value={block.dividerSpacing || 'md'}
              onChange={(e) => onChange({ dividerSpacing: e.target.value as any })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-semibold"
            >
              <option value="sm">Small Spacing</option>
              <option value="md">Medium Spacing</option>
              <option value="lg">Large Spacing</option>
            </select>
          </div>
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-neutral-700 mb-1">FAQ Question</label>
            <input
              type="text"
              placeholder="e.g. How do I track my nationwide courier delivery?"
              value={block.faqQuestion || ''}
              onChange={(e) => onChange({ faqQuestion: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-neutral-900"
            />
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1">FAQ Answer</label>
            <textarea
              rows={4}
              placeholder="Detailed answer to this question..."
              value={block.faqAnswer || ''}
              onChange={(e) => onChange({ faqAnswer: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800 leading-relaxed"
            />
          </div>
        </div>
      );

    case 'contact_info':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+92 300 1234567"
                value={block.contactPhone || ''}
                onChange={(e) => onChange({ contactPhone: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Email Address</label>
              <input
                type="text"
                placeholder="support@alhamd-mobile.com"
                value={block.contactEmail || ''}
                onChange={(e) => onChange({ contactEmail: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Physical Studio Address</label>
              <input
                type="text"
                placeholder="Shop # 12, Commercial Plaza, Lahore"
                value={block.contactAddress || ''}
                onChange={(e) => onChange({ contactAddress: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Operating Hours</label>
              <input
                type="text"
                placeholder="Mon - Sat: 10:00 AM - 9:00 PM PKT"
                value={block.contactHours || ''}
                onChange={(e) => onChange({ contactHours: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">WhatsApp Support Number</label>
            <input
              type="text"
              placeholder="+92 300 1234567"
              value={block.contactWhatsapp || ''}
              onChange={(e) => onChange({ contactWhatsapp: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

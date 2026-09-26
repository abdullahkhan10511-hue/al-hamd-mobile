import { BlogPost } from '@/types/admin';
import { getStoredData, setStoredData } from './storage';
import { logActivity } from './activity';
import { blogPosts as initialBlogPosts } from '@/data/blog';

const STORAGE_KEY = 'blog_posts';

const seedBlog: BlogPost[] = initialBlogPosts.map((p) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  featuredImage: p.image,
  excerpt: p.excerpt,
  content: p.content,
  author: typeof p.author === 'string' ? p.author : p.author.name,
  category: p.category,
  tags: p.tags,
  publishDate: p.publishedAt,
  status: 'published',
}));

export async function getBlogPosts(): Promise<BlogPost[]> {
  const posts = await getStoredData<BlogPost[]>(STORAGE_KEY, seedBlog);
  return posts.sort((a: BlogPost, b: BlogPost) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find((p) => p.slug === slug) || null;
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find((p) => p.id === id) || null;
}

export async function saveBlogPost(
  post: Omit<BlogPost, 'id'> & { id?: string },
  adminEmail: string = 'admin@alhamd.com'
): Promise<BlogPost> {
  const posts = await getBlogPosts();
  const id = post.id || `post-${Date.now()}`;
  const existingIndex = posts.findIndex((p) => p.id === id);

  const newPost: BlogPost = {
    ...post,
    id,
  };

  let updatedList: BlogPost[];
  if (existingIndex >= 0) {
    updatedList = [...posts];
    updatedList[existingIndex] = newPost;
    await logActivity({
      adminEmail,
      action: 'UPDATE_BLOG_POST',
      target: newPost.title,
      details: `Updated blog post "${newPost.title}"`,
    });
  } else {
    updatedList = [newPost, ...posts];
    await logActivity({
      adminEmail,
      action: 'CREATE_BLOG_POST',
      target: newPost.title,
      details: `Created new blog post "${newPost.title}"`,
    });
  }

  await setStoredData(STORAGE_KEY, updatedList);
  return newPost;
}

export async function deleteBlogPost(id: string, adminEmail: string = 'admin@alhamd.com'): Promise<boolean> {
  const posts = await getBlogPosts();
  const target = posts.find((p) => p.id === id);
  if (!target) return false;

  const filtered = posts.filter((p) => p.id !== id);
  await setStoredData(STORAGE_KEY, filtered);

  await logActivity({
    adminEmail,
    action: 'DELETE_BLOG_POST',
    target: target.title,
    details: `Deleted blog post "${target.title}"`,
  });

  return true;
}

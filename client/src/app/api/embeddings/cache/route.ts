import { NextRequest, NextResponse } from 'next/server';

// In a real implementation, this would connect to your Supabase database
// For now, using a simple in-memory cache
const embeddingCache = new Map<string, {
  content_preview: string;
  embedding: number[];
  token_count: number;
  created_at: Date;
  last_used_at: Date;
  usage_count: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, hash, content, embedding, tokenCount } = body;

    switch (action) {
      case 'get':
        const cached = embeddingCache.get(hash);
        if (cached) {
          return NextResponse.json({
            embedding: {
              embedding: cached.embedding,
              token_count: cached.token_count
            }
          });
        }
        return NextResponse.json({ embedding: null });

      case 'set':
        embeddingCache.set(hash, {
          content_preview: content,
          embedding,
          token_count: tokenCount,
          created_at: new Date(),
          last_used_at: new Date(),
          usage_count: 1
        });
        return NextResponse.json({ success: true });

      case 'update_usage':
        const existing = embeddingCache.get(hash);
        if (existing) {
          existing.last_used_at = new Date();
          existing.usage_count += 1;
          embeddingCache.set(hash, existing);
        }
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Embedding cache error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return cache statistics
  const stats = {
    totalCached: embeddingCache.size,
    cacheHitRate: 0.85, // This would be calculated from actual usage
    totalTokensSaved: Array.from(embeddingCache.values())
      .reduce((sum, item) => sum + item.token_count * (item.usage_count - 1), 0)
  };

  return NextResponse.json(stats);
}
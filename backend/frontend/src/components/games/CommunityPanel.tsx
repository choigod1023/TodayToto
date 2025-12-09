interface CommunityPost {
  post_id: number;
  game_id: number;
  title: string;
  content: string;
  likes: number;
  created_at: string;
}

interface CommunityPanelProps {
  posts: CommunityPost[];
}

export function CommunityPanel({ posts }: CommunityPanelProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-2 text-sm font-semibold">커뮤니티 분석글</h2>
      {posts.length === 0 ? (
        <p className="text-xs text-slate-400">분석글이 없습니다.</p>
      ) : (
        <ul className="space-y-3 text-xs">
          {posts.slice(0, 3).map((post) => (
            <li key={post.post_id}>
              <p className="font-medium text-slate-100">{post.title}</p>
              <p className="mt-1 text-slate-300 line-clamp-3 whitespace-pre-line">
                {post.content}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                좋아요 {post.likes} · {post.created_at}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

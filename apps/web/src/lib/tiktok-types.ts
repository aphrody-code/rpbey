export interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  cover: string;
  playUrl: string;
  author: {
    username: string;
    nickname: string;
    avatarThumb: string;
  };
  stats: {
    playCount: number;
    diggCount: number;
  };
  url: string;
}

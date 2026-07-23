import crypto from 'crypto';

export interface GravatarProfile {
  avatar_url: string;
  display_name: string;
  location?: string;
  about_me?: string;
  profile_url?: string;
  preferred_username?: string;
}

export async function getGravatarProfile(email?: string | null): Promise<GravatarProfile> {
  if (!email) {
    return { 
      avatar_url: "https://gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y", 
      display_name: "Usuário" 
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const md5Hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
  const cacheBuster = Math.floor(Date.now() / (1000 * 60 * 5));
  const avatarUrl = `https://gravatar.com/avatar/${md5Hash}?d=robohash&s=200&cb=${cacheBuster}`;
  const defaultDisplayName = cleanEmail.split("@")[0];

  try {
    const res = await fetch(`https://en.gravatar.com/${md5Hash}.json`, { 
      headers: { "User-Agent": "HiveNode-App" },
      next: { revalidate: 300 } 
    });

    if (res.ok) {
      const data = await res.json();
      const entry = data?.entry?.[0];
      if (entry) {
        return {
          avatar_url: avatarUrl,
          display_name: entry.displayName || entry.preferredUsername || defaultDisplayName,
          location: entry.currentLocation || undefined,
          about_me: entry.aboutMe || undefined,
          profile_url: entry.profileUrl || `https://gravatar.com/${md5Hash}`,
          preferred_username: entry.preferredUsername || defaultDisplayName,
        };
      }
    }
  } catch (e) {
    // Graceful fallback if Gravatar REST API is unavailable
  }

  return {
    avatar_url: avatarUrl,
    display_name: defaultDisplayName,
    preferred_username: defaultDisplayName,
  };
}

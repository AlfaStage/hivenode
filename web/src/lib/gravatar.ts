import crypto from 'crypto';

export async function getGravatarProfile(email?: string | null) {
  if (!email) {
    return { avatar_url: "https://gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y", display_name: "Usuário" };
  }

  const md5Hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  
  // Atualiza o parâmetro a cada 5 minutos para limpar o cache do navegador sem dar spam na CDN do Gravatar
  const cacheBuster = Math.floor(Date.now() / (1000 * 60 * 5));
  const avatarUrl = `https://gravatar.com/avatar/${md5Hash}?d=robohash&s=200&cb=${cacheBuster}`;

  return {
    avatar_url: avatarUrl,
    display_name: email.split("@")[0]
  };
}
